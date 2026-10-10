import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FileStore, photoName } from '../electron/files/file-store';
async function fixture() {
  const parent = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'albumscanner-test-')));
  const store = new FileStore();
  store.selectedParents.add(parent);
  const root = await store.createAlbum(parent, 'Album test');
  return { parent, root, store, clean: () => fs.rm(parent, { recursive: true, force: true }) };
}
test('nomi finali con padding e validazione', () => {
  assert.equal(photoName(1, 3, 'jpeg'), 'page-001/photo-003.jpg');
  assert.equal(photoName(1000, 4, 'png'), 'page-1000/photo-004.png');
  assert.throws(() => photoName(-1, 2, 'jpeg'));
  assert.throws(() => photoName(1, 1.1, 'jpeg'));
});
test('creazione album: collisioni e autorizzazione cartella', async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.store.createAlbum(f.parent, 'Album test'), /Esiste già/);
    await assert.rejects(f.store.createAlbum(f.parent, '../escape'), /non valido/);
    await assert.rejects(f.store.createAlbum('/tmp', 'Other'), /dialog nativo/);
  } finally {
    await f.clean();
  }
});
test('path esterni, traversal e symlink bloccati', async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.store.safe(path.join(f.root, '../outside')), /esterno/);
    await fs.symlink(f.parent, path.join(f.root, 'page-001'));
    await assert.rejects(
      f.store.commit(f.root, 1, 1, 'jpeg', Buffer.from('x'), false),
      /simbolici/,
    );
    await assert.rejects(f.store.authorizeRoot('/'), /non valida/);
  } finally {
    await f.clean();
  }
});
test('commit: collisioni senza sovrascrittura, cambio formato, cartella rimossa', async () => {
  const f = await fixture();
  try {
    const jpg = await f.store.commit(f.root, 1, 3, 'jpeg', Buffer.from('old'), false);
    await assert.rejects(
      f.store.commit(f.root, 1, 3, 'png', Buffer.from('new'), false),
      /già stata acquisita/,
    );
    assert.equal(await fs.readFile(jpg, 'utf8'), 'old');
    const png = await f.store.commit(f.root, 1, 3, 'png', Buffer.from('new'), true);
    assert.equal(await f.store.exists(jpg), false);
    assert.equal(await fs.readFile(png, 'utf8'), 'new');
    assert.deepEqual(await fs.readdir(path.dirname(png)), ['photo-003.png']);
    await fs.rm(f.root, { recursive: true });
    await assert.rejects(f.store.commit(f.root, 1, 3, 'png', Buffer.from('x'), true), /rimossa/);
  } finally {
    await f.clean();
  }
});

test('metadata non possono autorizzare cartelle arbitrarie del Mac', async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.store.authorizeRoot(f.parent), /non creata/);
  } finally {
    await f.clean();
  }
});

test('permessi directory negati: nessuna immagine creata', async () => {
  const f = await fixture();
  try {
    await fs.chmod(f.root, 0o500);
    await assert.rejects(f.store.commit(f.root, 1, 1, 'jpeg', Buffer.from('image'), false), {
      code: 'EACCES',
    });
  } finally {
    await fs.chmod(f.root, 0o700);
    await f.clean();
  }
});

test('race durante sostituzione: file concorrente non sovrascritto, originale recuperabile', async () => {
  const f = await fixture();
  const originalLink = fs.link;
  try {
    const file = await f.store.commit(f.root, 1, 1, 'jpeg', Buffer.from('previous'), false);
    let injected = false;
    fs.link = async (source, target) => {
      if (!injected && String(source).includes('.scan-')) {
        injected = true;
        await fs.writeFile(target, 'concurrent', { flag: 'wx' });
      }
      return originalLink(source, target);
    };
    await assert.rejects(f.store.commit(f.root, 1, 1, 'jpeg', Buffer.from('replacement'), true), {
      code: 'EEXIST',
    });
    assert.equal(await fs.readFile(file, 'utf8'), 'concurrent');
    const files = await fs.readdir(path.dirname(file));
    const backup = files.find((name) => name.startsWith('.previous-'))!;
    assert.equal(await fs.readFile(path.join(path.dirname(file), backup), 'utf8'), 'previous');
  } finally {
    fs.link = originalLink;
    await f.clean();
  }
});

test('album senza sottocartelle: pagine distinte, collisioni e sostituzione formato', async () => {
  const f = await fixture();
  try {
    const first = await f.store.commit(f.root, 1, 1, 'jpeg', Buffer.from('first'), false, false);
    const second = await f.store.commit(f.root, 2, 2, 'jpeg', Buffer.from('second'), false, false);
    assert.equal(first, path.join(f.root, 'photo-001.jpg'));
    assert.equal(second, path.join(f.root, 'photo-002.jpg'));
    await assert.rejects(
      f.store.commit(f.root, 1, 1, 'png', Buffer.from('replacement'), false, false),
      /già stata acquisita/,
    );
    const replacement = await f.store.commit(
      f.root,
      1,
      1,
      'png',
      Buffer.from('replacement'),
      true,
      false,
    );
    assert.equal(await f.store.exists(first), false);
    assert.equal(await fs.readFile(second, 'utf8'), 'second');
    assert.equal(await fs.readFile(replacement, 'utf8'), 'replacement');
    assert.deepEqual(await f.store.candidates(f.root, 1, 1, false), [first, replacement]);
    assert.deepEqual((await fs.readdir(f.root)).sort(), [
      '.albumscanner-managed',
      'photo-001.png',
      'photo-002.jpg',
    ]);
  } finally {
    await f.clean();
  }
});
