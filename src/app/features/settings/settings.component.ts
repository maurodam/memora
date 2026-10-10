import { Component, inject, signal } from '@angular/core';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { AlbumService } from '../../core/services/album.service';
import { ScannerSettingsService } from '../../core/services/scanner-settings.service';
import { ScannerService } from '../../core/services/scanner.service';
import { DesktopService } from '../../core/services/desktop.service';
import { ScanFormat, ScannerDevice, ScannerMode } from '../../core/models/models';
@Component({
  selector: 'app-settings',
  imports: [HlmCardImports, HlmNativeSelectImports, HlmButtonImports],
  template: `<div class="mx-auto max-w-2xl p-8">
    <h1 class="mb-6 text-3xl font-semibold tracking-tight">Impostazioni</h1>
    <section hlmCard>
      <div hlmCardHeader>
        <h2 hlmCardTitle>Scanner</h2>
        <p hlmCardDescription>Preferenze salvate su questo Mac.</p>
      </div>
      <div hlmCardContent class="space-y-5">
        <div class="space-y-2">
          <label for="scanner-mode" class="block text-sm font-medium">Modalità scanner</label
          ><hlm-native-select
            selectId="scanner-mode"
            class="block"
            [value]="settings.settings().mode"
            [disabled]="albums.busy() || albums.storage.blocked()"
            (valueChange)="mode($event)"
            ><option hlmNativeSelectOption value="fake">Fake Scanner</option>
            <option hlmNativeSelectOption value="macos" [disabled]="!modes().includes('macos')">
              Scanner macOS {{ modes().includes('macos') ? '' : '(non disponibile)' }}
            </option></hlm-native-select
          >
        </div>
        <div class="space-y-2">
          <label for="scanner-device" class="block text-sm font-medium">Scanner</label
          ><hlm-native-select
            selectId="scanner-device"
            [value]="settings.settings().deviceId || devices()[0]?.id || ''"
            [disabled]="albums.busy()"
            (valueChange)="device($event)"
          >
            @for (device of devices(); track device.id) {
              <option hlmNativeSelectOption [value]="device.id">{{ device.name }}</option>
            }
            @if (!devices().length) {
              <option hlmNativeSelectOption value="">Nessuno scanner disponibile</option>
            }</hlm-native-select
          ><button hlmBtn variant="ghost" size="sm" [disabled]="albums.busy()" (click)="refresh()">
            Aggiorna elenco
          </button>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label for="scanner-dpi" class="block text-sm font-medium">Risoluzione</label
            ><hlm-native-select
              selectId="scanner-dpi"
              [value]="'' + settings.settings().dpi"
              [disabled]="albums.busy()"
              (valueChange)="dpi($event)"
              ><option hlmNativeSelectOption value="300" [disabled]="!supportsDpi(300)">
                300 DPI
              </option>
              <option hlmNativeSelectOption value="600" [disabled]="!supportsDpi(600)">
                600 DPI
              </option></hlm-native-select
            >
          </div>
          <div class="space-y-2">
            <label for="scanner-format" class="block text-sm font-medium">Formato file</label
            ><hlm-native-select
              selectId="scanner-format"
              [value]="settings.settings().format"
              [disabled]="albums.busy()"
              (valueChange)="format($event)"
              ><option hlmNativeSelectOption value="jpeg" [disabled]="!supportsFormat('jpeg')">
                JPEG
              </option>
              <option hlmNativeSelectOption value="png" [disabled]="!supportsFormat('png')">
                PNG
              </option></hlm-native-select
            >
          </div>
        </div>
        <p class="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {{
            settings.settings().mode === 'fake'
              ? 'Scanner simulato: scegli un file JPG o PNG. Il file viene convertito e salvato nella cartella della foto. I DPI non modificano il file sorgente.'
              : 'Scanner macOS: acquisizione locale tramite ImageCaptureCore.'
          }}
        </p>
      </div>
    </section>
  </div>`,
})
export class SettingsComponent {
  readonly albums = inject(AlbumService);
  readonly settings = inject(ScannerSettingsService);
  private scanner = inject(ScannerService);
  private desktop = inject(DesktopService);
  readonly modes = signal<ScannerMode[]>(['fake']);
  readonly devices = signal<ScannerDevice[]>([]);
  constructor() {
    if (this.desktop.available) {
      void this.scanner.availableModes().then((m) => this.modes.set(m));
      void this.refresh();
    }
  }
  async refresh(): Promise<void> {
    try {
      this.devices.set(await this.scanner.getDevices(this.settings.settings().mode));
    } catch (e) {
      this.devices.set([]);
      this.albums.notify((e as Error).message);
    }
  }
  mode(value: string | null | undefined): void {
    if (value === 'fake' || value === 'macos') {
      this.settings.save({
        ...this.settings.settings(),
        mode: value,
        deviceId: value === 'fake' ? 'fake' : undefined,
      });
      void this.refresh();
    }
  }
  device(value: string | null | undefined): void {
    if (value) this.settings.save({ ...this.settings.settings(), deviceId: value });
  }
  dpi(value: string | null | undefined): void {
    if (value === '300' || value === '600')
      this.settings.save({ ...this.settings.settings(), dpi: Number(value) as 300 | 600 });
  }
  format(value: string | null | undefined): void {
    if (value === 'jpeg' || value === 'png')
      this.settings.save({ ...this.settings.settings(), format: value });
  }
  selectedDevice(): ScannerDevice | undefined {
    return (
      this.devices().find((d) => d.id === this.settings.settings().deviceId) || this.devices()[0]
    );
  }
  supportsDpi(value: 300 | 600): boolean {
    return this.selectedDevice()?.resolutions.includes(value) ?? false;
  }
  supportsFormat(value: ScanFormat): boolean {
    return this.selectedDevice()?.formats.includes(value) ?? false;
  }
}
