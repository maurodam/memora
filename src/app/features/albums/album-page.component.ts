import { Component, input, output } from '@angular/core';
import { AlbumPage } from '../../core/models/models';
import { PhotoSlotComponent } from './photo-slot.component';
@Component({
  selector: 'app-album-page',
  imports: [PhotoSlotComponent],
  template: `<div
    class="relative mx-auto grid aspect-[3/4] w-full max-w-[540px] grid-cols-6 grid-rows-8 gap-3 rounded-sm border bg-white p-6"
    aria-label="Posizioni fotografie"
  >
    @for (cell of cells; track cell.index) {
      @if (adding()) {
        <button
          class="flex items-center justify-center rounded border border-dashed text-xs text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          [style.grid-row]="cell.row"
          [style.grid-column]="cell.column"
          [disabled]="disabled()"
          [attr.aria-label]="'Riga ' + cell.row + ', colonna ' + cell.column"
          (click)="place.emit(cell)"
        >
          +
        </button>
      }
    }
    @for (slot of page().photos; track slot.id) {
      <app-photo-slot
        [slot]="slot"
        [selected]="slot.id === selected()"
        [disabled]="disabled() || adding()"
        [missing]="missing().includes(slot.id)"
        [preview]="previews()[slot.id] || ''"
        (selectSlot)="selectSlot.emit($event)"
        (imageError)="fileMissing.emit(slot.id)"
      />
    }
    @if (!page().photos.length && !adding()) {
      <div
        class="pointer-events-none col-span-6 row-span-8 flex flex-col items-center justify-center gap-2 text-center"
      >
        <span class="text-lg font-medium">Pagina pronta da organizzare</span
        ><span class="max-w-xs text-sm text-muted-foreground"
          >Aggiungi foto e scegli la posizione sulla pagina.</span
        >
      </div>
    }
  </div>`,
})
export class AlbumPageComponent {
  readonly page = input.required<AlbumPage>();
  readonly selected = input<string>();
  readonly adding = input(false);
  readonly disabled = input(false);
  readonly previews = input<Record<string, string>>({});
  readonly missing = input<string[]>([]);
  readonly selectSlot = output<string>();
  readonly place = output<{ row: number; column: number }>();
  readonly fileMissing = output<string>();
  readonly cells = Array.from({ length: 48 }, (_, index) => ({
    index,
    row: Math.floor(index / 6) + 1,
    column: (index % 6) + 1,
  }));
}
