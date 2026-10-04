import { MacOSScannerAdapter } from '../scanner/macos-scanner-adapter';
import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { FileStore, readableError, UserError } from '../files/file-store';
import { FakeScannerAdapter } from '../scanner/fake-scanner-adapter';
import { ScanRequest } from '../../shared/desktop-contracts';
export function registerIpc(
  store: FileStore,
  window: () => BrowserWindow,
  previews: Map<string, string>,
  restore: () => Promise<void>,
  native?: MacOSScannerAdapter,
): void {
  let scanning = false;
  const fake = new FakeScannerAdapter(store, window);
  const sender = (event: Electron.IpcMainInvokeEvent) => {
    if (
      event.sender !== window().webContents ||
      event.senderFrame !== window().webContents.mainFrame ||
      event.senderFrame?.url.split('/').slice(0, 3).join('/') !== 'app://albumscanner'
    )
      throw new UserError('UNAUTHORIZED', 'Richiesta non autorizzata.');
  };
  function handle(channel: string, operation: (...args: unknown[]) => Promise<unknown>): void {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      try {
        sender(event);
        await restore();
        return { ok: true, value: await operation(...args) };
      } catch (e) {
        return { ok: false, ...readableError(e) };
      }
    });
  }
  const text = (value: unknown): string => {
    if (typeof value !== 'string' || !value)
      throw new UserError('INVALID_INPUT', 'Parametro non valido.');
    return value;
  };
  const positive = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
      throw new UserError('INVALID_INPUT', 'Numero non valido.');
    return value;
  };
  const idle = () => {
    if (scanning) throw new UserError('BUSY', 'Attendi la fine della scansione.');
  };
  handle('desktop:select-folder', async () => {
    idle();
    const result = await dialog.showOpenDialog(window(), {
      title: 'Cartella di destinazione',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const selected = await fs.realpath(result.filePaths[0]);
    await store.noSymlinks(selected);
    store.selectedParents.add(selected);
    return selected;
  });
  handle('desktop:open-folder', async (value) => {
    const safe = await store.requireAlbum(text(value));
    const error = await shell.openPath(safe);
    if (error) throw new UserError('OPEN_FAILED', 'Impossibile aprire la cartella nel Finder.');
  });
  handle('desktop:show-file', async (value) => {
    const safe = await store.safe(text(value));
    if (!(await store.exists(safe))) throw new UserError('FILE_MISSING', 'Immagine mancante.');
    shell.showItemInFolder(safe);
  });
  handle('files:create-album', async (parent, name) => {
    idle();
    return store.createAlbum(text(parent), text(name));
  });
  handle('files:exists', async (value) => store.exists(text(value)));
  handle('files:preview', async (value) => {
    const safe = await store.safe(text(value));
    if (!/^photo-\d+\.(jpg|png)$/.test(path.basename(safe)) || !(await store.exists(safe)))
      throw new UserError('FILE_MISSING', 'Immagine mancante.');
    const token = randomUUID();
    previews.set(token, safe);
    return `album-image://preview/${token}`;
  });
  handle('files:trash-album', async (value) => {
    idle();
    const safe = await store.requireAlbum(text(value));
    await shell.trashItem(safe);
    store.roots.delete(safe);
  });
  handle('files:trash-photo', async (value, page, photo) => {
    idle();
    const root = await store.requireAlbum(text(value));
    const candidates = await store.candidates(root, positive(page), positive(photo));
    for (const file of candidates) if (await store.exists(file)) await shell.trashItem(file);
  });
  handle('scanner:available-modes', async () => (native ? ['fake', 'macos'] : ['fake']));
  handle('scanner:get-devices', async (mode) => {
    if (mode === 'fake') return fake.getDevices();
    if (mode === 'macos' && native) {
      idle();
      return native.getDevices();
    }
    throw new UserError(
      'SCANNER_UNAVAILABLE',
      'Scanner macOS non ancora disponibile. Usa Scanner simulato.',
    );
  });
  handle('scanner:cancel', async () => {
    if (native) return native.cancel();
    throw new UserError('CANCEL_DIALOG', 'Annulla dal dialog di selezione file.');
  });
  ipcMain.handle('scanner:scan', async (event, input: unknown) => {
    let acquired = false;
    try {
      sender(event);
      await restore();
      idle();
      if (typeof input !== 'object' || input === null)
        throw new UserError('INVALID_INPUT', 'Scansione non valida.');
      const r = input as ScanRequest;
      text(r.albumPath);
      positive(r.pageNumber);
      positive(r.photoPosition);
      if (
        !['fake', 'macos'].includes(r.mode) ||
        ![300, 600].includes(r.dpi) ||
        !['jpeg', 'png'].includes(r.format) ||
        typeof r.replace !== 'boolean' ||
        (r.deviceId !== undefined &&
          (typeof r.deviceId !== 'string' || (r.mode === 'fake' && r.deviceId !== 'fake')))
      )
        throw new UserError('INVALID_INPUT', 'Configurazione scanner non valida.');
      const adapter = r.mode === 'fake' ? fake : native;
      if (!adapter)
        throw new UserError(
          'SCANNER_UNAVAILABLE',
          'Helper macOS non disponibile. Esegui npm run scanner:build.',
        );
      scanning = true;
      acquired = true;
      return await adapter.scan(r);
    } catch (e) {
      return { status: 'error', ...readableError(e) };
    } finally {
      if (acquired) scanning = false;
    }
  });
}
