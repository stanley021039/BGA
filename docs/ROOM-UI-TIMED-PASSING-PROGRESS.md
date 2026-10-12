# 共用房間介面與定時傳頁驗收

2026-10-13。基準：main `724b320d1ec489d1ddc453e961ef9d87c855f32c`（1.31.0）；候選版本 2.0.0。此文件記錄實作與驗收，最終固定提交與兩輪審查另見本批 PR。

## 最終範圍

| 需求 | 實作／驗收 |
| --- | --- |
| 設定與聊天共用區塊 | GameUI.framePanel；上方 header、上下分隔線的捲動 content、底部 footer、12px gap。所有遊戲共用；房主開始操作、一般玩家唯讀、管理無權限時 disabled。 |
| 遊玩版面 | 你畫我猜／極簡畫家／傳情畫意左玩家、中上畫布／中下作答、右聊天室；桌機等高，手機換列，訊息在固定區塊捲動。 |
| Dialog | 共用 header／content／footer、右上關閉、右下確認；移動提交按鈕保留原 form 關聯。媒體同意初始 focus 為 dialog，沒有選取標題或隱私連結。 |
| 表單与顯示 | 共用 label＋control、8px／12px 間距、下拉箭頭與文字留白；移除重複自我／AI 標籤，分數配色獨立；遊玩移除加入 AI 與教學，極簡回顧有結果才出現。 |
| 傳情畫意 | 每頁 90 秒到時由 server 傳頁，提前全員完成仍等時；已同步草稿逾時保留，空白略過，最後自動揭曉；沒有手動傳頁按鈕。 |

## 證據與測試

實作階段：三款繪畫 12 組明暗／桌機手機、20 組角色／階段與斷點、持筆與同步／送出／換輪；十款教學 70 次狀態／尺寸；傳情畫意两個三席完整真實 90 秒×2 頁（全員提早送出及房主關頁），以及 37 項定時傳頁回歸。各功能文件記錄個別限制，不將腳本當真人測試。

審查階段：headless Chrome 的十款等待房間 60 組房主／一般玩家、1440px／390px／明暗布局通過；20 次媒體同意初始焦點，兩個尺寸的 footer 表單提交／Escape／返回焦點通過。開始綠色操作可見，設定與聊天皆使用共用 frame／12px gap，非房主房間欄位 disabled，沒有水平溢出或 pageerror。

第一輪 Linux 完整測試：2072 項，2041 通過、31 失敗，cancel／skip 0。失敗涉及元件初始化所需的 DOM fixture、過時的自我標籤／管理隱藏／遊玩 AI 預期及額外快取 query 破壞既有精確資源契約。沒有刪除回歸或豁免失敗；補齊 DOM fixture、更新已確認的新行為 assertions、移除多餘 cache query（資源仍 no-store）。相關 71 項複驗完成，最後房間權限 20 項另驗通過。

完整複驗、固定 SHA 及 CI 狀態待本批 PR 記錄補充；此處不把第一輪完整測試寫成通過。

## 相容性與限制

按版號規範升 major：傳情畫意移除 canAdvance，advance 不再允許提前換頁；新舊分頁需要重新載入。私人草稿有 100 筆／3000 點／80 字、128KiB body 與每帳戶 120 次／分鐘界線，僅本人可讀；歷史保存最終頁面 delta，沒有 DB schema 變更。只能保留截止前已接受的內容，重啟不續接活動對局；既有離線清理、中止與權限保留。

未驗真人觸控、讀屏、所有八席原生場次、所有瀏覽器及完整第三方影片實播。來源與更詳細契約：

- [Dialog](specs/SHARED-DIALOG-FRAME.md)
- [共用面板與唯讀設定](specs/SHARED-ROOM-SETTINGS-READONLY.md)
- [表單欄位](specs/SHARED-FORM-FIELDS.md)
- [繪畫排版](specs/SHARED-DRAWING-PLAY-LAYOUT.md)
- [教學顯示](specs/SHARED-ROOM-TEACHING-VISIBILITY.md)
- [定時傳頁](specs/TELEPHONE-TIMED-PASSING.md)
