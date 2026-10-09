# 遊戲與資料相容契約盤點

## 範圍與決定

對應 #77，供 #78 的 test-first 切片使用。**目前實作**固定於 `2a5a197094c254d4a16cdec682d441af31692c76`（package 1.23.0、schema 19）；下列固定 SHA 連結是程式／測試證據，不表示本文件重新執行所有測試、已部署或涵蓋所有平台。這次只改文件，不改 engine、schema、backup FORMAT 或遊戲規則。[APP] [DB] [PACKAGE]

**決定：先保留 explicit dispatch。** 五款只共享少量方法名稱，加入時機、action 的第三參數、真人動作記帳、遮罩及結束單位都不同。建立通用 adapter 會增加新契約，沒有本票需要解決的實際呼叫端重複。#78 先補跨遊戲契約測試，不新增空 adapter 或持久化框架。#73／#74 若移動 app 接線，應在整合後重核下列 create、dispatch、identity、history 呼叫鏈，不沿用行號當完成證據。[APP] [SCHEDULER] [LIFECYCLE]

## 遊戲能力矩陣（目前實作）

每格描述 engine 與 HTTP 接線的差異。所有 create 都由 `/api/create` 明確選 class、安裝 provider、attach history／achievement hooks，再以 history transaction 加入建立者；公開 game key 為 `room.type || 'poker'`。除 thunder 外需有測試 AI capability。不可把 poker 缺 `type` 改成未知遊戲。[APP]

| game / class / create provider | add / start | 玩家 action 接線 | timed transition | leave / kick | history 結束 |
| --- | --- | --- | --- | --- | --- |
| poker / `Room`，無 provider | 最多 6 席；局中加入先 folded；waiting/showdown 至少 2 位有籌碼才 start | `humanAct(id, action, amount)`，第三參數是數值；rebuy 僅 waiting/showdown 且 stack≤0 | scheduler 依 botAt/deadline 做 check/call/fold；真人逾時不自動 call | waiting/showdown 移除；進行中 kicked+bot 接手 | 每手 showdown；不是其他遊戲的 finished [POKER] [ENGINE-TEST] |
| thunder / `ThunderRoom`，無 provider | 僅 waiting 可 add、最多 4 隊；waiting/finished 至少 2 隊 start | `humanAct(id, action, data)`；保留真人回合資格記帳 | rolling 到 readyAt 先 advanceDice；其餘 actor 的 bot/timeout→auto | waiting 移除；開始後 kicked+bot 接手（也適用待擲骰） | finished race [THUNDER] [THUNDER-TEST] [DICE-TEST] |
| majority / `MajorityRoom`，questionProvider | 最多 12；局中加入 waitingForNextRound；waiting/finished，3–12 人 start | `act(id, action, data)`；出題、答題、review 合併／計分等權限由 engine 決定 | answering deadline→auto；choosing/review/reveal 不套 poker timeout | waiting 移除，其餘標 kicked；調整出題者、答案與分組，少於 2 人提前 finished | finished match；成就另按每 round [MAJORITY] [MAJORITY-TEST] |
| gift / `GiftRoom`，giftProvider | waiting/finished 可 add、最多 8；3–8 人 start | `act(id, action, data)`：give/wish/accept/next | 無真人通用 deadline；測試 AI 可推進，scheduler 不強制 auto | waiting 移除，其餘標 kicked；delivery 次序修正，少於 3 人提前 finished | finished match；成就另按完整送禮 round [GIFT] [GIFT-TEST] |
| draw / `DrawGuessRoom`，wordProvider/exclusion/ban writer | 最多 8；局中加入等下輪；waiting/finished，2–8 人 start | `act(id, action, data)`：choose/guess/next；stroke/command/result 是獨立 route | choosing/drawing/reveal deadline；畫者離線 >15 秒亦推進，正常／中斷資格不同 | waiting 移除，其餘標 kicked；畫者離開 reveal/interrupted，少於 2 人 finish | finished match；成就另按 round [DRAW] [DRAW-TEST] |

scheduler 的遊戲自動動作經 history transaction，先檢查 recorder pause；majority/draw timeout 在 AI 前及 AI 例外後檢查。`finally` 執行 achievement transition，sweep 重試 pending。400ms 是排程輪詢間隔，不是每款遊戲的規則期限。[SCHEDULER] [AI]

離席共通邊界：剩餘真人存在時 host 先轉交，再以 `kick(..., leaving=true)` 保留 engine 差異；最後真人離席刪房。90 秒無真人 lease 的空房及 24 小時 idle 房會中斷 history 並清理。HTTP kick 另要求 confirmed、房間角色權限，將被踢帳號移出 seats、記入 kickedUsers，關 SSE；這些不是 engine `kick` 自己提供的 account 授權。[APP] [LIFECYCLE] [MEMBERSHIP]

## view 與 identity（目前實作）

| game | 公開／私密界線 | 已有測試與剩餘邊界 |
| --- | --- | --- |
| poker | 自己 hole cards 可見；他人為 null。showdown 僅非 folded 且至少 2 位未 fold 時揭露；玩家 secret 不輸出 | 初始 private cards 與局中加入有斷言；不同收尾與每位 viewer 的完整矩陣仍值得補 [POKER] [ENGINE-TEST] |
| thunder | 不輸出 secret/lastSeen；未翻 hazard 為 unknown，damage 只剩布林；round dice check 隱藏骰子、roadDie、first/turn；其他檢定依其 reveal 規則 | hidden state、翻 hazard、round dice 協議已有測試；不要把「所有 dice 永遠私密」寫成共通斷言 [THUNDER] [THUNDER-TEST] [DICE-TEST] |
| majority | choosing candidates 只給 presenter；answering 只 ownAnswer，groups 空、answers 缺省；review/reveal/finished 才可見 answers/groups，result 僅 reveal/finished；ownQueue 僅自己 | 候選、鎖答、填空 review 已覆蓋；公開 account mapping/history 序列化測試目前代表款是 majority [MAJORITY] [MAJORITY-TEST] [ACH-MIGRATION] |
| gift | ownAssignments/ownRanking 僅自己；choosing 只公開提交者 ID；delivering 只公開當前 recipient 的 entries；result 僅 reveal/finished | engine 與 authenticated HTTP 隱藏選擇已有覆蓋 [GIFT] [GIFT-TEST] |
| draw | candidates 只當輪 presenter；題目/aliases 只畫者或相同 canvasEpoch 的 reveal/finished；猜對紀錄不帶答案文字，猜錯文字可見；已公布 recentResults 是刻意公開 | 選題、猜題、HTTP 及跨輪公開結果已有覆蓋；不能全面刪除歷史答案當遮罩 [DRAW] [DRAW-TEST] [DRAW-RESULTS] |

`seats: Map<roomCode, Map<user.id, player.id>>` 才是 HTTP account→seat 的真實對照，不能信任 request 帶的 playerId 充當 actor，也不能以 display_name／avatar 配對。重連以登入帳號取回 seat。建立／加入會把顯示名稱設回 account 的 display_name。engine seat ID 與 canonical account UUID 不可混用。[APP] [RECONNECT] [ACCOUNT-NAME]

成就於單位開始凍結真人 account/seat 對照，只納入存在、啟用、非 bot／kicked 帳號；majority/gift/draw 逐席檢查有效／不重複映射，bot 不需映射但不領獎。遺漏真人映射使原應正常完成者改 interrupted。allSame 以全部實際作答席（含 AI）檢查完整分組，授獎條件仍依真人資格。內部 hooks/units 非 enumerable，不應序列化至 engine view 或 history。[APP] [MAJORITY] [GIFT] [DRAW] [ACH-ENGINES] [ACH-MIGRATION]

注意：這是「不洩漏私有成就映射」，不是承諾所有 API 不含任何 account UUID；app 的 avatar URL 等公開投影仍可帶帳號識別。[APP]

## history 與成就故障契約（目前實作）

- HistoryStore 先寫 intent，再跑 engine，最後寫 result/meta。它不是可回滾的遊戲 transaction：result fsync 失敗時，遊戲動作可能已套用，recorder 會 pause，不能宣稱動作沒發生。header/intent 前失敗可維持 engine 未變；quota 是限時 block。被拒 start 需 interrupted、可淘汰，不能佔用 active match 或沿用舊 winner。[HISTORY] [FAILED-START]
- history snapshot 排除 secret/lastSeen/function，但完整遊戲狀態與 engine source 存於 archive；讀取 playing archive 被拒。不能拿未遮罩 snapshot 當公開 `view`。獨立 draw stroke/command 沒有經這段通用 history transaction，不因 method 名同為 mutation 就聲稱完整一致。[HISTORY] [APP]
- recorder 不可寫時仍允許離席，避免困住玩家；標記 unrecorded、回 `historyPersisted:false`/warning，剩餘房間保持暫停，不重跑已套用的 leave。[APP] [LIFECYCLE] [HISTORY]
- poker 是 hand、thunder 是 race；majority/gift/draw 是正常完成 round，不能以每次 HTTP action、整局 finished 或所有參與者一律授獎替代。收據、progress、badge 在 SQLite transaction 一起寫；同 event ID/fingerprint 是 duplicate，不同 facts 或重複單位 identity 是 conflict。[ACH-STORE] [ACH-UNITS] [ACH-ENGINES]
- engine pending snapshot 只有成功提交才 acknowledge；app pending Map 在同程序內、即使房間刪除仍可重試，state/transition/sweep/shutdown 有收集或重試入口。majority/gift/draw 各 room 256 pending 的 capacity guard，app 4096 pending 阻止新 start。這不是跨程序 durable outbox；未提交 RAM pending 在程序崩潰仍可能遺失，不在本票補持久佇列。[APP] [MAJORITY] [GIFT] [DRAW] [ACH-RETRY]

## schema / backup 相容矩陣（目前實作）

| 輸入／條件 | 接受與拒絕界線 | 固定證據 |
| --- | --- | --- |
| 空新 DB / 備份 DB 1–13 | openDatabase 可建新 DB；transfer 僅 schema 1–19。1–13 合成 legacy 備份逐版 restore；13 分支須有 ban 或完整 market family，不能接受部分表 | [DB] [VALIDATION] [TRANSFER-TEST] |
| 歷史 14–16 | 14 必須 ban 且有 sound 或完整 market；15 起 sound+market+ban，16 起 images。驗真實 columns/FK/index/CHECK，空表也不能偽造；migration 只增允許的空 BLOB 表 | [DB] [TRANSFER-TEST] |
| achievement17 / market17 / market18 | 17 依完整 feature shape 判定，不以較大版本勝出；18 要完整 automation+curve，achievement 可尚未存在；三支升到共同 19 保留原 rows/badge dates | [DB] [FORKS] |
| 當前 19 | 必須完整 achievement、automation、curve 與先前 families；缺表／partial／weak CHECK 拒絕，不能靜默修復 | [DB] [FORKS] [ACH-MIGRATION] |
| 未來版 / 不相容 bundle | DB >19 拒絕；manifest maximumSchema >19 或非既定 FORMAT 拒絕；未提供 downgrade | [DB] [TRANSFER] [TRANSFER-TEST] |
| migration 原子性 | 外層 BEGIN IMMEDIATE，晚期錯誤 rollback rows/layout/user_version；feature 驗證前後與 FK 檢查保留 | [DB] [FORKS] |
| database 完整性／帳號／BLOB | integrity_check、foreign_key_check、語意 validator；restore 比對 users count/accounts digest、achievement digest（若來源有）、既有 BLOB digests/image metadata；新增 BLOB 表須已知 migration 且為空 | [VALIDATION] [TRANSFER] [TRANSFER-TEST] [ACH-MIGRATION] |
| manifest / code / assets identity | FORMAT=`afterhours-encrypted-data-v1`；manifest HMAC、payload AES-GCM/hash/size/path 白名單；記錄 code commit/dirty/Node/maximumSchema；要求 assetsSha256 相同，並非強制 code commit 完全相同 | [TRANSFER] [TRANSFER-TEST] |
| 舊 achievement digest | 只有 authenticated pre17 producer+DB 或歷史 market17/18 且無 unit tables 的限定條件可省略；當前 producer 即使打包舊 DB 也需 digest | [TRANSFER] [FORKS] [ACH-MIGRATION] |
| origin / bundle identity | 保留 origin envId/dataInstanceId；restore 新代寫 receipt 與 data-instance；可選 expectedBundleId 防同路徑換包（UI 帶入，CLI 仍非強制） | [TRANSFER] [TRANSFER-TEST] [TRANSFER-DOC] |
| restore 政策 | sessions/invites/password_resets 清除；pending/sending submissions→needs_review；回傳 boot config 關閉 external effects；credentials/account UUID 保留，不含部署 secrets | [TRANSFER] [TRANSFER-TEST] |
| 冷匯出／writer locks | sourceStopped=true 之外仍取得 DB/history/community/music 及 legacy history lock；已有鎖不自動搶回，即使 PID 已死 | [LOCKS] [TRANSFER] [LOCK-TEST] [TRANSFER-TEST] |
| 新代發布／失敗／暫存 | staging 解密/驗證/遷移/政策/再驗證；dry-run 不發布。apply 只允許不存在的 destination，publish lock+marker 擋啟動，完成才移除；失敗後可能留下半成品目錄但不能成為可啟動代，不是「任何失敗都無目錄」 | [TRANSFER] [LOCKS] [TRANSFER-TEST] |
| unfinished history / live room | 需明確 acknowledge 才記 interrupted；保留 archive 不等於續玩。記憶體 rooms、部署設定不在完整資料包；啟動後歷史保留策略仍會淘汰 | [TRANSFER] [VALIDATION] [TRANSFER-DOC] [HISTORY] |

此矩陣不允許只比較 schema 數字後覆蓋資料、不允許在舊目的地合併或原地 restore。跨 DB、history、community、music 的發布不是單一 SQLite transaction；可用性由新代 fence 保證。Windows 不提供此 Node 路徑的 directory fsync，不能宣稱真斷電測試已完成。[TRANSFER] [LOCKS]

## #53 歷史差異核對

`9b0df7145deb0e18c7febd159eda05106ae5c01c` 是 #53 merge，第二 parent `358db8f65b73469eafe02579c7054b69773b57fa`；該 merge 是本盤點 base 的 ancestor。因此 #53 文字中的「未合併／Draft」是當時狀態，不能作為現在缺漏清單。[MERGE53]

已整合：shape-based schema19 migration、late failure rollback、歷史 market bundle 缺 unit digest 的限定相容、AI stroke publication／deadline precedence、achievement transition/sweep retry、真人＋AI 的映射與 allSame 修正。直接依目前檔案／測試確認，不只是 merge 標題。[DB] [FORKS] [TRANSFER] [SCHEDULER] [APP] [ACH-ENGINES]

尚未在這些邊界實作：跨程序 persistent achievement outbox、以 restore 復活記憶體房間、通用 game adapter；本票不把它們包裝成已完成。此處也不由 #53 推論永久勝場或其他 UI backlog 完成，更不推論目前部署狀態。[APP] [TRANSFER] [ACH-STORE]

## #78 最小 test-first 切片（原提案）

2026-10-09 更新：下列窄切片已有本地測試候選；實際範圍、相依、故障注入與驗證限制見 [#78 測試證據](GAME-DATA-CONTRACT-TESTS.md)。下文保留原規劃，不代表其他候選接線或發布驗收已完成。

現有測試已廣泛覆蓋各 engine view、legacy schema、future schema、FK/identity/BLOB、鎖與部分發布失敗。不要複製整套測試。選以下兩個窄缺口：

1. `tests/game-boundary-contract.test.js`：沿用 #70 最終 HTTP fixture，以實際 `/api/action`→state 建立小型 table-driven case。驗 poker amount 仍為 scalar 且走 humanAct；thunder 傳完整 object 且走 humanAct；majority/gift/draw 走 act。不要抽換 engine 行為，觀察真實合法動作及真人資格。每款使用自己合法 phase，交叉兩位 viewer 檢查 secret 不出現與上述專屬遮罩；同名帳號、偽造 request actor 不可改 authenticated seat。若 #73/#74 尚未整合，先只做 engine projection tests，HTTP 接線測試等重新 baseline，不改 app.js。
2. `tests/data-transfer.test.js`：現有 rename-to-history、marker write 與 publication gap 已注入失敗；補 **receipt 寫入失敗（四個資料目錄已搬完）** 的晚期切片，assert PARTIAL_RESTORE、marker/fence 保留、createApp 拒絕新代、source digest 未變、owned staging 清理；另選 fresh destination 成功時只移除該次 fence，失敗代的 fence 仍保留。這只擴展現有 fixture，不改 FORMAT/schema，也不自動清理失敗代。必要時補 releasePublication 的失敗分支斷言，不新增管理工具。[TRANSFER-TEST] [TRANSFER] [LOCKS]

前置／驗收：#70 helper 合併版本先核實；本 base 尚無該 HTTP helper。對每個新斷言做可逆 fault injection（例如私密字段漏出、錯誤 action 接線、移除失敗 fence），確認測試真的 fail，再恢復正確實作並重跑。回報 mutation fail 與 clean pass 分開；原 tests 的存在只證明 coverage 意圖，不代替執行結果。schema-forks、achievement-migration、history-failed-start 保持 focused 回歸；未發現需要改 runtime 的重複邊界時，就以契約測試完成 #78。[FORKS] [ACH-MIGRATION] [FAILED-START]

仍未完整覆蓋：每種 phase×viewer×kick/rejoin 的組合、跨程序 pending 恢復（功能未實作）、真斷電／多主機磁碟一致性及所有 OS 原生 I/O 故障。新增小切片不等於這些已通過。發佈門檻依 issue 與 [PR 審查指南](PR-REVIEW.md)；純文件不升版。[RELEASE]

[APP]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/app.js
[DB]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/db/index.js
[PACKAGE]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/package.json
[SCHEDULER]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/rooms/scheduler.js
[LIFECYCLE]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/rooms/lifecycle.js
[MEMBERSHIP]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/rooms/membership.js
[POKER]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/games/poker.js
[THUNDER]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/games/thunder.js
[MAJORITY]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/games/majority.js
[GIFT]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/games/gift.js
[DRAW]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/games/draw-guess.js
[ENGINE-TEST]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/engine.test.js
[THUNDER-TEST]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/thunder.test.js
[DICE-TEST]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/race-dice-protocol.test.js
[MAJORITY-TEST]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/majority.test.js
[GIFT-TEST]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/gift.test.js
[DRAW-TEST]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/draw-guess.test.js
[DRAW-RESULTS]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/draw-public-results.test.js
[ACH-MIGRATION]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/achievement-migration.test.js
[ACH-ENGINES]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/achievement-unit-engines.test.js
[ACH-STORE]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/achievements/store.js
[ACH-UNITS]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/achievements/units.js
[ACH-RETRY]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/achievement-pending-retry.test.js
[RECONNECT]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/rooms/reconnect.js
[ACCOUNT-NAME]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/room-account-name.test.js
[HISTORY]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/history/store.js
[FAILED-START]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/history-failed-start.test.js
[VALIDATION]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/data/validation.js
[TRANSFER]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/data/transfer.js
[TRANSFER-TEST]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/data-transfer.test.js
[TRANSFER-DOC]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/docs/SERVER-DATA-TRANSFER.md
[FORKS]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/schema-forks.test.js
[LOCKS]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/data/locks.js
[LOCK-TEST]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/tests/data-locks.test.js
[RELEASE]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/docs/RELEASE-POLICY.md
[MERGE53]: https://github.com/stanley021039/BGA/commit/9b0df7145deb0e18c7febd159eda05106ae5c01c
[AI]: https://github.com/stanley021039/BGA/blob/2a5a197094c254d4a16cdec682d441af31692c76/src/ai/index.js
