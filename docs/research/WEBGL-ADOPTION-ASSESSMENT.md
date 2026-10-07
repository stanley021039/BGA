# WebGL 導入評估

日期：2026-10-07。程式基線為正式 v1.8.1／`6707a9e`；本輪唯讀盤點程式、查核官方文件，沒有安裝套件、建立 WebGL 原型或量測其 FPS。下列效益與優先序是設計推論，不是已證實的加速比例。程式角色與元件設計角色平行複核；此文件不代表實作、升版或發布。

## 決策

值得做一個局部原型，首選雷霆之路的特效層。WebGL 的價值在大量可重用圖像、粒子與圖層的批次繪製，也能提供煙霧、火花、光暈等新視覺效果。現有少量卡片、文字、按鈕及簡單移動不必全部搬進 canvas；全站改寫成本高，目前沒有效能證據支持。

WebGL 不等於從 CPU 切到 GPU 就自動變快。Canvas 2D 也存在硬體加速路徑；CSS 的 transform／opacity 可以避免逐幀重新布局。效益要取決於實際瓶頸是布局、JavaScript、像素繪製、GPU 填充率，還是網路等待。[MDN Canvas context](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)、[Google 動畫效能指南](https://web.dev/articles/animations-guide)。這些一般原則不能證明本專案目前使用哪個硬體路徑。

## 目前程式與可套用位置

成本為相對改造／相容驗證成本，不是工期估算；收益欄描述可能的體驗，沒有百分比承諾。

| 功能 | 現況與程式證據 | WebGL 可改善的體驗 | 評估與成本 |
| --- | --- | --- | --- |
| 雷霆：車旁特效 | `public/shared/race-vehicle-effects.js` 用 SVG path／circle／line 與 CSS 動畫表現氮氣、射擊、打滑；eventId 去重並沿用位移事件時序 | 更豐富的尾焰、輪胎煙、碰撞火花、爆炸碎片、玻璃碎屑；當同時粒子數增加時，可以批次繪製 | **第一個原型候選，成本中**。目前效果圖形簡單，未證明現有版本必須用 GPU renderer 才順暢 |
| 雷霆：整張賽道及車輛 | `public/race.js:renderBoard` 的正常三路段共144格，格子至少432個SVG節點另加地形；最多12玩家車。`race-movement.js` 的動畫地形可暫留8路段，非平常常駐規模 | 賽道平移／縮放、多人車輛與特效共用場景；更容易加入鏡頭效果 | 成本高，第二階段再評估。先比較 SVG 節點重用／局部更新；不能為改畫法丟掉合法落點、hover 說明、鍵盤操作或逐格／事件順序 |
| 好友大廳 | `src/rooms/lobby.js` 上限80人，並非已觀察到80人同時在線；`public/lobby.js` 保留每人4個DOM節點，`lobby.css` 的角色位置使用 left／top transition，並有步行與陰影 | 若未來擴大場景或同時容納很多活動角色，可用 sprites、鏡頭與場景層級 | 目前先比較 transform 移動，成本低於新 renderer。若只維持現有小場地，WebGL 收益未證實 |
| 畫猜：本機筆畫預覽 | `stroke-canvas.js` 使用 Canvas 2D；活動筆畫仍建立完整 path，正式 backing 為 512×256；v1.8.1 已做 rAF／coalesced 與有限草稿層 | 保留歷史筆畫幾何／貼圖，只更新新增部分；長筆、多筆或未來大畫布可能受益 | 條件式研究，成本高。要先量測剩餘本機繪製時間，與 Canvas 2D／Worker 方案比較；不能承諾相同反鋸齒、填色區域或 PNG |
| 共用文字／emoji 彈幕 | `motion-policy.js:createBarrageController` 最多四個同時顯示；`game-shell.css` 用 translateX 移動 | 未來可新增大量 emoji 雨、圖像碎片或動態框特效 | 現有四條文字彈幕 **低優先**。中文／emoji 字形、文字換行及 texture 建立另有成本；現有文字框保留 DOM，粒子效果可借用共用特效層 |
| 送禮達人 | `gift.js:render` 每位收禮時最多7張卡以700ms transform／opacity入場；收禮者確認後才前進 | 拆禮彩帶、紙屑、光點、稀有禮物特效 | 基本送禮動作維持原 UI，新增大量粒子才用共用層。收益主要是視覺豐富度，現有卡片改寫收益低 |
| 同頻俱樂部／撲克 | 同頻最多12玩家chip以420ms transform／opacity聚合；撲克最多17張牌，每次更新最多新增6顆600ms飛籌碼，主要仍為DOM UI | 若增加大量籌碼飛行、全桌慶祝，可以使用共用特效 | 成本中而目前收益低；先保留現有動作與資訊展示，不為裝飾把角色、答案或籌碼資訊隱藏 |
| 結算、聊天室、房間設定、共看 | 表單、文字、列表與影片播放器各有既有 DOM／影音／同步契約 | WebGL 對這些功能本身沒有直接加速作用 | 沿用 HTML。YouTube 播放政策、影音進度同步、server 負擔與資料庫問題仍要由各自機制處理 |

## 畫猜的特殊成本

以上數量來自程式上限／迴圈推算，不是本輪實際負載或FPS量測：`src/games/thunder.js`、`public/race.js:111`、`public/shared/race-movement.js:79`、`src/rooms/lobby.js:5`、`public/lobby.js:23`、`public/gift.js:190`、`public/majority.js:77`與`public/app.js:animateChipTransfers`。

| 原契約 | 換 renderer 的影響 |
| --- | --- |
| 140ms 湊批、115ms pacing、單一 in-flight、HTTP／SSE／重試 | 都在 `draw.js`／`draw-transport.js`；改 WebGL 不會縮短這些等待，也不能取代協議排序與 quota |
| 四連通、容差24的區域填色 | 現在讀完整像素後在 CPU 搜尋。GPU 版要設計新的連通區演算法；保留 CPU 填色則仍需讀回資料。同步 GPU readPixels 有等待成本，[MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) 特別提醒避免阻塞主執行緒 |
| 白色橡皮擦、圓端／圓接、0.5座標偏移、自交與形狀 | 不能直接把線改成另一種混合模式。筆畫三角化、透明度、重疊與反鋸齒要另做相容驗證；不能只換 getContext 名稱 |
| 完成圖／回看／收藏 PNG | 可先保留原 Canvas 2D canonical 重播／encoder，讓 WebGL 只做本機預覽；預覽與完成圖仍需比較，避免放開筆後明顯跳變 |
| 原生畫布已存在邊緣差異 | v1.8.1 的 [驗收紀錄](../DRAWING-SMOOTHNESS-PROGRESS.md) 已列 classic 跨 task 差異。不能把 WebGL 當成這個差異已證實的修復方法 |

若重工作集中在 CPU／主執行緒，OffscreenCanvas／Worker 是另一個候選，並不需要先改 WebGL；但要設計跨執行緒資料、取消、epoch、呈現及存圖時序，不能視為無成本開關。[MDN OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)。

## 建議的局部架構

先以 PixiJS 的 2D WebGL renderer 作雷霆特效原型，原生 WebGL 留給需要自訂 shader 的少數效果。PixiJS 官方提供 spritesheet／批次繪製及輕量粒子容器；頻繁重建複雜 Graphics 或反覆重畫文字仍可能慢，導入套件本身不會解決錯誤的更新方式。[PixiJS 效能指南](https://pixijs.com/8.x/guides/concepts/performance-tips)、[粒子容器](https://pixijs.com/8.x/guides/components/scene-objects/particle-container)。

| 邊界 | 原型實作方向 |
| --- | --- |
| 賽道互動 | 原 SVG／DOM 先保留，新增透明、pointer-events:none 的特效 canvas；不以粒子數改變規則或發新封包 |
| 共用介面 | 可定義 `GameFxLayer.play(eventId, kind, anchor, options)`、`updateView`、`pause`、`clear`、`destroy`；送禮／同頻後續重用，先不將介面視為已存在 |
| 動畫時序 | 使用已確認 eventId／公開位置，跟隨 `RaceMovement.onMove` 與 checkpoint；維持一步步移動及事件先處理後續移動 |
| 文字與操作 | 玩家卡、骰子、事件說明、聊天、工具列及 dialog 保留 GameUI。Canvas 互動若後續擴大，必須另外保留可聚焦操作與無障礙語意；PixiJS 的無障礙是需要啟用的 DOM overlay，[官方說明](https://pixijs.com/8.x/guides/components/accessibility) |
| 生命周期 | 沿用 MotionPolicy 的停用／減動／hidden／重連規則；空閒停止渲染，不額外新增永遠運轉的 ticker；取消與 destroy 釋放 texture、buffer、監聽器 |
| 相容退回 | 初始化失敗或 context loss 時回原 SVG／CSS。查核當日 PixiJS v8 的 CanvasRenderer 仍標 coming-soon，不能承諾套件自動退到 Canvas 2D，[renderer 文件](https://pixijs.com/8.x/guides/components/renderers) |
| 資源 | 按需載入並固定套件版、保留授權；靜態特效用共用 atlas，限制特效數、解析度與 texture 生命期。4MiB 上傳檔案不代表解碼／GPU 記憶體也只有4MiB；自訂 GIF／角色圖暫留原 DOM 播放 |

只有真的要加入立體車輛／攝影機／骰子物理才另評估 Three.js 或其他 3D 方案；目前沒有足夠需求理由把整個2D project改為3D。

## 原型成功條件（尚未執行）

同一事件 trace、相同畫面尺寸與同一硬體，比較原 SVG／CSS 與 WebGL；區分可見但不搶焦點的畫面、隱藏頁與減動情境。背景 rAF 節流不能當作正常可見畫面的 FPS。

| 測量／驗證 | 要回答的問題 |
| --- | --- |
| 現有規模＋50／250／1000個粒子壓力場景 | WebGL 何時開始有收益？數字是提案測試負載，不是目前產品粒子數或已驗上限 |
| DevTools frame／layout／paint、JS長任務、P95輸入到呈現 | 改善的是哪一段？不能只用 JS callback／rAF 數宣稱真正呈現 FPS |
| 載入／記憶體／空閒成本 | 套件、shader、atlas 及 DPR 是否增加首次延遲、耗電或 GPU 壓力？裝置能力差異需分開記錄 |
| 逐格＋連鎖事件、hover、keyboard、resize、hidden／減動、context loss／restore | 是否保留原遊玩順序、資訊可讀性、落點命中與退回功能？ |
| API／server | 同一遊戲動作封包數、payload及伺服器規則保持，WebGL renderer 不新增每幀位置傳送 |

優先交付一個雷霆粒子特效原型，再以量測決定是否擴大到賽道／大廳／畫猜；目前無加速百分比、全站採用或硬體歸因結論。

## 角色複核與收斂

程式角色指出，GPU buffer有機會降低活動path建立工作，但送筆等待、fill與作品相容不是同一問題；建議畫猜只先比較preview方案。元件設計角色指出，現有雷霆FX只有少量SVG圖形，不能先宣稱GPU是必要修復；賽道互動搬遷又要重做落點、tooltip與鍵盤，並支持雷霆車旁特效的局部原型。主agent據這些不同範圍的複核，將本評估的第一步收斂為雷霆粒子、保留原互動／移動／文字；程式角色對畫猜的結論不當作已評過全部遊戲。四軌彈幕／少量卡片的盤點使整體UI遷移降為低優先。

後續分工提案：動畫角色定義事件、粒子密度、可讀範圍及靜態結果；程式角色做局部renderer／fallback與同trace量測；玩家角色比較辨識度、延遲與遮擋。這些後續工作尚未派發或執行。
