import { getDbDateStr } from '../../util/get-db-date-str';
import {
  entryKey,
  Habit,
  HabitData,
  HabitEntry,
  habitKey,
  HabitRule,
  HabitStatus,
  HABIT_NAMESPACE,
} from './habit.model';

export const isHabitDay = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && getDbDateStr(date) === value;
};

export const shiftHabitDay = (day: string, amount: number): string => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return getDbDateStr(date);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const isHabitRule = (value: unknown): value is HabitRule => {
  if (!isObject(value)) return false;
  return (
    isHabitDay(value['from']) &&
    ['boolean', 'increase', 'limit'].includes(value['type'] as string) &&
    typeof value['unit'] === 'string' &&
    value['unit'].length <= 40 &&
    (value['target'] === null ||
      (typeof value['target'] === 'number' &&
        Number.isFinite(value['target']) &&
        value['target'] >= 0 &&
        (value['type'] !== 'increase' || value['target'] > 0))) &&
    typeof value['enabled'] === 'boolean' &&
    Array.isArray(value['weekdays']) &&
    value['weekdays'].length > 0 &&
    value['weekdays'].length <= 7 &&
    new Set(value['weekdays']).size === value['weekdays'].length &&
    value['weekdays'].every(
      (n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 6,
    )
  );
};

export const isHabit = (value: unknown): value is Habit => {
  if (!isObject(value)) return false;
  return (
    value['version'] === 1 &&
    value['kind'] === 'habit' &&
    typeof value['id'] === 'string' &&
    /^[\w-]{1,80}$/.test(value['id']) &&
    typeof value['name'] === 'string' &&
    !!value['name'].trim() &&
    value['name'].length <= 120 &&
    typeof value['description'] === 'string' &&
    value['description'].length <= 2000 &&
    typeof value['icon'] === 'string' &&
    value['icon'].length <= 40 &&
    typeof value['color'] === 'string' &&
    (value['color'] === '' || /^#[\da-f]{6}$/i.test(value['color'])) &&
    isHabitDay(value['start']) &&
    Array.isArray(value['rules']) &&
    value['rules'].length > 0 &&
    value['rules'].every(isHabitRule) &&
    value['rules'][0].from === value['start'] &&
    value['rules'].every(
      (rule: HabitRule, i: number, rules: HabitRule[]) =>
        i === 0 || rule.from > rules[i - 1].from,
    )
  );
};

const isEntry = (value: unknown): value is HabitEntry => {
  if (!isObject(value)) return false;
  return (
    value['version'] === 1 &&
    value['kind'] === 'entry' &&
    typeof value['habitId'] === 'string' &&
    isHabitDay(value['day']) &&
    ['logged', 'skipped', 'unrecorded'].includes(value['state'] as string) &&
    isHabitRule(value['rule']) &&
    (value['state'] === 'logged'
      ? typeof value['value'] === 'number' &&
        Number.isFinite(value['value']) &&
        value['value'] >= 0 &&
        (value['rule'].type !== 'boolean' || value['value'] === 0 || value['value'] === 1)
      : value['value'] === null)
  );
};

/** Plain JSON is an existing, supported extension-store format. No async save queue. */
export const readHabitData = (
  rows: readonly { id: string; data: string }[],
): HabitData => {
  const result: HabitData = { habits: [], entries: {}, invalidRecords: 0 };
  for (const row of rows) {
    if (!row.id.startsWith(HABIT_NAMESPACE)) continue;
    try {
      const value: unknown = JSON.parse(row.data);
      if (isHabit(value) && row.id === habitKey(value.id)) result.habits.push(value);
      else if (isEntry(value) && row.id === entryKey(value.habitId, value.day))
        result.entries[row.id] = value;
      else if (
        !(isObject(value) && value['version'] === 1 && value['kind'] === 'deleted')
      )
        result.invalidRecords++;
    } catch {
      result.invalidRecords++;
    }
  }
  result.habits.sort((a, b) => a.name.localeCompare(b.name));
  return result;
};

export const habitRuleOn = (habit: Habit, day: string): HabitRule | undefined =>
  habit.rules.filter((rule) => rule.from <= day).at(-1);

export const habitScheduled = (habit: Habit, day: string): boolean => {
  const rule = habitRuleOn(habit, day);
  return (
    !!rule?.enabled &&
    day >= habit.start &&
    rule.weekdays.includes(new Date(`${day}T12:00:00`).getDay())
  );
};

export const habitStatus = (
  habit: Habit,
  day: string,
  entry?: HabitEntry,
): HabitStatus => {
  if (entry && entry.state !== 'unrecorded') {
    if (entry.state === 'skipped') return 'skipped';
    const { type, target } = entry.rule;
    if (type === 'boolean') return entry.value === 1 ? 'completed' : 'incomplete';
    if (target === null) return 'recorded';
    return (type === 'limit' ? entry.value! <= target : entry.value! >= target)
      ? 'completed'
      : 'incomplete';
  }
  return habitScheduled(habit, day) ? 'unrecorded' : 'unscheduled';
};

export interface HabitPeriod {
  completed: number;
  due: number;
  missing: number;
  skipped: number;
}
export interface HabitStats {
  current: number;
  longest: number;
  week: HabitPeriod;
  month: HabitPeriod;
}

export const habitStats = (
  habit: Habit,
  entries: Record<string, HabitEntry>,
  today: string,
): HabitStats => {
  let longest = 0;
  let current = 0;
  let run = 0;
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = shiftHabitDay(
    today,
    -((new Date(`${today}T12:00:00`).getDay() + 6) % 7),
  );
  const week = { completed: 0, due: 0, missing: 0, skipped: 0 };
  const month = { completed: 0, due: 0, missing: 0, skipped: 0 };
  for (let day = habit.start; day <= today; day = shiftHabitDay(day, 1)) {
    const entry = entries[entryKey(habit.id, day)];
    const status = habitStatus(habit, day, entry);
    if (status === 'completed') run++;
    else if (status !== 'unscheduled' && status !== 'skipped' && day !== today) run = 0;
    // An unfinished current day is still in progress; yesterday's streak survives.
    longest = Math.max(longest, run);
    current = run;
    for (const [start, period] of [
      [weekStart, week],
      [monthStart, month],
    ] as const) {
      if (day < start || status === 'unscheduled') continue;
      if (status === 'skipped') {
        period.skipped++;
        continue;
      }
      if (status === 'unrecorded') period.missing++;
      const rule = entry?.state === 'logged' ? entry.rule : habitRuleOn(habit, day);
      if (rule?.type !== 'boolean' && rule?.target === null) continue;
      if (day === today && status === 'unrecorded') continue;
      period.due++;
      if (status === 'completed') period.completed++;
    }
  }
  return { current, longest, week, month };
};
