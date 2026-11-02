import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { DateService } from '../../core/date/date.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { getDbDateStr } from '../../util/get-db-date-str';
import { initialMetricState } from '../metric/store/metric.reducer';
import { selectMetricFeatureState } from '../metric/store/metric.selectors';
import { updateMetric } from '../metric/store/metric.actions';

@Injectable({ providedIn: 'root' })
export class JournalService {
  private readonly _store = inject(Store);
  private readonly _date = inject(DateService);
  private readonly _interval = inject(GlobalTrackingIntervalService);
  private readonly _metrics = toSignal(this._store.select(selectMetricFeatureState), {
    initialValue: initialMetricState,
  });
  readonly today = computed(() => {
    this._interval.todayDateStr();
    return this._date.todayStr();
  });
  readonly entries = computed(() =>
    Object.values(this._metrics().entities)
      .filter((metric) => !!metric?.reflections?.[0]?.text.trim())
      .map((metric) => ({ day: metric!.id, text: metric!.reflections![0].text }))
      .sort((a, b) => b.day.localeCompare(a.day)),
  );

  isEditableDay(day: string): boolean {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(day) &&
      getDbDateStr(new Date(`${day}T12:00:00`)) === day &&
      day <= this.today()
    );
  }
  text(day: string): string {
    return this._metrics().entities[day]?.reflections?.[0]?.text ?? '';
  }
  write(day: string, text: string): void {
    if (!this.isEditableDay(day)) throw new Error('Invalid journal date');
    if (this.text(day) === text) return;
    const existing = this._metrics().entities[day]?.reflections?.[0];
    this._store.dispatch(
      updateMetric({
        metric: {
          id: day,
          changes: {
            reflections: text.length
              ? [{ text, created: existing?.created ?? Date.now() }]
              : [],
          },
        },
      }),
    );
  }
}
