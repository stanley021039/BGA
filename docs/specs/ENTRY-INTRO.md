# #138 每次進頁開場動畫

2026-10-21 後續：使用者指定 #154 新增獨立進頁動畫偏好，預設仍開啟；關閉後一般進頁及登入成功均直接進入。新候選的範圍、設計同步限制與證據見 [開場偏好](ENTRY-INTRO-PREFERENCE-154.md)，下列每次播放行為適用於偏好開啟時。

2026-10-21，本機 2.19.0 候選；使用者已驗收原圖動畫並於同日授權推送／合併；不包含部署。最新使用者修正取代先前跨頁保存圖片座標／重新建立圖片的策略。

## 已確認範圍

- 登入／註冊／重設密碼頁直接顯示，不先播放開場。驗證失敗不播放；重設密碼完成回到登入。
- 登入／註冊成功後，留在目前文件，其他 UI 隱藏，使用同一個原始 img 節點從原位放大至中央並淡出。約 3 秒後才導航到原本的目標頁，目標頁跳過第二次開場。
- 原圖不複製、不移到其他容器、不更換 src，不新增邊框／圓角／陰影。其他 UI 以 visibility 隱藏，不移除布局，避免圖片原位重排。只動畫 transform 與 opacity。
- 其他直接進入內容頁、重新整理與 BFCache 返回仍播放標準開場。頁內操作不重播。
- 保留登入 session 與深連結，不另儲存帳密。可略過或 Esc；減少動態使用原位淡出、不縮放。
- 不改登入／大廳／遊戲設計稿、郎中圖像效果、遊戲規則或正式資料。

## 實作與回復

共用 auth-entry.js 提供 EntryIntro.playFrom，Vue 與 legacy 登入成功流程 await 動畫後再導航。以目前圖片 getBoundingClientRect 計算終點，起始 transform 為 none。祖先只解除裁切，圖片仍在原父節點，visibility 不改幾何布局。UI 隱藏後只保留圖片及略過按鈕。

播放期間以 prefetch 預取目標 HTML，是否預取由瀏覽器決定；目標頁的 Vue／API／房間連線在導航後才啟動，不宣稱已在背景完整掛載。直接進入內容頁仍維持遮罩背後正常掛載。

完成時只保存一次性 {path, at} UI 記號至 sessionStorage，不保存圖片座標或任何認證資料。目標頁在 head 的小型外部同步 bootstrap 先讀取記號並阻止開場閃現，DOMContentLoaded 後清理；記號須符合目標路徑且未超過 15 秒。sessionStorage 不可用時以 10 秒、SameSite=Lax 的 UI cookie 作備援；兩者都不可用仍導航，但可能顯示標準進頁動畫。

動畫結束後維持隱藏的出頁畫面直到導航，不閃回登入表單；pagehide 取消動畫／計時器、恢復 class／opacity，保留 BFCache 回復能力。導航卡住超過 10 秒恢復登入 UI。圖片未載入或動畫 API 不支援均不阻斷登入。手機若已捲離圖片，原圖會從當時 viewport 外移入，沒有刻意改變捲動位置。

一般內容頁的共用 dialog 保留既有 data-ui-dialog-frame 契約、CSS 三秒隱藏備援、焦點／observer 清理，且不關閉背景自己的 dialog。所有 HTML 裝飾仍在伺服器權限檢查之後，API／媒體不包裝。

## 本機驗收

- 基準 main c0ec416f0a323ab9d4fe0c3fa525dec258cc2849（2.18.0），隔離分支 codex/issue138-entry-intro；本輪再次 fetch main，基準未前進。
- 桌機 1920×1080 實際成功登入：動畫中 URL 仍為 /login、form visibility=hidden、entry-auth-image 僅一個，原圖 currentSrc 保持 login-576.webp。截圖只有原圖與略過按鈕，沒有對話框外框或其他 UI。之後進大廳，entry-intro hidden=true／open=false、guard=false，未重播。
- 原生瀏覽器 console 未觀察到錯誤。390×844 亮色模式已確認 UI 隱藏及同一原圖動畫；實體觸控裝置仍待驗。
- 圖片節點／原父容器不變、導航等待三秒、單次完成記號、skip/Esc、減少動態、storage／動畫 API 備援、導航失敗恢復皆有回歸測試。原有內容頁三秒、延遲腳本、BFCache、背景 dialog、共用框架、HTTP 資源與登入／深連結測試保留。
- Vue 型別檢查與前端建置通過。最終受影響測試與格式結果在本輪紀錄補入。
- 最新截圖：忽略目錄 work/preview/auth-same-image-desktop.png、auth-same-image-mobile.png。預覽 http://127.0.0.1:14998/login，僅合成測試資料。

完整註冊送出、實體手機、極慢網路與所有遊戲進行中刷新未逐一人工驗收；沒有宣稱已通過。主觀流暢度仍待使用者試看。開場不暫停遊戲倒數。前輪2519全套通過屬舊動畫策略，不代替本輪修改的驗證。

2026-10-21 使用者確認可合併。本輪補上 Windows pre-push 解壓相容修正：明確使用原生 System32/tar.exe 並指定 UTF-8，真實 Git archive 中文路徑及損毀封存拒絕回歸通過；固定 Prettier、即將推送的已提交 tip、失敗阻擋及清理不變，沒有略過 hook。PR 開發時保持 Draft，合併前仍需同一 base/head 的兩輪審查及雙平台 CI；最終狀態以 PR 記錄為準。尚未部署。
本輪最終檢查：test:affected 因共用入口與新路徑回退全套，2522/2522 通過；後補 Esc 與 head 解析前抑制閃現／cookie 備援案例後，相關16/16通過。前端6/6、vue-tsc／Vite build、format:check、release:check及git diff --check通過。原生瀏覽器另確認 Esc 立即進大廳且不重播，預覽分頁已重新載入新版本。
