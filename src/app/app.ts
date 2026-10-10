import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideTriangleAlert, lucideCircleX, lucideX } from '@ng-icons/lucide';
import { AlbumService } from './core/services/album.service';
import { DesktopService } from './core/services/desktop.service';
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, HlmButtonImports, HlmAlertImports, NgIcon],
  providers: [provideIcons({ lucideCircleCheck, lucideTriangleAlert, lucideCircleX, lucideX })],
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
      <div hlmAlert variant="warning" class="m-4 w-auto">
        <ng-icon name="lucideTriangleAlert" aria-hidden="true" />
        <h2 hlmAlertTitle>Apri Memora con Electron</h2>
        <p hlmAlertDescription>
          Dialog, scanner e filesystem richiedono l’app desktop. Avvia npm run dev.
        </p>
      </div>
    }
    @if (albums.storage.error()) {
      <div
        hlmAlert
        variant="error"
        class="fixed bottom-4 left-4 right-4 z-50 mx-auto w-auto max-w-3xl shadow-lg"
        role="alert"
      >
        <ng-icon name="lucideCircleX" aria-hidden="true" />
        <h2 hlmAlertTitle>Metadata non salvati</h2>
        <p hlmAlertDescription>{{ albums.storage.error() }}</p>
        @if (albums.storage.dirty()) {
          <button
            hlmBtn
            variant="outline"
            class="col-start-2 mt-3 w-fit border-red-300 bg-white text-red-900 hover:bg-red-100"
            (click)="albums.retry()"
          >
            Riprova salvataggio
          </button>
        }
      </div>
    }
    <div
      class="pointer-events-none fixed left-4 right-4 top-20 z-40 flex justify-end"
      aria-live="polite"
      aria-atomic="true"
    >
      @if (albums.message(); as message) {
        <div
          hlmAlert
          [variant]="message.severity"
          class="pointer-events-auto relative max-w-lg pr-14 shadow-lg"
          [attr.role]="message.severity === 'error' ? 'alert' : 'status'"
          [attr.data-severity]="message.severity"
        >
          <ng-icon [name]="notificationIcons[message.severity]" aria-hidden="true" />
          <h2 hlmAlertTitle>{{ notificationTitles[message.severity] }}</h2>
          <p hlmAlertDescription class="min-w-0 break-words [overflow-wrap:anywhere]">
            {{ message.text }}
          </p>
          <button
            type="button"
            aria-label="Chiudi notifica"
            class="absolute right-2 top-2 flex size-9 items-center justify-center rounded-lg text-current hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            (click)="albums.dismissMessage()"
          >
            <ng-icon name="lucideX" aria-hidden="true" />
          </button>
        </div>
      }
    </div>
    <main><router-outlet /></main>`,
})
export class AppShellComponent {
  readonly notificationTitles = {
    success: 'Operazione completata',
    warning: 'Attenzione',
    error: 'Operazione non riuscita',
  };
  readonly notificationIcons = {
    success: 'lucideCircleCheck',
    warning: 'lucideTriangleAlert',
    error: 'lucideCircleX',
  };
  readonly albums = inject(AlbumService);
  readonly desktop = inject(DesktopService);
}
