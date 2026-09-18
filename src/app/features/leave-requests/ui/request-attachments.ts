import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { toApiError } from '../../../core/api/api-error';
import { Attachment } from '../../../core/api/models';
import { AttachmentsApi } from '../../../core/api/resources';
import { ConfirmService } from '../../../shared/ui/confirm-dialog';
import { LoadError } from '../../../shared/ui/feedback';
import { Icon } from '../../../shared/ui/icon';
import { ToastService } from '../../../shared/ui/toast';
import { TimestampPipe } from '../../../shared/util/format';

// Same limits as the backend (middleware/upload.ts), so users don't wait for an upload that will fail.
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-request-attachments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoadError, Icon, TimestampPipe],
  template: `
    <h2 class="section__title">Attachments</h2>

    @if (attachments.error(); as error) {
      <app-load-error [error]="error" (retry)="attachments.reload()" />
    } @else if (attachments.isLoading() && !attachments.hasValue()) {
      <span class="skeleton" style="width: 50%"></span>
    } @else {
      @if (attachments.value()?.length === 0) {
        <p class="text-secondary">No attachments.</p>
      }
      <ul class="files">
        @for (file of attachments.value(); track file.id) {
          <li class="file">
            <app-icon name="file" />
            <!-- fileUrl is a short-lived signed S3 link, so it is opened right away. -->
            <a class="file__name" [href]="file.fileUrl" target="_blank" rel="noopener">{{
              file.fileName
            }}</a>
            <span class="text-meta">{{ file.uploadedAt | timestamp }}</span>
            @if (canManage()) {
              <button
                type="button"
                class="btn btn--ghost btn--icon btn--sm"
                [attr.aria-label]="'Delete attachment ' + file.fileName"
                (click)="remove(file)"
              >
                <app-icon name="trash" [size]="14" />
              </button>
            }
          </li>
        }
      </ul>
    }

    @if (canManage()) {
      <label class="btn btn--sm upload" [class.upload--busy]="uploading()">
        @if (uploading()) {
          <span class="spinner" aria-hidden="true"></span>
          Uploading…
        } @else {
          <app-icon name="paperclip" [size]="14" />
          Add attachment
        }
        <input
          type="file"
          class="visually-hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          [disabled]="uploading()"
          (change)="upload(fileInput)"
          #fileInput
        />
      </label>
      <p class="text-meta">PDF, JPG or PNG, up to 5 MB.</p>
    }
  `,
  styles: `
    .section__title {
      margin-bottom: var(--space-3);
    }
    .files {
      display: grid;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }
    .file {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }
    .file__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .upload {
      margin-bottom: var(--space-1);
    }
    .upload:focus-within {
      outline: 2px solid var(--color-accent);
      outline-offset: 1px;
    }
    .upload--busy {
      cursor: progress;
    }
  `,
})
export class RequestAttachments {
  private readonly api = inject(AttachmentsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly requestId = input.required<number>();
  readonly canManage = input(false);

  protected readonly uploading = signal(false);
  protected readonly attachments = rxResource({
    params: () => this.requestId(),
    stream: ({ params: id }) => this.api.listForRequest(id),
  });

  protected upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      this.toast.error('Only PDF, JPG and PNG files are allowed.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      this.toast.error('The file is larger than 5 MB.');
      return;
    }
    this.uploading.set(true);
    this.api
      .upload(this.requestId(), file)
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe({
        next: (created) => this.attachments.update((list) => [...(list ?? []), created]),
        error: (err: unknown) => this.toast.error(toApiError(err).message),
      });
  }

  protected async remove(file: Attachment): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Delete attachment?',
      message: `The file "${file.fileName}" will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.api.remove(file.id).subscribe({
      next: () => this.attachments.update((list) => list?.filter((f) => f.id !== file.id)),
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
