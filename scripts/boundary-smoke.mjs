import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { _electron: electron, expect } = require('@playwright/test');
const root = path.resolve('.test-artifacts/boundaries');
await fs.mkdir(root, { recursive: true });
const parent = await fs.mkdtemp(path.join(root, 'albums-'));
const profile = await fs.mkdtemp(path.join(root, 'profile-'));
const packaged = process.env.ALBUMSCANNER_EXECUTABLE;
const app = await electron.launch({
  executablePath: packaged || require('electron'),
  args: packaged ? [] : ['.'],
  cwd: packaged ? root : process.cwd(),
  env: { ...process.env, ALBUMSCANNER_TEST_PROFILE: profile },
});
try {
  const page = await app.firstWindow();
  await page.waitForSelector('app-album-list');
  const preferences = await app.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      sandbox: p.sandbox,
      contextIsolation: p.contextIsolation,
      nodeIntegration: p.nodeIntegration,
    };
  });
  assert.deepEqual(preferences, { sandbox: true, contextIsolation: true, nodeIntegration: false });
  assert.deepEqual(
    await page.evaluate(() =>
      ['require', 'ipcRenderer', 'fs', 'child_process'].map((key) => typeof window[key]),
    ),
    ['undefined', 'undefined', 'undefined', 'undefined'],
  );
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, parent);
  await page.getByRole('link', { name: 'Nuovo album', exact: true }).click();
  await page.getByLabel('Nome album').fill('Controllo confini');
  await page.getByRole('button', { name: 'Scegli cartella', exact: true }).click();
  await page.getByRole('button', { name: 'Crea album', exact: true }).click();
  await page.waitForSelector('app-album-workspace');
  const original = await page.evaluate(() => localStorage.getItem('albumscanner.state.v1'));
  const albumPath = JSON.parse(original).albums[0].basePath;
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = () =>
      new Promise((resolve) => {
        globalThis.releasePicker = resolve;
      });
  });
  const request = {
    mode: 'fake',
    deviceId: 'fake',
    dpi: 600,
    format: 'jpeg',
    albumPath,
    pageNumber: 1,
    photoPosition: 1,
    replace: false,
  };
  await page.evaluate((request) => {
    window.pendingScan = window.scanner.scan(request);
  }, request);
  await expect.poll(() => app.evaluate(() => typeof globalThis.releasePicker)).toBe('function');
  for (let i = 0; i < 2; i++) {
    const result = await page.evaluate((request) => window.scanner.scan(request), request);
    assert.equal(result.status, 'error');
    assert.equal(result.code, 'BUSY');
  }
  const deletion = await page.evaluate((folder) => window.files.trashAlbum(folder), albumPath);
  assert.equal(deletion.ok, false);
  assert.equal(deletion.code, 'BUSY');
  await fs.access(albumPath);
  await app.evaluate(() => globalThis.releasePicker({ canceled: true, filePaths: [] }));
  assert.equal((await page.evaluate(() => window.pendingScan)).status, 'cancelled');
  // Load corrupt metadata without resetting or overwriting the original bytes.
  await page.evaluate(() => localStorage.setItem('albumscanner.state.v1', '{broken'));
  await page.reload();
  await expect(page.getByText(/Metadata non leggibili/)).toBeVisible();
  assert.equal(await page.evaluate(() => localStorage.getItem('albumscanner.state.v1')), '{broken');
  await page.evaluate((raw) => localStorage.setItem('albumscanner.state.v1', raw), original);
  await page.reload();
  await expect(page.getByText(/Metadata non leggibili/)).not.toBeVisible();
  assert.equal(await page.evaluate(() => localStorage.getItem('albumscanner.state.v1')), original);
  await page
    .getByRole('navigation', { name: 'Navigazione' })
    .getByRole('link', { name: 'Album', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Controllo confini', exact: true })).toBeVisible();
  console.log(
    'PASS: packaged Electron isolation, scan lock, protected deletion, corrupt metadata preservation/recovery.',
  );
} finally {
  await app.close();
  await fs.rm(parent, { recursive: true, force: true });
  await fs.rm(profile, { recursive: true, force: true });
}
