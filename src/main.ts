import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app/app';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { routes } from './app/app.routes';
bootstrapApplication(AppShellComponent, {
  providers: [provideRouter(routes), provideSpartanHlm()],
}).catch(console.error);
