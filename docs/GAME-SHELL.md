# 遊戲共用介面與個別遊戲畫面

五款遊戲共用 `public/shared/game-shell.js`、`game-shell.css`、`ui-components.js` 與最後載入的 `ui-foundation.css`。共用區塊提供玩家角色、文字／emoji 彈幕、狀態回饋及房間工具。`room-host.js` 在狀態更新時呼叫 `GameShell.update(state)`；重連及請求仍由原共用模組處理。各自玩法仍留在 `app.js`、`race.js`、`majority.js`、`gift.js`、`draw.js`。

共用層只讀取各遊戲回傳的標準欄位：`code`、`phase`、`me`、`players`。操作提示依遊戲適配：撲克用 `turn` 玩家索引；末路狂飆用 `actor` 玩家 ID；同頻俱樂部用 `presenterId` 與 `phase`；送禮達人用 `phase` 及本階段 `submittedIds` 提示自己是否已送出。遊戲特有回合規則不放入共用層。

`POST /api/social` 接收同房已入座會員的 `kind: expression` 角色表情、`kind: barrage` 文字、`kind: emoji` 白名單 emoji。文字限 1–40 字，伺服器檢查登入、座位及傳送間隔；最近八秒彈幕隨狀態更新顯示，不永久存入留言板／GitHub。角色表情仍只切換玩家圖片約五秒，emoji 不修改角色或頭像。舊版 `kind: message` 暫留相容，新介面無入口。離房呼叫 `/api/leave`、清除本房重連記錄再返回大廳；最後人類離開刪房，斷線寬限由既有後端處理。

沒有瀏覽器本機房間紀錄時，四款遊戲頁可憑登入帳號與房號呼叫 `POST /api/reconnect` 找回座位。既有頁面斷線後會持續輪詢並顯示重連狀態；被踢出的玩家不能透過此 API 恢復座位。自訂表情圖片的名稱隨角色選項提供，表情按鈕及角色提示使用該名稱。

頁面配置參考 [Board Game Arena](https://zh.boardgamearena.com/)「在瀏覽器遊玩多種桌遊」的產品方向，採專案自行設計的共用側欄與遊戲獨立舞台，沒有複製其介面或素材。

## 桌機合約（2026-10-04）

遊戲 HTML 提供靜態右側欄與 `.game-action-slot[data-game-action-slot]`，遊戲自行 render 主操作及進度；共用 shell 只掛載一次，不搬 runtime button。有 slot 時不搬畫猜 `guessChat`／`guessForm`；復用静態 `.race-controls`，不重建 dashboard。舊頁維持相容掛載。

右側欄底部為文字＋emoji、固定一行 status、角色／離房／管理 utility row。角色 details 按需展開，仍使用原角色 API；重要操作保留短字及完整可及名稱。utility row 在布局內，不覆蓋 submit。主操作 slot 有自己的狀態時隱藏重複的 `shared-turn`；舊頁仍保留共用輪次。對局歷史保留在網站導覽，避免側欄重複。

`#shared-emote-toggle` 開啟 `#shared-emoji-picker` 時焦點到第一個 emoji；選取成功或 Escape 返入口，外部點擊保留新目標焦點。角色與 emoji 選單互斥。社交傳送有可見 pending、disabled、aria-busy；失敗保 draft，成功僅清本次送出的文字。原 reduced-motion 可讀時間保留。

同來源 `/gifts`、`/draw-words`、`/community` 在具標題的原生題庫 dialog 中開啟，保留原存取權限；Escape／關閉返 trigger。房主管理 dialogs 亦有標題。詳見 [UI 元件合約](UI-COMPONENTS.md) 及 [桌機設計規格](DESKTOP-DESIGN-SPEC.md)。
