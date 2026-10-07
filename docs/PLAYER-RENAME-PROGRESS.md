# 玩家改名：實作與驗收

更新：2026-10-05。來源為 `feat/party-content-and-race-paths` 本地工作樹；本批尚未提交、push、發 PR 或部署。先前 YouTube PR #36 不包含本批改名。

## 使用方式

右上角帳號選單 →「帳號與形象設定」→「我的暱稱」。輸入 1–16 字並按「儲存暱稱」。前後空白會移除，支援中文與 emoji，禁止空字串、換行與控制字元。字數依 Unicode code point 計算；不是組合字形或 JavaScript UTF-16 長度。

暱稱顯示在大廳、目前遊戲玩家名單及右上帳號資訊；登入帳號仍在設定頁與帳號按鈕提示中可見。改名不更動登入帳號、密碼、權限或 session。頭像／遊戲角色的儲存按鈕獨立，改名不會連帶保存未完成的形象草稿。

## 契約與資料規則

| 項目 | 實作 |
| --- | --- |
| API | 登入者 `POST /api/profile/name`，JSON `{ "displayName": "新的暱稱" }`；回傳與 `/api/auth/me` 相同的公開帳戶資料。 |
| 權限 | 僅使用 cookie 對應的帳戶 UUID；忽略請求中宣稱的其他 `userId`／`id`／`username`／`role`。既有同源 JSON 防護與帳戶操作上限 10 次／分鐘適用。 |
| 持久化 | 更新既有 `users.display_name`；不新增 schema、不撤銷 session，也不更動原密碼 hash。完整備份還原本來就包含此欄位。 |
| 當前房間 | 依帳戶 UUID → seat UUID 找到尚在房內的玩家，僅更新 `name`、遊戲既有版本及呈現更新時間。不改座位、房主、分數、骰子、車輛、回合、截止時間或遊戲操作。撲克沒有數值 `version`，不製造 `NaN`，既有輪詢本來就呈現玩家資料。 |
| 大廳 | 只改已存在 visitor 的名稱，不新增訪客、不續 presence、不重置路徑或表情。 |
| 共看 | 只提升已存在 watch 的 revision，讓開著的控制者／提案者名稱更新；不更動控制權、controllerEpoch、影片、時間錨點，也不建立新 watch。 |
| 已離席者 | 不改已離席／被踢者的遊戲紀錄。合法重新入座時使用持久帳戶暱稱，沿用原有復座規則及 seat UUID。 |
| 歷史與結果 | 已寫入 JSONL、已揭曉／凍結的結果及當時動作文字保留原名。改名屬外觀資料，不額外執行 `history.transact`，避免多房操作與 DB 部分失敗造成模糊回滾。之後正常記錄的遊戲快照會包含當前暱稱；身份仍以 UUID 判斷。 |
| UI 更新 | `profile-updated`、回到頁面／視窗焦點時重新讀取本人帳戶，最新請求序號隔離晚回覆；不新增定時帳戶輪詢。新增名字／錯誤訊息均使用 `textContent` 或輸入框 `value`，不插入 HTML。 |

## 已完成測試

主 agent 2026-10-05 補充：原Chrome正常3440×1271，合成房主在設定頁修改暱稱、成功ACK可見；另一帳號畫猜房間名單同步新名，之後大廳／遊戲header一致。此為本地3195隔離資料，沒有操作正式帳戶。整合數字及版本见 [整合進度](PARTY-UPGRADE-PROGRESS.md)，取代本文件末節的「Chrome待驗」現況。

Windows Node.js 24.14.0：

```text
node --test tests/auth.test.js tests/lobby.test.js tests/player-rename.test.js tests/player-rename-ui.test.js tests/profile-settings.test.js
9/9 passed
```

- Auth：空值、錯誤型別、過長與換行拒絕；16 emoji 正常保存；假冒帳戶／角色欄位不影響本人以外資料；原 session、密碼、帳號與 role 穩定；SQLite 重新開啟後仍保留。
- HTTP：畫猜、送禮、同頻、雷霆、撲克均在開始遊戲後改名，姓名更新、座位與機械狀態保持；畫猜過輪公開作品及既有歷史檔 bytes 不重写。共看名稱刷新但播放錨點／控權不變；畫猜離席後改名、復座保留 seat 與得分，舊作品名稱不變。App 重新啟動後原 cookie／密碼仍有效。另驗 16 emoji 的開房、入座與進行中離席／復座，暱稱不被 UTF-16 截斷。
- 大廳：改名不進入大廳或增加訪客，不改移動路徑／moveId，不延長 presence。
- 前端 VM：Unicode 長度、防重複送出、儲存失敗保留草稿可重試、原樣文字輸出與獨立形象儲存狀態。
- `node --check public/settings.js`、`node --check public/shared/site-header.js` 通過；當前工作樹 `git diff --check` 通過。

## 驗證界線與接續

以上原項目為實作agent的單元／VM／HTTP隔離證據；主agent之後補背景Chrome桌機表單、另一玩家名單及header／大廳暱稱驗收，最終整合Windows543項通過，來源4bab53a。此批未重跑手機實際排版或Linux全套；沒有正式站更新。詳細證據與限制見整合進度。

暱稱可重複，請勿以名字識別玩家或授權。既有歷史、投稿署名、已捕捉的擲骰參與者文字不追溯改寫；這是保留當時呈現的資訊。API 在開房／入座的歷史 callback 內，將玩家名稱套回已驗證的完整帳戶暱稱，避免原引擎 `.slice(0,16)` 截掉 emoji；不改引擎或 bot 名稱。
