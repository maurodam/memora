import { _electron as electron, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const root = path.resolve('.test-artifacts/native');
await fs.mkdir(root, { recursive: true });
const profile = await fs.mkdtemp(path.join(root, 'profile-'));
const parent = await fs.mkdtemp(path.join(root, 'albums-'));
const source = path.join(root, 'source.png');
const fixture = path.resolve('tests/fixtures/native-helper.mjs');
await fs.chmod(fixture, 0o755);
const executablePath = process.env.ALBUMSCANNER_EXECUTABLE || require('electron');
const app = await electron.launch({
  executablePath,
  args: process.env.ALBUMSCANNER_EXECUTABLE ? [] : ['.'],
  env: {
    ...process.env,
    ALBUMSCANNER_TEST_PROFILE: profile,
    ALBUMSCANNER_TEST_HELPER: fixture,
    ALBUMSCANNER_FIXTURE_IMAGE: source,
  },
});
let page;
const groupByPage = process.env.ALBUMSCANNER_TEST_FLAT !== '1';
const errors = [];
try {
  const bytes = await app.evaluate(({ nativeImage, dialog }, parent) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [parent] });
    return [
      ...nativeImage
        .createFromBitmap(Buffer.alloc(16 * 16 * 4, 255), { width: 16, height: 16 })
        .toPNG(),
    ];
  }, parent);
  await fs.writeFile(source, Buffer.from(bytes));
  page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('link', { name: 'Nuovo album', exact: true }).click();
  await page.getByLabel('Nome album').fill('Native Adapter');
  if (!groupByPage) await page.getByLabel('Suddividi i file in cartelle per pagina').uncheck();
  await page.getByRole('button', { name: 'Scegli cartella', exact: true }).click();
  await page.getByRole('button', { name: 'Crea album', exact: true }).click();
  const add = async (row) => {
    await page.getByRole('button', { name: 'Aggiungi foto', exact: true }).click();
    await page.getByRole('button', { name: `Riga ${row}, colonna 1`, exact: true }).click();
  };
  await add(1);
  const settings = async (device, dpi) => {
    await page.getByRole('link', { name: 'Impostazioni', exact: true }).click();
    await page.locator('#scanner-mode').selectOption('macos');
    await expect(page.locator('#scanner-device option')).toHaveCount(3);
    await page.locator('#scanner-device').selectOption(device);
    await page.locator('#scanner-dpi').selectOption(String(dpi));
    await page.getByRole('link', { name: 'Album', exact: true }).click();
    await page.getByRole('link', { name: 'Apri album', exact: true }).click();
  };
  await settings('flatbed', 600);
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await expect(page.getByText('1 / 1 foto · 100%', { exact: true })).toBeVisible();
  const albumRoot = path.join(parent, 'Native Adapter');
  assert.equal(
    (
      await fs.readFile(
        path.join(albumRoot, groupByPage ? 'page-001/photo-001.jpg' : 'photo-001.jpg'),
      )
    )[0],
    255,
  );
  await add(4);
  await settings('flatbed', 300);
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await page.getByRole('button', { name: 'Annulla scansione', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Scansiona foto', exact: true })).toBeEnabled();
  await expect(page.getByText('1 / 2 foto · 50%', { exact: true })).toBeVisible();
  await settings('unsafe', 600);
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await expect(
    page.getByText('Percorso restituito dallo scanner non valido.', { exact: true }),
  ).toBeVisible();
  await settings('crash', 600);
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await expect(page.getByText('Helper scanner arrestato. Riprova.', { exact: true })).toBeVisible();
  await settings('flatbed', 600);
  await page.getByRole('button', { name: 'Scansiona foto', exact: true }).click();
  await expect(page.getByText('2 / 2 foto · 100%', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Attendi la fine della scansione.', { exact: true }),
  ).not.toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: native adapter capture, cancellation, path validation, crash and restart. Transport simulated; no hardware claim.',
  );
} catch (error) {
  if (page) console.error(await page.locator('body').innerText());
  throw error;
} finally {
  await app.close();
  await fs.rm(parent, { recursive: true, force: true });
  await fs.rm(profile, { recursive: true, force: true });
}
