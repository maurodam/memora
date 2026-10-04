import { app, BrowserWindow, protocol, net } from 'electron';
import { promises as fs, watch } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { MacOSScannerAdapter } from './scanner/macos-scanner-adapter';
import { FileStore } from './files/file-store';
import { registerIpc } from './ipc/register';
import { STORAGE_KEY } from '../shared/desktop-contracts';
import { validState } from '../shared/album-rules';
if (process.platform !== 'darwin') {
  console.error('Memora supporta solo macOS.');
  app.exit(1);
}
app.setName('Memora');
// Keep the original profile to preserve existing albums across the Memora rename.
app.setPath(
  'userData',
  process.env['ALBUMSCANNER_TEST_PROFILE'] || path.join(app.getPath('appData'), 'AlbumScanner'),
);
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'album-image', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
if (!app.requestSingleInstanceLock()) app.quit();
const store = new FileStore();
const previews = new Map<string, string>();
let window: BrowserWindow;
const frontend = path.join(app.getAppPath(), 'dist/album-scanner/browser');
app.whenReady().then(async () => {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'albumscanner' || request.method !== 'GET')
      return new Response(null, { status: 403 });
    let requested: string;
    try {
      requested = decodeURIComponent(url.pathname);
    } catch {
      return new Response(null, { status: 400 });
    }
    let file = path.resolve(frontend, '.' + requested);
    if (file !== frontend && !file.startsWith(frontend + path.sep))
      return new Response(null, { status: 403 });
    try {
      if (!(await fs.stat(file)).isFile()) file = path.join(frontend, 'index.html');
    } catch {
      if (path.extname(file)) return new Response(null, { status: 404 });
      file = path.join(frontend, 'index.html');
    }
    return net.fetch(pathToFileURL(file).toString());
  });
  protocol.handle('album-image', async (request) => {
    const url = new URL(request.url);
    const file = previews.get(url.pathname.slice(1));
    if (url.hostname !== 'preview' || !file || request.method !== 'GET')
      return new Response(null, { status: 404 });
    try {
      await store.safe(file);
      return await net.fetch(pathToFileURL(file).toString());
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  let restoring: Promise<void> | undefined;
  const restore = (): Promise<void> =>
    (restoring ??= (async () => {
      try {
        const state: unknown = await window.webContents.executeJavaScript(
          `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || 'null')`,
        );
        if (validState(state))
          for (const album of state.albums)
            await store.authorizeRoot(album.basePath).catch(() => undefined);
      } catch {
        /* Renderer reports corrupted storage. */
      }
    })());
  const helperPath =
    process.env['ALBUMSCANNER_TEST_PROFILE'] && process.env['ALBUMSCANNER_TEST_HELPER']
      ? process.env['ALBUMSCANNER_TEST_HELPER']
      : app.isPackaged
        ? path.join(process.resourcesPath, 'macos-scanner')
        : path.join(app.getAppPath(), 'native/macos-scanner/.build/release/macos-scanner');
  const native = existsSync(helperPath) ? new MacOSScannerAdapter(store, helperPath) : undefined;
  registerIpc(store, () => window, previews, restore, native);
  app.on('before-quit', () => native?.stop());
  async function createWindow(): Promise<void> {
    window = new BrowserWindow({
      width: 1280,
      height: 900,
      minWidth: 960,
      minHeight: 680,
      title: 'Memora',
      backgroundColor: '#fafafa',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('app://albumscanner/')) event.preventDefault();
    });
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    window.webContents.on('did-finish-load', async () => {
      previews.clear();
      await restore();
      window.show();
    });
    await window.loadURL('app://albumscanner/');
  }
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  if (process.argv.includes('--development')) {
    let timer: NodeJS.Timeout;
    watch(frontend, (_event, name) => {
      if (name === 'index.html') {
        clearTimeout(timer);
        timer = setTimeout(() => window.webContents.reload(), 300);
      }
    });
  }
});
app.on('window-all-closed', () => app.quit());
