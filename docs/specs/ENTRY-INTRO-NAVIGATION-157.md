# #157 開場動畫的導航範圍

2026-10-21，2.20.2 候選；基準 main `a95d35090a4af85114679a048a0c5ae1eac2ce6f`。使用者確認：修正開房時也播放放大動畫的問題，另開 #157 處理。此規則取代 #138 的每次文件載入／BFCache 重播策略；#154 的預設開啟與個人開關保持有效。

## 已確認行為

- 偏好開啟時，直接／外部進入及重新整理播放；登入／註冊成功仍在原始圖片位置播放一次，目的頁不重播。
- 站內開房、加入／返回房間、邀請連結、導覽及返回大廳不重播。瀏覽器上一頁／下一頁及 BFCache 還原也不重播。
- 偏好關閉時以上全部略過。登入失敗與重設密碼原流程不變；略過、Esc、減少動態設定保留。

## 根因與修正

原共用 bootstrap 將完整文件導航視為一次新進站；大廳開房的 `location.assign` 因此又播放。`public/shared/entry-intro.js` 現在於 body 解析前，以 Navigation Timing 的導航種類和同 origin referrer 判斷站內導航，延用既有跳過 class。`reload` 不套用 referrer 跳過，`back_forward` 與 persisted pageshow 則隱藏演出。既有登入完成記號及偏好仍優先生效。

伺服器使用 `Referrer-Policy: same-origin`。只比較解析後的完整 origin，不用字串前綴；無額外 cookie、導頁標記或攔截點擊。瀏覽器缺少導航資訊、referrer 被隱私工具移除或解析失敗時，保守沿用一般進頁播放，不能保證此類環境的站內導航一定略過，但不阻擋頁面或登入。

## 實作階段證據與限制

- Windows Node 22.23.3，進頁／登入 focused 26/26。涵蓋同 origin、外部／偽造 host／不同 port 或 protocol、reload、history、BFCache、缺失／拋錯 metadata、儲存不可用、偏好關閉與登入完成。
- `npm run test:affected` 因共用入口等路徑回退完整 271 檔，2,543/2,543 通過，無跳過／取消。前端 6/6、vue-tsc／Vite build 通過。
- 隔離本機 Vue 預覽：登入原圖演出只有一張圖片，目的大廳不重播；偏好開啟下實際建立撲克房間，約 1.75 秒房間操作可見，intro hidden=true／open=false；房間重新整理觀察 hidden=false／open=true，結束後恢復房間。
- 實際點返回大廳、返回已入座房間及瀏覽器上一頁，均觀察 intro hidden=true／open=false。1920×1080 與 390×844 深色房間可見。原生全頁截圖 API 失敗，改用視窗截圖留存手機證據於本機 ignored preview。
- 淺色、獨立訪客加入、真實外部邀請、legacy 原生流程及實機 BFCache 命中未於本輪重新操作；對應導航判斷有自動回歸，不外推為全遊戲流程驗收。未改遊戲元件、郎中圖像／效果或畫猜 renderer／同步。
- 未新增畫面或元件；第三份 Figma 既有唯讀／額度限制仍由 #151 追蹤，不宣稱已同步。未部署。

目前為開發候選；PR、固定 head 的雙平台 CI、兩輪審查及合併狀態以 #157 的連結與紀錄為準。
