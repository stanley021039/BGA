# 畫猜作畫與同步順暢度改善規格

日期：2026-10-07。狀態：**研究後提案，未實作／未部署**。基線 v1.7.1／`3d82e3f`。證據見 [Gartic 與本站實測](../research/GARTIC-BGA-DRAWING-COMPARISON.md)、[真程式稽核](../research/BGA-DRAWING-CODE-AUDIT.md)、[固定版本開源來源](../research/DRAWING-SMOOTHNESS-SOURCES.md)。本規格不把研究等同上線。

## 目標與契約

brush／erase 輸入即使持筆未滿40點，也可有界送出；同一frame不反覆重畫活動筆；慢網的未送資料可觀察、可合併且不亂序。fill沿用pointerdown排送。觀看者、揭曉、回看、收藏與studio仍使用相容權威畫作。

保留身份／畫者／deadline／round／canvasEpoch驗證，batchId去重、canvasVersion、SSE增量與gap snapshot；每批≤64點、10批／秒、每輪1,000批／30,000點／48fill及fill間隔。undo／clear不重設lifetime quota，仍是已接受筆畫後的command barrier。不得藉提高額度或取消復原防護換速度，沿用 [PR30 資源契約](../PR30-RESOURCE-LIMITS.md)。

## 分期實作表

| 階段／owner | 調整位置與做法 | 主要驗收 | 狀態 |
| --- | --- | --- | --- |
| P0a 程式：時間flush＋有界未送點 | `draw.js` 將活動待送與immutable in-flight batch分開。第一個新點啟動時間flush，候選125–150ms經量測選定；40點與pointerup仍可提早要求flush。維持115ms開送下限，空批或只有重複anchor不送。只合併同epoch／round／strokeId／工具／樣式的相鄰**尚未送出**點。 | fake clock：3／25點持筆不需放開即排入batch；計時不依賴move。最終端點、64點切批與跨批anchor連接完整；不超10/s。 | 未做 |
| P0a 程式：批次固定與慢網背壓 | 準備送出時固定內容並生成batchId；已in-flight或需同ID重試的批次不能改寫。保留單一in-flight；未送點只做有界合併、不無限產生Promise／字串。pending points／bytes／oldest age可量測，容量按既有每輪額度推導，超限沿用明確錯誤與權威恢復，不靜默丟畫。 | 20／200／400ms回覆及jitter、429／500／失聯。同一長筆等待時能合併，不同筆及fill不能越界。重送同ID同內容，ACK／SSE先後都只接受一次。timer頻率與短筆收尾合計不得繞過1,000批額度。 | 未做 |
| P0b 程式：一幀一次preview | pointer handler只收點／更新資料，維持一個待執行rAF，frame中畫最新活動狀態；正常資料可選`getCoalescedEvents()`，空／未支援以原事件fallback。一次讀rect批次轉換，去相鄰重複整數點；只收相同pointerId。 | 同frame多次move只有一次preview paint，所有合法點／轉角／末點仍保留。pointerup／cancel立即收尾與flush，取消／處理frame不丟最後一點。畫布內容不隨裝飾動畫開關停用。 | 未做 |
| P0b 程式：背景與非即時回復 | 保留MessageChannel合作式snapshot／填色回復、取消token、epoch驗證與whenIdle。rAF只用即時preview；送出、ACK、gap恢復與deadline不依賴背景rAF。 | hidden／visible往返、換輪與舊callback、新局仍第1輪、clear及儲存等待不套舊圖；已排frame與timer在leave釋放。 | 未做 |
| P1 程式／美術：活動層 | 已確認底圖與活動筆畫分成canvas／暫存層，先每frame只重畫活動層；ACK轉為權威、undo／clear／fill／錯誤／epoch換輪時重建。日後再採append尾段或dirty rect，不能假設短線段疊畫等於完整path。 | 對同canonical資料驗粗筆、單點、圓端／圓接、尖角、自交、橡皮擦、填色、各形狀及畫者／觀看者／回看／收藏／studio。canonical完成時位置與色彩一致，預覽不可越畫越深。 | 未做 |
| P1 測試：重播與像素差異 | 固定同epoch，保存兩席完整strokes JSON、backing尺寸、context attributes、digest與ink mask。使用真renderer新canvas完整replay、checkpoint／draft ACK replay對照。可額外比較first getContext採同一willReadFrequently模式，不從hint推斷實際GPU。 | 排除換輪空畫布的偽吻合；判定差是AA邊緣還是位置／填色語意。若容許AA tolerance，先寫門檻與理由，不能因hash不等就任意放寬。 | 未做；研究8點差異待查 |
| P2 程式／伺服器：實際傳送與pipeline評估 | 先量現有POST overhead、正式SSE到達及snapshot頻度。如仍受ACK限制，另設有client sequence／server排序／ACK offset的pipeline；命令與畫作可靠交付，游標可另作可捨預覽。 | 亂序到達、重送、重連缺版、fill與closed outline、undo／clear barrier都保持意圖順序。未定排序前不可直接並行POST。是否WebSocket由實測決定。 | 未做 |
| P3 程式／玩家：點抽稀／畫質 | 先驗相同整數點去重，再比較保端點／轉角的距離抽稀；壓感／曲線codec另开相容規格。參考Fabric、perfect-freehand但不直接套新畫法。 | 同trace比較幾何誤差、細字／轉角辨識與重播；只減點數不算成功。授權及舊收藏畫法相容需核對。 | 未做 |

125–150ms是第一批候選送出週期，不是已量得最佳值；實際開送還受in-flight、限流與server接受影響，不能承諾所有網路下150ms內觀看者可見。發送錯誤回復可沿用既有政策，重試／容量的最終實作需明確寫出，不任意創建無限重試。

## 量測與驗收矩陣

| 測項 | 條件 | 要記錄的證據 |
| --- | --- | --- |
| 本機preview | 空圖、很多brush、fill历史；100／1,000／上限長筆；正常move與coalesced；無網路亦測 | input receipt→本機render完成／下一frame、有效點數、frame paints、最長paint、lineTo工作量、longtask。Performance數據區分同frame提交與真正present，不能只用rAF數算FPS。 |
| 傳送 | 慢持筆3／25點，正常曲線，密集短點，不同stroke/style，fill | 點建立→排隊→POST開始→server接受／ACK；queue点／bytes／oldest age；接受batch／quota／429。 |
| 觀看者 | 雙席、20／200／400ms、jitter、斷SSE／恢復、畫者ACK較晚 | SSE到達→render idle／paint、version gap／snapshot次數、末點完成、canonical JSON／pixel mask。各tab `performance.now()`原點不同，先校時或各段獨立量，不直接相減。 |
| 規則邊界 | undo／clear／fill、儲存收藏、換輪／同房新局、舊POST／ACK／snapshot／SSE | 沒有亂序、重複、越權／過deadline、舊epoch回灌；有限記憶體、取消與資源釋放；原PR30回歸通過。 |
| 真裝置體感 | 同Chrome與同尺寸真人畫線，至少正常可见tab／背景分開；使用者另一台電腦如有數據再加 | 獨立記錄local lag與remote lag；工具自動輸入不是人體120Hz。沒有另一台資料不得歸咎硬體，沒有同條件不得說快幾倍。 |

每期以同一trace及程式版本前後對照；P0成功至少包含「未滿40點持筆已開始送出」、「多move同frame只畫一次」、「高延遲佇列有界」、「可靠性回歸通過」。活動層優化需另交真像素／語意證據，不以操作計數替代CPU/GPU測時。

## 與既有模組的界線及交付

`public/shared/stroke-canvas.js`供畫猜、回看及其他畫作入口共用，不能只修改draw live而忽略收藏／studio。`StrokeCanvas.createRenderer()`回傳的`renderer.whenIdle()`、取消及可重入渲染契約需保持。網路scheduler與live preview各自有生命周期，換epoch／leave必須清理。沒有理由用高頻PNG取代既有向量／SSE。

來源授權與擇用：Fabric／Excalidraw為MIT，重用仍保留所需notice；WBO為AGPL，先獨立實作設計，不默認可直接搬原碼。研究資料不是Gartic的內部規格。

純研究不升版；實際修正完成後依 [版號規範](../RELEASE-POLICY.md)判定patch／feature影響、更新CHANGELOG、測試與記錄實際程式來源。實作、發布、PR各自依當次授權；本文件不宣告任何階段已完成。
