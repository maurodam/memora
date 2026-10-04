import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { AlbumService } from './core/services/album.service';
import { DesktopService } from './core/services/desktop.service';
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, HlmButtonImports, HlmAlertImports],
  template: `<header class="flex h-[65px] items-center justify-between border-b bg-background px-6">
      <a
        routerLink="/"
        class="text-lg font-semibold tracking-tight"
        [class.pointer-events-none]="albums.busy()"
        >Memora<span class="ml-3 text-xs font-normal tracking-normal text-muted-foreground"
          >your album scanner</span
        ></a
      >
      <nav aria-label="Navigazione" class="flex gap-2" [class.pointer-events-none]="albums.busy()">
        <a
          hlmBtn
          variant="ghost"
          routerLink="/"
          [routerLinkActiveOptions]="{ exact: true }"
          routerLinkActive="bg-secondary"
          >Album</a
        ><a hlmBtn variant="ghost" routerLink="/settings" routerLinkActive="bg-secondary"
          >Impostazioni</a
        >
      </nav>
    </header>
    @if (!desktop.available) {
      <div hlmAlert class="m-4">
        <h2 hlmAlertTitle>Apri Memora con Electron</h2>
        <p hlmAlertDescription>
          Dialog, scanner e filesystem richiedono l’app desktop. Avvia npm run dev.
        </p>
      </div>
    }
    @if (albums.storage.error()) {
      <div
        hlmAlert
        class="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl bg-background"
        role="alert"
      >
        <h2 hlmAlertTitle>Metadata non salvati</h2>
        <p hlmAlertDescription>{{ albums.storage.error() }}</p>
        @if (albums.storage.dirty()) {
          <button hlmBtn variant="outline" class="mt-3" (click)="albums.retry()">
            Riprova salvataggio
          </button>
        }
      </div>
    }
    @if (albums.message()) {
      <div hlmAlert class="fixed right-4 top-20 z-40 max-w-lg bg-background" role="status">
        <p hlmAlertDescription>{{ albums.message() }}</p>
        <button hlmBtn variant="ghost" size="sm" class="mt-2" (click)="albums.message.set('')">
          Chiudi
        </button>
      </div>
    }
    <main><router-outlet /></main>`,
})
export class AppShellComponent {
  readonly albums = inject(AlbumService);
  readonly desktop = inject(DesktopService);
}
