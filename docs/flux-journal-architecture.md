# Flux journal — first increment

Assessed 2026-11-02. Branch: `feature/flux-journal`, stacked on
`feature/flux-habits`. Journaling has its own navigation tab and a compact editor
at the bottom of Today; neither replaces task planning or the Habits tab.

## Audit and decision

The existing `metric` entity is already keyed by logical date. Its optional
`reflections` array stores the daily review's text and original creation time.
`MetricService`, the metric reducer, operation log, import/export and sync already
handle these records. Energy and work-impact ratings are also present; they are
not equivalent to mood or fulfillment and will not be relabelled as such.

Reuse the current reflection field with a small native page/editor and an adapter
that dispatches the existing `updateMetric` action with only `reflections` in its
changes. Do not create another journal database, entity type, provider, dependency,
schema version, plugin API or duplicate daily note. The existing daily review and
Journal tab read the same text. Clearing a journal entry must preserve focus
sessions and ratings on that date.

The existing reflection widget debounces text and resolves its active metric at
save time. A standalone dated editor must capture the date with each pending edit
and flush on blur, date navigation and destruction, so a pending edit cannot move
to another day or disappear when leaving the page. This increment keeps the
upstream widget unchanged and gives the new editor explicit lifecycle coverage.

## Prior art — checked November 2026

| App / primary source                                                                                               | Relevant behavior                                     | Take / deliberately do not take                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Super Productivity — local `features/metric` source                                                                | Dated daily reflections and existing backup/sync path | Reuse data and controls; do not fork the daily-review state.                                                               |
| [Day One: calendar view](https://dayoneapp.com/guides/tips-and-tutorials/calendar-view-in-day-one/) — vendor guide | Navigate to entries by date                           | Take dated browsing/backfilling; no extra calendar integration or media capture.                                           |
| [Joplin: note history](https://joplinapp.org/help/apps/note_history/) — vendor guide                               | Inspect and restore older note revisions              | Keep explicit backup/restore validation; do not add a separate revision/sync engine or claim revision history exists here. |

## Boundaries and risks

- Growth bound: one current reflection per logical date (at most one new record
  per day), with user-sized text retained until cleared. The normal operation-log
  retention/compaction policy still applies; no separate revisions are added.
  History scans/sorts all daily metrics and renders all entries, so multi-year
  mobile performance remains a validation gate. Date history is not revision history.
- Different dates are different metric entities. Concurrent changes to the same
  reflection follow upstream field conflict handling; this is not a text CRDT.
- Other clients already understand this field. Existing daily-review edits still
  update the same entry, including their established whole-metric write behavior.
- A pending local edit stays visible during incoming changes and is committed by
  the normal local write path; unedited views follow stored changes. No automatic
  AI text or external analysis is included.
- Debounced autosave reduces operation-log growth; normal blur/navigation flushes
  it. Abrupt process termination cannot be promised to preserve unsaved keystrokes.
- Keep ordinary notes intact. Entries are plain text/Markdown source, as in the
  current reflection field; no attachment or rich editor framework is added.
- Mood, fulfillment, meaningful activities, structured weekly reviews, revision
  recovery and device validation are later increments, not working placeholders.

## Validation

Cover date-bound autosave, navigation/unmount before debounce, external updates,
clear/no-op behavior, preserved metric fields, backup/reload, both Today and tab
entry points, desktop/mobile layouts, and at least one real-provider round trip.
Report actual execution separately from native-device and broader conflict gates.
