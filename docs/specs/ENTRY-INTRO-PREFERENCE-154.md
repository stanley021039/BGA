# #154 全域開場動畫偏好

2026-10-21 狀態：#154 已隨 PR #155（main `4b7f26642ae215d23d3dfffce4a2cf6bb7745675`，2.20.0）合併並關票。後續 #157 限制開啟時的播放範圍：站內導航與 history／BFCache 不重播，詳 [最新規則](ENTRY-INTRO-NAVIGATION-157.md)。下列候選字樣及測試數為當時紀錄；Figma 待同步限制持續有效。

2026-10-21，2.20.0 候選；基準 main `f183242471efd325101965beb45e6f7ce6f5cacf`。使用者要求新增全站開場動畫開關，預設開啟，方便開發時略過。這是最新明確要求；舊桌機規格中不新增動畫開關的歷史限制不阻擋本票，但既有遊戲動畫／彈幕控制不變。

## 行為與邊界

- 既有「個人遊戲設定」新增「進入網頁時播放開場動畫」，沿用共用 switch、44px label、說明及深淺色契約，不另建導覽或樣式。
- 預設開啟。關閉後一般進頁、重新整理、返回及登入／註冊成功均直接進入目的頁，不顯示開場遮罩或等待三秒。登入驗證失敗及重設密碼流程不改。
- 關閉只影響進頁演出；「遊戲動畫」、彈幕、音效與減少動態設定各自獨立。重新開啟在下一次進頁生效，不在設定視窗上突然播放。
- 偏好存於此 origin 的 localStorage，跨路徑／重整保留，不是管理員站台總開關，不跨裝置同步，也不寫入帳號或正式資料。

## 共用實作

`public/shared/entry-intro.js` 提供唯一的 `EntryPreferences.get/set/subscribe`，資料為 `bga-entry-intro-settings` 的 `{version:1, enabled:boolean}`。僅有效的 v1 明確 false 才關閉；缺少、損壞及未支援版本回預設開啟。損壞資料不誤報儲存權限失敗。

HTML decorator 在 head 同步載入此既有 bootstrap，包含 auth 文件；auth 原圖 animator 仍 defer。讀取關閉狀態後，在解析 body 前設 `entry-intro-disabled`，CSS 直接隱藏遮罩；boot 關閉 dialog，不建立演出 timer／observer。後續設定與 storage／pageshow 事件同步 UI，停掉正在顯示的一般進頁演出。

`auth-entry.js` 在碰觸圖片、隱藏 UI 或建立 timer 前檢查同一偏好；關閉立即完成 promise，Vue／legacy 原有成功流程接著導航，不另寫完成記號。開啟則保留 #138 原圖原位放大、skip／Esc、三秒、減少動態與目標頁不重播契約。設定切換與關閉狀態清理一次性 UI 完成記號，bootstrap 同時消耗 session／cookie 記號，避免殘留導致誤跳過。

儲存讀取失敗回預設開啟；寫入失敗保留可讀到的實際偏好，不假裝已儲存，顯示「瀏覽器無法保存此設定」。這些失敗不阻斷登入或導航。無新增 API、權限、伺服器資料或外部請求。

## 設計與保留範圍

遵循既有第三份 Figma 00 共用設定開關的式樣及 Vue／legacy 宿主，沒有重畫布局。第三份本輪仍受唯讀／Starter 工具額度限制，尚未同步此新增設定與流程，不宣稱已完成 Figma。測試站／正式站文件仍以各環境實際部署版本更新。

沒有更動郎中藥材／特效藥圖像、藥材書、玩法庫存，或畫猜 renderer／同步。本輪不把設定操作測試外推為所有遊戲全流程或持筆時序回歸。

## 實際驗證

- Windows Node 22.23.3：進頁／auth VM 回歸 20/20，包含預設、損壞資料、storage 拒絕、跨頁持久化、BFCache、跨分頁、關閉 timer／observer、啟用後不立即重播、原有 skip／Esc／reduced-motion 及登入立即完成。
- `npm run test:affected` 因共用入口／未知路徑回退完整 271 個檔，首輪 2,537/2,537 通過；補強損壞資料的保存狀態後再跑最終完整套件，結果附 PR，不略過回退測試。
- 前端 6/6、vue-tsc／Vite build 通過。
- 原生 Vue：1920×1080、390×844、深淺色四組設定畫面；手機 label 44px、switch 36×22px、Space 可切換且焦點可見，沒有水平溢出。
- 原生 Vue：關閉後跨 profile 路徑與重新整理，dialog hidden=true、open=false，display=none；錯誤登入表單仍可見，成功登入約 681ms 到大廳。重新開啟後一般開場恢復；登入演出期間仍在 /login、僅一個原始圖片、其他表單 hidden，目的頁開場保持關閉。
- 原生 legacy：獨立隔離資料登入，設定開關、關閉後跨 profile 與重新整理均觀察到 intro hidden=true、open=false。

所有瀏覽器測試使用隔離本機測試帳號／資料，關閉外部副作用；帳密、session、資料庫、截圖及測試輸出只留忽略目錄。真實觸控、Safari、實際註冊／重設密碼與原生 BFCache 命中本輪未新增驗收；註冊共用成功呼叫端已讀取，BFCache／storage 錯誤由 VM 回歸覆蓋，不冒稱原生實測。

本批保持 Draft，尚未合併／部署；固定 head 雙平台 CI 與兩輪合併審查依 AGENTS.md 執行。
