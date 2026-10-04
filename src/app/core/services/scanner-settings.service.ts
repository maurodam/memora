import { computed, inject, Injectable } from '@angular/core';
import { AlbumService } from './album.service';
import { ScannerSettings } from '../models/models';
@Injectable({ providedIn: 'root' })
export class ScannerSettingsService {
  private albums = inject(AlbumService);
  readonly settings = computed(() => this.albums.state().settings, {
    equal: (previous, next) =>
      previous.mode === next.mode &&
      previous.deviceId === next.deviceId &&
      previous.dpi === next.dpi &&
      previous.format === next.format,
  });
  save(settings: ScannerSettings): void {
    this.albums.settings(settings);
  }
}
