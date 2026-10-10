import { computed, inject, Injectable, signal } from '@angular/core';
import {
  Album,
  AppState,
  fits,
  nextPhotoPosition,
  PhotoPreset,
  PRESETS,
  ScanResult,
  ScannerSettings,
} from '../models/models';
import { LocalStorageService } from './local-storage.service';
@Injectable({ providedIn: 'root' })
export class AlbumService {
  readonly storage = inject(LocalStorageService);
  readonly state = signal<AppState>(this.storage.load());
  readonly albums = computed(() => this.state().albums);
  readonly missingIds = signal<string[]>([]);
  readonly busy = signal(false);
  readonly message = signal<{ text: string; severity: 'success' | 'warning' | 'error' } | null>(
    null,
  );
  notify(text: string, severity: 'success' | 'warning' | 'error' = 'error'): void {
    if (severity === 'success' && this.storage.error()) return;
    this.message.set({ text, severity });
  }
  dismissMessage(): void {
    this.message.set(null);
  }
  commit(update: (state: AppState) => void): void {
    if (this.storage.blocked()) throw new Error('Metadata non leggibili. Operazione bloccata.');
    const next = structuredClone(this.state());
    update(next);
    this.state.set(next);
    this.storage.save(next);
  }
  retry(): void {
    this.storage.save(this.state());
  }
  addAlbum(name: string, pageCount: number, basePath: string, groupByPage = true): Album {
    const album: Album = {
      id: crypto.randomUUID(),
      name,
      pageCount,
      basePath,
      groupByPage,
      createdAt: new Date().toISOString(),
      pages: Array.from({ length: pageCount }, (_, i) => ({
        number: i + 1,
        nextPhotoPosition: 1,
        photos: [],
      })),
    };
    this.commit((s) => s.albums.push(album));
    return album;
  }
  removeAlbum(id: string): void {
    this.commit((s) => {
      s.albums = s.albums.filter((a) => a.id !== id);
      if (s.selection?.albumId === id) delete s.selection;
    });
  }
  select(albumId: string, pageNumber: number, slotId?: string): void {
    this.commit((s) => {
      s.selection = { albumId, pageNumber, slotId };
    });
  }
  addSlot(
    albumId: string,
    pageNumber: number,
    row: number,
    column: number,
    preset: PhotoPreset,
  ): string {
    const id = crypto.randomUUID();
    this.commit((s) => {
      const album = s.albums.find((a) => a.id === albumId);
      const page = album?.pages.find((p) => p.number === pageNumber);
      if (!album || !page) throw new Error('Pagina non trovata.');
      const slot = {
        id,
        position: nextPhotoPosition(album, page),
        row,
        column,
        ...PRESETS[preset],
        preset,
      };
      if (!fits(page, slot))
        throw new Error('Spazio insufficiente: scegli una cella libera e interna alla pagina.');
      page.photos.push(slot);
      page.nextPhotoPosition = slot.position + 1;
      s.selection = { albumId, pageNumber, slotId: id };
    });
    return id;
  }
  editSlot(
    albumId: string,
    pageNumber: number,
    slotId: string,
    row: number,
    column: number,
    preset: PhotoPreset,
  ): void {
    this.commit((s) => {
      const page = s.albums
        .find((a) => a.id === albumId)!
        .pages.find((p) => p.number === pageNumber)!;
      const slot = page.photos.find((p) => p.id === slotId)!;
      const changes = { row, column, ...PRESETS[preset], preset };
      if (!fits(page, changes, slotId)) throw new Error('Posizione occupata o fuori dalla pagina.');
      Object.assign(slot, changes);
    });
  }
  removeSlot(albumId: string, pageNumber: number, slotId: string): void {
    this.commit((s) => {
      const page = s.albums
        .find((a) => a.id === albumId)!
        .pages.find((p) => p.number === pageNumber)!;
      page.photos = page.photos.filter((p) => p.id !== slotId);
      s.selection = { albumId, pageNumber };
    });
  }
  acquired(
    albumId: string,
    pageNumber: number,
    slotId: string,
    result: Extract<ScanResult, { status: 'success' }>,
  ): void {
    this.commit((s) => {
      const slot = s.albums
        .find((a) => a.id === albumId)!
        .pages.find((p) => p.number === pageNumber)!
        .photos.find((p) => p.id === slotId)!;
      slot.filePath = result.filePath;
      slot.scannedAt = result.scannedAt;
    });
  }
  displayAlbum(album: Album): Album {
    const missing = this.missingIds();
    return {
      ...album,
      pages: album.pages.map((page) => ({
        ...page,
        photos: page.photos.map((slot) =>
          missing.includes(slot.id) ? { ...slot, filePath: undefined } : slot,
        ),
      })),
    };
  }
  setMissing(album: Album, ids: string[]): void {
    const own = new Set(album.pages.flatMap((p) => p.photos.map((f) => f.id)));
    this.missingIds.update((current) => [...current.filter((id) => !own.has(id)), ...ids]);
  }
  settings(settings: ScannerSettings): void {
    this.commit((s) => {
      s.settings = settings;
    });
  }
}
