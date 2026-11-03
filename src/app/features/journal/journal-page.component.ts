import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { DialogConfirmComponent } from '../../ui/dialog-confirm/dialog-confirm.component';
import { getDbDateStr } from '../../util/get-db-date-str';
import { JournalEditorComponent } from './journal-editor.component';
import { JournalService } from './journal.service';

@Component({
  selector: 'flux-journal-page',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
    JournalEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="journal-page"
      [attr.aria-label]="T.F.JOURNAL.TITLE | translate"
    >
      <div class="day-navigation">
        <button
          mat-icon-button
          (click)="move(-1)"
          [attr.aria-label]="T.F.JOURNAL.PREVIOUS | translate"
        >
          <mat-icon>chevron_left</mat-icon>
        </button>
        <mat-form-field
          ><mat-label>{{ T.F.JOURNAL.DATE | translate }}</mat-label>
          <input
            matInput
            type="date"
            [max]="journal.today()"
            [ngModel]="day()"
            (ngModelChange)="select($event)"
          />
        </mat-form-field>
        <button
          mat-icon-button
          (click)="move(1)"
          [disabled]="day() >= journal.today()"
          [attr.aria-label]="T.F.JOURNAL.NEXT | translate"
        >
          <mat-icon>chevron_right</mat-icon>
        </button>
        <button
          mat-button
          (click)="selectedDay.set('')"
        >
          {{ T.F.JOURNAL.TODAY | translate }}
        </button>
      </div>
      <flux-journal-editor [day]="day()" />
      <div class="entry-actions">
        <p>{{ T.F.JOURNAL.SHARED | translate }}</p>
        <button
          mat-button
          color="warn"
          [disabled]="!journal.text(day())"
          (click)="clear()"
        >
          {{ T.F.JOURNAL.CLEAR | translate }}
        </button>
      </div>
      <h2>{{ T.F.JOURNAL.HISTORY | translate }}</h2>
      @if (!journal.entries().length) {
        <p>{{ T.F.JOURNAL.EMPTY | translate }}</p>
      }
      <div class="entry-history">
        @for (entry of journal.entries(); track entry.day) {
          <button
            mat-button
            (click)="select(entry.day)"
            [attr.aria-pressed]="entry.day === day()"
          >
            <span>{{ entry.day }}</span> · {{ entry.text.slice(0, 80) }}
          </button>
        }
      </div>
    </section>
  `,
  styleUrl: './journal-page.component.scss',
})
export class JournalPageComponent {
  readonly journal = inject(JournalService);
  private readonly _dialog = inject(MatDialog);
  private readonly _editor = viewChild(JournalEditorComponent);
  readonly selectedDay = signal('');
  readonly day = computed(() => this.selectedDay() || this.journal.today());
  readonly T = T;
  select(day: string): void {
    if (this.journal.isEditableDay(day)) this.selectedDay.set(day);
  }
  move(offset: number): void {
    const date = new Date(`${this.day()}T12:00:00`);
    date.setDate(date.getDate() + offset);
    this.select(getDbDateStr(date));
  }
  clear(): void {
    const day = this.day();
    this._editor()?.flush();
    this._dialog
      .open(DialogConfirmComponent, {
        data: { message: T.F.JOURNAL.CLEAR_CONFIRM, okTxt: T.G.DELETE },
      })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (confirmed) this.journal.write(day, '');
      });
  }
}
