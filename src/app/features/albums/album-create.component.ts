import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AlbumService } from '../../core/services/album.service';
import { DesktopService } from '../../core/services/desktop.service';
@Component({
  selector: 'app-album-create',
  imports: [ReactiveFormsModule, RouterLink, HlmButtonImports, HlmInputImports, HlmCardImports],
  template: ` <div class="mx-auto max-w-2xl p-8">
    <a hlmBtn variant="ghost" routerLink="/" class="mb-6">Tutti gli album</a>
    <section hlmCard>
      <div hlmCardHeader>
        <h1 hlmCardTitle>Nuovo album</h1>
        <p hlmCardDescription>Prepara la struttura del tuo album cartaceo.</p>
      </div>
      <form [formGroup]="form" (ngSubmit)="create()">
        <div hlmCardContent class="space-y-6">
          <div class="space-y-2">
            <label for="album-name" class="text-sm font-medium">Nome album</label
            ><input
              hlmInput
              id="album-name"
              formControlName="name"
              placeholder="Album famiglia 1998"
              class="w-full"
              maxlength="120"
            />
          </div>
          <div class="space-y-2">
            <label for="page-count" class="text-sm font-medium">Numero totale di pagine</label
            ><input
              hlmInput
              id="page-count"
              type="number"
              min="1"
              max="1000"
              step="1"
              formControlName="pages"
              class="w-full"
            />
            <p class="text-xs text-muted-foreground">Pagine numerate automaticamente da 1 a N.</p>
          </div>
          <div class="space-y-2">
            <span class="text-sm font-medium">Cartella di destinazione</span>
            <div class="flex items-center gap-3">
              <button
                hlmBtn
                variant="outline"
                type="button"
                [disabled]="albums.busy()"
                (click)="pickFolder()"
              >
                Scegli cartella</button
              ><span class="min-w-0 break-all text-sm text-muted-foreground">{{
                folder() || 'Nessuna cartella selezionata'
              }}</span>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            Verrà creata una nuova cartella con il nome dell’album.
          </p>
        </div>
        <div hlmCardFooter class="mt-6 justify-end">
          <button
            hlmBtn
            type="submit"
            [disabled]="form.invalid || !folder() || albums.busy() || albums.storage.blocked()"
          >
            {{ albums.busy() ? 'Creazione…' : 'Crea album' }}
          </button>
        </div>
      </form>
    </section>
  </div>`,
})
export class AlbumCreateComponent {
  readonly albums = inject(AlbumService);
  private desktop = inject(DesktopService);
  private router = inject(Router);
  readonly folder = signal('');
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    pages: new FormControl(1, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(1),
        Validators.max(1000),
        Validators.pattern(/^\d+$/),
      ],
    }),
  });
  async pickFolder(): Promise<void> {
    try {
      const folder = await this.desktop.selectFolder();
      if (folder) this.folder.set(folder);
    } catch (e) {
      this.albums.notify((e as Error).message);
    }
  }
  async create(): Promise<void> {
    if (this.form.invalid || !this.folder() || this.albums.busy() || this.albums.storage.blocked())
      return;
    const name = this.form.controls.name.value.trim();
    if (!name) {
      this.form.controls.name.setErrors({ required: true });
      return;
    }
    this.albums.busy.set(true);
    this.albums.dismissMessage();
    try {
      const path = await this.desktop.createAlbum(this.folder(), name);
      const album = this.albums.addAlbum(name, this.form.controls.pages.value, path);
      this.albums.busy.set(false);
      await this.router.navigate(['/albums', album.id]);
    } catch (e) {
      this.albums.notify((e as Error).message);
    } finally {
      this.albums.busy.set(false);
    }
  }
}
