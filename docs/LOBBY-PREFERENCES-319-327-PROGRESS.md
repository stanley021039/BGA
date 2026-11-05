# #319／#327 合併發布準備

2026-11-05，使用者明確要求兩票一起 PR，接受前述本機交付並要求整合準備；不宣稱使用者親自逐項實測。儲存庫 `stanley021039/BGA`，分支 `codex/lobby-preferences-319-327` → `main`，候選 3.18.0。Base／merge-base `3f21bc48a60013e42e1211a407bb7ec37dc7cc03`。新 PR、Draft 轉 Ready 皆依本次具體確認，尚未發布、啟動 CI、合併或部署。

## 整合範圍

- [#319](specs/LOBBY-BACKGROUND-VISIBILITY-319.md)：本機顯示偏好與共用背景分開，靜態／動畫一起隱藏，角色／攻擊／操作保留；刷新／重入保存、儲存受限提示及卸載清理。
- [#327](specs/CREDITS-NAVIGATION-327.md)：共用導覽加入 `/credits`，移除大廳右下入口；授權頁內容與原網址不變，保留既有題庫連結。
- 從 #327 舊多人試玩候選只移植相關 Vue／樣式改動，不納入其未合併 arena 玩法；保留 main 抽卡、新招式、右上 KDA。原 worktree 全部修改與資料保留。
- 版號統一 3.18.0；沒有後端／資料庫／媒體資源或預算變動。

## 整合驗證

以 Windows Node 24.22.1 及原生 Edge、同一份正式 build、新隔離 SQLite／兩個合成帳號驗證；不是沿用獨立分支的通過數。測試帳密、截圖、QA 腳本與日誌只在本機 ignored work。

受測產品／兩輪直接審查 head：`12f4b5fffb01212bf93792c4f28ea53bc4e1bf31`。所有整合套件在此提交及乾淨程式樹上執行，後續僅新增審查／進度文件。

- `node tools/test-affected.cjs --base 3f21bc48`：因共用來源保守回退 267／267 檔，2222 項中 **2221 通過、0 失敗、0 取消、1 缺 ffmpeg 略過**，295699.4851ms（`work/combined-affected.log`）。這次整合完整執行沒有運動員案例失敗；原 #319 早期獨立驗證的失敗與重跑紀錄仍保留在該規格，不將歷史日誌改寫為通過。
- 前端完整 **273／273**，失敗／取消／略過 0，21420.7131ms（`work/combined-frontend.log`）。型別、模組邊界、正式 Vite build、相對上述 base 的 UI ratchet／minor release check、格式 write／check、媒體 build 預算通過；45 音效合計 1963048 bytes，未增加預算。
- #327：桌機 1920×1080／手機 390×844 × light／dark × keyboard／touch 八組；共用導覽在大廳、設定頁可用，保留三個題庫連結。Tab／Enter／Space／Shift+Tab、Escape 返焦、觸控與點外關閉通過；無水平溢出、授權連結觸控高度至少 44px。/credits 200、六區塊 DOM hash 一致，原 Vue／HTML 與 base 無差異。證據 `work/combined-credits-browser/report.json`、八張選單 PNG。
- #319：兩個獨立帳號、桌機／手機深淺色四組，A 關閉而 B 保持；重整／重入保留，角色仍在，個人切換無共用背景 POST。隱藏期間 B 合法更換至 garden，A 不被打開，再開顯示最新背景。冷載關閉／reduce 下重複切換通過，來源 `work/combined-background-browser/report.json`、`cold-reduce.json` 及八張設定／隱藏 PNG。兩套矩陣 pageerror 皆 0。
- 目視核對同一建置的桌機亮色導覽、手機暗色導覽、手機亮色設定，既有樣式與右上 KDA 保留。QA 初次使用舊 #327 合成帳號造成 401，已修正 QA 帳號並完整重新執行，未改產品繞過登入；首次準備錯誤日誌保留。

兩個分開回合：[規格符合性](reviews/LOBBY-PREFERENCES-319-327-SPEC.md)、[程式品質與風險](reviews/LOBBY-PREFERENCES-319-327-QUALITY.md)，相同 base／head 已檢查範圍未發現問題，無待修 finding。最終候選只補文件；發布前核對 src／frontend／tests／tools／public／package／lock 與上述受測 head 相同，並於 PR 描述記錄最終 SHA，保留兩輪結論。主分支再次 fetch 仍為相同 base，無須整合額外提交。

限制：觸控為 Edge 模擬，實體手機／Safari／GPU FPS 及正式主機轉碼未驗；缺 ffmpeg 略過不等於實際編碼通過。尚未啟動 Linux CI、建立 PR、Ready、合併或部署；新 Draft 發布仍待本次具體確認。
