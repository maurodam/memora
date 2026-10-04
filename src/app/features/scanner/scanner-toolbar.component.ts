import { Component, input, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { ScannerSettings } from '../../core/models/models';
@Component({
  selector: 'app-scanner-toolbar',
  imports: [HlmButtonImports],
  template: `<div class="flex items-center justify-between gap-4 border-t bg-background px-6 py-4">
    <div>
      <p class="text-sm font-medium">
        Pagina {{ page() }}
        @if (photo()) {
          · Foto {{ photo() }}
        }
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        {{ scannerName() }} · {{ settings().dpi }} DPI ·
        {{ settings().format === 'jpeg' ? 'JPEG' : 'PNG' }}
      </p>
    </div>
    <div class="flex gap-2">
      @if (busy() && settings().mode === 'macos') {
        <button hlmBtn variant="outline" (click)="cancel.emit()">Annulla scansione</button>
      }
      <button hlmBtn [disabled]="disabled() || !photo() || busy()" (click)="scan.emit()">
        {{ busy() ? 'Acquisizione…' : 'Scansiona foto' }}
      </button>
    </div>
  </div>`,
})
export class ScannerToolbarComponent {
  readonly page = input.required<number>();
  readonly photo = input<number>();
  readonly scannerName = input('Scanner simulato');
  readonly settings = input.required<ScannerSettings>();
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly scan = output<void>();
  readonly cancel = output<void>();
}
