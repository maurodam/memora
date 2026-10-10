import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { photoBaseName } from '../../shared/album-rules';
import { ScanFormat } from '../../shared/desktop-contracts';
export class UserError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function photoName(
  page: number,
  photo: number,
  format: ScanFormat,
  groupByPage = true,
): string {
  for (const n of [page, photo])
    if (!Number.isSafeInteger(n) || n < 1)
      throw new UserError('INVALID_INPUT', 'Numero pagina o foto non valido.');
  if (format !== 'jpeg' && format !== 'png')
    throw new UserError('INVALID_INPUT', 'Formato non valido.');
  if (typeof groupByPage !== 'boolean')
    throw new UserError('INVALID_INPUT', 'Organizzazione dei file non valida.');
  return `${photoBaseName(page, photo, groupByPage)}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}
const OWNERSHIP_FILE = '.albumscanner-managed';
const OWNERSHIP_CONTENT = 'it.damianomauro.albumscanner/v1\n';
export class FileStore {
  readonly roots = new Set<string>();
  readonly selectedParents = new Set<string>();
  async authorizeRoot(root: string): Promise<void> {
    if (!path.isAbsolute(root) || root === '/' || root === path.dirname(root))
      throw new UserError('INVALID_PATH', 'Cartella album non valida.');
    // Retain missing roots so the UI can report a removed folder without recreating it.
    await this.noSymlinks(root);
    await this.validateOwnership(root);
    this.roots.add(path.resolve(root));
  }
  private async validateOwnership(root: string): Promise<void> {
    try {
      const marker = path.join(root, OWNERSHIP_FILE);
      if (
        (await fs.lstat(marker)).isSymbolicLink() ||
        (await fs.readFile(marker, 'utf8')) !== OWNERSHIP_CONTENT
      )
        throw new UserError('UNAUTHORIZED_PATH', 'Cartella non creata da Memora.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        try {
          await fs.stat(root);
        } catch (missing) {
          if ((missing as NodeJS.ErrnoException).code === 'ENOENT') return;
          throw missing;
        }
        throw new UserError('UNAUTHORIZED_PATH', 'Cartella non creata da Memora.');
      }
      throw error;
    }
  }
  async noSymlinks(target: string): Promise<void> {
    if (!path.isAbsolute(target)) throw new UserError('INVALID_PATH', 'Percorso non valido.');
    let current = path.parse(target).root;
    for (const part of path.resolve(target).split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      try {
        if ((await fs.lstat(current)).isSymbolicLink())
          throw new UserError(
            'UNSAFE_PATH',
            'Le cartelle con collegamenti simbolici non sono supportate.',
          );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw e;
      }
    }
  }
  async safe(target: string, exactRoot = false): Promise<string> {
    if (typeof target !== 'string' || !path.isAbsolute(target))
      throw new UserError('INVALID_PATH', 'Percorso non valido.');
    const full = path.resolve(target);
    if (
      ![...this.roots].some((root) =>
        exactRoot ? full === root : full === root || full.startsWith(root + path.sep),
      )
    )
      throw new UserError('UNAUTHORIZED_PATH', 'Percorso esterno agli album autorizzati.');
    await this.noSymlinks(full);
    const owner = [...this.roots].find(
      (root) => full === root || full.startsWith(root + path.sep),
    )!;
    await this.validateOwnership(owner);
    return full;
  }
  async requireAlbum(root: string): Promise<string> {
    const safe = await this.safe(root, true);
    try {
      if (!(await fs.stat(safe)).isDirectory()) throw new Error();
    } catch {
      throw new UserError('ALBUM_MISSING', 'Cartella album rimossa o non accessibile.');
    }
    return safe;
  }
  async createAlbum(parent: string, name: string): Promise<string> {
    if (!this.selectedParents.has(parent))
      throw new UserError('UNAUTHORIZED_PATH', 'Scegli la cartella con il dialog nativo.');
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > 120 ||
      /[\x00-\x1f/\\:]/.test(name) ||
      ['.', '..'].includes(name.trim())
    )
      throw new UserError(
        'INVALID_NAME',
        'Nome album non valido. Evita /, : e caratteri di controllo.',
      );
    await this.noSymlinks(parent);
    const root = path.join(parent, name.trim());
    try {
      await fs.mkdir(root);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST')
        throw new UserError('EXISTS', 'Esiste già una cartella con questo nome.');
      throw e;
    }
    await fs.writeFile(path.join(root, OWNERSHIP_FILE), OWNERSHIP_CONTENT, { flag: 'wx' });
    this.roots.add(root);
    return root;
  }
  async exists(target: string): Promise<boolean> {
    await this.safe(target);
    try {
      return (await fs.stat(target)).isFile();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw e;
    }
  }
  async candidates(
    root: string,
    page: number,
    photo: number,
    groupByPage = true,
  ): Promise<string[]> {
    await this.safe(root, true);
    return Promise.all(
      (['jpeg', 'png'] as const).map(async (format) =>
        this.safe(path.join(root, photoName(page, photo, format, groupByPage))),
      ),
    );
  }
  async commit(
    root: string,
    page: number,
    photo: number,
    format: ScanFormat,
    bytes: Buffer,
    replace: boolean,
    groupByPage = true,
  ): Promise<string> {
    await this.requireAlbum(root);
    const destination = await this.safe(
      path.join(root, photoName(page, photo, format, groupByPage)),
    );
    const candidates = await this.candidates(root, page, photo, groupByPage);
    const directory = path.dirname(destination);
    try {
      await fs.mkdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    await this.safe(directory);
    const temporary = path.join(directory, `.scan-${randomUUID()}.tmp`);
    const backups: Array<{ original: string; backup: string }> = [];
    await fs.writeFile(temporary, bytes, { flag: 'wx' });
    let published = false;
    try {
      await this.requireAlbum(root);
      await this.safe(destination);
      for (const original of candidates) {
        if (await this.exists(original)) {
          if (!replace)
            throw new UserError('PHOTO_EXISTS', 'Questa fotografia è già stata acquisita.');
          const backup = path.join(directory, `.previous-${randomUUID()}.tmp`);
          await fs.rename(original, backup);
          backups.push({ original, backup });
        }
      }
      // Hard link publishes without overwriting an unexpected file created concurrently.
      await fs.link(temporary, destination);
      published = true;
    } catch (e) {
      for (const b of backups) {
        try {
          await fs.link(b.backup, b.original);
          await fs.unlink(b.backup);
        } catch {
          /* Preserve the previous image in its temporary backup; never overwrite a concurrent file. */
        }
      }
      throw e;
    } finally {
      await fs.unlink(temporary).catch(() => undefined);
    }
    if (published) for (const b of backups) await fs.unlink(b.backup).catch(() => undefined);
    return destination;
  }
}
export function readableError(error: unknown): { code: string; message: string } {
  if (error instanceof UserError) return { code: error.code, message: error.message };
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'EACCES' || code === 'EPERM')
    return {
      code,
      message:
        'Permessi macOS mancanti. Controlla l’accesso alla cartella nelle Impostazioni di Sistema.',
    };
  if (code === 'ENOSPC') return { code, message: 'Spazio sul disco insufficiente.' };
  if (code === 'EEXIST')
    return { code: 'PHOTO_EXISTS', message: 'Questa fotografia è già stata acquisita.' };
  return {
    code: 'FILESYSTEM',
    message: 'Operazione non riuscita. Controlla che cartella e file siano accessibili.',
  };
}
