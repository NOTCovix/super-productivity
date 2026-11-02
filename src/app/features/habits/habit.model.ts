export type HabitType = 'boolean' | 'increase' | 'limit';

export interface HabitRule {
  from: string;
  type: HabitType;
  unit: string;
  target: number | null;
  weekdays: number[];
  enabled: boolean;
}

export interface Habit {
  version: 1;
  kind: 'habit';
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  start: string;
  rules: HabitRule[];
}

export interface HabitEntry {
  version: 1;
  kind: 'entry';
  habitId: string;
  day: string;
  value: number | null;
  state: 'logged' | 'skipped' | 'unrecorded';
  // Freeze the meaning of a recorded value when targets/units change later.
  rule: HabitRule;
}

export type HabitStatus =
  | 'completed'
  | 'incomplete'
  | 'skipped'
  | 'unrecorded'
  | 'recorded'
  | 'unscheduled';

export interface HabitData {
  habits: Habit[];
  entries: Record<string, HabitEntry>;
  invalidRecords: number;
}

// Leading colon cannot be a plugin ID: manifest validation rejects colons.
// This host-only namespace cannot collide with sandbox plugin data.
export const HABIT_NAMESPACE = ':flux-habits-v1:';
export const habitKey = (id: string): string => `${HABIT_NAMESPACE}habit:${id}`;
export const entryKey = (id: string, day: string): string =>
  `${HABIT_NAMESPACE}entry:${id}:${day}`;
