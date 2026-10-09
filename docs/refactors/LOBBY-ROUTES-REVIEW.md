# Issue #73 local review and validation — 2026-10-09

Status: **local implementation complete; publication blocked**. No push, PR, merge, tag, deployment or production-data operation.

Fixed review range for both rounds:
- Main ancestor: `2a5a197094c254d4a16cdec682d441af31692c76`
- Base / merge-base: `1a16ec6853f30696f4abe1bfec30f3baf2fa96da` (unpublished issue #70 dependency)
- Code head: `7a1deae8d707212a216bbf7093fc2fb8a8197267`
- Range: base..code-head, one implementation commit. This report is a later documentation-only commit and does not change that reviewed code.
- Requirements: [issue #73](https://github.com/stanley021039/BGA/issues/73), AGENTS, PR-REVIEW and RELEASE-POLICY at the base.

## Round 1 — specification and acceptance

Reviewed the fixed diff and callers against each issue acceptance item.

- Conforms: route inventory/order, authentication/role/body-size/rate-limit boundaries, injected dependencies and remaining unextracted groups documented in LOBBY-ROUTES.md.
- Conforms: only four lobby handlers extracted. `app.js` retains exact path/method predicates in the same position, general login, parsing, `send`, error catch, and unchanged public createApp/listen/close/server/admin entrypoints.
- Conforms: `withLobbyMedia` and `lobbyCharacter` remain app callbacks; labels keep custom/built-in/key fallback. Image/sound broadcast operations and optional metadata shapes match the original expressions.
- Conforms: new HTTP tests use #70 fixture, cover four routes, anonymous access, invalid expressions, unsupported methods/trailing slashes, parsing order, body limit, media masking and two-app isolation. Four HTTP tests pass against original app.js as characterization as well as extracted code.
- Conforms: behavior-only refactor, no version/CHANGELOG bump under release policy, no UI/schema/RoomRuntime scope.
- Partial / blocked: focused acceptance checks pass, but mandatory full suite fails. Final-head Linux/Windows CI has not run because publication is held. This is not release-ready.

No implementation/spec discrepancy found in reviewed scope; acceptance is incomplete due to validation blockers below.

## Round 2 — code quality, regression and risk

Independently reread the same base/head diff, original handlers, media callbacks and lobby implementation, plus focused tests.

- `createLobbyHandlers` has no module-global state and captures only explicitly supplied services. Factory construction occurs inside each app after its dependencies exist.
- Each route returns exactly one unchanged plain payload into app serialization; exceptions still reach the original global catch. No new middleware, prefix routing, 405, rate limiter, authentication shortcut or grant is introduced.
- Expression own-property/type/neutral validation, label precedence, optional sound copy, original-options metadata versus versioned event media, grant callback order and server timestamp are preserved.
- Lobby presence/cooldown/limits and room ownership/lifecycle are unchanged. Two real concurrent apps verify session, visitor, movement, expression and room isolation. Existing media tests cover membership, delivered-recipient grace, replacement-version rejection and sound access.
- New fixtures own synthetic temporary data and disable external effects. Committed diff contains no secrets or production paths/data; test credentials are synthetic. No schema, storage, network/security settings or new package dependency.
- UI/performance benchmarking is not applicable: no rendering or algorithm change. No unsupported throughput claim is made.

No new code defect found in inspected scope. The full-suite failures are still blockers; isolated passes do not erase them.

## Executed evidence

Environment: Linux 6.18.44, Node v24.19.0, npm 11.9.0. Native runtime, no networkInterfaces replacement, test skip or runtime patch.

- `npm ci --offline`: failed ENOTCACHED for sharp 0.35.5. Recovered using ordinary `npm ci --cache <workspace-cache> --fetch-retries=0`: exit 0, 12 packages installed. No lockfile changes.
- Before extraction: initial three new HTTP characterization tests 3/3 pass; after adding media coverage, all four tests run against original base app.js 4/4 pass, fail/cancel/skip/todo 0. Extracted app.js restored byte-for-byte afterward.
- `node --check` on src/app.js, src/http/lobby-routes.js, tests/lobby-http.test.js and tests/lobby-routes.test.js: pass.
- `npm run release:check`: pass, 1.23.0; also passes npm-test pretest.
- Focused command in LOBBY-ROUTES.md: 23/23 pass, fail/cancel/skip/todo 0. Fixed-code-head review rerun: 23/23 pass (3136.547029 ms).
- `git diff --check` including fixed review range: pass.
- Initial `npm test` before last media test addition: 1839 total, 1838 pass, 1 fail, cancel/skip/todo 0 (41382.129203 ms).
- Final code `npm test`: 1840 total, 1838 pass, 2 fail, cancel/skip/todo 0 (41374.648042 ms). Files were unchanged while this run executed and committed as code head above.

### B73-1: pre-existing environment blocker

`tests/web-features.test.js:12` first `/api/info` request returns 500 instead of 200. The identical test independently fails on unchanged dependency base. A direct native `os.networkInterfaces()` probe reports `ERR_SYSTEM_ERROR: uv_interface_addresses returned Unknown system error 1`. Route implementation is unchanged. No workaround, stub or assertion weakening was used.

### B73-2: additional full-run failure, separate from B73-1

Final run failed `tests/history.test.js:6`, Thunder automatic game assertion `event/enter traces > 60`. That test, history store and Thunder game source are unchanged; the test directly imports game/history modules and does not import app.js or the new handlers. Thunder defaults to crypto.randomInt and the test supplies no seeded RNG. An isolated head rerun passes 3/3, as does an isolated dependency-base run. A further 30 dependency-base runs each pass 3/3; the extra failure was not reproduced in that bounded investigation. This supports an existing nondeterministic test-path diagnosis, but a rerun pass is not a successful final aggregate validation. No out-of-scope fix or threshold change was made.

## Handoff / remaining gate

Local dependency chain is main ancestor → #70 base → #73 code. The working branch is `refactor/lobby-route-handlers`; #74 may use this only as an explicitly unpublished local dependency, never assume it is main. Parent coordinates release; do not publish while checks fail. Rebase/revalidate against actual main once #70/#73 can be released; run mandatory Linux/Windows CI on eventual final head and repeat affected review conclusions after any code/base change.
