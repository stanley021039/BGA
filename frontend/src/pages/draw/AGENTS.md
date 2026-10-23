# 你畫我猜作畫專屬協作規則

由根目錄 `AGENTS.md` 移入（2026-10-23）；內容未變。

畫猜作畫／同步／renderer 的後續改動，每輪都須檢查畫者持筆、傳送確認與換輪是否閃白或丟失活動筆跡，並檢查觀看者逐點時序及倒數條。不能僅以最終圖片一致代替途中畫面驗收；規範與證據見 [作畫順暢度](../../../../docs/specs/DRAWING-SMOOTHNESS.md) 與 [防閃爍／時序進度](../../../../docs/DRAW-TIMED-PLAYBACK-PROGRESS.md)。

共用作畫元件（`DrawingSurface.vue`、`DrawingToolbar.vue`、`TelephoneCanvas.vue` 等）在 `frontend/src/components/`，改那裡時同樣適用。
