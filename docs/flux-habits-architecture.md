# Flux habits: assessment and design

Audited 2026-11-01 against commit `1e6153ab4c534264629cbb27ae510fb47b3c6408`.

## Actual foundation

- `package.json`: v19.3.1, Angular 22.2, NgRx 22, Angular Material and Formly.
  New UI uses standalone components, OnPush, signals, existing Material controls,
  theme tokens and English translation keys. No new packages.
- `src/app/features/tasks/`, `task-repeat-cfg/`, `planner/`, `work-view/`,
  `time-tracking/` and `worklog/` already provide tasks, scheduling, recurrence,
  reminders, tracking and reports. Habits must not create synthetic tasks.
- There is already `/habits`: `pages/habit-page/` renders
  `features/simple-counter/habit-tracker/`. It has a rolling seven-day grid,
  Boolean-like clicks, stopwatch/countdown tools, weekday/weekly-frequency goals,
  edit dialogs, disabled counters and streaks. Header and daily-summary integrations
  also use counters. These remain intact for compatibility.
- `core/date/date.service.ts` owns logical-day boundaries; use its day string,
  including the configurable start-of-next-day offset. Calendar arithmetic uses
  local noon and calendar dates, not UTC date parsing or fixed 24-hour increments.
- Electron main process is under `electron/`. Android/iOS use Capacitor plus
  platform bridges (`android/`, `ios/`, `features/android/`). Android supports
  bundled offline and remote-web modes; a fork feature needs a fork frontend,
  not the upstream remote website. Shared frontend compilation is not device proof.
- Current storage is the IndexedDB op log plus snapshots/projections, under
  `op-log/persistence/`; the old `pf` reader is migration code, not an alternative
  database to extend. Persistent actions are captured by the root meta-reducer;
  remote operations replay the same reducers. Effects must use LOCAL_ACTIONS.
- `op-log/model/model-config.ts` includes `simpleCounter` and `pluginUserData`.
  Standard full-state export/import and recovery snapshots include those slices.
  Backup/import intentionally replaces state, rather than merging concurrent edits.
- Existing sync supports SuperSync and file-provider adapters (WebDAV, Dropbox,
  OneDrive). Credentials and transports remain entirely upstream-owned. No new
  server is necessary; the user must configure an existing supported provider.
- Navigation: `routes/`, `core-ui/magic-side-nav/`; Habits is already controlled by
  `appFeatures.isHabitsEnabled` (true in legacy defaults; disabled for minimal new installs). Light/dark tokens live in
  `src/styles/_css-variables.scss`; `en.json` generates `t.const.ts`. Other
  languages use existing fallback behavior until translated.
- Tests: co-located Jasmine/Karma specs, Playwright E2E, framework-independent
  package suites, Electron tests, CI workflows under `.github/workflows/`.
  Root tests do not substitute for E2E, Electron or Android verification.

## Decision: native isolated feature with the existing keyed extension store

`src/app/features/habits/` owns the model, calculations, host storage adapter and
standalone UI. Reuse `/habits` and add a collapsed Today section, outside the task
row hot path. Keep legacy counters available below the new feature.

Why not extend the counter map? `countOnDay` cannot distinguish a missing value,
explicit skip and recorded zero through all existing UI paths. More seriously,
`conflict-field-patch.util.ts` explicitly treats counter-count actions as opaque:
whole-entity LWW can discard concurrent edits to different dates. A new nested map
on a counter would still share that conflict boundary.

Why not a sandbox plugin? Keyed `persistDataSynced`, `loadSyncedData` and
`listSyncedDataKeys` do participate in sync/backups, so plugin storage is usable.
But the plugin runtime UI is an iframe, cannot directly supply a compact native
Angular Today section, and the public persistence API can acknowledge writes queued
in a one-second in-memory coalescing window. Avoid that queue for daily host logging.

The first-party adapter dispatches the **existing** `upsertPluginUserData` action
with plain JSON, a supported extension-data representation. This intentionally
reuses a plugin-named store as an extension record store; it is not a fake plugin
installation and does not expose new public API. All coupling is in one service.
A future rename/generalization of that upstream store is not part of this phase.

Keys (the leading colon cannot be produced by a valid plugin ID, so plugin
installation/uninstallation cannot collide with this host-owned namespace):

- `:flux-habits-v1:habit:<id>` — one definition and dated rule revisions.
- `:flux-habits-v1:entry:<id>:YYYY-MM-DD` — one explicit daily entry.

Each write immediately dispatches one persistent action, follows existing ordered
op-log durability, and declares exactly one entity. No schema migration, new wire
action/entity type, core reducer or provider change. Same-day concurrent edits use
existing per-key LWW; different days and habits have independent conflict boundaries.
LWW is not a merge of two measurements: users should sync before editing the same
day on another offline device. No custom conflict UI or false merge guarantee.

Released clients can preserve opaque records through normal sync/backups, but do not
render the native feature. Both platforms need this fork to use the UI. Test actual
mixed-version transport before claiming universal released-client compatibility.

Deleting writes a content-free definition tombstone, then ordinary per-entry
Delete operations. A late daily entry cannot recreate a definition. This is a
sequence of independent upstream operations, not an atomic multi-entity action.
Offline stale definition edits still follow upstream LWW delete/edit semantics.
No irreversible silent log pruning. Growth is at most one small record per
habit/day (roughly hundreds of bytes, not one event per keystroke in the snapshot),
plus one rule revision per changed day; at 10 habits this is roughly 1–2 MB/year of
snapshot JSON, before provider compression. The op log has its existing compaction.
The array-backed extension store needs a multi-year scale benchmark before broad
release; do not claim unbounded history is free.

## Prior art (vendor documentation, November 2026)

| App                                                                                         | Relevant documented interaction              | Take / deliberately do not take                                                                            |
| ------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [Loop](https://loophabits.org/)                                                             | Offline habit history, charts and statistics | Take local ownership and inspectable history; do not add an opaque habit-strength score.                   |
| [Habitify](https://intercom.help/habitify-app/en/articles/12393175-good-habit-setting-goal) | Numeric goals with units                     | Take custom units and thresholds; keep routine logging inline.                                             |
| [Streaks](https://streaks.app/help/how-do-negative-tasks-work/)                             | Negative tasks and allowances                | Take explicit limit direction; do not automatically credit missing data or reward consuming the allowance. |

## Semantics

- Boolean values are explicitly 0 or 1. Increase is successful at or above target;
  limit at or below target, including an explicitly recorded zero. With no numeric
  target, a value is recorded without success/failure or streak credit.
- Blank means unrecorded, not zero. Skip is explicit and excluded from consistency;
  it preserves a streak without incrementing it. Missing elapsed scheduled days
  break streaks. Unscheduled days preserve them. Today's pending result does not
  erase yesterday's streak before the day ends.
- Consistency is completed / elapsed scheduled target-bearing days, Monday–today
  and calendar-month–today. Unrecorded today stays pending; missing historical
  days remain in the denominator. Show denominator, missing and skipped counts.
- Rule edits take effect on logical today. Earlier rule revisions determine earlier
  schedules; entries snapshot their interpretation. Changing a target/unit does
  not retroactively reclassify existing recorded values. Clearing and re-recording
  a day uses that day's rule. Tracking start date is fixed after creation.
- Archive disables future scheduling with a dated rule, preserving history.
  Restore re-enables from today. Names, description, icon and color remain editable.
- Historical edits are allowed from the tracking start through logical today.
  No future completions. Invalid owned records produce a visible warning and are
  retained for backup/recovery; unrelated extension records are ignored.

## Changed surfaces and verification

Expected changes are confined to `features/habits/`, the Habits page, one Today
composition point, English strings/generated keys, focused tests and these docs.
No task-management engine, core sync implementation or native bridge changes.

Validation status and remaining platform/release gates are tracked in
[the roadmap](../FLUX_ROADMAP.md) and the PR. Installation, compilation, unit tests,
real persistence/restart, backup restore, transport conflicts, mobile browser layout
and actual Android are distinct checks; none implies another passed.
