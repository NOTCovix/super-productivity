# Flux roadmap

Updated 2026-11-01. Base: Super Productivity 19.3.1 at
`1e6153ab4c534264629cbb27ae510fb47b3c6408`.

## Completed

- Repository audit and initial habit architecture decision; see
  [assessment](docs/flux-habits-architecture.md).
- Dependency installation. Existing upstream task/counter functionality retained.

## In progress — Phase 1

- Native Angular habit management, date-aware rules and per-day logging using
  existing extension-data persistence. No new database, dependency or sync wire type.
- Compact Today section, editable history, streaks and consistency.
- Automated checks, persistence/backup/conflict scenarios and responsive UI review.
- Review PR on `feature/flux-habits`; do not merge until validation gaps are resolved.

## Planned

1. Validate packaged Arch Linux / GNOME Wayland and actual Android devices,
   including offline restarts, keyboard, safe areas and Linux–Android sync.
2. Journaling, mood/fulfillment and structured reflection.
3. Manual expense tracking, budgets, categories; then Tasker financial SMS
   import with explicit format, deduplication and local parsing.
4. Optional Gemini coaching with explicit approval for generated changes.
5. Platform-specific screen-time collection and cross-device summaries.
6. Guardian restrictions, allowances and controlled overrides.

Future features are not part of this PR. No personal data is sent to AI services.
