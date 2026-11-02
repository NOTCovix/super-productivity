import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CollapsibleComponent } from '../../ui/collapsible/collapsible.component';
import { T } from '../../t.const';
import { HabitRowComponent } from './habit-row.component';
import { GlobalConfigService } from '../config/global-config.service';
import { HabitService } from './habit.service';

@Component({
  selector: 'flux-habit-today',
  imports: [
    HabitRowComponent,
    RouterLink,
    TranslatePipe,
    CollapsibleComponent,
    MatButtonModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      padding-top: var(--s3);
    }
  `,
  template: `
    @if (features().isHabitsEnabled && service.due().length) {
      <collapsible
        class="task-section"
        [isIconBefore]="true"
        [isExpanded]="true"
        [title]="(T.MH.HABITS | translate) + ' (' + service.due().length + ')'"
      >
        <a
          actions
          mat-icon-button
          routerLink="/habits"
          (click)="$event.stopPropagation()"
          [attr.aria-label]="T.F.HABITS.MANAGE | translate"
          ><mat-icon>tune</mat-icon></a
        >
        @for (habit of service.due(); track habit.id) {
          <flux-habit-row
            [habit]="habit"
            [day]="service.today()"
          />
        }
      </collapsible>
    }
  `,
})
export class HabitTodayComponent {
  readonly features = inject(GlobalConfigService).appFeatures;
  readonly service = inject(HabitService);
  readonly T = T;
}
