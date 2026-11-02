import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { CollapsibleComponent } from '../../ui/collapsible/collapsible.component';
import { T } from '../../t.const';
import { JournalEditorComponent } from './journal-editor.component';
import { JournalService } from './journal.service';

@Component({
  selector: 'flux-journal-today',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
    CollapsibleComponent,
    JournalEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <collapsible
      class="task-section"
      [isExpanded]="true"
      [isIconBefore]="true"
      [title]="T.F.JOURNAL.TITLE | translate"
    >
      <a
        actions
        mat-icon-button
        routerLink="/journal"
        (click)="$event.stopPropagation()"
        [attr.aria-label]="T.F.JOURNAL.OPEN | translate"
        ><mat-icon>open_in_full</mat-icon></a
      >
      <flux-journal-editor
        [day]="journal.today()"
        [compact]="true"
      />
    </collapsible>
  `,
  styles: `
    :host {
      display: block;
      padding-top: var(--s3);
    }
  `,
})
export class JournalTodayComponent {
  readonly journal = inject(JournalService);
  readonly T = T;
}
