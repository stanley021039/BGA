# CEO／運動員接入最新共用場景

2026-10-24，使用者要求拉取最新版本並將兩款遊戲套用最新介面。沿用 #226／#227 與 `codex/second-wind-227`，整合 main `b7e62ef6fc1f5d096a5bb995731bda37c292936c`（#242 共用場景、#243 舊前端清理、#244 傳情畫意修正）。原候選提交為 `5400891`。目前為 2.44.0 人工驗收候選，取代這兩款遊戲先前 2.43.0 的候選版號；正式 main 的 2.43.0／2.43.1 歷史完整保留。

## 套用範圍

- CEO、Second Wind 的既有 `GameRoomPage` 直接繼承 main 的 `RoomSceneLayout`：共用背景人物、左右 32px 收合邊框、桌機側欄、手機互斥抽屜及焦點／inert。
- 共用背景提供 Q／E、R、WASD／方向鍵、角色表情、攻擊及倒地墓碑。活著人物不顯示血條／生命數字，與最新 main 一致。背景檢視可隱藏介面及 Esc 恢復；原遊戲專注模式保留。
- 保留兩款遊戲的共用等待室 flow、設定／開始列、私人資料、既有操作與 Second Wind 全部 91 份原版 WebP。沒有複製快捷鍵／背景／側欄邏輯，沒有改兩款遊戲引擎。
- `src/app.js` 合併後的通用 roomSpace 投影與授權路由自然涵蓋新遊戲；新增兩款真 HTTP 場景權限回歸，與原十一款分開 fixture，避免快速建桌碰到正常限流。
- 合併衝突只發生於版本／CHANGELOG 與三份共用說明；保留兩邊有效內容，使用 release 工具從 main 2.43.1 升為 2.44.0。畫猜、郎中、傳情畫意相對 main 沒有本批額外改動，不回退 main 最新的圖像與畫布修正。Figma 依使用者先前決定暫放。

## 驗證

真 Edge：運動員三席完整四場、桌機 1920×1080／390×844／320×844、深淺色與專注／Esc 共 38 項；CEO 完整結算、股票實際操作、503 後同筆重試、重載、最後一輪與同樣斷點／深淺色共 24 項，均通過、pageerror 0。另兩款等待室共 14 項場景操作：六組斷點／主題各自操作左右面板，桌機中央幾何不變，手機抽屜 inert／Esc、背景檢視／Esc、R／W／Q／E 及原專注模式通過，scene request 不改等待局的 game／phase。此項沒有宣稱在每個遊戲特殊階段重跑所有鍵盤組合。

前端 117/117，含兩款選角／計分契約與共用場景、側欄表面、血量顯示回歸；兩組真 HTTP 場景測試通過，涵蓋十三款、未登入／旁觀者拒絕、移動／瞬移、Q／E 共用授權且遊戲版本／玩家資料不變。型別／正式 build、相對 main b7e62ef 的 UI 防倒退、正式 build 效能及相對 main 的 minor release check 通過。test:affected 因共用／核心路徑保守回退完整 258 檔，最後 2370 pass／1 fail（343925.7294ms），fail 為 Windows 動態埠遭 Fetch 的 bad port 檢查拒絕；該 party-games-http 單獨複跑 1/1。完整執行不是全綠，不能代替最終 head 的 Linux CI；沒有降低瀏覽器限制或更改作業系統埠設定。

ignored 證據在 `work/second-wind-227/scenes-{affected,frontend,build,focused}.log`、`scenes-browser-results.json`、`scenes-ceo-scenes-results.json`、`scene-controls-results.json` 及各狀態 PNG。場景額外 QA 首次引用舊命名結果檔、隨後使用已過期牌局而失敗；改為每次建立新隔離桌後通過。沒有修改產品限流或以舊牌局缺席當作產品故障。

首次完整測試 2370/2371，失敗為 main 的 app-runtime SSE 關閉測試：它假設讀取第一段事件後，close 後下一次 read 必須直接 EOF，但可能仍有已緩衝的合法事件。獨立重跑亦失敗。修正測試為 close 後在 3 秒、100 chunks／1 MiB 上限內讀到 EOF；伺服器不再 listening 與所有 interval 清空的斷言仍保留，未放寬產品行為。修正後 app-runtime 11/11，重新完整 affected 的 SSE 案已通過，僅另有上述動態埠環境失敗；沒有將首次失敗當成通過。

## 保留限制

未決官方卡表／測試獎分／Twist 界線／罕見能力交互、素材解析度／對外發布權利與逐步結算動畫仍在原票。這次只整合介面；main 的房間持久化目前沒有涵蓋這兩款私有引擎狀態，仍不能宣稱伺服器重啟可續局，既有說明維持。未驗實體觸控、Safari、所有特效中途生命週期、GPU FPS 或正式主機 runtime 編碼；不沿用 main 他人的驗收數量冒稱本輪完成。

舊 3047／3048 行程與原編譯資產保留，新版使用獨立資料庫及 loopback 位址試玩，避免跨埠共用 Cookie 覆蓋舊站登入；不操作正式資料。交付仍停在第 4 階段：未 PR、未啟動 CI、未做最終兩輪審查、未合併至 main／tag／部署。
