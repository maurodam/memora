import { inject, Injectable } from '@angular/core';
import { ScanRequest, ScanResult, ScannerDevice, ScannerMode } from '../models/models';
import { DesktopService } from './desktop.service';
@Injectable({ providedIn: 'root' })
export class ScannerService {
  private desktop = inject(DesktopService);
  getDevices(mode: ScannerMode): Promise<ScannerDevice[]> {
    return this.desktop.unwrap(window.scanner.getDevices(mode));
  }
  scan(request: ScanRequest): Promise<ScanResult> {
    return window.scanner.scan(request);
  }
  availableModes(): Promise<ScannerMode[]> {
    return this.desktop.unwrap(window.scanner.availableModes());
  }
  cancel(): Promise<void> {
    return this.desktop.unwrap(window.scanner.cancel());
  }
}
