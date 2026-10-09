# Shared test helpers

## Isolated HTTP app fixture

`app-fixture.cjs` provides `await appFixture(t, { config, seed })` for ordinary
in-process HTTP tests. It returns `{ root, config, app, base, dispose }`.

- Each call allocates its own real temporary directory with SQLite, history,
  community and music paths; the app binds loopback on an ephemeral port.
- `config` is an object or synchronous function receiving those paths. The helper
  always owns the four data paths, host and port, disables external side effects,
  and uses an unconfigured GitHub client. Tests that need other semantics must
  retain a purpose-specific fixture rather than silently opting out of isolation.
- Optional `seed(db)` may be async. The helper awaits it and closes the setup DB
  in `finally` before creating the app. Keep user rows, synthetic payloads,
  domain clocks, API wrappers and assertions in the caller.
- Teardown is registered before configuration/seeding/startup and also runs when
  setup rejects. `dispose()` is idempotent: it awaits app shutdown (including its
  owned scheduler/streams/workers) before removing only the allocated directory.
  No cleanup assertions, global environment edits or global clock mocks are used.
- If app shutdown rejects, the error remains visible and the directory is retained
  instead of removing potentially open data. Setup plus cleanup errors are both
  reported. This is not a generic recovery mechanism for broken app shutdown.
- `appFactory` is a narrow fault-injection seam used by `app-fixture.test.js` to
  test failed startup/shutdown; normal HTTP fixtures use the real app factory.

First migrated slice (Issue #70, parent #56): `character-sound-http.test.js`,
`room-media-http.test.js`, and `market-images-http.test.js`. Existing case names,
HTTP assertions and domain-specific fixtures remain in those files. Other test
fixtures are deliberately unchanged. This helper does not manage subprocesses,
restore arbitrary caller global mutations, or replace fixture-specific promises;
callers must settle their own pending work.

Run focused checks with:

```sh
node --test tests/app-fixture.test.js tests/character-sound-http.test.js tests/room-media-http.test.js tests/market-images-http.test.js
```

Still run the unchanged complete `npm test`, including release checks. CI verifies
Linux and Windows on the pinned Node version. A focused pass is not a full pass.
Pure test infrastructure changes do not bump the product version under
`docs/RELEASE-POLICY.md`.
