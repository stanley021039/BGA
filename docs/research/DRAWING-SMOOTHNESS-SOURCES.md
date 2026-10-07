# 畫畫順暢度：開源原碼與技術來源

研究日期：2026-10-07。研究者只讀公開原碼、官方規格及本機程式；沒有在本輪操作瀏覽器、測量 FPS、播放 Gartic Phone、修改遊戲或操作正式站。正式版 v1.7.1 由主任務提供；本機盤點 HEAD 為 `e34693450b94991d21ce5b0310c7eebcac7c75c9`，這個紀錄不能代替公開站版本／效能驗證。

本文件區分「原碼已確認」、「本專案可套用的提案」與「待實測」。開源畫板、仿製遊戲與公開範例都不是 Gartic Phone 原站內部實作的證據。HAR 只能證明採樣期間的傳輸，不能單獨證明渲染演算法、伺服器架構或 GPU 幀率。

## 1. 四個開源專案的具體方法

以下固定來源 commit，避免日後預設分支變更。授權判斷來自各來源自己的 LICENSE；未下載或執行這些專案，也沒有把它們的程式搬入本站。

| 專案／受查版本 | 筆畫傳送與點處理：原碼已確認 | 渲染／順序／背壓：原碼已確認 | 本站可採用的方向與限制 |
| --- | --- | --- | --- |
| **Excalidraw**，`53973c3a423fbd75a4ce68107786b4fcb90e4968`，上游 commit 2026-10-06， [MIT LICENSE](https://github.com/excalidraw/excalidraw/blob/53973c3a423fbd75a4ce68107786b4fcb90e4968/LICENSE) | `Portal.broadcastScene` 以元素 ID／version 篩掉未變更元素；傳送的是變更元素，不能說它只傳新座標點。游標／idle 使用 volatile 類別，場景更新使用一般類別。[Portal 原碼](https://github.com/excalidraw/excalidraw/blob/53973c3a423fbd75a4ce68107786b4fcb90e4968/excalidraw-app/collab/Portal.tsx) | `Collab.broadcastElements` 比較 scene version；另外 throttle 全場景校正，受查常數為 20,000ms。這是增量資料同步，不是本次已證實的畫布局部重畫演算法。[Collab](https://github.com/excalidraw/excalidraw/blob/53973c3a423fbd75a4ce68107786b4fcb90e4968/excalidraw-app/collab/Collab.tsx)、[常數](https://github.com/excalidraw/excalidraw/blob/53973c3a423fbd75a4ce68107786b4fcb90e4968/excalidraw-app/app_constants.ts) | 保留本站 `strokeId`／version，將畫作與可捨棄的游標預覽分開。不要照搬其整個加密協作架構，也不要把變更元素重送誤認為點壓縮。本站已有 SSE 筆畫增量，先改善本機渲染。 |
| **Fabric.js**，`17ec4c66c60f801118c86987b3ca82cd3e67b42e`，上游 commit 2026-10-05， [MIT LICENSE](https://github.com/fabricjs/fabric.js/blob/17ec4c66c60f801118c86987b3ca82cd3e67b42e/LICENSE) | `PencilBrush` 收集活動點，結束時按距離／zoom 抽稀，受查 `decimate` 預設為 0.4；保留最後點並建立最終 path。此模組不提供網路同步或可靠傳送。[PencilBrush](https://github.com/fabricjs/fabric.js/blob/17ec4c66c60f801118c86987b3ca82cd3e67b42e/packages/core/src/brushes/PencilBrush.ts) | 活動筆畫畫在 `contextTop`；一般移動由 `oldEnd` 接續二次曲線尾段；直線等需要全重畫的情況才清上層重畫。落筆完成後建立物件、清上層並要求場景 render。 | 最適合參考「已確認畫布＋活動筆畫層」。先隔離舊筆畫／填色，避免每次 pointermove 重跑整份圖；再研究尾段增量。不必為此引入整套物件畫板。 |
| **perfect-freehand**，`176e00f2399f4969e1b0965c5921d96a3e50ce9f`，上游 commit 2026-02-01， [MIT LICENSE](https://github.com/steveruizok/perfect-freehand/blob/176e00f2399f4969e1b0965c5921d96a3e50ce9f/LICENSE) | `getStrokePoints` 由座標／可選 pressure 推導 streamline 後的位置、向量、距離與累積長度；相同調整點可略過。它是幾何處理，沒有 stroke 傳輸、ACK 或重連協議。[getStrokePoints](https://github.com/steveruizok/perfect-freehand/blob/176e00f2399f4969e1b0965c5921d96a3e50ce9f/packages/perfect-freehand/src/getStrokePoints.ts) | 筆畫 outline 由點列及 pressure／smoothing 等參數生成；不能把每次對整條長筆畫重算的成本視為零。[getStrokeOutlinePoints](https://github.com/steveruizok/perfect-freehand/blob/176e00f2399f4969e1b0965c5921d96a3e50ce9f/packages/perfect-freehand/src/getStrokeOutlinePoints.ts) | 可作後續畫質／壓感候選；`streamline` 不是網路壓縮器。本站目前只存兩個整數座標，導入 pressure 或不同筆尖會改資料／重播契約，應排在掉幀修正之後。 |
| **WBO／whitebophir**，`06e675c5cd8a25900f0b7aa771933e29f551f96a`，上游 commit 2026-09-12， [AGPL-3.0 LICENSE](https://github.com/lovasoa/whitebophir/blob/06e675c5cd8a25900f0b7aa771933e29f551f96a/LICENSE) | 鉛筆開始送 CREATE（ID／樣式），後續 APPEND（parent／x／y）；`minPencilIntervalMs` 控制點送出的間隔。局部點用於曲線控制點，path 值取整。[鉛筆](https://github.com/lovasoa/whitebophir/blob/06e675c5cd8a25900f0b7aa771933e29f551f96a/client-data/tools/pencil/index.js)、[曲線點](https://github.com/lovasoa/whitebophir/blob/06e675c5cd8a25900f0b7aa771933e29f551f96a/client-data/tools/pencil/wbo_pencil_point.js) | 本機活動筆畫使用獨立 overlay，以單一待執行 rAF 更新；不等於所有 SVG path 操作皆為 O(1)。write module 追蹤 `clientMutationId`／queued／inflight／限流等狀態；server replay 使用 baselineSeq／seq／可回放範圍。大量回放的 `batchCall` 分組後讓出一個 animation frame。[write](https://github.com/lovasoa/whitebophir/blob/06e675c5cd8a25900f0b7aa771933e29f551f96a/client-data/js/board_write_module.js)、[replay](https://github.com/lovasoa/whitebophir/blob/06e675c5cd8a25900f0b7aa771933e29f551f96a/server/socket/replay.mjs)、[transport](https://github.com/lovasoa/whitebophir/blob/06e675c5cd8a25900f0b7aa771933e29f551f96a/client-data/js/board_transport.js) | 最接近本站的命令、樂觀繪畫、權威確認與回放問題。採用設計理念、獨立實作；若直接重用 AGPL 程式，要核對相應授權義務，不能當成 MIT 片段混入。 |

MIT 的程式重用仍應保留該來源要求的 copyright／license notices，並逐一檢查實際採用檔案及依賴。這次只研究，沒有新增套件或授權檔。

**tldraw 的界線：**本次也查了 `035b741dc331bf76a4cb9af27c346be10bba2a88` 的 [SDK LICENSE](https://github.com/tldraw/tldraw/blob/035b741dc331bf76a4cb9af27c346be10bba2a88/LICENSE.md) 與 [官方授權說明](https://tldraw.dev/community/license)。SDK 是 source-available、預設開發用途；正式使用需適用的額外授權。部分 examples 的 MIT 不會自動涵蓋 SDK，所以沒有將它列為第五個可直接照搬的開源引擎。

## 2. 官方技術來源

| 官方來源／查核日期 | 可確認的行為 | 本站實作方式：提案 |
| --- | --- | --- |
| [W3C Pointer Events Level 3：coalesced events](https://www.w3.org/TR/pointerevents3/#coalesced-events)，2026-10-07 | 瀏覽器可合併 pointermove；`getCoalescedEvents()` 取回採樣點，對快速曲線有用。規格要求此 API 的安全環境條件；`pointerrawupdate` 可能增加負擔，不能與 pointermove 重複採同一批點。 | 使用 `getCoalescedEvents?.()`，空清單／不支援時用原事件；保持 pointerId。每次 dispatch 只讀一次畫布 rect，轉換整批座標後排一次 rAF；不要每個合併點都全重畫或發 HTTP。預測點若日後加入，只能作暫時預覽，不存入權威畫作。 |
| [WHATWG HTML：Animation frames](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames)，2026-10-07 | rAF 是渲染機會的 callback，不是網路交付或規則進度保證；也可配合 worker／OffscreenCanvas。 | live stroke 維持一個待執行 frame，frame 中消化累積點並一次更新。pointerup 必須立即處理最後點／發送；背景恢復、收藏重播及送出工作不可只依賴 rAF。先保留現有 MessageChannel 合作回復，再按量測判斷是否需要 worker。 |
| [Socket.IO 官方：Delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)，2026-10-07 | 已送達訊息保持順序，但預設交付是 at-most-once；中斷與重新整理仍可能遺失。ACK／重試、事件 ID、持久化及重連 offset 要由應用層安排。 | 不把「改 WebSocket」當成可靠性修復。維持 `canvasEpoch`／round／strokeId／batchId／version、ACK＋SSE 去重、gap snapshot；重試同一批要保留同 batchId／同內容，undo／clear 仍排在已送筆畫之後。 |
| [WHATWG WebSockets：bufferedAmount](https://websockets.spec.whatwg.org/#dom-websocket-bufferedamount)，2026-10-07 | bufferedAmount 表示尚未傳往網路的應用 bytes，不是 server ACK，也不涵蓋所有 OS／網路緩衝。 | 目前 HTTP 送出列可直接量 pending points／bytes／最舊批次等待時間；若後續實作 WebSocket，再加 bufferedAmount 的高低水位。合併尚未送出的點，不改已送批次，不靠無上限 queue 或任意丟掉正式筆畫。 |

## 3. 本站原碼盤點與待驗假設

本段來自本機 [draw.js](../../public/draw.js)、[stroke-canvas.js](../../public/shared/stroke-canvas.js)、[draw-guess.js](../../src/games/draw-guess.js)；下列效能影響是推論，需與主任務的實際瀏覽器採樣對照。

| 已確認的程式行為 | 為什麼值得量測 | 建議隔離測項 |
| --- | --- | --- |
| pointermove 新增點後直接 `redrawCanvas()`；活動 draft revision 每次改變。renderer 可復用已確認前綴，但仍會處理活動筆畫；其 checkpoint 使用全畫布 imageData。 | 長筆畫成本、影像複製及同一 frame 多次工作可能上升；尚不能宣稱它們就是本次卡頓主因。 | pointermove 次數／render 次數／frame、活動點數、strokeApplications／restores／checkpointBytes、最長 paint、長任務。 |
| brush／erase 的 pending 點達 40 才 flush，或等 pointerup；目前沒有按時間送出少量未完成點的 flush。 | 本人預覽順暢與別人看到延遲是不同問題。低取樣速度的長慢線可能長時間未達門檻。 | 原始取樣點→POST 開始、POST→ACK／SSE、SSE→對方 paint 三段延遲。 |
| sendQueue 逐批等待 HTTP 回覆；開送還受 115ms 間隔約束，fill 另有 500ms 間隔。 | 高 RTT 或網路失敗可能堆積；縮短本機 paint 不會自動消除 ACK 等待。 | in-flight 數、未送 bytes／點、queue oldest age、ACK p50／p95、是否重送／gap snapshot。 |
| server 每批最多 64 點、每秒最多 10 筆；每輪 1,000 批／30,000 點／48 fills。座標是 512×256 的整數。 | 納入 coalesced 點後不能直接塞過大的批次；加密度與加解析度各有容量／填色成本。整數取樣造成的角折、低解析畫質也不等於掉幀。 | 批大小、接受點／重複 anchor 點、429、像素差與轉角保留；不要先升高解析度掩蓋原因。 |
| 已有 SSE 增量、版本／epoch 防過期與合作式 snapshot／fill 回復。 | 沒有證據支持先重寫整個 server 或用全圖 PNG 高頻同步。 | 無網路本機預覽、一般 HTTP＋SSE、延遲回覆、重連恢復分別測。 |

## 4. 建議實作順序與驗收

以下都是候選方案，沒有在本研究中實作或宣稱改善幅度。

| 次序 | 可以做的修改 | 必須保留／驗收 |
| --- | --- | --- |
| P0：先拆量測 | 用同一支長線與小轉角 trace，比較空圖、很多筆畫、很多 fill；分開本人 input→paint 與對方 input→paint。記錄 frame interval／long task／network queue，標示工具產生輸入與真人輸入差別。 | 不用單一 FPS 或 HAR 大小認定 CPU／網路／另一台電腦原因；各輪條件、視窗大小與採樣長度可重跑。 |
| P1：frame 合併 | pointer handler 收點，單一 rAF 更新本機活動筆畫；整批轉換座標後去除相鄰相同點。pointerup／cancel 清理 callback 並處理最後點。 | 不能因合併 frame 丟掉點、端點或第二支 pointer；移動順序、keyboard 作畫及 final flush 保持可用。 |
| P1：活動層隔離 | 已確認底圖保持穩定，活動筆畫畫在第二 canvas／暫存層；最初只做到每 frame 重畫活動層，後續再嘗試增量尾段／dirty rect。undo、clear、換 epoch、失敗及重連從權威圖重新建立。 | opaque／erase、圓端／圓接、短點、跨批次 anchor、fill 邊界及落筆後畫面一致；不能先假定多次短段疊畫與完整 path 的抗鋸齒完全相同。儲存仍等待正確權威 render。 |
| P2：時間 flush 與背壓 | 維持現有 115ms／server 限流，增加未滿 40 點的時間到期 flush；同一筆尚未送出的點可合併，發送前切成最多 64 點且保留連接 anchor。量 queue 大小及等待時間。 | batchId 只在批次內容固定後生成；已送批次不得修改。queue 有上限並提供可恢復回饋；錯輪、重送、ACK／SSE 交錯、undo 排序、離頁與恢復不能倒退或重複畫。 |
| P3：可選點壓縮／畫質 | 先評估同點去重及保留轉角／端點的抽稀，再評估曲線或 perfect-freehand。距離抽稀與曲線平滑分開；所有畫者、猜者、回看與 studio 的 renderer 版本與語意要核對。 | 用相同 trace 評估最大幾何／像素誤差與字形辨識；不能拿單純少點數當成功。若新增 pressure、codec 或畫法，另開資料相容性／版本 spec。 |

本次沒有證明必須升級至 WebSocket、worker 或替換 Canvas engine。先用現有 HTTP＋SSE 降低多餘渲染，最容易保留既有伺服器成本、權限與恢復契約；是否進一步調整傳送方式，依實測證據決定。

## 5. 交接限制

- 外部資料全為作者原碼／LICENSE、官方規格／官方文件；沒有把部落格、仿站或 GitHub 搜尋摘要當作實作證據。上游 commit metadata 由公開 GitHub API 查核，具體行為再以相同 commit 原碼確認。
- 沒有新的 Gartic HAR 或本機／正式實玩結果；主任務須另記採樣與結果。本文件不更新部署狀態、不改遊戲、不安裝套件、不執行外部原碼。
- 已查的實作不能推論其他版本、其他裝置或 Gartic 的演算法；上游專案順暢不保證它的完整架構適合單畫者、八席、低伺服器負擔的本站。
