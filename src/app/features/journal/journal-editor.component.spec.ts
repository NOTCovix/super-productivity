import { signal } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideStore, Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DateService } from '../../core/date/date.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { metricReducer } from '../metric/store/metric.reducer';
import { upsertMetric } from '../metric/store/metric.actions';
import { JournalService } from './journal.service';
import { JournalEditorComponent } from './journal-editor.component';

describe('JournalEditorComponent', () => {
  let fixture: ComponentFixture<JournalEditorComponent>;
  let editor: JournalEditorComponent;
  let service: JournalService;
  let store: Store;
  const today = signal('2026-11-02');
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [JournalEditorComponent, TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [
        provideStore({ metric: metricReducer }),
        { provide: DateService, useValue: { todayStr: () => today() } },
        { provide: GlobalTrackingIntervalService, useValue: { todayDateStr: today } },
      ],
    });
    service = TestBed.inject(JournalService);
    store = TestBed.inject(Store);
    fixture = TestBed.createComponent(JournalEditorComponent);
    fixture.componentRef.setInput('day', '2026-11-01');
    editor = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('debounces an editing burst into one write and preserves whitespace', fakeAsync(() => {
    const write = spyOn(service, 'write').and.callThrough();
    editor.change('A');
    tick(250);
    editor.change('A day  ');
    tick(499);
    expect(write).not.toHaveBeenCalled();
    tick(1);
    fixture.detectChanges();
    expect(write).toHaveBeenCalledOnceWith('2026-11-01', 'A day  ');
    expect(editor.draft()).toBe('A day  ');
  }));
  it('flushes the captured old date when switching before debounce', fakeAsync(() => {
    editor.change('Yesterday unfinished');
    fixture.componentRef.setInput('day', '2026-11-02');
    fixture.detectChanges();
    tick(500);
    expect(service.text('2026-11-01')).toBe('Yesterday unfinished');
    expect(service.text('2026-11-02')).toBe('');
    expect(editor.draft()).toBe('');
  }));
  it('flushes on component destruction without waiting for debounce', fakeAsync(() => {
    editor.change('Keep this when navigating away');
    fixture.destroy();
    tick(500);
    expect(service.text('2026-11-01')).toBe('Keep this when navigating away');
  }));
  it('flushes blur immediately and does not write twice after the timer', fakeAsync(() => {
    const write = spyOn(service, 'write').and.callThrough();
    editor.change('Entry');
    editor.flush();
    tick(500);
    expect(write).toHaveBeenCalledOnceWith('2026-11-01', 'Entry');
  }));
  it('follows stored changes when not editing but preserves an active local draft', fakeAsync(() => {
    store.dispatch(
      upsertMetric({
        metric: { id: '2026-11-01', reflections: [{ text: 'Remote entry', created: 1 }] },
      }),
    );
    fixture.detectChanges();
    expect(editor.draft()).toBe('Remote entry');
    editor.change('Local draft');
    store.dispatch(
      upsertMetric({
        metric: {
          id: '2026-11-01',
          reflections: [{ text: 'Another remote edit', created: 1 }],
        },
      }),
    );
    fixture.detectChanges();
    expect(editor.draft()).toBe('Local draft');
    tick(500);
    fixture.detectChanges();
    expect(service.text('2026-11-01')).toBe('Local draft');
  }));
});
