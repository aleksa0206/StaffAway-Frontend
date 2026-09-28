import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { toApiError } from '../../core/api/api-error';
import { ApiKey } from '../../core/api/models';
import { ApiKeysApi } from '../../core/api/resources';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { FormDialogService } from '../../shared/ui/dialogs';
import { EmptyState, LoadError, SkeletonRows } from '../../shared/ui/feedback';
import { Icon } from '../../shared/ui/icon';
import { NameDialog, NameDialogData } from '../../shared/ui/name-dialog';
import { Pagination } from '../../shared/ui/pagination';
import { ToastService } from '../../shared/ui/toast';
import { TimestampPipe } from '../../shared/util/format';

@Component({
  selector: 'app-api-keys-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Pagination, EmptyState, LoadError, SkeletonRows, Icon, TimestampPipe],
  templateUrl: './api-keys.section.html',
  styleUrl: './api-keys.section.scss',
})
export class ApiKeysSection {
  private readonly api = inject(ApiKeysApi);
  private readonly dialogs = inject(FormDialogService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly clipboard = inject(Clipboard);

  protected readonly page = signal(1);

  protected readonly keys = rxResource({
    params: () => this.page(),
    stream: ({ params: page }) => this.api.list({ page }),
  });

  /** The full key is shown only right after creation; in the list it is masked. */
  protected readonly justCreated = signal<ApiKey | null>(null);

  protected masked(key: string): string {
    return `${key.slice(0, 6)}…${key.slice(-4)}`;
  }

  protected async create(): Promise<void> {
    const created = await this.dialogs.open<ApiKey, NameDialogData<ApiKey>>(
      NameDialog,
      {
        title: 'New API key',
        label: 'Name',
        hint: 'Helps you recognize where the key is used.',
        submitLabel: 'Create',
        save: (name) => this.api.create(name),
      },
      'name-dialog-title',
    );
    if (created) {
      this.justCreated.set(created);
      this.keys.reload();
    }
  }

  protected copy(key: string): void {
    if (this.clipboard.copy(key)) {
      this.toast.success('Key copied.');
    }
  }

  protected async revoke(key: ApiKey): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `Revoke key "${key.name}"?`,
      message: 'A revoked key can no longer be used. This cannot be undone.',
      confirmLabel: 'Revoke',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.api.revoke(key.id).subscribe({
      next: () => this.keys.reload(),
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }

  protected async remove(key: ApiKey): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `Delete key "${key.name}"?`,
      message: 'The key will be permanently removed from the list.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.api.remove(key.id).subscribe({
      next: () => {
        if (this.justCreated()?.id === key.id) this.justCreated.set(null);
        this.keys.reload();
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
