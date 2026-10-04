import { Component, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmDialogImports, HlmDialogService } from '@spartan-ng/helm/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
interface Confirmation {
  title: string;
  message: string;
  action: string;
  destructive: boolean;
}
@Component({
  selector: 'app-confirmation',
  imports: [HlmDialogImports, HlmButtonImports],
  template: `<div hlmDialogHeader>
      <h2 hlmDialogTitle>{{ context.title }}</h2>
      <p hlmDialogDescription class="mt-3">{{ context.message }}</p>
    </div>
    <div hlmDialogFooter class="mt-6">
      <button hlmBtn variant="outline" (click)="ref.close(false)">Annulla</button
      ><button
        hlmBtn
        [variant]="context.destructive ? 'destructive' : 'default'"
        (click)="ref.close(true)"
      >
        {{ context.action }}
      </button>
    </div>`,
})
class ConfirmationComponent {
  readonly context = injectBrnDialogContext<Confirmation>();
  readonly ref = inject(BrnDialogRef<boolean>);
}
@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private dialogs = inject(HlmDialogService);
  async ask(title: string, message: string, action: string, destructive = false): Promise<boolean> {
    const ref = this.dialogs.open<boolean, Confirmation>(ConfirmationComponent, {
      context: { title, message, action, destructive },
      closeLabel: 'Chiudi',
      contentClass: 'shadow-none',
      role: 'alertdialog',
    });
    return (await firstValueFrom(ref.closed$)) === true;
  }
}
