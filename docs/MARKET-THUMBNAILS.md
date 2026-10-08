# 股市圖片縮圖與私有快取（Issue #62）

2026-10-08 候選 v1.21.2，基準 main `dae903e3d6e0f3eebc7d6999aa00a64e4fec4042`。尚未合併、部署或操作正式資料。

## 契約與相容

- 卡片使用 `/api/market/images/:id/media/thumbnail`：最長邊 512px、等比例、不放大小图，WebP quality 78，極端輸出採一次400px／quality60回退。完整、已清除 metadata 的 PNG 仍使用原 `/media` URL，只在玩家點擊放大時載入。
- 每次進入／重抽維持五個 eager DOM 圖片槽；移除同一批 detached `Image` 預載。縮放只改 CSS 可見數量 1～5，不重建槽、不重新抽選。瀏覽器可合併相同 URL；不承諾五槽一定是五張不同圖。
- 原圖與縮圖都先核對登入帳戶、停用、owner/admin、核准狀態與存在性，才處理 If-None-Match。縮圖非同步讀檔後再次核對權限與原圖摘要。
- 成功回覆使用 `Cache-Control: private, no-cache, must-revalidate`、`Vary: Cookie`、SHA-256 ETag；有效條件請求回空 body 304。private 不表示已下載內容可遠端收回；撤下／刪除／停用後的新讀取仍拒絕，不以已知 ETag繞過授權。
- schema 19、原 PNG BLOB、公開 metadata shape、既有 upload/approval receipts 與匯入／匯出格式保持不變。

## 衍生快取與既有資料

`<DB_FILE>.market-thumbnails/` 是可重建的私有衍生快取，不是 SQLite 的替代資料來源，也不是 public 靜態目錄。檔名由原大小寫 image UUID、UUID SHA-256、原 PNG SHA-256、codec revision 決定（大小寫不同的合法匯入ID在Windows檔案系統亦不只靠大小寫區別）；檔內保存 SHA-256 校驗頭和 WebP bytes。目錄／檔案建立模式分別 0700／0600。

新上傳在寫入前生成縮圖；原資料交易成功後以暫存檔＋rename保存，失敗不重複上傳／變更已提交收據，由背景工作恢復。圖片 encode與原上傳共用最多兩個解碼名額，每次10秒timeout。縮圖單張上限512KiB，快取依圖片總額度最多1,000檔（約500MiB內容，加校驗頭與有界在途暫存檔）；写入串行。檔案系統外部寫入不是快取授權介面。

伺服器開始 listen 後才排程背景掃描，不 await 轉換來阻塞啟動。每次最多1,000來源、一張一張處理並yield；每60秒重試失敗或缺漏。有效已存縮圖不重編碼；校驗失敗可重新生成。刪除或替换原圖後按最新DB狀態清理舊衍生檔；一小時以上孤立tmp於掃描時清理。關閉時取消下一輪並等待在途工作，再關DB。

GET不編碼、不排重複轉碼工作、不回退傳完整PNG。冷快取／轉換尚未完成時回503；前端同一圖片槽按1／3／10／30秒有界重試，不重抽；成功原地恢復，耗盡顯示可讀文字讓使用者更新，仍可主動點擊原圖預覽。切換分頁／離頁／換圖／替換節點會取消舊callback；相同URL的五個槽有獨立有界預算。這是初次建立或修復期間的暫時限制。備份只需既有受驗證的SQLite原資料，還原後重新生成縮圖；回退舊程式可忽略此目錄，不需DB降版。快取不應另行公開或掛成靜態資源。

## 測試證據

所有資料為隔離fixture；沒有正式站流量、耗時或節省比例結論。固定base/head的兩回合自查與CI結果於Draft PR另記，文件本身不自我引用其commit。

實作階段環境為Linux、Node24.19.0、lock檔的sharp0.35.5／libvips8.18.7，`npm ci --ignore-scripts --cache /tmp/bga-image-npm-cache`安裝成功。`npm run release:check -- --base dae903e3d6e0f3eebc7d6999aa00a64e4fec4042 --type patch`、五個修改JS語法檢查、`git diff --check`通過。

- 最終 `npm test`：1,773項，1,772 pass／1 fail／0 skip，41,920ms。不能寫成全套通過。
- 唯一失敗為既有`tests/web-features.test.js`的`/api/info`：此環境`os.networkInterfaces()`拋`uv_interface_addresses`錯誤，回HTTP500。同一測試在完全未修改的固定base `dae903e`重現，未改產品程式或mock掉環境限制來宣稱通過。
- 原生Node＋真loopback HTTP的image store／endpoint focused：40/40；含session撤銷／到期於非同步讀檔期間返回401，以及304保持image MIME／CSP／CORP。獨立後端審查另驗快取寫入競爭、容量及清理。
- frontend VM：79/79，檢查URL賦值、五槽、不重抽、預覽開關及冷縮圖回復／失敗／重複ID／離頁／陳舊callback。這不是原生瀏覽器網路或視覺驗收。
- 原生browser證據／限制在Draft PR列出；尚未取得的桌機／手機、真cache行為與截圖不能標成通過。

已量測可重現1280×720 seeded noise JPEG上傳：canonical PNG 3,109,417 bytes；512×288 WebP 56,652 bytes（此fixture約少98.18%）。這是實際bytes，不是正式站效能指標，也不是每張圖都同樣比例。

新增測試涵蓋尺寸／比例／bytes、缺縮圖GET503、持久快取重開不改mtime、損壞恢復、原BLOB與收據驗證保持、背景失敗重試／關閉、非同步讀取中撤下／刪除／停用／admin降權、兩變體ETag304且無body、陌生會員／登出／已撤下已刪除帶ETag仍拒絕。

## 審查中修正

Q1：縮圖await之後再驗session，避免logout／expiry競態回304或body。Q2：高熵alpha的合法PNG可能產生超過256KiB的WebP，改為512KiB上限並提供一次400px回退，保留透明度；新圖及既有圖回歸通過。Q3：將image MIME／CSP／CORP移至304判斷前，避免JSON預設header污染快取。另修正合法大小寫不同image UUID的衍生鍵碰撞；schema／原BLOB不變。這些是本次開發過程發現並修正的問題，不代表已存在正式版縮圖功能。
