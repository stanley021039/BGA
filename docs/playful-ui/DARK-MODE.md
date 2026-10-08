# Playful Paper 深色模式

日期：2026-10-08；版本：1.18.0；維護分支：`style/playful-paper`。

## 行為與設計

使用者要求跟隨瀏覽器深色模式，並希望亮色更鮮豔、參考 Spotify 配色，後續要求右上角設定旁增加切換按鈕。預設讀取 `prefers-color-scheme: dark`，以根節點 `data-color-scheme` 和 `color-scheme` 套用外觀；系統偏好變更時自動更新，不重載頁面或修改房間狀態。瀏覽器沒有提供深色偏好時維持原亮色紙卡外觀。

右上角設定與頭像之間提供太陽／月亮 icon 按鈕，切換亮／暗並記住目前瀏覽器的選擇；登入頁未登入時也顯示按鈕。設定視窗提供「跟隨系統／亮色模式／深色模式」。使用 `ah-color-scheme` localStorage key，透過 storage event 同步同源分頁；儲存不可用時仍能在本頁切換。這是繽紛紙卡同一套風格的亮／暗變體，不是已完成的多風格選擇器，也不增加帳號資料欄位。原保存分支 `archive/playful-paper-v1.17.1` 留在完成版，不隨維護分支移動。

參考 [Spotify 官方設計與品牌指南](https://developer.spotify.com/documentation/design) 的黑／白／綠配色方向，採用深底與高彩度重點色；下面是 Afterhours 自訂色值，不宣稱原網站的實測 CSS 值，也不使用 Spotify 品牌、標誌或程式碼。

| 用途 | 色值 |
| --- | --- |
| 背景／卡片表面 | `#121212`／`#202024` |
| 主文字／次要文字 | `#f7f1e7`／`#d4cddd` |
| 主要操作與選取 | `#35e47a` |
| 藍／粉紅／橘／黃／紫重點色 | `#65bcff`／`#ff79bd`／`#ffa45f`／`#ffdb55`／`#c5a1ff` |
| 亮色填滿區的文字 | `#121212` |

一般資訊卡仍用柔和深色層次，高彩度集中在主要操作、當前玩家、選取狀態與倒數等重要位置。各遊戲保留不同布局與原本對齊。插畫不套反相或整頁濾鏡；撲克牌仍是白底紅黑花色，畫猜繪圖／播放畫布仍是純白；雷霆車隊色、道路圖示、WebGL 與作畫 renderer 不變。

## 修改範圍

- `public/shared/playful-theme.css`：新增深色 token、亮色操作色、頁面硬編碼表面與特殊內容的可讀性處理；亮色原值保留。
- `public/shared/color-scheme.js`、21 份 HTML：在 head 的 stylesheet 前讀取偏好，避免手動選擇與系統不同時先閃現錯誤外觀。
- `public/shared/site-header.js`／`.css`、`ui-components.js`：共用切換按鈕、三模式 select、太陽／月亮 registry 圖示、可讀名稱與焦點；320px header 適度縮小品牌字級以容納按鈕。
- `src/app.js`：只增加一個固定靜態檔案路徑，讓新模組在未登入時也能載入；HTTP 實測先證明缺路由會 404，新增後通過。
- `tests/color-scheme.test.js`、`tests/ui-component-assets.test.js`：偏好、媒體變更、reload／storage、無儲存／media 回退、首屏載入順序與靜態 HTTP 契約。
- `package.json`、`package-lock.json`、`CHANGELOG.md`：依新增相容功能升版至 1.18.0。
- 本文件、角色記憶與 `full-site/dark/`：保存畫面與查核結果。

新增的 JavaScript 只管理本機外觀偏好與 header 控制；沒有修改遊戲 API、資料庫 schema、房間邏輯、角色移動或多人同步。沒有增加 dependency、網路設定或將外觀選擇送到伺服器。

## 驗證

- 完整 Linux 套件：1,532/1,532 通過，0 failed/cancelled/skipped，259,241.80725ms。最終相關測試 38/38 通過，包含新增外觀狀態 6 項与固定靜態 HTTP 路徑。
- `release:check --base v1.17.1 --type minor` 與 `git diff --check` 通過。
- Chromium 真實載入隔離 Linux 專案；1440×900、768×1024、390×844 的 78 組畫面：全數跟隨 dark、無 document 水平溢出、無 pageerror。
- 原登入表單及五款三席等待→開始操作通過；瀏覽器改 light／dark 不需要導航，reduced motion 同時保留。操作細節與 200% 文字結果見 `full-site/dark/game-interactions.json`。
- 實際按鈕驗收見 `full-site/dark/toggle-results.json`：未登入的 Enter 操作、重新整理保留選擇、設定旁位置、跨分頁、恢復 auto、系統切換保留開房草稿、320／390／768／1440 的 header 與 focus。
- 固定普通文字／solid background 的 DOM 對比抽樣結果見 `full-site/dark/contrast-audit.json`；不等於全 WCAG／讀屏或所有回合驗收。
- 亮色前圖及 v1.17.1 完整 1,526 項測試為上一版紀錄；本輪沒有以舊全套數量冒充重跑。新增手動偏好 JavaScript 後，重新執行完整套件。

截圖見 `full-site/dark/`，原亮色前圖見 `full-site/aligned/`。所有帳號設定／遊戲操作使用隔離測試資料；正式站只檢查公開頁面和部署結果。真機 Safari／iOS／Android、讀屏、全部回合、FPS 和瀏覽器強制反色擴充未驗。

上線 commit、備份和正式站查核另記 `full-site/dark/deployment.md`；此文件的測試結果不代替部署證據。
