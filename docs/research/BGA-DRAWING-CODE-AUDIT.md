# BGA 畫猜繪圖程式稽核

查核日期：2026-10-07。產品基線：**v1.7.1／`3d82e3f`**。本輪為唯讀程式分析及離線 VM 操作計數，沒有修改產品程式、操作瀏覽器、啟動 HTTP 服務、連線正式帳戶或部署。以下行號對應這個基線；程式變動後需重新核對。

目前可確認的瓶頸是持筆期間的 40 點送出門檻、等待 ACK 的串列佇列，以及活動長筆畫每個 pointermove 都重畫。這些證據不能直接轉成 CPU 時間、實際 FPS、正式站 RTT 或與 Gartic 的延遲排名。

## 證據層級與重跑

| 層級 | 本輪如何取得 | 可支持的結論 | 不支持的結論 |
| --- | --- | --- | --- |
| 真 handler／queue VM | 使用既有 `tests/helpers/draw-browser.cjs` 執行真 `public/draw.js` 的 pointer handlers；DOM、renderer、API 為測試替身 | 幾點時呼叫 renderer、幾點時建立第一個送出請求 | 真 Canvas 的像素、CPU、畫面延遲或實際 HTTP timing |
| 真 renderer 操作計數 | 載入真 `stroke-canvas.js`，以只計數的 2D context 記錄 `lineTo`／stroke application | 活動筆畫逐點重畫的工作量增長 | GPU／CPU 費時、反鋸齒或實際像素一致性 |
| 推導排程模型 | 依 40 點門檻、保留一個端點、115ms 送出間隔與單一 in-flight POST 建模 | 指定假設下的佇列等待與吞吐上限 | 正式站實際 RTT、觀看端延遲、代理緩衝或封包流量 |

重跑腳本在 Git 忽略的 `work/drawing-code-audit.cjs`。它只讀本機程式、執行測試替身並把 JSON 輸出到 stdout；不呼叫 Git、不存取網路或帳戶。

```powershell
node work/drawing-code-audit.cjs
node work/drawing-code-audit.cjs > work/drawing-code-audit-results.json
```

腳本記錄目前 `package.json` 版本、Node 版本及四個產品來源檔的 SHA-256；`3d82e3f` 是本次指定基線，不冒稱腳本已查核當前 HEAD。腳本先檢查本次門檻／sender 形態，不符時會停止；其他程式變更仍須依來源 hash 核對、重新審查模型。`work/` 不隨文件提交；下一個 checkout 若要重跑，須保留本機腳本。

## 送出門檻：持筆不等於持續送點

`public/draw.js:507–512` 的 `flush()` 只有累積點或 final 收尾才建立批次；`528` 在 `pending.length >= 40` 時呼叫它，`533` 在 pointerup／cancel 時 final flush。沒有定時 flush。`34` 的 rAF 是 viewport fit，用途是布局，不是 canvas redraw。

| 真 handler VM 操作 | Renderer 呼叫增加 | Mock stroke 請求 |
| --- | ---: | ---: |
| pointerdown 一點，加 38 次不同座標 move，共 39 點 | 39 | 0 |
| 再加一次 move，共 40 點 | 40 | 1 |

畫者已有本機草稿，但觀看端尚未收到第一批。模型假設每秒 60／120 次有效、不重複且均勻的 pointermove，pointerdown 提供第一點，則首次湊到 40 點需 39 次 move，等待為 `39 / rate`：**650ms／325ms**。較慢作畫、相同整數座標被略過、或持筆後停頓，等待可更長；不足 40 點的短筆要等放開指標。這些是推導，不是手寫或網路實測。

## 本機活動長筆的工作量

`public/draw.js:519–529` 累積 `active.points`，每次不同座標 move 增加 revision 並直接 `redrawCanvas()`。`297–309` 把整條活動 draft 放入 renderer，使用變動的 `local:strokeId:revision` key。

`public/shared/stroke-canvas.js:120–141` 判定共同前綴、在 mutable tail 改變時恢復其 checkpoint；`56–68` 繪製筆畫時遍歷該筆的全部點。既有歷史前綴受 checkpoint 保護，活動筆畫本身仍從頭繪製。單一 draft 逐點增長的真 renderer 計數如下：

| 活動筆畫點數 N | Stroke applications | `lineTo` 呼叫 |
| --- | ---: | ---: |
| 100 | 100 | 4,951 |
| 1,000 | 1,000 | 499,501 |

單點先畫極短線，其餘 revision 各畫 `n−1` 段，總數為 `1 + N(N−1)/2`，屬 O(N²) 累積線段提交。測量使用計數 context，沒有真實 Canvas／CPU／GPU 時間；不能把 499,501 直接換算成卡頓毫秒。

`stroke-canvas.js:169–170` 的 cooperative 快路徑按 stroke 數與成本判斷，brush 算 1，fill 算 32。一條數萬點活動 brush 仍可走同步路徑。`182` 的 8ms 檢查只發生在批次中的筆畫之間，不會切開單一長路徑。因此該預算不代表所有活動長筆都能在 8ms 內畫完。

## 串列 ACK 與 RTT 排程模型

`public/draw.js:490–497` 把每批掛到 Promise `sendQueue`，等待前一個 API 完成，再遵守 `115ms` 送出間隔；fill 還有 `500ms` 間隔。未計入處理／JSON 時間時，一般筆畫的批次吞吐上限約為：

```text
start[k] = max(enqueued[k], start[k−1] + 115ms, ACK[k−1])
ACK[k]   = start[k] + RTT
rate     <= 1000 / max(115ms, RTT)
```

模型假設沒有失敗、重試、其他請求、jitter、CPU 費時或 proxy buffering，RTT 固定。長筆為 120 次有效 move／秒、持續 5 秒；每滿 40 點送一批，保留上一端點，故後續每批需 39 個新 move，pointerup 送最後部分，共 16 批。短筆為 10 次一點筆畫／秒，共 50 次，enqueue 時間從 0 到 4,900ms。短筆是假設性密集輸入，不表示真人平常會維持此速率。

| 假設 RTT | 最高批次／秒 | 長筆最後一批排隊 | 50 次短筆最後一批排隊 |
| --- | ---: | ---: | ---: |
| 20ms | 8.70 | 0ms | 735ms |
| 80ms | 8.70 | 0ms | 735ms |
| 200ms | 5.00 | 75ms | 4,900ms |
| 400ms | 2.50 | 1,325ms | 14,700ms |

表中是 enqueue 到開始送出的等待，未把傳送／server／觀看端下行／繪製加進去。觀眾的首次可見時間大致由「湊批等待＋佇列等待＋畫者上行＋server 接受／publish＋觀眾下行＋繪製」構成；畫者的 RTT 不等於觀眾下行，不能直接當成整個觀看延遲。

`draw.js:466–468` 的 undo／clear 先等完整 sendQueue，再 GET canvas、POST command；排隊因此會拖慢復原操作。直接縮短 115ms、增加 timer flush 而不處理未發送批次合併，會提高 enqueue 速率，慢網更易積壓。

## SSE 與現有安全契約

| 程式證據 | 應保留的行為 |
| --- | --- |
| `src/app.js:40,361` | 接受一批後立即 publish 新 stroke，未等下一次 room poll。publish 早於該請求的 HTTP send；觀眾不必先等畫者收到 ACK，但下一個 POST 被 sender ACK 佇列限制。 |
| `src/app.js:332–339` | SSE 使用 `no-cache, no-transform`／`X-Accel-Buffering:no`，ready 提供 epoch／round／version。標頭不證明所有代理都無緩衝，仍待真實串流量測。 |
| `public/draw.js:383–399` | 連續版號只追加新 batch；舊版忽略，缺版才 `syncCanvas()`，SSE ready 亦校對畫布版本。 |
| `stroke-canvas.js:103–118,137–158` | 有界 checkpoint／mutable-tail 基底避免每次 SSE 重播全部歷史填色；不能為改善 brush 預覽而刪掉這項保護。 |
| `draw.js:277,331–336,488–497` | 新 epoch 重設 queue／草稿／配額；實際送出及回覆套用前再驗 epoch／round，舊局資料不可重新套上新畫布。 |
| `src/games/draw-guess.js:222–247` | 驗畫者、deadline、round、epoch、batch ID、≤64 點與 10 批／秒；fill ≤2／秒，每輪最多 1,000 批／30,000 點／48 fill。 |
| `src/games/draw-guess.js:235–260` | 去重 ID 與 lifetime quota 在 undo／clear 後保留，避免藉復原繞過上限。 |

`addStroke` 的畫布版號按 server 收到、接受的順序增加，目前沒有保證客戶端多個並行 POST 按意圖順序套用的批次序號。直接 `Promise.all()` 可讓填色先於封閉線、後筆先於前筆；fill 與 undo 邊界也可能出錯。改 transport 或 pipeline 前必須定義排序、重試、去重與 command barrier，並保留 epoch／配額，不以放寬身份或上限換流暢度。

## 改善提案與驗收順序

本節是提案，未實作／未部署。

1. **先處理持筆送出等待與未送批次合併。** 加有界的時間 flush，同 stroke／epoch／工具／顏色／粗細／filled 才可合併未發出的相鄰點，維持 ≤64 點與穩定去重識別；已 in-flight 的批次不改寫。保留 server 速率／lifetime quota、pointerup 收尾及 undo／clear barrier。驗 20／200／400ms 與 jitter 下 queue depth、最後一點到達時間及像素一致性。
2. **Canvas redraw 合併到一個 rAF。** 收點與資料排序仍立即進行，單幀只繪製最新狀態，pointerup 保證最後一幀。畫布內容更新不受裝飾動畫開關限制；背景恢复保留 MessageChannel 的 cooperative 路徑，不把它全改成會在 hidden 停止的 rAF。
3. **再改善活動長筆增量繪製。** 可評估 preview layer／append-only brush 工作，但須驗尖角、圓接、粗細、橡皮擦及反鋸齒，完成時與 canonical 結果對照。不能用減少歷史 fill、epoch 核對或配額檢查來抵消成本。
4. **有量測後再評估 transport／pipeline。** POST overhead、代理 SSE 行為、完整快照 fallback 次數與實際尾延遲分開量測；現有證據沒有證明換 WebSocket 就能排除上述本機與湊批問題。

後續背景 Chrome 建議記錄有效 pointer samples、renderer 次數、frame／long-task timing、batch 建立／開始送出／ACK、SSE 到達、queue depth、缺版 snapshot 次數，以及最後像素 digest。跨席時間需對齊時鐘來源，不直接相減不同 `performance.now()` 的原點。正常短筆、長線、密集點、填色、undo／clear、重連、新 epoch 與額度邊界分別驗證。

## Gartic 參考的範圍

沿用 [既有 Gartic 網路證據](GARTIC-NETWORK-REFERENCE.md)：2026-10-05 的單席匿名 Masterpiece 樣本取得 Socket.IO／Engine.IO 邏輯訊息，畫筆更新含向量，後一則可重複前綴，fill／undo 為短命令。沒有多人接收、CPU、重連或 BGA 同場 HAR，不能推論 Gartic server 如何合併、排序、存圖，或宣稱這份樣本已證明延遲差異。

本輪產品來源保持 v1.7.1，僅新增研究文件與 ignored 離線腳本。正式站／瀏覽器測量、改善 spec 與任何後續實作另外記錄。
