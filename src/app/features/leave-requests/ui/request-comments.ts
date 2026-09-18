import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toApiError } from '../../../core/api/api-error';
import { LeaveComment } from '../../../core/api/models';
import { CommentsApi } from '../../../core/api/resources';
import { AuthService } from '../../../core/auth/auth.service';
import { Avatar } from '../../../shared/ui/avatar';
import { ConfirmService } from '../../../shared/ui/confirm-dialog';
import { LoadError } from '../../../shared/ui/feedback';
import { FieldControl, FormField } from '../../../shared/ui/form-field';
import { Icon } from '../../../shared/ui/icon';
import { ToastService } from '../../../shared/ui/toast';
import { FullNamePipe, TimestampPipe } from '../../../shared/util/format';

@Component({
  selector: 'app-request-comments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Avatar,
    LoadError,
    FormField,
    FieldControl,
    Icon,
    FullNamePipe,
    TimestampPipe,
  ],
  template: `
    <h2 class="section__title">Comments</h2>

    @if (comments.error(); as error) {
      <app-load-error [error]="error" (retry)="comments.reload()" />
    } @else if (comments.isLoading() && !comments.hasValue()) {
      <span class="skeleton" style="width: 60%"></span>
    } @else {
      @if (comments.value()?.length === 0) {
        <p class="text-secondary">No comments.</p>
      }
      <ul class="comments">
        @for (comment of comments.value(); track comment.id) {
          <li class="comment">
            <app-avatar [person]="comment.author" [size]="30" />
            <div class="comment__body">
              <div class="comment__meta">
                <strong>{{ comment.author | fullName }}</strong>
                <span class="text-meta">{{ comment.createdAt | timestamp }}</span>
                <span class="comment__actions">
                  @if (isAuthor(comment) && editingId() !== comment.id) {
                    <button
                      type="button"
                      class="btn btn--ghost btn--icon btn--sm"
                      aria-label="Edit comment"
                      (click)="startEdit(comment)"
                    >
                      <app-icon name="pencil" [size]="14" />
                    </button>
                  }
                  @if (canDelete(comment)) {
                    <button
                      type="button"
                      class="btn btn--ghost btn--icon btn--sm"
                      aria-label="Delete comment"
                      (click)="remove(comment)"
                    >
                      <app-icon name="trash" [size]="14" />
                    </button>
                  }
                </span>
              </div>
              @if (editingId() === comment.id) {
                <div class="comment__edit">
                  <label class="visually-hidden" [for]="'edit-comment-' + comment.id"
                    >Edit comment</label
                  >
                  <textarea
                    #editBox
                    class="textarea"
                    [id]="'edit-comment-' + comment.id"
                    maxlength="2000"
                    [value]="comment.text"
                  ></textarea>
                  <div class="comment__edit-actions">
                    <button type="button" class="btn btn--sm" (click)="editingId.set(null)">
                      Cancel
                    </button>
                    <button
                      type="button"
                      class="btn btn--sm btn--primary"
                      [disabled]="savingEdit()"
                      (click)="saveEdit(comment, editBox.value)"
                    >
                      Save
                    </button>
                  </div>
                </div>
              } @else {
                <p class="comment__text">{{ comment.text }}</p>
              }
            </div>
          </li>
        }
      </ul>
    }

    @if (canComment()) {
      <form class="comment-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-field label="New comment">
          <textarea
            class="textarea"
            appFieldControl
            formControlName="text"
            maxlength="2000"
          ></textarea>
        </app-field>
        <div>
          <button
            type="submit"
            class="btn"
            [disabled]="submitting()"
            [attr.aria-busy]="submitting()"
          >
            @if (submitting()) {
              <span class="spinner" aria-hidden="true"></span>
            }
            Add comment
          </button>
        </div>
      </form>
    }
  `,
  styles: `
    .section__title {
      margin-bottom: var(--space-3);
    }
    .comments {
      display: grid;
      gap: var(--space-4);
    }
    .comment {
      display: flex;
      gap: var(--space-3);
    }
    .comment__body {
      flex: 1;
      min-width: 0;
    }
    .comment__meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .comment__actions {
      display: flex;
      margin-left: auto;
    }
    .comment__edit {
      display: grid;
      gap: var(--space-2);
      margin-top: var(--space-1);
    }
    .comment__edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
    .comment__text {
      margin-top: 2px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .comment-form {
      display: grid;
      gap: var(--space-3);
      margin-top: var(--space-5);
    }
  `,
})
export class RequestComments {
  private readonly api = inject(CommentsApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly requestId = input.required<number>();
  readonly canComment = input(false);

  protected readonly comments = rxResource({
    params: () => this.requestId(),
    stream: ({ params: id }) => this.api.listForRequest(id),
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    text: ['', [Validators.required, Validators.maxLength(2000)]],
  });
  protected readonly submitting = signal(false);

  protected readonly editingId = signal<number | null>(null);
  protected readonly savingEdit = signal(false);

  /** Only the author edits their words; managers and Hr may still delete. */
  protected isAuthor(comment: LeaveComment): boolean {
    return comment.authorId === this.auth.user()?.id;
  }

  protected startEdit(comment: LeaveComment): void {
    this.editingId.set(comment.id);
  }

  protected saveEdit(comment: LeaveComment, value: string): void {
    const text = value.trim();
    if (!text) {
      this.toast.error('A comment cannot be empty.');
      return;
    }
    if (text === comment.text) {
      this.editingId.set(null);
      return;
    }
    this.savingEdit.set(true);
    this.api
      .update(comment.id, text)
      .pipe(finalize(() => this.savingEdit.set(false)))
      .subscribe({
        next: (updated) => {
          this.comments.update((list) => list?.map((c) => (c.id === updated.id ? updated : c)));
          this.editingId.set(null);
        },
        error: (err: unknown) => this.toast.error(toApiError(err).message),
      });
  }

  protected canDelete(comment: LeaveComment): boolean {
    const user = this.auth.user();
    return !!user && (comment.authorId === user.id || user.role !== 'Employee');
  }

  protected submit(): void {
    const text = this.form.getRawValue().text.trim();
    if (!text) {
      this.form.controls.text.setErrors({ required: true });
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.api
      .create(this.requestId(), text)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (created) => {
          this.comments.update((list) => [...(list ?? []), created]);
          this.form.reset();
        },
        error: (err: unknown) => this.toast.error(toApiError(err).message),
      });
  }

  protected async remove(comment: LeaveComment): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Delete comment?',
      message: 'The comment will be permanently removed.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.api.remove(comment.id).subscribe({
      next: () => this.comments.update((list) => list?.filter((c) => c.id !== comment.id)),
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
