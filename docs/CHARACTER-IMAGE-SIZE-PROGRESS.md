# 角色圖片上傳上限

2026-10-07，候選 v1.5.8。角色主圖、自訂表情及既有固定表情單張接受最多 4,194,304 bytes（介面標示 4 MB），支援 PNG／GIF／WebP。角色頁的選檔與拖放、收藏庫的角色上傳都同步調整；獨立頭像、圖庫及禮物維持 1 MB。

| 範圍 | 實作與驗收 |
| --- | --- |
| 共用解碼 | `imageOf`／`imageForRequest` 預設仍為 1 MiB；只有三個角色圖片寫入操作明確傳入 4 MiB。base64 預檢與實際解碼 bytes 都驗上限；MIME、格式、ownership、分享及數量限制保留。 |
| HTTP | 只有建立角色及 UUID `/expressions`、`/emotes` 三路由放寬至 5,600,600 bytes，包含 canonical base64 與 8 KiB metadata 餘量。串流累計仍有限制，其他 POST 不擴大。 |
| 資料 | schema15 不變，角色仍保存 SQLite BLOB，沒有重編碼或壓縮。移轉工具維持總量限制及舊版頭像規則。 |
| 驗證 | 背景 Chrome 真選檔已成功建立角色、新增表情及從收藏庫上傳角色，三張持久圖片皆為 4,194,304 bytes／相同 SHA-256；超過 1 byte 在表情及收藏庫介面拒絕，独立頭像維持 1 MiB。三個角色寫入路由、超限不覆蓋、generic isolation／串流 body 邊界及加密備份還原加入回歸；兩平台全套與正式發布尚待完成。 |

本輪沒有新增 PR 或 push。正式版本及發布證據以後續驗收段落為準；先前正式版為 v1.5.7。

Windows Node24.14.0 完整 **889/889** 通過（30470.8934ms，fail／cancel／skip0），日誌 `work/character-images-windows-tests.log`。6項新增回歸包括有效 PNG 的独立 CRC／zlib 解碼、trusted limit／canonical base64、三路由 exact4MiB/+1及權限、generic圖片1MiB隔離、串流 request cap及12MiB角色組完整加密備份還原。Linux及正式發布待完成，不能把此數字當成兩平台皆驗。

## 背景瀏覽器

隔離 localhost3226、合成會員 alignment_guest，使用有有效 CRC／zlib IDAT 的 1×1 PNG，以合法 ancillary chunk 精確補到 4 MiB 及 4 MiB+1，不以破損標頭冒充有效測試檔。角色頁主圖與表情、收藏庫角色各一次實際 file chooser＋提交成功；表情及收藏庫超過 1 byte 都提示 4 MB，未新增角色；獨立頭像上傳同一 4 MiB 檔案仍提示 1 MB。角色圖 `<img>.decode()` 通過，console error0；返回圖片逐 byte/hash一致，證據 `work/character-images-local-verification.json`。測試 tab、server 已關閉，沒有改變使用者正式站登入或提高 Chrome 視窗。

程式角色獨立盤點指出 `imageForRequest` 也被禮物使用，`collection.readImage` 同時處理頭像，還原驗證共用 `MAX_BYTES` 限舊版頭像。最終採用途參數，只在角色呼叫端提高上限；圖片資源 ACL、音效 10 秒及總量規則維持原契約。沒有新增像素尺寸限制或 DB migration。
