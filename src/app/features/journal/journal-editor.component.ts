import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnChanges,
  OnDestroy,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, debounceTime } from 'rxjs';
import { T } from '../../t.const';
import { JournalService } from './journal.service';

@Component({
  selector: 'flux-journal-editor',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    CdkTextareaAutosize,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ T.F.JOURNAL.ENTRY | translate }}</mat-label>
      <textarea
        matInput
        cdkTextareaAutosize
        [cdkAutosizeMinRows]="compact() ? 3 : 10"
        [ngModel]="draft()"
        (ngModelChange)="change($event)"
        (blur)="flush()"
        [disabled]="!editable()"
        [attr.aria-label]="(T.F.JOURNAL.ENTRY | translate) + ' ' + day()"
      ></textarea>
      <mat-hint>{{ T.F.JOURNAL.AUTOSAVE | translate }}</mat-hint>
    </mat-form-field>
  `,
  styles: `
    :host {
      display: block;
    }
    mat-form-field {
      width: 100%;
    }
  `,
})
export class JournalEditorComponent implements OnChanges, OnDestroy {
  readonly day = input.required<string>();
  readonly compact = input(false);
  readonly journal = inject(JournalService);
  readonly T = T;
  readonly draft = signal('');
  readonly editable = computed(() => this.journal.isEditableDay(this.day()));
  private readonly _pending = signal<{ day: string; text: string } | null>(null);
  private readonly _changes = new Subject<void>();
  constructor() {
    this._changes
      .pipe(debounceTime(500), takeUntilDestroyed())
      .subscribe(() => this.flush());
    effect(() => {
      const text = this.journal.text(this.day());
      if (!this._pending()) this.draft.set(text);
    });
  }
  ngOnChanges(): void {
    this.flush();
    this.draft.set(this.journal.text(this.day()));
  }
  change(text: string): void {
    if (!this.editable()) return;
    this.draft.set(text);
    this._pending.set({ day: this.day(), text });
    this._changes.next();
  }
  flush(): void {
    const pending = this._pending();
    if (!pending) return;
    this._pending.set(null);
    this.journal.write(pending.day, pending.text);
  }
  ngOnDestroy(): void {
    this.flush();
  }
}
