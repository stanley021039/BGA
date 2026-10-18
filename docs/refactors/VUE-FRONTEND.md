# Vue 多頁前端遷移

2026-10-19，候選 2.17.1。以 `a1cfde9` 建立獨立開發來源，產品程式基準與正式 2.17.0／`9f79b8d` 相同。本批完成建置與兩個頁面，尚未完成全站遷移。

## 架構與責任

`frontend/` 使用 Vue 3、TypeScript、SCSS、Pinia 與 Vite。每個 HTML 文件建立自己的 Vue app 與 Pinia，保持原有多頁網址；不使用 Vue Router。Node.js 保留遊戲規則、資料、REST 與既有 SSE。

| 路徑 | 責任 |
| --- | --- |
| `frontend/pages/` | 各頁 HTML，保留原有網址與頁首入口 |
| `frontend/src/pages/` | 頁面 Vue 元件與進入點 |
| `frontend/src/components/` | 共用圖示、送出按鈕、提示槽及成就卡 |
| `frontend/src/contracts/` | HTTP 邊界型別與執行時檢查 |
| `frontend/src/services/` | HTTP 與安全導向，不隱含重試或改動全域狀態 |
| `frontend/src/stores/` | session、preferences、achievements 分領域狀態 |
| `frontend/src/runtime/` | app／Pinia 掛載、離頁清理及 BFCache 恢復 |
| `frontend/src/styles/` | SCSS tokens、mixins 與已遷移樣式 |
| `src/http/frontend.js` | 受控文件與建置資產服務，沿用原後端權限檢查 |

密碼與輸入草稿只在頁面元件內短暫持有，不存 Pinia、localStorage 或 sessionStorage。登入者資料由 session store 持有；持久登入仍由原 HttpOnly cookie 負責。

preferences store 暫時訂閱既有 ColorScheme、MotionPolicy、AudioSettings，維持單一設定擁有者及既有儲存格式。共用舊頁首留在 Vue 根節點外；Vue 與舊程式不共同管理同一個表單或成就清單。

## 本批已遷移頁面

- `/login`：登入、邀請碼註冊、重設密碼共用 Vue 表單；保留現有文案、圖片及驗證 API。加入操作防重、鍵盤切分頁、失敗保留輸入與固定提交／提示槽。返回網址白名單涵蓋 11 款遊戲房間、股市及既有功能頁，保留站內 query，拒絕外站與含控制字元的網址。
- `/achievements`：成就清單、遊戲／解鎖篩選、取得日期、暫停授予註記、空結果及錯誤重試，由 Vue 與獨立 Pinia store 處理。使用原圖示 registry，內容採 Vue 文字插值。

登入及成就保留既有視覺 CSS，成就樣式移入 SCSS；其餘公開樣式仍未全面遷移。登入卡片同時固定寬高槽位，註冊欄位在卡片內捲動；成就清單使用固定內容與重試槽，避免篩選改變面板尺寸。

## 題庫、音樂與說明頁遷移（2026-10-19）

- `/draw-words`：題材／難度投稿、別名、正規化搜尋、分類與來源篩選、分批載入。
- `/gifts`：分類投稿、1 MB 圖片驗證、圖庫選圖、預覽移除、搜尋及分批載入。
- `/music`：20 MB 音檔、瀏覽器時長解析、原有二進位上傳協定、搜尋、原生播放器、音量設定綁定與擁有者刪除入口。

- `/community`：留言／題庫分頁、搜尋分類、狀態篩選、三種題型投稿、收藏、回覆及管理者狀態入口。GitHub 結果未確認時保留相同 submission ID，確定失敗才重建，草稿保留。
- `/credits`、`/rules?game=poker`：原有內容直接轉為 Vue template；保留規則頁預設導向雷霆教學，更新前端軟體授權說明。

這些頁面的清單與互動由 Vue 管理，不載入原頁面控制腳本。Pinia 以 `library.words`、`library.gifts`、`library.music` 分領域管理遠端資料；輸入草稿保留在元件。共用 ResourcePanel、ArtworkPicker、AudioPreview 及 requests/resource/mutation composables 處理固定槽位、離頁取消與較舊回應忽略。文件清單集中於 `frontend/pages.json`，供 Vite 與後端共用。

### 共用字級與間距來源

參考 [Stitch 最終稿 00｜共用元件／C05](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=1163-656) 的具名規範，採用 Display 32/900、H1 24/800、H2 20/800、P1 18/700、P2 16/500、P3 14/500。畫布已縮放，不能把顯示的 12.031px 等比例數值直接當成網站最小字級。以規範標示的數值為準。SCSS 提供 `tokens.type()`，目前 foundations 套用至已遷移的根節點 `.vue-page`。

間距以 4/8/12/16/24/32/40px 共用刻度整理；C05 的 6.875/10.313/13.75/20.625/27.5/34.375px 佈局間距經縮放比例還原，對應 8/12/16/24/32/40px。4px 保留既有細間距用途。一般頁面面板間距與內留白為 24px，窄螢幕為 16px。此處不推定其他遊戲的欄寬或直接搬用 C05 展示板的尺寸。

桌機題庫左右面板使用共同高度；表單長內容在區塊內捲動，提交按鈕及訊息保留槽位。窄螢幕換成單欄，投稿表單依內容展開。既有色彩、圖片及媒體樣式仍逐頁保留，不代表全部舊 CSS 已完成遷移。

## 建置與啟動

在專案根目錄執行：

```sh
npm run frontend:install
npm run frontend:build
FRONTEND_ENABLED=true npm start
```

`frontend:build` 先以 `vue-tsc --noEmit` 檢查型別，再執行 Vite。套件固定於 `frontend/package-lock.json`，與後端依賴分開。建置輸出在 `frontend/dist/`，不納入 Git。

`FRONTEND_ENABLED` 預設為 `false`，此時保留全部原頁面。啟用時只替換已列入 registry 的頁面，其他頁面仍由原後端提供。啟用前必須建置；缺少輸出時啟動會失敗，避免靜默混用頁面。後端在啟動時讀取文件與資產索引，重建後需重新啟動服務。

Vite 產生的 `/frontend-assets/` 僅提供明確檔名與允許類型，支援 GET／HEAD；未知資產回 404，不回傳 HTML。API、角色、音樂、收藏與市場圖片的權限路由維持原責任。舊 `public/` 不清空，因後端仍引用其中的賽道路徑及股市純計算模組。

開發時先啟動本機後端於 3140，再執行：

```sh
npm --prefix frontend run dev
```

Vite 依 `frontend/pages.json` 將已遷移路徑導向各自 HTML，其餘舊頁、API 與素材代理到本機後端。代理只對來自該開發站自身的 Origin 做對等轉換；其他 Origin 保留給後端檢查。開發伺服器綁定 loopback，實際驗收使用後端提供的建置輸出。

## 驗證結果

已在獨立資料的測試環境驗證：

- `vue-tsc`、Vite 正式建置、Vite 開發文件路由／HMR 注入與後端代理、版本一致性及差異空白檢查。
- 瀏覽器成功登入進入原大廳、從新登入頁返回畫猜原座位，以及帳密錯誤、註冊密碼不一致及無效邀請碼處理。
- 登入／註冊的桌機及窄螢幕尺寸；320px 與 1280×720 的面板、按鈕、提示槽在兩模式一致，無頁面水平溢出。390px 的註冊長表單在面板內捲動。
- 成就 API 真實 18 筆、分類 3 筆、已解鎖空結果、固定面板尺寸；Fetch 失敗提示及重試恢復，320px 無水平溢出。
- 編譯資產非空、HEAD、未知檔案 404、文件／API 登入限制；11 款原遊戲建房、個人狀態與帳號重連；停用前端旗標時舊登入頁仍可提供。

本批未執行既有測試套件。有效邀請註冊成功、有效連結重設密碼成功、實體手機觸控、完整可及性與全部遊戲完整對局尚未驗收。舊遊戲 API 檢查不代表其完整玩法通過。

### 本次新增實際驗證

- 題庫：實際投稿、別名搜尋、來源／題材選項及空結果；桌機兩面板等高、24px gap／內距。
- 禮物：實際文字及圖片投稿、預覽與搜尋；載入請求失敗後中文提示與重試，面板外框尺寸一致。首次失敗後重試會正確回填投稿分類。
- 音樂：自製兩秒 MP3 實際上傳，原生播放的 readyState 4、duration 2、paused false、error null；中斷二進位上傳後保留草稿，重試上傳成功。
- 同頻題庫：實際三選一投稿、搜尋及收藏。GitHub pending／failed／網路錯誤以瀏覽器攔截回應驗證，確認防重 ID 重用／重建與草稿保留；未發出真實 GitHub Issue。
- 留言／題庫分頁在 1280×720 與 320px 的面板、送出按鈕頁面座標一致。八個已遷移頁面於 320px 及桌機內容區未發現小於 14px 文字或頁面水平溢出。
- 八份建置文件與 21 件共用資產從測試後端成功提供，資產非空且 HEAD 正確。原規則頁無 poker query 的教學導向保留。

尚未驗收：GitHub 真實提交成功、既有留言的回覆／管理者狀態成功、音樂刪除、所有圖片格式與極限大小、實體手機觸控及所有遊戲完整對局。瀏覽器視窗尺寸驗證不等於實體裝置驗證。原頁首與多數遊戲樣式仍由舊模組提供。

## 剩餘遷移

先完成共用房間 snapshot 與命令契約、取消／時序處理及房間元件，再處理畫猜完整對局。保留現有繪圖工作階段、ACK／SSE、逐點播放與 renderer 行為，另驗持筆不中斷及換輪。之後依序擴展其他遊戲、股市與剩餘帳號／題庫／媒體／管理頁面。

在全站搬移與完整驗收完成前，不能把這八頁遷移當成整站 Vue 重建完成。
