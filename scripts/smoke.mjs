import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { _electron: electron, expect } = require(
  process.env.PLAYWRIGHT_MODULE || '@playwright/test',
);
const executablePath = process.env.ALBUMSCANNER_EXECUTABLE || require('electron');
const root = path.resolve('.test-artifacts/smoke');
await fs.mkdir(root, { recursive: true });
const parent = await fs.mkdtemp(path.join(root, 'albums-'));
const profile = await fs.mkdtemp(path.join(root, 'profile-'));
const source = path.join(root, 'source.png');
if (process.env.ALBUMSCANNER_EXECUTABLE) process.chdir(root);
let app;
const launch = async () => {
  app = await electron.launch({
    executablePath,
    args: process.env.ALBUMSCANNER_EXECUTABLE ? [] : ['.'],
    env: { ...process.env, ALBUMSCANNER_TEST_PROFILE: profile },
  });
  const fixtureBytes = await app.evaluate(
    ({ nativeImage, dialog }, paths) => {
      // Transparent fixture exercises real Electron image conversion; picker response is deterministic.
      const pixels = Buffer.alloc(4 * 20 * 20);
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i + 2] = 255;
        pixels[i + 3] = (i / 4) % 20 < 10 ? 0 : 255;
      }
      const image = nativeImage.createFromBitmap(pixels, { width: 20, height: 20 });
      dialog.showOpenDialog = async (_window, options) => ({
        canceled: false,
        filePaths: [options.properties.includes('openDirectory') ? paths.parent : paths.source],
      });
      return [...image.toPNG()];
    },
    { source, parent },
  );
  await fs.writeFile(source, Buffer.from(fixtureBytes));
  const page = await app.firstWindow();
  page.on('pageerror', (e) => console.error('Renderer:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('Console:', m.text());
  });
  await page.waitForSelector('app-album-list').catch(async (e) => {
    console.error('Body:', await page.locator('body').innerText());
    await page.screenshot({ path: path.join(root, 'failure.png') });
    throw e;
  });
  return page;
};
const groupByPage = process.env.ALBUMSCANNER_TEST_FLAT !== '1';
const photoPath = (format) =>
  groupByPage ? `page-002/photo-001.${format}` : `photo-002.${format}`;
const errors = [];
try {
  let page = await launch();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('link', { name: 'Nuovo album', exact: true }).click();
  await page.getByLabel('Nome album').fill('Verifica Album');
  await expect(page.getByLabel('Suddividi i file in cartelle per pagina')).toBeChecked();
  if (!groupByPage) await page.getByLabel('Suddividi i file in cartelle per pagina').uncheck();
  await page.getByLabel('Numero totale di pagine').fill('2');
  await page.getByRole('button', { name: 'Scegli cartella', exact: true }).click();
  await page.getByRole('button', { name: 'Crea album', exact: true }).click();
  await page.waitForSelector('app-album-workspace');
  const add = async () => {
    await page.getByRole('button', { name: 'Aggiungi foto', exact: true }).click();
    await page.getByRole('button', { name: 'Riga 1, colonna 1', exact: true }).click();
  };
  await add();
  await page.getByRole('button', { name: /Pagina 2/ }).click();
  await add();
  await page.getByRole('button', { name: /Pagina 1/ }).click();
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pagina 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await expect(page.getByText('2 / 2 foto · 100%', { exact: true })).toBeVisible();
  const albumRoot = path.join(parent, 'Verifica Album');
  const jpg = path.join(albumRoot, photoPath('jpg'));
  if (!groupByPage) {
    assert.equal(
      await fs.readFile(path.join(albumRoot, 'photo-001.jpg')).then((bytes) => bytes[0]),
      255,
    );
    assert.equal(
      (await fs.readdir(albumRoot)).some((name) => /^page-\d+$/.test(name)),
      false,
    );
  }
  const signature = await fs.readFile(jpg);
  assert.equal(signature[0], 255);
  assert.equal(signature[1], 216);
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('button', { name: 'Apri nel Finder', exact: true }).click();
  await page.getByRole('button', { name: 'Mostra file', exact: true }).click();
  const invalid = path.join(root, 'invalid.png');
  await fs.writeFile(invalid, 'not-an-image');
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, invalid);
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await page.getByRole('button', { name: 'Sostituisci', exact: true }).click();
  await expect(
    page.getByText('Il file non è un’immagine JPEG o PNG valida.', { exact: true }),
  ).toBeVisible();
  assert.deepEqual(await fs.readFile(jpg), signature);
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, source);
  const alphaPixel = await app.evaluate(
    ({ nativeImage }, file) => [...nativeImage.createFromPath(file).toBitmap().subarray(0, 4)],
    jpg,
  );
  assert.ok(
    alphaPixel.slice(0, 3).every((n) => n > 230),
    `JPEG alpha not white: ${alphaPixel}`,
  );
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Questa fotografia è già stata acquisita.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await page.getByRole('link', { name: 'Impostazioni', exact: true }).click();
  await page.locator('#scanner-format').selectOption('png');
  await page.getByRole('link', { name: 'Album', exact: true }).click();
  await page.getByRole('link', { name: 'Apri album', exact: true }).click();
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await page.getByRole('button', { name: 'Sostituisci', exact: true }).click();
  const pngPath = path.join(albumRoot, photoPath('png'));
  await expect(page.locator('app-scanner-toolbar button').last()).toHaveText('Scansiona foto');
  assert.equal((await fs.readFile(pngPath))[0], 137);
  await assert.rejects(fs.access(jpg));
  await page.screenshot({ path: path.join(root, 'workspace.png') });
  await app.close();
  page = await launch();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('link', { name: 'Apri album', exact: true }).click();
  await expect(page.getByText('2 / 2 foto · 100%', { exact: true })).toBeVisible();
  await expect(page.locator('app-photo-slot img')).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('albumscanner.state.v1')).albums[0].groupByPage,
    ),
    groupByPage,
  );
  assert.equal(
    await page.evaluate(async () => {
      const r = await window.files.fileExists('/etc/passwd');
      return r.ok;
    }),
    false,
  );
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  await fs.unlink(pngPath);
  await page.reload();
  await expect(page.getByText('File mancante', { exact: true })).toBeVisible();
  await expect(page.getByText('1 / 2 foto · 50%', { exact: true })).toBeVisible();
  // Cancellation preserves the selected slot and does not modify files.
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await expect(page.locator('app-scanner-toolbar button').last()).toHaveText('Scansiona foto');
  await expect(page.getByText('File mancante', { exact: true })).toBeVisible();
  // A failed localStorage write retains scan result and exposes an explicit retry.
  await app.evaluate(({ dialog }, source) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
  }, source);
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new DOMException('Test quota', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Riprova salvataggio' })).toBeVisible();
  assert.equal((await fs.readFile(pngPath))[0], 137);
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalSetItem;
  });
  await page.getByRole('button', { name: 'Riprova salvataggio' }).click();
  await expect(page.getByRole('button', { name: 'Riprova salvataggio' })).not.toBeVisible();
  await page.getByLabel('Colonna', { exact: true }).fill('4');
  const moved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('albumscanner.state.v1')).albums[0].pages[1].photos[0].column,
  );
  assert.equal(moved, 4);
  await page.getByRole('button', { name: 'Elimina foto', exact: true }).click();
  await page.getByRole('button', { name: 'Sposta nel Cestino', exact: true }).click();
  await expect(page.getByText('1 / 1 foto · 100%', { exact: true })).toBeVisible();
  await assert.rejects(fs.access(pngPath));
  const movedRoot = albumRoot + '-moved';
  await fs.rename(albumRoot, movedRoot);
  await page.getByRole('button', { name: /Pagina 1/ }).click();
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await expect(
    page.getByText('Cartella album rimossa o non accessibile.', { exact: true }),
  ).toBeVisible();
  await assert.rejects(fs.access(albumRoot));
  await fs.rename(movedRoot, albumRoot);
  await page.getByRole('link', { name: 'Album', exact: true }).first().click();
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await page.getByRole('button', { name: 'Sposta nel Cestino', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Il primo album inizia qui' })).toBeVisible();
  await assert.rejects(fs.access(albumRoot));
  assert.deepEqual(errors, []);
  console.log(
    'PASS: create, grid, scan, next page, JPEG white alpha, PNG replacement, cancel, restart, missing file, quota retry, edit slot, native Finder/Trash, invalid image, removed album, IPC restrictions.',
  );
  console.log(`Screenshot: ${path.join(root, 'workspace.png')}`);
} catch (error) {
  if (app) {
    const pages = app.windows();
    const page = pages[0];
    if (page) {
      console.error(
        'Failure body:',
        await page
          .locator('body')
          .innerText()
          .catch(() => 'unavailable'),
      );
      await page.screenshot({ path: path.join(root, 'failure.png') }).catch(() => {});
    }
  }
  throw error;
} finally {
  if (app) await app.close().catch(() => {});
}
