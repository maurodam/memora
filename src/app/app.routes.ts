import { inject } from '@angular/core';
import { CanDeactivateFn, Routes } from '@angular/router';
import { AlbumService } from './core/services/album.service';
const idle: CanDeactivateFn<unknown> = () => !inject(AlbumService).busy();
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/albums/album-list.component').then((m) => m.AlbumListComponent),
    canDeactivate: [idle],
  },
  {
    path: 'albums/new',
    loadComponent: () =>
      import('./features/albums/album-create.component').then((m) => m.AlbumCreateComponent),
    canDeactivate: [idle],
  },
  {
    path: 'albums/:albumId',
    loadComponent: () =>
      import('./features/albums/album-workspace.component').then((m) => m.AlbumWorkspaceComponent),
    canDeactivate: [idle],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
    canDeactivate: [idle],
  },
  { path: '**', redirectTo: '' },
];
