# #319／#327 合併發布準備

2026-11-05，使用者明確要求兩票一起 PR，接受前述本機交付並要求整合準備；不宣稱使用者親自逐項實測。儲存庫 `stanley021039/BGA`，分支 `codex/lobby-preferences-319-327` → `main`，候選 3.18.0。Base／merge-base `3f21bc48a60013e42e1211a407bb7ec37dc7cc03`。新 PR、Draft 轉 Ready 皆依本次具體確認，尚未發布、啟動 CI、合併或部署。

## 整合範圍

- [#319](specs/LOBBY-BACKGROUND-VISIBILITY-319.md)：本機顯示偏好與共用背景分開，靜態／動畫一起隱藏，角色／攻擊／操作保留；刷新／重入保存、儲存受限提示及卸載清理。
- [#327](specs/CREDITS-NAVIGATION-327.md)：共用導覽加入 `/credits`，移除大廳右下入口；授權頁內容與原網址不變，保留既有題庫連結。
- 從 #327 舊多人試玩候選只移植相關 Vue／樣式改動，不納入其未合併 arena 玩法；保留 main 抽卡、新招式、右上 KDA。原 worktree 全部修改與資料保留。
- 版號統一 3.18.0；沒有後端／資料庫／媒體資源或預算變動。

## 整合驗證

以 Windows Node 24.22.1 及原生 Edge、同一份正式 build、新隔離 SQLite／兩個合成帳號驗證；不是沿用獨立分支的通過數。測試帳密、截圖、QA 腳本與日誌只在本機 ignored work。

本輪建置、測試、兩個分開審查回合及最終候選 SHA 將在完成後記錄。未完成項目不算通過；觸控為 Edge 模擬，實體手機／Safari／GPU FPS 及主機轉碼未驗。
