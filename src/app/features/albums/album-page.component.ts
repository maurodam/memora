import { Component, input, output, signal } from '@angular/core';
import { AlbumPage, PhotoSlot, PhotoPreset, PRESETS, fits } from '../../core/models/models';
import { PhotoSlotComponent } from './photo-slot.component';
@Component({
  selector: 'app-album-page',
  imports: [PhotoSlotComponent],
  template: `<div
    #grid
    class="relative mx-auto grid aspect-[3/4] w-full max-w-[540px] grid-cols-6 grid-rows-8 gap-3 rounded-sm border bg-white p-6"
    aria-label="Posizioni fotografie"
    (dragover)="dragOver($event, grid)"
    (drop)="drop($event, grid)"
    (dragleave)="leave($event, grid)"
  >
    @for (cell of cells; track cell.index) {
      <button
        class="flex items-center justify-center rounded border border-dashed text-xs text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50"
        [style.grid-row]="cell.row"
        [style.grid-column]="cell.column"
        [class.invisible]="occupied(cell)"
        [disabled]="disabled() || !canPlace(cell)"
        [attr.aria-label]="'Riga ' + cell.row + ', colonna ' + cell.column"
        (click)="place.emit(cell)"
      >
        +
      </button>
    }
    @for (slot of page().photos; track slot.id) {
      <app-photo-slot
        [slot]="slot"
        [selected]="slot.id === selected()"
        [disabled]="disabled()"
        [missing]="missing().includes(slot.id)"
        [preview]="previews()[slot.id] || ''"
        (selectSlot)="selectSlot.emit($event)"
        (scanSlot)="scanSlot.emit($event)"
        (removeSlot)="removeSlot.emit($event)"
        (imageError)="fileMissing.emit(slot.id)"
        (dragStart)="start($event, slot)"
        (dragEnd)="reset()"
      />
    }
    @if (target(); as t) {
      <div
        class="pointer-events-none z-20 rounded-lg border-2 border-dashed bg-primary/10"
        [class.border-primary]="t.valid"
        [class.border-destructive]="!t.valid"
        [class.bg-destructive/10]="!t.valid"
        [style.grid-row]="t.row + ' / span ' + t.height"
        [style.grid-column]="t.column + ' / span ' + t.width"
        role="status"
        [attr.aria-label]="t.valid ? 'Sposta qui' : 'Posizione occupata'"
      ></div>
    }
  </div>`,
})
export class AlbumPageComponent {
  readonly page = input.required<AlbumPage>();
  readonly selected = input<string>();
  readonly adding = input(false);
  readonly preset = input<PhotoPreset>('horizontal');
  readonly disabled = input(false);
  readonly previews = input<Record<string, string>>({});
  readonly missing = input<string[]>([]);
  readonly selectSlot = output<string>();
  readonly place = output<{ row: number; column: number }>();
  readonly move = output<{ id: string; row: number; column: number }>();
  readonly scanSlot = output<string>();
  readonly removeSlot = output<string>();
  readonly fileMissing = output<string>();
  readonly target = signal<
    (Pick<PhotoSlot, 'row' | 'column' | 'width' | 'height'> & { valid: boolean }) | undefined
  >(undefined);
  private dragging?: { slot: PhotoSlot; offsetX: number; offsetY: number };
  readonly cells = Array.from({ length: 48 }, (_, index) => ({
    index,
    row: Math.floor(index / 6) + 1,
    column: (index % 6) + 1,
  }));
  occupied(cell: { row: number; column: number }): boolean {
    return this.page().photos.some(
      (p) =>
        cell.row >= p.row &&
        cell.row < p.row + p.height &&
        cell.column >= p.column &&
        cell.column < p.column + p.width,
    );
  }
  canPlace(cell: { row: number; column: number }): boolean {
    return fits(this.page(), { ...cell, ...PRESETS[this.preset()] });
  }
  start(event: DragEvent, slot: PhotoSlot): void {
    if (this.disabled() || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dragging = { slot, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', slot.id);
    this.selectSlot.emit(slot.id);
  }
  dragOver(event: DragEvent, grid: HTMLElement): void {
    if (!this.dragging || this.disabled()) return;
    event.preventDefault();
    const rect = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    const left = parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
    const top = parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth);
    const contentWidth =
      grid.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const contentHeight =
      grid.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const pitchX = (contentWidth + parseFloat(style.columnGap)) / 6;
    const pitchY = (contentHeight + parseFloat(style.rowGap)) / 8;
    const { slot, offsetX, offsetY } = this.dragging;
    const column = Math.max(
      1,
      Math.min(
        7 - slot.width,
        1 + Math.round((event.clientX - rect.left - left - offsetX) / pitchX),
      ),
    );
    const row = Math.max(
      1,
      Math.min(
        9 - slot.height,
        1 + Math.round((event.clientY - rect.top - top - offsetY) / pitchY),
      ),
    );
    const candidate = { row, column, width: slot.width, height: slot.height };
    const valid = fits(this.page(), candidate, slot.id);
    this.target.set({ ...candidate, valid });
    if (event.dataTransfer) event.dataTransfer.dropEffect = valid ? 'move' : 'none';
  }
  drop(event: DragEvent, grid: HTMLElement): void {
    this.dragOver(event, grid);
    const target = this.target();
    if (target?.valid && this.dragging && !this.disabled()) {
      event.preventDefault();
      this.move.emit({ id: this.dragging.slot.id, row: target.row, column: target.column });
    }
    this.reset();
  }
  leave(event: DragEvent, grid: HTMLElement): void {
    if (!(event.relatedTarget instanceof Node) || !grid.contains(event.relatedTarget))
      this.target.set(undefined);
  }
  reset(): void {
    this.dragging = undefined;
    this.target.set(undefined);
  }
}
