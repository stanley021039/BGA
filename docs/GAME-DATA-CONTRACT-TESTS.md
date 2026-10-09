# 遊戲與備份契約測試切片（#78）

## 範圍與相依

2026-10-09，本地候選；未發布、未部署。對照 [#77 契約矩陣](GAME-DATA-CONTRACTS.md)，只補兩個缺口，不改 runtime、schema 19、`afterhours-encrypted-data-v1`、manifest、遊戲規則或版號。

- 原 main：`2a5a197094c254d4a16cdec682d441af31692c76`
- #77 文件前置：`18d8ac314109f6697df45cc52f9a00c1788b439c`
- #70 helper 原提交：`1a16ec6853f30696f4abe1bfec30f3baf2fa96da`；此本地 stack 的 cherry-pick：`374f00988098c8659da7f93ec50c0083b5b87e54`
- 本切片相對上述 stack 只增加測試及文件。沒有修改 `app.js`／room ownership；#73/#74 接線整合後仍須重跑，不宣稱已驗其他候選分支

維持 explicit dispatch：poker 的 scalar amount 與 thunder 的完整 object 都由 `humanAct` 記帳，其餘三款由 `act` 解讀各自 payload。通用 adapter 沒有需要解決的重複邊界，反而會新增介面與例外處理，因此不新增 adapter。

## 已鎖定的缺口

`tests/game-boundary-contract.test.js` 使用 #70 `appFixture`、真 SQLite／認證／loopback HTTP／history／scheduler。三個合成帳號使用相同顯示名稱，仍須保留不同 seat。重連、state viewer 及 action 都不採信 request 的 `id`／`playerId`／`actor`。

透明 method observer 呼叫原 engine 方法後，只讀取參數及真人記帳結果；不替代規則、不直接配置 room 私有狀態、不 mock OS API。每個案例保留遊戲差異：

| 遊戲 | 動作與身份 | 私密投影 |
| --- | --- | --- |
| poker | 真 raise 的數值 amount、拒絕錯誤回合、`humanAct` 的 `handDecision` | 自己兩張牌可見、其餘為 null |
| thunder | 真 scheduler reveal、acceptDice 的 check、begin 的 car/die；round acceptance 不算真人回合，begin 才記帳 | round dice／roadDie／turn／first 遮罩；接受後骰子公開；未翻 hazard 為 unknown |
| majority | draw／ask／answer 的 object 與已登入 seat；冒充出題者失敗 | 候選僅出題者、各自 ownAnswer、answers 缺省、groups 空及 result null |
| gift | give／wish 的 assignments/ranking 綁已登入 seat | 兩位 viewer 各見自己的選擇；只公開 submitted IDs，沒有完整 assignments/rankings 或過早 result |
| draw | choose／guess 的 questionId/answer 綁已登入 seat；冒充畫者失敗 | 候選／題目只給畫者；猜錯記錄保持實際猜題 seat，觀看者仍不知道答案 |

共同斷言只禁止 `secret`、`lastSeen` 和內部 achievement hook/unit 欄位，沒有把所有 account UUID、合法公開骰子或已揭露歷史答案一律刪除。

`tests/data-transfer.test.js` 的新 receipt-write ENOSPC 案例：

1. 真加密包包含合成帳號、圖片／音效 BLOB、music、community 及完成的 history
2. 確認 db/history/community/music 四個 rename 已完成，receipt 寫入失敗才回 `PARTIAL_RESTORE`
3. marker 與 publication lock 都保留，`createApp` 以 `RESTORE_IN_PROGRESS` 拒啟動；不把半成品目錄當成功
4. source validation summary、所有已驗證來源檔案的 SHA-256 與 origin identity bytes 保持；owned staging 清除
5. 另選全新 destination 成功產生 receipt，只移除該次 fences；前一失敗代的 marker/lock bytes 不變，仍不可啟動

現有 history-rename、marker-write、pre-marker-gap 測試保留，沒有重新複製。schema-forks、舊備份與未來 schema 拒絕、FK/integrity、migration rollback 及 identity/BLOB 保全沿用既有 coverage 並重跑；沒有以提高版本號或放寬 validator 避開分支。

## 驗證與限制

環境：Linux x86_64、Node v24.19.0、npm 11.9.0。隔離合成資料，外部副作用關閉。

- `npm ci --cache <本輪獨立暫存目錄>`：成功，12 packages
- `npm run release:check`、兩個測試檔 `node --check`、`git diff --check`：通過
- 修改前 data-transfer/schema-forks/achievement-migration/history-failed-start：88/88，fail/skip/cancel 0
- 新 HTTP 案例：5/5；新 receipt 案例：1/1
- 聚焦回歸：147/147，fail/skip/cancel 0（恢復 mutation 後重跑）
- 未修改完整 `npm test`：前置 stack 1834 pass / 1 fail（共 1835）；本切片 1840 pass / 1 fail（共 1841），兩者 skip/cancel 0。唯一相同失敗為 `web-features.test.js` 首次 `/api/info` 回 500，預期 200；本環境 `os.networkInterfaces()` 直接回 `ERR_SYSTEM_ERROR`／`uv_interface_addresses` 錯誤。新增六項測試皆通過，沒有新增完整套件失敗，但此結果仍是全套失敗，保持未推送

```sh
node --test tests/game-boundary-contract.test.js tests/data-transfer.test.js tests/schema-forks.test.js tests/achievement-migration.test.js tests/history-failed-start.test.js tests/engine.test.js tests/thunder.test.js tests/majority.test.js tests/gift.test.js tests/draw-guess.test.js
npm test
```

可逆故障注入每次只修改一個邊界，執行原測試後恢復來源。已確認以下 15 個 mutation 全部得到預期失敗（不是 clean pass）：poker scalar 改 object、poker/thunder 繞過 humanAct、三款 object 改 amount、三款採信 forged actor、poker 洩漏手牌、thunder 洩漏 round dice、majority 洩漏 answers、gift 回傳別席 ranking、draw 洩漏 question、poker 洩漏 secret、失敗後移除 publication fence、receipt 前移除 marker、receipt 前未搬完四個目錄、遺漏 owned staging cleanup、合成來源 JSON 只改 bytes 而維持相同驗證 summary。恢復後重跑 clean tests，runtime diff 必須為空。

仍未涵蓋每個 phase × viewer × kick/rejoin 組合、全體合法 action payload、跨程序 achievement pending 恢復、真斷電、所有 OS 原生 I/O 故障、Windows 本機／CI。此切片沒有 UI 改動，沒有以新 HTTP 測試取代畫面或動畫驗收。

完整檢查失敗或環境阻礙時保持未推送，不以 skip、OS stub 或只跑 focused suite 當全套成功。回退此測試／文件切片不需要資料 restore。
