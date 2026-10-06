# 圖片角色與表情素材規格

## 2026-10-06：表情音效實作契約（v1.2.0正式）

本次按角色的自訂表情實作；作者可為已存在且非neutral的自有角色表情設定、試聽或移除一段音效。分享角色時同一音效供選用者發送；所有五款遊戲與好友大廳沿用表情事件送出，不新增聲音輪詢。個人開關及音量使用現有AudioSettings.effects；emoji彈幕原本功能不變。Windows、Linux、背景Chrome及正式切換已完成驗收，詳下方證據。

操作：開啟「我的角色」，選擇自己上傳的角色及一個已有圖片的表情，在「表情音效」上傳音檔；可用試聽及移除按鈕管理。平常表情不設定音效。收聽者在右上角設定開啟「遊戲音效」，用同一個音量滑桿調整；發送表情時一起播放，超過10秒的檔案會拒絕上傳。

| 項目 | 契約 |
| --- | --- |
| 匯入及格式 | 瀏覽器decode可支援的音檔（MP3/WAV/OGG/M4A等，依瀏覽器），原始檔最多10MiB；拒絕超過10秒，不自動截短。轉為24000Hz、mono、PCM16標準44-byte WAV頭，最大480044 bytes。server以RIFF/fmt/data及真sample數再次驗10秒，忽略客戶端宣稱長度。 |
| 持久化 | schema14的character_sounds，以(character_id,expression)為主鍵及character_images複合FK，刪除角色／表情連帶清音效；存mime、bytes、duration_ms，不新增磁碟媒體路徑。圖片替換保留該表情既有音效。 |
| 作者API | POST /api/profile/characters/<uuid>/expressions/<expression>/sound，JSON {base64}（canonical WAV）；POST同路徑/remove，JSON {}。只作者可寫，neutral或不存在表情拒絕；remove可重送。 |
| 列表／事件 | character.sounds[expression]={url,durationMs}，沒有bytes/base64。selectedImage回傳可選sound；room expression及lobby emote帶sound={url:帶v內容hash的資源URL,durationMs}，沒設定則不帶。 |
| 資源與權限 | /assets/characters/sounds/<uuid>/<expression>?v=<hash>；登入、作者／分享，或同房／有效大廳範圍实际收到的表情音效才可讀。grant綁原bytes及觀看範圍，最多表情at+10秒+2秒寬限；fetch不加入／延長presence，改音效後舊URL不能讀新bytes。 |
| 播放 | 共用ExpressionSounds只播新事件一次；首次載入、重連、隱藏及離房不補播。尊重effects開關／音量，最多4個效果重疊，最長10秒停止並清理；mute／visibility停止，失敗不影響表情圖片。作者按試聽是明確手勢，使用共用音效音量。 |
| 移轉 | schema14必須含sound表，備份還原保存bytes／長度及FK；v1–13只在目標副本新增空sound表，來源／既有帳戶與BLOB不變。新schema不能直接交舊程式啟動。 |

整合驗收：Windows Node24.14.0完整 **727/727**，失敗／取消／跳過0，約24秒，證據`work/expression-sound-windows-tests.log`。新增64項包含strict WAV及owner／ACL、4項HTTP、客端編碼／播放／profile、原聲音控制與v1–13移轉增量。客户端音效最多4段、10秒載入timeout與實際開播後最多10秒deadline分開，避免慢載入吃掉短音效；mute／hidden／reset後的晚play promise不重新開timer。試聽停止會更新文字。獨立複查以真profile VM重現「A保存延後→切B上傳轉換→A晚回覆」導致B按鈕鎖住，已讓保存回覆綁selection generation，B仍上傳一次並恢復操作。

背景Chrome在隔離localhost3210、正常1794×1010、三個合成帳戶：一席UI真正選檔，48000Hz的11秒WAV被拒、10秒WAV轉成24000Hz後保存；試聽GET200 audio/wav、移除後metadata消失，再上傳1秒音效並確認「試聽已停止」。一席收聽UI配合另一帳戶API發送，撲克房與好友大廳各只載入一次帶hash音效URL，靜音時音效GET0；其他遊戲由共用GameShell與各頁載入／回歸驗證，未宣稱五款都重新完整實玩。沒有新console error。首次／背景／重連／去重／四段上限由真模組VM另驗，沒有聲稱實際揚聲器或GPU／弱網測試。私有圖`work/expression-sound-profile-final.jpg`，去敏network證據`work/expression-sound-{preview,room,lobby,muted}-network.json`；QA已正常停止。這次真瀏覽器匯入只測WAV，MP3／OGG／M4A接受度依瀏覽器decoder，不以副檔名保證。Windows Node24.14.0 **727/727**（24185ms）、Linux Node22.22.1 **727/727**（125824ms），失敗／取消／跳過均0。私有全套證據為 `work/expression-sound-{windows,linux}-tests.log`。

正式發布：受測程式 `9b1fdd4148ea9e1ceec5215f8ca112ffd99cd893` 與本地 annotated tag `v1.2.0`；正式 current `releases/9b1fdd4`，零房間切換，PID 48811→50471，service／tunnel active。正式 schema14、integrity ok、外鍵錯誤0，原7帳戶全欄位完整保留；預演時15張既有表逐列一致，只新增空 `character_sounds` 第16表。匿名 no-store 版本API、既有session、7份HTML及14份資源比對通過，背景Chrome設定顯示「版本 v1.2.0」。公開比對證據 `work/version-production-verification.json`，設定截圖 `work/expression-sound-production-version.jpg`。正式站只作既有session／版本／資源及資料完整性驗收，音效上傳及多人事件測試使用上述隔離fixture。

發布包 SHA-256 `09eb447659e3fe2c5336ed5d2b2623c950059c2de4c2b59981319cc442cf6364`；切換前備份 `/home/ccc/apps/afterhours/shared/backups/pre-party-9b1fdd4-20261006T034156Z`（UTC）。SQLite線上備份與持久檔案另存，不宣稱同一原子時間點；備份來源schema13、正式啟動升schema14，回退不能直接用舊程式開schema14。無新PR／push；本段為純驗收文件，不移動v1.2.0 tag。

## 目前實作

角色外觀 JSON 為 `{ "version": 5, "characterId": "builtin:traveler", "expression": "neutral" }`。角色是一組完整圖片，不再拼接衣服、褲子或共用身形。內建角色仍使用 `neutral`（平常）、`happy`（開心）、`sad`（難過）、`surprised`（驚訝）、`thinking`（思考）、`angry`（生氣）六個固定代碼。玩家上傳角色以 `neutral` 作為主角色圖片，另可新增最多六個自訂名稱的圖片表情，表情 ID 為 `emote-<UUID>`；表情名稱與 ID 分開保存。既有固定表情上傳會保留並可顯示。介面只列出實際有圖片的表情。遊戲座位的角色圖由 `/characters/<會員 ID>` 提供，會顯示該會員目前保存的角色與表情。

初始 10 位角色取材自 Kenney 的 [Toon Characters](https://kenney.nl/assets/toon-characters) 與 [Platformer Characters](https://kenney.nl/assets/platformer-characters)；兩個下載包的 `License.txt` 都標示 CC0。專案將原始姿勢圖片對齊為 **256 × 256 透明 PNG**，並把兩張歡呼姿勢組成循環 GIF。前六位有六種表情，後四位有平常、開心、難過、生氣四種。生成腳本是 `scripts/build-character-assets.py`，需自行下載並解壓官方素材包才能重建；網站執行不依賴該腳本。素材保留不同藝術風格，不強制使用單一身形。

主角色與自訂表情圖片都接受 **PNG、GIF、WebP**；靜態圖片和動畫都可使用。圖片都透過 `<img>` 顯示，不執行使用者程式碼。上傳單張限制 1 MB，不限制像素寬高；伺服器檢查檔案標頭、有效的正整數尺寸與宣稱的 MIME，不接受 SVG、HTML 或外部網址。

玩家可建立最多 10 個自己的角色。角色頁上傳介面分成 A「主角色」與 B「新增表情」：先上傳主圖片並選擇自己的角色，再輸入 1–20 字的表情名稱與 PNG、GIF 或 WebP 圖片。相同角色不能新增同名表情；新增後在角色選單與遊戲表情按鈕顯示其名稱。圖片也可從本人帳號圖庫選用，無須重複上傳。

獨立的 `/studio` 是帳號繪畫圖庫，不預先指定用途。透明畫布預設 512 × 1024、寬高各可自訂至 1024 像素，支援滑鼠、觸控與鍵盤；圓形色輪、色號、常用色及最近 10 色可直接選色，並有滴管取色。筆刷大小、亮度、透明度及畫布檢視縮放使用滑桿；畫筆、直線、矩形、圓形／橢圓、填滿形狀、橡皮擦、復原／重做與清空可在同一畫面操作。可一次匯入多張 JPEG／PNG／WebP／GIF（GIF 取第一格）作為照片圖層，調整順序、顯示與透明度，再於上層繪圖。照片圖層可依邊角或點選的背景色移除相近、連續的純色背景，容差可調，原圖可還原；這是本機色彩去背，複雜照片與頭髮邊緣仍可能需要其他工具修整。儲存時會依目前尺寸將圖層與筆跡合成一張圖片；PNG 超過 1 MB 時嘗試以 WebP 降容，仍維持畫布尺寸。編輯中的獨立圖層不會持久保存；下載功能則輸出 PNG。桌機採左側常用控制、右側畫布；常用操作以圖示及滑鼠／鍵盤提示呈現，尺寸、色票與圖層設定可展開。已有的 PNG／GIF／WebP 可直接上傳圖庫。每位會員最多存 100 件、每張最多 1 MB。SQLite 版本 8 的 `user_artworks` 保存圖庫，圖片網址僅本人可讀，其他帳號不能引用。選作角色、表情或禮物時會複製圖片資料到該用途；刪除圖庫原圖不影響已經使用的圖片。

SQLite 版本 7 在 `player_characters` 增加 `shared` 欄位，舊作品遷移後預設為未分享。作者可自行開啟分享，所有已登入會員即可在「好友分享」圖庫選用角色及其表情；只有作者能新增或修改圖片、切換分享。未分享時作者仍能讀取全部圖片，其他會員僅能在同一房間或有效大廳在線範圍內，讀取實際保存的外觀圖片與當下發送的表情，不能因此讀取整組角色圖片。表情顯示 5 秒；已收到該表情的會員另有最多 2 秒的圖片載入寬限，仍須留在原觀看範圍，且權限綁定原始圖片內容，不能用來讀取後續替換的圖片。圖片讀取不會加入或延長大廳在線狀態。停止分享會在同一資料庫交易中把選用該作品的其他會員外觀改回預設；所有圖片回應使用 `Cache-Control: no-store`，但無法收回會員已下載的圖片。其他持久資料仍由 SQLite 備份。本站定位為受邀好友使用，依產品決策暫不加入公開作品市集、審核或檢舉流程。

舊版 v1／v2／v3 顏色組合會映射到原先最接近的 10 個 `builtin:` ID，v4 `skinId` 直接轉成同 ID 的圖片角色，表情預設為平常。舊造型細節不會保留；讀取時不覆寫資料，使用者再次保存後才寫入 v5。
