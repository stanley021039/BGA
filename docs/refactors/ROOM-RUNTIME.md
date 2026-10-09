# Room runtime lifecycle boundary (#74)

Local candidate only; not published, merged or deployed. This slice is based on
#70 + #73 (`384c2e14192cfaea24d563d78a2e442d0395bca8`), not a claim that those
unpublished dependencies have merged. Main baseline is `2a5a197094c254d4a16cdec682d441af31692c76`.

## Ownership and callbacks

`createRoomRuntime()` allocates a distinct set of room, seat, departed-seat,
kicked-user, social/expression/barrage, reconnect-grace, draw/music stream,
music-state and watch/media registries per app. Account/rate limits, the lobby,
HTTP routes, DB/auth, history persistence, market services and game engines stay
in their existing modules. No module-global runtime state is introduced.

The runtime owns scheduler start/stop and stream interval disposal. `start`
receives history and the existing achievement transition/retry and draw publish
callbacks. `expireRooms` delegates to the existing lifecycle implementation;
`cleanupRoom` disposes room-associated registries and streams, without changing
membership/permission/game rules or performing a second history transition.
Existing leave/kick and reconnect calls keep the same arguments and owners.
Failed history interruption still reports the error and removes the room.

Stream disposal removes its own subscriber and timer exactly once; an old
connection cannot delete a replacement subscriber set. Room deletion releases
intervals immediately, before the transport close event. An in-flight request
registering a stream after stop gets immediate disposal/end.

## Acquisition and release

1. Acquire data locks, then room runtime/title cache, history lock, DB and stores.
   Synchronous initialization failure unwinds all acquired closable resources
   in reverse order, retaining the original failure and any cleanup failures.
2. Bind HTTP once. Only after successful binding, and only if close has not
   started, start the room scheduler, submission recovery, market automation
   and thumbnail worker. Partial scheduler timer acquisition unwinds its timer.
3. Concurrent `listen` calls share startup. Startup failure waits for complete
   cleanup before rejecting. The raw startup promise is separate from recovery,
   preventing a close/startup wait cycle.
4. Concurrent/repeated `close` calls share one promise, including its rejection.
   Wait for raw startup, stop the scheduler, stop admitting HTTP requests, stop
   market/thumbnail work, drain room SSE, and wait for in-flight HTTP handlers.
   Retain room state and DB while handlers drain. Then finish achievement
   callbacks/retries, clear runtime/title state, close history, await submission
   work, close DB, and release data locks. Each cleanup stage is attempted even
   if an earlier stage fails; failures remain observable to every close caller.

No database/schema/history/archive format change. No route, game rule, AI policy,
chat limit, market result or UI redesign. Patch `1.23.1` reflects failure-lifecycle
fixes (same unreleased patch batch as #72); integration must combine changelog
entries rather than create an extra version bump.

## Validation and rollback

Four pre-change characterization tests reproduced early concurrent close,
listen/close startup after shutdown, startup-worker failure leaving a listener,
and stop failure leaving later resources. The same assertions pass after this
slice. Additional tests cover timer acquisition failure, real draw/music SSE
shutdown, in-flight HTTP draining, bind failure, late initialization failure,
history-close failure, concurrent startup, registry isolation/expiry, and
stream disconnect/reconnect/replacement.

See `ROOM-RUNTIME-REVIEW.md` for exact code SHA, commands, full-suite failure and
publication gate. Native Linux results cannot establish Windows CI or production
readiness. Revert this isolated slice to restore previous ownership; no data
restore is required. Re-run room/history/stream/app/data-lock checks and full
Linux/Windows CI after integration. Keep #74 open until its dependencies and all
required validation/reviews on the integrated head are satisfied.
