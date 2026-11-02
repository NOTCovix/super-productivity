import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { entryKey, Habit } from './habit.model';
import { HabitService } from './habit.service';
import { habitRuleOn, habitStatus } from './habit.util';

@Component({
  selector: 'flux-habit-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, TranslatePipe],
  template: `
    <div
      class="habit-row"
      [attr.data-habit]="habit().id"
    >
      @if (habit().icon.startsWith(':')) {
        <mat-icon
          [svgIcon]="habit().icon"
          [style.color]="habit().color || null"
        />
      } @else {
        <mat-icon [style.color]="habit().color || null">{{
          habit().icon || 'check_circle'
        }}</mat-icon>
      }
      <span class="habit-name"
        >{{ habit().name }}
        @if (rule(); as r) {
          @if (r.type !== 'boolean') {
            <small
              >{{
                r.target === null ? '' : (r.type === 'limit' ? '≤ ' : '≥ ') + r.target
              }}
              {{ r.unit }}</small
            >
          }
        }
      </span>
      @if (rule()?.type === 'boolean') {
        <button
          mat-icon-button
          (click)="toggle()"
          [disabled]="!canLog()"
          [attr.aria-label]="habit().name"
          [attr.aria-pressed]="status() === 'completed'"
        >
          <mat-icon>{{
            status() === 'completed' ? 'check_circle' : 'radio_button_unchecked'
          }}</mat-icon>
        </button>
      } @else {
        <input
          class="habit-value"
          [disabled]="!canLog()"
          type="number"
          min="0"
          step="any"
          inputmode="decimal"
          [attr.aria-label]="habit().name + ' ' + (rule()?.unit || '')"
          [value]="entry()?.state === 'logged' ? entry()?.value : ''"
          (input)="record($event)"
        />
      }
      <span
        class="habit-status"
        [class.success]="status() === 'completed'"
        >{{ statusKey() | translate }}</span
      >
      <button
        mat-icon-button
        [matMenuTriggerFor]="menu"
        [disabled]="!canLog()"
        [attr.aria-label]="T.F.HABITS.ENTRY_ACTIONS | translate"
      >
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <button
          mat-menu-item
          (click)="service.log(habit().id, day(), null, 'skipped')"
        >
          {{ T.F.HABITS.SKIPPED | translate }}
        </button>
        <button
          mat-menu-item
          (click)="service.log(habit().id, day(), null, 'unrecorded')"
        >
          {{ T.F.HABITS.CLEAR | translate }}
        </button>
      </mat-menu>
    </div>
  `,
  styleUrl: './habit-row.component.scss',
})
export class HabitRowComponent {
  readonly habit = input.required<Habit>();
  readonly day = input.required<string>();
  readonly service = inject(HabitService);
  readonly T = T;
  readonly entry = computed(
    () => this.service.data().entries[entryKey(this.habit().id, this.day())],
  );
  readonly rule = computed(() =>
    this.entry() && this.entry()!.state !== 'unrecorded'
      ? this.entry()!.rule
      : habitRuleOn(this.habit(), this.day()),
  );
  readonly canLog = computed(() => {
    const rule = this.rule();
    return (
      !!rule?.enabled &&
      this.day() >= this.habit().start &&
      rule.weekdays.includes(new Date(`${this.day()}T12:00:00`).getDay())
    );
  });
  readonly status = computed(() => habitStatus(this.habit(), this.day(), this.entry()));
  readonly statusKey = computed(
    () =>
      ({
        completed: T.F.HABITS.COMPLETED,
        incomplete: T.F.HABITS.INCOMPLETE,
        skipped: T.F.HABITS.SKIPPED,
        unrecorded: T.F.HABITS.UNRECORDED,
        recorded: T.F.HABITS.RECORDED,
        unscheduled: T.F.HABITS.UNSCHEDULED,
      })[this.status()],
  );

  toggle(): void {
    this.service.log(this.habit().id, this.day(), this.status() === 'completed' ? 0 : 1);
  }

  record(event: Event): void {
    const control = event.target as HTMLInputElement;
    if (!control.validity.valid) return;
    if (control.value === '')
      this.service.log(this.habit().id, this.day(), null, 'unrecorded');
    else this.service.log(this.habit().id, this.day(), control.valueAsNumber);
  }
}
