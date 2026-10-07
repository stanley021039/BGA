# 畫猜作畫與同步順暢度進度

日期：2026-10-07。第一批 **P0及有限local-draft P1完成並部署為正式v1.8.1**；source／immutable tag 6707a9edf07839c3307dd230ff6eeca5fa92bf62，archive SHA-256 8d0073c4326d2d160fbe33417409134ba1522899dea071180fbbb2404fd9a825。基線v1.8.0／5687561、原研究v1.7.1及前期測試保留為歷史。Windows／Linux完整各1076、UTC03:30:44.024Z零房間切換及正式資料／HTTP-SSE／版號驗收完成；P2／P3未做。native只有18／19對fresh strict0，一項與legacy相容及classic跨paint差皆另列，rAF控制未完成，不能泛稱所有native全pass。研究／規格見 [spec](specs/DRAWING-SMOOTHNESS.md)、[實測](research/GARTIC-BGA-DRAWING-COMPARISON.md)、[稽核](research/BGA-DRAWING-CODE-AUDIT.md)及 [PR30契約](PR30-RESOURCE-LIMITS.md)。

## 第一批實作表

| 優先序 | 位置／方案 | 實作與驗收界線 | 進度 |
| --- | --- | --- | --- |
| P0 | 畫猜sender的時間flush | 少於40點持筆仍排送，owner選140ms／40點／pointerup收尾；單一in-flight、115ms開送下限、fill500ms、≤64點。140ms不是觀看延遲保證，hidden／RTT另列。 | 完成／v1.8.1正式；clock、native持筆與雙平台各1076已驗 |
| P0 | 有界未送buffer | 同epoch／round／strokeId／tool／color／size／filled的相鄰未送點才merge，prepare固定batchId／deep-freeze body。entry≤1000／queued points≤30000，metrics points／bytes／age；timeout10秒、暫時rate-limit／500／網路／解析／timeout最多3attempt同body／ID，WORK_LIMIT永久失敗清未送＋提示＋權威sync。 | 完成／正式；失敗與容量回歸／雙平台已驗 |
| P0 | 一幀一次preview／coalesced | 接收點立即更新資料，一個pending rAF；非空coalesced列表與parent擇一，空／throw／unsupported fallback。pointerup收尾點，cancel不制造末點；network／commands不依賴rAF。 | 完成／正式；VM與trusted down/up＋synthetic burst已驗 |
| P0 | 所有取消／barrier | command等待sender drain及權威sync，renderer idle後才完成；clear／undo／epoch／leave取消舊timer/frame/request，舊SSE／ACK／save不灌新畫布。 | 完成／正式；barrier、epoch、取消及雙平台各1076已驗 |
| P1 | 有限local draft layer／權威classic | 只有明確有限`mutableFrom < strokes.length`的local draft且本epoch未遇fill走layer；無draft／Infinity／全部ACK使用visible同surface原classic。切換清base checkpoints、取消舊job並完整合作式canonical replay；fill出現後sticky classic直到reset。移除server最後brush永遠mutable與promotion。兩mode只保留一組15 checkpoints＋1base，總16surface／512×256≤8MiB。 | 有限scope完成／正式；兩mode／單組cache與雙平台已驗，classic控制差另列 |
| P1 | 同epoch native replay驗收 | 固定canonical JSON／尺寸／context，雙席及獨立完整replay strict RGBA零差；8短點、逐ACK draft settle與captured dense static／progressive／settle，不能換輪空圖消差、不能放寬AA。 | 18 fresh strict／1 legacy同SHA但fresh362差；真viewer67在classic也重現，新舊0差，rAF控制未完成 |
| P2 | 並行POST／新transport pipeline | 需另設server排序／sequence／ACK offset／retry／barrier，先量ACK與SSE。這批仍單一in-flight，不用Promise.all偷跑。 | 未實作；後續條件式提案 |
| P3 | 抽稀／壓感／曲線codec | 不更改canonical點或画法；本批只去相鄰相同整數點。幾何誤差、文字辨識、授權與舊作品相容另驗。 | 未實作；後續條件式提案 |

P1只優化符合上述条件的本機draft，含fill與已確認圖不走新layer；仍每次重畫活動完整path，減少重播history不等於完全消除活動長筆累積O(N²)。rAF提交次數、lineTo或checkpoint計數也不等於真正FPS／GPU／CPU耗時；不以操作計數宣稱快幾倍。

## 唯讀契約複核與角色攻防

| 原契約／證據 | 必保界線／實作風險 |
| --- | --- |
| `DrawGuessRoom.addStroke` | 當輪畫者、deadline、round、canvasEpoch先驗；batchId去重後拒非法tool／size／color／點數與座標。每批≤64、rolling1000ms最多10，1000accepted batchIds／30000 accepted points／48fill及fill2/s不變，carry anchor也計points。 |
| batchId只有ID去重 | server未比較同ID body fingerprint，client已送內容不可變；未送coalescing不能修改in-flight，失聯重試要同ID同body而不是另生ID重畫同批。 |
| `canvasCommand` | command每秒2次；undo刪最後同strokeId的所有chunks，clear保留epoch／batchIds／acceptedPoints／fill quota。禁止為送筆快而退額度、省掉command barrier或平行POST。 |
| `redrawCanvas`／SSE | 本人draft可遮同strokeId已接受chunks；draft finished／pending0／ACK版已見後才settle。SSE publish早於HTTP回覆，兩種次序、duplicate、gap snapshot、stale reset都須驗。 |
| canonical `drawStroke` | erase實際是#fff source-over，非透明擦除；fill讀完整当下surface做24容差。0.5偏移、single dot、圓cap/join、filled rect／ellipse保留，不能只在透明suffix做fill或重疊疊畫變深。 |
| `createRenderer` | 保持同步render、合作式snapshot、cancel token／reset／whenIdle；只local draft opt-in layer，settled／viewer回原同surfaceclassic。fill-bearing epoch sticky classic至reset；mode切換只保留單組cache，完整canonical重播後才idle。單筆／單次fill仍不可搶占。 |
| 收藏／回看／studio | 固定public result snapshot、resultId授權与metadata不改。收藏獨立encoder等renderCooperatively才PNG，晚回覆／換epoch不存錯圖；其他入口default renderer可fallback。 |
| `shared/api.js` | 新可選signal與error.status/code需保持原呼叫相容；舊epochAbortError不全站斷線，真正timeout保持原失聯處理。完整shared-api／其他遊戲回歸不能只跑draw。 |

2026-10-07已和兩個source owner討論：前端確定140ms／1000entries／30000queued points、單in-flight及shared drain Promise；暫時失敗最多3attempt同ID-body，永久WORK_LIMIT清未送與權威sync。cancel即使合成座標不同也只收尾、不當新點，且明確區分queued cap與lifetime quota；coalesced依官方語意選非空list而不再畫parent。stroke与snapshot GET各有10秒timeout，snapshot獨立job identity防舊finally清新GET；重試backoff受reset取消，首attempt以後允許同ID去重重送已接受但ACK失聯的最後quota批。metrics pendingPoints／bytes為未送queue，inFlightPoints另列，oldestAge自最老job入列算。後端確認opaque base＋visible copy、不用透明suffix獨立fill，白色erase與15checkpoint＋1base、取消／idle保留；Path2D只評估沒有換畫法。native AA與研究8點差仍交root真Chrome，不把自制raster替身當像素通過。最終source 6707a9edf07839c3307dd230ff6eeca5fa92bf62／v1.8.1及相容控制、雙平台與正式驗收見下方，native限制保留。

獨立唯讀review的六檔聚焦驗證於2026-10-07通過 **56／56**，fail／cancel／skip均0，duration1026.9077ms：`draw-input-transport`、`draw-canvas-epoch`、`stroke-canvas-layered`、`stroke-canvas-cooperative`、`stroke-canvas`、`shared-api`。涵蓋snapshot timeout釋放ACK drain、舊finally不能清新GET、取消backoff、quota不足停止timer、SSE耗盡quota後同ID重試、命令順序、filled／fill／erase、合作式取消與cache上限。這筆是後續P1 native fallback修正**之前**的source，不能當最新renderer驗收；自制raster沒有重現native AA差，後來native發現相容缺口已收斂方案。既有command POST與state poll未在本批新增10秒deadline；保留其原來錯誤／換epoch guard，不把stroke與snapshot有界宣稱為所有網路請求均有deadline。

官方輸入補驗：trusted coalesced已時間排序，parent為摘要，列表和parent不重複繪製；pointercancel是既有stream結束而非新座標；pointerup需收自己尾點。[W3C coalesced](https://www.w3.org/TR/pointerevents3/#coalesced-events)、[pointercancel](https://www.w3.org/TR/pointerevents3/#the-pointercancel-event)、[pointerup](https://www.w3.org/TR/pointerevents3/#the-pointerup-event)。rAF可能在hidden暫停，coalesced支援亦受context／瀏覽器限制；因此保留fallback、timer及MessageChannel恢復。[MDN rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)、[MDN coalesced](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents)。

## 真正 Chrome 驗收矩陣

| 測項 | 實際方法／固定条件 | 必須保留的證據 | 狀態 |
| --- | --- | --- | --- |
| 3／25點慢持筆 | 同一trace對照凍結v1.8.0與新sender；原生pointerdown／move，未pointerup先觀察 | 首POST是否持筆已開始、point建立→queue→start→ACK及觀看者SSE；不把不同performance原點直接相減 | baseline與新版native持筆已驗，見下方數據 |
| 本機rAF | 同frame多move及停筆，native與合成coalesced fixture分開 | receipt數／有效點／paint數、末點／轉角、longtask與render耗時；不把rAF數叫FPS | Chrome trusted down/up＋1000 synthetic moves burst已驗；不是1000次原生move |
| 未送coalescing與背壓 | upstream接受後人工20／200／400ms延HTTP回覆，SSE照常；長筆／多短筆／不同工具分別 | jobs／points／bytes／oldest age上限、in-flight1、batchID/body不改、最後ACK及quota／point anchor成本 | VM三延遲已驗；Chrome400ms／1000點16批已驗；latest dense classic差與相容控制另列 |
| endpoint／cancel | 原生pointerup不同於最後move，pointercancel／lostcapture、其他pointerId、矩形与ellipse | 最後一點／2點形狀／1點fill、只結束一次；unsupported／空coalesced／throw fallback | trueVM與双平台回歸已驗；Chrome trusted up已驗，OS原生cancel／lostcapture未真觸發，不將合成fixture冒稱OS原生 |
| 跨批權威 | 同stroke長線、尖角／自交／粗細、單點、erase、filled／outline、fill閉合區 | 固定epoch兩席canonical JSON、canvasVersion、native replay hash／ink mask；非空圖、renderer idle且仍同epoch | 縮限19場景18 fresh strict、dense三場景0；真viewer67差已在classic timeout控制重現；rAF未完成 |
| 研究8短點 | 固定原短點trace，逐ACK草稿settle與獨立完整renderer | 相同JSON／backing/context、實際pixels和AA差分；若差異不得任意放寬門檻 | native19矩陣含eight-dots ACK/SSE兩次序皆fresh strict0；不將所有舊Gartic研究資料重定義為通過 |
| PR30恢復 | 48fill、第49次拒、undo／clear、draft／gap snapshot／SSE重連 | fill只新增一次、checkpoint≤總16／8MiB、quota不退、合作式取消／idle、未完整圖不儲存 | 48fill／容量／合作式取消／cache／quota回歸及雙平台已驗；正式undo/clear quota不退亦已驗，未在正式壓48fill |
| 規則與錯誤 | 不同artist／離席／deadline、429／500／lostACK／timeout／abort、換輪及同房新局又round1 | 同epoch檢查、stable body重試或明確回復、舊request/frame/timer不復活、command前後無亂序 | 自動回歸／双平台已驗；正式nonartist400、duplicate及undo/clear quota不退；人工故障未逐項在正式重做 |
| 成果保存 | 揭曉／跨輪回看／收藏PNG／studio，用同canonical画作 | 原授權／作品metadata／像素語意與storage idle，不能用新輪空canvas冒充結果 | 保存／encoder／studio自動回歸已驗；正式未提交收藏或寫角色／作品，本次Chrome未真操作studio PNG |
| 背景與清理 | 真document.hidden往返、rAF節流、離房／關tab | sender不靠rAF、背景延迟單列、資源取消與還原測試viewport；不提高Chrome前景 | 背景preview／正式home已驗與清理；tabs／queue／control／fixture清空，無viewport override，未影響前景；rAF控制未完成 |

測量影片／工具腳本輸入不是人體採樣率；人工延遲不是正式網路RTT。沒有另一台裝置資料不得判定使用者電腦故障，也不能用Gartic單席封包推其多人FPS。原HAR／cookie／帳密仍只在核准私有位置，這份文件只放去敏摘要。

## 固定 v1.8.0 baseline 證據

root在凍結來源`56875616c9367a25dd369c175c2b949f7861de9c`以同Chrome兩席、brush6px原生slowtool trace重現：持筆25個不同整數點，畫者applications25／restores24／canvasVersion1，stroke POST0；觀看者strokes0／version1。pointerup後1POST、25點、469 JSON bytes／200。工具輸入耗時約24.4秒，不能當真人採樣率或FPS。

收尾仍同epoch／round1／version2，captured phase已reveal但畫布非空；兩席ink1549、canonicalJSON SHA-256均`b1e575a5e26ed37fa77122f210ede1a2bebddf520f6b113f1800d8096b8ddc4f`，pixels SHA-256均`2fb1ca1c36641af67604ecffe71b2d67201d2fae39a13219ed14d1ead6ace05c`。私人去敏證據`work/drawing-smooth-baseline-native.json`；proxy原始log仍在ignored work不提交。baseline tabs與fixture服務已正常停止。

新sender可能切成不同batches，不能要求這個舊trace的pixel hash與新版恰好相同；P1驗的是**同一份canonical資料**在雙席／mutable renderer／完整replay的一致性。baseline本身不驗新版140ms或活動層，不將baseline吻合替代研究8短點或本批native回歸。

## 新sender證據與P1保守收斂

P0凍結sender以同native slowtool25點trace，持筆active25／canvasVersion25，viewer已見24個accepted chunks／version25／尾點[224,102]；最後新點仍在140ms timer的pending2，尚未pointerup。原baseline同持筆25點是version1／viewer0。另3點持筆viewer已見2chunks／version3。up後仍同epoch／drawing／round1／version26，兩席25chunks、49點（含carry anchors）、ink1603、drafts0；canonical JSON SHA-256同為`ad646cc2899740458d7dbaac90c89f6eba8baca6b29c30ae419b7d2099156483`，pixels SHA-256同為`0032007c44bc4e0b7698e7b371cc0ed687da0397d22867181e996d6c1587f1b2`，各對完整canonical replay均0diff／max0。25 moves的工具間隔約1秒，preview仍25次；這是持筆開始傳送的證據，不是rAF省25倍或真人FPS。去敏數據在ignored `work/drawing-smooth-held-native.json`／`work/drawing-smooth-settled-native.json`，不提交原封包。

Chrome另外以trusted pointerdown／up，中間單task1000次**合成**move，active points1000；task前後renderer0次應用／pending rAF1，下一rAF只1次應用／999 lineTo。背景頁約970ms排程等待不作FPS或人體lag。人工延HTTP400ms、SSE照常：一筆未送queue976點／9511 JSON bytes／1entry，準備後in-flight64點／1attempt；最終16requests各≤64、sum1015點包含15carry anchors，兩席同epoch JSON一致。此項證明preview合併與有界切批，不宣稱P1最終pixels通過。

原P1 native矩陣default15場景14pass／1fail：white-erase-on-colored-prefix有1,073個RGB不同像素、最大channel差90、ink-mask差133、alpha差0；同surface legacy完全0差。`willReadFrequently:true`診斷15pass，但11場景canonical SHA本身改變，不能為通過切換全站first-context hint；不推定CPU／GPU根因、不放寬AA tolerance。

上面1000點dense trace再暴露已完成layer相容問題。固定captured canonical的static／progressive／draft-settle，原layer分別有45／209／45個RGB差像素、max54，exact ink-mask都0；classic三者均RGBA零差。root ignored `work/drawing-smooth-native-dense-diagnostic.json`於UTC03:08:40.635Z記19場景（原16＋這3場景），這是修正前失敗診斷，不能說19場景已pass。mask相同也不足以接受。

因此最新P1方案只將明確有限local draft放layer；沒有draft／Infinity／所有ACK完成與viewer走原visible同surfaceclassic，切換取消舊layer job、清base checkpoints並完整合作式重播；任何fill使classic sticky直到reset。兩mode不保留兩組cache，單組15ImageData＋1base≤8MiB；取消server末筆brush永久mutable與promotion捷徑。最新source已驗Windows、19場景與真雙席dense，結果如下；Windows／Linux完整與正式發布已完成，native限制保留。先前Windows1068／1068、前端owner focused150及本agent56均有各自source scope，不能替代這輪修正後結果。

## 最終縮限source與原生像素限制

最終Windows全套 **1076／1076**、duration37689.229ms；Linux Node22.22.1 **1076／1076**、duration189955.125522ms，兩端fail／cancel／skip／todo均0。ignored work/drawing-smooth-windows-tests.log與work/drawing-smooth-linux-tests.log保留完整輸出，受測source為6707a9edf07839c3307dd230ff6eeca5fa92bf62；不以prefallback1068代表最新版本。

UTC03:19:43.885Z的ignored work/drawing-smooth-native-pixels-scoped.json固定19場景、tolerance0：**18對fresh strict RGBA零差**，captured dense static／progressive／draft-settle三場景均0且mode canonical。唯一fill-dependent-on-mutable-divider為362個RGB差像素、max13、alpha0、exact ink-mask0；新wrapper與legacy的pixels SHA相同，兩者同樣不同於fresh完整replay。因此它是與原classic相容的控制結果，**不是fresh strict通過，整體layeredPassed仍false**，不得寫「19項像素全部通過」。

最新乾淨room的Chrome流程於drawing／round1／version17／drafts0，送1000個synthetic-move事件，轉換與相鄰去重後948點，16chunks／963點含15anchors；與先前1000有效點／1015含anchors是兩個case，不能混算。兩席canonical JSON SHA-256均fcb95b47159b65be442dc0afd6e1f63f7a828f1b3cb74ad7979e1480859bd284、ink均15696，但pixels不同：artist為2e0b6e7c4753abb430821a41c15152dd051ab590c84ca2de47e43f78bd6bf0a0且對fresh0diff／max0；viewer為fd3edfe185bc683408dad1889f09c4fcde0effb88c51c672aa81b242ca317bc2且對fresh67 RGB／max54。viewer mode canonical、baseCopies0／mutableStrokeApplications0／mutableLineTo0，全程classic；沒有證據把此差歸因layer、GPU或使用者電腦。去敏ignored work/drawing-smooth-clean-settled.json保留實證；classic跨paint timeout20ms／warmup0及1兩組已重現old/new0差（rAF兩組未完成），不能宣稱雙client pixels全一致。

正式readonly inventory於UTC03:23:43.697Z仍v1.8.0／5687561、PID107492，schema15／21tables／8users、integrity ok／FK0；這是啟用前的歷史狀態；隨後UTC03:30:44.024Z才guard切至v1.8.1，不將先前readonly本身當發布或資料移轉。

最新classic跨paint控制已在同一16chunks／948有效點／963含anchor點重現：每chunk隔timeout20ms，warmup0／1兩組原classic與opt-in Infinity均對fresh差67 RGB／max54／alpha0／exactmask0，old/new直接diff0、SHA相同。此固定capture證實原classic也有該差，不外推全部case、不推定硬體／GPU／CPU。兩組rAF控制2秒未advance，沒有完成驗證，整體control flags仍false，不能把它們列pass；Chrome未被提至前景。 去敏證據為ignored work/drawing-smooth-classic-crosspaint-control.json，UTC03:24:21.640Z。

## 本批結果與版本

| 驗收 | 結果 |
| --- | --- |
| P0 scoped回歸 | 前端14檔focused150／150、37.409s、0fail/cancel/skip，新20cases通過並已freeze；含其當時P1 source，不能當最新renderer回歸。 |
| P1 renderer回歸／native像素 | 最新19場景18 fresh strict、1 legacy同SHA但fresh362／max13；captured dense3 strict0。真dense artistfresh0／viewerclassic67差，timeout20ms兩組old/new0差已驗，rAF兩組未完成 |
| Windows／Linux完整 | Windows1076／1076、37689.229ms；Linux Node22.22.1 1076／1076、189955.125522ms，兩端fail/cancel/skip/todo均0 |
| 隔離Chrome前後對照 | P0 native持筆／合成burst／400ms背壓已驗；最新1000事件／948有效點case同JSON但viewer pixels不同，不冒稱全部通過 |
| 正式版號／source／tag／備份／資料保全 | UTC03:30:44.024Z正式v1.8.1／6707a9e、0roomguard；service/tunnel active，schema15／21schema／20non-session rows+BLOB／8帳戶全欄位保留，備份與公開驗收見下節 |

## 正式發布、資料保存與清理

受測source／本地immutable tag v1.8.1為6707a9edf07839c3307dd230ff6eeca5fa92bf62，archive SHA-256 8d0073c4326d2d160fbe33417409134ba1522899dea071180fbbb2404fd9a825；後續純文件提交不移動tag。Windows／Linux完整各1076、prepare及隔離副本21table／8帳戶全欄位一致、3197啟動已驗。UTC03:30:44.024Z guard觀察0房間後，current由releases/5687561切至releases/6707a9e，PID107492→110715，app service／tunnel active。沒有新PR／push，既有PR43未修改。

啟用前備份標識pre-drawing-smooth-fixes-6707a9e-20261007T033038Z-fe748d11-c50c-44d7-b708-69cc1bf071f6。SQLite為線上備份，data files與env是另一時點的檔案archive，**不是atomic cold snapshot**。最終schema15、21schemas、20個non-session表逐列／BLOB與8帳戶全部fields保留，integrity ok、FK0；sessions161→165是本批QA登入變動且自有QAauth已登出，不能宣稱session rows或bytes不變。沒有導入外站資料代。

公開no-store版號v1.8.1與5資源精確內容／no-store已比對；5資源loop沒有逐項assert MIME，不能寫5項MIME全驗。SSE另有content-type與cache-control驗證。三個既有自有會員透過正式HTTP/SSE驗draw stroke、同ID duplicate quota不變、nonartist400、undo／clear lifetime quota不退；HTTP ACK25ms／SSE觀察26ms是這次公開API量測，**不是Chrome input-to-paint**。正式未寫角色／作品，自有QAroom正常leave刪除、自有QAauth登出，QA history依原策略保留。

正式Chrome只新增背景home讀既有session，設定顯示v1.8.1後關自己的新tab；沒有改使用者偏好、身份或前景。去敏截圖work/drawing-smooth-public-version.png與本機畫布work/drawing-smooth-final-viewer-proof.png為各自scope，不能把正式版號畫面當正式Chrome多人畫布驗收。

baseline與第一updated preview正常stop；最後乾淨preview因stdin不能寫，先保存own proxy log，再核對精確PID25628、Nodecommandline及3354／3355／3356 listeners，只停止該隔離preview。own Chrome tabs已關、temporary controlhost0、active false與所有queue0；沒有viewport override、未改使用者前景。私有ignored證據為work/drawing-smooth-clean-proxy-log.json及work/drawing-smooth-{prepare-result,activation-result,postcheck-result,public-smoke,final-data-check-result}.json；原HAR／cookies／帳密與.local偏好不提交。

兼容觀點：保留同API／wire、單in-flight、canonical語意／作品與idle／取消契約，不升額度或DBschema時，本批屬patch效能修正v1.8.1。P2新並行排序／P3新畫法若日後做需另開spec／驗收；native像素或fill區域語意不相容時先解差，不直接以本版號包裝完成。本批已依授權正式發布，P2／P3沒有實作；既有classic與fresh差及未完成rAF控制留作限制，不能用相容效能patch宣稱新codec或所有原生渲染零差。
