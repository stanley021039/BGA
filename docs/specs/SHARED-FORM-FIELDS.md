# 共用表單欄位

## 結構與間距

`GameUI.frameField(label, control)` / `frameFields(root)` 將「標題＋控制項」整理為 `.ui-field`。支援 label 內包控制項，以及相鄰的 `label[for]` 與 input / select / textarea。`GameUI.createField({label, control, help})` 提供新欄位的共用建構方法，說明文字透過 aria-describedby 關聯。

- `--ui-field-label-gap: 8px`：標題與控制項間距。
- `--ui-field-gap: 12px`：相鄰欄位間距。
- `.ui-field-group` 保留既有欄數，統一列間距。
- 控制項本身的內側留白沿用選單／輸入框的 12px 共用規則。

網站既有入口均載入 GameUI；靜態及動態表單會共用相同契約。保留原生 label、控制項節點、ID、required / disabled、form 歸屬及事件處理，不複製控制項。MutationObserver 只處理新增欄位相關節點，不在聊天室訊息或作畫動畫更新時全頁掃描。

勾選框／單選框保留選項排列。既有橫向操作列、媒體音量列及繪畫工具列不改為直向欄位；其他緊湊控制可使用 data-ui-field-layout="inline" 明確保留布局。

## 本輪驗證

你畫我猜的「數值」標題與上一個下拉選單量得 12px，與輸入框量得 8px（1440px / 390px）。點擊 label 聚焦正確數值輸入框，修改設定的 API 成功且 ending.value 更新。進入遊戲後聊天可發送，管理／離開同列；跑團角色選擇控制仍可操作。

登入、大廳、形象設定、角色、共編題庫、禮物題庫、畫猜題庫與市場頁面（桌機／手機）的已套用欄位 gap 均為 8px，未新增頁面橫向溢出或 JavaScript 錯誤。全部含靜態 label 的 HTML 入口均有載入共用元件；admin 的提交流程沒有本輪實測，不能把入口盤點當作表單業務功能全站驗收。完整 PR checklist 尚未執行。


2026-10-13：本批開始完整驗收與固定提交審查，取代先前僅針對性驗證的交付狀態；實作範圍與未驗限制保留。最新測試／審查／CI 結果見 [本批驗收](../ROOM-UI-TIMED-PASSING-PROGRESS.md) 與 PR。
