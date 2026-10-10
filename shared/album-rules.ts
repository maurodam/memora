import { Album, AlbumPage, AppState, PhotoPreset, PhotoSlot } from './desktop-contracts';
export const PRESETS: Record<PhotoPreset, { width: number; height: number }> = {
  vertical: { width: 2, height: 3 },
  horizontal: { width: 3, height: 2 },
  square: { width: 2, height: 2 },
};
export function photoBaseName(page: number, photo: number, groupByPage = true): string {
  const pageName = `page-${String(page).padStart(3, '0')}`;
  const photoName = `photo-${String(photo).padStart(3, '0')}`;
  return groupByPage ? `${pageName}/${photoName}` : photoName;
}
export function nextPhotoPosition(album: Album, page: AlbumPage): number {
  return album.groupByPage === false
    ? Math.max(...album.pages.map((p) => p.nextPhotoPosition))
    : page.nextPhotoPosition;
}
export function fits(
  page: AlbumPage,
  slot: Pick<PhotoSlot, 'row' | 'column' | 'width' | 'height'>,
  exceptId?: string,
): boolean {
  const { row, column, width, height } = slot;
  return (
    [row, column, width, height].every((n) => Number.isInteger(n) && n > 0) &&
    row + height - 1 <= 8 &&
    column + width - 1 <= 6 &&
    page.photos.every(
      (p) =>
        p.id === exceptId ||
        row + height <= p.row ||
        p.row + p.height <= row ||
        column + width <= p.column ||
        p.column + p.width <= column,
    )
  );
}
export function progress(album: Album): { total: number; scanned: number; percent: number } {
  const photos = album.pages.flatMap((p) => p.photos);
  const scanned = photos.filter((p) => p.filePath).length;
  return {
    total: photos.length,
    scanned,
    percent: photos.length ? Math.round((scanned / photos.length) * 100) : 0,
  };
}
export function nextIncomplete(
  album: Album,
  slotId: string,
): { pageNumber: number; slotId: string } | undefined {
  const all = album.pages.flatMap((page) =>
    [...page.photos]
      .sort((a, b) => a.position - b.position)
      .map((slot) => ({ pageNumber: page.number, slot })),
  );
  const current = all.findIndex((p) => p.slot.id === slotId);
  const ordered = [...all.slice(current + 1), ...all.slice(0, current + 1)];
  const next = ordered.find((p) => !p.slot.filePath);
  return next ? { pageNumber: next.pageNumber, slotId: next.slot.id } : undefined;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
export function validState(value: unknown): value is AppState {
  if (
    !record(value) ||
    value['version'] !== 1 ||
    !Array.isArray(value['albums']) ||
    !record(value['settings'])
  )
    return false;
  const s = value['settings'];
  if (
    !['fake', 'macos'].includes(String(s['mode'])) ||
    (s['dpi'] !== 300 && s['dpi'] !== 600) ||
    !['jpeg', 'png'].includes(String(s['format'])) ||
    (s['deviceId'] !== undefined && !text(s['deviceId']))
  )
    return false;
  const ids = new Set<string>();
  for (const a of value['albums']) {
    if (
      !record(a) ||
      !text(a['id']) ||
      ids.has(a['id']) ||
      !text(a['name']) ||
      !text(a['basePath']) ||
      (a['groupByPage'] !== undefined && typeof a['groupByPage'] !== 'boolean') ||
      !a['basePath'].startsWith('/') ||
      !text(a['createdAt']) ||
      !Number.isFinite(Date.parse(a['createdAt'])) ||
      !integer(a['pageCount']) ||
      !Array.isArray(a['pages']) ||
      a['pages'].length !== a['pageCount']
    )
      return false;
    ids.add(a['id']);
    const photoIds = new Set<string>();
    const albumPositions = new Set<number>();
    for (const [i, p] of a['pages'].entries()) {
      if (
        !record(p) ||
        p['number'] !== i + 1 ||
        !integer(p['nextPhotoPosition']) ||
        !Array.isArray(p['photos'])
      )
        return false;
      const positions = new Set<number>();
      const accepted: PhotoSlot[] = [];
      for (const f of p['photos']) {
        if (
          !record(f) ||
          !text(f['id']) ||
          photoIds.has(f['id']) ||
          !integer(f['position']) ||
          positions.has(f['position']) ||
          (a['groupByPage'] === false && albumPositions.has(f['position'])) ||
          f['position'] >= p['nextPhotoPosition'] ||
          !integer(f['row']) ||
          !integer(f['column']) ||
          !integer(f['width']) ||
          !integer(f['height']) ||
          !['vertical', 'horizontal', 'square'].includes(String(f['preset'])) ||
          (f['filePath'] !== undefined && !text(f['filePath'])) ||
          (f['scannedAt'] !== undefined && !text(f['scannedAt']))
        )
          return false;
        const photo = f as unknown as PhotoSlot;
        const expected = `${a['basePath']}/${photoBaseName(i + 1, photo.position, a['groupByPage'] as boolean | undefined)}`;
        if (
          photo.filePath !== undefined &&
          photo.filePath !== `${expected}.jpg` &&
          photo.filePath !== `${expected}.png`
        )
          return false;
        if (photo.scannedAt !== undefined && !Number.isFinite(Date.parse(photo.scannedAt)))
          return false;
        if (
          !fits(
            { number: i + 1, nextPhotoPosition: p['nextPhotoPosition'], photos: accepted },
            photo,
          )
        )
          return false;
        positions.add(photo.position);
        albumPositions.add(photo.position);
        photoIds.add(photo.id);
        accepted.push(photo);
      }
    }
  }
  const selection = value['selection'];
  if (selection === undefined) return true;
  if (
    !record(selection) ||
    !text(selection['albumId']) ||
    !integer(selection['pageNumber']) ||
    (selection['slotId'] !== undefined && !text(selection['slotId']))
  )
    return false;
  const albums = value['albums'] as Album[];
  const page = albums
    .find((album) => album.id === selection['albumId'])
    ?.pages.find((page) => page.number === selection['pageNumber']);
  return Boolean(
    page &&
    (selection['slotId'] === undefined ||
      page.photos.some((photo) => photo.id === selection['slotId'])),
  );
}
