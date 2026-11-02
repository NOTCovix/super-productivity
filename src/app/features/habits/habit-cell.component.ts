import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { entryKey, Habit } from './habit.model';
import { HabitService } from './habit.service';
import { habitRuleOn, habitStatus } from './habit.util';

/** A date cell in the existing weekly tracker; uses the same habit/day write path as Today. */
@Component({
  selector: 'flux-habit-cell',
  imports: [MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rule()?.type === 'boolean') {
      <button
        class="habit-circle focus-ring"
        [class.completed]="status() === 'completed'"
        [disabled]="!canLog()"
        (click)="toggle()"
        [attr.aria-pressed]="status() === 'completed'"
        [attr.aria-label]="label() + ' ' + (statusKey() | translate)"
        [title]="label() + ' ' + (statusKey() | translate)"
      >
        @if (status() === 'completed') {
          <mat-icon>check</mat-icon>
        }
        @if (status() === 'skipped') {
          <span>–</span>
        }
        @if (status() === 'incomplete') {
          <span>×</span>
        }
      </button>
    } @else {
      <input
        class="habit-circle focus-ring"
        type="number"
        min="0"
        step="any"
        inputmode="decimal"
        [class.completed]="status() === 'completed'"
        [class.incomplete]="status() === 'incomplete'"
        [disabled]="!canLog()"
        [value]="entry()?.state === 'logged' ? entry()?.value : ''"
        [placeholder]="status() === 'skipped' ? '–' : '·'"
        [attr.aria-label]="label() + ' ' + (rule()?.unit || '')"
        [title]="label() + ' ' + (statusKey() | translate)"
        (input)="record($event)"
      />
    }
  `,
  styleUrl: './habit-cell.component.scss',
})
export class HabitCellComponent {
  readonly habit = input.required<Habit>();
  readonly day = input.required<string>();
  private readonly _service = inject(HabitService);
  readonly entry = computed(
    () => this._service.data().entries[entryKey(this.habit().id, this.day())],
  );
  readonly rule = computed(() =>
    this.entry() && this.entry()!.state !== 'unrecorded'
      ? this.entry()!.rule
      : habitRuleOn(this.habit(), this.day()),
  );
  readonly status = computed(() => habitStatus(this.habit(), this.day(), this.entry()));
  readonly canLog = computed(() => {
    const rule = this.rule();
    return (
      !!rule?.enabled &&
      this.day() <= this._service.today() &&
      this.day() >= this.habit().start &&
      rule.weekdays.includes(new Date(`${this.day()}T12:00:00`).getDay())
    );
  });
  readonly label = computed(() => `${this.habit().name} ${this.day()}`);
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
    if (this.canLog())
      this._service.log(
        this.habit().id,
        this.day(),
        this.status() === 'completed' ? 0 : 1,
      );
  }
  record(event: Event): void {
    const control = event.target as HTMLInputElement;
    if (!this.canLog() || !control.validity.valid) return;
    this._service.log(
      this.habit().id,
      this.day(),
      control.value === '' ? null : control.valueAsNumber,
      control.value === '' ? 'unrecorded' : 'logged',
    );
  }
}
