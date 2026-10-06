# 動效與素材採用方案

**後續實作狀態（2026-10-05，93d7a84）**：D01／A00、D02收藏確認、A01四軌及開關、A02確認政策、G01收禮去重與G02結算入場、R02減動共用已落地；既有同頻／撲克動效接同一規則。畫猜等待／離線及猜中卡勾選同步完成。Windows／Linux各402項、背景Chrome結果與限制見 [實作進度](../DRAW-REVIEW-MOTION-PROGRESS.md)。本段取代下方歷史研究對這些子項的「尚未實作」描述；成就徽章／勝場ledger、YouTube、粒子素材與孤立原型仍維持研究狀態，未部署。

查核：2026-10-05。狀態：**研究與孤立原型；沒有改正式遊戲程式、採購新包、commit、push或部署**。設計／美術／動畫owner `typography_design`，Node原型owner `layout_design`，成就spec owner `player_research`，整合／實玩owner主agent。程式基線本地HEAD `0aa6c75`；後續採用要重查當時source與部署版本。

已讀 [素材備忘](../GAME-ASSET-SOURCES.md)、[2026-10-02沉浸研究](../IMMERSIVE-EXPERIENCE-RESEARCH.md)、[資訊優先級](../UI-INFORMATION-PRIORITY.md)、`src/achievements/store.js`與下列現行renderer/effects。既有研究的送禮「立即完整結果＋自動2–3焦點」被使用者的**逐位收禮者確認、全部收完才結算**取代；本文件不沿用舊提案改規則。

## 先留住資訊，再加動效

動效只解釋server已確認的event，靜態文字和結果先可读。必要名單／角色／分數／骰子／剩車不折疊；820px賽道不把文字縮到小於14px；一般正文16、次要14、控制44。emoji是玩家送的彈幕，角色表情API／現有入口行為保留。

本輪主agent實玩：畫猜8秒揭曉期間開說明，背後照樣換輪，關閉後前輪答案／畫作／收藏入口消失。我未開Chrome重現；來源為2026-10-05主agent回報及[實玩T2／PL-01](../research/PLAYER-PLAYTEST-ASSESSMENT.md)，1767×1196背景Chrome角色測試，非真人調查。**A00/P0：server公開回合結果／畫作快照＋常駐「上一輪」回看／收藏入口**優先，不能用更長動畫掩蓋。至少保持最近公開輪；歷史保存範圍、上傳權限、圖片大小、保留期由玩家／程式資料spec決定。畫者選題、未揭曉答案及其他私人資料不能寫進公開快照。教學／題庫dialog仍可開；關閉後不搶焦點、能回看錯過的結果，不強制暫停別人。

## 具體素材查核與取捨

本輪共五個不同供應来源，不把多個Kenney頁算成多個供應商。網頁層已讀；**新套件未下載**，所以archive附license、hash、尺寸／frame metadata列採用前todo，不假稱已驗證。現有Kenney/Noto包的本地證據見素材備忘。Game-icons單頁初查可讀，後續重查timeout；採用前需再次確認可訪問與作者。

| ID／具體項目 | 作者／已讀授權證據 | 適用性與本輪決定 | 後續實作／失敗fallback |
| --- | --- | --- | --- |
| S01 [Kenney Particle Pack](https://kenney.nl/assets/particle-pack) | Kenney；官方標CC0、80張512×512圖像。 | 可作小星点／紙屑質感，並非現成事件動畫。**P2小樣候選**，只選少數，不整包載入；不能取代現有車輛特效。 | 待取zip license，裁選2–6張、記hash，transform/opacity180–600ms、每幕最多3焦點。載入失敗直接略過，結果仍文字可讀。 |
| S02 [Kenney UI Pack](https://kenney.nl/assets/ui-pack) | Kenney；官方CC0、430項、2.0重製。 | **本輪不換整套皮膚**：現有HTML控制要16/44、焦點、200%reflow，貼PNG按鈕無法替代。可參考卡框構成。 | 保留現有token/CSS，無新runtime依賴；若日後單件背景採用，另查license／尺寸。 |
| S03 [Kenney UI Audio](https://kenney.nl/assets/ui-audio) | Kenney；官方CC0、50音檔。 | **備选**確認／切換聲。專案已有Interface Sounds，不混稱同套UI Audio，也不重複下載。 | 優先重用 `public/assets/gift-sounds/` 的本地 `KENNEY-INTERFACE-LICENSE.txt`；新檔先查clip與manifest。音效預設關閉，server成功才播，失敗／重連不播。 |
| S04 [Explosion effects and more](https://opengameart.org/content/explosion-effects-and-more) | Soluna Software；頁面同列CC BY3.0／CC0，作者2015留言說改CC0，列Explosion03/21、Effect95/47、Aura38 PNG。 | **本輪不採用**：大爆炸／aura遮車且畫風較重；單頁授權欄與歷史需完整保留，上游工具討論未做獨立查核。不能稱OGA全部CC0。 | 如果以后小樣，保存指定檔與原作者、頁面及授權證據；保守保留署名，檢查frame格，static短圓環/文字優先。 |
| S05 [Henry Software Pixel Effects!](https://henrysoftware.itch.io/pixel-effects) | Henry Software；頁面35動畫、PNG與Unity示範；**圖像CC0 1.0、code MIT**。下載需購買，沒有購買。 | **本輪不採用**：16px像素風和現有SVG／卡片不一致；不是免費下載包。授權明確仍不代表需要買。 | 未取得archive所以不列完整frame規格；若以后像素主題專案才評估，不為本輪安裝Unity。 |
| S06 [Present](https://game-icons.net/1x1/delapouite/present.html)／[Gift of Knowledge](https://game-icons.net/1x1/lorc/gift-of-knowledge.html) | 分別Delapouite／Lorc；具體頁初查CC BY3.0、SVG/PNG；[官方授權說明](https://game-icons.net/about.html)要求原作者署名。重查單頁timeout，採用前再讀。 | **備選成就插圖**，不替換Paint／通用線框操作icon；單禮盒不能獨自表示「收到兩份相同心意」。 | 若採用，credits列作者＋來源＋license＋修改。原型P1直接原創三禮盒SVG，沒有描摹或下載這些圖。 |
| S07 [Noto wrapped gift 72px PNG](https://github.com/googlefonts/noto-emoji/blob/e20cbc2bbec1926686be9f9bee7d1d2cfa1fea0e/2D/png/72/emoji_u1f381.png) | Google Noto；固定commit `e20cbc2…`，該圖頁可讀；[同commit README](https://github.com/googlefonts/noto-emoji/blob/e20cbc2bbec1926686be9f9bee7d1d2cfa1fea0e/README.md)說多數圖像Apache2，fonts另OFL1.1、flags另類。 | **重用現有本地圖像**作一般gift fallback。新package不取latest，不把font license套到PNG，也不把emoji彈幕全換圖。 | 本地已有SOURCE/license。圖像未載仍顯示禮物完整名稱；不要以🎁通用圖取代不同禮物辨識。 |

採用manifest應逐項存 `assetId/sourceUrl/author/version/license/originalFile/changes/sha256/attribution/checkedAt`；若spritesheet，再列frame尺寸、數量、fps、裁切規則。CC0仍保留出處方便換檔，不是額外署名義務。新美術不受第三方素材網站評論或本研究文件自動授權。

## 現有有效動效：保留的程式證據

| ID | source／實際行為 | 保留理由與邊界 |
| --- | --- | --- |
| K01 | `public/majority.js:79–94 gatherPlayers`以角色席位avatar中心向已公開`.group-player`做420ms位移，delay最多280ms；receive只同輪answering→review/reveal、非disconnected且非hidden。 | **保留**：直接說明誰屬哪個答案，票數／名字常駐；不是重做一套聚合粒子。WAAPI缺失仍直接顯示組；stopGather取消舊播放。 |
| K02 | `public/shared/race-vehicle-effects.js:26/36–81`event.id去重（seen上限256），SVG重建以負delay保留elapsed，clean還原wrapper，hidden/preferences清除；nitro/skid/shot貼實車，font依SVG實際scale至少14px。 | **保留**：效果對象和路徑清楚，已解決重建回到動畫起點問題。新的炸光包不能再覆蓋car／dice。有限時間label與整個move段nitro不同生命周期，不強行同時截掉。 |
| K03 | `public/draw.js:109–147`階段300–470ms，猜中新badge1700ms；live gate判首次／重連／hidden／超過5秒間隔。 | **保留**：階段提示／猜中確認短而有資訊；不在每次stroke或poll重播。加結果快照，不延長過場。 |
| K04 | `public/app.js:11–29 animateChipTransfers`仅同hand pot及本人bet增加、可見在線時600ms籌碼飛向底池，finish/cancel remove。 | **保留（額外撲克）**：解釋下注流向；重連／showdown不重播，公共牌根據新增牌數局部翻牌，不預先公開底牌。 |
| K05 | `public/gift.css:.delivery-gift`700ms到達，`gift-motion-off`與reduced stylesheet停動；`gift.js:77/185–186/213`收禮者自按确认。 | **保留收禮節奏**；加live event去重／首次重連static尚屬未實作改善，不能用card動畫结束自動accept。 |

行號為查核時位置，後續source變動以函數名為準。這些是source證據，並非本輪新UI實測。

## 整體與各遊戲：事件、缺口、fall back

以下duration為設計初值，非官方標準。A00等P0先於裝飾。P1是下一輪可規劃，**本輪沒有實作**。

| ID／範圍 | 現況與缺口／價值 | Trigger、時間、位置 | 靜態／失敗／重連與驗收 |
| --- | --- | --- | --- |
| A01 整體/P1 | 共用文字/emoji彈幕8秒，reduced為5秒原地fade；emoji選單發送有pending/error/返焦。缺独立停止／隱藏彈幕、密度與背景hydration政策。 | 仅新的server barrageId；至多4 lane，緊貼舞台非右dock；提案關閉入口常駐、不改角色expression。 | static訊息5秒可讀，不能.01ms瞬間消失。首次或hidden回來不補播舊8秒內訊息；失敗保留草稿、不播成功；密集訊息可摘要不遮主按鈕。 |
| A02 整體/P1 | 共用busy spinner/成功/錯誤已有文字；成就通知原為私人。新動畫統一pending→server acknowledged。 | localclick即busy，duration跟請求而非假秒數；success160–250ms；notice700ms只结算一次。 | 失敗文字可重試、draft保留；caption accessible。readonly hydration只更新collection、不補播通知。玩家離線／正在重連的異常狀態在相關位置顯示，不恢復全頁「已連線」常駐標籤。 |
| G01 送禮/P1 | 每位收禮stage可見所有gift/card、recipient確認；CSS重建可能重播到達。 | live `round + recipientId + delivery.index`第一次公開才700ms，卡由各giver至當前recipient的方向語意；不逐件7秒。 | 首次／重連／hidden只顯示所有卡及等待誰；圖片失敗保留title。未取得accept權限不能顯示可點confirm，anim完成不换recipient。 |
| G02 送禮/P2 | 全員收完總分與完整明細已有；成就圖標可借自然同gift巧合。 | server normal result後只本人一次700ms badge；圖表250ms入場，分數立即正確不從0長時間數起。 | 此前不得露全桌score。完整收到什麼一直可查；通知可不展示，不遮recipient tab或分數。再播只本地，不重發award。 |
| D01 畫猜/P0 | A00公開快照／回看，防8秒期間開dialog錯過答案畫作收藏。 | reveal server event立即snapshot；換輪保留最近public round入口，無新增阻塞duration。 | reopen說明後可看完整上一輪與收藏；斷線到新輪也能取snapshot。私有candidate/未揭曉詞不入公開history；圖片讀取失敗仍答案／作者／比分。 |
| D02 畫猜/P1 | K03保留；填色、undo只需即時回應，不該演brush trail或輸入等待。 | canvas操作直接draw local + server ACK；guess正確1700ms局部player row；收藏成功160ms icon勾。 | 不擋下一筆／復原；收藏pending失敗保留畫作和可重試，確認後才勾。猜中提示不搶焦點、不重播過期score。 |
| R01 雷霆/P1 | 新dice protocol約1秒全員可看條件／對抗／四骰；車旁FX與3.2秒event卡已有，保留。 | server dice checkId/status awaiting→rolling→result→accept；first/road/骰實值依servermask。FX按實車/公開target event。 | 不讓動畫先決定骰面；ready前不顯result，accept才套用。減少動態仍静態條件＋正確骰面；auto/disconnect只最新狀態不補播。四隊17骰需全部可辨，不把點數變裝飾星。 |
| R02 雷霆/P1 | 各模組reduced政策不統一：race mount alwaysAnimate讓共用allowsMotion一直true，但vehicle/dice另尊重系統。 | 下一輪拆「必要結果呈現」與「可減少位移」，3.2秒文字保留、装飾180–1200ms。 | OS reduced不抹必要event卡；仍完整文字、骰面、legal move、全部車隊。射擊沒命中不可用命中爆炸，移動／損傷只server事件。 |
| M01 同頻/P1 | K01聚合有意義；自己的answer／group／分數常駐。避免加入先數票長倒數。 | sameRound answering→publicreview/reveal420ms gather，最多280ms stagger；reveal score250ms localfocus可手動skip。 | 閉頁／重連直接已分組結果，答案review merge仍依server；不提前露他人答。取消anim後group/name不消失。 |
| M02 同頻/P2 | 平手／全員同組的私人徽章可增加記憶點，不能稱少數「唯一清醒」。 | normalresult after merge&score，只有可靠groupId/maxgroup predicate才700ms。 | 全員得分表與自己的answer不遮；不公開誰没成就，不為badge改選項或提醒故意離群。 |
| P01 撲克/額外P1 | K04保留；勝利／平手資料要per-pot immutable identity，現results不夠。 | server accepted下注600mstransfer；showdown公开結果局部350ms；勝者牌型文字直接顯示。 | Fold底牌不進public history/tooltip；不能多results當同pot tie；motion失敗仍pot/stack正確可動。牌Georgia保留，ROOM/HAND系統font/tabular穩定。 |

## 實作契約：動畫不是資料庫

建議事件欄位（尚未實作）：`gameRunId/eventId/version/type/occurredAt/publicPayload`，renderer維護 `seenEventIds` 與 `lastLiveVersion`；快照欄位只保存已公開result／必要asset reference。首次載入建立baseline，不把所有snapshot視新事件。資料回放与動畫回放分離，client localreplay不碰server action。

對短effect將cleanup綁階段切換、DOMrenderer重建、房碼變更、visibility、reduced及unmount。WAAPI持有Animation物件並cancel；使用`finished` promise必須處理取消的AbortError，不能把取消當請求失敗。MDN說明 [Animation.cancel](https://developer.mozilla.org/en-US/docs/Web/API/Animation/cancel) 與 [Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) 支持這些技術邊界；不以blur取代hidden，也不以browser background timer推算規則時間。

系統減少動態使用 [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)。[WCAG2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)對自動開始、超過5秒、與其他內容並行且非必要的移動要求暫停／停止／隱藏機制；自動更新另有要求，不能一概套5秒例外。本輪原型只手動單次700ms，正式8秒彈幕需單獨驗控制；這不是對全站合規的宣稱。

## 找不到合適組合時：Node原創孤立原型

兩項由設計方提出、程式方2026-10-05回覆接受。一般present/play圖標已有可用素材，但沒有合適且同風格的「相同心意群」／「三窗同步狀態」組合，故手刻原創SVG；不需imagegen bitmap。無正式app引用、無YouTube網路請求，也不假稱同步已實作。

| ID | 圖案／幾何 | 單次展示與限制 | 檔案／owner |
| --- | --- | --- | --- |
| P1 心意撞車／gift-cluster | 24 viewBox、stroke1.8、currentColor、round；中盒8×9，左右小盒6×7，共三個同結，表示重複心意而非車禍。候選條件已改兩份，視覺三盒是概念而非「需三份」門檻；可依玩家定名改標題。 | 按下重播700ms，左右盒±2→0小幅聚合，opacity.65→1；不閃／震／撞擊。reduced直接static與文字「相同心意」，不自動循環。 | `tools/prototypes/generate-motion-art.cjs`、`docs/prototypes/motion-art.html`、獨立SVG及manifest，layout_design owner。 |
| P2 共看同步／watch-sync | 同24/1.8/currentColor，三個小窗、play／連點，表示一致狀態；播放控制真正用原player，icon是外部狀態區。 | 手動700ms同步pulse，reduced直接static；不能放在YouTube iframe上、遮其控制或假裝接上真實事件。播放器尺寸／政策由[共看spec](SHARED-YOUTUBE-PLAYER.md)核對。 | 同generator／standaloneHTML，不加正式shared脚本。 |

Node generator只用內建fs/path/crypto，固定輸出與sha256，重跑可重現；manifest列純原創、生成器路徑、無第三方素材。原型頁16/14文字與44px重播、窄／200%可重排。展示的成功勾是模擬文案，未有server ack不得在正式UI引用為狀態。

原型驗證區分：程式方生成／語法／`--check`通過，並用sharp看SVG靜態完整；我唯讀source且重新執行Node `--check`及generator `--check`通過。主agent2026-10-05背景Chrome兩個replay各一次，觀察播放中→完成／無自動循環，配置700ms與44px；390×844內容寬375無水平溢出，最後還原1767×1196。私有proof `work/agent-prototype-proof.png`我已本地閱圖；reduced只source查核，未浏览器模擬，200%也未原型UI實測。這些不等同正式遊戲驗收。

## 成就展示依賴與驗收

候選／攻防見 [設計攻防](../research/AGENT-DESIGN-DEBATE.md)，最終採否／勝利紀錄以 [玩家成就spec](ACHIEVEMENTS-AND-RECORDS.md)為準。[Steamworks成就教學](https://partner.steamgames.com/doc/features/achievements/ach_guide)可參考持久統計／成就欄位，但其客户端API不是本專案權限方案。

先補畫猜權威hook、公開結果快照、每局persistent identity与去重；成就通知只能normalsettlement授予本人一次，後續第一次登入顯示收藏靜態，不補播積壓。沒有可信predicate就保留研究，不能把client `.animate` 或click次數轉成award。

| 驗收 | 通過條件 | 目前狀態 |
| --- | --- | --- |
| 來源／授權 | >=4供應商具体頁、作者、license、適用／拒絕理由，未下載包明示。 | 五供應商完成頁面研究；新包未採用。 |
| 既有動效 | >=2程式證據及保留原因，scope不重做現有效果。 | K01–K05完成source audit。 |
| 資訊可用 | 名單/角色/骰/剩車/自己答案常駐；readonly最新結果回看，不靠動畫才能知道。 | 保留條件；A00需下一輪實作。 |
| failure／恢復 | 失敗不播成功、hydration不補播、hidden/reduced/static、cleanup可驗。 | spec定義；本輪沒有改正式source或宣稱新的實測。 |
| 原型 | 原創generator可重現、兩SVG＋manual700ms/reduced静態、無app整合。 | generator/check完成；root原型背景Chrome單次、44px／390px無橫溢通過；reduced僅source、200%未UI實測；無正式遊戲驗收。 |
| 玩家攻防 | >=12候選、每款>=2，反例及v2真實記錄；不等於全部採用。 | 19項候選／否決初稿，實際v1–v3記錄；以玩家spec最後版本同步。 |
