import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { AlbumService } from '../../core/services/album.service';
import { Album, progress } from '../../core/models/models';
@Component({
  selector: 'app-album-card',
  imports: [RouterLink, HlmButtonImports, HlmCardImports, HlmProgressImports],
  template: ` <section hlmCard class="h-full gap-5">
    <div hlmCardHeader>
      <div class="flex items-start justify-between gap-4">
        <h2 hlmCardTitle class="break-words">{{ album().name }}</h2>
        <span class="text-sm tabular-nums text-muted-foreground">{{ stats().percent }}%</span>
      </div>
      <p hlmCardDescription>
        {{ album().pageCount }} pagine · {{ stats().scanned }} / {{ stats().total }} foto acquisite
      </p>
    </div>
    <div hlmCardContent>
      <hlm-progress [value]="stats().percent" aria-label="Avanzamento album"
        ><hlm-progress-indicator
      /></hlm-progress>
      <p class="mt-3 truncate text-xs text-muted-foreground" [title]="album().basePath">
        {{ album().basePath }}
      </p>
    </div>
    <div hlmCardFooter class="flex justify-between gap-2">
      <a hlmBtn [routerLink]="['/albums', album().id]">Apri album</a
      ><button hlmBtn variant="destructive" [disabled]="disabled()" (click)="remove.emit(album())">
        Elimina
      </button>
    </div>
  </section>`,
})
export class AlbumCardComponent {
  readonly album = input.required<Album>();
  readonly disabled = input(false);
  readonly remove = output<Album>();
  private albums = inject(AlbumService);
  readonly stats = computed(() => progress(this.albums.displayAlbum(this.album())));
}
