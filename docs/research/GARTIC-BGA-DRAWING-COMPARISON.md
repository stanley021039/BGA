# Gartic Phone 與本站作畫順暢度對照

查核日期：2026-10-07。本站產品基線 **v1.7.1／`3d82e3f6946ffdd7af6329e678df190ae5b0eb6d`**；研究開始時文件 HEAD 為 `e346934`。主 agent 在 Chrome 實玩官方 Gartic Phone，並在隔離本站副本操作画者／觀看者；兩個研究 agent 分別查真程式與公開原碼。**本輪完成研究與改善 spec，未改產品程式、未部署，沒有新增 PR。**

可以確認三個值得優先修的行為：brush／erase 持筆未滿 40 點時完全不送出、每個 move 重畫整條活動筆畫、每個 POST 等前一筆 HTTP 回覆。fill 在 pointerdown 即排送，不受40點門檻。Gartic 此樣本持筆期間已送小型向量更新；不能由單席封包推出它的多人延遲、FPS、伺服器或渲染演算法。

## 實玩與隔離量測

| 項目 | 如何測 | 實际結果 | 限制 |
| --- | --- | --- | --- |
| Gartic 持筆傳送 | 官方 `https://garticphone.com/`，匿名單席 Masterpiece；CDP 原生按下、24 次移動、放開。分段讀取 Network 游標。 | 放開前 **24** 則 brush 更新，放開後 **1** 則；每則 57–200 bytes，共 **3,237 bytes** 邏輯 payload。`42` 訊息中有 `{t,d,v}`，向量長度 5、7…53，後一則包含前一則完整前綴。 | 這是累積向量，不是每則只傳新點。除心跳外，採樣區間沒有其他接收 game frame；單席不能量另一名玩家收到時間。不是完整線上 bytes。 |
| 本站持筆未放開 | 真 v1.7.1 前端／backend，3 個隔離合成帳戶，兩個 Chrome tab；原生 pointer 形成 25 個不同整數點。 | 畫者有 25 點活動曲線、25 次 stroke application、24 restores；持筆期間 **0 筆 stroke POST**。觀看者 strokes 為 0、保持空白。 | 工具輸入間隔不代表真人採樣率；已重現傳送門檻的等待，沒有得出 FPS。 |
| 本站放開筆 | 延續上述同一筆，放開後查 proxy log、權威畫布及 canvas digest。 | **1** 筆 25 點 POST，兩席 canvasVersion 都為 2，最終畫布 digest 相同。 | 放開後讀取較晚、已進揭曉；不能將這次讀取時間換成放開到觀看者 paint 的延遲。 |
| 本站串列送出 | 另起隔離局，以真 handler 產生 8 個單點短筆畫；第一筆以原生按下開始，其餘使用明確標記的合成 PointerEvent。代理在 upstream 已接受後將 HTTP 回覆多延後 400ms，SSE 照常轉送。 | 8 個 POST 都 200；開始時間相對 burst 為 **4、430、850、1265、1672、2085、2490、2909ms**。burst 到最後 ACK 的佇列排空時間 **3,314ms**，兩席最終 version9／8 strokes，畫者 draft 清空。 | 這是人工 response delay 與密集合成輸入，不是正式網路 RTT、真人點擊速度或觀看端固定 3.3 秒延遲。觀看端可在畫者 ACK 前先收到 SSE。 |

本站 backing canvas 為 **512×256**，顯示矩形約 941×468.5 CSS px；Gartic 受查頁有三層大 canvas、各 **1516×848**，顯示約 1064×595 CSS px。解析度與模式不同，不作公平 FPS 排名。工作分頁在 Chrome 背景，工具操作慢、頁面含第三方廣告；被動 probe 記錄 26 pointer events、52 rAF callbacks、4 long tasks，只能說明取得這些事件，不能把 callback 數推成 Gartic FPS 或把 long task 歸因於畫筆。

### 封包覆蓋與作品證據

有效 Gartic brush 範圍為 CDP sequence **3805 之後至 4082**，pointerup 前邊界 4081；分段讀取此範圍未 truncated。早期載入／進房有 1 個 truncated 批次。匯出 HAR 共 238 entries，其中 27 個 partial、19 個 incomplete、全部未附 response bodies；**不能稱完整 session HAR**。實際畫筆範圍獨立保留，沒有以載入／廣告的總流量推論筆畫成本。

完成按下 Done，截圖時已進單席 album settings。`work/gartic-drawing-proof-2026-10-07.png` 是真頁面截圖，不是筆畫流暢度影片。另存 canvas PNG 是自己的試畫 layer 匯出；透明底黑線在部分預覽器看似全黑，不能拿它當空白畫布判據。

原始 HAR／CDP 可能含房間、身份、headers 及第三方 telemetry，只留本機忽略的 `work/`，不提交、不上傳。去識別摘要只公開數量／長度／前綴判斷，不公開原始訊息。

### 未解像素差異

8 個短點的延遲實驗在 renderer idle、兩席 version9／8 strokes 時，像素 digest 不同。畫者 applications44／restores8／7 checkpoints／3,670,016 bytes；觀看者 applications8／restores0／0 checkpoints。程式 agent 用真 renderer 配合記錄 context 重現相同計數：8 次 initial draw 加逐一 ACK 移除 draft 後 8+7+…+1 次 suffix 重播，最終命令同序同樣式，未找到重複 dot。這是邏輯證據，不能證明 native raster 一致。

後續另一份 ink-mask 讀取跨越換輪、兩端 ink 為 0，已標記無效，不能用它宣布原 8 點吻合。CPU／GPU 路徑、反鋸齒或 checkpoint 像素原因仍未證實；spec 要求同一固定 epoch／canonical JSON 的像素／mask 對照。此未解項不影響 8 個 POST 的串列排程證據，亦不覆蓋第一筆 25 點已吻合的結果。

## 真程式工作量與傳送成本

完整盤點見 [程式稽核](BGA-DRAWING-CODE-AUDIT.md)。主 agent 重新跑 ignored `work/drawing-code-audit.cjs`，確認 handler／renderer 模型輸出；沒有執行外部 GitHub 程式。

| 原碼已確認 | 量測或推導 | 對玩家的影響與改善方向 |
| --- | --- | --- |
| `public/draw.js:522` 每個有效 move 直接 redraw；brush／erase 的40 pending 點或 pointerup／cancel 才 flush，沒有時間 flush。 | 真 handler VM：39 點有39 redraw、0 API；40點才有第1 API。雙席 Chrome 的25點持筆結果與此一致。 | 少量點的慢線，觀看者會等到湊批或放開；增加時間門檻，但需配合背壓。 |
| `public/shared/stroke-canvas.js:56` 每次活動尾筆改變，恢復基底並遍歷整筆全部點。 | 真 renderer、計數 context：100點共4,951次 lineTo；1,000點共499,501次。總量 `1+N(N−1)/2`，O(N²)，不是毫秒量測。 | 先一幀只畫一次，再隔離活动層，最後考慮新增尾段；不要再每個 pointermove 重畫長路徑。 |
| `public/draw.js:490` Promise queue 等上個POST完成，送出開始至少間隔115ms；fill500ms。 | 固定 RTT 模型吞吐約≤`1000/max(115ms,RTT)`。真400ms回覆延遲實驗也顯示下一筆被 ACK 卡住。 | 慢網會排隊，undo／clear也因等待 queue 變慢。合併同筆尚未送出的點，不擅自並行 POST。 |
| SSE 是即時 stroke 增量；缺版才取 snapshot；已有 epoch／去重／quota／合作式回復。 | `src/app.js` 接受後 publish 早於HTTP send。沒有本輪正式 reverse proxy 緩衝量測。 | 不需先改成高頻全图PNG，也沒有證據要求立刻換 WebSocket。保留安全與復原契約。 |

## GitHub 與官方文件可借用的方法

固定 commit、授權與完整連結見 [開源原碼及官方來源](DRAWING-SMOOTHNESS-SOURCES.md)。它們是可參考的獨立實作，不能代表 Gartic 內部原碼。

| 來源 | 已查方法 | 本站如何採用 |
| --- | --- | --- |
| [Fabric.js PencilBrush](https://github.com/fabricjs/fabric.js/blob/17ec4c66c60f801118c86987b3ca82cd3e67b42e/packages/core/src/brushes/PencilBrush.ts)，MIT | 活動筆畫用 contextTop；普通 move 接續曲線尾段，特殊情況才清上層重畫。 | 最優先借用活動層與尾段繪製理念；先保留本站 brush／erase／fill 的 canonical 畫法，不必引入整套引擎。 |
| [Excalidraw Portal](https://github.com/excalidraw/excalidraw/blob/53973c3a423fbd75a4ce68107786b4fcb90e4968/excalidraw-app/collab/Portal.tsx)，MIT | 以 ID／version 傳變更元素，游標等可捨資料使用 volatile，畫作更新另走一般訊息。 | 保留本站 stroke／version 增量，把暫時游標與正式筆畫可靠性分開；此例不代表只傳新座標。 |
| [WBO pencil](https://github.com/lovasoa/whitebophir/blob/06e675c5cd8a25900f0b7aa771933e29f551f96a/client-data/tools/pencil/index.js)，AGPL-3.0 | CREATE＋APPEND 點、單一待執行 rAF 的 overlay、mutation queue／server replay sequence。 | 借用點增量、有界佇列及重播理念，獨立實作；直接複製程式前須核對授權，不能當成MIT片段。 |
| [W3C coalesced events](https://www.w3.org/TR/pointerevents3/#coalesced-events) | 可取回瀏覽器合併的 pointer 點；支援條件與 fallback 要處理。 | handler 一次轉換整批點、只排一次 rAF；不可每點再全重畫，亦不可重複採 rawupdate＋move。 |

perfect-freehand 的 streamline／pressure 是幾何與筆尖處理，不能直接修網路排隊；tldraw SDK 授權亦不能當 MIT 引擎。均不建議當作第一步替換。

## 討論、交付與下一步

主 agent 向程式 agent 要求用真程式計數分開網路與渲染，再以 Chrome 查25點持筆及人工400ms回覆延遲。程式 agent 提出時間 flush 必須配合未送批次合併；來源 agent 指出活動層可借用 Fabric／WBO，但增量短段的反鋸齒不必然等於完整 path。主 agent 將可靠順序、pixel 差異及背景量測限制列入 [改善 spec](../specs/DRAWING-SMOOTHNESS.md)，未把訊息未回复項目寫成共識。

建议順序：**有界時間 flush＋同筆未送點合併 → 一幀一次活動繪製 → 活動層／尾段 → 再量正式串流與是否需要 transport pipeline**。本機反覆重畫與持筆等待已有程式／隔離實測證據；沒有測到使用者另一台電腦，不能判定是該電腦的問題。

測試 tab 已關閉，3340／3341／3342 的隔離 server、代理與 presence timer 已停止；正式資料未操作，既有版號保持 v1.7.1。研究／spec 與長期記憶是本輪交付，所有效能改善仍待實作驗收。

交付核對：ignored `work/check-drawing-research.cjs` 從原始CDP／HAR／兩份Chrome資料重新查25則、24放開前、3,237bytes、25點0POST、放開後digest相同、8批排空3,314ms及跨輪無效mask；12個研究／spec本地文件連結均存在。既有HAR exporter 10項測試全通過。來源agent與程式agent唯讀複核，補正brush／erase範圍、`renderer.whenIdle()`及排空時間措辭；沒有產品修改，因此未把舊940項產品測試當成本輪重跑結果。
