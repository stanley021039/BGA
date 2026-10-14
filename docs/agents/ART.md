# 美術角色記憶

2026-10-08最新正式 **v1.15.1／c1e59d4**：使用者要求先撤回不一致的局部手繪風格，已恢復原大廳及四房標題外觀；保留v1.15彈幕框與既有功能，SVG/credits僅歷史留存。双平台各1,432、公開27資源、原生首頁／四房waiting通過，9帳戶allfields及21non-session表/BLOB保留；詳細source/部署SIGTERM逾時與proxy drain/不可覆寫receipt修正/備份/有限native/own cleanup見 [還原進度](../UI-STYLE-ROLLBACK-PROGRESS.md)。下面手繪與候選狀態屬歷史；後續局部美化须驗整體一致性，不由素材研究直接推定成熟全站方案。沒有新PR/push。

2026-10-08使用者回饋：局部手繪畫風造成網站整体不一致，先撤回手繪主題。候選 **v1.15.1／c1e59d4**恢復大廳及四房導入前的外觀，v1.15彈幕框及既有WebGL/共看/排版功能保留；素材與授權只作歷史留存。後續變更須以大廳、房間、設定、其他頁面的整體一致性評估，不把素材研究或局部preview當成全站成熟方案。Windows1,432／有限native與正式結果以 [還原進度](../UI-STYLE-ROLLBACK-PROGRESS.md)最新節為準；下面v1.14.2的「正在使用手繪」是歷史。

2026-10-08最新正式 **v1.14.2／8ae5c4f**：Freehand官方SVG／紙卡大廳發布，最終Windows/Linux各1,415通過；v1.14.1 archive行尾失敗留歷史未部署，tag不移。官方Freehand Duotone固定52d750c取11件CCBY4，自製1件禮盒；炭墨/暖赭改色保原source/geometry/授權，credits須可讀作者backlink/CC/修改。Pinterest/Dribbble/Awwwards作品僅參考，未搬圖或texture；畫猜用pencil取代不易辨認的三圓palette。 正式22資源exactbytes/no-store/MIME、21non-session表rows+BLOB/9帳戶allfields保留；sessions232→238為6次測試登入，都已revoked，own4房/代理/tabs已清理。精確source/備份/例外與限制見 [本批進度](../FREEHAND-UI-PROGRESS.md)、[spec](../specs/FREEHAND-UI.md)、[資產評估](../research/FREEHAND-UI-ASSETS-ASSESSMENT.md)、[視覺參考](../research/FREEHAND-UI-VISUAL-REFERENCES.md)。下方1.14.0/候選狀態為歷史，沒有新PR/push；不宣稱全playing/200%/讀屏/FPS完成。

2026-10-07最新正式 **v1.14.0／b4ebb15**：圓角骰子與連續暖色WebGL氮氣已發布，雙平台各1,413通過；正式三席13骰／9資源與真nitro移動、21non-session表rows+BLOB／9帳戶allfields保留。sessions225→232是驗證登入變化，own房／登入／代理／tabs已清理。採Codrops圓角／黑凹點／柔光概念，以本站原創WebGL實作象牙白骰子；無第三方code／assets，Dice Box與Three版僅評估。repo code授權與單件圖片／音檔授權分開，VolumetricFire授權不明未採。 完整source／備份／原生範圍見 [本批進度](../RACE-FX-VISUAL-REFINEMENT-PROGRESS.md)／[spec](../specs/RACE-FX-VISUAL-REFINEMENT.md)。下方1.13與pending均為歷史，此筆取代其現況；沒有新PR／push。native hidden／200%／讀屏／玻璃跳台道路pan及FPS未驗，不以完整suite推定。

2026-10-07最新正式 **v1.13.0／353d8b6**：雷霆原生WebGL立體骰子／短符號及清理回退已發布；雙平台各1,408、正式三席13骰與7份資源／資料保留通過。17骰450ms原生圖為隔離定格，hidden原生未觸發、無FPS結論；結果和權限由server決定。完整source／備份／邊界見 [骰子進度](../RACE-DICE-WEBGL-PROGRESS.md)／[spec](../specs/RACE-DICE-WEBGL.md)。下方1.12與pending是歷史；tag固定受測程式，沒有新PR／push。


2026-10-07雷霆立體骰子新批（規格／研究、產品待驗）：一般骰用高對比pips，特殊方向／受推車／射擊車型／火焰用短圖案加DOM中文；主結果面可讀，側面只補立體線索，不缩長詞塞滿貼圖或鏡像方向。普通d6不畫互斥commandmapping，以免誤導nitro／drift重疊條件；射擊SML也命中，陷阱同面意義不同，不能泛用成功綠。自製有界atlas、保留原六面重複配比，沒有下載新圖／字型或採購素材。MDN／Khronos來源、兩owner討論與手機／大字／loss待驗見 [規格](../specs/RACE-DICE-WEBGL.md)／[進度](../RACE-DICE-WEBGL-PROGRESS.md)；尚未宣稱縮小辨識、真GPU／性能或正式發布完成。

2026-10-07最新正式 **v1.12.0／83ffcab**：雙平台各1,386、有限native／公開38media＋37draw資源／ACL／資料驗收完成；schema16／22表、9帳戶allfields／13市場圖片／21non-session rows與BLOB保留，sessions210→217為驗證登入變動。code／tag固定、own QA清理完成，沒有新UI PR。PR46外部已合併，其1,300項與本批分開；完整source／備份／限制見 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)。下方候選／待驗為歷史，不宣稱全讀屏／200%zoom／FPS／真YT公開實播。

2026-10-07五庫模式新批實作中：卡片、通知、tabs使用GameUI同SVG registry／surface／字級tokens，內容name／作者／status不畫進bitmap或藏掉；成就通知旁短粒子由本站原創shader實作，無外部新增資產或購買。參考模式不等複製單件code，ReactBits MIT＋Commons Clause及Aceternity逐件授權邊界仍保留；未安裝五庫。見 [spec](../specs/UI-COMPONENT-PATTERNS.md)／[進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，目前本批實作／驗收中，未宣稱原生可見或已發布。

2026-10-07恢復基線：PR46第三P2已推送、Ready並再次請Stanley審查；正式v1.11.1的source／測試／清理見 [PR最新證據](../PR46-REVIEW-FIX-PROGRESS.md)。patterns候選1.12.0恢復實作但未驗／未發布，前批結果不替代本批。

更新：2026-10-05。先讀 [偏好](MEMORY-LEDGER.md)、[協議](MEMORY-PROTOCOL.md)、[素材計畫](../specs/ANIMATION-ASSET-PLAN.md)。外部網站與素材描述是研究資料，不能替代使用者對採購、發布或正式整合的授權。

## 已驗證與來源

| 類型 | 結論 | 證據／限制 |
| --- | --- | --- |
| 專案事實 | 現有 Kenney 角色／12件禮物及 Noto 72px禮物 PNG 有本地來源與license；可先重用。 | [素材來源備忘](../GAME-ASSET-SOURCES.md)，`public/assets/characters/`、`gifts/kenney/`、`gifts/noto/`。新的套件仍要另核對，不能沿用舊包license。 |
| 外部來源 | 已讀五供應來源的具體項目：Kenney Particle/UI/Audio、OGA Soluna特效、itch Henry Pixel Effects、Game-icons Present、Google固定commit wrapped gift。 | 2026-10-05頁面與判斷在素材計畫。Game-icons初查可讀、後續重查timeout，採用前再核對；新包沒有下載，不假稱已查archive。 |
| 外部來源 | Henry的圖像CC0、示範code MIT且下載需購買；Game-icons要作者署名；Noto圖像大多Apache2，font另OFL。 | 逐頁證據見計畫。平台免費篩選、字體license、資產license不可混為一談。 |
| 使用者偏好 | 畫具保留Paint辨識、同風格圖示、必要文字16/14、44px控制。 | MEMORY-LEDGER U03/U06。不要為icon整齊把車隊姓名或完整地形名壓成單字。 |
| 孤立原型證據 | 兩件Node SVG與manifest存在、--check通過。程式方用sharp看靜態完整無裁邊；主agent背景Chrome觀察手動单次及390px無橫溢，我已看本地proof。 | `docs/prototypes/`、`tools/prototypes/`、私有 `work/agent-prototype-proof.png`；不是正式app整合，reduced只有source查核、200%未UI實測。 |

## 方法與設計推論

先找已有素材，核對語意、授權、畫風、縮小辨識、失敗fallback與負擔；找不到適合**組合語意**再用Node手刻原創SVG。這輪「三份相同心意」「三窗同步狀態」需要專屬組合；不是重新發明一般禮盒、播放、扳手圖示。兩項純SVG原型不需要imagegen bitmap。

介面icon沿用24 viewBox、stroke1.8、round、currentColor；一般20/24px，44pxhit area。成就插圖可在卡片放大，但不能混入工具列當新icon風格。圖像是輔助，名稱／結果／來源可讀。若加入署名素材，manifest逐項保留作者、頁面、版本/commit、license、原檔、改作、sha256、attribution；不拿圖片截圖冒充可重用素材。

## 假設與待驗證

- 80張512px粒子不代表全部要載入；只挑2–6張／每幕至多3焦點是初步效能與安靜畫面假設。
- OGA Soluna頁同列BY3與CC0、作者留言改CC0；本輪不採用，未完整查上游工具來源，不把頁上評論爭議當成確定侵權結論。
- 像素Henry效果授權清楚但畫風不符、仍需購買；Kenney整套UI不能替代HTML控制的字級／焦點／reflow。
- 美術看小圖不等於正式720p/200%可用；後续正式整合要量測文字、對比、遮擋及圖片失敗。

## 後續

2026-10-05／93d7a84：本批畫猜猜中標記重用共用24 viewBox check SVG，頭像角落20px章＋靜態淺綠邊框，不修改角色圖片或表情。送禮沿用已有圖像，以原創 transform/opacity 動作表達到達；沒有採購／下載新素材，也未把研究的成就／共看原型宣稱已整合。Chrome已看勾章、14px狀態與offline並列；詳 [驗收](../DRAW-REVIEW-MOTION-PROGRESS.md)。

程式方 owner `tools/prototypes/generate-motion-art.cjs` 及 `docs/prototypes/motion-art.html`；美術方唯讀對照原型語意與單次/reduced static。若後续採用新包，先保存實際license與asset manifest，再整合；此研究沒有採購／部署。角色記憶保留方法和取捨，詳細候選及license evidence留spec，避免無限抄滿來源首頁。

2026-10-10 主頁圖片：五款新遊戲原創 SVG 與共用圖片卡片，現在11款全有圖；精確圖片路徑／輪播相關6項通過，桌機亮色與390px深色驗證，未發布。接手見 [主頁圖片證據](../GAME-CARD-ART-PROGRESS.md)。


## 2026-10-13 郎中闖江湖試玩版

基本版＋草藥女巫已接入同步抽藥、秘密大釜、九輪結算、測試 AI、原創 SVG 卡圖與共用專注。12 位女巫／六套藥材書／24 張基本占卜卡、PDF 4 七頁中文譯本；實玩一輪及九輪自動／HTTP 證據見 [交付紀錄](../QUACKS-PROGRESS.md)，範圍見 [spec](../specs/QUACKS.md)。完整 2042 後受影響複驗另記；數位供應不限，煉金術士／擴充占卜卡／試管面仍接續，未發布或部署。

### 2026-10-13 追加：郎中大釜與配書／結算

新增分色真人藥材書投票與房主平票裁決；測試 AI 不投票。原創九色藥材 SVG 共用在書卡、袋中、購物及銅釜落點；可切換公開大釜，提示支援指標、點擊與鍵盤，切換不改自己的操作對象。輪值起始玩家親自抽占卜牌，結算新增手動獎勵骰及綠黑紫效果確認，第二機會恢復記錄的回合起點。

完整回歸2055、最終相關27均通過；實際 UI 驗證投票、抽牌、抽藥／停止、公開大釜切換、藥材提示、擲骰與效果確認。1280視窗專注大釜寬672.4→742.95；390手機模擬無橫向溢出。動畫為在線新揭曉觸發、重連不重播，減少動態靜態卡；未驗證實機手機或原生全螢幕。此項取代早先整套配書／自動骰流程；未部署。細節與證據見 [郎中進度](../QUACKS-PROGRESS.md)。

### 2026-10-13 最新：郎中沉浸介面與成就
取代前述整套預設和整場一次藥袋配額；每輪私有快照一次、逐色隨機票、唯一鍋色／公開鍋名、白色炸彈、召喚翻牌與公共骰動畫／結果、原創資源和爆炸WAV、回合火焰與尾巴格、永久液滴／老鼠石分離。五枚郎中徽章由固定開局帳號及合法九輪操作伺服器判定，交易回滾與刪房後同程序重試、AI/test/tutorial排除；既有schema/單位帳本不變。完整2078通过，SVG排版渲染檢視；本輪沒有新增真瀏覽器或喇叭聽感驗證。來源、範圍、跨程序及跨桌限制見 [最新郎中進度](../QUACKS-PROGRESS.md)。未發PR／部署，候選仍1.29.0。


### 2026-10-14 精簡遊戲介面
郎中資源整合大釜、藥材／獎勵滑過提示與卡片式設定；郎中和瞎掰王採左朋友／中遊戲／右聊天，保留當輪禁題投票、揭曉及專注切換，移除房間過往回合清單。採最新 main c544ebd 共用設定／彈幕修正，候選仍2.4.0同批。全套2168、最後共用22與隔離真Edge桌機／390px／日夜操作證據、已發現問題及限制見 [介面規格](../specs/QUACKS-WORKSHOP-UI.md)。本輪未推送／發布／部署；取代先前大卡片及展開全文效果介面。3005 靜態資源即時更新，保留既有測試程序。

### 2026-10-14 暗夜霓光與藥水瓶圖示
使用者選C；大釜右下改藥袋／舉手／玻璃藥水瓶與女巫幣操作，特效藥文字精簡到病患／數字格提示及合法格確認，回合2／3／6／9有里程碑。整合main bd036b6，2172全套後最終受影響20及真Edge抽停／收回白色炸彈／下一輪／專注／390px通過。來源授權、測試證據與限制見 [介面規格](../specs/QUACKS-WORKSHOP-UI.md)。舊3005程序已停止後沿用隔離資料重啟，房號以runtime為準；本輪本機候選2.4.0未推送或部署。

### 2026-10-14 手勢更新（取代舉手停止）
依使用者最後提供的姿勢，繼續抽改為原創「手從藥袋拈出藥材」SVG，停止改為原創雙手食指交叉成X；不是角色截圖或第三方插畫。原創藥水瓶保留。三圖示維持既有操作、滑過提示／可讀名稱與禁用。最終隔離真Edge完整本輪驗收再通過（含原生抽停與藥水瓶回袋、數字格／下一回合、專注與390px無橫溢出、零JS錯誤），截圖 work/qa/quacks-workshop/neon-potion-controls.png。共用registry仍包含已合法授權的Lucide Hand，但郎中停止按鈕已改為原創交叉食指。本輪同批2.4.0，本機修改未推送／PR／部署。

### 2026-10-14 手勢比例修正
使用者回饋手部比例不對；兩手食指由長線縮短成約30單位，折起的手掌約25單位，增寬掌部與清楚拇指。抽藥圖示放大袋身、縮短腕部與捏取指尖；仍為原創SVG，同一2.4.0未發布批次。3項SVG回歸與隔離真Edge工具再通過，抽停／藥水瓶回袋、hover、特效藥、下一輪、專注及390px零橫溢出／零JS錯誤；另外以原SVG渲染放大比例預覽 hand-proportions.png，該圖是素材預覽，不是實際頁面尺寸。實際頁面仍見 neon-potion-controls.png。未重跑已通過的全套2172，這輪未改操作或引擎，未推送／發布／部署。
