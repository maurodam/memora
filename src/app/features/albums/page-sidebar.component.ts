import { Component, input, output } from '@angular/core';
import { AlbumPage } from '../../core/models/models';
import { HlmButtonImports } from '@spartan-ng/helm/button';
@Component({
  selector: 'app-page-sidebar',
  imports: [HlmButtonImports],
  template: `<nav aria-label="Pagine album" class="h-full overflow-y-auto border-r bg-muted/30 p-4">
    <h2 class="mb-4 px-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
      Pagine
    </h2>
    @for (page of pages(); track page.number) {
      <button
        hlmBtn
        variant="ghost"
        class="mb-1 flex w-full justify-between gap-3"
        [class.bg-secondary]="page.number === selected()"
        [attr.aria-current]="page.number === selected() ? 'page' : null"
        [disabled]="disabled()"
        (click)="selectPage.emit(page.number)"
      >
        <span>Pagina {{ page.number }}</span
        ><span class="text-xs text-muted-foreground">{{ status(page) }}</span>
      </button>
    }
  </nav>`,
})
export class PageSidebarComponent {
  readonly pages = input.required<AlbumPage[]>();
  readonly selected = input.required<number>();
  readonly disabled = input(false);
  readonly selectPage = output<number>();
  status(page: AlbumPage): string {
    if (!page.photos.length) return 'Vuota';
    const completed = page.photos.filter((p) => p.filePath).length;
    return completed === page.photos.length ? '✓' : `${completed}/${page.photos.length}`;
  }
}
