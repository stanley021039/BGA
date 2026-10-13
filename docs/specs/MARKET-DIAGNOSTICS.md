# 股市冥燈自動查核診斷

2026-10-13，基線 main `0d6b5d8`／v2.0.0，本輪候選 v2.1.0。

## 已確認與尚未確認

截圖顯示10/12、10/13停止自動重試，當日自動21次、最近成功10/09。既有規則：台北14:00–16:00五分鐘間隔查核，時段結束後該日期exhausted；首次歷史回補最多五次。重啟或失敗的人工重查不重開預算；其他日期仍獨立排程。前端可見且無未決操作時每15秒讀取狀態。

本機用現有provider讀三份固定官方來源，均HTTP200，取得通過核對的2026-10-12資料，沒有10/13有效資料。這不能推定另一主機在14–16收到相同內容。沒有主機紀錄，尚不能判定其原始失敗是網路、DNS/TLS、官方延遲、解析或跨來源不一致。

## 實作與界線

- 沿用market_fetch_audit（最近2000筆循環保留）及日期狀態，不新增schema或另一個writer。
- 預設provider每次請求記終局診斷：固定官方URL、機器碼、HTTP狀態、白名單DNS/TLS／連線代碼、耗時。不記response body、request headers或任意error message；觀測器失敗不改變資料取得结果，app停止後不寫晚到診斷。
- 管理員GET `/api/admin/market/diagnostics`：版本、排程旗標、日曆狀態、最近100日期與200筆audit。`?download=1`下載JSON；no-store、帳號每分鐘30次，POST405，非管理員403、未登入401。
- `/admin` 新增更新／下載入口、錯誤码解釋與既有指定日期重查連結。讀取不呼叫provider、不結算、不增加重試或寫audit。
- 匯出不含帳密、cookie、token、環境值、會員資料、response body、error message／stack；只保留機器碼及既有嘗試字串，其他detail遮蔽。URL移除帳密及非date／response query。

## 操作

1. 部署本批後，管理員登入 `/admin` 更新「股市冥燈診斷紀錄」，下載JSON。
2. 先看runtime開關，再看日期status／lastError／次數。DAILY_WINDOW_ENDED只說明停止規則，原失敗看audit的來源與detail。
3. OFFICIAL_HTTP_STATUS;HTTP_429表示限流、HTTP403表示拒絕；OFFICIAL_SOURCE_TIMEOUT表示逾時，ENOTFOUND／EAI_AGAIN表示DNS；DATA_NOT_PUBLISHED表示没有可接受的指定日期資料，也可能有來源落後。
4. 已exhausted日期可在 `/market#admin` 使用既有指定日期重查。該操作會寫官方證據、可能結算待處理預測，須管理員確認日期。不要手填0%或放寬跨來源驗證替代。

細部HTTP／DNS／耗時只能從部署後的新請求記錄；舊請求只有既有audit／lastError，不能還原未存欄位。本輪未操作他人主機、未重查正式日期、未部署；不能保證加診斷後行情就會恢復。瀏覽器展示為隔離合成資料，真實故障仍待主機診斷JSON。

## 本輪驗證

Windows Node22.23.3 focused140/140、完整2076/2076（並行4，131552ms），fail/cancel/skip0，release minor與diff檢查通過。HTTP驗管理員／會員／未登入權限、GET下載header、POST405、讀取不寫DB或呼叫provider、上限與跨DB重開保留；新provider驗HTTP429及DNS、秘密剔除與觀測器失敗不改結果。真實管理頁加合成API驗更新／JSON文字顯示，390px無水平溢出；瀏覽器下載事件等待逾時，未冒稱原生下載通過，attachment已由HTTP測試確認。預覽不接正式資料。CI與PR狀態以交付PR為準。
