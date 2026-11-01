# Flux habits validation

Checked 2026-11-01. This is a review build, not a verified platform release.

## Passed

| Check                                        | Result                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci --no-audit --no-fund`                | Installed existing lockfile; no dependency changes                                                                                 |
| `npm run buildFrontend:dev`                  | Angular application build passed with 7 GB Node heap / one build worker                                                            |
| `npm run quiet -- test`                      | Passed: 19,312 Berlin Angular tests, 6,694 Los Angeles subset tests (14 skipped), all 850 shared-package tests and release tooling |
| `npm run quiet -- lint`                      | Full repository lint, style tokens, local lint-rule/tool tests and icon checks passed                                              |
| `checkFile` on changed non-generated TS/SCSS | Passed; generated translation keys regenerated and Prettier-formatted separately                                                   |
| Habit utility specs                          | 7 passed                                                                                                                           |
| Habit service specs                          | 6 passed, using actual extension-data reducer                                                                                      |
| Existing habit-tracker component specs       | 12 passed                                                                                                                          |
| Habit browser E2E                            | 6 passed: desktop/mobile workflows, limit semantics, actual backup export/import/reload, historical edits                          |
| Existing task CRUD browser E2E               | 3 passed                                                                                                                           |
| Sync-core                                    | 287 passed, including package test typecheck                                                                                       |
| Shared-schema                                | 95 passed                                                                                                                          |
| Sync-providers                               | 468 passed, including package test typecheck                                                                                       |
| `git diff --check`                           | Passed                                                                                                                             |

The browser E2E ran on the built application through the existing Playwright
fixtures. It clicked the real UI, reloaded actual browser IndexedDB state, exported
and restored an actual JSON backup, and added/edited/deleted ordinary tasks.
Viewport coverage: 1280×900 and 390×844. The history/limit view was also visually
inspected at desktop and phone widths. This is not Android device verification.

Local browser installation required a temporary Chromium 153 binary (the pinned
Playwright Chromium 149 download returned a truncated archive). Fonts, launcher,
static server and test-config overrides stayed outside the repository. The override
changed only executable path, one worker, static base URL and video recording;
app code, fixtures and assertions were unchanged. Karma needed a valid en-US locale.

## Execution caveats and unverified checks

- The initial default-heap baseline compile ran out of worker memory. The existing
  counter component suite later passed with the larger heap; a pre-change full
  assertion baseline was not established.
- An early full affected run compiled but stopped after browser locale failures
  (`en-us@posix`) and a disconnect. This was not counted as a pass.
- A full `npm test` attempt passed all three shared package suites and release
  tooling, then esbuild stopped with `all goroutines are asleep - deadlock!` during
  broad Angular test compilation. A final serial retry with a valid browser locale
  passed the complete command in 438 seconds; these earlier failures are not
  presented as product failures or hidden as successful runs.
- Direct `tsc -p src/tsconfig.app.json --noEmit` reports upstream workspace
  `rootDir` errors for package imports outside `src`. The Angular application
  build passed; the direct tsc command is not reported as passing.
- Four SuperSync scenarios are authored and discoverable (both timestamp winners
  and both upload orders; independent date preservation and restart). They have
  **not run** against a real provider here: Docker is unavailable. Listing tests
  is not execution. Run the existing provider command before release:
  `npm run quiet -- e2e:supersync:file e2e/tests/sync/supersync-flux-habits.spec.ts --retries=0`.
- WebDAV transport, released-client preservation and real Linux–Android sync
  remain unverified. No conflict-resolution code was changed.
- Actual Arch/GNOME Wayland packaging and Android offline restarts, suspension,
  numeric IME, keyboard/safe areas and touch accessibility require devices.

## Review

A fresh-context review examined the branch, diff, tracker and repository review
guide. **Fixed:** two service regression tests covering stored interpretation,
clear/re-record, historical rules, day rollover, future dates and archive boundary.
**Not fixed:** provider/mixed-version/device execution and large-history scale are
release gates. No material production defect was identified in the reviewed
model/service/utility paths. This is not a GitHub approval.

## Scale residual

A Node benchmark with ten habits over five years produced 18,280 records and
5,685,311 bytes of snapshot JSON. Parsing and calculating every habit's statistics
across five runs took 147, 89, 91, 83 and 78 ms. This excludes rendering, IndexedDB
and provider transfer. The extension store is array-backed and full history is
retained; benchmark on Android and optimize measured bottlenecks before broadly
shipping multi-year history. No speculative cache or silent history pruning added.
