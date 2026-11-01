import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { nanoid } from 'nanoid';
import { DateService } from '../../core/date/date.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { MAX_PLUGIN_DATA_SIZE } from '../../plugins/plugin-persistence.model';
import { selectPluginUserDataFeatureState } from '../../plugins/store/plugin-user-data.reducer';
import {
  deletePluginUserData,
  upsertPluginUserData,
} from '../../plugins/store/plugin.actions';
import { entryKey, Habit, HabitEntry, habitKey, HabitRule } from './habit.model';
import {
  habitRuleOn,
  habitScheduled,
  isHabit,
  isHabitDay,
  readHabitData,
} from './habit.util';

@Injectable({ providedIn: 'root' })
export class HabitService {
  private readonly _store = inject(Store);
  private readonly _date = inject(DateService);
  private readonly _interval = inject(GlobalTrackingIntervalService);
  private readonly _rows = toSignal(
    this._store.select(selectPluginUserDataFeatureState),
    { initialValue: [] },
  );
  readonly data = computed(() => readHabitData(this._rows()));
  readonly today = computed(() => {
    this._interval.todayDateStr();
    return this._date.todayStr();
  });
  readonly active = computed(() =>
    this.data().habits.filter((habit) => habitRuleOn(habit, this.today())?.enabled),
  );
  readonly due = computed(() =>
    this.active().filter((habit) => habitScheduled(habit, this.today())),
  );

  save(
    draft: Omit<Habit, 'id' | 'version' | 'kind' | 'rules'> & {
      id?: string;
      rule: HabitRule;
    },
  ): void {
    const existing = this.data().habits.find((habit) => habit.id === draft.id);
    if (draft.id && !existing) throw new Error('Habit was deleted');
    const from = existing ? this.today() : draft.start;
    const rule = { ...draft.rule, from };
    const habit: Habit = {
      version: 1,
      kind: 'habit',
      id: existing?.id ?? nanoid(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      icon: draft.icon.trim(),
      color: draft.color,
      start: existing?.start ?? draft.start,
      rules: existing ? [...existing.rules.filter((r) => r.from < from), rule] : [rule],
    };
    if (!isHabit(habit) || habit.start > this.today() || habit.start < '2000-01-01')
      throw new Error('Invalid habit');
    this._write(habitKey(habit.id), habit);
  }

  archive(habit: Habit, enabled: boolean): void {
    const latest = this.data().habits.find((h) => h.id === habit.id);
    if (!latest) return;
    const rule = habitRuleOn(latest, this.today())!;
    this.save({ ...latest, rule: { ...rule, enabled } });
  }

  log(
    habitId: string,
    day: string,
    value: number | null,
    state: HabitEntry['state'] = 'logged',
  ): void {
    const habit = this.data().habits.find((h) => h.id === habitId);
    if (!habit || !isHabitDay(day) || day < habit.start || day > this.today()) return;
    const previous = this.data().entries[entryKey(habitId, day)];
    const rule =
      previous && previous.state !== 'unrecorded'
        ? previous.rule
        : habitRuleOn(habit, day);
    if (!habitScheduled(habit, day) && (!previous || previous.state === 'unrecorded'))
      return;
    if (!rule) return;
    if (
      state === 'logged' &&
      (value === null ||
        !Number.isFinite(value) ||
        value < 0 ||
        (rule.type === 'boolean' && value !== 0 && value !== 1))
    )
      return;
    this._write(entryKey(habitId, day), {
      version: 1,
      kind: 'entry',
      habitId,
      day,
      state,
      value: state === 'logged' ? value : null,
      rule,
    } satisfies HabitEntry);
  }

  delete(habit: Habit): void {
    // Tombstone the definition first. A late log cannot recreate a deleted habit.
    this._write(habitKey(habit.id), { version: 1, kind: 'deleted' });
    for (const entry of Object.values(this.data().entries)) {
      if (entry.habitId === habit.id)
        this._store.dispatch(
          deletePluginUserData({ pluginId: entryKey(habit.id, entry.day) }),
        );
    }
  }

  private _write(id: string, value: unknown): void {
    const data = JSON.stringify(value);
    if (new Blob([data]).size > MAX_PLUGIN_DATA_SIZE)
      throw new Error('Habit storage limit reached');
    // First-party host writes synchronously through the existing persistent action.
    // Do not use the sandbox plugin API's one-second coalescing buffer for logging.
    this._store.dispatch(upsertPluginUserData({ pluginUserData: { id, data } }));
  }
}
