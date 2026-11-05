# #327 素材來源與授權入口

2026-11-05，依使用者指定接續 Issue #327；該票已標示 in progress，沿用既有票。最初在 `2dbbf9a00097fcc491777b0ec1eac4219636c447` 多人試玩 worktree 驗證，後依「327、319 一起 PR」指示，僅將本票入口修改移植到 main `3f21bc48a60013e42e1211a407bb7ec37dc7cc03` 的 `codex/lobby-preferences-319-327`。原工作區保留；整合候選為 3.18.0，尚未發布 PR。最新證據見 [整合紀錄](../LOBBY-PREFERENCES-319-327-PROGRESS.md)。

## 需求與實作

- 共用 SiteHeader 的原「遊戲題庫」按鈕改名「導覽選單」，在既有同頻、送禮、畫猜連結後加入「素材來源與授權」，網址維持 `/credits`。沿用既有 UiButton、選單外觀、定位及開關生命週期。
- 移除 LobbyPage 右下角的獨立連結與 `.version-note` 定位。原多人試玩分支的 arena 專用樣式不在目前 main，未把該未合併玩法或樣式帶入本批。
- 授權頁 Vue 與 HTML、六個內容區塊及返回大廳連結不修改。不替原獨立授權頁新增頁首。
- 與 #319 共用同批 minor 候選 3.18.0，CHANGELOG 兩項合併記錄，沒有重複升版。

## 原獨立驗證（移植前歷史，不能代替整合驗證）

Windows、Node 24.22.1、原生 Edge，使用 `tools/playtest-lobby-arena.cjs` 產生新的隔離 SQLite 與合成帳號，不操作正式資料，也未停掉其他服務。隨機密碼與資料庫只在本機測試目錄。

- `npm run frontend:build`（包含 vue-tsc 與前端模組邊界檢查）通過；前端 `node --test tests/*.test.cjs` **260／260 通過**，失敗、取消、略過皆 0。
- `UI_CHECK_BASE_SHA=2dbbf9a00097fcc491777b0ec1eac4219636c447 node tools/ui-check.cjs --check`、`node tools/perf-check.cjs --build`、`node tools/release.cjs check --base 4127a035 --type minor`、格式 write／check 及差異空白檢查通過。
- `node tools/test-affected.cjs --base 2dbbf9a0` 因共用頁首、樣式及未知路徑保守回退 **266／266 檔**：2190 項中 **2189 通過、0 失敗、0 取消、1 因本機未安裝 ffmpeg 略過**，270860.2073ms。略過的是實際 MP3 轉檔案例，沒有把略過當轉碼通過。這是上述基底加本次未提交產品修改的實際執行結果，後續只補文件。

瀏覽器最終八組為 1920×1080／390×844 × light／dark × keyboard／touch；桌機與手機都各驗鍵盤及粗指標觸控模擬，不只更改視窗寬度。

- 大廳及設定頁的共用入口可用，四個選單連結及原題庫網址均保留；大廳沒有 `.version-note` 或獨立 `/credits` 連結。選單與連結在視窗內、觸控高度至少 44px，選單不蓋觸發鈕、無水平溢出。
- 真 Tab 走到導覽按鈕，以 Enter 開啟、四次 Tab 到授權連結；Escape 關閉並返焦，Space 可重開，Shift+Tab／Tab 可反向及正向移動，Enter 成功開原 `/credits`。
- 真合成 touch tap 可開啟、關閉及點選授權連結；點外部可關閉。原授權頁返回大廳連結可用。
- `/credits` HTTP 200，六個區塊的執行期 DOM 在八組完全一致；原 Vue／HTML 經正規化雜湊與基底相同。含 CC BY 4.0 及 Apache 2.0 的內容保持可讀。
- 八張選單截圖均保存；另外目視核對桌機／手機深淺色四張。最終頁面例外 **0**。初輪 QA 誤以為原獨立授權頁有共用頁首而等待逾時，修正 QA 為驗返回連結與兩個真正的共用頁首頁面，沒有為配合測試更改授權頁。

本機證據：`work/credits-327-browser/report.json`、同目錄八張 `*-menu.png`、`work/check-credits-327.cjs`、`work/credits-327-{affected,frontend,build,format-check,perf}.log`。QA 腳本、截圖及含登入資訊的預覽紀錄不提交。觸控為 Edge 模擬，不是實體手機／真人觸控驗收；未執行遠端 CI。
