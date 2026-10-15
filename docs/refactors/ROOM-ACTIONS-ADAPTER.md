# 郎中房間操作接線

2026-10-15；基於整合分支 `cf80116`。本輪只遷移郎中的房間操作，其他遊戲保留既有接線。

## 責任與 interface

`RoomControls.bindActions({type, read, run})` 建立房間操作 module 的明確 seam：

- `read()` 回傳 `start`（step、label、enabled）、`bot`（enabled），以及可選的結束畫面 `host` 槽位。
- `run(step, trigger)` 執行 prepare、start 或 bot。遊戲端保留設定保存、藥材書裁決、人數及容量條件；trigger 是實際按鈕，供對話框返回焦點。
- 回傳的 `refresh()` 在遊戲 busy 或 render 更新時同步共用操作，不依賴 MutationObserver。
- 共用 module 擁有按鈕、名單末格 AI 的呈現、pending 防重送、錯誤槽及操作完成後的焦點保護。其他遊戲仍用原有 DOM adapter。

郎中不再建立隱藏的開始／準備按鈕，也不經共用按鈕代點原始按鈕。設定欄位、局內操作與其他 Stitch DOM 整理仍屬既有 implementation，本輪未遷移。

`settingsError` 專門代表未成功保存的設定；一般操作留下的錯誤文字不再被當成禁止開始的條件。設定失敗仍會阻止準備／開局，需成功更改保存後再繼續。

## 測試站瀏覽器驗收

Chromium 實際連線隔離測試站，以合成驗收房間操作；未執行 test 指令或完整測試套件。

- 房主準備、寶典開關與焦點返回；非房主開始按鈕不可用。
- 注入保存失敗後仍為 waiting，未開寶典或開局；成功保存後恢復。
- 延遲真實加入 AI、開始請求並連點，各僅送出一次。
- 額外插入假原始開始按鈕，郎中的共用動作仍走明確接線。
- 1440px：準備、pending、成功及設定失敗後，面板寬高與操作列位置一致。
- 390px／320px：pending 與長操作錯誤前後面板寬高、操作列位置一致，無頁面水平溢出；錯誤槽在既定範圍內捲動。
- 進入占卜階段、同伴離席結束、重新載入結束頁、準備及再次開局。
- 撲克舊接線：加入 AI、開始，瀏覽器無未處理錯誤。

重現工具：`tools/qa/room-actions.cjs`。由外部提供 `QA_BASE`、`QA_CREDENTIALS_FILE`；後者為私有 JSON `{ "username": { "password": "..." } }`，需具測試站管理者權限以建立驗收會員。選用 `QA_OUTPUT`、`BROWSER_EXECUTABLE`。工具建立驗收房，結束後離席並停用自己建立的會員；不得提供正式站帳號。

只驗上述有限流程；未驗真實手機觸控、其他全部遊戲、九回合完整對局或弱網換頁。沒有 PR、main 合併或正式發布。
