import { Injectable } from '@angular/core';
import { Result } from '../models/models';
@Injectable({ providedIn: 'root' })
export class DesktopService {
  readonly available = typeof window.desktop !== 'undefined';
  async unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
    const result = await promise;
    if (!result.ok) throw new Error(result.message);
    return result.value;
  }
  selectFolder(): Promise<string | null> {
    return this.unwrap(window.desktop.selectFolder());
  }
  createAlbum(parent: string, name: string): Promise<string> {
    return this.unwrap(window.files.createAlbum(parent, name));
  }
  exists(path: string): Promise<boolean> {
    return this.unwrap(window.files.fileExists(path));
  }
  preview(path: string): Promise<string> {
    return this.unwrap(window.files.getPreviewUrl(path));
  }
  openFolder(path: string): Promise<void> {
    return this.unwrap(window.desktop.openFolder(path));
  }
  showFile(path: string): Promise<void> {
    return this.unwrap(window.desktop.showFile(path));
  }
  trashAlbum(path: string): Promise<void> {
    return this.unwrap(window.files.trashAlbum(path));
  }
  trashPhoto(path: string, page: number, photo: number, groupByPage = true): Promise<void> {
    return this.unwrap(window.files.trashPhoto(path, page, photo, groupByPage));
  }
}
