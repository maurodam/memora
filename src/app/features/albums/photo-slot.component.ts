import { Component, input, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { PhotoSlot } from '../../core/models/models';
@Component({
  selector: 'app-photo-slot',
  imports: [HlmButtonImports, NgIcon],
  providers: [provideIcons({ lucidePlus, lucideTrash2 })],
  host: {
    class: 'relative z-10 block min-h-0',
    '[style.grid-row]': "slot().row + ' / span ' + slot().height",
    '[style.grid-column]': "slot().column + ' / span ' + slot().width",
  },
  template: `<div class="group relative h-full">
    <button
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
      <div
        class="pointer-events-none relative flex h-full w-full flex-col items-center justify-center gap-2 group-hover:blur-sm group-focus-within:blur-sm"
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
            class="absolute right-2 top-2 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground group-hover:invisible group-focus-within:invisible"
            >Selezionata</span
          >
        }
      </div>
    </button>
    <div
      class="pointer-events-none invisible absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-2 group-hover:visible group-focus-within:visible"
    >
      <button
        hlmBtn
        size="icon"
        variant="outline"
        type="button"
        class="pointer-events-auto rounded-full"
        [disabled]="disabled()"
        [attr.aria-label]="'Scansiona foto ' + slot().position"
        title="Scansiona foto"
        (click)="scanSlot.emit(slot().id)"
      >
        <ng-icon name="lucidePlus" aria-hidden="true" />
      </button>
      <button
        hlmBtn
        size="icon"
        variant="destructive"
        type="button"
        class="pointer-events-auto rounded-full"
        [disabled]="disabled()"
        [attr.aria-label]="'Elimina foto ' + slot().position"
        title="Elimina foto"
        (click)="removeSlot.emit(slot().id)"
      >
        <ng-icon name="lucideTrash2" aria-hidden="true" />
      </button>
    </div>
  </div>`,
})
export class PhotoSlotComponent {
  readonly slot = input.required<PhotoSlot>();
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly missing = input(false);
  readonly preview = input('');
  readonly selectSlot = output<string>();
  readonly scanSlot = output<string>();
  readonly removeSlot = output<string>();
  readonly imageError = output<void>();
  readonly dragStart = output<DragEvent>();
  readonly dragEnd = output<void>();
}
