import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  input,
  afterNextRender,
  ElementRef,
  Injector,
  viewChild,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { HabitTrackerComponent } from '../simple-counter/habit-tracker/habit-tracker.component';
import { SimpleCounter } from '../simple-counter/simple-counter.model';
import { HabitCellComponent } from './habit-cell.component';
import { FormsModule, ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { FormlyModule, FormlyFieldConfig } from '@ngx-formly/core';
import { InputColorPickerComponent } from '../../ui/input-color-picker/input-color-picker.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { DialogConfirmComponent } from '../../ui/dialog-confirm/dialog-confirm.component';
import { entryKey, Habit, HabitRule, HabitType } from './habit.model';
import { HabitService } from './habit.service';
import {
  habitRuleOn,
  habitStats,
  habitStatus,
  isHabitDay,
  shiftHabitDay,
} from './habit.util';
import { HabitRowComponent } from './habit-row.component';

@Component({
  selector: 'flux-habit-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    HabitTrackerComponent,
    HabitCellComponent,
    FormsModule,
    ReactiveFormsModule,
    FormlyModule,
    InputColorPickerComponent,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
    HabitRowComponent,
  ],
  templateUrl: './habit-manager.component.html',
  styleUrl: './habit-manager.component.scss',
})
export class HabitManagerComponent {
  readonly simpleCounters = input<SimpleCounter[]>([]);
  readonly disabledSimpleCounters = input<SimpleCounter[]>([]);
  readonly service = inject(HabitService);
  private readonly _dialog = inject(MatDialog);
  private readonly _injector = inject(Injector);
  readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('habitName');
  readonly T = T;
  readonly iconForm = new UntypedFormGroup({});
  readonly iconFields: FormlyFieldConfig[] = [
    { key: 'icon', type: 'icon', props: { label: T.F.SIMPLE_COUNTER.FORM.L_ICON } },
  ];
  readonly editing = signal(false);
  readonly error = signal(false);
  readonly selectedDay = signal('');
  readonly day = computed(() => this.selectedDay() || this.service.today());
  readonly monthOffset = signal(0);
  readonly month = computed(() => {
    const date = new Date(`${this.service.today().slice(0, 7)}-01T12:00:00`);
    date.setMonth(date.getMonth() + this.monthOffset());
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  readonly leadingDays = computed(() =>
    Array.from(
      { length: (new Date(`${this.month()}-01T12:00:00`).getDay() + 6) % 7 },
      (_, i) => i,
    ),
  );
  readonly days = computed(() => {
    const days: string[] = [];
    for (
      let day = `${this.month()}-01`;
      day.startsWith(this.month()) && day <= this.service.today();
      day = shiftHabitDay(day, 1)
    )
      days.push(day);
    return days;
  });
  readonly rows = computed(() =>
    this.service.data().habits.map((habit) => ({
      habit,
      enabled: !!habitRuleOn(habit, this.service.today())?.enabled,
      stats: habitStats(habit, this.service.data().entries, this.service.today()),
      days: this.days().map((day) => ({
        day,
        status: habitStatus(
          habit,
          day,
          this.service.data().entries[entryKey(habit.id, day)],
        ),
      })),
    })),
  );
  readonly statusKeys = {
    completed: T.F.HABITS.COMPLETED,
    incomplete: T.F.HABITS.INCOMPLETE,
    skipped: T.F.HABITS.SKIPPED,
    unrecorded: T.F.HABITS.UNRECORDED,
    recorded: T.F.HABITS.RECORDED,
    unscheduled: T.F.HABITS.UNSCHEDULED,
  };
  readonly weekdays = [
    T.F.TASK_REPEAT.F.SUNDAY,
    T.F.TASK_REPEAT.F.MONDAY,
    T.F.TASK_REPEAT.F.TUESDAY,
    T.F.TASK_REPEAT.F.WEDNESDAY,
    T.F.TASK_REPEAT.F.THURSDAY,
    T.F.TASK_REPEAT.F.FRIDAY,
    T.F.TASK_REPEAT.F.SATURDAY,
  ];
  model = this._empty();

  private _empty(): {
    id?: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    start: string;
    rule: HabitRule;
  } {
    return {
      name: '',
      description: '',
      icon: 'check_circle',
      color: '',
      start: this.service.today(),
      rule: {
        from: this.service.today(),
        type: 'boolean',
        unit: '',
        target: null,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
      },
    };
  }

  edit(habit?: Habit): void {
    this.error.set(false);
    this.model = habit
      ? {
          ...habit,
          rule: {
            ...habitRuleOn(habit, this.service.today())!,
            weekdays: [...habitRuleOn(habit, this.service.today())!.weekdays],
          },
        }
      : this._empty();
    this.editing.set(true);
    afterNextRender(() => this.nameInput()?.nativeElement.focus(), {
      injector: this._injector,
    });
  }

  changeType(type: HabitType): void {
    this.model.rule.type = type;
    this.model.rule.target = null;
  }

  toggleWeekday(day: number): void {
    const days = this.model.rule.weekdays;
    this.model.rule.weekdays = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day].sort();
  }

  save(): void {
    try {
      this.service.save(this.model);
      this.editing.set(false);
      this.error.set(false);
    } catch {
      this.error.set(true);
    }
  }

  selectDay(day: string): void {
    if (isHabitDay(day) && day <= this.service.today() && day >= '2000-01-01')
      this.selectedDay.set(day);
  }

  percent(period: { completed: number; due: number }): string {
    return period.due
      ? `${Math.round((period.completed / period.due) * 100)}% (${period.completed}/${period.due})`
      : '—';
  }

  delete(habit: Habit): void {
    this._dialog
      .open(DialogConfirmComponent, {
        restoreFocus: true,
        data: { message: T.F.HABITS.DELETE_CONFIRM, okTxt: T.G.DELETE },
      })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (confirmed) this.service.delete(habit);
      });
  }
}
