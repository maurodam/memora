import { Injectable, signal } from '@angular/core';
import { AppState, DEFAULT_SETTINGS, STORAGE_KEY, validState } from '../models/models';
@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  readonly error = signal('');
  readonly blocked = signal(false);
  readonly dirty = signal(false);
  load(): AppState {
    const empty: AppState = { version: 1, albums: [], settings: { ...DEFAULT_SETTINGS } };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const state: unknown = JSON.parse(raw);
      if (!validState(state)) throw new Error('invalid');
      return state;
    } catch {
      this.blocked.set(true);
      this.error.set(
        'Metadata non leggibili. Dati originali conservati; ripristina localStorage prima di continuare.',
      );
      return empty;
    }
  }
  save(state: AppState): boolean {
    if (this.blocked()) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.dirty.set(false);
      this.error.set('');
      return true;
    } catch {
      this.dirty.set(true);
      this.error.set(
        'Salvataggio metadata non riuscito. Modifiche conservate in memoria: riprova prima di chiudere.',
      );
      return false;
    }
  }
}
