export type ScanFormat = 'jpeg' | 'png';
export type ScannerMode = 'fake' | 'macos';
export type PhotoPreset = 'vertical' | 'horizontal' | 'square';
export interface PhotoSlot {
  id: string;
  position: number;
  row: number;
  column: number;
  width: number;
  height: number;
  preset: PhotoPreset;
  filePath?: string;
  scannedAt?: string;
}
export interface AlbumPage {
  number: number;
  nextPhotoPosition: number;
  photos: PhotoSlot[];
}
export interface Album {
  id: string;
  name: string;
  pageCount: number;
  basePath: string;
  createdAt: string;
  pages: AlbumPage[];
}
export interface ScannerSettings {
  mode: ScannerMode;
  deviceId?: string;
  dpi: 300 | 600;
  format: ScanFormat;
}
export interface AppState {
  version: 1;
  albums: Album[];
  settings: ScannerSettings;
  selection?: { albumId: string; pageNumber: number; slotId?: string };
}
export interface ScannerDevice {
  id: string;
  name: string;
  resolutions: Array<300 | 600>;
  formats: ScanFormat[];
}
export interface ScanRequest {
  mode: ScannerMode;
  deviceId?: string;
  dpi: 300 | 600;
  format: ScanFormat;
  albumPath: string;
  pageNumber: number;
  photoPosition: number;
  replace: boolean;
}
export type ScanResult =
  | { status: 'success'; filePath: string; scannedAt: string }
  | { status: 'cancelled' }
  | { status: 'error'; code: string; message: string };
export interface ScannerAdapter {
  getDevices(): Promise<ScannerDevice[]>;
  scan(request: ScanRequest): Promise<ScanResult>;
}
export type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };
export interface DesktopApi {
  desktop: {
    selectFolder(): Promise<Result<string | null>>;
    openFolder(path: string): Promise<Result<void>>;
    showFile(path: string): Promise<Result<void>>;
  };
  files: {
    createAlbum(parentPath: string, name: string): Promise<Result<string>>;
    fileExists(path: string): Promise<Result<boolean>>;
    getPreviewUrl(path: string): Promise<Result<string>>;
    trashAlbum(path: string): Promise<Result<void>>;
    trashPhoto(path: string, pageNumber: number, photoPosition: number): Promise<Result<void>>;
  };
  scanner: {
    getDevices(mode: ScannerMode): Promise<Result<ScannerDevice[]>>;
    scan(request: ScanRequest): Promise<ScanResult>;
    cancel(): Promise<Result<void>>;
    availableModes(): Promise<Result<ScannerMode[]>>;
  };
}
export const STORAGE_KEY = 'albumscanner.state.v1';
export const DEFAULT_SETTINGS: ScannerSettings = { mode: 'fake', dpi: 600, format: 'jpeg' };
