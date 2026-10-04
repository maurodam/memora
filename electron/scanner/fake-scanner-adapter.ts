import { convertImage } from './image-conversion';
import { BrowserWindow, dialog } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  ScannerAdapter,
  ScannerDevice,
  ScanRequest,
  ScanResult,
} from '../../shared/desktop-contracts';
import { FileStore, readableError, UserError } from '../files/file-store';
export class FakeScannerAdapter implements ScannerAdapter {
  constructor(
    private store: FileStore,
    private window: () => BrowserWindow,
  ) {}
  async getDevices(): Promise<ScannerDevice[]> {
    return [
      { id: 'fake', name: 'Scanner simulato', resolutions: [300, 600], formats: ['jpeg', 'png'] },
    ];
  }
  async scan(request: ScanRequest): Promise<ScanResult> {
    try {
      await this.store.requireAlbum(request.albumPath);
      const existing = await this.store.candidates(
        request.albumPath,
        request.pageNumber,
        request.photoPosition,
      );
      if (
        !request.replace &&
        (await Promise.all(existing.map((p) => this.store.exists(p)))).some(Boolean)
      )
        throw new UserError('PHOTO_EXISTS', 'Questa fotografia è già stata acquisita.');
      const pick = await dialog.showOpenDialog(this.window(), {
        title: 'Scanner simulato — scegli una fotografia',
        properties: ['openFile'],
        filters: [{ name: 'Fotografie', extensions: ['jpg', 'jpeg', 'png'] }],
      });
      if (pick.canceled || !pick.filePaths[0]) return { status: 'cancelled' };
      const source = pick.filePaths[0];
      if (!['.jpg', '.jpeg', '.png'].includes(path.extname(source).toLowerCase()))
        throw new UserError('INVALID_IMAGE', 'Seleziona un’immagine JPEG o PNG.');
      const bytes = await fs.readFile(source);
      const output = convertImage(bytes, request.format);
      const filePath = await this.store.commit(
        request.albumPath,
        request.pageNumber,
        request.photoPosition,
        request.format,
        output,
        request.replace,
      );
      return { status: 'success', filePath, scannedAt: new Date().toISOString() };
    } catch (e) {
      return { status: 'error', ...readableError(e) };
    }
  }
}
