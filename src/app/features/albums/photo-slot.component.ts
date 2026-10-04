import { Component, input, output } from '@angular/core';
import { PhotoSlot } from '../../core/models/models';
@Component({
  selector: 'app-photo-slot',
  host: {
    class: 'relative z-10 block min-h-0',
    '[style.grid-row]': "slot().row + ' / span ' + slot().height",
    '[style.grid-column]': "slot().column + ' / span ' + slot().width",
  },
  template: `<button
    class="relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    [class.border-primary]="selected()"
    [class.border-border]="!selected()"
    [attr.aria-pressed]="selected()"
    [attr.aria-label]="
      'Foto ' +
      slot().position +
      ', ' +
      (missing() ? 'file mancante' : slot().filePath ? 'acquisita' : 'da acquisire')
    "
    [disabled]="disabled()"
    [draggable]="!disabled()"
    [class.cursor-grab]="!disabled()"
    (dragstart)="dragStart.emit($event)"
    (dragend)="dragEnd.emit()"
    (click)="selectSlot.emit(slot().id)"
  >
    @if (preview() && !missing()) {
      <img
        [src]="preview()"
        alt=""
        draggable="false"
        class="absolute inset-0 h-full w-full object-contain"
        (error)="imageError.emit()"
      /><span class="absolute bottom-2 left-2 rounded-md bg-background/95 px-2 py-1 text-xs"
        >Foto {{ slot().position }} · ✓</span
      >
    } @else {
      <span class="text-lg font-medium">Foto {{ slot().position }}</span
      ><span class="text-xs text-muted-foreground">{{
        missing() ? 'File mancante' : slot().filePath ? 'Caricamento…' : 'Da acquisire'
      }}</span>
    }
    @if (selected()) {
      <span
        class="absolute right-2 top-2 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
        >Selezionata</span
      >
    }
  </button>`,
})
export class PhotoSlotComponent {
  readonly slot = input.required<PhotoSlot>();
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly missing = input(false);
  readonly preview = input('');
  readonly selectSlot = output<string>();
  readonly imageError = output<void>();
  readonly dragStart = output<DragEvent>();
  readonly dragEnd = output<void>();
}
