# 2026-11-14 角色修訂與提示詞組

使用內建 image_gen，未使用 CLI／API fallback。移除舊十位，新增十四位並重修兩位，最終保留三十位、180份六表情 WebP。完整來源檔名、SHA256、裁切範圍與每張輸出雜湊見 `public/shared/character-additions.json`；生成原稿與使用者照片留在工作區，不將照片放進公開素材。

## 共通生成規格

```text
Production game sprite sheet, polished chunky 2.5-head-tall chibi with gentle painted shading and a readable silhouette. Exact THREE equal columns and TWO equal rows, landscape 1536x1024. Six full-body copies of the SAME character, outfit, props and standing pose with matching feet baselines. Top row neutral/happy/sad; bottom row surprised/thinking/angry. Change facial expression only; preserve the specified hand gesture. Full hats, feet and props inside each cell with generous transparent margins. Genuine transparent alpha, no scenery, vignette, floor, ground shadow, grid, border, labels or text. Modest non-sexual clothing.
```

新版沿用現有 Q 版角色作風格參考，修訂圖以已核對的三欄兩列總圖作排版參考。原稿不符排版或表情時重新生成後再驗收，不能只因尺寸能整除就直接切圖。

## 各角色主題提示詞

| 顯示名 | 保留的外觀與本輪修訂 |
| --- | --- |
| 鼬 | Itachi Uchiha：黑色長髮、紅眼、劃線木葉護額、黑底紅雲高領披風、忍鞋。 |
| 惠惠 | Megumin：短棕髮紅眼、黃色飾邊尖帽、完整紅衣黑披風、黑襪與靴、紅寶珠法杖；不作裸露或性化設計。 |
| 洛琪希 | Roxy Migurdia：雙藍辮、藍眼、棕色寬邊巫師帽與長外套、白襯衫、黑裙襪、藍晶石木杖；完整服裝。 |
| 黎明卿 | Bondrewd：深色封閉機械頭盔、單道紫色直立光縫、紫黑長外套、白笛與背包；以光縫細微變化表達表情，不加人臉。 |
| 藍染 | Sosuke Aizen：棕色後梳髮與單撮長瀏海、狹長棕眼、白色高領長衣、黑腰帶、腰間收刀。修正單張肖像輸出為完整六表情。 |
| 帝國戰將級泰坦 | 使用者選定 Imperial Warlord Titan：紅／象牙白裝甲、教堂式背甲、細小胸前駕駛艙、兩座肩砲與兩門臂砲、寬大機械足；無底座。修正二欄三列為三欄兩列，武器與尖塔須完整。 |
| Faker | 保留直立食指比噓、眼鏡及黑紅隊服。依真人參考修窄長臉、中庭、眼形、鼻樑與鼻翼、較自然的嘴唇及側分黑瀏海，避免泛用大眼圓臉。手勢和衣服不改。 |
| Gumayusi | 初版依第一張照片，後依使用者新照片修為直髮中分、較寬的臉頰與較窄眼形、細框圓眼鏡；保留拇指／食指 L 手勢遮住下半臉與黑帽T，不改拿麥克風。另校正悲傷／驚訝／思考所在格，移除地面橢圓與符號。 |
| 淳平 | 依使用者第二張照片保留側分黑髮、窄眼與薄唇、黑背心與領結、肩臂刺青；加完整黑長褲鞋，站立手放鬆，不加書本或背景。 |
| 阿志8+9 | 依使用者第三張照片保留平整黑鍋蓋髮、剃短兩側、瘦長臉、白色幾何印花T恤、黑褲與運動鞋，胸前兩指手勢，不加額外刺青或道具。 |
| 柯p | 柯文哲造型：灰黑短髮、細長方眼鏡、較窄眼形、寬鼻與突耳、微抿嘴；白襯衫深色長褲，不加政治標語。 |
| 沈黑熊 | 沈伯洋造型：濃密蓬鬆捲髮、黑圓眼鏡、較寬臉、黑帽T與簡單胸前熊圖案；維持人形，不加熊耳或動物身體。 |
| Saber | Artoria Pendragon：金髮編髮髻、藍緞帶、單撮呆毛、綠眼、藍白長戰裙、銀色裙甲與手足護甲；金藍聖劍垂直朝下，六格同姿勢，完整不裸露服裝。 |
| 金閃閃 | Gilgamesh：後梳尖金髮、紅眼、金色分節全身鎧甲與黑內襯、紅腰布、金甲靴；六格同樣雙手交叉站立，不加王冠、浮空兵器或背景寶庫。 |
| 光頭黑人 | 約30歲光頭成年男性；較窄眼形、斜眉、堅定下顎與淡鬍鬚，額角／臉頰／頸部新增黑色幾何刺青，保留手臂刺青；改寬鬆黑T、深色工裝褲、黑白鞋與銀項鍊。這是該角色的個別設計，不將穿著描述為族群必然特徵。 |
| 3槍阿館 | 以館長／陳之漢造型修成較寬重的方臉、厚實下顎、寬鼻、小眼、低平粗眉、短灰黑平頭與鬍渣；保留白吊嘎、黑短褲、手臂刺青及壯碩體型。 |

## 參考來源

Saber 初版雖有 alpha 通道，角色外仍殘留灰色背景；以內建 image_gen 保留六格角色與構圖、移除雲霧與投影後重匯。最終逐張 WebP 的透明度、256×256 尺寸、容量及 SHA256 由素材回歸核對；未採用帶底色的初版。

使用者提供的 Gumayusi、淳平、阿志與 Gumayusi 後續照片只用作其指定造型參考，沒有自行辨識照片中人物。

Faker 臉部修訂另參考 [CNA Lifestyle 訪問照片](https://cnalifestyle.channelnewsasia.com/entertainment/faker-razer-esports-league-legends-lol-bts-enhypen-460791)，本機參考圖保存於 `work/scene-bots-408/references/faker-cna.jpg`，不納入公開圖片。

動漫造型核對資料包括 [惠惠官方角色頁](https://konosuba.com/bakuen/character/)及[洛琪希官方角色頁](https://mushokutensei.jp/character/)；沈黑熊外觀核對[立法院公開人物頁](https://www.ly.gov.tw/Pages/List.aspx?nodeid=46775)，柯p外觀核對[民眾黨公開人物頁](https://www.tpp.org.tw/member)。只採外觀資料，不將人物現任職務或新聞內容加入遊戲。
