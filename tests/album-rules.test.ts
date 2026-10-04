import test from 'node:test';
import assert from 'node:assert/strict';
import { fits, nextIncomplete, progress, validState } from '../shared/album-rules';
import { Album, AppState, DEFAULT_SETTINGS, PhotoSlot } from '../shared/desktop-contracts';
const slot = (id: string, position: number, filePath?: string): PhotoSlot => ({
  id,
  position,
  row: 1,
  column: 1,
  width: 2,
  height: 2,
  preset: 'square',
  filePath,
});
const album = (): Album => ({
  id: 'album',
  name: 'Album',
  basePath: '/tmp/Album',
  pageCount: 2,
  createdAt: new Date().toISOString(),
  pages: [
    {
      number: 1,
      nextPhotoPosition: 2,
      photos: [slot('first', 1, '/tmp/Album/page-001/photo-001.jpg')],
    },
    { number: 2, nextPhotoPosition: 4, photos: [slot('last', 3)] },
  ],
});
test('griglia: limiti, sovrapposizioni e modifica stesso slot', () => {
  const page = album().pages[0]!;
  assert.equal(fits(page, { row: 1, column: 1, width: 3, height: 2 }), false);
  assert.equal(fits(page, { row: 3, column: 1, width: 3, height: 2 }), true);
  assert.equal(fits(page, { row: 7, column: 5, width: 3, height: 2 }), false);
  assert.equal(fits(page, { row: 1, column: 1, width: 3, height: 2 }, 'first'), true);
  assert.equal(fits(page, { row: 1.5, column: 1, width: 3, height: 2 }), false);
});
test('prossimo slot attraversa pagine e torna all’inizio', () => {
  const a = album();
  assert.deepEqual(nextIncomplete(a, 'first'), { pageNumber: 2, slotId: 'last' });
  delete a.pages[0]!.photos[0]!.filePath;
  a.pages[1]!.photos[0]!.filePath = '/tmp/last.jpg';
  assert.deepEqual(nextIncomplete(a, 'last'), { pageNumber: 1, slotId: 'first' });
  a.pages[0]!.photos[0]!.filePath = '/tmp/first.jpg';
  assert.equal(nextIncomplete(a, 'last'), undefined);
});
test('avanzamento e numeri stabili con intervalli', () => {
  assert.deepEqual(progress(album()), { total: 2, scanned: 1, percent: 50 });
  const a = album();
  a.pages.forEach((p) => {
    p.photos = [];
  });
  assert.equal(progress(a).percent, 0);
  assert.equal(album().pages[1]!.photos[0]!.position, 3);
});
test('metadata validati: roundtrip, versioni, duplicati, layout', () => {
  const state: AppState = { version: 1, albums: [album()], settings: { ...DEFAULT_SETTINGS } };
  assert.equal(validState(JSON.parse(JSON.stringify(state))), true);
  assert.equal(validState({ ...state, version: 2 }), false);
  assert.equal(
    validState({ ...state, settings: { dpi: 999, mode: 'fake', format: 'jpeg' } }),
    false,
  );
  assert.equal(validState({ ...state, selection: { albumId: 'album', pageNumber: 99 } }), false);
  assert.equal(
    validState({ ...state, selection: { albumId: 'album', pageNumber: 1, slotId: 'missing' } }),
    false,
  );
  const bad = structuredClone(state);
  bad.albums[0]!.pages[1]!.photos[0]!.column = 6;
  assert.equal(validState(bad), false);
  const duplicate = structuredClone(state);
  duplicate.albums.push(duplicate.albums[0]!);
  assert.equal(validState(duplicate), false);
});
