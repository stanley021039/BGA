# 畫猜作畫與同步順暢度改善規格

## 最新：防閃爍與真點時間回放（2026-10-07，實作／待驗證）

候選minor v1.9.0，整合後最終1132／Linux／tag／正式仍待。使用者新要求：修画者畫布閃爍、接收端依真正點時間逐步出現且可有少量延遲；**每輪结束後都檢查**，不能只首輪或整場最後。root已確認visible clear／copyBase後yield及ACK local mutable→classic切換可暴露白底。新修正／timing均以 [本輪進度與矩陣](../DRAW-TIMED-PLAYBACK-PROGRESS.md)為準，尚未有本輪正式證據；下方v1.8.1／1076與native結果全部保留為第一批歷史，不當成本輪完成。

| 類別 | 本輪規範 | 狀態 |
| --- | --- | --- |
| atomicPresentation | live畫猜opt-in opaque staging，保留caller原creation options／canonical畫法完成整個job再一次copy到visible；所有yield在staging，保留上一份完整圖，ACK／draft settle／mode切換不先清visible。latest job／epoch才commit，whenIdle含present，長持筆不被連續取消餓死。 | 已實作候選／scoped回歸，native／整合待驗 |
| cache | staging／base／checkpoint總cache512×256≤8MiB；default16為14checkpoint＋base＋stage，maxcp2可0checkpoint，default renderer不變。 | owner最終41／41scope、renderer native4 strict0；真持筆／時序／多輪待驗 |
| pointTimes | optional僅brush／erase，與points同長的safe integer ms0..120000，chunk內非遞減／可相等；null／empty／sparse、shape／fill带times拒。server在duplicate後、rate/quota/version前驗；不新建跨chunkledger，不強制首0或anchor，continuity由前端生成／receiver維持。 | backend新7／合計30通過，整合待驗 |
| sender／wire | 同stroke相對採樣時間，coalesced／up／去重同步保留，anchor carry沿原時間；prepare後ID/body／times不變。仍單in-flight／原額度與原stroke批／SSE，無server timer／frame或逐點broadcast。 | 時間生成／整體待驗 |
| spectator live | 即時stroke才以client rAF按真點間隔呈現，新stroke buffer60ms、gap cap300／batch展開cap700／總lead900ms，同stroke連chunk保差值、極端backlog canonical；version／canonical接受不延後。artist本機preview不等待、不重播ACK。 | 真CDP單輪viewer62frames中25partial／drain empty已見；追趕/跨輪與最終source整體待验，不宣稱60fps。 |
| canonical障壁 | snapshot／首次載入／reconnect／gap、reveal／undo／clear／fill／非brush即時完整baseline，取消舊回放；公開result與收藏PNG不存部分畫作，timing不改score／deadline／DBschema。 | 回歸與native待驗 |
| C 平滑倒數 | 共用CountdownBar用WAAPI linear scaleX，native progress／秒數仍server deadline，不每frame JS／新增polltimer；hidden/pagehide取消、show/BFCache baseline、epoch／phase／newdeadline重設，不用動畫推進規則。 | 原生Animation seek linear已驗，背景约1.5s drift新增≥100ms時校正serverdeadline／1test；最終1132與native校正待root。 |
| 長期每輪回歸 | 每輪after-check畫者／接收／reveal／下一畫者：round／epoch／version、畫布完整、合法新輪空圖、無舊尾／草稿／frame／timer；native途中frame與終點canonical分開驗。 | 永久要求已記，本輪多輪結果待root |

renderer第一次native填色／erase巨大差经保留caller creation intent修正；最終4 controlled native對legacy/fresh嚴格RGBA0，不代表全部實際持筆／時間／輪次已驗。不得把省略contextAttributes改成getContextAttributes回報defaults，必保caller原選項。pointTimes cap是少延遲追趕，不保任意長停頓原樣；legacy無times live仍即時。詳本輪進度。

本輪新增真CDP25move：artist56frames／26ink growth／whiteAfterInk0、26batches51anchorspoints，viewer62frames／25partial／drain empty；只是單trace，不代替每輪。CountdownBar animationseek已linear單調，背景自然drift約1.5s後新增100ms門檻校正／1test。Windows1131第二次全pass只是校正前source，最新1132／Linux／部署待root；完整證據见本輪進度。

## 第一批v1.8.1歷史規格與發布

日期：2026-10-07。第一批 **P0及有限local-draft P1已完成，正式v1.8.1已部署**；受測source／immutable tag為6707a9edf07839c3307dd230ff6eeca5fa92bf62，archive SHA-256為8d0073c4326d2d160fbe33417409134ba1522899dea071180fbbb2404fd9a825。Windows／Linux完整各1076／1076、fail/cancel/skip/todo均0，UTC03:30:44.024Z零房間切換及正式驗收完成；P2並行POST／P3抽稀未實作。native證據為18／19 fresh strict0及一項與legacy同SHA的既有fill差，classic跨paint舊新0差但rAF控制未完成，不能寫所有native或所有雙席pixels全過。原v1.8.0／5687561及研究v1.7.1為歷史基線。實際條件、資料保存與未驗限制見 [本批進度](../DRAWING-SMOOTHNESS-PROGRESS.md)，研究見 [Gartic與本站實測](../research/GARTIC-BGA-DRAWING-COMPARISON.md)、[程式稽核](../research/BGA-DRAWING-CODE-AUDIT.md)、[固定來源](../research/DRAWING-SMOOTHNESS-SOURCES.md)；不重錄或提交原Gartic HAR。

## 目標與契約

brush／erase 輸入即使持筆未滿40點，也可有界送出；同一frame不反覆重畫活動筆；慢網的未送資料可觀察、可合併且不亂序。fill沿用pointerdown排送。觀看者、揭曉、回看、收藏與studio仍使用相容權威畫作。

保留身份／畫者／deadline／round／canvasEpoch驗證，batchId去重、canvasVersion、SSE增量與gap snapshot；每批≤64點、10批／秒、每輪1,000批／30,000點／48fill及fill間隔。undo／clear不重設lifetime quota，仍是已接受筆畫後的command barrier。不得藉提高額度或取消復原防護換速度，沿用 [PR30 資源契約](../PR30-RESOURCE-LIMITS.md)。

## 分期實作表

| 階段／owner | 調整位置與做法 | 主要驗收 | 狀態 |
| --- | --- | --- | --- |
| P0a 程式：時間flush＋有界未送點 | `draw.js` 將活動待送與immutable in-flight batch分開。第一個新點啟動140ms時間flush，40點與pointerup仍可提早要求flush。維持115ms開送下限，空批或只有重複anchor不送。只合併同epoch／round／strokeId／工具／顏色／粗細／filled的相鄰**尚未送出**點。 | fake clock：3／25點持筆不需放開即排入batch；計時不依賴move。最終端點、64點切批與跨批anchor連接完整；不超10/s（rolling1000ms）。 | 完成／v1.8.1正式；clock、native持筆與雙平台各1076已驗 |
| P0a 程式：批次固定與慢網背壓 | 準備送出時固定內容並生成batchId；已in-flight或需同ID重試的批次不能改寫。保留單一in-flight；未送點只做有界合併、不無限產生Promise／字串。pending points／bytes／oldest age可量測，容量按既有每輪額度推導，超限沿用明確錯誤與權威恢復，不靜默丟畫。 | 20／200／400ms回覆及jitter、429／500／失聯。同一長筆等待時能合併，不同筆及fill不能越界。重送同ID同內容，ACK／SSE先後都只接受一次。timer頻率與短筆收尾合計不得繞過1,000批額度。 | 完成／正式；失敗、容量、immutable重試及雙平台已驗 |
| P0b 程式：一幀一次preview | pointer handler只收點／更新資料，維持一個待執行rAF，frame中畫最新活動狀態；非空`getCoalescedEvents()`與parent擇一，空／未支援／throw以parent fallback。一次讀rect批次轉換，去相鄰重複整數點；只收同pointerId。pointerup收實際尾點，cancel只收尾、不製造新尾點。 | 同frame多次move只有一次preview paint，所有合法點／轉角／末點仍保留。pointerup／cancel立即final flush，不等背景rAF；lost capture不重複收尾。畫布內容不隨裝飾動畫開關停用。 | 完成／正式；VM與Chrome synthetic burst已驗，原生／合成範圍分列 |
| P0b 程式：背景與非即時回復 | 保留MessageChannel合作式snapshot／填色回復、取消token、epoch驗證與whenIdle。rAF只用即時preview；送出、ACK、gap恢復與deadline不依賴背景rAF。 | hidden／visible往返、換輪與舊callback、新局仍第1輪、clear及儲存等待不套舊圖；已排frame與timer在leave釋放。 | 完成／正式；hidden自動回歸、取消與idle已驗；timer不承諾背景準時 |
| P1 程式：有限本機draft層＋權威同surface重播 | 只在明確有限`mutableFrom < strokes.length`的本機未確認draft、且本epoch未遇fill時，複製opaque base後重畫mutable suffix。沒有draft／Infinity／全部ACK後改回visible同surface原classic renderer，取消舊layer job、清base checkpoints並完整canonical合作式重播。任意history／draft fill一出現就sticky classic直到reset；不再把server最後brush永遠當mutable，不保留promotion捷徑。每mode只一組最多15 ImageData checkpoints＋1base，總16surface／512×256≤8MiB。白色erase與原fill容差24／filled畫法保持。 | 固定canonical資料驗local draft及settlement、粗筆／dense chunks／尖角／erase／fill／filled／undo／clear／epoch；mode切換取消、whenIdle及cache不疊加。活動完整path仍重畫，不宣稱完全消除O(N²)；含fill不承諾新layer效益。 | 有限scope完成／正式；雙平台1076，native classic控制差另列，不泛稱全部像素通過 |
| P1 測試：重播與像素差異 | 固定同epoch，保存兩席完整strokes JSON、backing尺寸、context attributes、digest與ink mask。使用真renderer新canvas完整replay、checkpoint／draft ACK replay對照，新增captured dense static／progressive／draft-settle。first getContext維持原hint，不能以全站`willReadFrequently:true`換一套canonical pixels。 | 排除換輪空圖。以strict RGBA零差判定fresh，另列與原classic同SHA的相容比較；不能將mask相同、小量差或legacy相同寫成fresh strict通過，不推定GPU／CPU根因。 | 18 fresh strict／1 legacy同SHA但fresh362差；真viewer67在原classic亦重現，新舊0差；rAF控制未完成 |
| P2 程式／伺服器：實際傳送與pipeline評估 | 先量現有POST overhead、正式SSE到達及snapshot頻度。如仍受ACK限制，另設有client sequence／server排序／ACK offset的pipeline；命令與畫作可靠交付，游標可另作可捨預覽。 | 亂序到達、重送、重連缺版、fill與closed outline、undo／clear barrier都保持意圖順序。未定排序前不可直接並行POST。是否WebSocket由實測決定。 | 未做 |
| P3 程式／玩家：點抽稀／畫質 | 先驗相同整數點去重，再比較保端點／轉角的距離抽稀；壓感／曲線codec另开相容規格。參考Fabric、perfect-freehand但不直接套新畫法。 | 同trace比較幾何誤差、細字／轉角辨識與重播；只減點數不算成功。授權及舊收藏畫法相容需核對。 | 未做 |

125–150ms原為研究候選範圍，本批owner選140ms，尚未由真Chrome量得最佳值；實際開送還受in-flight、限流與server接受影響，不承諾140ms內觀看者可見。sender entry最多1000、尚未送點最多30000，兩者是記憶體界線，與server lifetime quota分開；metrics的pendingPoints／pendingBytes只計未送queue，inFlightPoints另列，oldestAge自最老job入列計算。stroke request與權威snapshot GET各有10秒timeout；snapshot依job身份／round／epoch判斷，取消後舊finally不能清理新GET。暫時DRAW_RATE_LIMIT／500／網路／解析／timeout最多3attempt同ID同body；永久WORK_LIMIT清未送資料、明確提示並權威sync。已知quota只在首attempt拒新批，已接受但ACK失聯的同ID重試仍可去重，不能因SSE先用完quota就阻擋它。聚焦失敗回歸已驗，完整與native結果仍見本批進度。

## 官方輸入語意補驗與相容界線

本節於2026-10-07查核官方文件。coalesced只用同一批的非空列表，parent是摘要，不再重畫兩組；list為時間順序。`pointerup`不是move，收它的實際末座標；`pointercancel`沿最後已dispatch座標且列表為空，只結束現有筆畫。這些是輸入收尾規則，不把predicted events加入canonical點。[W3C Pointer Events §10.1](https://www.w3.org/TR/pointerevents3/#coalesced-events)、[pointerup](https://www.w3.org/TR/pointerevents3/#the-pointerup-event)、[pointercancel](https://www.w3.org/TR/pointerevents3/#the-pointercancel-event)。

coalesced在部分瀏覽器及安全context才提供，必須feature detect與空／throw fallback；真實支援分別由native輸入與明示的合成fixture驗。rAF在隱藏頁常暫停，且一次請求只執行一次，不能作為sender、command barrier或可靠儲存完成的唯一排程；frame ID用null作空值，leave／epoch清理。[MDN coalesced](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents)、[MDN rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)。

| 必保契約 | 本批調整的可接受界線 |
| --- | --- |
| quota／去重 | 每批1–64點；rolling1000ms最多10批；每輪1000個accepted batchId／30000 accepted points／48fill，fill每秒2次，command每秒2次。carry anchor也計accepted points；undo／clear不退lifetime quota。timeflush可增加batch成本，要記錄而不是提高上限。 |
| immutable request | server按batchId去重，不驗同ID重送body fingerprint；client送出後的ID／內容必須保持固定。不能把慢網已送點改寫成新大批，或在timeout後以新ID重送已接受的同批。 |
| canonical strokes | brush／erase跨批保留anchor與樣式，line／rect／ellipse仍2點，fill1點；server `filled===true`語意、0.5座標偏移、圓cap/join與白色erase保留。render資源優化不改向量codec。 |
| SSE／HTTP次序 | publish仍在server接受後、HTTP send前；SSE先到或ACK先到都只套一次。缺version才snapshot，quota採權威上限累積，不能用draft移除或reset回應退回額度。 |
| command barrier | active筆尚未完成時不undo／clear；完成後等待sender所有既定點／in-flight／排程，然後同步、command及最新renderer idle。undo刪同strokeId的最後所有chunks，clear保留epoch／quota。 |
| 收藏／storage | public result固定快照／resultId權限不變，收藏仍獨立encoder renderCooperatively完才PNG，失敗／舊epoch禁止部分圖。studio／回看default renderer與原填色語意保留；metadata／DB／媒體格式無變更。 |

在上述API、wire／作品語意及可靠性全部相容時，P0／P1可按patch v1.8.1交付。若native pixels顯示填色位置、圖形或已完成作品語意改變，要先解差或另立相容規格，不將畫法改動包裝成單純效能修正。

本批native實測因此收斂P1：原分層方案在白色erase覆已fill底圖時有1,073個RGB差像素、最大channel差90及133個ink-mask差；改first context hint雖診斷15場景全pass，卻使11場景的canonical SHA改變，不能當相容修復。1000-move／400ms延HTTP trace的16chunks／1015含anchor點，captured dense static／progressive／draft-settle原layer分別差45／209／45 RGB像素、max54，exact ink-mask均0，而同surface classic均0差。mask相同不足以接受；最終source必須重驗上述限定layer與canonical settlement方案，詳細證據與未驗狀態見 [本批進度](../DRAWING-SMOOTHNESS-PROGRESS.md)。

縮限source的最新19場景已重驗：captured dense static／progressive／draft-settle均對fresh RGBA零差；總計18／19 fresh strict，fill-dependent-on-mutable-divider與legacy同SHA、同樣對fresh差362 RGB／max13／alpha0／exact mask0，整體strict flag仍false。另乾淨room的1000 synthetic-move事件轉換去重後948點、16chunks／963含anchor點，兩席canonical JSON相同；artist對fresh0差，viewer67 RGB／max54，而且viewer baseCopies0／mutable applications0，全程classic。classic跨paint timeout20ms／warmup0及1兩組已重現old/new0差（rAF兩組未完成），不能宣稱雙席pixels全相同或沒有證據歸因玩家硬體。Windows／Linux完整各1076已通過，source 6707a9edf07839c3307dd230ff6eeca5fa92bf62／v1.8.1已正式發布；上述native限制保留。

最新classic跨paint控制已在同一16chunks／948有效點／963含anchor點重現：每chunk隔timeout20ms，warmup0／1兩組原classic與opt-in Infinity均對fresh差67 RGB／max54／alpha0／exactmask0，old/new直接diff0、SHA相同。此固定capture證實原classic也有該差，不外推全部case、不推定硬體／GPU／CPU。兩組rAF控制2秒未advance，沒有完成驗證，整體control flags仍false，不能把它們列pass；Chrome未被提至前景。

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

純研究不升版；本批P0／有限local-draft P1已作相容效能patch v1.8.1，完整雙平台各1076與正式發布見 [本批進度](../DRAWING-SMOOTHNESS-PROGRESS.md)。相容判斷保留原API／wire／額度／codec／收藏及classic行為；native fresh與增量classic差分開記錄，不承諾消除全部既有AA差或O(N²)。P2並行POST／新排序與P3抽稀／新畫法仍條件式後續提案，這批未做。沒有新PR／push，既有PR43未改；後續純文件提交不移動受測tag。
