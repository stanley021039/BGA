# 角色圖片上傳上限

2026-10-07，正式 **v1.5.8**／`470ab26`。角色主圖、自訂表情及既有固定表情單張接受最多 4,194,304 bytes（介面標示 4 MB），支援 PNG／GIF／WebP。角色頁的選檔與拖放、收藏庫的角色上傳都同步調整；獨立頭像、圖庫及禮物維持 1 MB。

| 範圍 | 實作與驗收 |
| --- | --- |
| 共用解碼 | `imageOf`／`imageForRequest` 預設仍為 1 MiB；只有三個角色圖片寫入操作明確傳入 4 MiB。base64 預檢與實際解碼 bytes 都驗上限；MIME、格式、ownership、分享及數量限制保留。 |
| HTTP | 只有建立角色及 UUID `/expressions`、`/emotes` 三路由放寬至 5,600,600 bytes，包含 canonical base64 與 8 KiB metadata 餘量。串流累計仍有限制，其他 POST 不擴大。 |
| 資料 | schema15 不變，角色仍保存 SQLite BLOB，沒有重編碼或壓縮。移轉工具維持總量限制及舊版頭像規則。 |
| 驗證 | 背景 Chrome 真選檔成功建立角色、新增表情及從收藏庫上傳角色，三張持久圖片皆為 4,194,304 bytes／相同 SHA-256；超過 1 byte 在表情及收藏庫介面拒絕，獨立頭像維持 1 MiB。三個角色寫入路由、超限不覆蓋、generic isolation／串流 body 邊界及加密備份還原加入回歸；Windows／Linux各889，正式三路由及真Chrome上傳通過。 |

本輪沒有新增 PR 或 push。先前正式版 v1.5.7 已由下方 v1.5.8 發布取代。

Windows Node24.14.0 完整 **889/889** 通過（30470.8934ms，fail／cancel／skip0），日誌 `work/character-images-windows-tests.log`。6項新增回歸包括有效 PNG 的獨立 CRC／zlib 解碼、trusted limit／canonical base64、三路由 exact4MiB/+1及權限、generic圖片1MiB隔離、串流 request cap及12MiB角色組完整加密備份還原。Linux Node22.22.1以乾淨Git archive複驗 **889/889**（151323.216595ms，fail／cancel／skip0），日誌 `work/character-images-linux-tests.log`。

## 背景瀏覽器

隔離 localhost3226、合成會員 alignment_guest，使用有有效 CRC／zlib IDAT 的 1×1 PNG，以合法 ancillary chunk 精確補到 4 MiB 及 4 MiB+1，不以破損標頭冒充有效測試檔。角色頁主圖與表情、收藏庫角色各一次實際 file chooser＋提交成功；表情及收藏庫超過 1 byte 都提示 4 MB，未新增角色；獨立頭像上傳同一 4 MiB 檔案仍提示 1 MB。角色圖 `<img>.decode()` 通過，console error0；返回圖片逐 byte/hash一致，證據 `work/character-images-local-verification.json`。測試 tab、server 已關閉，沒有改變使用者正式站登入或提高 Chrome 視窗。

程式角色獨立盤點指出 `imageForRequest` 也被禮物使用，`collection.readImage` 同時處理頭像，還原驗證共用 `MAX_BYTES` 限舊版頭像。最終採用途參數，只在角色呼叫端提高上限；圖片資源 ACL、音效 10 秒及總量規則維持原契約。沒有新增像素尺寸限制或 DB migration。

## 正式發布及公開驗收

受測程式及不可覆寫本地 annotated tag `v1.5.8` 為 `470ab26955a41368eac29fdf6bc2d5d817dd9bd0`；發布 archive SHA-256 `8b211f0f3c75d258ef21801c922358e8ab3683eacfc16befba18e0ff886e8465`。release:check以v1.5.7驗patch，schema15不變；本機私人文件、work及env未納封存。

正式備份 `/home/ccc/apps/afterhours/shared/backups/pre-character-images-fixes-470ab26-20261006T200523Z-7f695a64-2e3b-4dfd-88cd-5ff211808356`：SQLite一致性線上備份，持久檔及env另備，非跨檔原子冷快照。候選副本啟動前後21表schema／rows／BLOB一致、8帳戶全欄位保留。0房間切換至 `releases/470ab26`，核對舊PID78591後SIGTERM，既有服務重啟至80949；service／tunnel active，env及原資料路徑保留，integrity ok／FK0，外站匯入資料代未啟用。

公開版本v1.5.8／no-store、profile及collection共4份HTML／JS逐字正規化比對及實際text/javascript MIME通過。背景Chrome透過僅loopback代理使用既有合成會員，實際請求公開shhuang.cc，不改使用者Chrome正式登入。使用內建256×256 PNG加合法ancillary padding至4 MiB，真選檔＋建立主角色成功，`img.decode()`確認256×256；另以API新增固定與自訂表情，每張返回4,194,304 bytes／SHA-256 `bd0420463a67046edd069e65d0f3f921cf318f1b719348e9de2631bb8f8b7c2d`，與原檔完全一致。4 MiB+1替換固定表情回400／INVALID_CHARACTER_IMAGE且原圖不變。證據 `work/character-images-public-verification.json`，上傳區域成果截圖 `work/character-images-public-final.jpg`；console error0。

測試角色與三張圖片已依精確own fixture ID清理、原角色列表與profile一致，測試session已登出、proxy及tab關閉、viewport已還原，公開0房間。最後20張非session表的schema／所有rows／BLOB與新鮮備份完全一致，全部21表schema與8帳戶全欄位保留。session表因一次測試登入／登出由145至146列，沒有宣稱全表逐列不變。證據 `work/character-images-final-data-check.json`。真瀏覽器大檔本輪測PNG；没有另外重驗4 MiB GIF／WebP或手機選檔，格式及MIME驗證契約仍由既有及本輪回歸保護。後續純驗收文件不移動tag。
