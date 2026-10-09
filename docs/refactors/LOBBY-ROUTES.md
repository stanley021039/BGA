# Lobby route slice (issue #73)

Scope: four lobby handlers only, following shared HTTP fixture #70. This is a behavior-preserving development refactor, so package version 1.23.0 and CHANGELOG are unchanged under RELEASE-POLICY. No schema, UI, deployment, production data, entrypoint or room-runtime changes.

## Ordered route inventory and boundaries

This is the pre-extraction `src/app.js` sequence, retained by this slice. Exact paths and methods still match in app.js; no prefix dispatch or new method fallback is introduced.

1. Global security headers, embedded-page header exception, public GET robots/version.
2. `/api/` JSON response setup. Market-image and official-recheck preflight checks same-origin and authenticates before body processing; admin subset checks role; upload rate check precedes body.
3. POST music upload: origin, login and account rate checks, binary content type and 20 MB limits, then store.
4. Other POST: origin host, JSON content type, bounded body, JSON parse. Default 8,192 bytes; market image 3 MiB, image approval 128 KiB, character image uploads use `MAX_CHARACTER_IMAGE_BODY_BYTES`; artwork/draw-save/other character/community-gift payloads 1,400,000 bytes. These checks occur **before** general login, including lobby requests.
5. Public auth login/register/reset/logout (auth rate 20/minute for first three), then general `auth.requireUser`.
6. Chat with channel validation and table membership, `/auth/me`, rename/profile propagation, market-image routes and market vote/read. Market methods use their own 405 fallback.
7. **Lobby slice:** GET `/api/lobby`, POST `/api/lobby/move`, GET `/api/lobby/emotes`, POST `/api/lobby/emote`, in that order.
8. Music list/delete; collection/artworks; profile settings/avatar/options/social options; character uploads/sharing/expressions/sound/appearance; submissions; admin group (role gate); community; draw words; achievements/history/info.
9. Room list/create; room-path allowlist, room existence/session/membership checks; reconnect/join/leave; shared room-media/roles/watch/music/SSE; drawing; state; remaining POST room actions with host/action-specific checks and history transactions.
10. Non-API lobby/static assets, authenticated music/character media, static page/room-page mapping, page-login/admin checks. Unknown static paths return 404. Global catch uses existing `writeError`.

All groups except item 7 remain unextracted. This document does not claim app.js or RoomRuntime has been fully split.

### Lobby contracts

- Logged-out valid requests reach `LOGIN_REQUIRED`/401; malformed, wrong-content-type, cross-origin or oversized POSTs retain their earlier parsing errors. No new security policy is added.
- Unsupported lobby methods and trailing-slash paths still fall through to the later room-path allowlist and return `NOT_FOUND`/404 after authentication (not a new 405).
- Successful handlers return the same plain payload; app.js owns JSON serialization/status. `HttpError` and generic errors still reach the same global catch.
- `createLobby` remains app-local. Presence is 15 seconds, maximum 80 visitors; invalid movement is `INVALID_MOVEMENT`/400, fullness `LOBBY_FULL`/503. Movement clamping/interpolation is unchanged.
- Emotes reject non-string, neutral or non-owned expression keys with `INVALID_EXPRESSION`/400 before the lobby's 1,200 ms `EMOTE_RATE_LIMIT`/429 check. No account/community/room rate limiter is added to lobby requests.
- No code moves room lookup, membership, host privileges or room state into lobby handlers.

## Injected dependencies

`createLobbyHandlers({lobby, withLobbyMedia, lobbyCharacter, expressionLabels, characterMedia})` is constructed once per `createApp`. It exposes only `view`, `move`, `emotes`, `emote`; there is no module-global mutable state, database or app closure export.

- `lobby`: existing app-owned presence/movement/emote implementation.
- `withLobbyMedia`: unchanged app callback records delivered expression grants for that viewer/audience and adds response-time `serverNow`.
- `lobbyCharacter`: unchanged app callback normalizes stored appearance with defaults and resolves accessible character/fallback via that app's database.
- `expressionLabels`: existing shared built-in labels. Both options and events retain custom label → built-in label → expression-key fallback.
- `characterMedia`: existing app-owned access service. Options retain original image/sound metadata; events call `broadcastImage` and `broadcastSound` and copy sound metadata without mutating the source. Actual byte access is still enforced by existing media routes and audience grants.

## Verification and rollback

New `tests/lobby-http.test.js` uses #70's isolated `appFixture` and was run against the unchanged implementation before extraction. It characterizes four routes, error ordering, body limits, method/path fallthrough, payloads, invalid expressions, cooldown and simultaneous app isolation. `tests/lobby-routes.test.js` directly checks label fallbacks and broadcast-call/metadata semantics. Existing character-media-access and character-sound-http tests cover private media masking, presence/room membership, expiry and byte-version access.

Use `node --test tests/lobby-http.test.js tests/lobby-routes.test.js tests/lobby.test.js tests/app.test.js tests/character-media-access.test.js tests/character-sound-http.test.js`, syntax checks, release check, full `npm test` and `git diff --check`. Exact local outcomes and two review rounds are recorded separately with fixed SHAs; failed or blocked full verification is not a pass. Publication remains blocked until all required local and final-head Linux/Windows checks pass.

Rollback is a revert of this slice followed by affected tests/full CI. No data restore or migration is required. Issue #74 must use the eventual merged base; an unpublished local dependency chain is not main.
