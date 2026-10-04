import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { AlbumService } from '../../core/services/album.service';
import { DesktopService } from '../../core/services/desktop.service';
import { ConfirmationService } from '../../shared/components/confirmation.service';
import { Album } from '../../core/models/models';
import { AlbumCardComponent } from './album-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
@Component({
  selector: 'app-album-list',
  imports: [RouterLink, HlmButtonImports, AlbumCardComponent, EmptyStateComponent],
  template: ` <div class="mx-auto max-w-6xl p-8">
    <div class="mb-8 flex items-end justify-between gap-6">
      <div>
        <p class="mb-2 text-xs uppercase tracking-widest text-muted-foreground">La tua raccolta</p>
        <h1 class="text-3xl font-semibold tracking-tight">Album fotografici</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Conserva fotografie, pagine e ordine dei tuoi ricordi.
        </p>
      </div>
      <a hlmBtn routerLink="/albums/new" [attr.aria-disabled]="albums.storage.blocked()"
        >Nuovo album</a
      >
    </div>
    @if (albums.albums().length) {
      <div class="grid grid-cols-2 gap-5 xl:grid-cols-3">
        @for (album of albums.albums(); track album.id) {
          <app-album-card
            [album]="album"
            [disabled]="albums.busy() || albums.storage.blocked()"
            (remove)="remove($event)"
          />
        }
      </div>
    } @else {
      <app-empty-state
        title="Il primo album inizia qui"
        description="Prepara le pagine e le posizioni delle foto. Poi acquisisci un’immagine alla volta."
        ><a hlmBtn routerLink="/albums/new" class="mt-3">Crea il primo album</a></app-empty-state
      >
    }
  </div>`,
})
export class AlbumListComponent {
  readonly albums = inject(AlbumService);
  private desktop = inject(DesktopService);
  private confirm = inject(ConfirmationService);
  constructor() {
    effect(() => {
      const albums = this.albums.albums();
      if (this.desktop.available) for (const album of albums) void this.checkFiles(album);
    });
  }
  private async checkFiles(album: Album): Promise<void> {
    const missing: string[] = [];
    await Promise.all(
      album.pages
        .flatMap((p) => p.photos)
        .filter((p) => p.filePath)
        .map(async (p) => {
          try {
            if (!(await this.desktop.exists(p.filePath!))) missing.push(p.id);
          } catch {
            /* Workspace reports inaccessible folders. */
          }
        }),
    );
    this.albums.setMissing(album, missing);
  }
  async remove(album: Album): Promise<void> {
    if (
      !(await this.confirm.ask(
        'Elimina album',
        `La cartella “${album.name}” e tutte le fotografie saranno spostate nel Cestino.`,
        'Sposta nel Cestino',
      ))
    )
      return;
    this.albums.busy.set(true);
    this.albums.message.set('');
    try {
      await this.desktop.trashAlbum(album.basePath);
      this.albums.removeAlbum(album.id);
    } catch (e) {
      this.albums.message.set((e as Error).message);
    } finally {
      this.albums.busy.set(false);
    }
  }
}
