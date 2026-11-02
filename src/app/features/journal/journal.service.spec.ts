import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStore, Store } from '@ngrx/store';
import { DateService } from '../../core/date/date.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { metricReducer } from '../metric/store/metric.reducer';
import { upsertMetric, updateMetric } from '../metric/store/metric.actions';
import { selectMetricFeatureState } from '../metric/store/metric.selectors';
import { JournalService } from './journal.service';

describe('JournalService', () => {
  let service: JournalService;
  let store: Store;
  const today = signal('2026-11-02');
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideStore({ metric: metricReducer }),
        { provide: DateService, useValue: { todayStr: () => today() } },
        { provide: GlobalTrackingIntervalService, useValue: { todayDateStr: today } },
      ],
    });
    service = TestBed.inject(JournalService);
    store = TestBed.inject(Store);
  });
  it('writes one existing field-patch action and keeps other metric fields', () => {
    store.dispatch(
      upsertMetric({
        metric: {
          id: today(),
          reflections: [],
          focusSessions: [60000],
          energyCheckin: 3,
          impactOfWork: 4,
        },
      }),
    );
    const dispatch = spyOn(store, 'dispatch').and.callThrough();
    service.write(today(), 'A meaningful day');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: updateMetric.type,
        meta: jasmine.objectContaining({ entityId: today() }),
        metric: {
          id: today(),
          changes: {
            reflections: [jasmine.objectContaining({ text: 'A meaningful day' })],
          },
        },
      }),
    );
    let metric;
    store
      .select(selectMetricFeatureState)
      .subscribe((state) => (metric = state.entities[today()]))
      .unsubscribe();
    expect(metric).toEqual(
      jasmine.objectContaining({
        focusSessions: [60000],
        energyCheckin: 3,
        impactOfWork: 4,
      }),
    );
  });
  it('preserves entry creation time across edits and reads existing reflections', () => {
    store.dispatch(
      upsertMetric({
        metric: { id: today(), reflections: [{ text: 'Old review', created: 42 }] },
      }),
    );
    expect(service.text(today())).toBe('Old review');
    service.write(today(), 'Updated journal');
    let created;
    store
      .select(selectMetricFeatureState)
      .subscribe(
        (state) => (created = state.entities[today()]?.reflections?.[0]?.created),
      )
      .unsubscribe();
    expect(created).toBe(42);
  });
  it('clears the reflection without deleting ratings or focus history', () => {
    store.dispatch(
      upsertMetric({
        metric: {
          id: today(),
          reflections: [{ text: 'Note', created: 42 }],
          focusSessions: [1000],
          energyCheckin: 2,
        },
      }),
    );
    service.write(today(), '');
    expect(service.entries()).toEqual([]);
    let metric;
    store
      .select(selectMetricFeatureState)
      .subscribe((state) => (metric = state.entities[today()]))
      .unsubscribe();
    expect(metric).toEqual(
      jasmine.objectContaining({
        reflections: [],
        focusSessions: [1000],
        energyCheckin: 2,
      }),
    );
  });
  it('does not record unchanged input or create empty metrics', () => {
    const dispatch = spyOn(store, 'dispatch').and.callThrough();
    service.write(today(), '');
    expect(dispatch).not.toHaveBeenCalled();
    service.write(today(), 'Entry');
    service.write(today(), 'Entry');
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it('keeps separate dates and sorts history by entry day rather than edit time', () => {
    service.write('2026-11-02', 'Today');
    service.write('2026-11-01', 'Yesterday');
    service.write('2026-11-01', 'Yesterday edited later');
    expect(service.entries().map((entry) => entry.day)).toEqual([
      '2026-11-02',
      '2026-11-01',
    ]);
    expect(service.text('2026-11-02')).toBe('Today');
  });
  it('rejects malformed, impossible and future dates', () => {
    for (const day of ['bad', '2026-02-30', '2026-11-03'])
      expect(() => service.write(day, 'Entry')).toThrow();
    expect(service.entries()).toEqual([]);
  });
  it('preserves multiline Unicode and typing whitespace exactly', () => {
    const text = 'Morning 🌤\nGrateful for friends.  ';
    service.write(today(), text);
    expect(service.text(today())).toBe(text);
  });
});
