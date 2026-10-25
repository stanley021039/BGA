# 媒體子母畫面（#266）

2026-10-25；基準 main `4982cf832ee8716ba281c8449183f6c6d75c262f`，候選 2.47.0，分支 `codex/media-pip-266`。目前停在第 4 階段等使用者驗收；尚未開 PR、啟動 CI、合併、打 tag 或部署。

## 本批範圍與行為

- 採瀏覽器原生 Document Picture-in-Picture：媒體視窗標題列新增「子母畫面」圖示按鈕，把**同一組**已掛載的媒體節點搬進作業系統層級的浮動小視窗，不另建播放器。不支援的瀏覽器（含手機瀏覽器）不顯示此按鈕，仍可用頁內既有的縮小／橫條模式。
- 子母畫面內保留：目前曲目、播放／暫停、重播、下一筆、停止、同步、退出影片、靜音與個人音量、框飾選擇、返回頁內、關閉。點播分頁、點播表單、全桌進度條與同步說明在子母畫面隱藏，回到頁內操作。
- 返回頁內的方式有四種：「返回頁內播放器」按鈕、關閉按鈕、Esc、直接關閉子母畫面視窗。四種都會回到頁內完整視窗並繼續播放。換房、斷線、離開頁面與元件卸載會自動關閉子母畫面。
- 音樂沿用同一個 audio 元素，搬移時不重新載入。YouTube iframe 跨文件搬移時會重新載入，所以播放器會在新文件中依全桌進度重新綁定，不同時存在兩個影片來源。開啟子母畫面後，主頁面分頁隱藏時影片仍可在子母畫面播放；子母畫面本身隱藏時才依既有規則暫停。
- 子母畫面同步主頁面的深淺色、主題、語系與 reduce motion；子母畫面隱藏時加上 motion-reduced，裝飾動態跟著停。視窗尺寸記在本機 `bga.media.pip.size.v1`（300–960 × 300–900）。
- 「特效」本批只做到沿用既有媒體框飾（`prefs.media`，`syncFrame()` 在子母畫面文件內重新計算），沒有新增動態邊框、粒子或濾鏡，也沒有新增素材或音效。

## 技術決策

- Document PiP 視窗是 `about:blank` 文件，裡面的 iframe 請求不會帶 Referer，YouTube 會回錯誤 153。實測加 `widget_referrer`、從主頁面導航 iframe、`history.replaceState` 都無效。
- 改為新增 `GET /media-pip-frame`：不含任何腳本的空白 HTML，只對這個路徑放寬為 `X-Frame-Options: SAMEORIGIN` 與 `frame-ancestors 'self'`（同 `embed=1` 例外），Referrer-Policy 為 `strict-origin-when-cross-origin`。子母畫面先載入這個同網域 frame，再把媒體區搬進去；YouTube 嵌入因此帶 `http(s)://<站台>/` 作為 Referer。frame 載入逾時 10 秒，或拿不到真實網址時，視為開啟失敗：關掉視窗，頁內播放器不動，並顯示可重試的提示。
- 關閉視窗時，內層 frame 可能比外層 `pagehide` 更早被拆掉；在那之後才搬回頁面的節點會失去事件監聽，按鈕就會失效。因此內外兩層的 `pagehide` 都觸發還原（同一個還原流程可重複呼叫，不會重複執行）。

## 驗證（2026-10-25，Windows）

- 單元／元件：`frontend/tests/document-pip.test.cjs` 5 項（同節點搬移與還原位置、主題同步、取消中的請求、不支援／拒絕、frame 載入中取消、frame 無真實網址、開啟頁 pagehide）；`media-window-lifecycle` 新增子母畫面開啟／返回／換房 1 項；`media-player-background` 新增影片跨視窗重新綁定與音樂沿用同元素 2 項；`security.test.js` 驗 `/media-pip-frame` 標頭且不含腳本。前端 137/137 通過。
- `npm run test:affected`：變更含共用元件、CHANGELOG 與格式基準，因此回退全套 1883 項，1882 通過、1 失敗。唯一失敗是 `app-runtime` 的 SSE 關閉測試；在未修改的基底 `4982cf8` 上同樣失敗，與本批無關，未修改該測試。
- 型別、正式 build、`format:check`、`ui:check`、`perf:check`、`release:check` 都通過。格式工具依政策整份格式化有改動的 legacy 測試 `tests/security.test.js`，並從格式基準移除該筆；未提高任何 UI／效能額度。
- 真 Edge（無頭，本機隔離站 work/media-auto-open，所有玩家只開獎勵、不預填成就）：1920×1080／390×844 × 深淺色 × 音樂／YouTube 共 8 組通過。驗證內容：媒體區離開主頁面、搬進 `/media-pip-frame`、主題一致、無橫向捲動；音樂持續播放且時間前進；子母畫面裡的 YouTube 嵌入 Referer 為站台網址，且有真實 `googlevideo` 串流；主頁面沒有殘留 iframe。返回按鈕、直接關窗、Esc 三種回到頁內都能繼續播放，關窗後可再次開啟。子母畫面截圖以 430×580 模擬預設尺寸。截圖與結果 `pip-qa-results.json` 留在本機 ignored work，不提交。
- 驗證中發現並已修正：子母畫面內容被截在 44px 格線列（隱藏分頁後仍沿用分頁列高度）；YouTube 錯誤 153；直接關窗後按鈕失效。

## 未驗證與已知限制

- 未用有頭瀏覽器實際拖曳／縮放作業系統的子母畫面視窗，也沒驗證尺寸記憶的實際還原效果（無頭模式下視窗尺寸跟隨 viewport）。
- 只驗了 Edge。Chrome 應相同（同為 Chromium），未實測；Firefox／Safari 沒有 Document PiP，按鈕不會出現。
- 有框飾（`prefs.media` 非預設）的子母畫面外觀、喇叭實際聽感、雙玩家同時開子母畫面的同步，都還沒驗。
- 開發伺服器（Vite）會把 `/media-pip-frame` 轉給後端，沒有另外驗證。
