# 送禮等待區間距修正

2026-10-06，候選 **v1.3.1**。程式提交 `2bdb30eac1c655694f1dda856cabf3bdb4c3c380`，本地 annotated tag `v1.3.1` 固定於這個受測提交，未 push／PR。

## 修正與畫面驗收

送禮側欄的「還差 2 位朋友」與彈幕輸入框在較矮桌機畫面沒有間隔。桌機 flex 側欄使用 `margin-top:auto` 分配剩餘空間，剩餘空間不足時會縮至 0；因此在送禮 `game-action-slot` 後補上 `var(--ui-space-4,16px)` 最小間距，不依賴剩餘高度。

原 Chrome 背景使用隔離 localhost:3214、合成帳戶與一人等待房，透過實際頁面及正常 CSS 載入量測。沒有覆寫樣式或改正式房間。

| 畫面 | 按鈕底部至輸入框頂部 | 水平溢出 |
| --- | --- | --- |
| 1280×600，修正前 | 0px | 無 |
| 1280×600，修正後 | 16px | 無 |
| 1280×720，修正後 | 16px | 無 |
| 390×844，修正後 | 72px，包含既有手機操作元件 | 無 |

截圖 `work/gift-waiting-spacing.jpg`；量測 `work/gift-spacing-before.json`、`work/gift-spacing-after-short.json`、`work/gift-spacing-after-desktop.json`、`work/gift-spacing-after-mobile.json`。測試後已 reset viewport、關閉測試頁籤及停止隔離 server。沒有新增模仿 CSS 實作的單元測試；上述前後實際版面量測驗證回歸。

## 發布驗證與狀態

Windows 全套 **761/761**（42438.6869ms）、Linux 全套 **761/761**（132532.426882ms），失敗／取消／跳過均 0。`release:check --base v1.3.0 --type patch` 通過。

發布包 SHA-256 `21e87d05342d8cd3c87a280ba7ce29ea61427abc00ecd08fae0394f75584f8b6`；遠端已準備 `releases/2bdb30e`。預演副本 schema14、16張既有表逐列一致、integrity ok、外鍵錯誤0、隔離啟動成功，未改正式資料庫。線上 SQLite 備份為 `shared/backups/pre-party-2bdb30e-20261006T133303Z`（UTC），持久檔案另備份；兩者不是同一原子時間點。

正式 current 仍為 `releases/4732450`（v1.3.0）。切換檢查發現一間一人送禮等待房；尚未重啟或清掉房間。已詢問是否等離房後切換，或接受重啟清掉該等待房後立即更新。正式公開版號、資源及更新後 Chrome 驗收等待切換。
