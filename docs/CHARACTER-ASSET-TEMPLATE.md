# 圖片角色與表情素材規格

## 目前實作

角色外觀 JSON 為 `{ "version": 5, "characterId": "builtin:traveler", "expression": "neutral" }`。角色是一組完整圖片，不再拼接衣服、褲子或共用身形。每組角色最多對應六個表情：`neutral`（平常）、`happy`（開心）、`sad`（難過）、`surprised`（驚訝）、`thinking`（思考）、`angry`（生氣）。只有平常表情必填；其他欄位可以缺少，介面只列出實際有圖片的表情。遊戲座位的角色圖由 `/characters/<會員 ID>` 提供，會顯示該會員目前保存的角色與表情。

初始 10 位角色取材自 Kenney 的 [Toon Characters](https://kenney.nl/assets/toon-characters) 與 [Platformer Characters](https://kenney.nl/assets/platformer-characters)；兩個下載包的 `License.txt` 都標示 CC0。專案將原始姿勢圖片對齊為 **256 × 256 透明 PNG**，並把兩張歡呼姿勢組成循環 GIF。前六位有六種表情，後四位有平常、開心、難過、生氣四種。生成腳本是 `scripts/build-character-assets.py`，需自行下載並解壓官方素材包才能重建；網站執行不依賴該腳本。素材保留不同藝術風格，不強制使用單一身形。

建議新作品用 **PNG** 保存靜態表情、**動畫 WebP** 保存短動畫。WebP 支援透明與動畫，通常比 GIF 更省空間；為了讓玩家現有作品易於使用，上傳也接受 **GIF**（含動畫）。這三種格式都可透過 `<img>` 顯示，不需執行使用者程式碼。上傳單張限制 1 MB、寬高各 16–512 像素，伺服器檢查檔案標頭、尺寸與宣稱的 MIME；不接受 SVG、HTML 或外部網址。

玩家可建立最多 10 個自己的角色，建立時上傳平常表情，再逐一新增或替換其餘表情。資料以 SQLite 的 `player_characters` 與 `character_images` 表保存，和帳號資料一起備份。作品目前只出現在作者自己的角色選單；已入座的其他會員可看到作者選用的圖片，但沒有公開作品市集或審核流程。正式公開共享前還需加入授權、審核與檢舉政策。

舊版 v1／v2／v3 顏色組合會映射到原先最接近的 10 個 `builtin:` ID，v4 `skinId` 直接轉成同 ID 的圖片角色，表情預設為平常。舊造型細節不會保留；讀取時不覆寫資料，使用者再次保存後才寫入 v5。
