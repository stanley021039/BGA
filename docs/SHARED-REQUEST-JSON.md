# Shared JSON request contract

Issue #72; first consumer is `RoomApi.request` in `public/shared/api.js`.
`RoomApi.requestJson(url, options)` is the transport boundary, available without
another script or dependency. It performs exactly one fetch and one body read.
It does not redirect, update session/UI state, create IDs, or retry any request.
Other fetch call sites and draw/race controllers are deliberately unchanged.

## Outcomes

- Successful JSON returns the parsed value, including `null`, arrays and scalars.
- Successful empty/whitespace body (including 204) returns `null`.
- HTTP failure throws an Error with `kind: 'http'`, numeric `status`, server
  `code` when present, and `details` containing the parsed JSON value (or `null`
  without usable JSON). A nonempty string `error` is the message; otherwise the
  message includes the HTTP status. Raw HTML/text is never used as a UI message.
- HTTP failure with empty, invalid JSON, or unreadable body remains an HTTP
  failure. A parse/read failure is retained as `cause`, where applicable.
- Invalid JSON or unreadable body on a successful response throws a response
  error (`kind: 'response'`, response `status`, `INVALID_JSON` or
  `BODY_READ_FAILED`, original `cause`), not an invented network failure.
- Fetch rejection propagates unchanged, without a fabricated HTTP status.
- Fetch/body `AbortError` propagates unchanged. The supplied AbortSignal reaches
  fetch; its reason is also checked after headers and body, so an already
  cancelled late response cannot trigger room/session or history effects.
  Timeouts remain failures, rather than being silently treated as stale aborts.

## Room compatibility

RoomApi still owns JSON request encoding, GET code encoding, caller code override,
login return paths, kicked callbacks, reconnect-forget and closed-room routing.
Non-abort network/response errors and HTTP 5xx call `GameShell.disconnected`.
HTTP 4xx responses alone do not mark the connection down. Effects retain their
order: disconnect, 401 login redirect, kicked callback, forget then closed-room
redirect. Session-dependent effects still require a session. Non-JSON 401 now
retains enough status to perform the same login redirect as a JSON 401.

State results and full player/phase results still publish `historyWarning`;
canvas acknowledgments do not clear it. A null state result clears the warning
through the existing state-route rule; controllers still own state validation.
Abort suppresses every effect. There is no new cross-room stale-response policy
without a signal: existing controller epoch/version guards remain responsible.

A POST network failure or timeout may have been accepted by the server. This
transport never resends it, even for 429/5xx. Explicit caller submissions each
send once, preserving request/batch/stroke IDs and the existing draw transport's
own exact-ID reconciliation/retry policy. No new timeout or retry loop is added.

## Release and validation

The error-status/empty-body correction is a compatible fix: candidate 1.23.1.
No schema, persistence, dependency, game rule, visual design, or deployment change.
The slice can be reverted independently. Tests are in `tests/shared-api.test.js`;
existing draw input/recovery and race engine/dialog checks cover adjacent behavior.
Publication remains blocked until all required local gates and exact-head
Linux/Windows CI pass; a focused test pass is not a full-suite pass.
