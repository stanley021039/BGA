# #74 local review and validation

Date: 2026-10-09. Implementer/reviewer: AI, separate self-review passes as allowed
by `AGENTS.md` and `docs/PR-REVIEW.md`. Local candidate, **publication blocked**.

- Main baseline: `2a5a197094c254d4a16cdec682d441af31692c76`
- Dependency chain: #70 `1a16ec6` → #73 code `7a1deae` → #73 final
  `384c2e14192cfaea24d563d78a2e442d0395bca8`
- Review base/merge-base: `384c2e14192cfaea24d563d78a2e442d0395bca8`
- Reviewed code/test head: `e61766278299a3a82d10422cc06f7a793a3631e4`
- Commits: `454f9360fa49f11511a7833cd8747b99e83b72be` and `e61766278299a3a82d10422cc06f7a793a3631e4`
- This review-only follow-up does not change tested application or test files.
- Environment: Linux 6.18.44, Node v24.19.0, npm 11.9.0. Isolated synthetic
  temporary directories and localhost HTTP, external side effects disabled in
  the new fixtures. No production, deployment, remote Git writes or CI changes.

## Pass 1: spec and acceptance

Read issue #74, project rules/release policy and actual initialization, room
expiry/leave/kick/reconnect, scheduler, history, stream and close call sites.
Diff reviewed against the base above, rather than trusting the task summary.

- Matches: a small per-app runtime owns maps, scheduler and stream disposal;
  injected history/achievement/draw callbacks preserve existing boundaries.
- Matches: routes, membership/permission helpers, game engines and persistence
  implementations remain in place; no game/UI/AI/chat/market redesign.
- Matches: startup and repeated/concurrent close share completion, failed bind
  and failed worker startup unwind, late synchronous initialization failures
  release acquired DB/history/data locks, stop failures do not skip later cleanup.
- Matches: HTTP drain retains state while already admitted handlers finish;
  late SSE registration after stop ends immediately. Closing one running app
  leaves another app's rooms, sessions and HTTP service isolated and usable.
- Matches: registry expiration, history-interrupt failure, real draw/music SSE,
  timer disposal, reconnect/replacement, leave/kick and same-data-path restart
  have focused test coverage. No schema/archive/backup format migration.
- Version: patch 1.23.1 because failure-lifecycle defects are fixed; this is the
  same unreleased patch batch as #72, requiring changelog combination at integration.
- Not yet satisfied: #70/#73 are local dependencies, not claimed merged. Full
  native test gate is not green; Linux/Windows required CI is not run. Keep #74
  open and unpublished until integrated-head validation and review gates pass.

Spec conclusion: implementation scope/acceptance covered locally; delivery gate
blocked, not Ready/mergeable. No additional same-scope extraction is necessary
for this boundary; future changes must preserve the small ownership contract.

## Pass 2: quality, logic and risk

Separately traced startup promise assignment, listen error handling, close waiting
on raw startup instead of its recovery wrapper, same-promise close rejection,
reverse acquisition unwind and per-stage cleanup error collection. Traced
scheduler partial interval acquisition and all caller replacements. Traced old
SSE disconnect against replacement sets, close-event listener removal, immediate
timer release, late registration after stop and HTTP draining before room/DB
release. Read original expiration/history-error behavior and unchanged leave,
kick, reconnect and game callback ownership.

Reviewed diff includes only runtime/lifecycle integration, tests, patch metadata
and documentation. No new routes, public controls, remote access, credentials,
external data transmission, schema changes or production paths. Synthetic test
passwords are test-only. Release files are synchronized. Account/rate maps stay
outside the runtime because they are not per-room registries.

Findings resolved during implementation:
- R74-1: old concurrent close returned before cleanup; common promise now tested.
- R74-2: old listen/close race could start workers after shutdown; raw startup
  coordination and pre-start closed check now tested.
- R74-3: old startup/stop errors could strand acquired resources; acquisition
  unwind and all-stage cleanup now tested.
- R74-4: clearing rooms before admitted HTTP handlers finish risks access to
  cleared state. Listener/SSE draining now precedes room/DB release, with a real
  partially received request regression and late-stream unit regression.

No unresolved correctness issue found in the reviewed scope. This does not prove
absence of all defects. Hard process termination, arbitrary third-party code
that never resolves its stop work, Windows behavior and production traffic were
not tested. Publication remains blocked by the full-suite/environment gate.

## Executed validation

Implementation-phase evidence (not a claim of CI):

- `npm ci --offline --cache ../npm-cache`: passed; 12 packages installed from the
  existing official-package cache. No alternative implementation/stub installed.
- Four pre-change characterization assertions on the #73 base failed as
  expected: concurrent close wait, listen/close race, thumbnail start throw and
  market stop throw. All four pass after the lifecycle changes.
- An early new SSE test expected five intervals, but observed four because its
  fixture disables external market automation. Corrected only that new test's
  expected count to the actual two scheduler + two SSE timers; no existing
  assertion weakened. Final SSE test additionally verifies zero after close.
- `npm run release:check -- --base 384c2e14192cfaea24d563d78a2e442d0395bca8 --type patch`: passed.
- `node --check` for `src/app.js`, `src/rooms/runtime.js`,
  `src/rooms/scheduler.js`, `tests/app-runtime.test.js`,
  `tests/room-runtime.test.js`: passed.
- `git diff --check`: passed.
- Focused command: `node --test tests/app-runtime.test.js tests/room-runtime.test.js tests/room-lifecycle.test.js tests/reconnect.test.js tests/kick.test.js tests/app.test.js tests/data-locks.test.js tests/merged-app-resources.test.js tests/history-failed-start.test.js tests/music.test.js tests/draw-guess.test.js tests/room-media.test.js`
  Final result: **81 passed, 0 failed, 0 skipped, 0 cancelled**.

Native full-suite gate and baseline diagnosis are recorded below. No stubs,
skips, filtered full-suite claims or unrelated OS behavior fix were used.

- Final `npm test` on the reviewed code/test contents: **1,856 passed / 1,857
  tests, 1 failed, 0 skipped, 0 cancelled** (45.591 s). Sole failure is
  `tests/web-features.test.js:2`, `/api/info` expected 200 but got 500.
- Exact #73 base `384c2e1`: separate `node --test tests/web-features.test.js`
  reproduced the same 500 at its `/api/info` assertion. Direct native
  `os.networkInterfaces()` raised `ERR_SYSTEM_ERROR`,
  `uv_interface_addresses returned Unknown system error 1`. The app's unchanged
  `/api/info` route calls that OS API. This verifies the environment blocker;
  it does not waive the full-test gate.
- Earlier full runs: 1,852/1,853 and 1,855/1,856, each with only that same failure.
  The previously reported #73 Thunder history-trace flake did not recur in
  these three #74 full runs; it is not relabeled as a proven baseline issue.
- Git commit initially lacked identity in the new clone; retried with per-command
  author/committer matching the existing local dependency commits. No global
  Git settings were changed.
- Two local review passes above are complete for the fixed base/head. Required
  remote Linux/Windows CI has not run; no PR was created or published. **Hold
  push/merge/deploy** until the parent-coordinated integrated head clears all
  full native checks and any remaining review/CI requirements.
