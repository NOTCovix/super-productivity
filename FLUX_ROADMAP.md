# Flux roadmap

Updated 2026-11-02. Base: Super Productivity 19.3.1 at
`1e6153ab4c534264629cbb27ae510fb47b3c6408`.

## Completed — Phase 1 implementation

- [Repository audit and architecture decision](docs/flux-habits-architecture.md).
- Native habit creation/editing, descriptions, icon/color selection, archiving,
  restoration and deletion, with original counter tools retained.
- Boolean, increase and reduce/limit habits; custom units and optional targets;
  daily/weekday schedules and dated rule changes.
- Compact Today logging, immediate existing-op-log writes, historical numeric and
  Boolean edits, explicit skipped/missing states. Zero is not missing.
- Monthly calendar with week rows, current/longest streaks, weekly/monthly
  consistency with denominators and missing/skipped counts.
- Existing keyed extension-data persistence and backup path, without a second
  database, dependency, sync wire type or provider change.
- 13 habit unit tests, six habit browser workflows, three existing task CRUD
  browser regressions, and 12 existing counter component tests passed.
- Full repository lint, development frontend build and the complete root test
  command passed (19,312 Berlin Angular tests, 6,694 Los Angeles subset tests,
  850 package tests plus release tooling). Fresh-context
  state/sync/privacy review completed; added regression coverage.

- SuperSync real-transport conflict/restart coverage: four cases passed with the
  unchanged server and Prisma client on a local PostgreSQL-protocol test backend.
- WebDAV v2/v3 real-transport conflict/restart coverage: four cases passed.
- Official v19.3.1 source-build downgrade/write/sync/offline-upgrade preservation:
  one WebDAV v2 case passed, including an ordinary task created by the old client.
- Electron TypeScript/preload build passed; Wayland helper skipped without Rust.

- Manual UI feedback corrected: custom habits now share the native weekly grid;
  creation uses existing form controls, and Today logging is expanded initially.
  Desktop/mobile browser verification is recorded in the validation notes.

## In progress — review and release verification

- Review PR on `feature/flux-habits`; do not merge until the
  [validation gaps](docs/flux-habits-validation.md) are resolved.
- Confirm CI on its pinned browser; local suites passed on temporary Chromium 153.
- Re-run provider cases on stock CI PostgreSQL/Apache infrastructure; local test
  backends and the precise released-client scope are documented in validation.
  Broader mixed-version paths and published binaries remain unverified.
- Validate packaged Arch Linux / GNOME Wayland and actual Android devices,
  including offline restart, suspension, keyboard, safe areas and Linux–Android sync.
- Benchmark multi-year history on mobile. Existing counters remain separate;
  automatic migration into the new habit model is not implemented.

## Planned — later phases

1. Journaling, mood/fulfillment and structured reflection.
2. Manual expense tracking, budgets, categories; then Tasker financial SMS
   import with explicit format, deduplication and local parsing.
3. Optional Gemini coaching with explicit approval for generated changes.
4. Platform-specific screen-time collection and cross-device summaries.
5. Guardian restrictions, allowances and controlled overrides.

Future features are not part of this PR. No personal data is sent to AI services.
