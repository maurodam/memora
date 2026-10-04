import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { _electron: electron, expect } = require('@playwright/test');
const root = path.resolve('.test-artifacts/layout');
await fs.mkdir(root, { recursive: true });
const parent = await fs.mkdtemp(path.join(root, 'albums-'));
const profile = await fs.mkdtemp(path.join(root, 'profile-'));
const packaged = process.env.ALBUMSCANNER_EXECUTABLE;
const app = await electron.launch({
  executablePath: packaged || require('electron'),
  args: packaged ? [] : ['.'],
  env: { ...process.env, ALBUMSCANNER_TEST_PROFILE: profile },
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('app-album-list');
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, parent);
  await page.getByRole('link', { name: 'Nuovo album', exact: true }).click();
  await page.getByLabel('Nome album').fill('UX griglia');
  await page.getByRole('button', { name: 'Scegli cartella', exact: true }).click();
  await page.getByRole('button', { name: 'Crea album', exact: true }).click();
  await page.waitForSelector('app-album-workspace');
  const state = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem('albumscanner.state.v1')).albums[0].pages[0].photos,
    );
  await page.getByRole('button', { name: 'Riga 1, colonna 1', exact: true }).click();
  await expect(page.locator('app-photo-slot')).toHaveCount(1);
  assert.equal((await state())[0].position, 1);
  await expect(page.getByRole('button', { name: 'Applica', exact: true })).toHaveCount(0);
  await page.getByLabel('Riga', { exact: true }).fill('2');
  await expect.poll(async () => (await state())[0].row).toBe(2);
  await page.getByLabel('Colonna', { exact: true }).fill('2');
  await expect.poll(async () => (await state())[0].column).toBe(2);
  await page.locator('#slot-preset').selectOption('square');
  await expect.poll(async () => (await state())[0].width).toBe(2);
  await page.getByRole('button', { name: 'Riga 5, colonna 1', exact: true }).click();
  await expect(page.locator('app-photo-slot')).toHaveCount(2);
  // Native mouse drag preserves the grabbed offset and snaps to whole cells.
  const drag = async (row, column) => {
    const source = await page.locator('app-photo-slot').first().boundingBox();
    const cell = await page
      .locator(`app-album-page > div > button[aria-label="Riga ${row}, colonna ${column}"]`)
      .boundingBox();
    assert.ok(source && cell);
    await page.mouse.move(source.x + 10, source.y + 10);
    await page.mouse.down();
    await page.mouse.move(source.x + 25, source.y + 25, { steps: 3 });
    await page.mouse.move(cell.x + 10, cell.y + 10, { steps: 12 });
    await page.mouse.up();
  };
  await drag(2, 4);
  await expect
    .poll(async () => ({ row: (await state())[0].row, column: (await state())[0].column }))
    .toEqual({ row: 2, column: 4 });
  await drag(5, 1);
  assert.deepEqual(
    { row: (await state())[0].row, column: (await state())[0].column },
    { row: 2, column: 4 },
  );
  await page.locator('app-photo-slot').first().getByRole('button').click();
  await page.getByLabel('Riga', { exact: true }).fill('8');
  await expect(
    page.getByText('Posizione occupata o fuori dalla pagina.', { exact: true }),
  ).toBeVisible();
  assert.equal((await state())[0].row, 2);
  await page.reload();
  await page.waitForSelector('app-album-workspace');
  assert.equal((await state())[0].column, 4);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(root, 'layout.png') });
  console.log(
    'PASS: direct cell creation, immediate edits, native grid-snapped drag, blocked collisions/bounds and persisted layout.',
  );
} finally {
  await app.close();
  await fs.rm(parent, { recursive: true, force: true });
  await fs.rm(profile, { recursive: true, force: true });
}
