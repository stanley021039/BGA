# #70–79 local integration evidence

Date: 2026-10-09. Status: **publication held**. No push, PR, main merge, tag, deployment, production-data operation, branch-protection or security-setting change was performed.

## Fixed review range

- Base and merge-base: `2a5a197094c254d4a16cdec682d441af31692c76`
- Combined executable/test head: `cfd437d0bf797b6b131ee2e53050482a43c64dfa`
- Branch: `integration/refactor-70-79-local`
- [Machine-readable manifest](BATCH-70-79-MANIFEST.json) records every issue's source base/head, imported commits, changed files and tests
- Evidence-only commits after this head do not replace its executable/test identity

## Composition and conflict resolution

Real Git cherry-picks imported committed inputs into a new isolated clone. #70 fixture, #72 requestJson and the shared optional reconnect AbortSignal helper are included once. Draw's helper commit `ce43e9b` is equivalent to `89204da`; only the latter patch was imported. #73's code and review records are both retained even though the review document was imported earlier in the local sequence. #74's final simultaneous-app regression and #74/#75 final documentation are included.

All source-code changes merged automatically. Conflicts were additive sections in PROGRAMMER/SERVER-DATA notes and CHANGELOG, resolved by preserving both sides. Both compatible fixes (#72 HTTP/cancellation semantics and #74 cleanup) share **1.23.1** under the same-unreleased-batch rule. No tag was created. app.js contains both controller allowlist additions, the lobby handler import/factory and RoomRuntime initialization/lifecycle changes. #75/#76 test harness imports coexist.

The integration-only test serves both controller files through the actual app and compares exact bytes/MIME, verifies authenticated page dependency ordering, and checks `/api/version`. Its first draft incorrectly required transport before the race-controller definition; inspection showed that definition has no eager transport call. The assertion was corrected to require both dependencies before the page entrypoint, then all 12 integration/lifecycle tests passed. No production source changed to accommodate the test.

## First pass: specification and scope

- #70: common fixture preserves test-owned seed/assertions, isolation and cleanup. Existing media-domain assertions remain; only setup moved
- #71: strict embedded teaching source check keeps byte identity except CRLF/LF normalization; no teaching runtime generation
- #72: one fetch/body read, status/code/details and cancellation semantics retained; no mutation retries or new global UI transport policy
- #73: four app-local lobby handlers extracted; auth, parsing, path/method dispatch and error handling remain in app.js
- #74: per-app registries/scheduler/SSE ownership and awaited cleanup, concurrent start/close, failures and app isolation covered
- #75/#76: synchronization and page lifetime moved behind narrow controllers; existing drawing/race presentation modules and teaching engine retained
- #77/#78: explicit per-game dispatch retained; real authenticated HTTP action/view tests and late restore receipt-failure contract added. No generic game adapter or persistent outbox introduced
- #79: operating guidance distinguishes recommendations from real configuration; no privileged setting or data operation performed
- Integration contract/operations documents were rechecked against the combined app. Five engines, DB, data transfer/locks, history and achievements directories are byte-identical to base. Schema remains 19
- Required native drawing/race visual and interaction acceptance remains **unverified**: source workers reported cloud-browser refusal of executor loopback. VM raster, HTTP and unit tests do not replace native intermediate-frame/touch/keyboard/desktop/mobile evidence

Conclusion: requested implementation slices are composed locally; acceptance is incomplete and release is blocked. This does not claim whole-site refactoring or other backlog completion.

## Second pass: quality and risk

Read the combined base→head diff and adjacent dispatch/lifecycle/controller call chains. Verified the two static-resource additions coexist, page scripts load their dependencies, requestJson/reconnect cancellation helpers are not duplicated, per-app resource ownership is isolated, and stale controller work is fenced after cancellation. Reviewed shutdown ordering (stop admission/workers, drain streams/requests, finish pending work, close DB and release locks), failure aggregation, source invariance, and assertion-preserving harness changes.

No integration-specific production change was necessary, and no unresolved code defect was found in these inspected paths. This is limited review, not a guarantee: genuine browser rendering and native OS/platform behavior are not proven. Existing full-suite failure remains a blocker despite reproducing unchanged on main.

No credentials, private configuration or runtime data were added; test fixtures use synthetic accounts and new temporary directories with external service effects disabled. Source excerpts mentioning environment-variable names are not credential values.

## Verification

Environment: Linux executor, Node v24.19.0 / npm 11.9.0. No OS network-interface stub, skip, changed assertion expectation or production fallback was used to bypass the known failure. Windows and remote CI have not run on this local head.

- Initial npm ci failed because its default cache path `/home/agent/.npm` was unavailable. Retry with a writable, task-owned `/tmp` cache succeeded; `--ignore-scripts` was explicit
- Fresh main `npm test`: **1,827/1,828**, one native `/api/info` failure, zero skipped/cancelled
- First combined run before final additional tests: **1,913/1,914**, same sole failure, zero skipped/cancelled
- Initial focused integration: **73/73**
- Final supplemental lifecycle/static integration checks: **12/12**
- Final frozen-head `npm test`: **1,915/1,916**, the same sole `/api/info` failure; zero skipped/cancelled/todo
- Final broad focused selection: **542/542**, zero skipped/cancelled/todo
- `npm run release:check -- --base 2a5a197094c254d4a16cdec682d441af31692c76 --type patch`: passed
- Strict teaching source checker, changed JavaScript syntax checks and `git diff --check`: passed
- Direct native `os.networkInterfaces()` independently throws `ERR_SYSTEM_ERROR` / `uv_interface_addresses`, matching the failing HTTP path

The exact broad focused command and numerical results are also in the manifest.

Local evidence logs are retained alongside the checkout: bga-integration-baseline-full.log, bga-integration-full.log, bga-integration-final-full.log, bga-integration-final-focused.log, bga-integration-additions-final.log, bga-integration-native-os.log and npm-ci logs. They are local validation artifacts, not published CI.

## Remaining gate

Hold all publication. Run the unchanged full suite on a supported environment with working native OS networking, complete required genuine browser acceptance on the combined code, and review any new failure before considering publication. Branch-protection setup remains a separately pending step and was not changed by this batch.

## Independent combined review

A separate reviewer read the official #70–79 requirements, inspected the same base/head range and independently ran 49/49 transport/controller/source/static checks plus 22/22 app/runtime/lobby checks, the strict teaching check and whitespace checks. All 71 tests passed with no skips/cancellations. It found an isolated-#72 sentence that could imply the controllers stayed unchanged in the combined batch; the evidence-only documentation update qualifies that sentence. Final independent conclusion: no confirmed new runtime regression or additional code fix requested. The scope matches local composition, while #75/#76 real-browser acceptance, native full-suite and Windows/final-head CI gates remain unpassed. No production-source edit followed the frozen code head.


## 2026-10-09 Windows local handoff verification

2026-10-09 本地接手：bundle SHA256、完整歷史、HEAD f5080e4904d004affd78ac9fd5aa53c5682dae2f、tree 4742535214385d144ed680c8a28703f3875a4773 與 base 2a5a197094c254d4a16cdec682d441af31692c76 已核對。遠端 main 仍等於此 base。使用者授權匯入、設定及推送新分支 codex/refactor-70-79-20261009。Windows 隔離 Node 22.23.3／npm 10.9.9 原生 networkInterfaces 正常，npm test 1916/1916、fail/skip/cancel 0、exit 0；npm ci、patch release check、教學來源及 diff check 通過。Node 26.2.0／npm 11.13.0 診斷全套 1915/1916、exit 1，schema 3 restore 測試 HTTP fetch 遇 bad port；根因未確認，不視為通過。測試僅用合成／隔離資料。本輪未執行真瀏覽器矩陣、遠端 CI、PR、tag、main 合併或部署；HOLD 保留，Node22 通過不取代 UI 驗收。

Commands: `npm ci`; `npm run release:check -- --base 2a5a197094c254d4a16cdec682d441af31692c76 --type patch`; `node tools/check-race-teaching.cjs`; `git diff --check 2a5a197094c254d4a16cdec682d441af31692c76 HEAD`; `npm test` under each stated runtime. Node22 duration 143599 ms, Node26 duration 196983 ms. Logs retained outside the checkout; no raw private logs committed. This update changes evidence only.


## 2026-10-09 Browser and CI acceptance increment

2026-10-09 驗收增量（base 2a5a197、受驗 head d610186）：Draft PR #82 已建立，CI run 37879539800 的 Linux／Windows Node22 jobs 均 success；本地 app/runtime/controller focused 41/41。內建瀏覽器完成有限兩席畫猜同步／倒數／返回及賽跑擲骰／三步移動鎖／返回／教學切章重試。手機 viewport 設定未生效，仍1280×720，不能算手機驗收；Chrome fallback 因工具無法可靠辨識網址而中止。使用者明確回覆沒有觸控設備，真實觸控與旋轉先記待驗，未豁免門檻。詳細矩陣見 [本地驗收](BATCH-70-79-LOCAL-ACCEPTANCE.md)。本筆取代先前「沒有PR／CI／真瀏覽器操作」現況；完整UI矩陣與最終兩輪審查仍未完成，保持Draft／HOLD。
