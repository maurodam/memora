import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ScannerAdapter,
  ScannerDevice,
  ScanRequest,
  ScanResult,
} from '../../shared/desktop-contracts';
import { FileStore, readableError, UserError } from '../files/file-store';
import { JsonLineClient, HelperResponse } from './json-line-client';
import { convertImage } from './image-conversion';
export class MacOSScannerAdapter implements ScannerAdapter {
  private client: JsonLineClient;
  private scanning = false;
  private cancelled = false;
  private capturing = false;
  private cancelTimer?: NodeJS.Timeout;
  constructor(
    private store: FileStore,
    executable: string,
  ) {
    this.client = new JsonLineClient(executable);
  }
  private check(response: HelperResponse): HelperResponse {
    if (!response.success)
      throw new UserError(
        response.code || 'SCANNER_ERROR',
        response.message || 'Errore scanner macOS.',
      );
    return response;
  }
  async getDevices(): Promise<ScannerDevice[]> {
    const response = this.check(await this.client.request({ command: 'listDevices' }));
    if (!Array.isArray(response.devices))
      throw new UserError('HELPER_PROTOCOL', 'Elenco scanner non valido.');
    for (const item of response.devices as unknown[]) {
      if (
        !item ||
        typeof item !== 'object' ||
        !('id' in item) ||
        typeof item.id !== 'string' ||
        !('name' in item) ||
        typeof item.name !== 'string' ||
        !('resolutions' in item) ||
        !Array.isArray(item.resolutions) ||
        !item.resolutions.every((dpi: unknown) => dpi === 300 || dpi === 600) ||
        !('formats' in item) ||
        !Array.isArray(item.formats) ||
        !item.formats.every((format: unknown) => format === 'jpeg' || format === 'png')
      )
        throw new UserError('HELPER_PROTOCOL', 'Capacità scanner non valide.');
    }
    return response.devices as ScannerDevice[];
  }
  async scan(request: ScanRequest): Promise<ScanResult> {
    let temporary: string | undefined;
    let acquired = false;
    try {
      if (this.scanning) throw new UserError('BUSY', 'Una scansione è già in corso.');
      this.scanning = true;
      acquired = true;
      this.cancelled = false;
      this.capturing = true;
      await this.store.requireAlbum(request.albumPath);
      const candidates = await this.store.candidates(
        request.albumPath,
        request.pageNumber,
        request.photoPosition,
      );
      if (
        !request.replace &&
        (await Promise.all(candidates.map((file) => this.store.exists(file)))).some(Boolean)
      )
        throw new UserError('PHOTO_EXISTS', 'Questa fotografia è già stata acquisita.');
      const devices = await this.getDevices();
      const device =
        devices.find((d) => d.id === request.deviceId) ||
        (!request.deviceId ? devices[0] : undefined);
      if (!device)
        throw new UserError('SCANNER_UNAVAILABLE', 'Scanner non disponibile o scollegato.');
      if (!device.resolutions.includes(request.dpi) || !device.formats.includes(request.format))
        throw new UserError(
          'UNSUPPORTED',
          'Configurazione non supportata. Controlla le impostazioni scanner.',
        );
      temporary = await fs.realpath(
        await fs.mkdtemp(path.join(os.tmpdir(), 'albumscanner-native-')),
      );
      if (this.cancelled) return { status: 'cancelled' };
      const response = this.check(
        await this.client.request(
          {
            command: 'scan',
            deviceId: device.id,
            dpi: request.dpi,
            format: request.format,
            destination: temporary,
          },
          300000,
        ),
      );
      this.capturing = false;
      if (response.cancelled || this.cancelled) return { status: 'cancelled' };
      if (typeof response.filePath !== 'string')
        throw new UserError('NO_IMAGE', 'Lo scanner non ha restituito un’immagine.');
      const outputPath = path.resolve(response.filePath);
      if (!outputPath.startsWith(temporary + path.sep))
        throw new UserError('UNSAFE_PATH', 'Percorso restituito dallo scanner non valido.');
      const real = await fs.realpath(outputPath);
      if (real !== outputPath) throw new UserError('UNSAFE_PATH', 'Immagine scanner non valida.');
      const output = convertImage(await fs.readFile(real), request.format);
      const filePath = await this.store.commit(
        request.albumPath,
        request.pageNumber,
        request.photoPosition,
        request.format,
        output,
        request.replace,
      );
      return { status: 'success', filePath, scannedAt: new Date().toISOString() };
    } catch (error) {
      return this.cancelled
        ? { status: 'cancelled' }
        : { status: 'error', ...readableError(error) };
    } finally {
      if (acquired) {
        clearTimeout(this.cancelTimer);
        this.scanning = false;
        this.capturing = false;
      }
      if (temporary)
        await fs.rm(temporary, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  async cancel(): Promise<void> {
    if (!this.scanning || !this.capturing) return;
    this.cancelled = true;
    this.cancelTimer = setTimeout(() => this.client.stop(), 5000);
    this.check(await this.client.request({ command: 'cancel' }, 5000));
  }
  stop(): void {
    this.client.stop();
  }
}
