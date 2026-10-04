import { Component, input } from '@angular/core';
@Component({
  selector: 'app-empty-state',
  template: `<div
    class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center"
  >
    <div class="text-sm font-medium uppercase tracking-widest text-muted-foreground">
      Memora
    </div>
    <h2 class="text-xl font-semibold">{{ title() }}</h2>
    <p class="max-w-md text-sm text-muted-foreground">{{ description() }}</p>
    <ng-content />
  </div>`,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}
