import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimpleCounterService } from '../../features/simple-counter/simple-counter.service';
import { HabitManagerComponent } from '../../features/habits/habit-manager.component';
import { map } from 'rxjs/operators';

@Component({
  selector: 'habit-page',
  standalone: true,
  imports: [CommonModule, HabitManagerComponent],
  template: `
    <div class="page-wrapper">
      <flux-habit-manager
        [simpleCounters]="(simpleCounters$ | async) || []"
        [disabledSimpleCounters]="(disabledSimpleCounters$ | async) || []"
      />
    </div>
  `,
  styles: [
    `
      .page-wrapper {
        padding: var(--s2);
        width: 100%;
        max-width: var(--component-max-width);
        box-sizing: border-box;
        margin: 0 auto;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitPageComponent {
  private _simpleCounterService = inject(SimpleCounterService);
  simpleCounters$ = this._simpleCounterService.enabledSimpleCounters$;
  disabledSimpleCounters$ = this._simpleCounterService.simpleCounters$.pipe(
    map((counters) => counters.filter((c) => !c.isEnabled)),
  );
}
