import { entryKey, Habit, HabitEntry, HabitRule } from './habit.model';
import {
  habitRuleOn,
  habitStats,
  habitStatus,
  isHabitDay,
  readHabitData,
  shiftHabitDay,
} from './habit.util';

const rule: HabitRule = {
  from: '2026-10-26',
  type: 'increase',
  target: 20,
  unit: 'pages',
  weekdays: [1, 2, 3, 4, 5],
  enabled: true,
};
const habit: Habit = {
  version: 1,
  kind: 'habit',
  id: 'read',
  name: 'Read',
  description: '',
  icon: '',
  color: '',
  start: rule.from,
  rules: [rule],
};
const entry = (
  day: string,
  value: number | null,
  state: HabitEntry['state'] = 'logged',
  r = rule,
): HabitEntry => ({
  version: 1,
  kind: 'entry',
  habitId: habit.id,
  day,
  value,
  state,
  rule: r,
});

describe('Flux habit semantics', () => {
  it('distinguishes missing, zero, skipped, incomplete and completed values', () => {
    const limit = { ...rule, type: 'limit' as const, target: 2 };
    expect(habitStatus(habit, rule.from)).toBe('unrecorded');
    expect(habitStatus(habit, rule.from, entry(rule.from, 0, 'logged', limit))).toBe(
      'completed',
    );
    expect(habitStatus(habit, rule.from, entry(rule.from, 3, 'logged', limit))).toBe(
      'incomplete',
    );
    expect(habitStatus(habit, rule.from, entry(rule.from, 19))).toBe('incomplete');
    expect(habitStatus(habit, rule.from, entry(rule.from, 20))).toBe('completed');
    expect(habitStatus(habit, rule.from, entry(rule.from, null, 'skipped'))).toBe(
      'skipped',
    );
    expect(
      habitStatus(
        habit,
        rule.from,
        entry(rule.from, 0, 'logged', { ...rule, type: 'boolean' }),
      ),
    ).toBe('incomplete');
    expect(
      habitStatus(
        habit,
        rule.from,
        entry(rule.from, 1, 'logged', { ...rule, type: 'boolean' }),
      ),
    ).toBe('completed');
  });

  it('does not invent success or consistency without a target', () => {
    const h = { ...habit, rules: [{ ...rule, target: null }] };
    const records = {
      [entryKey(habit.id, rule.from)]: entry(rule.from, 2, 'logged', h.rules[0]),
    };
    expect(habitStatus(h, rule.from, records[entryKey(habit.id, rule.from)])).toBe(
      'recorded',
    );
    expect(habitStats(h, records, '2026-10-27').week.due).toBe(0);
    expect(habitStats(h, records, '2026-10-27').longest).toBe(0);
  });

  it('preserves weekday streaks over weekends and skips, but not missing elapsed days', () => {
    const records: Record<string, HabitEntry> = {};
    for (let day = '2026-10-26'; day <= '2026-10-30'; day = shiftHabitDay(day, 1))
      records[entryKey(habit.id, day)] = entry(day, 20);
    expect(habitStats(habit, records, '2026-11-01').current).toBe(5);
    expect(habitStats(habit, records, '2026-11-02').current).toBe(5);
    records[entryKey(habit.id, '2026-11-02')] = entry('2026-11-02', null, 'skipped');
    expect(habitStats(habit, records, '2026-11-03').current).toBe(5);
    expect(habitStats(habit, records, '2026-11-04').current).toBe(0);
    expect(habitStats(habit, records, '2026-11-04').longest).toBe(5);
  });

  it('counts missing historical days in the denominator and excludes pending today/skips', () => {
    const records = {
      [entryKey(habit.id, '2026-10-26')]: entry('2026-10-26', 20),
      [entryKey(habit.id, '2026-10-27')]: entry('2026-10-27', null, 'skipped'),
    };
    expect(habitStats(habit, records, '2026-10-29').week).toEqual({
      completed: 1,
      due: 2,
      skipped: 1,
      missing: 2,
    });
  });

  it('retains earlier schedules and recorded target interpretation after rule edits', () => {
    const changed = {
      ...habit,
      rules: [rule, { ...rule, from: '2026-10-28', target: 50, weekdays: [0, 6] }],
    };
    expect(habitRuleOn(changed, '2026-10-27')).toEqual(rule);
    expect(habitStatus(changed, '2026-10-28')).toBe('unscheduled');
    expect(habitStatus(changed, '2026-10-28', entry('2026-10-28', 20))).toBe('completed');
  });

  it('parses only valid owned records and preserves unsupported versions as an error', () => {
    const data = readHabitData([
      { id: 'other:record', data: 'broken' },
      { id: ':flux-habits-v1:habit:read', data: JSON.stringify(habit) },
      {
        id: ':flux-habits-v1:entry:read:2026-10-26',
        data: JSON.stringify(entry(rule.from, 0)),
      },
      { id: ':flux-habits-v1:bad', data: '{' },
    ]);
    expect(data.habits).toEqual([habit]);
    expect(data.invalidRecords).toBe(1);
    expect(Object.keys(data.entries).length).toBe(1);
  });

  it('uses calendar arithmetic over DST and validates dates', () => {
    expect(shiftHabitDay('2026-10-25', 1)).toBe('2026-10-26');
    expect(shiftHabitDay('2026-03-29', 1)).toBe('2026-03-30');
    expect(isHabitDay('2026-02-29')).toBeFalse();
    expect(isHabitDay('2024-02-29')).toBeTrue();
    expect(isHabitDay('bad')).toBeFalse();
  });
});
