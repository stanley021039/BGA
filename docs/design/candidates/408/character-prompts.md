# 角色生成提示詞與來源

使用內建 `image_gen`，不是 CLI／API fallback。2026-11-14 最終角色改為三十位、各六表情，共 180 張透明 WebP，清單見 [character-additions.json](../../../../public/shared/character-additions.json)。原始總圖複本保存在本機 `work/scene-bots-408/sources`；每張總圖的來源檔名與 SHA256 也記於清單。舊十位 Kenney 角色已退出選單並移除公開圖檔，舊 ID／網址僅轉接新角色，不再提供舊圖。測試夾具中的四份 PNG／GIF 只驗證上傳及還原，不屬於執行期角色。

下列整理最終生成／修訂的提示詞組。各輪只變更使用者指定細節，角色名稱後來另外改為使用者指定名稱，沒有重新生成圖像。照片只作造型參考，沒有辨識照片中人物。

## 共通規格

```text
Game-ready transparent chibi expression sheet, 1536x1024 landscape, EXACT three equal columns and two equal rows. SIX copies of the SAME full-body standing character with exactly the same outfit, body proportions, pose, size and feet baseline. Only facial expressions change: top row neutral, happy, sad; bottom row surprised, thinking, angry. All hands, feet and props safely inside each square cell with at least 8–10% padding. Genuine transparent alpha outside silhouettes; NO background, floor, ground, shadow, halo, labels, grid or text. Friendly chunky illustrated chibi game-sprite style, about 2.5 heads tall, clear readable silhouettes with gentle shading, compatible with the supplied game character style reference.
```

風格參考為原有 `traveler-neutral.png`。人物照片及使用者提供的死靈模型照片僅留在原位置，沒有放進公開素材。

## 最終主題與修訂

| 顯示名稱 | 生成／修訂要點 |
|---|---|
| 光頭黑人 | 約三十歲成年黑人男性，光頭、成熟下顎與淡鬍渣、青綠 T 恤、深色長褲、淺色鞋；雙臂加入黑灰幾何刺青，沒有文字或幫派標誌。 |
| 川寶 | 川普風格金色梳髮、寬圓臉、淡眉，深藍西裝、白襯衫、紅領帶；沒有旗幟或政治標語。 |
| 賴祥德 | 依使用者卡通參考的中分黑髮、粗眉與臉形，深色西裝白襯衫；只取造型，不推測人物身分。 |
| 動漫宅男 | 亞洲統神風格圓臉、短黑髮、黑框眼鏡、厚實身形；深藍 T 恤印原創、完整穿著的成年動漫女生圖案，米色短褲與球鞋。 |
| 太空死靈戰士 | Necron Warrior Q 版、綠光眼睛與高斯武器；依使用者模型色彩改深鐵灰骨架、暗銅裝甲與少量金邊，最後僅將頭骨／面甲改亮銀，身體維持暗色。 |
| 聖甲蟲終結者 | Thousand Sons Scarab Occult Terminator Q 版，藍金厚重裝甲、埃及式頭冠、眼部發光與放低的武器；以眼形呈現六表情。 |
| 歐克頭目 | Ork Warboss Q 版，綠皮、寬下顎與象牙獠牙、紅黑廢鐵肩甲、斧與機械爪；無血腥與底座。 |
| 吞世者 | World Eaters Khorne Berserker Q 版，紅銅裝甲、雙高冠頭盔、綠眼與鏈鋸斧；無血腥與底座。 |
| 極限戰士 | Ultramarines Q 版，藍金動力甲、紅眼、肩部白色 omega、胸前金色鷹飾與放低的爆彈槍。 |
| 習大大 | 習近平風格寬圓臉、整齊黑色側分、深藍西裝、白襯衫與酒紅領帶；沒有旗幟或政治文字。 |
| 機械修會技術神甫 | Adeptus Mechanicus Tech-Priest Q 版，深紅兜帽袍、米色齒輪邊、機械面罩、紅綠目鏡、齒輪杖與短機械附肢。 |
| 3槍阿館 | 館長風格成年壯碩男性，短黑髮、方下顎與短鬍、白色吊嘎、寬厚肩臂、幾何刺青、運動短褲與球鞋。 |
| 莊敬太監 | 依第一張照片保留黑髮、方框眼鏡、黑橘白橫條外套、金色配件；後續加圓臉頰、肚子與厚實四肢，移除吃東西的遮臉動作。 |
| 北投高金生 | 依第二張照片保留黑色分髮、牛仔外套與灰色連帽內搭；後續加些許不對稱眉形、略突出的鼻子與微不整齊笑容，僅作輕微憨厚化。 |
| 熊妹妹 | 依第三張照片保留齊瀏海、及肩深棕髮、臉形與白色圓領上衣，搭深色長褲與休閒鞋。 |
| 薛神 | 依第四張照片保留短黑髮、粗眉、灰色披毯、米色長褲、白色提袋與無品牌飲料罐，六表情同一姿勢與道具。 |

Warhammer 題材依使用者指定。官方系列資料參考：[Thousand Sons 資料表](https://assets.warhammer-community.com/eng_wh40k_index_thousand_sons_dec2024-nna7ybtvz3-uks2m2rhfs.pdf)；死靈配色以使用者附圖為準。

## 輸出與驗證

`tools/build-character-sprites.cjs` 讀取本機來源清單，以六格共同的 alpha 範圍裁切與統一縮放，保留透明度，輸出 256×256 WebP。清單包含穩定 ID、名稱、原稿 hash、裁切範圍及每張輸出 hash／容量。改名只改名稱欄位，角色 ID 與圖檔保持穩定。
