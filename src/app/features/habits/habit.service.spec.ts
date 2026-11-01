import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStore, Store } from '@ngrx/store';
import { DateService } from '../../core/date/date.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import {
  pluginUserDataReducer,
  selectPluginUserDataFeatureState,
} from '../../plugins/store/plugin-user-data.reducer';
import { upsertPluginUserData } from '../../plugins/store/plugin.actions';
import { loadAllData } from '../../root-store/meta/load-all-data.action';
import { AppDataComplete } from '../../op-log/model/model-config';
import { HabitService } from './habit.service';
import { entryKey } from './habit.model';
import { habitRuleOn } from './habit.util';

describe('HabitService using the real extension-data reducer', () => {
  let service: HabitService;
  let store: Store;
  const today = signal('2026-11-01');
  beforeEach(() => {
    today.set('2026-11-01');
    TestBed.configureTestingModule({
      providers: [
        provideStore({ pluginUserData: pluginUserDataReducer }),
        { provide: DateService, useValue: { todayStr: () => today() } },
        { provide: GlobalTrackingIntervalService, useValue: { todayDateStr: today } },
      ],
    });
    store = TestBed.inject(Store);
    service = TestBed.inject(HabitService);
  });
  const create = (): void =>
    service.save({
      name: 'Read',
      description: '',
      icon: '',
      color: '',
      start: '2026-10-30',
      rule: {
        from: '2026-10-30',
        type: 'boolean',
        target: null,
        unit: '',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
      },
    });

  it('creates, edits without duplicating, archives, restores and deletes with history', () => {
    create();
    const habit = service.data().habits[0];
    expect(service.due().length).toBe(1);
    service.save({ ...habit, name: 'Read more', rule: habit.rules[0] });
    expect(service.data().habits.length).toBe(1);
    expect(service.data().habits[0].name).toBe('Read more');
    service.archive(habit, false);
    expect(service.due()).toEqual([]);
    expect(habitRuleOn(service.data().habits[0], '2026-10-31')?.enabled).toBeTrue();
    service.archive(habit, true);
    service.log(habit.id, '2026-11-01', 1);
    expect(Object.keys(service.data().entries).length).toBe(1);
    service.delete(habit);
    expect(service.data().habits).toEqual([]);
    expect(service.data().entries).toEqual({});
    service.log(habit.id, '2026-11-01', 1);
    expect(service.data().habits).toEqual([]);
  });

  it('persists each date independently; clears do not turn missing values into zero', () => {
    create();
    const id = service.data().habits[0].id;
    service.log(id, '2026-10-30', 1);
    service.log(id, '2026-10-31', 0);
    service.log(id, '2026-10-30', null, 'skipped');
    expect(Object.keys(service.data().entries).length).toBe(2);
    expect(service.data().entries[entryKey(id, '2026-10-31')].value).toBe(0);
    service.log(id, '2026-10-31', null, 'unrecorded');
    expect(service.data().entries[entryKey(id, '2026-10-31')].state).toBe('unrecorded');
    service.log(id, '2026-11-02', 1);
    service.log(id, '2026-10-29', 1);
    expect(Object.keys(service.data().entries).length).toBe(2);
  });

  it('round trips through the existing full-state import reducer with JSON serialization', () => {
    create();
    const id = service.data().habits[0].id;
    service.log(id, '2026-11-01', 1);
    let rows: unknown;
    const sub = store
      .select(selectPluginUserDataFeatureState)
      .subscribe((value) => (rows = value));
    const exported = JSON.parse(
      JSON.stringify({ pluginUserData: rows }),
    ) as AppDataComplete;
    service.delete(service.data().habits[0]);
    store.dispatch(loadAllData({ appDataComplete: exported }));
    expect(service.data().habits.length).toBe(1);
    expect(service.data().entries[entryKey(id, '2026-11-01')].value).toBe(1);
    sub.unsubscribe();
  });

  it('does not overwrite unrelated plugin data', () => {
    store.dispatch(
      upsertPluginUserData({
        pluginUserData: { id: 'other-plugin:document', data: 'hello' },
      }),
    );
    create();
    service.delete(service.data().habits[0]);
    let rows: unknown;
    const sub = store
      .select(selectPluginUserDataFeatureState)
      .subscribe((value) => (rows = value));
    expect(rows).toContain({ id: 'other-plugin:document', data: 'hello' });
    sub.unsubscribe();
  });
});
