import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { HabitRowComponent } from './habit-row.component';
import { GlobalConfigService } from '../config/global-config.service';
import { HabitService } from './habit.service';

@Component({
  selector: 'flux-habit-today',
  imports: [HabitRowComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (features().isHabitsEnabled && service.due().length) {
      <details class="task-list-wrapper">
        <summary>{{ T.MH.HABITS | translate }} ({{ service.due().length }})</summary>
        @for (habit of service.due(); track habit.id) {
          <flux-habit-row
            [habit]="habit"
            [day]="service.today()"
          />
        }
        <a routerLink="/habits">{{ T.F.HABITS.MANAGE | translate }}</a>
      </details>
    }
  `,
})
export class HabitTodayComponent {
  readonly features = inject(GlobalConfigService).appFeatures;
  readonly service = inject(HabitService);
  readonly T = T;
}
