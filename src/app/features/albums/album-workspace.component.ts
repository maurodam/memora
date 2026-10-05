import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { AlbumService } from '../../core/services/album.service';
import { DesktopService } from '../../core/services/desktop.service';
import { ScannerService } from '../../core/services/scanner.service';
import { ScannerSettingsService } from '../../core/services/scanner-settings.service';
import { nextIncomplete, PhotoPreset, progress } from '../../core/models/models';
import { ConfirmationService } from '../../shared/components/confirmation.service';
import { PageSidebarComponent } from './page-sidebar.component';
import { AlbumPageComponent } from './album-page.component';
import { ScannerToolbarComponent } from '../scanner/scanner-toolbar.component';
@Component({
  selector: 'app-album-workspace',
  imports: [
    RouterLink,
    FormsModule,
    HlmButtonImports,
    HlmNativeSelectImports,
    HlmInputImports,
    PageSidebarComponent,
    AlbumPageComponent,
    ScannerToolbarComponent,
  ],
  template: ` @if (album(); as a) {
      <div class="flex h-[calc(100vh-65px)] flex-col">
        <div class="flex items-center justify-between gap-6 border-b px-6 py-3">
          <div class="flex items-center gap-4">
            <a hlmBtn variant="ghost" routerLink="/" [class.pointer-events-none]="albums.busy()"
              >Album</a
            >
            <div>
              <h1 class="font-semibold">{{ a.name }}</h1>
              <p class="text-xs text-muted-foreground">
                {{ stats().scanned }} / {{ stats().total }} foto · {{ stats().percent }}%
              </p>
            </div>
          </div>
          <button hlmBtn variant="outline" (click)="openFolder()">Apri nel Finder</button>
        </div>
        <div class="grid min-h-0 flex-1 grid-cols-[180px_1fr]">
          <app-page-sidebar
            [pages]="displayAlbum()!.pages"
            [selected]="pageNumber()"
            [disabled]="albums.busy()"
            (selectPage)="selectPage($event)"
          />
          <div class="overflow-y-auto bg-muted/35 p-6">
            <div
              class="mx-auto mb-5 flex max-w-[800px] flex-wrap items-center justify-between gap-3"
            >
              <div>
                <h2 class="text-xl font-semibold">Pagina {{ pageNumber() }}</h2>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{
                    adding()
                      ? 'Scegli la cella iniziale della foto.'
                      : 'Clicca una cella vuota per aggiungere una foto. Trascina le foto per spostarle.'
                  }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <hlm-native-select
                  aria-label="Preset nuova foto"
                  [value]="preset()"
                  [disabled]="albums.busy()"
                  (valueChange)="setPreset($event)"
                  ><option hlmNativeSelectOption value="horizontal">Orizzontale</option>
                  <option hlmNativeSelectOption value="vertical">Verticale</option>
                  <option hlmNativeSelectOption value="square">Quadrata</option></hlm-native-select
                ><button
                  hlmBtn
                  variant="outline"
                  [disabled]="albums.busy() || albums.storage.blocked()"
                  (click)="adding.set(!adding())"
                >
                  {{ adding() ? 'Annulla' : 'Aggiungi foto' }}
                </button>
              </div>
            </div>
            @if (selected(); as slot) {
              <div
                class="mx-auto mb-5 flex max-w-[800px] flex-wrap items-end gap-3 rounded-xl border bg-background p-3"
              >
                <div>
                  <label for="slot-row" class="mb-1 block text-xs">Riga</label
                  ><input
                    hlmInput
                    id="slot-row"
                    type="number"
                    min="1"
                    max="8"
                    class="w-20"
                    [ngModel]="editRow()"
                    (ngModelChange)="editRow.set($event); edit()"
                    [disabled]="albums.busy()"
                  />
                </div>
                <div>
                  <label for="slot-column" class="mb-1 block text-xs">Colonna</label
                  ><input
                    hlmInput
                    id="slot-column"
                    type="number"
                    min="1"
                    max="6"
                    class="w-20"
                    [ngModel]="editColumn()"
                    (ngModelChange)="editColumn.set($event); edit()"
                    [disabled]="albums.busy()"
                  />
                </div>
                <div>
                  <label for="slot-preset" class="mb-1 block text-xs">Formato slot</label
                  ><hlm-native-select
                    selectId="slot-preset"
                    [value]="editPreset()"
                    [disabled]="albums.busy()"
                    (valueChange)="setEditPreset($event)"
                    ><option hlmNativeSelectOption value="horizontal">Orizzontale</option>
                    <option hlmNativeSelectOption value="vertical">Verticale</option>
                    <option hlmNativeSelectOption value="square">
                      Quadrata
                    </option></hlm-native-select
                  >
                </div>
                <button
                  hlmBtn
                  variant="destructive"
                  [disabled]="albums.busy()"
                  (click)="removeSlot()"
                >
                  Elimina foto
                </button>
                @if (slot.filePath && !missing().includes(slot.id)) {
                  <button hlmBtn variant="ghost" (click)="showFile()">Mostra file</button>
                }
              </div>
            }
            <app-album-page
              [page]="page()!"
              [selected]="selected()?.id"
              [adding]="adding()"
              [preset]="preset()"
              [disabled]="albums.busy() || albums.storage.blocked()"
              [previews]="previews()"
              [missing]="missing()"
              (place)="add($event)"
              (move)="move($event)"
              (selectSlot)="selectSlot($event)"
              (scanSlot)="scanSlot($event)"
              (removeSlot)="removeSlot($event)"
              (fileMissing)="onMissing($event)"
            />
          </div>
        </div>
        <app-scanner-toolbar
          [page]="pageNumber()"
          [photo]="selected()?.position"
          [scannerName]="scannerName()"
          [settings]="settings.settings()"
          [disabled]="adding() || albums.storage.blocked()"
          [busy]="albums.busy()"
          (scan)="scan()"
          (cancel)="cancel()"
        />
      </div>
    } @else {
      <div class="p-8">
        <h1 class="text-xl font-semibold">Album non trovato</h1>
        <a hlmBtn routerLink="/" class="mt-4">Torna agli album</a>
      </div>
    }`,
})
export class AlbumWorkspaceComponent {
  readonly albums = inject(AlbumService);
  readonly settings = inject(ScannerSettingsService);
  private desktop = inject(DesktopService);
  private scanner = inject(ScannerService);
  private confirm = inject(ConfirmationService);
  private route = inject(ActivatedRoute);
  private id = this.route.snapshot.paramMap.get('albumId')!;
  readonly album = computed(() => this.albums.albums().find((a) => a.id === this.id));
  readonly pageNumber = computed(() =>
    this.albums.state().selection?.albumId === this.id
      ? this.albums.state().selection!.pageNumber
      : 1,
  );
  readonly page = computed(() => this.album()?.pages.find((p) => p.number === this.pageNumber()));
  readonly selected = computed(() =>
    this.page()?.photos.find((p) => p.id === this.albums.state().selection?.slotId),
  );
  readonly adding = signal(false);
  readonly preset = signal<PhotoPreset>('horizontal');
  readonly editRow = signal(1);
  readonly editColumn = signal(1);
  readonly editPreset = signal<PhotoPreset>('horizontal');
  readonly previews = signal<Record<string, string>>({});
  readonly missing = this.albums.missingIds;
  readonly scannerName = signal('Scanner simulato');
  readonly displayAlbum = computed(() => {
    const a = this.album();
    if (!a) return undefined;
    return this.albums.displayAlbum(a);
  });
  readonly stats = computed(() =>
    this.displayAlbum() ? progress(this.displayAlbum()!) : { total: 0, scanned: 0, percent: 0 },
  );
  private readonly previewPhotos = computed(
    () =>
      this.album()
        ?.pages.flatMap((page) => page.photos)
        .filter((slot) => slot.filePath)
        .map((slot) => ({ id: slot.id, filePath: slot.filePath!, scannedAt: slot.scannedAt })) ??
      [],
    {
      equal: (previous, next) =>
        previous.length === next.length &&
        previous.every(
          (photo, index) =>
            photo.id === next[index]?.id &&
            photo.filePath === next[index]?.filePath &&
            photo.scannedAt === next[index]?.scannedAt,
        ),
    },
  );
  private previewGeneration = 0;
  constructor() {
    effect(() => {
      const slot = this.selected();
      if (slot) {
        this.editRow.set(slot.row);
        this.editColumn.set(slot.column);
        this.editPreset.set(slot.preset);
      }
    });
    effect(() => {
      const photos = this.previewPhotos();
      if (this.desktop.available) void this.refreshPreviews(photos);
    });
    effect(() => {
      const s = this.settings.settings();
      if (this.desktop.available)
        void this.scanner
          .getDevices(s.mode)
          .then((devices) =>
            this.scannerName.set(
              devices.find((d) => d.id === s.deviceId)?.name ||
                devices[0]?.name ||
                'Scanner non disponibile',
            ),
          )
          .catch((e) => this.albums.notify((e as Error).message));
    });
  }
  private async refreshPreviews(photos: Array<{ id: string; filePath: string }>): Promise<void> {
    const generation = ++this.previewGeneration;
    const previews: Record<string, string> = {};
    const missing: string[] = [];
    await Promise.all(
      photos.map(async (p) => {
        try {
          if (await this.desktop.exists(p.filePath))
            previews[p.id] = await this.desktop.preview(p.filePath);
          else missing.push(p.id);
        } catch (e) {
          this.albums.notify((e as Error).message);
        }
      }),
    );
    if (generation !== this.previewGeneration) return;
    this.previews.set(previews);
    if (this.album()) this.albums.setMissing(this.album()!, missing);
    if (missing.length)
      this.albums.notify(
        'Alcune immagini non sono più presenti. Seleziona gli slot indicati per riacquisirle.',
        'warning',
      );
  }
  onMissing(id: string): void {
    this.missing.update((ids) => [...new Set([...ids, id])]);
  }
  setPreset(value: string | null | undefined): void {
    if (value === 'vertical' || value === 'horizontal' || value === 'square')
      this.preset.set(value);
  }
  setEditPreset(value: string | null | undefined): void {
    if (value === 'vertical' || value === 'horizontal' || value === 'square') {
      this.editPreset.set(value);
      this.edit();
    }
  }
  selectPage(number: number): void {
    if (this.albums.busy()) return;
    this.adding.set(false);
    const page = this.album()!.pages.find((p) => p.number === number)!;
    this.albums.select(
      this.id,
      number,
      page.photos.find((p) => !p.filePath || this.missing().includes(p.id))?.id ||
        page.photos[0]?.id,
    );
  }
  selectSlot(id: string): void {
    if (this.albums.busy()) return;
    this.adding.set(false);
    this.albums.select(this.id, this.pageNumber(), id);
  }
  add(cell: { row: number; column: number }): void {
    if (this.albums.busy() || this.albums.storage.blocked()) return;
    try {
      this.albums.addSlot(this.id, this.pageNumber(), cell.row, cell.column, this.preset());
      this.adding.set(false);
      this.albums.dismissMessage();
    } catch (e) {
      this.albums.notify((e as Error).message);
    }
  }
  move(position: { id: string; row: number; column: number }): void {
    const slot = this.page()?.photos.find((photo) => photo.id === position.id);
    if (!slot || this.albums.busy() || this.albums.storage.blocked()) return;
    try {
      this.albums.editSlot(
        this.id,
        this.pageNumber(),
        slot.id,
        position.row,
        position.column,
        slot.preset,
      );
      this.selectSlot(slot.id);
      this.albums.dismissMessage();
    } catch (e) {
      this.albums.notify((e as Error).message);
    }
  }
  edit(): void {
    if (!this.selected() || this.albums.busy() || this.albums.storage.blocked()) return;
    try {
      this.albums.editSlot(
        this.id,
        this.pageNumber(),
        this.selected()!.id,
        this.editRow(),
        this.editColumn(),
        this.editPreset(),
      );
      this.albums.dismissMessage();
    } catch (e) {
      this.albums.notify((e as Error).message);
    }
  }
  async scanSlot(id: string): Promise<void> {
    if (this.albums.busy() || this.albums.storage.blocked()) return;
    this.selectSlot(id);
    await this.scan();
  }
  async removeSlot(id?: string): Promise<void> {
    if (this.albums.busy() || this.albums.storage.blocked()) return;
    if (id) this.selectSlot(id);
    const slot = this.selected();
    const album = this.album();
    const pageNumber = this.pageNumber();
    if (!slot || !album) return;
    this.albums.busy.set(true);
    try {
      if (
        !(await this.confirm.ask(
          'Elimina foto ' + slot.position,
          slot.filePath
            ? 'L’immagine sarà spostata nel Cestino. Lo slot sarà rimosso senza rinumerare le altre foto.'
            : 'Lo slot sarà rimosso. Le altre foto manterranno il loro numero.',
          slot.filePath ? 'Sposta nel Cestino' : 'Elimina slot',
          true,
        ))
      )
        return;
      await this.desktop.trashPhoto(album.basePath, pageNumber, slot.position);
      this.albums.removeSlot(this.id, pageNumber, slot.id);
    } catch (e) {
      this.albums.notify((e as Error).message);
    } finally {
      this.albums.busy.set(false);
    }
  }
  async scan(): Promise<void> {
    const slot = this.selected();
    const album = this.album();
    const pageNumber = this.pageNumber();
    if (!slot || !album || this.albums.busy() || this.albums.storage.blocked()) return;
    this.albums.busy.set(true);
    this.albums.dismissMessage();
    try {
      const base = `${album.basePath}/page-${String(pageNumber).padStart(3, '0')}/photo-${String(slot.position).padStart(3, '0')}`;
      const exists = (
        await Promise.all(['jpg', 'png'].map((ext) => this.desktop.exists(`${base}.${ext}`)))
      ).some(Boolean);
      let replace = false;
      if (exists) {
        replace = await this.confirm.ask(
          'Questa fotografia è già stata acquisita.',
          'Sostituire l’immagine esistente con una nuova scansione?',
          'Sostituisci',
        );
        if (!replace) return;
      }
      let result = await this.scanner.scan({
        ...this.settings.settings(),
        albumPath: album.basePath,
        pageNumber,
        photoPosition: slot.position,
        replace,
      });
      if (result.status === 'error' && result.code === 'PHOTO_EXISTS' && !replace) {
        if (
          !(await this.confirm.ask(
            'Questa fotografia è già stata acquisita.',
            'Il file è stato creato nel frattempo. Vuoi sostituirlo?',
            'Sostituisci',
          ))
        )
          return;
        result = await this.scanner.scan({
          ...this.settings.settings(),
          albumPath: album.basePath,
          pageNumber,
          photoPosition: slot.position,
          replace: true,
        });
      }
      if (result.status === 'error') throw new Error(result.message);
      if (result.status === 'cancelled') return;
      this.missing.update((ids) => ids.filter((id) => id !== slot.id));
      this.albums.acquired(this.id, pageNumber, slot.id, result);
      const next = nextIncomplete(this.displayAlbum()!, slot.id);
      if (next) this.albums.select(this.id, next.pageNumber, next.slotId);
      else this.albums.notify('Tutte le fotografie preparate sono state acquisite.', 'success');
    } catch (e) {
      this.albums.notify((e as Error).message);
    } finally {
      this.albums.busy.set(false);
    }
  }
  async cancel(): Promise<void> {
    try {
      await this.scanner.cancel();
    } catch (e) {
      this.albums.notify((e as Error).message);
    }
  }
  async openFolder(): Promise<void> {
    try {
      await this.desktop.openFolder(this.album()!.basePath);
    } catch (e) {
      this.albums.notify((e as Error).message);
    }
  }
  async showFile(): Promise<void> {
    try {
      await this.desktop.showFile(this.selected()!.filePath!);
    } catch (e) {
      this.albums.notify((e as Error).message);
    }
  }
}
