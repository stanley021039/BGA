# Race synchronization controller (Issue 76)

Local candidate, 2026-10-09. Not published, merged or deployed. Version remains
1.23.1 from the unreleased shared transport batch. Issue:
https://github.com/stanley021039/BGA/issues/76

## Ownership before and after

- Before: `race.js` kept session, renderer snapshot, unused lastVersion, presence
  signature, busy and polling flags together. `beginLive` created two untracked
  intervals on every call. Visibility/pagehide cleaned presentation but could
  not invalidate a pending request or a queued movement settlement callback.
- After: `RaceController.create` owns receive routing, the polling lock, the
  700 ms refresh / 250 ms display-tick intervals, recovery lifetime, cancellation
  epoch, abort controllers and visibility/pagehide/pageshow listeners. Dispose
  removes its listeners and timers. Repeated beginLive is idempotent.
- The page explicitly injects session/state readers, the busy and disconnected
  state readers, RoomHost freshness, transport, recovery, presentation callbacks,
  timer functions, document/window and AbortController. The accepted renderer
  snapshot and selection remain page-owned; neither the whole page nor its board
  rendering moved into a renamed module. Unused lastVersion and duplicate
  onlineSignature state were removed.
- `run`, input handlers, pending button feedback, board rendering, event/movement
  order, dice UI, sounds and tutorial engine ownership remain in the page or
  their existing modules. The controller reads busy to skip polls; movement
  locks still block input while allowing ordinary live state refresh.
- State receive compares version and RoomHost freshness before either rendering
  or lightweight presence/expression updates. The latter retains board and dice
  identity. RoomHost receives a lifetime-bound callback; a prior session's ACK
  cannot update the next session.

## Lifetime and compatibility

Requests still use `RoomApi.request`, including the shared requestJson from
Issue 72, or the existing `RaceLesson.api` bridge. No new write retry is added.
Cancellation stops observing a request; it does not claim to undo a server-side
write that already arrived. Returning to a visible live page reads authoritative
state. The next action remains a new explicit user action.

Hidden/pagehide stop both intervals and abort pending operations; visible return
or pageshow starts only one owner. A cancelled operation cannot render, show an
error, reset a new action's busy flag or trigger old room cleanup. Initial
RoomReconnect recovery uses its existing retry policy, now with an optional
AbortSignal to cancel fetch/body completion and the retry wait. Existing callers
can continue calling restore with three arguments. No production configuration,
authentication behavior, API route, database schema or game rule changed.

`RaceLesson.mount` still receives render/isMoving/resetSelection. Lesson mode
never starts live polling. Reset invalidates outstanding actions before creating
a fresh selection/snapshot. Queued movement settlement also checks its original
presentation object and epoch, preventing a cancelled callback from flushing a
new chapter's presentation. RaceMovement, RaceEventCues, RaceDiceDialog and
RaceGameSounds source files are unchanged.

Only one script tag and one exact static asset allowlist entry are added. The
embedded TutorialEngine / LessonScenarios source identity gate from Issue 71
continues to pass; there is no teaching-engine regeneration or large HTML rewrite.

## Verification and release gate

Environment: Node v24.19.0, npm 11.9.0, Linux x86_64 6.18.44. Baseline main:
`2a5a197094c254d4a16cdec682d441af31692c76`. Dependencies: Issue 71
`9f20aa4452eae35a97681e431838d67b6f27fd89` and Issue 72
`72981f5d2c1ceed7e8e5fd9eb3052411375dedbc` (clean local cherry-pick).

- npm ci --offline --cache ../npm-cache: passed
- Before extraction: named issue tests (presentation, movement timeline, dice
  protocol, command options, action events and tutorial): 80 passed, 0 failed,
  skipped or cancelled
- Focused after extraction: all race test files plus tutorial, reconnect,
  room-reconnect-cancellation and room-api: 228 passed, 0 failed, skipped or
  cancelled; real multi-update, motion/checkpoint/dice and sound assertions kept
- New lifecycle tests exercise duplicate startup, pending/busy polls, freshness,
  reconnect, hidden return, pagehide/pageshow, dispose, cancelled action, old ACK,
  recovery, new chapter and old movement settlement microtask
- Shared expression/notification integration: 34 passed after adapting harnesses
  to load the real controller; assertions were retained. The first full run
  exposed missing harness dependencies, which were corrected rather than skipped
- release:check, check-race-teaching, changed JS syntax and git diff --check: passed
- Final combined focused selection: 262 passed, 0 failed/skipped/cancelled
- Full suite: 1,866 tests, 1,865 passed, 1 failed, 0 skipped/cancelled. The
  existing /api/info os.networkInterfaces environment failure is not stubbed or
  suppressed; required full validation is not green
- Native browser: the isolated app started with separate synthetic database,
  history/community/music directories and external side effects disabled. The
  supported dot cloud browser returned ERR_CONNECTION_REFUSED for the executor's
  loopback lesson URL. No successful native live/lesson, mobile, keyboard/touch,
  background/Back or event/dice sequence evidence is claimed. The isolated
  listener was stopped; no user-computer fallback or production access was used

The VM and module tests are regression evidence, not native-browser substitutes.
Push remains on hold until full checks and required native evidence pass on the
actual final integrated head. No remote CI is claimed for this local candidate.
Rollback is a revert of the slice plus removal of its script/allowlist entry;
no schema/data restore is required. The optional reconnect helper is independently
revertible once callers stop passing its signal.
