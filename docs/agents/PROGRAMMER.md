2026-10-25 #262／#263 候選 2.46.0：傳情畫意專用公開觀戰投影及唯讀入口，作畫／文字分開選 60／90／120 秒，舊持久化房間預設 90 秒。Edge 觀戰五階段 1920／390、刷新與離開、倒數及受控分頁生命週期已驗；55 項引擎／HTTP／持久化／串流及前端 125 項通過。修正既有串流測試的固定 sleep 競態後，最終完整 affected 228 檔 1882 通過、0 失敗、1 項因缺 ffmpeg 略過。#270 的頁首透明規則已在 main，深淺大廳觀察生效，未重複修改。房主手機仍重現共用側欄框條覆蓋邊緣，本批未改其設計。證據與限制見 [本批紀錄](../ISSUES-262-263-270-PROGRESS.md)。未提交／PR／部署。
2026-10-25 #266：候選3.1.0（原2.47.0）以Document PiP把同一組媒體節點搬進獨立小視窗，不支援時隱藏按鈕。PiP文件是about:blank、iframe不帶Referer會讓YouTube錯誤153，改先載入無腳本的同源`/media-pip-frame`（僅此路徑frame-ancestors 'self'）再搬入；內外兩層pagehide都還原，避免frame先拆掉後節點失去事件監聽。Playwright對PiP視窗的請求攔截會卡住（含CSS），驗收不可用ctx.route。真Edge 8組通過，特效僅沿用框飾；停在第4階段待驗收，未開PR、未部署。證據見[本輪紀錄](../specs/MEDIA-PIP-266.md)。
2026-10-25 #256／#261：候選2.46.0在同房空清單開始播放時自動開啟既有compact播放器，初載／重連不重播、手動關閉後加歌／切歌不重開；hidden、modal、手機抽屜與背景／全螢幕延後，過期事件失效。只在current／queue皆空的新點播可重啟stop後播放，有待播內容的stop仍保持停止。試玩追加已同意影片直接加入：開窗／返回可見時補joinVideo，不只依賴current改變；保留拒絕與自動播放受阻退路。真Edge雙玩家桌機1920／手機390深淺色、影音拒絕無iframe與焦點驗證通過；追加12組provider fixture驗直接播放接線，非真YouTube聽感。使用者已驗收並授權合併，進入兩輪審查與最終Linux CI，最終結果以本批PR為準，未部署。測試失敗／重跑與完整結果依[本輪證據](../specs/MEDIA-AUTO-OPEN-256-261.md)。取代共用媒體舊規格對「即使全空後新點播也不再開窗／播放」的描述，其餘權限及個人同意不變；#266尚未實作。

2026-10-24 #233 第二批接續：沿用舊前端移除與 main 整合成果，補刪退役 room-host／room-reconnect／game-shell 的五個短網址別名；登入頁的 affected mapping 改對應現役 Vue 入口，新增／更新對應回歸斷言。Vue 與 public 共用模組的保留責任見 [遷移邊界](../refactors/VUE-FRONTEND.md#233移除舊頁面後的保留邊界)。本輪以隔離站實際操作與 HTTP 資源核對驗收，未重跑測試套件、未推送或正式發布；既有測試結果不可當作本輪新內容全套通過。#234 路由拆分仍依票內條件等待 #226／#227 的 app.js 接線合入。

## 2026-10-24 #241：傳情畫意畫布空間與底部回饋

基於 main 52f04e9（含全遊戲場景與舊版前端清理），測試候選2.43.1。移除過時共用工具列中只屬於傳情畫意的64/24px空列與600px floor，畫板由telephone.scss單一負責；StatusSlot併入提交列左側，桌機固定操作槽、手機自然高度及滿寬等比畫板。1920／1280／390、深淺色、訊息失敗前後相同幾何、持筆8次像素採樣與ACK／放筆保留、實際提交及專注/Esc已驗，7項針對性回歸通過。未新增實機、Safari與完整作畫同步矩陣；使用者已驗收並要求PR／合併／正式發布，最終結果以關聯PR為準，詳[證據與限制](../specs/TELEPHONE-CANVAS-241.md)。此布局取代#183的獨立44px狀態列。使用者追加移除一般落筆／座標／設定起點提示；Canvas不再發出這兩類通知，必要錯誤與鍵盤繪畫功能保留。

## 2026-10-24 #239：聊天室與媒體視窗修正

已整合 main c8a19c6（含房間重啟持久化），候選 2.42.7。RoomChat 明確保留未傳入 panelVisible 的 undefined，恢復 inline 訊息/輸入；受控開關不變。媒體框飾移除彈幕 gutter，使邊線對齊視窗；按實際表面/漸層對比選文字色，並隔離 legacy 對原生欄位的覆蓋。

使用者最終確認為 height:auto、自然內容高度、固定 8px 區塊 gap、不顯示捲軸及空白狀態槽；取代本輪中間的固定高度及整組上下置中方案。短視窗保留輪/觸控可達，寬度仍可調整；bar 保留 56px。ResizeObserver 重新量測自然高度並在卸載時釋放。

前置 Chrome 1920×1080、390×844、390×480：點播 575px、播放 362px、compact 162px；淺色草莓/紙張黑字、深色像素白字，表單/說明/連結與欄位均已檢查。畫猜等待與選題/作畫階段真送訊息可見。整合後 Chrome 再確認等待室實際送訊息及點播 575px/height:auto/無捲軸。相關 19 項回歸涵蓋實際 RoomChat 掛載、幾何/viewport/observer 清理、深淺表面、半透明漸層合成與媒體生命週期。沒有改畫布 renderer、同步協定、遊戲規則或資料庫；真實 YouTube/喇叭、實機觸控與完整畫布時序未新增驗收。PR 的最終 head 審查、CI 與部署結果以 #239 關聯 PR 為準。

## 2026-10-23 個人化設定完整清單與目前預覽候選（取代本輪固定高度清單）

使用者最新要求：攻擊特效、彈幕、播放器、進場特效直接列出所有選項；上方顯示目前套用預覽；選項高度改為 auto 並盡量向下展開，取代本輪先前固定高度局部捲動。SettingsPage 只掛載目前分類，沿用 FrameChoices 各 48 款與 EntranceChoices 31 款；AttackChoices 在設定頁顯示目前 Q／E 的兩個獨立預覽與重播按鈕，既有 15 款試播與 Q／E 分別設定保留。分類切換時若內容頂端已離開畫面，捲回新分類頂端。沿用 preferences.canUse 獎勵更新修正，相關回歸與攻擊設定共 4 項通過。使用者已要求 PR 與正式發布；本批整合 main 80cc7d94d35f 後候選 2.42.2，發布結論以本批 PR 與部署證據為準。Chrome 1920×1080 與 390×844、深淺色已觀察；目前框飾／進場選擇即時預覽、進場重新整理保留、Q／E 預覽重播、31 款進場直接顯示、長清單末端切分類後預覽回到畫面內已驗。frontend:build（含 vue-tsc）、ui:check、perf:check --build、release:check 與 diff check 通過；整合後前端回歸 90/90、本機 test:affected 因共用／未知路徑回退 292 個檔案，完整 2692/2692 通過，無略過／失敗；未驗實機觸控、所有效果生命週期或 GPU FPS。獨立預覽 127.0.0.5:3168，截圖位於本機 work/settings-auto-entrance-desktop.png、settings-auto-media-desktop.png、settings-auto-attack-desktop.png 與 settings-auto-mobile.png。

2026-10-23 #215 第二輪：使用者指定角色點擊表情、聊天室只留emoji、地板光點、280ms滑動、中央64×128px空白框邊與置中箭頭。共用ReactionPicker按mode分入口，RoomSidePanel沿用UiPanel raised；手機聊天操作列固定到底部。1920／390／320、草稿、焦點、專注模式及雙席表情過期實驗已驗，5項針對性回歸與型別／建置通過。未提交候選，原Figma對照板未同步新修訂；詳[本輪證據](../specs/ROOM-BACKGROUND-215.md)。

2026-10-23 #215 候選 2.41.0：郎中首先接入共用側欄收合與同房背景角色；桌機／手機初始均收合，開關不改中央尺寸，階段切換沿用手動狀態。兩席實際同步、聊天未讀／草稿、390／320px 抽屜外側關閉與鍵盤焦點、專注全螢幕已驗。Stitch 原生可編輯對照板已入第三份 Figma，但 Component／Instance 關聯與既有逐畫面替換仍待完成，不宣稱設計同步完成；完整九回合／實機未驗。來源與限制見 [本輪紀錄](../specs/ROOM-BACKGROUND-215.md)。

2026-10-23 候選2.40.1：所有24支原WAV短音效以manifest映射至較小MP3（含禮物、Ping及遊戲）；舊網址與PCM來源／來源聲音測試保留。特效播放中偏好、reduce、hidden與pagehide由motion-lifetime取消，進場共用6實例與2 context預算，攻擊沿用3實例／4.2秒／1280×900上限。開場略過不載預設圖、進場選單用128px縮圖，屍魂界圖片限顯示尺寸。新增資源必讀[效能契約](../specs/EFFECTS-PERFORMANCE.md)，CI必跑perf:check與build預算；正式主機另須真ffmpeg編碼檢查。設計外觀／玩法不變，實際發布及驗收以本次PR證據為準。

2026-10-23 #151 接續：排除開場與媒體遮罩後確認 subtle muted 4.47:1、猜歌金色標籤2.06:1與手機曲庫數量1.46:1；修正普通 muted／setup與曲庫必要前景／focus tokens。候選2.35.1，最後174入口組合、7275文字樣本零低對比與pageerror，423不確定樣本另列人工；8項對比回歸與型別／建置通過。RM03 Figma 原件描述註記已重開確認；其他設計同步仍待，#151不關票。詳[本輪證據](../specs/SURFACE-CONTRAST-151.md)。

2026-10-23 #214 本機候選：郎中 UI 調整沿用引擎與私有投影，人物卡切換他人鍋為唯讀，暫存選單保留所有 command guard，藥袋右上關閉接回 close-bag；回合流程只讀 phase/stage。全套2642、前端51、圖像2與型別建置通過；後續前端細調以對應前端與實際 UI 複驗。未提交／CI／部署，使用者待驗收；詳 [本批規格與證據](../specs/QUACKS-UI-214.md)。
2026-10-23 共用介面候選2.40.0：R6元件／字級／尺寸契約以 [共用UI文件](../UI-COMPONENTS.md) 為準。UiNotice一般回饋約4秒收起，必要等待／重試資訊依來源狀態解除；提示和操作各保留固定寬高。ImageChoiceGrid依容器與`--stitch-choice-min-inline`換欄，避免設定側邊分類使角色卡過窄。Stitch特效的固定色票集中於stitch-tokens，素材類名保留；不得把類名色碼例外套到色彩宣告。此為候選實作契約，不代表正式站發布。

2026-10-23 #193：極簡畫家接共用倒數警示音，新增 owner 處理最後畫家、基線及背景／BFCache／斷線生命週期；7 項針對性回歸、型別／建置及隔離測試站三席播放事件已驗。候選 2.35.0，完整固定 head CI 以 PR 為準。詳 [本輪證據](../specs/MINIMAL-COUNTDOWN-SOUNDS-193.md)。#190／#192 已隨 PR #201 合併，不重做；正式站及 Figma 狀態不因此改變。

# 程式架構 agent 記憶

2026-10-23 #182 第二次驗收：故事區固定高度與預留捲軸，scrollTop只推進區塊內位置，不再scrollIntoView移動整頁；相同進度輪詢保持讀者位置。998×668實測0／1／2／3卡及跨冊1卡的高度／寬度／頁面與操作列位置一致，滾輪與自動捲底已驗；前端47、本機全套2641全通過。使用者驗收後明確要求合併，候選2.36.2；新交付流程已同步AGENTS與MEMORY-LEDGER。未新增1920／390、實機或Safari驗收；未部署。詳[固定故事視窗](../specs/TELEPHONE-REVEAL-182.md)。

2026-10-23 #182 驗收修正：使用者指定同一人的故事逐次累積題目／畫／猜詞，換出題者清空；Vue 穩定卡片 key 保留已播放畫布，每次新進度及重新載入捲到操作列，相同游標輪詢不搶閱讀位置。legacy 同步累積規則。候選2.36.1，三席真場景／捲動與 legacy 回歸已補；CI 與原生驗收以本次 PR 記錄為準。此決策取代舊版單卡呈現，詳[逐頁結算規格](../specs/TELEPHONE-REVEAL-182.md)。其他已驗收項目不變，未部署。

2026-10-22大廳互動續修：對話入口透過GameCarousel具名slot放在開桌左側，角色只開表情，兩個獨立dialog不再顯示切換分頁。背景改用共用lobby-background store，以既有每帳號localStorage key在GamePreferences與LobbyBackdrop間同步，只提供原本／Stitch城堡；補帳號隔離及儲存拒絕回歸。登入成功動畫auth-entry先前漏接entry-intro音效，已補一次播放、靜音、略過／離頁停止與手勢重試。2558全套、66focused、Vue型別／建置通過；隔離Edge實際登入收到MP3 playing事件，並驗偏好位置／保存、獨立訊息與表情、對話在開桌左側及390px。證據見本機ignored work/lobby-settings-qa-12V5Qw（後續縮圖尺寸校正另驗），未推送／PR／部署。

## 2026-10-22：本機整合 main PR #160

本機功能分支已合併 origin/main 1e613a5，合併提交 91ee01e。保留新版整頁背景角色、五張遊戲輪播及七款角色入場特效，將本機個人背景選擇、WASD、分開對話／表情入口移至 LobbyBackdrop；文字泡泡傳送至同一背景層。郎中檔案與合併前本機快照一致；其餘未提交功能和音效仍保留，stash 安全快照未刪。

Windows 受影響選取回退全套：2555／2555；Vue 型別、前端建置、格式及差異檢查通過。真 Edge 隔離測試驗背景重整保留、WASD、輸入及快捷鍵不誤移動、背景層對話、分開表情入口、390px 無水平溢出及無 pageerror；本機證據位於 ignored work/integration-qa-dyGkPR。舊測試啟動器漏設 frontendEnabled 已修正供下次啟動使用，現有測試服務未重啟。未推送、發 PR、部署或重設玩家資料。
2026-10-23 #190／#192 候選2.34.1：雷霆引導路線 Map 範圍排除 SVG title／舊版延遲提示，保留一般地形／車輛說明與點選；線上／教學改為獨立 watch sources，等價 presence 不清預覽。純呈現 RaceDirections 同時供 DOM／WebGL 與結果補充，後方對應畫面左方，六方向以真引擎 neighbor 與 DOM 投影回歸，不改骰值／機率／位移。驗收、初輪 fixture 格式失敗及固定 head CI／審查界線見 [規格](../specs/RACE-GUIDANCE-DIRECTIONS-190-192.md)，未部署。

2026-10-22／#176 候選2.29.0：使用者在 #175 驗收時要求網址紀錄改片名，已接續實作本機帳號隔離的十筆最近播放、點選填網址與鍵盤清單；來源為 playing 的 current，provider 名稱以 videoId 核對，缺名不覆蓋既有片名。尚未合併／部署，詳 [最近影片規格](../specs/MEDIA-RECENT-VIDEOS-176.md)，取代下筆「#176 尚未實作」狀態。

2026-10-22／#175 候選2.29.0：共用Vue媒體改為播放中／點播雙分頁，視窗關閉與面板隱藏不再清除已接受的YouTube觀看意圖；leaf第三參數續播opt-in保留舊呼叫預設，退出／離房仍清理。實際影片同iframe及字幕前進、leaf與編譯Vue setup回歸有證據；未合併／部署、最近10筆另#176，詳 [介面與驗收](../specs/MEDIA-TWO-TABS-175.md)。

2026-10-21本批郎中停手預估：`estimateAlchemy`與`beginAlchemy`共用計算，讀取無副作用；`stopEstimate`僅對可見recipe投影，隱藏他人鍋為null。新增顏色／鄰座去重／占卜／愚人草／上限及隱私回歸。大廳對話延用原API及事件閘門，最新同人訊息替換並以ID守護清理；依playerId而非姓名綁定。範圍見 `docs/UI-REFINEMENTS-20261021.md`。

2026-10-21大廳泡泡與角色選單：角色互動視窗的訊息表單可在關閉時卸載，因此彈幕事件controller由常駐`LobbyStage`持有；選取框由`BarrageFrames.decorate`加到DOM的`barrage-frame-ornate` class同步進Vue reactive class，避免移動定位覆蓋。實際390px Edge驗證選取neon、送出、框內裝飾、148px高度和無橫向溢出；詳 `docs/UI-REFINEMENTS-20261021.md`。

2026-10-21／#158 CI 追修：首輪 Linux 通過、Windows 唯一失敗為系統 tar 未還原中文 PDF（run 39605036532），非動畫回歸。解壓改為固定 Node tar 開發依賴與 strict 模式，追加長中文／emoji 路徑和二進位 bytes 回歸；保留格式 hook。新 head 的測試／CI以PR為準，詳 [故障證據](../specs/ENTRY-INTRO-NAVIGATION-157.md)。

2026-10-21／候選 2.20.2：#157 修正共用進頁 bootstrap 將開房完整導航誤判為新進站；同 origin navigate／history 不重播，reload 與直接進入仍播放，#154 偏好與登入原圖演出保留。完整 2,543 項及前端 6 項通過，Vue 開房／刷新／返回有原生證據；metadata 缺失保守播放與未驗項目見 [導航規格](../specs/ENTRY-INTRO-NAVIGATION-157.md)。尚未合併或部署。

2026-10-21／候選 2.18.2：依最新已審核 C02 v3 實作共用 RoomPlayerCard、十一款 RoomWaitingTemplate／GameSettingsPanel，保留真實資訊並整合郎中公開資源與雷霆教學；接續 RT 22／RW 30 與九款等待室設計。來源、契約與實際驗收界線見[共用與同頻／傳情](../refactors/STITCH-SHARED-PAIR-APPROVED.md)。

2026-10-21／候選 2.18.1：依使用者指定以 main c0ec416 為主整合本地未提交 UI，四個衝突已解。保留 main 功能／郎中／後端與音效，共用 RoomRoster、RoomChat 及線上／教學 RaceCrewDice／RaceDie；來源、決策與驗收見[整合紀錄](../refactors/MAIN-2180-UI-INTEGRATION.md)。未提交、未 push、未 PR、未正式部署。

2026-10-21／候選 2.17.9：C02 玩家卡片及本機車隊共用收斂完成，新增已審核瞎掰王 20 狀態、雷霆之路 42 狀態（含 17 章教學與十地形）。十一遊戲桌機／手機共用區、瞎掰三回合與再玩、Race 開賽及六本機練習已有實際瀏覽器證據；完整範圍、來源與未驗界線見[已審核稿實作](../refactors/STITCH-BLUFF-RACE-APPROVED.md)。未跑測試套件、未發 PR 或正式部署。

2026-10-20：帳號／收藏庫細節修正與角色管理 A01／A09 已依核稿重排，型別／Vite 建置及相關桌機／手機瀏覽器驗證完成；本輪未執行套件，詳 [介面巡檢追加](../refactors/STITCH-SITE-LAYOUT-AUDIT.md)。

2026-10-19 最新：全站27文件／11遊戲已接入，型別／Vite及78資產HTTP核對通過。十一款正常結局均有實際瀏覽器觀察，部分同桌席位為API QA或原生電腦；最新版面、專注模式、教學重試與斷線回歸已補完；保留實機觸控／IME與罕見時序的證據界線。保留Node規則／REST／SSE及Canvas、媒體、純計算leaf，無Vue Router。共用設定僅在等待／完局準備階段顯示。以下較早接入數為歷史紀錄；以[最新接入、證據與界線](../refactors/VUE-FRONTEND.md)為準。

2026-10-19 後續候選已接入二十六份文件／十款遊戲，建置與76資產HTTP核對通過；共用房間設定只在準備階段顯示，進行中操作另有side-actions槽。一般同頻三題、單人偏好十題、TRPG六幕、Gift兩輪雙分數並列與Poker四街均有實際瀏覽器證據，並有提交斷線恢復證據；Market／Quacks完整流程及最後Race／本機教學仍在接續，不能以接入數推算全站驗收率。詳 [最新接續與界線](../refactors/VUE-FRONTEND.md)。

2026-10-19 傳情畫意／繪畫圖庫接續：目前十九份候選文件、五款遊戲。傳情畫意三十四項實際 API（兩頁真實九十秒）及本人＋兩個腳本夥伴的 Vue 正常兩頁、草稿刷新、提交／選簿回顧已觀察；桌機完整畫布與320px寬核對。Studio 保留既有raster JS leaf與typed API，Vue/Pinia持有網路與圖庫；實際落筆儲存、PNG尺寸、重載圖層、復原／尺寸／去背與還原背景已觀察，自建儲存物件已清理。共用圖片選項已修直排，詳 [最新接續與證據界線](../refactors/VUE-FRONTEND.md)。弱網模擬未造成此次草稿失敗，不可列為重試通過；六款遊戲與兩份一般文件尚未接入，全站驗收仍未完成。


2026-10-18 續作：修正 allowlisted 情境 SVG MIME 並加限制 CSP，HTTP 回歸先失敗後通過；淘汰賽等待室CSS與手機換階段捲動、共用終局面板高度修復。555首去重資料及合作主署名報告更新；完整2436／後續metadata與格式focused46通過，未提交／PR／部署。[證據與限制](../CONTINUATION-ACCEPTANCE-20261018.md)。
2026-10-16 合併前追加：#140／PR #141 最終採原創圖示、預設無聲、無左下入口；帳號自訂 UI 留 #142。修正已持筆按 P 意外開輪盤及大廳串流容量，43 項相關回歸通過；原生雙席兩輪、P 畫布標記、換輪清空及專注 Esc 已觀察。原生同時持筆按 P 與逐幀畫面受自動化限制，依 [規格限制](../specs/ROOM-PINGS.md) 保留待實機驗收，不能宣稱全時序通過。最終 SHA／雙平台 CI／兩輪審查與合併狀態以 PR #141 為準，未部署。

2026-10-16／2.17.0 追加：依使用者指示接入大廳；presence 授權、與各桌獨立 instance，場地／角色／房間列表相對定位。15 項標記與 10 項大廳回歸、原生 P 不移動角色及桌機／390px 已驗，完整新 head 檢查另記 PR #141。見 [規格](../specs/ROOM-PINGS.md)；仍 Draft，未部署。

2026-10-16／候選 2.17.0：#140 加入同桌短暫標記，認證 POST＋SSE、公開目標白名單、五秒過期、冪等及限流，與遊戲存檔分離。11 遊戲共用客戶端，原生 P 點擊／dialog／390px 與多人事件接收已觀察；畫猜完整中途時序與真手機仍待驗。見 [規格與驗收](../specs/ROOM-PINGS.md)。尚未合併／部署。

2026-10-15／2.9.0：新增 Stitch 20 款動態彈幕框與收藏庫分頁，保留原 4 款；靜態模板、框飾動畫與文字分離，沿用白名單事件及本地選框偏好。20 款隔離雙席傳送、現行整合服務代表款及聊天表單、1440／390／320px 選框與收藏庫、長文字／關閉框飾尺寸及減少動態設定已觀察。無測試套件、實體手機、全遊戲階段或 FPS 結論。詳 [設計、實作與驗收](../BARRAGE-STITCH-20.md)。

2026-10-15 架構 PR 驗證（2.8.1）：取代本批候選「套件未執行」的狀態。Linux Node v22.22.1 完整 `npm test` 2229/2229 通過，無失敗、取消或略過；設定保存競態新增 6 項，共用實體操作元件驗房主／容量／階段／pending／焦點／跨房間回應。修正測試 fixture 接線及過時 DOM 斷言，保留畫布像素／中途筆跡與協定斷言；復原測試等待 renderer，不等待刻意未回覆的筆畫 HTTP。67 個變更 JS 語法、CSS ownership、11 頁載入順序、patch release check 與 staged diff check 通過。瀏覽器證據沿用同日實作驗收，沒有新增九回合／實機觸控結論。詳 [UI 架構與驗收](../refactors/UI-ARCHITECTURE.md)。

2026-10-15 前端 UI 階層：以畫猜／郎中為基準，RoomUI 單次分派 snapshot；RoomLayout／DrawingLayout 集中 host 位置與畫板幾何，移除 primitives→Template 反向依賴及 Stitch 全 body 版面觀察；全遊戲房間操作改明確 adapter，設定保存失敗阻止開局。CSS 分成 tokens／skin／composition 與郎中 theme／layout，122 處等值 token；72 組真 Chromium 前後比較 computedStyle 一致。測試站已驗畫猜持筆／ACK／SSE／換輪／結束再玩及設定失敗恢復、郎中一回合採購／女巫、其餘九款房主／訪客／滿員／開局防重；pageerror 皆空。套件未執行，無完整九回合／實機觸控結論。詳 [UI 架構與驗收](../refactors/UI-ARCHITECTURE.md)。


2026-10-15 架構 2／3／4：郎中改用具名槽位、單次採購呈現、直接女巫動作與穩定焦點 key；房間玩家／AI／timer 共用 transitions，保留歷史失敗可離席與清理；畫猜 session 集中 canonical／draft／quota／ACK／reset／renderer。測試站真 Chromium 已驗一回合郎中買退與女巫、雙席持筆／ACK／SSE／reset、undo／clear／重連／換輪／倒數、桌機與390／320；隔離 HTTP 驗 kick 確認／禁重入及歷史 quota 失敗離席。套件測試未執行，語法及 diff check 通過；無九回合／實機觸控／全遊戲結論。詳 [實作與驗收](../refactors/ARCHITECTURE-234.md)。

2026-10-15 郎中房間操作 module：基於 cf80116，新增明確 read/run seam，郎中移除隱藏開始／準備按鈕及代理 click；共用 module 管理 pending、AI 名單槽與焦點，其他遊戲保留舊接線。設定保存失敗與一般操作錯誤分開，避免後者阻塞開始。測試站 Chromium 已驗設定失敗恢復、連點防重、房主／非房主、1440／390／320尺寸穩定、結束重載再開局與撲克相容；未執行測試套件，無實機觸控／九回合／全遊戲結論。詳 [接線契約與驗收](../refactors/ROOM-ACTIONS-ADAPTER.md)。

2026-10-15 整合分支測試修復：原 `a70d34d` Linux `npm test` 為 2091/2209，118 失敗，其中 89 項因瀏覽器 fixture 缺少 `StrokeCanvas.createDrawingRenderer`。補齊測試用 DOM、音效、卡片事件與房間操作契約；畫猜整合測試保留 512×256 協定像素，另以真實 renderer 驗 1536×768 畫布與填色。修復後畫猜 185/185、Linux 完整 `npm test`（含 `release:check`）2210/2210、`git diff --check` 通過。未改產品程式；無新增桌機／手機實玩、Windows CI、PR 或正式部署證據。

2026-10-15 候選 2.7.0：郎中 Stitch 與畫猜以同一等待室／聊天室元件整合；採購以圖片、價格與勾選呈現，保留購買取消、最新原生控制器及原音檔。五席、第一輪實際買退、主鍋／放大提示、1280及390／320採購與有限畫猜開局／筆跡已觀察；未新增完整九輪、實機手機或聽感結論。詳 [本輪整合與驗收](../STITCH-QUACKS-INTEGRATION.md)。

2026-10-14 畫猜高解析度候選：1536 × 768 向量重繪、固定座標契約與有限双席／桌機／390px 實際操作；完整 Figma flow 匯入仍待。已驗與未驗見 [本輪證據](../DRAW-HIGH-RES-PROGRESS.md)。

2026-10-13 PR113夜間策略取代未合併診斷方案：23:59–次日00:29，每五分鐘、最多七次，使用23:59的目標日／月份。global nightWindow在網路前交易領槽，晚啟動不補burst、實際五分鐘間隔、重啟／並行／時鐘回退防重；缺資料次晚限量補，成功永不自動重抓。只在夜窗啟動價格查核與自動保存證據結算，日曆／開局與人工14點後流程保留。詳[策略](../specs/MARKET-NIGHT-RETRY.md)，未部署，真實夜間時序待驗。

2026-10-13 畫猜 2.1.0：新畫筆以可選 quadratic codec 保留跨包曲線；renderer 合併相鄰同樣式、同 ID 且 anchor 相接的 chunks，保留未標記的舊直線作品。活動排送改為 16 點／80 ms，wire 仍 64 點／115 ms／單一 in-flight；viewer 同筆 dt 不因晚到重新計時，插值只在 view，積壓超過 450 ms 壓縮未來時程至 180 ms 且不丟點。Linux 完整 2081 通過；有限原生兩席最終非空像素相同、canonical 重播 RGBA0 及受測持筆無閃白。具體證據、初次暫存 I/O 失敗與未驗範圍見 [本輪進度](../DRAW-GARTIC-DT-PROGRESS.md)。CI／公開發布以 PR 實際紀錄為準，取代舊 input／viewer 時程數字，保留可靠交付、quota、權限及舊作品相容契約。

2026-10-12：共用側欄重複色塊與歷史連結移除候選；shared-turn保留僅讀屏公告，網站歷史入口保留。範圍與驗收見[共用側欄](../specs/SHARED-SIDEBAR-FOOTER-REMOVAL.md)；測試、PR與部署狀態以本批PR證據為準。

2026-10-12：AI 玩家末格補齊各遊戲入口，含極簡畫家／猜歌、霧港、瞎掰、撲克、雷霆、同頻、送禮及畫猜。共用移動保留原事件、delegation、pending 與滿員／房主限制；測試與正式部署狀態見本批 PR，不沿用上一輪電話遊戲單頁證據。

2026-10-12：AI夥伴末格整合候選，基於main f2689a4保留共用畫板與操作間距；朋友名單最後一格使用玩家卡／＋圖示、房主／滿員／pending契約。來源與驗收見[AI入口](../specs/AI-ROSTER-SLOT.md)；正式結果以本批PR為準，不將舊隔離證據當作新版通過。

2026-10-12：傳情畫意共用畫板候選，題目與倒數上移、移除技術限額說明、採同款工具與renderer。19 focused及8組隔離Chromium布局，未部署；到0流程待確認，詳[共用畫板](../specs/TELEPHONE-SHARED-BOARD.md)。

2026-10-12：欄位＋操作排版候選修正，傳情畫意等待／再開局使用共用ui-field、ui-field-actions與ui-control-group，避免選單貼住開始按鈕。實作與範圍見[共用欄位操作](../specs/SHARED-FIELD-ACTIONS.md)；測試、PR與部署狀態以本批PR證據為準。
2026-10-12：獨立側邊候選將建房遊戲設定移至房間設定；畫猜結算／題庫／時間與瞎掰難度／身分時間集中、非房主唯讀。保留8題與30秒預設及舊API，不改傳情畫意控制列。規格見[設定位置](../specs/GAME-SETTINGS-IN-ROOM.md)，測試與發布以本批證據為準，尚未部署。

2026-10-10 音效秒數補驗：10／30／60 秒真實時間瀏覽器各取得 5→1 原生 playing，320ms、25% 音量、零錯誤／重播；隔離靜音及提前 ready 也通過。56 focused，未改 runtime／重跑全套；取代前筆『無原生 playing 證據』，喇叭主觀聽感仍未驗。詳細 [三種秒數證據](../BLUFF-KING-PROGRESS.md)，沒有 PR／部署／永久偏好更新。

2026-10-10 瞎掰王候選 1.28.0：隨機首位想想、按座位輪替每人一次；最後 5→1 秒重用 320ms turn 音，roundId＋秒數去重，沿用音效偏好、首載／hidden／斷線／BFCache 不補播。50 focused、Windows 完整 2000 通過；原生計分與輪替、0 秒完成，無喇叭聽感／playing 事件結論。測試音效暫開後恢復原偏好。詳 [驗證與限制](../BLUFF-KING-PROGRESS.md)，未發布 PR／部署。

## 2026-10-09：#93 共用夜間對比

基線 main4664916：`ui-widgets.css` 選取分頁 fallback 以 `--green` 當填色，playful dark 卻將其映射為淺 ink，文字 fallback 仍白，真 CSS fixture 為1.10:1；欄位錯誤與市場局部錯誤色在暗底也不足4.5。候選修正採成對 widget tokens，特別校正市場／素材庫局部 override，裸按鈕以零 specificity 主題 scope 補成對配色；分頁只有邊線過渡，背景／字同步切換。`ui-content-card`／紙卡 modifier 明確區別 theme surface 與固定淺紙，電話畫猜結果已採用，沒有改 renderer／SSE。21樣本日夜與390px fixture已驗，不代表全頁遊玩；他人本機 bluff 尚未在 main，仍需讀 source、採用契約並實際驗證。詳 [契約與限制](../specs/SHARED-THEME-CONTRAST.md)，尚未合併／部署。

2026-10-09 #87/#88候選：Draw ending整數驗證、after-reveal達標、跨圈及64題上限，recent結果限8，legacy未帶設定維持原流程。TableMedia主X只縮小video，不改playerEpoch／videoWanted；小窗X才退出，同意／paused／視窗可見性／清理不放寬。新八regression、完整1,975；[原生scope與已知限制](../ROOM-CONTROLS-87-88-PROGRESS.md)。未改renderer／SSE，未部署；#86已合main，前述候選狀態為歷史。

2026-10-09 #81／#83：新 PartyRoom 共用入座／epoch／128 指紋收據，不重構舊引擎。MusicQuiz 音訊檢查登入／席位／当前輪，無曲名 URL／未揭曉答案；Minimal 僅可信幾何座標、server deadline 与計數，沿用 StrokeCanvas 原子呈現。client scope 取消／草稿／不可變重試 payload／音訊 binding cleanup 有 fixture 驗證；Windows 1,967 與 UI 範圍見 [進度](../PARTY-GAMES-81-83-PROGRESS.md)。開始、開發途中、測試前與推送／交付前 fetch main；更新時先對差異再整合，不覆寫別人 worktree。

2026-10-09 #80 候選：TelephoneRoom 獨立規則，step UUID／SHA256 request 指紋、最多 128 收據；view 僅上一頁，歷史 historyState 以逐頁 delta 有界保存／重建。client 私人草稿同分頁 sessionStorage、逐段 preview／canonical 收尾、poll 不重建草稿、lifetime 身分防止 BFCache 舊回覆覆蓋。最大八席八頁仍符合預設歷史限額，Windows 1,951／最新 client 4。失敗及工具限制见 [驗收](../TELEPHONE-FIRST-EDITION-PROGRESS.md)。未改舊畫猜 renderer，未部署。

2026-10-09 #59 候選：獨立 TrpgRoom 及 client 接既有房間／權限／重連／history。伺服器 d6，場景 UUID、有限 requestId 收據去重，檢定前驗證；view 不外洩他人草稿／secret。client 一個可取消輪詢，寫入不自動重送，未提交修改阻止檢定。Windows Node22 1,932/1,932；工具六幕與歷史通過，其他範圍見 [驗收](../TRPG-FIRST-EDITION-PROGRESS.md)。非跨程序续局／模型主持，未部署。

2026-10-09 驗收增量（base 2a5a197、受驗 head d610186）：Draft PR #82 已建立，CI run 37879539800 的 Linux／Windows Node22 jobs 均 success；本地 app/runtime/controller focused 41/41。內建瀏覽器完成有限兩席畫猜同步／倒數／返回及賽跑擲骰／三步移動鎖／返回／教學切章重試。手機 viewport 設定未生效，仍1280×720，不能算手機驗收；Chrome fallback 因工具無法可靠辨識網址而中止。使用者明確回覆沒有觸控設備，真實觸控與旋轉先記待驗，未豁免門檻。詳細矩陣見 [本地驗收](../refactors/BATCH-70-79-LOCAL-ACCEPTANCE.md)。本筆取代先前「沒有PR／CI／真瀏覽器操作」現況；完整UI矩陣與最終兩輪審查仍未完成，保持Draft／HOLD。

2026-10-09 本地接手：bundle SHA256、完整歷史、HEAD f5080e4904d004affd78ac9fd5aa53c5682dae2f、tree 4742535214385d144ed680c8a28703f3875a4773 與 base 2a5a197094c254d4a16cdec682d441af31692c76 已核對。遠端 main 仍等於此 base。使用者授權匯入、設定及推送新分支 codex/refactor-70-79-20261009。Windows 隔離 Node 22.23.3／npm 10.9.9 原生 networkInterfaces 正常，npm test 1916/1916、fail/skip/cancel 0、exit 0；npm ci、patch release check、教學來源及 diff check 通過。Node 26.2.0／npm 11.13.0 診斷全套 1915/1916、exit 1，schema 3 restore 測試 HTTP fetch 遇 bad port；根因未確認，不視為通過。測試僅用合成／隔離資料。本輪未執行真瀏覽器矩陣、遠端 CI、PR、tag、main 合併或部署；HOLD 保留，Node22 通過不取代 UI 驗收。

2026-10-09 測試整理候選（Issue #70／parent #56）：首批 character-sound-http、room-media-http、market-images-http 改用 [共用隔離 fixture](../../tests/helpers/README.md)，專屬資料與遊戲 assertions 保留。新 helper 在 seed／listen 前登記清理、關閉 setup DB，失敗即清理；close 拒絕時保留資料並報錯。沒有 runtime／schema／版號／CI 或 main 保護設定變更；其他 fixture、subprocess／global-env 通用管理仍未遷移。驗證與 PR 狀態以 Issue #70 連結的實際檢查為準，不代表已合併／部署。
2026-10-09 Issue #72 本地候選：RoomApi 委派共用 requestJson，保留 HTTP status／code／details 與取消語意；只遷移此邊界、不改 draw／race controller、不增加寫入重試。契約與範圍見 [shared requestJson](../SHARED-REQUEST-JSON.md)。尚未推送、合併或部署；完整驗證仍受基線 `/api/info` 的執行環境限制，不可從 focused 通過推定可發佈。

2026-10-08 Issue #63：候選 1.22.0 大廳／本桌聊天室，基於 main dae903e；記憶體 50 則、每次讀寫驗證席位、無 schema／永久保存。仍 Draft 未部署，整合與驗證限制見 [聊天室規格](../specs/LOBBY-TABLE-CHAT.md) 及 PR 證據；不取代既有正式部署紀錄。

2026-10-08 再次檢查PR53／57：修正混合AI全員同組的majority-one-channel，授獎至少3真人且AI不授。完整Linux53 1725／57 1742通過，固定source、修改前2失敗→修正後通過與兩回合審查見 [本輪](../PR-RECHECK-ALL-SAME.md)。未部署，舊收據不回写。

2026-10-08 PR53評論修正：同頻／送禮／畫猜混合真人AI成就映射以真人席位為準，缺真人映射仍拒絕。相关67項通過，包含真HTTP同頻3真人＋1AI；舊收據不改寫，未部署。完整證據與兩回合審查見 [本輪紀錄](../PR53-MIXED-AI-REVIEW.md)。

## 2026-10-08：成就單位事件的來源與持久邊界

2026-10-08 正式驗收：v1.16.0／固定 source 8a9cbfd，Windows 與 Linux 各1,518項通過；三款正式正常回合解鎖、18筆 own 新徽章／3 receipt／9探索 rows，以及背景 Chrome 高亮／日期／桌機手機／鍵盤通過。9帳號全欄位、13市場圖片與舊16徽章保留，own房與登入／分頁／代理已清理。卡片可見解鎖字樣已移除，读屏狀態保留；畫猜局內合併提示、永久勝場及跨程序outbox尚待。此筆取代本批候選待驗狀態，不宣稱真人訪談、完整讀屏或全瀏覽器；詳細範圍見成就單位進度。


本次相容修正：保留資料庫帳號 ID 原始大小寫，包含合法大寫 UUID 的匯入帳號；去重仍辨識大小寫變體。卡片依最新使用者指示改為高亮區分取得狀態，可見解鎖文字移除，讀屏狀態與日期保留。

本批已實作 source 與 focused 測試，正式版本、完整 suite、原生瀏覽器與部署結果由主流程更新 [成就單位進度](../ACHIEVEMENTS-UNIT-PROGRESS.md)，不能從本節推定已發布。對應 [成就與戰績 spec](../specs/ACHIEVEMENTS-AND-RECORDS.md) 的第一批 round 成就；下方「成就／ledger 仍缺」須拆成已完成的單位 receipt／探索進度與仍未完成的永久勝場／durable outbox。

`src/games/draw-guess.js`、`gift.js`、`majority.js` 每整局產生 `match_id` UUID（draw 沿用 `gameRunId`），每輪另產生 `unit_event_id` UUID。可選、非列舉的 `achievementUnitStart` 同步返回 canonical 座位／帳號映射，開始時複製並凍結；不能在結束時從名字或現在名單補身分。帳號 UUID 保留資料庫原始大小寫，去重時辨識大小寫變體並拒絕同帳號／同座位重複；缺失、throw、partial 或無效映射使該成就單位降為 `interrupted`，原遊戲仍照原規則結算。`participantCount` 只計凍結映射覆蓋的官方有效真人，不大於映射人數；不足映射的同頻趣味 predicates 為 false。最小 facts 僅含身分、UUID、round、品質狀態、ISO 完成時間、參與 booleans 與必要 metrics，不含題目、猜測內容、喜好、禮物 ID、畫布或手牌。

完成事件由權威操作建立，不用 `phase==='reveal'` 推測。draw 的 server 接受 stroke／guess 才留證據，clear／undo 不退款或刪資格，duplicate／拒絕操作不增加證據；artist 離房／offline auto reveal 為 `interrupted`，正規 timeout／all-guessed 為 `rules_completed`，玩家不足提前結束為 `abandoned`。正常輪保留此前已離席者的合法證據，重新入席等待下輪不加入這輪 current count。gift 僅在最後收禮確認後的正式 `finishDelivery` 建立 facts，同一收禮者的正式 entries 按 exact gift ID 判 twins，`great/good/ok` 判正向心願；delivering 移除玩家為 interrupted，少於三人為 abandoned。majority 只採正式 score 的 groups，填空合併預覽不發事件；withdraw／kick／missing 答案無資格，全有效同組需至少三人，並列最大需至少兩組且每組 count 至少二。

引擎先 latch 深凍 snapshot，再呼叫 `achievementUnitCompleted` 通知；同步 throw／Promise rejection 不回滾已接受玩法。`pendingAchievementUnits()`／`drainAchievementUnits()` 皆非破壞性讀取，成功持久化後才 `acknowledgeAchievementUnit(id)`。每房私有 pending 上限 256；滿額時下一輪／新局在 mutation 前拒絕，不淘汰未儲存事件，整局最後正常結束仍可完成。無 hooks 的既有 fixture 玩法不累積 pending，也不受此上限阻擋。

Store 的 `processed_unit_events` 按 UUID、單位唯一關係與 facts 指紋去重；相同 UUID 不同內容是衝突，不覆寫。只有 `game_server`／`production`／`rules_completed` 的有效參與者授予徽章與 `achievement_progress`；兩種不同遊戲的有效單位可授 `all-two-tables`，不靠登入、點擊或勝場。五枚舊徽章 ID 與取得日期保留。已驗 engine 新 34、store 新 17、既有三引擎 32，共 focused **83/83**；engine 的三遊戲 × 五類 mapping 故障真實寫入 in-memory SQLite receipt、duplicate 與 ack，均 0 award／0 progress。語法及 owned diff 檢查通過；這不是完整 suite、真人試玩或正式資料驗收。

**B03 永久獲勝 ledger 與 durable outbox 尚未完成。** 已提交的單位 receipt／進度能跨 store 重開去重，但引擎／app 待處理清單仍在 RAM，程序崩潰前尚未落庫的事件會丟失，不能宣稱 crash-safe／exactly-once 全流程。後續須補持久 outbox 與 history／SQLite reconciliation；不能從暱稱、外站或不可驗身份的 archive 補授獎、補勝場。來源與限制保留在本批進度，避免把既有角色文件的歷史版本當當前完成狀態。

2026-10-08最新正式 **v1.15.1／c1e59d4**：使用者要求先撤回不一致的局部手繪風格，已恢復原大廳及四房標題外觀；保留v1.15彈幕框與既有功能，SVG/credits僅歷史留存。双平台各1,432、公開27資源、原生首頁／四房waiting通過，9帳戶allfields及21non-session表/BLOB保留；詳細source/部署SIGTERM逾時與proxy drain/不可覆寫receipt修正/備份/有限native/own cleanup見 [還原進度](../UI-STYLE-ROLLBACK-PROGRESS.md)。下面手繪與候選狀態屬歷史；後續局部美化须驗整體一致性，不由素材研究直接推定成熟全站方案。沒有新PR/push。

2026-10-08使用者回饋：局部手繪畫風造成網站整体不一致，先撤回手繪主題。候選 **v1.15.1／c1e59d4**恢復大廳及四房導入前的外觀，v1.15彈幕框及既有WebGL/共看/排版功能保留；素材與授權只作歷史留存。後續變更須以大廳、房間、設定、其他頁面的整體一致性評估，不把素材研究或局部preview當成全站成熟方案。Windows1,432／有限native與正式結果以 [還原進度](../UI-STYLE-ROLLBACK-PROGRESS.md)最新節為準；下面v1.14.2的「正在使用手繪」是歷史。

2026-10-08最新正式 **v1.15.0／f4cbdfa**：彈幕框Stage A發布，雙平台完整各1,432、公開25資源與五款三席frame/avatars通過。PNG上傳收藏／成就與勝場ledger仍缺；完整source/首輪Linux暫存I/O失敗與重跑/備份/native scope/9帳戶及21non-session表保留/own cleanup見 [最終進度](../BARRAGE-FRAMES-PROGRESS.md)與 [backlog](../SPEC-BACKLOG.md)。下方候選及1.14.2是歷史；tag固定受測程式，沒有新PR/push，不把有限取樣當全phase/讀屏/200%/FPS。

2026-10-08彈幕框 Stage A已實作候選 **v1.15.0／f4cbdfa**：server exact builtin ID→frozen {kind,id,version}，只text事件；local frame prefs獨立於MotionPolicy，關框不可clear文字。首建按真height做interval placement／gap8，不足直接false不排queue；show false／同步finish／throw釋放lane和timer，過期finish不得刪新借用者。resize只在尺寸變時清理，不做每frame layout；新增PNG upload仍StageB，不能把現catalog說成schema/ACL完成。Windows1,432與有限native證據見 [彈幕框進度](../BARRAGE-FRAMES-PROGRESS.md)；Linux/正式結果以最新節為準，基線正式仍v1.14.2。本輪不改drawing renderer/codec/transport，持筆樣本與最終一致需分開記錄。

2026-10-08最新正式 **v1.14.2／8ae5c4f**：Freehand官方SVG／紙卡大廳發布，最終Windows/Linux各1,415通過；v1.14.1 archive行尾失敗留歷史未部署，tag不移。Windows core.autocrlf會影響git archive輸出；SVG provenance需要.gitattributes text eol=lf與canonical export，originalSHA和modifiedSHA分開。固定路由／SVG CSP，不能開任意SVG或user upload執行；公開測試清理須容許房間已404，且try/finally保own logout。 正式22資源exactbytes/no-store/MIME、21non-session表rows+BLOB/9帳戶allfields保留；sessions232→238為6次測試登入，都已revoked，own4房/代理/tabs已清理。精確source/備份/例外與限制見 [本批進度](../FREEHAND-UI-PROGRESS.md)、[spec](../specs/FREEHAND-UI.md)、[資產評估](../research/FREEHAND-UI-ASSETS-ASSESSMENT.md)、[視覺參考](../research/FREEHAND-UI-VISUAL-REFERENCES.md)。下方1.14.0/候選狀態為歷史，沒有新PR/push；不宣稱全playing/200%/讀屏/FPS完成。

2026-10-07最新正式 **v1.14.0／b4ebb15**：圓角骰子與連續暖色WebGL氮氣已發布，雙平台各1,413通過；正式三席13骰／9資源與真nitro移動、21non-session表rows+BLOB／9帳戶allfields保留。sessions225→232是驗證登入變化，own房／登入／代理／tabs已清理。骰子geometry按job cache，shadow與cube各一draw（state.drawCalls只計cube）；氮氣沿同context／program／buffer以6vertices持續畫，只有live callback可continuous，discard stop(eventId)，車尾取carrier CTM(-20,0)。 完整source／備份／原生範圍見 [本批進度](../RACE-FX-VISUAL-REFINEMENT-PROGRESS.md)／[spec](../specs/RACE-FX-VISUAL-REFINEMENT.md)。下方1.13與pending均為歷史，此筆取代其現況；沒有新PR／push。native hidden／200%／讀屏／玻璃跳台道路pan及FPS未驗，不以完整suite推定。

2026-10-07最新正式 **v1.13.0／353d8b6**：雷霆原生WebGL立體骰子／短符號及清理回退已發布；雙平台各1,408、正式三席13骰與7份資源／資料保留通過。17骰450ms原生圖為隔離定格，hidden原生未觸發、無FPS結論；結果和權限由server決定。完整source／備份／邊界見 [骰子進度](../RACE-DICE-WEBGL-PROGRESS.md)／[spec](../specs/RACE-DICE-WEBGL.md)。下方1.12與pending是歷史；tag固定受測程式，沒有新PR／push。


正式 shhuang.cc 已以私有 server token 啟用既有本站→stanley021039/BGA Issue／comment／admin status 同步。程式仍v1.12.0／83ffcab，沒有runtime修改或新PR；設定前outbox空、zero-room guard後重載。Issue48正式新增、同UUID重送不重複、前端reply與adminclose均同步，ordinary status403，3筆done無待處理；沒有GitHub→本站同步或legacy backfill。憑證不得放前端／Git／logs；維護與精確scope見 [同步紀錄](../GITHUB-BOARD-SYNC.md)。

2026-10-07最新正式 **v1.12.0／83ffcab**：雙平台各1,386、有限native／公開38media＋37draw資源／ACL／資料驗收完成；schema16／22表、9帳戶allfields／13市場圖片／21non-session rows與BLOB保留，sessions210→217為驗證登入變動。code／tag固定、own QA清理完成，沒有新UI PR。PR46外部已合併，其1,300項與本批分開；完整source／備份／限制見 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)。下方候選／待驗為歷史，不宣稱全讀屏／200%zoom／FPS／真YT公開實播。

2026-10-07 patterns有限原生新知：shared invalid批次先標所有無效欄位，再以單microtask聚焦第一個；focus:false／reset／destroy須取消晚排程，修valid title只清自己的aria描述。manual tabs focus與commit保持分離，rapid Arrow位置立即更新與baseline／earned錯序由中央契約處理，不各caller加poll。widgets focused72和真鍵盤／Escape有限證據見 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，新排序修正／全套／公開1.12仍待驗，不稱本批已完成發布。

2026-10-07原生元件新批實作中：widgets只管tabs focus／panel關聯、field feedback與native dialog，不接管submit／API權限／page state；collection原confirm保留，market busy／批次不改。notifications有限queue／seen、GameUI.notify與四款既有server earned差集，不加poll，draw僅toast。hidden保可讀內容並暫停expiry，入口／celebrate取消且不補播；pagehide清理。契約與本批待驗source見 [spec](../specs/UI-COMPONENT-PATTERNS.md)／[進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，正式基線1.11.1，未以舊1,284項推定新批通過。

2026-10-07恢復基線：PR46第三P2已推送、Ready並再次請Stanley審查；正式v1.11.1的source／測試／清理見 [PR最新證據](../PR46-REVIEW-FIX-PROGRESS.md)。patterns候選1.12.0恢復實作但未驗／未發布，前批結果不替代本批。

## 2026-10-07：正式v1.11.0／PR46回歸契約

renderer用`surfaceRevision`／`presentedSurfaceRevision`追staging實寫與可見提交：clear／undo尚未present即使沒有新stroke也須copy，latestjob／generation仍防舊圖覆蓋，settled no-op不copy。音樂`interruptedAudio`只復原此次hidden自動pause的同clip／key／epoch，等fresh marker；manualpause／設定停用／browserreject／sharedpaused／videoexit維持，staleclip不復活、不加poll／seek。main衝突保MarketImageStore／schema16／gallery、pngjs7／sharp0.35.5、market3MiB／approve128KiB、char4MiB與preserveImportedSessions。PR雙平台1,263、正式保UI／WebGL整合雙平台1,284；native12真Canvas2D與Audiovisibility範圍見 [證據](../PR46-REVIEW-FIX-PROGRESS.md)。此筆更新當前schema16，下面schema15與候選狀態為歷史，不能混算source／測試數。

## 2026-10-07：正式v1.10.0局部WebGL

`GameFxLayer`用原生WebGL1、lazy、有界buffer／particles／contexts，idle無rAF；只接公開event／live gate與視覺車位anchor，不改checkpoint、server／DB或畫猜renderer。`onActivity`等成功非零draw才發布kind，僅用`visibility:hidden`遮同類SVG裝飾（opacity會被舊keyframes覆蓋），標字／bullet／trail／spin保留，empty／loss／reduce／clear復原。restore不補播；最終loss probe與較早restore cycle分開，不能拼同次完成。雙平台各1,165、限額／source／native／資料與限制見 [進度](../UI-POLISH-WEBGL-PROGRESS.md)／[spec](../specs/UI-POLISH-WEBGL.md)。此筆取代下方「WebGL未實作」現況，舊研究保留。

2026-10-07 Issue47候選v1.10.0：市場官方日收盤採精確日期與兩份官方日報核對；14:00只是查詢门檻。日曆開場與延遲結算解耦；單writer job、abort/join、restartcatchup及SQLite原子授分。排行榜只市場ledger、暱稱與競賽同分；新UI與舊票／圖片庫回歸均測。原生Chromiumsocket限制未驗，未部署；最新scope和來源見 [市場自動化](../MARKET-AUTOMATION.md)。

2026-10-07最新PR1.9.3／a2c5589：play／pause Promise fence與64events／8proofs／8corrections保意圖／failclosed，不加poll／seek。雙平台1,300／focused126／peer與fresh原型Pause／最後Play／normal已驗，proxy總media4／5各不變（分解GET3／4各不變、POST1不變），QA已清。原型API無input、fresh約3.6ms transient非零瞬間／physical UA；gate與resourcebuffer教訓見 [進度](../PR46-REVIEW-FIX-PROGRESS.md)。已推送4604dce、更新描述與 [最終回覆](https://github.com/stanley021039/BGA/pull/46#issuecomment-6038913529)、Ready（draft=false）並再次請Stanley審查，未合併，正式1.11.1不變，patterns另於main整合未發布。

2026-10-07 PR46第三P2：visibility resume須同clip／epoch／fresh marker且無較新本機意圖；native Play→Pause撤銷舊中斷資格，晚queue GET不重播。pending play因visibility自動pause的Abort／resolve／finally仍可只恢復自己的中斷，native pause／mute／retire／noLoop保持，不加poll／seek。PRcf64bfc／1.9.2雙平台1,278，正式保UI／WebGLdf983da／1.11.1雙平台1,299；PR已推送、標 Ready 並再次請 Stanley 審查，未合併。fresh真UA controls與controlledHAVE_NOTHING、VM METADATA1和證據限制見 [最新進度](../PR46-REVIEW-FIX-PROGRESS.md)，不能拿中間trace代替最終scope；canvas本次未改，patterns暫停。

## 2026-10-07：正式v1.9.0長期契約

畫猜原子呈現只在opaque staging完成canonical job後commit；visible clear／copyBase後不能yield暴露半幅，ACK mutable→classic也同樣檢查。保留caller原creation options與省略語意，latest job／epoch、取消／reset／whenIdle必守，cache含stage≤8MiB。brush／erase optional pointTimes同長safe integer0..120000、chunk非遞減；duplicate後、額度與version mutation前驗，不增加跨chunk ledger。immutable ID/body及anchor時間保留，server canonical立即、無逐frame點timer；artist不重播ACK，viewer有界回放，snapshot／reconnect／reveal／undo／fill等取消並立即baseline。

CountdownBar以WAAPI linear scaleX表現server deadline，既有更新校正動畫wall drift，不增逐frame JS或poll。每輪持筆／ACK／reveal／換畫者都查中途visible、終點canonical與callback清理。quiet成功文字移除不得連錯誤／重連／設定提示一起清掉。最新實作與驗收統一見 [畫猜進度](../DRAW-TIMED-PLAYBACK-PROGRESS.md)／[spec](../specs/DRAWING-SMOOTHNESS.md)，不能由單trace宣稱所有硬體或60fps。

媒體影片預設使用可用高度；DOMRect取left／top／width／height明確欄位，不spread原生prototype getter。自製共用seek移除，只有canControl可按「同步我的播放進度」讀本機video API／audio.currentTime並一次seek；ticks不讀也不發seek。保留timeline／timeout／stale job／ACL／close-hidden guard及local-only resize。見 [媒體spec](../specs/MEDIA-ICON-WINDOW-UI.md)／[進度](../MEDIA-ICON-WINDOW-UI-PROGRESS.md)。

2026-10-07 WebGL導入評估（研究，未實作）：優先局部雷霆粒子特效，保留SVG互動與GameUI；現四條transform彈幕及少量卡片不值得先全面換renderer，大廳left/top可先比較transform。畫猜WebGL只能處理本機繪製候選，不解140ms／單in-flight／HTTP-SSE等待；fill readback、白erase／AA／canonical PNG需另驗，Worker也是候選。PixiJS v8查核當日沒有可承諾的自動Canvas fallback，要自行保留原SVG／CSS。未跑WebGL原型／FPS，不外推加速比例，細節與官方來源見 [導入評估](../research/WEBGL-ADOPTION-ASSESSMENT.md)。

## 2026-10-07：作畫順暢度第一批（正式v1.8.1，有限P1）

正式v1.8.1／6707a9edf07839c3307dd230ff6eeca5fa92bf62已於UTC03:30:44.024Z零房間guard部署，PID107492→110715、service／tunnel active。Windows1076／1076／37689.229ms，Linux Node22.22.1 1076／1076／189955.125522ms，各fail/cancel/skip/todo0；本地受測tag固定，沒有新PR／push、PR43未改。schema15／21schemas／20non-session rows+BLOB與8帳戶全fields保留、integrity ok／FK0；sessions161→165為已登出的QA登入，不說sessions不變。SQLite線上備份與另時點files/env archive不是atomic cold snapshot。公開版號與5資源精確內容/no-store已驗，沒有逐項驗5資源MIME；正式3會員HTTP/SSE duplicate／nonartist400／undo-clear quota不退已驗。Chrome正式僅背景home版號；local像素／輸入證據另列，own房／auth／tabs／preview／control已清理，不改前景或偏好。

P0從v1.8.0／5687561基線導入140ms first-new-point timer、40點／up提前flush；115ms开送下限、fill500ms、單in-flight，prepare才UUID／deep-freeze≤64點，同epoch／round／strokeId／tool／style／filled相鄰未送才merge。queued entries≤1000／points≤30000，metrics pendingPoints／bytes只算未送，inFlightPoints另列／oldestAge從最老job入列。stroke與snapshot GET各10秒；snapshot job identity／epoch／round取消防舊finally清新GET，AbortError不全站disconnect。暫時DRAW_RATE_LIMIT／500／網路等最多3attempt同ID/body，永久WORK_LIMIT明確取消未送＋sync；quota只首attempt拒新批，已接受但lostACK且SSE先耗quota的同ID重試仍可去重。

server rolling1000ms最多10批、1000accepted batchIds／30000accepted points／48fill與fill2/s不變，anchor計points，undo／clear不退lifetime quota。batchId只ID去重，已送body不能改；SSE先於HTTP，两次序／gap snapshot保持。command active筆先請完成，之後drain→權威sync→undo/clear→renderer idle；busy期間不新input，epoch清timer／request／舊draft。既有command POST與state poll未新增10秒deadline，不能泛稱所有網路有deadline。

P1仅有限mutableFrom < strokes.length的明確local draft且本epoch未遇fill使用opaque base＋mutable suffix；無draft／Infinity／全部ACK／viewer用visible同surface原classic。mode切換取消舊layer job、清base checkpoints並完整合作式canonical replay；任何history／draft fill令classic sticky直到reset，不保留server末筆brush永久mutable與promotion。每mode單組15checkpoints＋1base、512×256≤8MiB，不能保留雙cache。白色source-over erase、fill容差24／filled／0.5位置／圓cap-joint及render／cancel／whenIdle／reset不變；活動完整path仍重畫，未消除全部O(N²)。up收實際尾點、cancel／lostcapture只finish已有樣本，非空coalesced與parent擇一；rAF只preview，可靠sender／恢復／save不依賴rAF。

P0已驗native25／3點持筆viewer先見更新；25點up後兩席25chunks／49含anchors／ink1603與fresh0差。trusted down/up＋1000 synthetic moves單task只1preview／999lineTo，400ms延期16requests／1015點／max64；工具約1秒／move及背景970ms排程不作FPS。

native19場景18個對fresh strict RGBA0；fill-dependent362 RGB／max13／alpha0／exactmask0，新wrapper與legacy SHA同而整體strict flag仍false。captured dense3場景均fresh0。實際1000 synthetic-move／948有效點／16chunks963含anchors兩席同JSON，但artistfresh0／viewerclassic67 RGB／max54、viewer baseCopies0／mutable0；同capture timeout20ms／warmup0及1的原classic與opt-in Infinity同樣67／max54、old/new直接diff0／SHA相同。此證據只限受測trace，不歸因layer／硬體／GPU／CPU，不寫19native全部fresh strict或所有雙席pixels相同；兩組rAF控制2秒未advance而未完成，不能列pass。工具慢線／背景970ms不作人體FPS。

原layer在fill底圖白erase及dense已確認圖有差才縮限；first-context frequent診斷雖15pass卻改11case canonical SHA，不能為過關切換全站hint或放寬AA。P2新排序／並行POST與P3抽稀／新codec仍未做。來源、備份、精確scope、未驗rAF／原生取消／真收藏或其他硬體與後續提案见 [本批進度](../DRAWING-SMOOTHNESS-PROGRESS.md)與 [spec](../specs/DRAWING-SMOOTHNESS.md)。下方v1.8.0與更早紀錄為歷史，後續文件提交不移動受測tag；原HAR／cookies／帳密與.local偏好不提交。

## 2026-10-07：共用媒體與房間角色（正式 v1.8.0）

`RoomMediaRegistry`綁room物件，不只六碼；每房一個current、混合queue、播放anchor、UUID instance／session及revision。所有有效座位可enqueue，其他transport／queue／duration／ended只host／manager。`src/rooms/permissions.js`的non-enumerable `room.managerIds` Set只存目前room管理seat；host由room.host即時判斷、role不是siteadmin。leave／kick後prune，短暫重連active seat保留、離房重入不繼承；manager不能升人或踢host／同級／自己／bot，host原有bot管理保留。app先canKick，再以真room.host呼叫原engine，不偽造或交換host。

metadata只對解析過的videoId查固定oEmbed，拒redirect、有界timeout／bytes／cache／pending；await後重查session／disabled、原room物件與canonical seat／kicked，再由media.act再次驗revision／session／ACL。requestId對有效payload fingerprint去重，不修改已送body；不把自報title當可信歌曲名稱。接管後舊music／watch POST均409 MEDIA_API_REQUIRED，GET投影同一current；新版GameShell只mount TableMedia，不並行舊player或SSE。schema15及既有音樂格式保留，queue／角色不是冷移轉或房間續局資料。

GET只有成功才標marker已取；首取＋2次、1秒／4秒門檻由既有game update驅動，不加網路timer。永久4xx停止（408／429除外）；明確重開／新marker重置，關窗取消該GET，room／seat／instance切換清generation。old GET失敗不能改較新ACK／預算。playerEpoch＋currentKey隔離舊Audio.play／YouTube回覆，個人關閉不能因idle→下一片重新開窗；拖曳凍結revision／完整集合，drop失配要求重拖。paused／本機提早seek到終點／未知或超限影片時長不得送共享ended，必須仍有權且playing、有效時長及共享anchor接近結束。

最後CSS驗收修正range的UA margin／box-sizing造成2px外寬，primary clientWidth／scrollWidth451一致；narrow body改自然block與單一scroll，primary／library min-height:auto及12px間隔，避免固定grid列縮小後內容重疊。最後source已重驗390×844無水平溢出、1280×720 window900×620在viewport内；本批200%文字未真正測，不可只由最小player契約推論通過。

正式tag／來源`56875616c9367a25dd369c175c2b949f7861de9c`：Windows／Linux完整各1034、隔離三席Chrome真Audio／YouTube、排序／個人選擇／角色及五款入口通過；原focused88與VM34維持各自scope。台北10:24:21公開6資源／API三會員與資料保存通過，PID107492／services active。schema15／21schemas／20非session rows＋BLOB／8帳戶全欄位相同；sessions157→161已登出，不宣稱session逐列相同。no新PR／push、PR43不混入，後續文件不改tag。真正Google拒播／oEmbed成功、多設備／弱網／喇叭及200%文字未驗；fixture repeated navigation的draw重連提示可能受proxy未取消舊upstream SSE影響，不作正式bug診斷。完整source／備份／scope見 [進度](../UNIFIED-ROOM-MEDIA-PROGRESS.md)與 [spec](../specs/UNIFIED-ROOM-MEDIA.md)，下方v1.7.2與舊控制者／select重播描述為歷史。

2026-10-07 PR43新P2已修／正式v1.7.2：ExpressionSounds controller持有serverAnchor／serverAnchorAt，本機performance非負elapsed推進eventNow；incoming只超前projected才改anchor，old/equal/missing不重設receipt年齡。poll gap用同elapsed；reset/context清serveranchor，hidden/pagehide/gap保留silent baseline与seen。原PR v1.4.2兩平台815、正式兩平台947，t6ACK→t7舊t0播放0／fresh1 Chrome替身通過；21schema／20非sessionrows／BLOB及8帳戶保留。fallback仅稳定wall兼容，未有serveranchor或无performance时不宣称walljump免疫。詳 [修正／證據／限制](../PR43-EXPRESSION-CLOCK-FIX.md)。不用只Math.max固定timestamp而不算elapsed，也不要把clock修正当成已实现作画优化。

2026-10-07繪圖研究（基線v1.7.1／3d82e3f，未改產品）：區分本機input→paint、湊批／queue、SSE→viewer paint。40點才flush或pointerup，25點持筆真雙席0POST；活動長筆真renderer計數1000點499,501 lineTo，不等於CPU毫秒；單in-flight POST被ACK卡住，人工回覆多延400ms／8點queue3,314ms。先有界時間flush＋同stroke未送點合併，再一幀一次preview與活動層；不可任意並行POST、修改已送batchId內容、削去epoch／quota／fill／snapshot防護。8點兩席digest差仍未解，後續空mask跨換輪不能證明吻合。已與研究agent核對方法／限制，來源與具體驗收見 [對照](../research/GARTIC-BGA-DRAWING-COMPARISON.md)、[規格](../specs/DRAWING-SMOOTHNESS.md)。Fabric可借活動層，WBO採獨立實作，採用前重查授權；不是Gartic內部原碼。

2026-10-07正式v1.7.1／`3d82e3f`：social ACK走RoomHost.acceptSnapshot→目前game callback，不能只更新被隱藏的GameShell角色列；race receive same-version更新snapshot／renderCrews，保留track、movement及dice。RoomHost.isStaleSnapshot共用較低version／same-context-version較舊finite serverNow判斷，五game入口重用，避免舊GET在ACK後把圖蓋回；higher version優先，沒有加網路traffic。原faker GIF隔離真UI、正式五款雙席及两平台各940已驗，詳 [表情驗收](../CHARACTER-EXPRESSION-SWITCH-PROGRESS.md)。角色表情仍5秒臨時，重送同GIF動畫起點沒有改；全部phase或真人弱網未實玩。下方v1.7.0為歷史。

2026-10-07正式v1.7.0／`82149a4`：TableWatch右下把手及keyboard縮放，size key獨立、舊position key格式保留；viewport暫時clamp不寫偏好，reset移除size。尺寸計算量測header／status／footer／首local button，加210pxplayer餘量；header flex basis160允許工具換行，watch-narrow依窗寬850切換。RO觀察chrome／player、經rAF合併，close釋放capture及frame；CSS高度上限與JS都扣16px。正常resize不重建iframe或呼叫player／watchAPI，權限不變。Windows／Linux各914；公开2會員實播及320／200%／雙欄通過，詳 [尺寸验收](../YOUTUBE-WINDOW-RESIZE-PROGRESS.md)。驗identity以保留Runtime物件與當前iframe嚴格相等，重取DOM frontend ID可能變，不能據此推斷churn。下方v1.6.0為歷史。

2026-10-07正式v1.6.0／`74372ed`：歌庫本來全會員共用，本輪將room-music的select開放同房有效座位；其他transport仍host，auth／leave／kick／rate60／SSE沿用。TableMusic picker所有人可選、guest開始以select當前track重播；每次open明確GET歌庫、request sequence＋roomEpoch擋晚回覆，沒有新增歌庫poll。Windows／Linux各896、Chrome會員上傳→另非房主選播／個人mute／同曲重播、公開兩會員Audio readyState4且時間前進已驗。schema15／8帳戶保留，詳細範圍與來源見 [共用歌曲驗收](../MUSIC-SHARING-PROGRESS.md)。下方v1.5.8及舊僅房主選曲描述為歷史，YouTube控權不隨本次開放。

2026-10-07正式v1.5.8／`470ab26`：角色主圖及固定／自訂表情提高4MiB；保留共用MAX_BYTES=1MiB，imageOf／imageForRequest可信options只由三個角色呼叫端傳4MiB，不能從payload取限制。app只有三圖片POST路由的JSON cap提高至5,600,600；collection.readImage預設1，角色分支傳4。其他圖片、legacy頭像、音效、ACL與count不變。Windows／Linux各889、隔離Chrome三表單及正式4MiB三路由／+1不覆蓋、12MiB角色组加密備份還原已驗；schema15／8帳戶保留，詳細邊界及未驗範圍見 [圖片上限驗收](../CHARACTER-IMAGE-SIZE-PROGRESS.md)。下方v1.5.7為歷史。

2026-10-07姓名修正已正式v1.5.7／`4c5b5e7`：Windows／Linux各883，五款本機姓名欄及八席等卡／手機／200%已驗；公開30資源與3席等卡、16字位移及hover／reduce通過，暱稱與測試席位清理後8帳戶全欄位相同。角色卡尺寸由各頁格線管理，姓名用共用單份text／title，suffix在外；動態不新增poll。下段候選描述仍有效，完整證據及未驗範圍見 [正式姓名驗收](../DRAW-PLAYER-NAME-PROGRESS.md)。

2026-10-07候選v1.5.7：姓名用GameUI.playerName單文字／escaped原生title，超出實際slot才transform；自己／AI後綴在外。RO＋MO單rAF讀寫、同值不寫，hover／focus暫停，MotionPolicy／reduce／hidden停止，移除及BFCache清理。GameShell四款／通用角色及雷霆車隊重用；畫猜名單／排名卡用格線等尺寸，保留全部玩家及分數、56×64結算頭像。12元件＋整合回歸，Windows883及五款背景UI通過，詳細契約、尺寸及正式狀態見 [姓名驗收](../DRAW-PLAYER-NAME-PROGRESS.md)。

2026-10-07已正式v1.5.6／`5941c03`：Windows／Linux各867、公開3席多尺寸／26資源通過。設計師指出不可fit縮到0px的風險由guard修正，125%自然流及恢復已驗；大字／手機不承諾單屏，完整名單／排名不能裁掉。下一段候選描述仍有效，完成證據與限制見 [正式驗收](../DRAW-VIEWPORT-FIT-PROGRESS.md)。

2026-10-07畫猜候選v1.5.6：shell flex及layout剩餘列共同管理高度，玩家/main同列stretch，chat伸展、feed局部scroll、輸入最後。Canvas只改CSS width，backing512×256不改，倒數共用width；ResizeObserver量實際overhead／tools、合併rAF、相同值不寫style，不追加poll。≥1200／680正常字級採fit，手機／大字自然流；工具／聊天室最低高度或240×120canvas放不下就退出fit，budget仍用viewport＋main文件座標避免震盪；125%字級已驗。8席短屏保留完整名單/排名並局部scroll。設計師獨立review及驗收見 [進度](../DRAW-VIEWPORT-FIT-PROGRESS.md)。

2026-10-07正式v1.5.5／`18d21ae`：共用opt-in ui-timebar負責軌道樣式與urgent色，caller沿用server deadline／clockOffset計算value。避免在頻繁更新的原生progress-value做width transition；本機背景Chrome已重現DOM值更新但繪製滿格的滯後，停用後像素與native比例對得上。畫猜將倒數移到畫布欄上方，保留工具／畫布上緣及512×256原生尺寸；drawing hint空且hidden、等待分類保留。小螢幕放大時countdown分行，聊天grid用minmax(0,1fr)避免min-content撐寬。雙平台各864、正式26資源／3席已驗；跨平台字型與其他瀏覽器不可沿用為已驗。詳 [倒數發布](../DRAW-TIMER-VISIBILITY-PROGRESS.md)，下方v1.5.3為共用元件導入歷史。

2026-10-07正式v1.5.3／`0609c01`：以下共用UI契約已實作；背景逐頁發現history宣告header span margin-left:auto算出18px，neutral wrapper reset後中心從+9歸0。Windows／Linux各863、正式3席題卡與25份資源驗畢，8帳戶及schema15保留；原PR43範圍不變。以 [最新UI驗收](../SHARED-UI-ALIGNMENT-PROGRESS.md)及其明列未驗界線為準，後續修改先查registry與共同槽的全部呼叫端。

2026-10-07共用UI契約：全站primitives與GameUI registry／symbol／decorateButton是圖示、單字元及操作槽的共同來源，20HTML共用載入，foundation只保留遊戲tokens及布局。Grid的place-items只處理格內，整組置中还需place-content；正面多區資訊卡保留space-between。wrapper内部margin／padding重設防歷史header span等泛用選擇器污染，外部間距交parent gap；資訊D保留21px、互動按鈕44px，hidden與pending可測。與程式角色的實際攻防、逐頁盤點及未驗邊界見 [規格](../specs/SHARED-UI-ALIGNMENT.md)，程式／背景Chrome／發布事實見 [進度](../SHARED-UI-ALIGNMENT-PROGRESS.md)，未全面玩法／跨平台字形不宣稱驗畢。

2026-10-07正式v1.5.2／`7939090`：race-paths依每步前一格判定跳台進入方向，側面／前方風險1000、提示會淘汰；實際飛躍峽谷同長安全分支驗證存活，已揭露陷阱與起跑規則保留、未揭露內容不洩漏。expression-sounds用回應serverNow判事件新鮮度，本機時間只判連線間隔，game-shell及lobby兩處傳入；五款房間及大廳回應同步補clock。±2／6／60秒、legacy、去重／mute／hidden／reconnect有回歸，沒有新增輪詢。原PR43修正雙平台808並Ready；最新正式分支雙平台863、公開資源與serverNow已驗，保留後續畫猜及移轉相容性、8帳戶，未合併原PR。證據見 [修正與同步](../PR43-PRODUCTION-FIX-PROGRESS.md)，下方v1.5.1為版面導入歷史。

2026-10-07正式v1.5.1／`d4e3b4a`：畫猜phase row跨欄、左側常駐玩家、中央畫布＋直列聊天室（input最後）、右側共用操作。工具160px軌與畫布上緣對齊；timer沿用server deadline／clockOffset，以15s選題、options.seconds作畫、8s揭曉計算進度，不因presence poll重置，字型沿用UI＋tabular digits。猜對僅卡片高亮／勾號與chat非答案訊息，右側只保留重要例外。結算按內容高度且顯示最後一幅畫，preview job綁resultId及實際canvas node避免舊回覆畫到新場景。Windows／Linux各845、Chrome不同角色及手機／八席通過；正式schema15、8帳戶保留，無外站匯入／新PR／push。證據及限制見 [完整進度](../DRAW-DESKTOP-LAYOUT-PROGRESS.md)，下列正式1.3敘述為歷史。

2026-10-06 最新整合：候選 **v1.4.0**、[PR #43](https://github.com/stanley021039/BGA/pull/43) 已建立，受測程式及本地tag為 `bdd77d146ef8f207c8d94c06390aefd2a857d986`。Windows／Linux完整各 **790/790**、schema15兩種舊14布局及完整移轉回歸通過；既有帳戶／音效／市場資料保留。已接main `b744464`，後續只含README／驗收文件，執行程式未變。正式仍v1.3.0，排版及整合候選尚未切換；先前PR及測試數字保留為歷史，送審狀態以PR頁及下方最新整批進度為準。

本輪 source、schema 相容性、測試及送審狀態見 [整批 PR 進度](../PARTY-PR-INTEGRATION-PROGRESS.md)。

2026-10-06正式 **v1.3.0**：畫猜本人猜中／畫者輪次及雷霆骰聲／shot／slam／nitro／skid已接共用事件音效。Windows Node24.14.0 **761/761**（25286ms）、Linux Node22.22.1 **761/761**（130827ms），失敗／取消／跳過均0。受測程式 `4732450fe44d2640ecaf961cf2d8dee9d8bd5e95` 與本地 annotated tag `v1.3.0`，正式 current `releases/4732450`；零房間切換，PID50471→52510，service／tunnel active。schema14不變、integrity ok、外鍵錯誤0，原7帳戶全欄位保留；預演副本16張既有表逐列一致。匿名no-store版號、既有session、7份HTML、24份資源（含7WAV的精確bytes及MIME）一致，背景Chrome設定顯示「版本 v1.3.0」。7短音（2Kenney CC0改作＋5固定seed原創）、兩個新聲音模組、遊戲2／總4段上限及1秒載入timeout已驗；Chromeplaying／清理／靜音及所有限制見 [音效實證](../GAME-SOUNDS-PROGRESS.md)。第二批遊戲候選仍為規格，沒有真人聽感／喇叭測試；無新PR／push，純驗收文件不移動tag。

2026-10-06正式 v1.2.0：角色既有非neutral自訂表情可POST canonical base64音效／remove，作者控制；browser用OfflineAudioContext decode並轉24kmonoPCM16WAV，server按真sample數驗≤240000／480044bytes，不信duration宣稱。schema14 FK保存；gallery.sound只有url/duration，發送時綁bytes hash與actualaudience grants。共用ExpressionSounds新事件一次、baseline／hidden／reconnect不補播，AudioSettings effects統一音量／mute／4段cap，load10s與play≤10s分開deadline，lateplay不再啟timer。profile save晚回覆需綁selection generation，不能覆寫新角色並鎖住soundPending。Windows Node24.14.0 **727/727**（24185ms）、Linux Node22.22.1 **727/727**（125824ms），失敗／取消／跳過均0。ChromeWAV11秒拒／10秒保存及1秒trialstop，房／大廳一次GET、mute0。受測程式 `9b1fdd4148ea9e1ceec5215f8ca112ffd99cd893` 與本地 annotated tag `v1.2.0`；正式 current `releases/9b1fdd4`，零房間切換，PID 48811→50471，service／tunnel active。正式 schema14、integrity ok、外鍵錯誤0，原7帳戶全欄位完整保留；預演時15張既有表逐列一致，只新增空 `character_sounds` 第16表。匿名 no-store 版本API、既有session、7份HTML及14份資源比對通過，背景Chrome設定顯示「版本 v1.2.0」。詳 [音效契約與實證](../CHARACTER-ASSET-TEMPLATE.md)。

2026-10-06正式 v1.1.4：PR #36 `d4020ef`修GET失敗同marker永久失同步及HTTP缺randomUUID。每instance/revision最多3次，1s／4s門檻只由既有update觸發；其他4xx終止、初始無marker亦可恢復，snapshot追上目前marker不再取舊pending。force手勢可重啟budget，close/generation隔離舊回覆；成功穩態零新增watch GET。UUID用原生或getRandomValues v4，缺安全源可控提示，uncertainretry復用原body/ID。新增38回歸，PR來源雙平台552、正式整合雙平台663；Chrome非loopback HTTP真實缺randomUUID仍POST200，加入實播後暫停／停止各503→200同revision恢復。正式受測93ba350／本地v1.1.4 tag，零房間切換；current releases/93ba350，7帳戶／schema13／公開版本與8資源已驗。#34本次雙平台442及Chrome四輪回看收藏禁題均驗，另一端已merge main1447430。本段不授權或宣稱本任務合併。詳 [共看進度](../YOUTUBE-WATCH-PROGRESS.md)。

2026-10-06正式 v1.1.3：Thunder `event()`最後寫入`afterMotion`，extra不可覆寫；car／target捕捉當下公開x／y，顯式x／y保留。公開events由12增至64筆，玻璃在下一forced move前記checkpoint；嵌入教學引擎同步。前端一般checkpoint1600ms／道路3200ms，同checkpoint批次文字、位移FX由`onMove`觸發；presence不隱藏／不延長事件，event-onlyhold及skip只控制事件停留，不跳位移／dice。完成後才開下一步，鎖動作但poll／roster／chat繼續；hidden／reduced／停用／重連不補播。引擎逐格drain及原地形／碰撞優先順序不改，dice／pending丟棄舊route，accept後需重選。事件payload增加，但不新增HTTP、伺服器timer或DB；客戶端排程只延遲呈現。Windows／Linux各625/625；背景Chrome火焰、玻璃→地雷→打滑及油漬→跳台已驗。正式受測22a9d6f／本地v1.1.3 tag，current releases/22a9d6f，schema13／15表副本／7帳戶完整保留，公開版本與7資源一致。詳 [進度](../RACE-MULTI-MOVE-PROGRESS.md)。

2026-10-06 v1.1.2正式，已更新shhuang.cc：ThunderRoom公開motions journal為`[{id,kind,moves:[{car或player,from,to}]}]`，64groups／128transfers完整group淘汰，serial跨start單調；view深拷貝，只含公開身份與座標，不加HTTP、伺服器timer、log或額外version增量。moveEffect統一記錄玻璃／油漬／slam／jump／blast／skid／dazed等實際段落，出界／終點earlyreturn前記attempt；quake一次同group並排除preplaced重記，airplace記入口或真舊點。race.html教學引擎已同步。前端每格240ms依序、quake並行、jump／blast弧線、dead ghost／終點landing／chopper及480ms road pan；等待位移再開dice／controls／winner／教學，鎖動作但不阻斷poll／roster／chat。hidden／reduced／停用／重連跳過舊journal；不能因dead或attempt末點不同於權威car座標丟棄確認位移。取代v1.1.1的末點推算及不鎖操作限制。Windows／Linux591/591通過，11項真引擎回歸及控制器／render順序／延後骰子回歸已驗；主agent背景Chrome確認碰撞／推移／玻璃／六車地震出界／道路換片／終點；跳躍、拋飛、直升機仍以回歸驗證。正式API／資源／設定與7帳戶已核對。詳 [最新正式進度](../RACE-MULTI-MOVE-PROGRESS.md)。

2026-10-06 v1.1.1修正雷霆逐格動畫：共用race-movement控制器只演確認步驟、每格240ms，保留elapsed跨SVG重建，排接連續指令。新靜態檔必須同時接race.html及app白名單；快照深複製cars，避免教學引擎原物件變更令差異判斷失效。6項控制器回歸、Windows／Linux各554項及背景Chrome證據見 [移動進度](../RACE-MULTI-MOVE-PROGRESS.md)。程式2eb4104／本地annotated v1.1.1已更新shhuang.cc，正式API／資源／設定及7帳戶核對完成，無新PR／push。v1.1.0 tag不移動，後續純驗收文件不改tag。

## 版號規則（2026-10-06）

新功能必須升minor、相容修正升patch、不相容契約升major，純文件不升。唯一来源package.version；匿名/api/version僅回版號且no-store。共用設定首次開啟讀取，成功後同頁不再請求；沒有新poll。`release:bump`同步package／lock／CHANGELOG，`release:check --base <正式版ref> --type minor`阻止忘記打版或幅度不足；npm test自動基本check。工具不自動commit／tag／push／部署，正式tag不可覆寫；本批候選1.1.0與最新驗收見 [版本進度](../RELEASE-PROGRESS.md)，規範見 [打版規範](../RELEASE-POLICY.md)。下列較早部署狀態依最新驗收文件為準。

## U33：改名、擴題與路徑（2026-10-05）

`POST /api/profile/name`只改持久display_name，同步現有五款座位及大廳；username／UUID／session／歷史結果保留。使用Unicode code point驗1–16字，create／join不可再次UTF-16截斷合法emoji；header／大廳回焦點讀最新本人，序號隔離晚回覆，不加帳戶timer。共看只刷新既有revision，不改時間錨點／控權。

`public/shared/race-paths.js`讓Node及瀏覽器只用masked地形共同規劃；遠目標只送car/version/x/y，server重算逐步drain，任何揭露／dice／位置意外／道路切換就丟掉後續，不能acceptDice後自動續跑。原move逐格照常。限制16點／3000狀態；hover不送請求；靜態route白名單及教學引擎副本一致性要保留。

內建draw1000／meme100（50模板、50原創情境），原120ID不重排；gift350，成人50另組、includeAdult預設false且同步過濾投稿，原300ID不改。以上無新schema；框收藏方案將需要成熟PNG解碼器、schema／受眾／移轉驗證，尚未實作。來源、Chrome觀察及最新整合測試见 [本批進度](../PARTY-UPGRADE-PROGRESS.md)。U29共看已依新授權發PR#36；本批六項仍本地未PR／部署。

2026-10-06 PR #36 合併準備：整合最新 main `9dd6282`（含 #38），靜態資源衝突保留 YouTube 與 market 路由及 market 登入返回路徑；記憶保留雙方決策，重複編號以 U29-market 區分。Windows Node 26.2.0 完整 573/573 通過，失敗／取消／跳過 0。本輪未重跑 Linux 或瀏覽器；使用者已明確授權推送與合併 main，未部署。

## 2026-10-06：PR #36 共看失聯與 HTTP 安全亂數

`table-watch.js` 的 failed marker 不能記成永遠已取得。新契約以同 instance／revision 的首取加兩次 update-driven retry，失敗後 1 秒／4 秒門檻、無新增網路 timer；成功同 marker 不發 GET。4xx（408／429 除外）立即停自動重試，明確 open／join／rejoin 可再啟動。cleanup 清預算與 pending，舊 task 的失敗／finally 不能消耗新 task 額度；飛行中接到較新 marker 必須合併追最新。無 watch marker 的首次開窗 GET 失敗也需由既有遊戲 update 恢復。

UUID 優先原生 `crypto.randomUUID`，HTTP 非 loopback 缺少時使用 `getRandomValues` 的 UUID v4 fallback；不降級到 `Math.random`。安全亂數不存在或拋錯需在 async command 內可控回報，不能在 try 外失敗。uncertain retry 先比對同操作／instance 並復用舊 body，不先產生新 UUID；HTTP 拒絕後才建立新操作 ID。Windows 真模組 VM **90/90** 通過；本次 Linux／真瀏覽器／發布由父任務另驗，細節見 [共看進度](../YOUTUBE-WATCH-PROGRESS.md#2026-10-06pr-36-審查修正回歸階段紀錄)。

## 最新：YouTube 共看（2026-10-05）

U32 後續 `400cb6d`：使用者要求非房主隱藏「在這裡開始播放」。初始 hidden、render 依 snapshot.isHost 決定，handler 也核對身分；不能用 canControl 代替房主判斷。自動播放阻擋／對齊提示按角色提供可見入口。Windows 前端52項及原 Chrome 兩帳號可見性／實播驗收通過；本增量沒有重跑Linux／全套，未push／PR／部署。

已本地實作 `631eabf`、U29／U30，未push／PR／部署。`RoomWatch`僅在明確操作改anchor，用既有game state的watch marker通知；閉窗零watch請求，開窗穩態無輪詢／回報。native callbacks只更新本機，requestId去重及instance／session／revision／controllerEpoch隔離舊操作；GET衝突回覆要合併，不能每個game poll重抓失敗marker。初始paused必須cue→pause，unstarted的seek可能自行播放。

TableMusic與TableWatch同媒體入口，加入影片只在本機suspend音樂。非modal浮窗拖曳頂端toolbar，buttons及nested SVG不能起drag；方向鍵位置、preferred與clamped分開，viewport／控制展開不覆寫偏好，關閉釋放pointer capture且晚GET不返焦隱藏按鈕。位置／個人關閉不POST。前端52、後端18、音訊11項，Windows／Linux完整各503項；實播62秒零新增watch請求，詳 [驗收／限制](../YOUTUBE-WATCH-PROGRESS.md)。

使用者因暫留720p模擬看到頁面只在左上；已逐tab清除metrics並驗normal viewport。官方browser viewport capability reset只還原當次目標，不可假設所有owned tabs都還原；每一尺寸測完即reset並DOM查核。測試截圖只證明當次尺寸，不能把fake DOM rect當實際CSS證據。

## 2026-10-06：PR #34 最新提交雙平台複驗

固定來源 `3dde6a4` 包含 main `b843a3f`；Windows Node 24.14.0 與隔離 Linux Node 22.22.1 完整各 **442/442** 通過，失敗／取消／跳過皆 0。鎖程式、移轉及 11 項鎖回歸與 main 完全一致，對 main 的 77 個變更檔未帶入 PR #36 或後續六項功能。Linux 僅展開乾淨 archive 執行測試，未操作正式資料、服務或 current；package 仍為本 PR 的 1.0.0，不能混稱另一開發分支已部署的 v1.1.3。父任務背景Chrome一席UI配合四合成帳戶API已走完四輪，跨輪及完局回看第一輪、收藏及3/4禁題均通過；沒有宣稱多人真機／弱網或GPU驗收。證據與來源 SHA 見 [整合驗證](../PR34-MAIN-INTEGRATION.md#2026-10-06最新整合提交複驗)。本段取代下方「本次無 Linux 證據」的現況，沒有核准／合併／部署。

## 2026-10-06：PR #34 整合 main

原 head `585eb63` 接上 main `b843a3f`，保留 #31 鎖修正、新版 AGENTS 及 #34 回看／收藏／禁題／動效。程式檔無文字衝突，本轮未修改功能邏輯；三份角色記憶檔首保留兩方新增內容。Windows Node 26.2.0 完整 **442/442** 與隔離 HTTP 四輪流程通過，前端測試是 VM harness；本次無真正 browser／Linux 證據。版本、驗收腳本時序限制及複審入口見 [整合驗證](../PR34-MAIN-INTEGRATION.md)，PR 維持 Draft，未核准／合併／部署。

## 2026-10-05：PR #31 鎖競態修正

`0682e43`：`src/data/locks.js` 的資料／發布／legacy PID 鎖只以 `wx` 取得，既有檔一律 `DATA_IN_USE`，不讀 PID 或刪舊鎖。`HistoryStore` 共用 legacy 取得函式；release 冪等，舊實例重複 close 不會刪掉同程序後來取得的鎖。讀取比對後 unlink 不能安全回收另一程序的 stale lock，不能以多一次比對或同步函式當跨程序修復。

`tests/data-locks.test.js`／`helpers/data-lock-worker.cjs` 用兩個 OS 程序在舊 unlink 前加屏障，重現共用 DB、其他目錄不同時仍雙重取得鎖；發布／legacy／HistoryStore 也重現。修後11項回歸及 Windows 完整374項通過。新版 writer 不可與仍自動回收 stale lock 的舊 writer 混跑；人工清理只在全部 writer 停止後進行，詳 [證據及限制](../SERVER-DATA-TRANSFER-PROGRESS.md#pr-31殘留鎖競態修正)。本次沒有 Linux、真實資料夾 chooser 或整合後多人實玩證據。

## 2cf8a44：畫猜過半禁題

2026-10-05 U28 已實作。`publicResults` entry 的 mutable ballot 與 immutable snapshot 分開；揭曉時固定 active 席位，含畫者及暫時離線者。`POST /api/draw/result/ban` 依 resultId 投一票，state 另帶 resultVotes；跨輪八份快照仍可補投，未公開／淘汰／晚加入／踢出不可投。最後一票先 DB transaction 成功才接受；503 可重試，不先發成功事件。

DrawWordStore 以題目 ID 或 normalized title 排除，內建列表、共編列表、後續候選與舊候選選取都要套用，空池安全結束。跨房禁題不一定增加本房 version，前端不可只依版本或快照 ID cache；同版本已知 banned 不因舊 poll 倒退。前端 pending、generation、跨輪 ACK 及獨立收藏狀態已測。

揭曉與結束側欄要讓工具列參與自然高度，不能溢出覆蓋玩家卡；新增投票只改 reveal 排版，原猜題作畫 canvas 規則保留。Windows／Linux 各431項及 Chrome 背景驗收見 [禁題進度](../DRAW-WORD-BAN-PROGRESS.md)，未部署；schema 13 及移轉規則與 SERVER-DATA 同步。

更新：2026-10-05；角色文件是可更新的專案知識，不授權對正式服務操作。

## 93d7a84：公開結果與共用動效

2026-10-05 已實作，取代本批以前的 PL-01／PL-02 提案狀態。DrawGuessRoom 的 `publicResults`、`roundStartScores` 為 non-enumerable Map，最多八份凍結結果＋畫布，view 僅 metadata；收藏依 user/resultId 去重，不能再取 live canvas。當輪基準收錄所有保留座位，避免復座者重算舊分；early finish 不自動公開秘密。完整權限、配額與 PNG 客端信任邊界見 [契約與驗收](../DRAW-REVIEW-MOTION-PROGRESS.md)。這不是 persistent match ledger，尚不支援新勝場統計。

`MotionPolicy` 的同版本 snapshot 仍更新 live heartbeat（social 不一定加 game version），但首次／重連／visibility 恢復先建基準；seen／Animation／lane 必須有界。BFCache persisted pagehide 只暫停、重建基準及 preview，不能永久 dispose gate；離頁清 renderer 時也要清對應 job 指標。新 DrawResults generation/selection 隔離晚到載入，獨立 encoder 保存固定 snapshot，關 dialog 不取消已送出的收藏。Windows／Linux 各402項＋Chrome背景驗收，細節及未測限制見同一進度文件。

## 責任與接手入口

此角色負責API/state、server權威／身份／同步、功能模組邊界、資料與效果的時序、可測性。先讀root AGENTS與角色索引，再按任務讀檔；與玩家agent確認遊戲規則／判定，與美術agent協商資訊階層和原創圖示，與server/data agent確認持久化及切換。

最近規格：[YouTube共看](../specs/SHARED-YOUTUBE-PLAYER.md)、[多環境資料](../specs/MULTI-ENV-DATA-MIGRATION.md)、[成就與戰績](../specs/ACHIEVEMENTS-AND-RECORDS.md)。YouTube共看已實作且隨前輪發布；成就擴充仍為提案。多環境資料的完整備份還原子集已實作，尚未把其他站資料切入本站，見 [工具](../SERVER-DATA-TRANSFER.md)。本輪schema15相容合併正在驗證。

## 已確認架構

- `src/app.js`建立rooms、seats與music/social maps。users UUID、room seat UUID、6位room code是三種身份；永久結果用match UUID／result unit，不能從名字回推canonical user。
- `src/db/index.js`Node DatabaseSync、WAL、同步BEGIN IMMEDIATE migration／transaction，本輪候選schema上限15，正式v1.3.0仍為音效版14；相容布局見SERVER-DATA檔首與移轉指南。async repository升級要重設transaction契約。
- 遊戲state由server裁決；client report是非權威。重送API靠requestId／revision／epoch與永久結果ledger，不只client busy或WeakSet。
- ~~`src/history/store.js`記before/trace/after…~~ 2026-10-25 #267（v3.0.0）整個移除；`transitions.transact` 只執行操作並通知，不再寫記錄，記錄容量不得再擋遊戲。
- 成就以玩家spec的server證據判定，不從UI文字／瞬時events判定：poker每個sidepot需winnerIds/refund/tie；race維修僅己方。骰運候選採本人4顆原始移動骰全1的accepted round metric，加上有效manual turn與正常完賽；相同結果重擲候選已否決，不能誘導為成就額外重擲。首次權威finalize凍結winner/participants，rules_completed與timeout等quality_flags分離。
- `public/race.html`內嵌thunder＋tutorial engine副本，修改引擎必須同步並驗embedded source一致。教學不開正式輪詢，非同步規則需bridge timer與換章cleanup。
- `RaceVehicleEffects.mount().show(events,state,{min})`只增SVG effects，不覆蓋外層位置或.race-car-moving；相同事件去重、重繪負delay、hidden cleanup、減少動態。它是已存在模組，新共看不能把這些effects覆蓋iframe。

## 設計與實作慣例

桌機1280×720优先，正文16／次要14、44px操作；保留玩家/角色/骰/剩車常駐，次要內容局部scroll或details。同功能走shared contract，不重複搬DOM猜selector。SVG圖示24 viewBox、stroke1.8/currentColor、round cap/join；原創生成器保存source/provenance、減動靜態、單次按需動畫。

程式/native向量足夠時可用Node內建fs/path/crypto手刻原創SVG與CSS動畫；不是聲稱自己畫了第三方素材。隔離原型[生成器](../../tools/prototypes/generate-motion-art.cjs)與[展示](../prototypes/motion-art.html)，只研究、不被app route引用。沒有適合素材時先確認圖意與可辨識性，不為湊圖下載不明授權資產。

## YouTube最關鍵接手事項

控制者是被選影片的提案者，房主可明確takeover。每位房員自行加入／手勢允許；聲音／全螢幕為個人偏好。使用官方IFrame，保留原生品牌/ads/controls，不能隱藏背景播放或遮擋。既有same-origin Referrer-Policy可能造成153，需按spec驗真實embed request。server anchor+clock samples+revision/epoch是時間權威，不承諾frame-perfect；廣告／buffer／autoplay失敗不可誤回推全桌。

## 必要驗證／交接

驗可判定行為與失敗分支，fake clock／多帳號權限／重送／重連／背景／cleanup，接著隔離UI流程。不新增只比字串的形式測試取代真節點/狀態；不要未驗就宣称視覺完成。明確報 source commit、測試範圍／限制／未完成。2026-10-05研究批次只寫spec與孤立原型；後續使用者已另要求實作畫猜房間修正，依最新範圍執行，不能把研究批次的限制當永久禁令。

## 畫猜房間設定接手補充

2026-10-05修正：新客戶端用非空且不重複的 `options.topics` 多類別清單，八個內建題材加 `custom`；勾選 `custom` 納入全部投稿，獨立於投稿原有的題材標籤。新UI以類別選擇代替投稿比例；舊API及歷史房間仍保留 `topic/customPercent` 原規則。空選擇拒絕，只有自定義且沒有題目不能啟動空輪。

waiting舞台顯示完整玩家角色卡；開局切回原本常駐比分名單。入座／離席用局部更新，保留房主未儲存設定草稿，同時更新開始按鈕；host移交仍需重建權限。共用foundation可能覆蓋遊戲樣式，尺寸必須量實際computed layout，不能僅憑CSS文字。驗收與版本见 [房間修正進度](../DRAW-ROOM-SETUP-PROGRESS.md)。

## 猜題者畫布排版

2026-10-05，基線 `5d1776f` 的本地後續修正：1280×720 猜題者畫布外框 854×427，原本置中於固定高 366 的 board，向上蓋住標題／題材字數／倒數，向下壓到玩家名單。使用者 U23 明確選擇維持畫布大小並隱藏該列；`public/draw.css` 以 `.is-drawing:has(.tools[hidden])` 限定猜題狀態，隱藏 `.board-head`，board 改自然高度，桌機列距 12px。不要改成縮小畫布，也不要靠提高 z-index 疊回提示。遊戲說明同步改為看畫布猜答案。

兩個隔離帳號、隱藏內建瀏覽器驗收：1280×720 外框仍 854×427，玩家名單 y634–705，頁面 scrollHeight 720；1920×1080 外框 1174×587，無頁面捲動；390×844 正常垂直排列、無水平溢出，手機仍需捲動。畫者標題與畫具保留；自然換至選題後資訊列恢復。證據只存 ignored `work/draw-guesser-before.png`、`draw-guesser-after.png`、`draw-guesser-layout-results.json`。本次只修版面與說明，未部署、未更新 PR，未重跑遊戲引擎測試或完成多人完整遊戲。

2026-10-05 送審整合補充：上述 CSS 修正 `22d02c3` 已保留於接續分支；`cc02b56` 接上 PR #30 時 tree 完全不變。最新程式 `6e655de` 另補移轉舊 schema 相容性，完整 Windows／Linux 各335項通過；PR 四項回覆經獨立65項回歸複查。此筆取代上段「未更新 PR」的後续追蹤入口，實際 PR 與驗收狀態見 [最新進度](../SERVER-DATA-TRANSFER-PROGRESS.md#送審前最終複查)，未部署。

## 共用聲音接手補充

2026-10-05、來源 `2e8dc4d`：`AudioSettings.get/set/subscribe/playEffect/stopEffects/bindPreview`集中個人music/effects偏好與音效生命週期。所有頁面先載入模組，靜態路由白名單也要更新。不要再加入遊戲自己的sound flag、volume或下方控制；右上角site-header設定是共用入口。

`ah-audio-settings` version 1是該瀏覽器／網站來源的個人偏好，storage同步其他頁，不是DB跨裝置設定。音樂transport仍由RoomMusic管理；TableMusic只套用個人音量／收聽，保存opt-in等可信手勢才能播放，拒播可恢復。靜音音效立即停止且不重播；隱藏／離頁釋放。音樂庫重繪需釋放bindPreview監聽，原生控制與共用偏好雙向同步。

Windows／Linux各239項通過；實際Chrome解碼／播放／個人暫停、五款設定一致與浮層邊界已驗。限制及證據見 [共用聲音進度](../SHARED-AUDIO-PROGRESS.md)，不要宣稱量測過實體喇叭或主觀聽感。

## 彈幕與設定接手補充

2026-10-05、來源 `15af1dd`：`GameShell.settingsActions()`統一畫猜／送禮／同頻的儲存按鈕及`#roomSettingsFeedback`，欄位與footer必須在同一設定容器；各遊戲保存handler把pending／success／error導向本區，不只側欄。保存重繪後返焦新按鈕。送禮／同頻busy同步須包含舞台內儲存按鈕，create／join的finally也要解除busy，否則剛開房的按鈕會持續disabled。

畫猜用`UIPopover.bindDetails`定位設定body，保存重繪前記open，重建後恢復；入座沿用局部更新保留草稿。空類別在同區報錯。八人1280×720及390×844已驗，送禮／同頻未改入座時表單重繪策略。共用彈幕保留依容器／文字寬計算路程與animationend清理，取消原地淡出分支；不用動畫完成事件推進遊戲規則。Windows／Linux各239項通過，三款背景Chrome保存／公開資源一致性及清理見 [本批進度](../BARRAGE-ROOM-SETTINGS-PROGRESS.md)。

2026-10-05後續卡頓檢查：使用者正在另一台電腦，明確表示控制端沒問題即可保留。來源仍15af1dd，未改正式程式。原Chrome八人畫猜基準／1則／8則／8則＋SSE筆畫同步各10秒，rAF中位7.7ms，作畫最長31ms，無>50ms longtask或LoAF；同時8次開始／结束，没有重播。追加時append→量寬仍有同步layout，但未證實為持續卡頓原因。rAF不是螢幕/GPU實際呈現FPS，不可因此判定別台是硬體問題；完整方法、原始證據及限制見 [效能檢查](../BARRAGE-PERFORMANCE-CHECK.md)。

## 完整資料移轉接手補充

2026-10-05、程式 `c831e87`：`src/data/transfer.js`＋validation／locks 提供加密完整包與新代 restore；AI 入口 `tools/server-data.cjs` 的 stdout 為一筆 JSON、error code／退出碼穩定，stderr 可含 Node experimental warning。帳戶原密碼、UUID、權限與 disabled 原樣保留；還原撤銷舊 token。config 新增 MUSIC_DIR 与严格 true／false 的 EXTERNAL_SIDE_EFFECTS_ENABLED（legacy 預設 true，restore 回傳 false）。SubmissionService 每個公開出站路徑都拒绝 false，不僅依賴沒有 GITHUB_TOKEN。

app constructor 在任何 DB migration／history／community 寫入之前取得資料鎖，app close 與 admin CLI 完成才釋放。restore 發布有 sibling lock 与 marker，未完成的 generation 不能啟動。SQLite schema 仍12；檢查 source 用 readOnly DatabaseSync，migration 只用副本。history 仍 schema1，工具接受額外 header/session 欄位，match header 已帶 setup/source，不要求其舊 session JSONL 永遠存在。

Windows／Linux 各255項（移轉16項），雙向跨 SQLite restore／登入／私有圖庫／音樂 Range 通過；详 [驗收](../SERVER-DATA-TRANSFER-PROGRESS.md)。沒有正式 migration／部署，merge、Postgres 与房間續局未實作；回退須旧 code＋data 一起，新代已寫入時不可直接丟掉新資料。

## PR #30 資源與畫布修正

2026-10-05：PR head `1b8c85d` 已推送，移轉分支backport `db9d0b6`。等待離席移除；進行中身份最多64且自行離席復座用同ID，踢出封鎖不繞過。HistoryStore session輪替及已完成／中斷紀錄淘汰有總量、單局、檔數與保留期；active match不可截斷湊空間。配額／I/O failure暂停時，離席及最後真人清房仍能執行，未完整保存不能回報已落盤；shared RoomApi呈現專用historyWarning。歷史schema仍1，完整header內嵌setup使舊session可回收。

Live StrokeCanvas.createRenderer保留前綴，最多16張／8MiB快取。fill每輪48、每秒2，undo/clear不返還，去重batch及累計point也不返還。HTTP ACK／SSE次序、reset、舊快照與換輪必須測race；optimistic fill最多一筆，brush採version／strokeId鍵，避免每event序列化全部points。Studio原redraw及24容差語意保持。兩平台各260項；原Chrome填色／復原／重連兩席hash一致，第49次429且brush可用。首次完整48fill重連仍約486–524ms，不能宣稱零停頓或推斷其他電腦硬體，詳 [修正證據](../PR30-RESOURCE-LIMITS.md)。

本機移轉UI是獨立工具，不依賴遊戲登入／運作；同源token防護不是隔離本機OS程序。審查發現舊state回應可能解鎖新的POST，須以localSubmitting與查詢epoch忽略過期回應；網路狀態未知時保持鎖住並重新查，不自動重送可能已執行的移轉。

2026-10-05、`47d79c7` 管理 UI 後續：同一 busy／stateEpoch 契約延伸到串流上傳。刷新使用 server uploads 清單恢復或清理；DELETE 可能已成功但 response 遺失，故 idle 清單校正 pending ID，404 視為已清理，不能讓重試永久卡住。預演資格綁 verified bundle UUID 與來源／目的地／選項，改欄位即撤銷；core 在發布前驗 expectedBundleId，不能僅比較 path 或事後檢查 response。五類統計常駐，JSON 除錯資訊收合；手填本機來源驗證成功清掉選檔草稿並顯示實際來源。27 項 VM 測試覆蓋 race、WebKit 相對檔路徑映射、身份與失聯清理，瀏覽器及全套證據見 [移轉進度](../SERVER-DATA-TRANSFER-PROGRESS.md#管理者匯入流程與背景-chrome-驗收)。

上述UI競態已在 `215f82c` 修正，11項VM回歸＋4項HTTP通過；PR／移轉／最新遊戲功能完整整合後 Windows、Linux 各304項通過，詳 [整合證據](../SERVER-DATA-TRANSFER-PROGRESS.md)。移轉工具與UI只在本地分支，PR資源修正已推送，兩者均未部署；不可沿用舊259項數量當作最新總數。

2026-10-05 後續複查，PR 程式 `3b19720`／本地整合 `e71989e`：失敗開局不能留下 `playing` archive；fsync／rename 錯誤後仍需將實際 JSONL／tmp bytes 計入配額。大量 canvas 恢復使用 `renderCooperatively`＋MessageChannel，每批最多 1 fill／16 strokes／約8ms軟預算，最新 snapshot／undo／換輪取消舊 job。`render` 同步契約保留；save 等最新 render，失敗或換輪禁止上傳部分／錯輪畫作。PR Windows／Linux 各279項，本地整合 Windows323項通過；本次沒有重跑整合分支Linux全套，不能寫成Linux323項。Chrome cold48fill三次皆無>50ms長任務，maxBatch15.7–18.4ms、cache8MiB、hash相同；單fill不可搶占，首次排程仍可能56.8ms。詳 [修正證據](../PR30-RESOURCE-LIMITS.md)。

Gartic HAR 尚未取得；[官方錄製方法](../research/GARTIC-NETWORK-REFERENCE.md)已核對 Chrome exporter 的 `_webSocketMessages`，其訊息內容不因 sanitized 就自動匿名。HAR是傳輸證據，不是客戶端 CPU 工作／server 架構證據，不能從UI或payload大小推斷填色實作。

同日 U21 允許換瀏覽器／安裝官方擴充，背景偏好保留。Chrome 擴充已連線，內建瀏覽器隱藏開頁成功；目前官方工具未列出 CDP／HAR 能力，已告知使用者官方 Developer mode 設定並等候回覆。下次先核對設定回覆與實際 capabilities，不能重複安裝、擅自提高視窗或把官方文件能力當成已錄製證據。

後續 U22 明確指示直接開啟；已用設定 UI 啟用完整 CDP，重建 CUA 工作階段後官方 `cdp` capability 可用，取代上一段的等待狀態。Gartic 背景單席採樣已完成，原始事件與截圖只存 ignored work。持久 REPL 跨 cell 的採樣游標使用單一可變物件欄位，避免不同函式保存舊 binding；匯出仍須檢查 sequence 去重、順序、truncated 和時鐘映射，不把設定成功當作資料完整的證據。詳細結果見同一 [網路參考](../research/GARTIC-NETWORK-REFERENCE.md)。

同日追蹤回覆修正 `e60f853`／本地整合 `7c25c7b`：round 會在新對局重回 1，不能單獨作為畫布／配額 identity。server 每新畫布生成 canvasEpoch，POST 必填且在去重／配額修改前驗證；state／snapshot／ACK／SSE 同帶 epoch。client 換 epoch 清零 quota、draft、renderer、sendQueue，所有等待後的發送／套用／儲存重新驗 epoch；command finally 另以操作 token 隔離。clear／undo 不換 epoch、不退額度。舊 client 須重新整理，新舊 server/client 不可混用。Windows PR286／本地整合330項、背景實際新局填色與舊請求拒絕已驗；各平台最終結果見 [PR 修正證據](../PR30-RESOURCE-LIMITS.md#追蹤回覆新對局第-1-輪的配額隔離)，不可沿用舊279／323當最新數量。

2026-10-05、2618c4b 管理UI：`src/data/ui.js` 是獨立localhost HTTP wrapper，static UI 位於tools/data-transfer-ui/，不加入遊戲路由；`tools/server-data-ui.cjs`／npm data:transfer:ui為入口。驗Host/Origin/隨機token、64KiB JSON、source/target停寫ack，互斥工作与記憶體lastResponse。只回傳run/safeError去敏結果，不能寫rawSQLite錯誤／key bytes／users到UI。前端原生required、textContent更新、預演預設、改路徑取消確認，刷新GET state不重送POST。HTTP4項與全套259項在Windows/Linux通過；主agent原Chrome背景完整合成表單流程／reload通過。收合版31c91dd以details隱藏JSON，保留config/nextSteps DOM常駐，統計三欄及140px nowrap標籤；詳進度，無正式資料與服務變更。

## 2026-10-06：股市冥燈本機整合

隔離 main b843a3f，本地 feature/market-jinx-local：/market 沿用既有 session canonical UUID，管理權限重查DB，不採用原型 localStorage。src/market/store.js 以 BEGIN IMMEDIATE、requestId及 expectedRevision 實作日期／投票／結算，取得寫入鎖後采樣截止時間。更正先撤銷舊 award 再保存新 award，失敗原子回復；public/market-rules.js 共用規則，日期保存快照。當前 schema上限13，取代上方12的最新架構描述。Windows Node26.2.0 完整387項、13項市場回歸及背景 Chrome 1280×720／390／320 流程通過；未測Linux／Safari／公開負載。以Draft送審，未合併或部署，證據與接手見 [本機說明](../MARKET-JINX.md)。

同日 PR #38 審查修正：STALE_VOTE 讀新票後須更新待提交草稿 expectedRevision、保留選擇，並要求玩家明確重試。loadSequence 只隔離 GET 套用，不能代替整個操作生命週期的 busy；手動更新先鎖定直到 finally，避免舊清理解鎖新寫入。四項回歸執行實際 market.js＋SQLite store，原程式3失敗／1保護項通過；修後市場17、完整391項通過。Chrome held-fetch 驗真實控件鎖定／0寫入／焦點恢復及三寬度導覽。本筆391取代上段387作最新測試數，詳 [修正證據](../MARKET-JINX.md#2026-10-06pr-38-獨立審查修正)。

同日最新main `1447430` 已包含 #34，#38必要整合改為schema14，原禁題版／市場版13各保留已有資料並補另一方空表。保留main引擎、draw store／前端、MotionPolicy、資料鎖及AGENTS，入口／static路由合併雙方變更。六份測試自動合併的SCHEMA_VERSION重複匯入已消除。市場21／Windows全套463及整合版Chrome完整市場流程、held-fetch與三寬度導覽通過；取代391與最新schema13描述，詳 [相容整合](../MARKET-JINX-MAIN-INTEGRATION.md)，#38仍Draft、未合併部署。

2026-10-08部署教訓：SIGTERM健康逾時不可按原pin盲重啟或刪活data locks；先分current pointer與實際PID cwd/port，保持9帳戶/21表/env核對。已授權zero-room更新可重連已驗UID/command/Restart=always的既有代理協助HTTP drain，保server自然close。writePrivate wx是不可覆寫的證據契約；失敗receipt另存，confirmed另建並以受驗內容原子換入，不可在catch迴圈重複對同名wx寫入或拿verification failure當runtime failure。不要早於activation完成跑dependent公開smoke；本批舊版讀取失敗发生於0登入/0房。詳完整還原進度，不宣稱一般情況都需restart proxy。


## 2026-10-08 紙卡大廳 Draft

已確認 shhuang.cc 是 Linux 部署 8a9cbfd 的六款遊戲專案；Windows BGA-main 舊版不是改動目標。獨立分支 codex/playful-board-game-ui，使用者接受紙卡範本並要求原角色移動功能保持原樣。這輪僅大廳啟用 tokens／六卡輪播／建立房間 dialog，hub.js、lobby.js、遊戲／房間／帳號／資料庫模組未改。五款房間遊戲實際 UI 建立與等待頁、market直接導航、兩帳號移動／表情同步及Chromium觸控驗證通過。完整測試1,519項、1,518通過、原版同項SQLite I/O失敗。其他頁面仍待視覺確認；未部署、未完成全站實玩驗收、未打發行tag。证据見 docs/playful-ui/README.md 與 test-results.md。此紀錄取代本輪將 Windows 舊三款遊戲來源視為正式專案的假設，不代表撤銷既有其他功能契約。


### 2026-10-08 授權部署更新

使用者明確要求更新 shhuang.cc 測試，1.17.0／6be11b4／v1.17.0 已部署。原先 SQLite I/O 測試失敗因 /tmp 空間不足，改用磁碟 TMPDIR 後 1,519/1,519 全部通過；未改測試或 storage。正式瀏覽器驗證登入保留、輪播／建立 dialog／六張插畫與設定版號，origin八資源驗證、DB完整性/schema/四資料表指紋保留通過。此筆取代前一筆未部署／原版測試仍失敗狀態；其餘頁面尚未改造。證據 docs/playful-ui/deployment.md。


## 2026-10-08 全站紙卡延伸，候選1.17.1

使用者要求登入、等待房及遊戲頁也要改，並明確說各遊戲可保留不同布局，只要區塊對齊；開房不得要求暱稱，改用帳號設定的displayName。21HTML共享主題，四款等待内容／操作top差0、gap16px，75最新viewport无水平溢出/pageerror。原布局與core/API/DB/畫猜renderer未改；撲克漏type直接開桌已測舊版失敗並修正，五款權威名稱回歸與三入口實際settings→create通過。完整Linux1,526/1,526，focused13；實際限定遊戲操作與五款200%/reduce通過，非全規則／真手機／全讀屏／FPS。完整檔案與證據 docs/playful-ui/full-site/README.md；部署完成另記該目錄deployment.md，不把候選自稱上線。

Full-site UI deployed to shhuang.cc on 2026-10-08: v1.17.1, frozen commit 35c1e51. 1526 tests passed; origin and database preservation verified. Deployment evidence: docs/playful-ui/full-site/deployment.md.

## 2026-10-08 風格分支與未來多主題方向

使用者要求替完成風格命名並複製分支。Playful Paper／繽紛紙卡：維護分支 style/playful-paper（原 codex/playful-board-game-ui），本批文件提交後複製 archive/playful-paper-v1.17.1。未來玩家可選不同風格是使用者產品方向，尚未實作切換或偏好儲存；分支保存不等於 runtime 選單。證據及規劃見 [風格分支策略](../playful-ui/STYLE-BRANCHES.md)。本批只有文件與 Git 引用，未改程式、部署或資料；未推送 GitHub。

## 2026-10-08 繽紛紙卡深色模式與右上角控制

使用者要求系統深色偏好、Spotify式深底與鮮明重點色，及設定旁切換按鈕。候選1.18.0在style/playful-paper；保存archive/playful-paper-v1.17.1仍不移動。head載入color-scheme.js，auto/light/dark使用本機ah-color-scheme並同步分頁；登入頁亦可切換。只新增固定靜態路徑，不改game API/schema/sync/renderer。完整1532及最終focused38通過；78矩陣、三席原生流程、200%、對比抽樣与320px/keyboard/reload/storage/form草稿通過。詳細檔案、限制與證據 [深色模式](../playful-ui/DARK-MODE.md)，發布結果另記dark/deployment.md。

2026-10-08 正式發布：v1.18.0／8a1d0e1已部署shhuang.cc。1532完整與38最終相關測試通過；15來源資產、23 non-session表、schema與integrity保留。公開瀏覽器真亮暗切換／三模式／版本與匿名login持久性通過；測試房均隔離DB。保存分支ba0811b與v1.17.1 tag未移動，無push。詳 [深色發布證據](../playful-ui/full-site/dark/deployment.md)，取代上方候選狀態。

## 2026-10-08：數值預測候選（未部署）

Issue52／51整合，v1.12.0／schema18新增數值預測與整數微分ledger；舊場次、票與原積分不轉換。開場前凍結官方可用歷史與參考機率，零實際照曲線、更正精確反向分錄。完整契約、備份與未驗界線見 [計分曲線](../MARKET-PREDICTION-CURVE.md)。最終測試以固定提交為準，沒有正式資料操作。

2026-10-08 PR53修正：bb3ce44整合main7149cea；schema19相容兩線17與main18，市場新功能／AI／原成就保留。Linux1712全通過、9新分支migration與隔離三席流程通過，兩輪複查及邊界詳 [PR53整合](../PR53-MAIN-INTEGRATION.md)。候選1.19未部署；正式仍1.18，不移tag、不動正式data。

2026-10-08 PR57：7d20d1b已整合PR53/main，候選1.19/schema19，Linux1726全通過；78矩陣、manual toggle/320px、五款三席/200%與main數值市場ACK通過。雙回合詳 [PR57複查](../playful-ui/PR57-INTEGRATION-REVIEW.md)。尚未合併或部署，正式仍1.18，archive ba0811b不移動。


2026-10-08 PR57 追加：雷霆賽道紀錄 16px 內距／標題 8px 間距，撲克未入座使用 hidden 槽位保留 nth-child，雷霆不產生空車隊。離線／出局實際玩家保留，API／同步未改。Linux 41 項、release check、36 組亮暗／三尺寸／2、3、滿席與兩人 playing 通過；前後截圖、範圍及兩回合審查見 [本輪證據](../playful-ui/seat-spacing/README.md)。候選 v1.19.0 未合併／未部署，正式仍 v1.18.0；既有 archive 與 tag 不動。


2026-10-08 PR57評論修正：滑動防護只豁免controller同步選中的卡片，避免鍵盤／前後切換與create type不同步；承接PR53 bf545ae混合真人AI成就。69項與原生Chromium滑鼠／瀏覽器鍵盤事件／真create通過；固定head與兩回合審查見 [證據](../playful-ui/PR57-COMMENT-FIXES.md)。未部署／未合併main，舊收據不修補。


## 2026-10-08：每日官方收盤抓取候選（Issue66，未部署）

每日台北 14:00–16:00 有界時點，成功日持久停止；歷史只補缺漏，有限重試後由管理員處理。firstValidObservedAt 是本系統首次驗證觀察，非官方發布時間。既有 key/value 表新增逐日期 metadata，沒有 table/schema 變更；舊版 validator 不認得新 keys，回退須注意。來源與帳務交易、日曆未知／衝突、前端15秒內部讀取保持。規格、測試及手動修正邊界見 [每日抓取](../specs/MARKET-DAILY-FETCH.md)；最終證據以 PR 為準，不沿用其他版本測試數。

## 2026-10-09：race 教學來源防線（Issue71，本地未發布）

`public/race.html` 的 `TutorialEngine`／`LessonScenarios` 分別完整內嵌
`src/games/thunder.js`／`src/games/tutorial.js`。新增 check-only 工具與 npm test 回歸，
只允許 CRLF→LF，wrapper、exports、註解及空白仍嚴格比較；HTML 與 runtime 不改。
後續章節／timer 教學殼仍手寫，未宣稱完整單一來源，未引入產生器。
來源邊界與驗證方法見 [race 教學來源](../RACE-TEACHING-SOURCES.md)。
本地驗證及發布狀態以本切片審查證據為準，不沿用既有 main CI 當新 head 通過。
## 2026-10-09: local lobby handler extraction (#73)

Four lobby handlers now have explicit app-local dependencies in `src/http/lobby-routes.js`; path/method matching, parsing, login, error serialization and media access callbacks stay in app.js. Route inventory, limits and unextracted groups: [lobby slice](../refactors/LOBBY-ROUTES.md). HTTP characterization uses #70's fixture, including simultaneous app isolation and private image/sound access. This is an unpublished local slice, not merged or deployed; full-suite `/api/info` environment failure remains a release blocker. No RoomRuntime extraction or version/schema change is included.

## 2026-10-09：遊戲與資料契約盤點（#77，文件）

固定程式基線 `2a5a197094c254d4a16cdec682d441af31692c76` 的 [契約矩陣](../GAME-DATA-CONTRACTS.md) 區分現有行為、已存在 coverage 與 #78 最小測試提案。保留 explicit game dispatch；schema19 的歷史 feature-shape 分支、restore 新代 fence 及同程序 achievement retry 已有實作，不代表跨程序 outbox 或記憶體房間續玩。#53 已是基線祖先，不沿用歷史 Draft 狀態。這次不改 runtime/schema/backup 格式、不升版；app 接線於 #73/#74 整合後須重新核對。操作復原程序另由 [#79](https://github.com/stanley021039/BGA/issues/79) 整理，不能把契約盤點當正式移轉驗收。
## 2026-10-09: Room runtime local candidate (#74)

Per-app room/seat/reconnect/stream registries and scheduler ownership now have a
small `src/rooms/runtime.js` boundary. Concurrent close/startup failure cleanup
is covered by local regression tests; this is an unpublished candidate stacked
on #70/#73, not deployed functionality. Ownership, release order, dependencies,
validation limits and rollback are in [Room runtime](../refactors/ROOM-RUNTIME.md)
and its review record. Game engines, AI, lobby handlers and routes retain their
existing responsibilities.

## 2026-10-09：race controller 切片（Issue76，本地未發布）

RaceController 接管 receive／polling／timer／取消與頁面生命週期，render／input／
movement／dice／sound 模組及教學引擎保持原 ownership。RoomHost callback、晚到 API
與 movement settlement microtask 依 epoch／presentation 隔離；教學不啟動 live poll。
RoomReconnect 可選 AbortSignal 支援取消原本 recovery 與等待，舊三參數呼叫保留。
依賴 Issue71 來源一致防線及 Issue72 requestJson，維持未發行批次 1.23.1。
細節、已驗與未驗範圍見 [race controller](../RACE-CONTROLLER.md)。
原生 browser 無法連 executor loopback，全套仍受既有 api/info 環境問題限制；
不把 focused／VM 通過視為全部驗收或准許推送，沒有部署／正式資料操作。
## 2026-10-09 Issue 75 同步 controller（本機候選，未推送）

畫猜同步/取消 ownership 已抽為 DrawController；頁面保留 canonical state、input、renderer、transport/playback 專用責任，沿用 1.23.1。85/85 focused 通過，完整 suite 及原生 acceptance 的實際狀態、固定 code SHA、兩回合審查見 [本切片證據](../DRAW-CONTROLLER-REFACTOR-PROGRESS.md)。dot cloud browser 無法連入隔離 localhost，途中 frame／desktop/mobile/touch/keyboard 不算驗收；不可用 VM raster、OS stub 或跳過失敗替代 required native／完整 suite。沒有新 PR、部署、schema 或正式資料操作。


2026-10-10 瞎掰王口說版：feat/bluff-king 本機候選 1.28.0，基線 main 4664916；60 題（冷知識 30、迷因 15、文學 15），開桌前可選看身分 10／30／60 秒。到期自動口說並隱去私人角色／答案，AI 只保存自己的卡片記憶。Windows 1991 全通過、Chromium 實驗 10 秒到期／重載／新輪倒數；真人語音、實體觸控、Linux 未驗，未發 PR／部署。取代上輪 1.27.0／15 題／1979 數字；接手讀 [本輪證據](../BLUFF-KING-PROGRESS.md) 與 [規格](../specs/BLUFF-KING.md)。

2026-10-10 秒數可見性追加：瞎掰王大字 sticky 倒數、口說保留 0 秒；CAB7B6 原生頁面確認捲動仍可見，31 項相關測試通過。準備倒數計算沿用前輪，未操作使用者回合；詳 [本輪證據](../BLUFF-KING-PROGRESS.md)。維持未發行 1.28.0。

2026-10-10 主頁圖片：五款新遊戲原創 SVG 與共用圖片卡片，現在11款全有圖；精確圖片路徑／輪播相關6項通過，桌機亮色與390px深色驗證，未發布。接手見 [主頁圖片證據](../GAME-CARD-ART-PROGRESS.md)。


## 2026-10-10 PR 發布前最終驗證

候選版 1.28.0；完整 node --test tests/*.test.js：2006/2006 通過，fail/cancel/skip 0，93923ms。這筆更新取代上一輪未重跑完整 2006 的驗證限制。另有倒數音效 focused 56/56，以及 Chromium 原生播放五項案例通過；仍未驗證喇叭／耳機主觀聽感、Safari、真人跨裝置語音與弱網。完整記錄保留於 ignored work/bluff-pr-final-tests.log；原生證據沿用 work/bluff-preview/sound-qa/results.json。

目標 stanley021039/BGA，feat/bluff-king → main；本機準備提交供發布確認，尚未推送、建立 PR、合併或部署。


## 2026-10-11 PR #95 與 main 衝突整合

將 main b8aa891（1.27.1、PR #94 共用日夜配色）合入 feat/bluff-king，解決 CHANGELOG、兩份角色文件及 package/lock 共五項衝突。更新紀錄與角色證據保留雙方內容；候選版仍 1.28.0，lock 同步。共用配色程式原樣保留，瞎掰王原有表面／文字 token 成對宣告不變；沒有 DB schema、遊戲引擎或音效程式的新修改。

Windows 完整 node --test tests/*.test.js：2010/2010 通過，fail/cancel/skip 0，110968ms，含新增的共用日夜配色回歸。node tools/release.cjs check --base origin/main --type minor 與 diff check 通過。ignored 證據 work/pr95-main-integration-tests.log。本輪未重跑原生瀏覽器或主觀音效驗收，先前證據維持原版本範圍。整合後沿用 PR #95 推送，不另開 PR、不合併或部署。


2026-10-12 組隊房間分離：十款等待畫面採雷霆之路模板，遊玩資訊等待時隱藏，瞎掰王與傳情畫意設定自動提交。40布局／十次開局及有限設定邊界已驗；完整測試、原生作畫补验、兩輪審查及部署以 [組隊房間進度](../WAITING-ROOMS-PROGRESS.md) 與 PR #96最新留言為準；未驗設備與全phase不冒稱完成。


2026-10-12 頁首深色模式修正（1.28.2候選）：使用者截圖中的直向文字來自trpg.html漏載ui-primitives.css，icon-only的ui-sr-only caption未被裁切。只補共用stylesheet引用，沒有改遊戲或頁首CSS；新增全站header資源契約回歸。headless Chrome 25頁／1440与390／日夜100組合通過，caption裁切、圖示範圍及切換前後44px按鈕尺寸已驗；非真人觸控或全phase。最終測試、審查、PR與正式部署結果以本批PR驗收留言為準。


2026-10-12 共用文字徽章1.28.3：ui-badge以共用tokens提供內距2px／8px、gap4px、min-height28px；實際狀態／類別／計數入口已opt-in並移除各頁重複幾何，房間操作欄保留120px。七頁28布局與有限原生畫猜已驗，完整測試／PR／公開結果以 [徽章契約](../specs/SHARED-BADGES.md) 與本批PR留言為準。玩家資訊卡、D符號與装饰籌碼不套用。

2026-10-12 共用資訊與操作列1.28.4：ui-control-row 的 ui-info-actions 變體統一12px gap、可換列、44px高度與12ch房號槽；八房入口opt-in，純操作8px維持。32桌機／手機亮暗布局及畫猜15持筆採樣／ACK／觀看者／倒數／揭曉／換輪已驗；完整suite、PR與正式結果以 [共用操作列契約](../specs/SHARED-INFO-ACTIONS.md) 與本批PR留言為準，不推定全部phase／真觸控。

2026-10-12 共用組隊人員名單1.28.5：十款waiting共用ui-room-roster固定260×112卡片／64×80角色／12gap，窄容器縮窄，112px桌機與236px手機捲動槽；真人沿用角色、AI預設機器人，姓名共用observer，hidden切回遊玩名單。十款1→滿席、40布局、十次開局及畫猜15持筆／ACK／觀看者／倒數／揭曉／換輪已驗，完整suite、PR與正式結果以 [名單契約](../specs/SHARED-WAITING-ROSTER.md) 和本批PR留言為準；未驗真觸控／全部phase，不改引擎或資料。

2026-10-12 共用操作按鈕1.28.6：native action與ui-button共用999px橢圓／2px框線，晚載頁面不覆寫；icon44px圓形、內容選擇卡保持幾何。離房dialog confirm/cancel明確接GameUI中文label與primary/secondary。25頁100layout、十房40waiting／start、自動設定、五dialog20layout／取消／Escape／503留房／重試返大廳及畫猜15持筆／ACK／觀看者／倒數／揭曉／換輪已驗；完整suite與正式結果以 [按鈕契約](../specs/SHARED-BUTTON-FRAMES.md) 和本批PR留言為準，原生播放器／browser confirm不聲稱重繪。


2026-10-12 組隊布局與聊天室1.29.0候選：十款統一上列介紹／設定、下列固定人員卡／聊天室；手機換列且內容框內捲動。五款補共用聊天依賴，單client/mountIn保留草稿與輪詢，開局恢復操作節點與原展開狀態；TRPG公開角色名出現在名單。等待特殊設定留在共用欄，賽道／手牌／畫布／播放器／身分與揭曉保留遊玩專用布局。驗收範圍、完整suite、PR與公開結果見[共用組隊與聊天契約](../specs/SHARED-WAITING-CHAT.md)與本批PR留言，不推定全phase或真人觸控。


2026-10-12 聊天文字配色1.29.1候選：1.29.0公開幾何／收發驗證通過後，截圖發現同頻頁全域p的#6e7c71滲入聊天室，深色訊息對比不足。chat.css讓p／label／time繼承面板配對文字，不借各遊戲舊字色；保留等待retention專用muted token。共用scope與明暗contrast回歸、十款實際等待／遊玩文字對比及最終完整suite／CI／公開結果以本批PR證據為準；不是已驗全站所有文字或所有遊戲phase。

同批追加捲動驗收：ui-foundation的room-sidebar:has(action-slot)原為playing popover保留overflow:visible，搬入固定等待grid後會讓互動／離房工具溢出並覆蓋聊天室。waiting控制槽明確overflow:auto覆寫，遊玩側欄維持原規則；驗證框內捲動與工具／表情彈窗，不以框尺寸一致代表子內容沒有溢出。

2026-10-12 共用房間操作與彈幕獨立分支：chat table POST 與 social message／barrage 共用 sendRoomMessage，相同 requestId 只產生一組全文／短彈幕；160 字以 Unicode code points 驗證，emoji／expression 補聊天紀錄。RoomControls 轉接原有操作與欄位，設定搬移修正畫猜讀取／委派範圍，雷霆保留原有 AI 並轉接 restart；共用離房支援送出中、503 與重試。Linux 2049 通過，原生十款及畫猜／離房流程已驗，無 schema 或引擎規則變更；未整合 main 或發布。見 [規格](../specs/SHARED-ROOM-SOCIAL.md) 與 [證據](../SHARED-ROOM-SOCIAL-PROGRESS.md)。


2026-10-12 PR #109 整合複驗：取代上一筆本分支「未整合 main」狀態，候選 1.31.0 已整合 f2689a4，保留房間內設定、傳情畫意共用畫板與導覽元件。2057 Linux 全通過、原生十款40布局、畫猜持筆／時序／倒數／換輪與傳情畫意作畫／送出／下一頁已驗；結算150分／4輪及非房主唯讀設定已驗。CI、合併與正式結果以 PR #109 及 [本輪紀錄](../SHARED-ROOM-SOCIAL-PROGRESS.md) 為準；未驗真人觸控或十款完整場次。

2026-10-12：以共用 ui-field / ui-field-group 與 GameUI.frameField、frameFields、createField 統一標題＋控制項；label-control 8px、相鄰欄位 12px，保留原生節點與 inline 控制布局。隔離測試站的欄位量測及已驗功能／限制見 [共用表單欄位](../specs/SHARED-FORM-FIELDS.md)。

2026-10-12：極簡畫家、你畫我猜與傳情畫意共用 GameUI.layoutDrawingPlay / createDrawingBoard 的直向遊玩版面，玩家／工作區／固定聊天室同寬；手機工具列移至畫布下方。三款 12 組明暗／桌機手機布局、聊天室收發及固定高度、原生作畫／送出／換輪與再開局已做針對性驗證，範圍與限制見 [共用繪畫遊玩排版](../specs/SHARED-DRAWING-PLAY-LAYOUT.md)。此三款取代先前畫猜遊玩側欄等高安排，其他遊戲配對仍保留；未合併 main 或正式發布。

2026-10-12：極簡畫家回顧有回合結果才顯示，教學只在等待開局／介紹入口顯示，進行中與結算隱藏且不留空槽。桌機／手機 12 次狀態檢查與作畫／猜中／換輪已驗，結果與限制見 [共用繪畫遊玩排版](../specs/SHARED-DRAWING-PLAY-LAYOUT.md#極簡畫家輔助區塊顯示)。

2026-10-12 更正繪畫排版：使用者明確要求左玩家／中上畫布／中下猜題或送出／右聊天室，取代先前同日直向排列記錄。三款共用 layoutDrawingPlay、createDrawingBoard、frameDrawingTask 與尺寸適配；桌機同列等高、手機換列，極簡教學與回顧顯示條件保留。12 組明暗布局、20 組角色／階段與斷點、作畫時序／同步／送出／換輪／再開局已驗；範圍與限制見 [最新共用繪畫排版](../specs/SHARED-DRAWING-PLAY-LAYOUT.md)。未合併 main 或正式發布。

2026-10-12 共用教學顯示實作：使用者要求遊戲中不顯示「一分鐘學會」等教學；十款標記內容／入口改由 RoomWaiting 統一處理，等待與介紹保留、遊玩與結算隱藏，開局關閉已開啟的教學 dialog，独立賽車教學與退出入口保留。十款 70 次狀態／桌機手機檢查、入口與 13 資源來源核對通過；範圍及限制見 [房間教學顯示條件](../specs/SHARED-ROOM-TEACHING-VISIBILITY.md)。此筆取代極簡畫家個別教學判斷的實作記錄，回顧條件及三欄繪畫排版維持。

2026-10-13 傳情畫意定時傳頁：使用者要求移除全員送出後的房主按鈕；90 秒共同 deadline 到時自動傳頁與最後揭曉，提前全員送出仍等時，已送出保留倒數。私人有界草稿先同步，逾時採已同步內容或空白略過；不把草稿頻繁存入歷史。37 項針對性測試、兩個三席真實兩頁倒數及 10 次桌機手機幾何檢查已驗；持筆／放開／同步回應無意外白屏，重新開局空白。此筆取代先前房主手動傳頁與待定截止記錄；範圍及限制見 [定時傳頁](../specs/TELEPHONE-TIMED-PASSING.md)，不推定全套／真觸控／正式發布。

2026-10-12 候選 1.29.0：瞎掰王三選一、真人多數全站禁題與本機轉檔反應音效；11 款遊戲共用專注切換，新遊戲接入規則已寫 AGENTS。初次40 focused／2019完整，後續原生頁面修正與最終驗證見 [本輪證據](../BLUFF-ROUND-FOCUS-PROGRESS.md)。未發布或部署，永久記憶及轉檔工具保持 ignored。


## 2026-10-12 最終交付驗證

完整 Windows 2023/2023 通過，fail/cancel/skip 0，132730ms（work/bluff-focus-final-tests.log）；此後補跨房間禁題即時替換選項，受影響瞎掰王引擎／真 HTTP／前端反應／專注測試 33/33 通過（work/bluff-final-game-tests.log）。專注最後補 root 幾何標記與外層單欄 CSS；交付前對共用資源／圖示配色與 overlay 再驗。

Chromium 隔離實際房間 BB07C0：想想三題中選海洋雪後才顯示30秒；揭曉正確計分，1位真人＋2AI投票門檻1，按禁題後顯示1/1、已全站禁用；下一輪AI想想選題，人類可按固定文字反應，專注內也可見。撲克先完成原有媒體同意（暫不觀看）後，專注進出正常；雷霆、跑團、市場及其餘房間頁都確認專注 root 可見、導覽隱藏。共用頁面不重新建遊戲 DOM；內建瀏覽器驗證的是頁內回退。

已補資料標記保留旁觀反應與必要 DIALOG／tooltip；相關回歸7/7。音效本機原生playing及靜音案例通過，證據使用 screenshot bluff-reaction-audio.png；專注實際房間 screenshot bluff-focus-final.png。全部 QA 為隔離站及合成帳號，沒有操作使用者房間或正式禁題資料。所有新版首頁遊戲自動由 data-game 目錄納入接入回歸，未來新增遊戲缺共用模組／ui-primitives 將使測試失敗。

候選仍1.29.0，release check以origin/main de526dc為minor通過；永久記憶更新本機且ignored。未推送、發布新PR、合併或部署。原生OS全螢幕、實機Safari、真人語音與主觀聽感仍未驗，沿用此前限制。


2026-10-12／1.29.0 本輪補強（取代舊非想想權限與 60 題現況）：題庫保持單檔供歷史保存、穩定 ID 相容禁題；secretExplanation 與 secretAnswer 同期限授權；共用專注取消祖先占位，保留 hidden 與畫布比例。驗證與限制見 [最新交付紀錄](../BLUFF-ROUND-FOCUS-PROGRESS.md#2026-10-12-題庫與專注尺寸補強最新)。未發布／部署。


## 2026-10-13 郎中闖江湖試玩版

基本版＋草藥女巫已接入同步抽藥、秘密大釜、九輪結算、測試 AI、原創 SVG 卡圖與共用專注。12 位女巫／六套藥材書／24 張基本占卜卡、PDF 4 七頁中文譯本；實玩一輪及九輪自動／HTTP 證據見 [交付紀錄](../QUACKS-PROGRESS.md)，範圍見 [spec](../specs/QUACKS.md)。完整 2042 後受影響複驗另記；數位供應不限，煉金術士／擴充占卜卡／試管面仍接續，未發布或部署。

### 2026-10-13 追加：郎中大釜與配書／結算

新增分色真人藥材書投票與房主平票裁決；測試 AI 不投票。原創九色藥材 SVG 共用在書卡、袋中、購物及銅釜落點；可切換公開大釜，提示支援指標、點擊與鍵盤，切換不改自己的操作對象。輪值起始玩家親自抽占卜牌，結算新增手動獎勵骰及綠黑紫效果確認，第二機會恢復記錄的回合起點。

完整回歸2055、最終相關27均通過；實際 UI 驗證投票、抽牌、抽藥／停止、公開大釜切換、藥材提示、擲骰與效果確認。1280視窗專注大釜寬672.4→742.95；390手機模擬無橫向溢出。動畫為在線新揭曉觸發、重連不重播，減少動態靜態卡；未驗證實機手機或原生全螢幕。此項取代早先整套配書／自動骰流程；未部署。細節與證據見 [郎中進度](../QUACKS-PROGRESS.md)。

### 2026-10-13 最新：郎中沉浸介面與成就
取代前述整套預設和整場一次藥袋配額；每輪私有快照一次、逐色隨機票、唯一鍋色／公開鍋名、白色炸彈、召喚翻牌與公共骰動畫／結果、原創資源和爆炸WAV、回合火焰與尾巴格、永久液滴／老鼠石分離。五枚郎中徽章由固定開局帳號及合法九輪操作伺服器判定，交易回滾與刪房後同程序重試、AI/test/tutorial排除；既有schema/單位帳本不變。完整2078通过，SVG排版渲染檢視；本輪沒有新增真瀏覽器或喇叭聽感驗證。來源、範圍、跨程序及跨桌限制見 [最新郎中進度](../QUACKS-PROGRESS.md)。未發PR／部署，候選仍1.29.0。

### 2026-10-13 PR準備更新：候選2.2.0
本批已整合main共用房間UI及最新畫猜曲線／點時間更新（base a54a6b9、main2.1.0）；取代先前本批1.29.0／2.1.0候選狀態。郎中接共用控制／等待室／聊天室／AI席位，保持配書投票可見與开局還原。最終功能程式完整2150/2150，升版／快取後11/11；最終真瀏覽器／手機／喇叭驗收待验，先準備Draft，未推送／發PR／部署。兩輪範圍、固定提交及限制見 [PR準備](../PR-QUACKS-BLUFF-2.3.0-PREPARATION.md)。


### 2026-10-13 PR #115 衝突修正
已整合 main 3dc4a55（2.2.0）；唯一衝突是 CHANGELOG 版本項目。保留 main 的市場自動查核 2.2.0，將本批功能升至 2.3.0，並更新套件版本、焦點資源快取與回歸測試期望。完整測試尚未在新合併提交上重跑，PR 維持 Draft。


### 2026-10-14 瞎掰王中央揭曉介面（候選）

本場回顧移入題目與揭曉共用的中央槽位，初始與選題／看角色／口說階段隱藏；揭曉依 resultId 與 roundId 顯示當輪，結束顯示完整回顧，重開清空。答案、解釋、分數、來源與禁題投票保留；長內容在框內捲動，未變動的輪詢快照保留內容節點、閱讀位置與連結焦點。手機移除 display:block 覆寫，恢復共用 grid 間距；桌機中央框與操作／聊天室框上下緣對齊。未修改遊戲引擎、計分或題庫。

隔離站三個實際帳號完成三輪與重開：上述顯示條件、換輪、計分揭曉、禁題投票（1/2，未達永久禁用）、專注進出、輪詢捲動／焦點保留正常。Chrome 桌機 1440、手機模擬 390／320 像素亮暗模式無橫向溢出；揭曉槽 440px，結束時桌機隨操作區等高 574px、手機仍 440px，長回顧可捲動。此筆只描述候選瀏覽器實際操作；未驗實機手機／Safari，沒有正式發布證據。


### 2026-10-14 遊戲操作與聊天室共用獨立框（候選）

RoomControls.mountPlayPanels 統一建立上方「遊戲操作」框、下方 SharedChat 聊天室。操作節點保留原 handler，等待室還原原位置；畫猜選題移入操作框，撲克下注與雷霆儀表板接入，傳情畫意／極簡的送出按鈕由共用代理沿用原邏輯及 disabled 狀態。聊天室獨立保留外框、440px 槽位與底部狀態／工具／輸入列，操作內容於自己的 viewport 捲動；不再依操作內容或玩家欄計算聊天室高度。低高度桌機模板側欄可捲動兩個框，操作槽至少220px，不壓縮聊天室。專注模式保留雷霆操作，隱藏聊天；320px 音樂播放器受容器寬度限制。

隔離站11款遊戲在1440／1000／390／320亮暗畫面共88組確認外框獨立、同欄寬、操作在聊天上方、長操作內容不改變聊天室／輸入列尺寸、無橫向溢出，實際傳送聊天訊息與專注進出正常。畫猜實際選題、持筆15次途中取樣／放開／stroke ACK、觀看者途中取樣逐步增加、猜中揭曉與換輪通過；傳情畫意確認送出與送出後倒數、極簡非空幾何作畫送出與猜測代理按鈕通過。Chrome手機模擬，未驗實機手機／Safari；取樣不是逐幀FPS證據。此筆是候選介面實作／實際操作證據，沒有正式發布證據。


### 2026-10-14 線上朋友房間邀請（候選2.4.0）

11款房間共用「邀請線上朋友」卡片及遊戲操作框入口；人物加號與AI機器人圖示共用registry／卡片框，名稱與行為分開，原分享入口明確標為複製房間連結。線上名單以有效登入工作階段的近期活動判定，排除自己、同桌、離線／停用／被踢及不能加入的玩家；目前沒有另建好友關係。頁首提供房間邀請匣，可接受／婉拒，接受才沿用原入座與歷史記錄流程，不自動入座或自動離開其他房間。邀請保留5分鐘，去重、速率／數量限制及入座前再次檢查；房間消失或邀請者離席則失效。暫存與房間同樣僅存程序記憶，沒有DB schema變更。

獨立站三個既有測試帳號實際完成邀請、通知、接受跳转／入座、婉拒不入座、重複邀請同一ID、非房員／非收件者拒絕、離線排除、已開局與已滿的接受拒絕、邀請者離席失效。人物／AI分別可操作；修正畫猜等待時玩家加入的局部刷新漏掉AI按鈕。11款等待入口／不同圖示及遊玩入口，1440／390／320亮暗畫面共66組無横向溢出、邀請dialog六組保持視窗內，聊天室高度440px維持。未以這筆證據宣稱5分鐘到期的實際等待、實機手機、Safari或正式發布已驗；普通房員邀請權限由後端入座檢查及共用入口提供，三人主流程邀請者為房主。來源版號升為2.4.0；驗證用常駐程序在升版前啟動，API版號仍為啟動時2.3.3，不能冒稱正式2.4.0發布。


### 2026-10-14 雷霆之路房間空框與留白（候選2.4.0）

等待房間原有 race-utility-panel 的內容已交由 SharedChat 呈現，原容器仍有邊框與留白，形成空框；等待階段隱藏此舊容器，遊玩階段還原供獨立操作／聊天室使用。等待側欄不再保留多餘的父層捲軸槽，設定框與聊天室左右邊線一致。共用 room-waiting.css 定義1800px外框上限及24px／12px外層inset；畫猜沿用原尺寸，雷霆一般房間使用相同寬度與有效左右留白，教學與專注模式維持各自布局。

隔離站Chrome實際比較1920／1440／1100／1000／600／390／320像素亮暗模式，14組畫猜與雷霆成對畫面左右邊線／內容寬度一致、無橫向溢出；設定與聊天室同欄邊線對齊且高度440px。實際切换主遊戲／惡魔賽道、加入AI，設定框尺寸穩定且沒有空框；開局正常擲骰／確認，操作與聊天還原，1440／390／320遊玩版面無橫向溢出，專注進出保留操作並恢復聊天。第一次追加專注驗證未先完成擲骰dialog而逾時；補齊正常擲骰與確認前置後，全程重驗通過。未驗實機手機／Safari；此筆為候選瀏覽器驗收，沒有正式發布證據。


### 2026-10-14 大廳與畫猜共用紙卡模板

新增 opt-in GameUI.Template 元件階層，沿用原 carousel、角色圖、表情與 canvas controller；語意 tokens、panel header/body/footer、roster、toolbar 與頁面 adapter 分層。桌機 1280×720 實際走過等待、選題、作畫、猜題、聊天室、表情、結算、最近畫作及再開局；390px 手機與亮暗模式驗收。設定移至共用 slot 後仍能自動儲存，數值 input 有行為回歸測試。長內容採區塊內捲動，保留原資訊及控制項。元件契約見 docs/specs/SHARED-GAME-TEMPLATE.md；此筆本身不代表正式發布完成。

## 2026-10-14 Stitch 共用模板
補 dialogPanel、等待室聊天与下局設定 portal；不重建有事件的欄位或畫布。hidden／高度樣式僅於值改變時更新，避免觀察器反覆排程；畫布依實際 grid 槽量測。原生對局／收藏／重開与畫筆取樣證據見 STITCH-UI-IMPLEMENTATION.md，未更改同步引擎、資料 schema 或原站計分。


## 2026-10-14 Stitch 功能與版面 2.5.0

2.5.0 使用每次已接受快照更新 Stitch adapter，避免只在大場景重建時更新就緒／狀態。等待室搬完整 controls 宿主，保留內部 settings slot；新 ready／skip／transfer-host／解散／取消個人收藏均經後端權限及必要的 epoch 檢查。公開 snapshot 維持不可變與八輪限制，原計分與 DB schema 不變；獨立 PNG／ZIP encoder 與小型 matchSummary 補齊真實功能。 詳 [本輪證據與限制](../STITCH-UI-IMPLEMENTATION.md)。

### 2026-10-13 煉金術士本機完成
八病患三選一、四面愚人草、特效藥／第9輪規則與20張符號過濾占卜牌已實作；私有預抽、連鎖安全抽藥、同級交換與真實格位回退、AI與歷史來源同步接入。全套Windows Node24 2168/2168通過；真無視窗Edge設定保存、兩人病患／特效藥操作、專注與390px排版通過，沒有JS錯誤。細節見 [規格](../specs/QUACKS-ALCHEMISTS.md) 與 [交付證據](../QUACKS-PROGRESS.md)。本輪新增內容只在本機；沒有推送或部署。仍有限供應／背面大釜、跨程序成就outbox與實機／聽感限制。


### 2026-10-14 精簡遊戲介面
郎中資源整合大釜、藥材／獎勵滑過提示與卡片式設定；郎中和瞎掰王採左朋友／中遊戲／右聊天，保留當輪禁題投票、揭曉及專注切換，移除房間過往回合清單。採最新 main c544ebd 共用設定／彈幕修正，候選仍2.4.0同批。全套2168、最後共用22與隔離真Edge桌機／390px／日夜操作證據、已發現問題及限制見 [介面規格](../specs/QUACKS-WORKSHOP-UI.md)。本輪未推送／發布／部署；取代先前大卡片及展開全文效果介面。3005 靜態資源即時更新，保留既有測試程序。

### 2026-10-14 暗夜霓光與藥水瓶圖示
使用者選C；大釜右下改藥袋／舉手／玻璃藥水瓶與女巫幣操作，特效藥文字精簡到病患／數字格提示及合法格確認，回合2／3／6／9有里程碑。整合main bd036b6，2172全套後最終受影響20及真Edge抽停／收回白色炸彈／下一輪／專注／390px通過。來源授權、測試證據與限制見 [介面規格](../specs/QUACKS-WORKSHOP-UI.md)。舊3005程序已停止後沿用隔離資料重啟，房號以runtime為準；本輪本機候選2.4.0未推送或部署。

### 2026-10-14 手勢更新（取代舉手停止）
依使用者最後提供的姿勢，繼續抽改為原創「手從藥袋拈出藥材」SVG，停止改為原創雙手食指交叉成X；不是角色截圖或第三方插畫。原創藥水瓶保留。三圖示維持既有操作、滑過提示／可讀名稱與禁用。最終隔離真Edge完整本輪驗收再通過（含原生抽停與藥水瓶回袋、數字格／下一回合、專注與390px無橫溢出、零JS錯誤），截圖 work/qa/quacks-workshop/neon-potion-controls.png。共用registry仍包含已合法授權的Lucide Hand，但郎中停止按鈕已改為原創交叉食指。本輪同批2.4.0，本機修改未推送／PR／部署。

### 2026-10-14 人物按鈕與全桌爆鍋
本輪取代原創手勢按鈕：使用者圖輕微Q化，喝啤酒字幕還要爽爽；停止保留食指打叉。哭哭橫幅按公共explosionId在全桌呈現，靜態縮減動態仍可見，音效沿用共用原創WAV。受影響88及真Edge雙視窗每端1次原生playing、重複／重連抑制、390px專注通過。來源、完整提示詞、證據与限制見[素材與橫幅規格](../specs/QUACKS-PORTRAIT-ASSETS.md)。候選2.4.0同批未推送／發布／部署。

### 2026-10-14 特效藥自動格數、分明圖示與抽藥／抽卡音效
特效藥結算自動推到本輪上限但須本人確認，可選低格，瓶身顯示公式及凍結加總；抽停照片縮小，分數星星／藥材杵臼／占卜卡牌分開，哭哭圖大、文字小、卡片字體更清楚。私有draw事件逐個排隊播原創音效，爆鍋提示優先且同批合併。完整2181及最後35／真Edge每端8抽藥＋1抽卡＋1爆炸原生playing通過。新3006隔離站保留3005牌局；詳[本輪規格與證據](../specs/QUACKS-ESSENCE-AUDIO-REFINEMENTS.md)。候選2.4.0本機未發布。

## 2026-10-14：離房縮圖 #120 候選

共用與備援離房視窗新增使用者提供圖片的完整比例縮圖、中文替代文字，最大360px並隨容器縮放；候選2.4.0。相關13測試及Chromium日夜／桌機／手機直橫向12組離房流程通過，未驗實機手機／讀屏／完整遊戲實玩、未部署。來源、範圍與最終全套／CI證據見 [離房縮圖進度](../ROOM-LEAVE-THUMBNAIL-PROGRESS.md) 及原PR。



### 2026-10-14 可取消購物、兩步開局與檔案音效
本輪先整合main 1ca5eb1離房縮圖，候選改2.5.0。原按鈕再點取消交易／精確退藥與退款，雙買贈片及黑5鄰座／液滴同步還原，後續效果提交後不再取消。勾選房間設定auto-save，完成後選藥材書；抽停與瓶66×64、大釜頂部／工具左下、占卜依timing紫藍無文字標籤。改用使用者抽卡1.5秒低通／抽藥0.65秒片段，原創爆炸不變。完整2191與真Edge購買取消／設定／尺寸／專注390px、每端1抽卡6抽藥1爆鍋playing通過；聽感／實機未驗，未推送或部署。詳[本輪證據](../specs/QUACKS-CART-CUES-SETUP.md)。


### 2026-10-14 共選效果、鍋邊視野、溢出盆與樹脂骰
使用者取消投票，所有真人直接選共享藥材效果（最後成功指令採用），圖示逐面、提示與雙方即時同步；房主設定後可原生開始。購物grid、鍋邊左右控制／小女巫幣、整口鍋可見、特效藥縮整、記分板放大、結算圖示、補瓶／水滴圖示與水滴術語、本人600ms喝藥水聲已完成。第52格之後的擴充溢出盆按既有引擎計分，隐藏他人盆；樹脂骰按擲骰當時鍋色。完整2196及最後25、真Edge選書同步／開局／購物／喝藥水playing／大釜視野／記分板／390px／專注通過；材質fixture與真雙人爆鍋複验、限制見[本輪紀錄](../specs/QUACKS-KETTLE-SHARED-EFFECTS.md)。仍同批2.5.0本機未發布，舊試玩牌局保留，另建新版3008。


### 2026-10-14 結算音效與鍋邊縮整
本輪新增420ms結算音效、私有成功確認事件與容量等待，放大可見大釜、縮小左下工具及400px特效藥軌；收回藥材／特效藥消耗圖示化，移除滑過提醒，黑綠紫實際結算觸發框發光。Windows完整2203通過；真Edge雙人結算9次native playing、等待同伴確認、桌機全鍋與390px／專注通過，發光與收回為獨立呈現fixture＋實際引擎回歸。仍未驗主觀聽感／實機，未推送或部署，3009另建隔離桌保留3008牌局。詳[本輪證據與限制](../specs/QUACKS-SETTLEMENT-GLOW-LAYOUT.md)。

## 2026-10-14 Stitch 與 main 整合 2.6.0

合併 3eccd1f / 88823b6，靜態路徑、圖示、音效採聯集；郎中新引擎保持 main 原檔。補上共用 primaryAction prepare/start 契約以處理設定確認按鈕被捲動槽遮住，producer 是郎中的原生開始／選書按鈕。DOM 文字以 dataset 簽章去重，不按可能不存在的 aria-label 重建；驗證實際 Enter 開局 HTTP 200。畫猜桌機／390px、四次 stroke ACK、結算及 gallery／離房原生流程通過；細節及未驗範圍見 STITCH-UI-IMPLEMENTATION.md。


### 2026-10-14 殘酷2選1與 fish 爆鍋聲
同頻新增60張原創雙圖題／120張SVG，4／6／8人雙人隊與1–12人個人玩法、真正solo十題回顧、全場每人一次換題，延遲舊題／私有答案／離席／平票由引擎判定。朋友左／題卡中／聊天右及手機專注通過，修正共用設定切換遺失native操作。郎中專用cue串接原創840ms爆炸＋20ms空隙＋使用者fish約567ms；其他遊戲音源不改。完整2216與真Edge組隊／solo／一般模式、全桌爆鍋每端一次native playing／重載抑制通過；來源、規則與限制見[本輪證據](../specs/MAJORITY-CRUEL-AND-QUACKS-FISH.md)。本機候選2.6.0，未發新PR或部署。

## 2026-10-14：郎中選藥介面 #119 本機候選
使用者要求先開票、本機開發並預覽、不提PR。2.3.4候選以獨立翻面／明確選擇、右上個人已選印章、價格／效果上下分區取代下拉與比較區；保留票數、平票裁決及共用UI。Windows全套2148通過，後續受影響26項複驗通過；隔離實際瀏覽器驗投票／鍵盤／日夜／390px／1440px及專注恢復。真觸控、讀屏、Linux／CI未驗；未推送、PR或部署。證據：[本輪進度](../QUACKS-BOOK-VOTING-UI-PROGRESS.md)。


## 2026-10-14：#119 最新 main 整合與說明高度
取代上一筆2.3.4個人投票候選：已整合main88823b6，使用者確認全桌最後選擇；2.5.1保留煉金術士與設定先行，選藥採翻面／明確選擇／全桌印章。說明區預留每色最長面高度，非當前面不可見及aria-hidden；全套2207通過後31受影響項通過，隔離瀏覽器卡高／按鈕位置一致。最新授權建立Draft PR供換環境接續；Linux／CI／真觸控仍待驗，不合併部署。詳[最新進度](../QUACKS-BOOK-VOTING-UI-PROGRESS.md)。


2026-10-14 本輪最終整合：保留main 931b602／PR123最新藥材書介面與說明，候選2.6.0。整合後完整2225全通過，真Edge殘酷組隊／solo／一般分類、暗色／390px與專注重新通過；3011十個服務資源匹配，舊牌局保留。仍未發布本次新功能，詳[最終整合](../specs/MAJORITY-CRUEL-AND-QUACKS-FISH.md#最終-main-整合2026-10-14)。


## 2026-10-15：三款遊戲音效、提示與題庫
本機候選2.7.0：郎中換用使用者停止1765ms／結算660ms錄音；停止由伺服器私人有效事件觸發，排除爆炸與自動停止，保留靜音及重整抑制。修正藥材提示框邊界、購物多餘圖示與三色結算重複規則。瞎掰王「好了啦」及老實人單段解釋，160題；殘酷2選1共96張原創雙圖題／192圖，含先前照片主題改寫。真Edge1440／390提示、價格、兩音效原生playing、重載與角色卡通過；殘酷多人／單人回歸通過。完整測試最終紀錄、來源及限制集中於[本批驗證](../specs/THREE-GAME-REFINEMENT.md)。未發布本批PR或部署；3012獨立預覽保留舊牌局。

最終固定資產 Windows 全套2228／2228，fail／cancel／skip／todo皆0；release minor與diff check通過。前述介面QA使用引擎快照與真HTTP資產／Audio，非完整多人傳輸；細節與先前失敗的原因見本批spec。


## 2026-10-15：大釜配置、預設音效與多人質疑
本機候選2.8.0取代2.7.0反應名稱：瞎掰王「哦是哦」，多名玩家的「質疑你」各顯示五秒，保留音效冷卻。全站效果音預設開啟，version2一次遷移舊設定並保留之後手動靜音；郎中釜名左上、設定在查看玩家右側、水滴入框，只有結算階段切換發聲，輪到本人占卜牌亮且可鍵盤抽取。真Edge1440／390、reduce motion與專注／九人提示通過，完整2232／2232通過；不是真人網路／真觸控／喇叭聽感驗收。來源、前輪fixture修正與限制見[本批紀錄](../specs/QUACKS-LAYOUT-AUDIO-AND-BLUFF-REACTIONS.md)。未發布本批PR／部署，原牌局保留。

2026-10-15：v2.9.0本機候選加入下一格結算框、左上釜名自適應置中、起始玩家中央自動抽牌、哦是哦照片及同頻指定結算錄音。原生1440／390與音效事件證據、範圍及限制見 [本批規格](../specs/QUACKS-AUTO-FORTUNE-AND-MEDIA.md)；未發布／部署。

2026-10-15增量：v2.10.0改為中央牌背本人點擊、全桌3600ms翻牌及青色結算格；各遊戲新局隨機首位輪替角色，房主／座位不變，原同步玩法保留。取代2.9.0自動發送及僅本人演出描述；見[隨機先手規格](../specs/RANDOM-MATCH-STARTER.md)與[占卜修正證據](../specs/QUACKS-AUTO-FORTUNE-AND-MEDIA.md)。本機候選未發布。

2026-10-15整合交付：候選2.11.0已整合main05640c9（#124/#125），UI以Stitch main為主並保留使用者題庫／媒體、照片質疑、中央點牌全桌慢速翻牌、青色結算格及隨機先手。完整2261／2261，真HTTP雙席1280／390開局至購物回朔與音效邊界、其他遊戲有限回歸通過；證據與限制見[本批整合](../specs/MAIN-USER-CHANGES-INTEGRATION.md)。本機試玩3017，未推送／PR／部署；此筆取代前筆尚未整合main現況。

2026-10-15候選2.11.1：依使用者新圖放大釜、縮小抽停區／開始控制、改善書頁對比、釜名移左及記分板移頂；777原圖與要拚／不要錄音、抽停無提示。39受影響音效回歸與Edge真HTTP1280暗／390亮（對比最小5.17:1、無水平溢出、原生playing）通過，另女巫1440／390取樣通過；完整結果／來源／限制見[本批紀錄](../specs/QUACKS-SIZE-AND-ACTION-MEDIA.md)。本機3018試玩，未推送／PR／部署。

本批2.11.1最終驗證：Windows完整2263／2263，版本及diff檢查通過，本機試玩仍3018；無推送／PR／部署。

2026-10-15候選2.12.0：郎中2–8人親友加大桌、要拚尾音640ms、抽藥清理後短停頓再爆炸，以及金邊占卜卡正面；整合main2d53f00彈幕框。六／八人四種模式九輪回歸及Edge真HTTP八席1280暗／390亮取樣通過，完整驗證、原生時序與限制見[本批紀錄](../specs/QUACKS-PACING-EIGHT-PLAYERS.md)。3019另建試玩保留舊桌，未推送／PR／部署。

本批2.12.0最終：Windows完整2273／2273、release minor與diff檢查通過；3019公開6資源精確比對通過。主觀喇叭聽感與真手機仍待使用者試玩，未推送／PR／部署。

2026-10-15候選2.12.1：換用最新580ms要拚!.mp3，只有主動同步抽藥標記語音，烏鴉頭骨等效果翻看／選擇靜音，播放中連抽不累積待播。54受影響項與Edge真HTTP藍2／30次連點／停留效果畫面驗收通過；最終全套、八人爆炸及限制見[本批紀錄](../specs/QUACKS-DRAW-VOICE-ONCE.md)。3020另開試玩，舊桌保留，未推送／PR／部署。

本批2.12.1最終：完整2276／2276、版本patch及diff檢查通過；八人尾音0.58秒完整播放，爆炸銜接正常，3020公開三資源比對通過。未推送／PR／部署。

## 2026-10-15 帳號選單圖文按鈕與角色尺寸

候選2.9.1：既有 GameUI.decorateButton 保留；site-header 帳號選單不再以 display:block 覆蓋 ui-button 圖文排列，暱稱儲存移除36px限寬、保留44px高度與共用setBusy。角色每列四格、64px選項／56px圖片，預留216px捲動槽與42px提示槽。盤點29個使用decorateButton的JS呼叫端，未建立重複按鈕元件。

8080隔離測試站實際驗證暱稱儲存、角色切換、重載保留、1440亮色／1280深色／390與320手機選單；儲存按鈕88×44、圖文間距8px，角色圖片56px高。320頁面原有整頁橫溢出仍存在，帳號選單及本次控制均在視窗內；未擴大修改大廳布局。完成JS語法／diff／版號一致性檢查，未跑test套件；未PR、推送、main合併或正式發布。


### 2026-10-15 彈幕外觀目前選用預覽
設定頁新增右側固定預覽槽，直接使用 BarrageFrames.decorate 與 subscribe，同步選框與跨頁重載保存，手機700px以下上下排列。8080隔離站實際驗證預設→星際軌道即時更新、重載保存、1280亮暗與390手機版，框與裝飾位於面板內。JS語法、diff及版號一致性檢查通過；沿用同批2.9.1，未跑test套件、未PR或正式發布。


## 2026-10-15 表情20字與15格
候選2.10.0。表情名稱原有20字驗證保留；大廳speech取消110px單行省略，使用12em上限與完整換行，依舞台左右邊緣調整位置。選單名稱同樣換行。自訂表情上限6→15，服務端與角色管理說明同步（主圖neutral另計）。
8080測試服務重啟載入來源；實際HTTP建立一位QA角色及15個表情，第16個回400 EXPRESSION_LIMIT，20字名稱保存及大廳選單15項通過。首次批量新增遇既有429，依60秒限制等待重試後完成，未放寬限制。桌機及390手機實際發送20中文字，scrollWidth/clientWidth及scrollHeight/clientHeight一致，完整文字無裁切；手機氣泡左右在舞台內。來源版號2.10.0，服務於升版前啟動、API版號仍2.9.1。語法／diff／版號一致性通過；未執行test套件、未PR、推送、main合併或正式發布。


## 2026-10-15 PR127 main衝突整合
整合main bf8eb4e至架構PR e56aac3。保留兩邊角色記錄與main 2.9.0／2.10.0變更，候選升2.10.1；stitch-fidelity維持tokens／skin／composition載入入口，帳號按鈕44px、角色56px／四欄與固定狀態槽移到composition，不恢復舊整包CSS。保留main彈幕預覽、20字換行、15表情、共用setBusy與原PR架構；此筆是衝突整合紀錄，未新增正式發布證據。

2026-10-15 PR準備候選2.13.0：整合main bf8eb4e／#129最新個人設定與表情功能，保留本聊天三遊戲、八人、音效及隨機先手；完整2277、三款原生複驗與兩輪自查完成。範圍、限制與未發布狀態見[PR準備](../specs/THREE-GAME-PR-PREPARATION.md)。尚未推送／建立PR／合併／部署。


2026-10-15 候選2.13.1：最新 main eb648ce／#130 合併後，移除藥材書標題的說明與設定控制，隨機事件同步全桌左右書頁，普通輪詢保留手動瀏覽。13項單元與Edge真HTTP雙玩家1280暗／390亮通過；證據、原生焦點及手機限制見[本輪修正](../specs/QUACKS-BOOK-RANDOM-SYNC.md)。本機3021獨立試玩，未推送／發新PR／部署。

本批2.13.1最終：完整2280／2280、版本patch及diff檢查通過，3021版號與公開資源匹配；僅本機交付，未推送／發新PR／部署。


2026-10-15候選2.14.0：十一遊戲右上房間管理、郎中藥材蓋數字／盆提示離開即關／階段置中放大；共用播放器獨立最小化、結束續播、清單捲動保留與同桌影片選擇重整保留。157受影響回歸、Edge1280暗／390亮十一款入口與郎中角色升降／媒體真HTTP＋YT fixture通過。詳細證據與限制見[本批紀錄](../specs/ROOM-MEDIA-POT-POLISH.md)。僅本機3022試玩，未推送／新PR／部署。

本批2.14.0最終：完整2289／2289、157受影響項與Edge桌機／手機驗收通過；3022版號與八資源匹配。真人YouTube連播／真觸控待試玩，無推送／新PR／部署。
2026-10-15 PR #127 再複查：整合 main eb648ce，候選 2.13.1；解 13 檔衝突並修正郎中八人 AI／同頻殘酷模式開局 adapter，保留架構拆分。隔離站九款開局、郎中保存失敗／恢復及穩定尺寸、畫猜雙席持筆／ACK／重連／換輪與桌機手機已驗；未執行套件，未合併或正式發布。詳 [本次證據](../refactors/UI-ARCHITECTURE.md#2026-10-15-pr-127-最新-main-整合複查2131)。

2026-10-15 共用 UI 候選 2.13.2：畫猜／郎中共用 RoomChrome、SharedChat 與手機聊天彈窗，固定操作槽並修正專注入口；已整合 PR #127 最新基底並完成隔離預覽複驗，範圍、來源與未驗項目見 [共用 UI 驗證](../SHARED-STITCH-UI-20261015.md)。未合併或正式發布。


2026-10-16候選2.14.1：整合最新main f17ea43（共用架構、RoomChrome／聊天／手機與設計規範），保留本聊天功能；大廳與郎中候場依100%視窗配置，已放藥材格不再建立底下數字。Windows完整2301／2301、123受影響項、Edge20頁矩陣／48次選卡、十一款管理與媒體、雙席途中筆跡／ACK／SSE／倒數／換輪及郎中一輪通過。詳[本批紀錄](../specs/DEFAULT-LAYOUT-FIT.md)。本機3023獨立試玩、舊桌保留；真YT／實機觸控與九輪未新增驗收，未推送／新PR／部署。


2026-10-16 候選2.15.0：藥材選擇全面接共用圖示（含愚人草、特效藥、複數候選與交換前後），快速成交先選幣再選藥材；修正52格後overflow-only未觸發大釜重畫，保留原爆炸與分數規則。特效藥四尺寸無內層捲動；播放器分小視窗／56px橫條，依最新指示橫條音樂及影片音訊續播，工具完整可視。126受影響測試與Edge四尺寸郎中、1280暗／390亮媒體／十一遊戲管理回歸通過。實際範圍及YT fixture限制見[本批紀錄](../specs/QUACKS-CHOICE-OVERFLOW-MEDIA.md)。本機3024，舊站保留，未推送／發新PR／部署。

2026-10-16特效藥2.15.1：中央面板改直向置中，燒瓶／確認框共用中心；確認字16px、高44px、內距較小。Edge四尺寸中心偏差0px且無內層捲動，詳[本批補充](../specs/QUACKS-CHOICE-OVERFLOW-MEDIA.md)。3024只更新靜態CSS，房間保留、API仍2.15.0；未發布。

2026-10-16免費來訪女巫2.15.2：僅witch-visit當輪顯示「免」入口、效果提示與說明窗完整卡片；原三位保留，免費操作沿用server驗證，不扣幣，mine.visitorUsed區分本輪已用。Edge1440暗／390亮／320亮驗一次請求、換普通卡收起與舊窗停用；完整2314及最終受影響複驗，詳[本批補充](../specs/QUACKS-CHOICE-OVERFLOW-MEDIA.md)。3025獨立試玩、3024保留，未發布。


2026-10-16候選2.16.0：播放器／點播／清單統合一窗，移除舊清單入口，最小橫條縮至164×56px並維持聲音；使用彈幕24模板提供個人播放器風格，不改他人或彈幕設定。藥材書未選面淺紙深字、至少7:1對比。139受影響項與Edge雙帳號／桌機手機及320窄視窗通過，詳[本批紀錄](../specs/UNIFIED-MEDIA-PERSONAL-FRAMES.md)。3026獨立試玩、舊站保留；真YT與實機觸控未新增驗收，未發布。

2026-10-16本批後續：風格改套整窗並從彈幕模板自動取色，加入右上設定與形象頁；公開YouTube標題查詢與副作用分離。郎中自動換輪、停手／爆炸無額外結算聲、白彈臨界發光，詳[回合與提示](../specs/QUACKS-AUTO-ROUND-RISK-CUES.md)。最新試玩3027，舊桌保留；完整結果待最終交付紀錄，未發布。

2026-10-16最新回合決策：全員購物完成進round-intro，nextRoundAt固定2000ms、400ms scheduler自動推進；提示期間拒絕next／draw-fortune，重試不重複存結果，九輪直接finished。第一輪不加提示，第2–9輪顯示下一輪號碼；舊骰動畫於提示／結果清空。九輪HTTP＋Edge已見最終結果與九筆紀錄，最新預覽3028保留舊桌。

## 2026-10-16 登入／註冊圖片 #132
候選 2.14.0，基線 main f17ea43；登入／註冊分頁各用使用者指定圖片，單一 img 依 srcset／sizes 載入縮圖，重設密碼不載入圖，七個白名單 WebP 不包含原始 JPG。5 項相關回歸與 Edge 12 組桌機／手機／亮暗／DPR 首載、鍵盤切換、草稿及錯誤恢復已驗證。完整套件結果與限制見 [本輪證據](../specs/AUTH-ARTWORK-132.md)，本機預覽未推送／PR／合併／部署。

本批 #132 最終：完整 npm test 2290/2290，fail/cancel/skip 0，132901ms；minor release check、語法、diff check 通過。本機候選與預覽狀態不變，詳 AUTH-ARTWORK-132.md。

2026-10-16 #132追加：依使用者要求移除登入／註冊圖下可見說明，保留原圖字幕與alt；相關3項回歸及Edge 12組尺寸／主題／DPR複驗通過，右側預覽已更新。沿用同批2.14.0，未發布。

2026-10-16 #132追加：依使用者要求頁底powered by三位製作者，各自名字在圖上、同一原生連結包住名字／圖並對應指定GitHub；WebP縮圖64／88／176px、lazy與srcset。相關3項含九資源HTTP解碼、Edge十二組尺寸／主題／DPR及連結／圖片位置複驗通過。沿用候選2.14.0，未部署。

2026-10-16 #132最新：左圖上方文案刪除，署名同左欄；桌機高度預算與長表單內捲。10組桌機scrollHeight等於viewport、原12組手機亮暗DPR、3項相關回歸與release/diff通過，未重跑全套；低於640px高允許正常捲頁。詳AUTH-ARTWORK-132.md。

2026-10-16 #132 PR交付最新：使用者授權開PR及merge。最終功能樹完整2290/2290（fail/cancel/skip 0、141198ms），12組響應式＋10組桌機高度複驗、minor release／語法／diff通過；取代本批前述未重跑全套限制。兩輪固定提交審查與CI／合併結果以PR對話為準；未部署。

## 2026-10-16 受影響測試與CI分工
使用者明確要求新增npm run test:affected、本機受影響測試、同commit CI全套、仍保留兩輪審查及開PR／merge。工具採明確路徑表；未知／核心／共用／fixture／刪測試回退全套，差異取branch/index/worktree/untracked聯集；套件例外比對三種snapshot。AGENTS／PR審查／打版及README已對齊，CI明確checkout並驗head SHA，完整npm test仍跑Linux／Windows。17項本機focused通過，未本機全套；僅開發工具／流程，不升產品版號。範圍／限制與最新PR證據入口見[測試分工](../TESTING.md)，未部署。

## 2026-10-16 Windows CI 耗時分析
PR #134 已合併；本輪僅分析，未修改測試或 CI。Actions run 38842723647 的同 head 084e4016：Windows 全套 2302 項 817269ms，Linux 77599ms；前輪 run 38841283889 Windows 402309ms、Linux 114757ms，Windows runner 映像同為 20261007.264.1，不能歸因映像升級。最慢個案為 market-images 配額驗證 106760ms、quacks retry HTTP 96360ms，以及三款房間 1000 次加入／離開 90600／83420／64950ms（四捨五入）。並行個案時間不可相加當作 job wall time。
配額 fixture 約 1065 次逐筆 SQLite 寫入，含 65 筆 4MiB BLOB；優先評估按驗證階段 transaction 批次準備，保留配額與解碼順序斷言。三款房間隔離本機 Windows 量測共 12437 次 fsync、耗時約 5583ms，四項選定測試皆通過；這不是 CI 磁碟瓶頸的直接量測。後續先收集 CI 每檔／setup/body/cleanup 與 runner 資源，再比較 Windows 分片及明確 concurrency；保留同 head 全套門檻與真實持久化驗證，不以移除 fsync 或減少壓力迴圈作結論。原始分析留於本機忽略目錄 work/windows-ci-analysis，未部署。

2026-10-16 使用者授權實測後增量：本機 Windows Node22.22.3，原版／批次版各三輪、檔案並行1／3，共12次五案例執行皆通過。配額個案中位數：原版單檔2049ms／並行2366ms；批次單檔2416ms／並行2469ms，未證實批次加速，實驗改動已撤回。數據順序存在環境波動，不把整組時間差歸因候選版。獨立診斷分支 codex/windows-test-fixture-benchmark 的 head 082a290 只新增 tools/benchmark-windows-ci.cjs 與限定該分支push的workflow；真正Windows CI run 38845642927 交錯比較兩版／兩種並行數，候選僅記憶體編譯三段原有insert迴圈，無來源檔或產品durability修改，最終結果另記。
隔離故障注入：只移除單人配額檢查，目標測試正確失敗；只移除總數檢查或容量檢查，目標仍通過。總數案例同時超單人上限，容量案例無效PNG可由解碼拋錯，故目前斷言不能證明對應檢查存在與解碼順序；不是產品檢查已缺失。候選精簡：quacks-http三模式重複的認證／資源斷言可集中一次，room-media-http多次邀請／註冊可改各fixture獨立預建帳號；retry刪房後重試、真實持久化與三種引擎差異仍須保留，未刪測試。
診斷提交自查分開兩輪（base46cbeee／head082a290）：第一輪核對任務範圍、原版資料量及斷言不變、隔離執行及不改main門檻；第二輪核對僅目標測試檔的三個迴圈轉換、子程序失敗與逾時非零、固定Node、環境與commit輸出、來源不變驗證及無密鑰。語法／diff檢查及新工具兩版smoke通過；不是完整套件或產品合併審查通過，未開PR／合併／部署。
本機 SQLite 分階段 probe（各版單次、非 CI）：原版小圖1000筆 run 累積426ms、大圖65筆1591ms、exec22ms、close3ms、清理34ms；批次小圖8ms、大圖885ms、exec1008ms、close31ms、清理29ms。包 transaction 確實降低小筆 insert 呼叫成本，但大量 BLOB 寫入／提交仍主導；不能只用 insert 計時宣稱全案例加速。probe兩版目標案例均通過，沒有更改SQLite durability參數。
真正CI最終量測增量（取代「批次未證實」作為CI結論，但不改本機數據）：run38845642927、job116795443025、head082a290a4f16b51ec1ff8f4057ecb094601f0277，Windows映像20261007.264.1／Node22.23.3／4邏輯CPU／約16GiB。原訂12組三輪，因重複診斷較久，主動取消檢查進度；無個案逾時，已完成9組各5項皆status0，共45次個案，兩輪完整配對及第三輪baseline/單檔；job整體cancelled，不是CI通過／全套門檻。兩輪配對quota：concurrency1原版15053／12963ms、批次6107／6903ms；concurrency3原版49007／47353ms、批次5847／11584ms。各版相同原始資料／斷言、記憶體改寫insert準備，來源不變檢查通過。支持Windows CI批次建立候選，不能外推全套節省比例。
原版五案例組wall：concurrency1為92.21／76.96s，concurrency3為103.06／106.27s；quacks retry單檔4.24–4.65s、並行14.94–16.37s，draw churn單檔19.49–27.99s、並行60.70–66.38s。這組負載的並行成本有直接證據，但只有單一runner／兩輪完整配對，尚不直接修改全套concurrency。下一步先實作批次fixture並補能抓到各quota移除的斷言，再用固定head完整CI驗證；重複認證／靜態資源斷言及媒體fixture註冊列為後續精簡，不刪retry／耐久性／引擎差異驗證。原始結構化結果work/windows-ci-analysis/ci-results.json；沒有產品修改、PR、merge、tag或部署。

## 2026-10-16 備份驗證與輕量測試實作
使用者確認讓備份驗證接受可信任的收緊限制，以有效小圖片取代260MiB假資料，並實作先前確認的批次fixture及重複流程精簡。分支codex/lightweight-backup-tests，基線main46cbeee；診斷分支的workflow／工具未帶入。validateMarketImagesDatabase沿用imageLimits，拒絕未知／非正整數／高於預設的設定；正式data-transfer入口仍省略覆寫，維持256MiB／1000／100等預設，不讀備份內限制。驗證器對圖片解碼與receipt上限也沿用收緊的policy，未改正式路徑行為，依release規範測試／等同行為整理不升版。
配額拆成三張有效PNG的單人／總張數／容量邊界，另驗一位元組邊界、PNG decoder呼叫順序、正式預設容量常數與未超容量的損壞圖片。default容量案例只注入聚合bytes，不冒稱真的寫入；小圖真SQLite案例驗SUM(length(bytes))。cold export正式單人101張測試批次transaction，原有跨作者1001張整合案例保留。媒體fixture批次預建獨立成員、四帳戶仍真登入；郎中三purpose仍完整九輪／history／achievements與retry刪房後不重複授獎，僅共通權限／靜態資源檢查集中production。未縮減churn／關閉fsync或更改CI門檻。
四檔focused97/97通過；五種隔離記憶體mutation（刪單人／總數／容量guard、<=改<、quota移到解碼後）均被對應新測試抓到。單次本機比較原混合quota2827ms，五個替代案例合計269ms；整組三檔44項9479ms／新48項10312ms，未證實整組或全套加速，不外推CI收益。結果留本機work/windows-ci-analysis。test:affected因共用來源回退全233檔，依規範實際執行；全套結果另記。
兩輪本機自查分開完成：第一輪核對需求／範圍，保留正式政策、安全邊界與整合場景；第二輪核對邏輯、限值驗證、decoder spy可觀察性、錯誤遮蔽、transaction rollback、fixture帳號／session隔離與密鑰風險。檢查同一基線46cbeee及相同工作區程式差異SHA256 00d1e3a7436bdbccb9fa61fa75d2019517618ef0a2ba90ab1f252442dd5bb876，未發現未解重大問題；此為未提交本機自查，不冒稱PR固定head審查或同head雙平台CI通過。尚未PR／合併／部署。
最終本機驗證：npm run test:affected實際回退全233檔，Windows Node22.22.3完整2306/2306，fail/cancel/skip 0，169408.6394ms，exit0；release check與diff check通過。取代本輪前述全套尚在執行狀態。測試後僅更新證據文件，程式差異hash不變；未提交／PR／遠端CI／merge／部署，不以本機結果代替合併所需同head雙平台CI。
2026-10-16 PR交付授權增量：使用者明確要求開PR、固定提交兩輪審查、等待同一head雙平台CI通過後merge，並比較Windows全套耗時。本機已測程式差異hash仍為00d1e3a7436bdbccb9fa61fa75d2019517618ef0a2ba90ab1f252442dd5bb876；本次提交只增加交付意圖記錄，未改已驗程式。最新固定提交審查、CI／比較及合併證據以本次PR對話為準；不包含部署授權。

## 2026-10-16 #136 測試分層實作
使用者確認規劃並要求先拉最新；已整合 main 1872f78／v2.16.1。僅七個測試檔及文件：churn 記憶體 1000 次＋真磁碟兩次輪替、賽跑引擎／歷史拆分、聊天室獨立帳號、框飾隔離 fixture、郎中保留五組完整九輪但僅 production 真計時、畫猜保留 48／49 邊界而減少重複像素成本。六種故障注入均被抓到；本機與最新固定 head PR／CI 證據見 [實作對照](../TEST-LAYERING-136.md)。未改產品、移除等待室歷史、升版或部署；未盤點全套每項測試。


## 2026-10-19 Vue 多頁前端基礎

候選 2.17.1 以 a1cfde9 建立 Vue 3／TypeScript／SCSS／Pinia／Vite 多頁前端，先遷移登入及成就收藏冊，原 Node REST／SSE 與其他頁面保留。測試站已驗成功登入、畫猜原座位導回、帳密／註冊錯誤、成就分類／空結果／載入失敗重試、320／390／1280／1920 尺寸取樣；11 款開房／狀態／重連及停用旗標舊頁相容已驗。型別、正式建置、開發路由／HMR／proxy 與版本檢查通過，未跑既有測試套件；有效註冊／重設成功、實機觸控及全款完整對局尚未驗。完整責任與限制見 [Vue 前端遷移](../refactors/VUE-FRONTEND.md)。未完成全站遷移。

## 2026-10-19 Vue 大廳與猜歌接續

取代本日「只有登入／成就候選頁」的工程範圍描述：目前十五份文件已接入 Vue MPA，包含大廳、共用帳號／邀請與畫猜、猜歌兩款遊戲候選頁。新大廳三十六項 HTTP／API／SSE、猜歌四十八項 HTTP／API／WAV bytes 與具名 reader 核對通過；不是新 Vue 已通過原生播放、P／作畫手勢或桌機／手機布局。其餘九款遊戲及三份一般文件仍待遷移，完整新 UI 驗收未完成。細項、目前證據與未解事項以 [Vue 前端遷移](../refactors/VUE-FRONTEND.md) 的最新接續區為準，先前瀏覽器證據不能外推至後續候選頁。

2026-10-19 極簡接續：候選文件增至十六份，畫猜／猜歌／極簡三款已接入 Vue，均未宣稱完整新 UI 驗收。極簡三帳號腳本六輪、截止與私人幾何等六十三項實際 API 證據通過；canvas 中途像素、pointer／IME／草稿／焦點與桌機／手機仍待瀏覽器確認。最新範圍與限制見 [Vue 前端遷移](../refactors/VUE-FRONTEND.md)。

2026-10-19 實際 UI 接續：已恢復瀏覽器驗收，修正大廳桌機組合與公開標記 app-level provide、輪盤 blur 與一般快照取消問題；不要沿用「瀏覽器仍被舊確認框阻擋」的歷史描述。大廳雙帳號角色／標記、四房列表及離線恢復，猜歌原生六秒播放狀態／單人三題／草稿 reload／略過取消返焦，畫猜對端持續送筆畫時保留猜題草稿與提示已實際觀察。相同多來源 watch 問題已修至畫猜／猜歌／極簡相關場景，部分結果及極簡確認回歸仍待驗；完整全站遷移與所有遊戲正常／失敗 UI 驗收尚未完成。證據界線以 [Vue 前端遷移](../refactors/VUE-FRONTEND.md) 最新區為準。

2026-10-19 瞎掰接續：候選文件增至十七份、四款遊戲。瞎掰已接 Vue；三個 QA 帳號 API 六十四項及本人＋腳本兩席的實際 UI 三輪、秘密卡刷新／十秒截止、質疑／選人取消確認、實際加減分與並列回顧、斷線人工重試已觀察。桌機三欄適配與完整設定按需展開，詳細證據與手機／專注最新狀態見 [Vue 前端遷移](../refactors/VUE-FRONTEND.md)。九真人反應／真實聽感／全部 UI 競態未驗，不把候選接入數當全站完成率。

## 2026-10-20 PR #145 Windows 格式檢查修復

原 head 7e5c184 的 Linux CI 通過，Windows 在格式步驟因 34 份 JSON／HTML／YAML 的 CRLF 失敗，全套未執行。補齊 .gitattributes 的 formatter 副檔名 LF 契約；在獨立 worktree 處理，未納入其他工作區待提交 UI 變更。不放寬格式檢查、不改 baseline 或產品程式，最新跨平台驗證以 PR head CI 為準。

本次回歸：Linux 與 Windows 各 354 份格式檢查、565 份未改 legacy，0 failures。Windows Git core.autocrlf=true：舊規則重新 checkout frontend/package.json 實際含 CRLF，套用修正重新 checkout 後為 LF。Linux format --write 為 0 formatted，git diff --check 通過；未在本機跑完整套件，未修改 UI 或部署。

2026-10-17／2.18.0本機候選：猜歌雙階段、十二遊戲成就獎勵、大廳彈幕及郎中檢視／有限庫存。已整合main a1cfde9；實作、原生驗收、Stitch保留決策與未校正副歌時碼等限制見 [本批驗收](../MUSICQUIZ-LOBBY-REWARDS-PROGRESS.md)。未發布／部署，不能沿用本機檢視代替最終SHA兩輪PR審查與雙平台CI。


## 2026-10-17 同頻題庫與淘汰賽底層

新規格／狀態：docs/specs/MAJORITY-TOURNAMENT-20261017.md、docs/MAJORITY-TOURNAMENT-PROGRESS.md。mode=music／scenario 引擎採8／16／32強，每輪唯一多數+1，平票0分但公開抽籤晉級，最終選項冠軍及玩家並列排行。一般抽題／佇列／投稿不得取得cruel／music／scenario題庫。首輪完整2410/2411暴露普通Majority歷史快照誤帶大型曲庫的容量回歸；改模式按需載入及開局按模式保存來源，容量／新模式／曲庫34/34回歸通過，最終全套另記進度。新模式UI尚未接入，不視為可玩交付。

2026-10-17 同頻淘汰賽後續（取代先前「Stitch／UI待接入」狀態）：已取得Stitch實稿與8張原創情境PNG、接四玩法／主題賽程／個人試聽／雙排行。曲庫205（日語53）、情境256、一般366、殘酷144；真HTTP兩種8強賽與IAB桌面／手機／專注／重連已驗。試聽內嵌顯示無法播放、2pick四來源仍安全驗證未讀完，未虛報播放或原站比例篩選。來源、證據與最終測試見[本次進度](../MAJORITY-TOURNAMENT-PROGRESS.md)。未PR／CI／部署。


## 2026-10-18 我的角色表情編輯／刪除
本機 2.18.0 候選新增作者改名／換圖與二次確認刪除；交易保留音效、引用回退 neutral、房間／大廳短暫表情清理、主圖片保護。全套2416/2416＋新增UI4/4及IAB桌機／手機深淺色驗證；未發布／部署。證據與限制見 [本次進度](../PROFILE-EXPRESSION-EDIT-PROGRESS.md)。


## 2026-10-18 六類曲庫與題庫盤點
曲庫205→308，六分類皆擴充；日語91，YUI官方來源14，流行63／搖滾49／動漫35為重疊標籤。同頻猜歌排除既有冷門後307；原創情境256仍待原站資料。核對曲目身份、原始年份與特殊古典年份基準，逐首播放／副歌仍未驗。23/23相關驗證，完整測試結果另記 [本輪進度](../MUSIC-EXPANSION-20261018.md)；未PR／部署。


2026-10-18歌曲資料增量：指定35位歌手／樂團新增172首，musicquiz-songs.json現480（zh120/jp163/en107/kr53/viral19/classical18），同頻music池479。新增4項回歸測試檢查覆蓋、25種曲風上限、特定版本及實際答案別名，相關27/27通過。完整affected結果待本輪結束追加。前奏／副歌與地區實播未驗，clipReviewed及playbackVerified維持false；航海の唄為官方短版。詳docs/MUSIC-REQUESTED-ARTISTS-20261018.md。未PR／推送／部署，2.18.0同批不再升版。

最終驗證：test:affected按核心／未知路徑保守回退248/248測試檔，2427/2427通過（189610.7912ms），fail/cancel/skip/todo皆0。最後補核對並修正專屬天使2006首發年後，猜歌與同頻27/27再驗通過（136.296ms）。release:check 2.18.0、git diff --check通過；HEAD及origin/main均a1cfde9f7a141c619ae60e5048f4abed95796013。沒有遠端CI／正式站或逐首實播結論。

2026-10-18使用者連結增量取代前筆480首：新增Avril Innocence／盛宇與劉聰從前以後PT.1／GAI威遠故事／陳忻玥入土之前，依指示移除GAI華夏；總483、同頻482、zh122/en108。新增一項共用池／移除／同名異曲回歸。完整測試結果待下方本輪追加，前次2427不是本輪結果。

2026-10-18七個使用者連結最終增量取代前筆483：新增7首、移除GAI華夏，共486（zh125/jp163/en108/kr53/viral19/classical18），同頻485。前三個新連結為美秀偷偷愛／愛情的大壞蛋與黃鴻升忘了我。第一批4首後full2428通過，後續3首只補相關28通過，未把舊全套當最終重跑；未實播／校正／PR／部署。

2026-10-18本批續作：416情境／256強、揭曉投票姓名／票比／本人加分與Stitch素材已接入。淘汰賽historyState改記當時裁決所需投影，避免每次累積整份results／未來賽程；12人256強3316快照預設容量測試通過。猜歌YouTube來源識別與單一播放器重試／舊回呼隔離已修正，3項客戶端測試通過；個別150限制仍存在，不能宣稱全曲庫可實播。最新完整回歸待最終結果，詳本批progress。

本批最新完整Windows回歸2434／2434通過，約285.6秒，無fail／cancel／skip／todo；此為本機候選，未作PR最終SHA或雙平台CI驗收。

2026-10-19本機歌曲1183首、前奏十選一、等待室操作宿主與大廳社交按鈕分組；來源／限制／驗證以 [本批紀錄](../MUSIC-CHOICE-EXPANSION-20261019.md) 為準。未PR／CI／部署。

2026-10-19驗證追加：完整254檔2449/2449（243.67s），後續只改曲風metadata再複驗44/44；來源清單1183首。真人／AI真HTTP入座已通過。原生桌機／手機畫面仍待最終核對，不能宣稱驗收完成。

2026-10-19後續右上專注與聊天室修正：共用入口脫離右下浮動、聊天室布局移回自身CSS，最後完整2451及focused27通過；十二頁桌機／手機專注切換及三款聊天室真HTTP／截圖已在隔離Edge headless驗證。此結果取代前筆對這批布局的待驗狀態；沒有逐首音樂或所有階段實玩結論。詳[驗收](../CHAT-FOCUS-20261019.md)。

2026-10-19音檔優先接線：兩款猜歌共用受當前題目限制的MP3串流、Range及個人音量；完整2454、後續14與真MP3背景瀏覽器驗證通過。素材仍在批次準備，非全曲實播或副歌校正，未PR／部署。詳[音檔進度](../GAME-AUDIO-20261019.md)。

2026-10-19最新音檔前奏6.5秒、精華30秒，1180首成功、3來源仍失敗；音樂卡彈幕框跨玩家同步、管理後台分類與資料夾上傳已完成48 focused與1920／390瀏覽器驗收，最終完整affected 256檔2459/2459通過（313.40秒，無失敗／略過）。詳[最新音檔紀錄](../GAME-AUDIO-20261019.md)。未PR／部署；精華切點未逐首聽審。

2026-10-19後續：1190首全部音檔成對備妥。完整音檔自動6.5／30秒草稿、重整恢復、手動切點、確認套用、保存音源重切及6格式真FFmpeg已驗。猜歌二選一真Edge三人16強15場、秘密投票、多數+1、冠軍及排行，實際30秒原生播放與換題清理通過。新增個人判定短音效，修正完整曲庫歷史快照容量；最新測試以GAME-AUDIO-20261019.md最後追加為準。未發布／部署。

2026-10-19最新完整affected259檔2473/2473通過，252.26秒。猜歌挑戰四種個人判定及同頻三席多數／少數原生音效已驗；完整曲庫開局保留歷史完整results。詳GAME-AUDIO-20261019.md最後段；手機收藏兩卡撐寬屬另外未修布局問題，勿宣稱全部手機UI通過。


## 2026-10-21 共用房間介面精簡

2.17.5 先修共用 RoomChat／RoomHeader，移除指定提示、字數 footer、彈幕框入口與房間手動更新；媒體／表情同式置於輸入框上方。郎中等待中央只留當局設定與配書／開局，遊玩三工具移頂欄，獨立工具視窗替代七分頁；極簡移除回顧及可見鍵盤提示、預留單行倒數與等高聊天室。無呼叫端的 expose／席位參數與舊導覽／樣式已清除。第三份 Figma 原生共用元件及 42 張相關畫板同步，RQ13 改更多工具並保留 frame ID。實際桌機／手機取樣、選書開局、聊天／表情／媒體開合、幾何自動同步與十秒截止已觀察；型別／多頁建置／格式／版本／diff check 通過。詳細範圍、尺寸與未驗分支見 [本批紀錄](../refactors/SHARED-ROOM-UI-SIMPLIFICATION.md)；不把本輪局部驗收外推成全站完整回歸或所有音效／播放皆通過。


## 2026-10-21 玩家卡片與間距（2.17.6）

依 C02 恢復共用玩家卡片框線／圓角／留白與間距，名單操作置中；聊天回饋槽移到分隔線上，工具列上下皆 8px。郎中占卜列 border-box 避免裁切，獎勵選擇移除空圖示，UiIcon 無圖案時不佔位。實際桌機／手機、亮暗色、畫猜與極簡共用名單及郎中爆炸後領獎觀察通過；完整證據與未驗範圍見 [共用房間精簡紀錄](../refactors/SHARED-ROOM-UI-SIMPLIFICATION.md)。


## 2026-10-21 全站共用介面巡檢（2.17.7）

共用 ResourcePanel 及指定頁面外框統一採 Stitch 1px／12px／無額外陰影，成就標題與主框對齊並移除群組重框；共編分頁、房間開始／加電腦與資源重試接 UiButton。收藏手機分頁固定等高且計數不換行，送禮名單雙分數同列並清除過時槽位樣式。16 個一般／工具入口、11 款等待室及 7 款遊玩狀態已有桌機／手機取樣；320px 收藏與共編另驗。建置含型別、格式、版本與 diff 檢查通過，未跑自動測試套件。完整依據、實測數值及未驗界線見 [全站版面巡檢](../refactors/STITCH-SITE-LAYOUT-AUDIT.md) 最新區；不可外推為全款完整對局驗收。

2026-10-21 #151：共用 heading／label 繼承容器，selected surface mixin 配對 ink／muted／link／focus，不重綁全域 ink。唯讀 DOM 對比工具區分 hidden／disabled／人工項目，包含原錯誤反例回歸。29 頁量測摘要入版控，147 張原生圖與測試資料只留忽略目錄；全頁畫布不讀應用私有狀態。詳 [表面配色驗收](../specs/SURFACE-CONTRAST-151.md)，保持 Draft 待人工最後檢查／CI，未部署。

2026-10-21 #154 候選2.20.0：entry-intro head bootstrap持有唯一EntryPreferences，Vue／legacy共用，auth成功動畫檢查同一偏好；預設開啟、本瀏覽器保存，關閉不建立可見遮罩或三秒等待。20項回歸及原生雙宿主／四組設定取樣完成，限制見 [開場偏好](../specs/ENTRY-INTRO-PREFERENCE-154.md)。#153已合併f183242，第三份Figma仍受唯讀／額度阻擋，沒有成功同步；本票保持Draft、未部署。

## 2026-10-21 聊天室原稿排版與外框（2.17.8）

C03 訊息移除頭像欄，改姓名／相對時間在上與細框泡泡在下，還原原生稿邏輯尺寸並保留 44px 操作區；時間沿用原時間戳／房間 offset，timer 卸載清理。C00 桌機單一矩形框與側欄分隔集中 room-surfaces.scss，手機保留換列並固定聊天室高度、長訊息內捲，遊戲棋盤／內容卡／浮層不套外框清除。共用暖灰色票、body margin、側欄捲動與猜歌空白 gutter 一併整理。11 款桌機／手機、7 款遊玩取樣、320px 長訊息／純文字／返焦及媒體／表情開關已有實際觀察；型別／多頁建置與格式版本檢查通過，未跑自動套件。證據數值與原生全螢幕等未驗界線見 [全站版面巡檢](../refactors/STITCH-SITE-LAYOUT-AUDIT.md) 最新區，不外推為全遊戲功能回歸。

2026-10-21 候選2.22.0：大廳場地移除，LobbyBackdrop 將角色 teleport 到 body 後方；點擊目標往上沒有控制項、文字或有底色／框線的面板才算地板。前後端移動邊界同為 X 6–94%、Y 12–97%。進場特效 7 款（apparition.ts），選擇存 localStorage，經 GET /api/lobby?entrance= 送伺服器白名單後隨訪客下發。保留 #159 角色對話。

2026-10-22 候選2.23.0：ProfilePage 上傳改為 createDialog／expressionDialog，關閉即清除未送出草稿；ImageChoiceGrid 新增 append slot 放「我的作品」＋卡片，ExpressionEditor 新增 actions／sound slot（音效狀態仍由 ProfilePage 管理以保留離開提醒）。好友角色只保留頁面上的試聽區。MAX_CHARACTERS=20 於 src/profiles/uploads.js，前端常數同步。設定頁 EntrancePreview 以 apparate 播放目前角色，左欄最後一卡吸收剩餘高度。

2026-10-22 候選2.24.0：src/http/static-cache.js 提供快取標頭；setSecurityHeaders 仍先設 no-store，HTML／API／遊戲音訊不變。/frontend-assets 為 public immutable；公開靜態檔 no-cache＋內容 ETag（記憶體快取，stat 變更即重讀）；需登入的檔案為 private no-cache；角色圖與音效帶 ?v= 時 private immutable（characterMedia 已拒絕過期版本）。座位與大廳頭像為 /characters/<id>?v=<內容版本>，由 app.js portraitUrl 記憶；任何 /api/profile/ 或 /api/admin/ POST 完成後 refreshPortraits 清除並更新所有座位。量測腳本 tools/qa/perf-measure.cjs，紀錄在 docs/performance-measurements.md。

2026-10-22 2.24.1：正式站實測 Cloudflare 把 origin 的 `no-cache` 改寫成 `max-age=14400`（區域 Browser Cache TTL 4 小時，只會延長較短的 TTL）。`no-store` 與 `private` 不受影響，所以可重新驗證的回應一律用 `private, no-cache`；immutable 打包檔不受影響。若日後把 Cloudflare 的 Browser Cache TTL 改為 Respect Existing Headers，可再考慮讓公開檔被邊緣快取。

2026-10-22 候選2.25.0：src/media/thumbnails.js 以原圖 sha256 為鍵，在 `<db>.media-thumbnails/` 存 128／256／512 WebP（`.same` 代表原圖已不大於縮圖，或原圖無法解碼）。原圖與權限仍在 SQLite，縮圖可隨時刪除重建。角色圖、內建角色、`/characters/<id>`、作品與 `/api/profile/avatar` 都接受 `?size=`；縮圖尚未產生時回原圖並標 `private, no-cache`，不會被當成該尺寸快取。正式設定（config.settings）會在啟動時，以及角色／作品 POST 完成後依序補齊縮圖；測試與嵌入式 app 只在有人要求尺寸時才產生。前端以 services/image-size.ts 的 `sizedImage` 加上尺寸；座位與大廳頭像由伺服器帶 `size=256`。

2026-10-22 候選2.26.0：六張內建大圖改為 800 px WebP，`src/app.js` 檔案表保留舊 `.png` 網址並指向 WebP（`public/bluff.js` 與兩支 QA 腳本是舊格式檔，所以沒有改）。`src/media/audio.js` 以 WAV 內容雜湊在 `<db>.media-audio/` 存 96 kbps 單聲道 MP3：只有正式設定（`expressionSoundMp3`）會轉換，轉換中回 WAV 並標 `private, no-cache`；找不到 ffmpeg 時不留下任何紀錄，安裝並重新啟動後就會補齊。原始 WAV 仍是 SQLite 中驗證過的原檔。

2026-10-22 候選2.27.0：`frontend/src/services/preload.ts` 的 `warm()` 在閒置時以 `<link rel=prefetch>` 預先抓取，每個網址只抓一次；`preloadAllowed()` 在 Save-Data 或 slow-2g／2g／3g 時回 false。`services/game-assets.ts` 列出各遊戲進行中才用到的資源（音效依 `public/shared/audio-settings.js` 的登記表），GameRoomPage 在 waiting 時呼叫 `warmGame`；GameCarousel 在 pointerenter／pointerdown／focus 時呼叫 `warmGamePage`，向 `/api/frontend/page-assets?type=` 取得編譯後房間頁的 `/frontend-assets`、`/shared` 腳本與樣式（thunder 對應 race）。大廳 store 在第一份快照後於閒置時載入表情與 128 px 縮圖。新增遊戲的進行中素材時，請一併更新 game-assets。

2026-10-22 2.27.1（#165）：RoomMedia 原本在任何其他 `dialog:modal` 開啟時呼叫 `close()`，而 `setWindow(false)` 會讓 YouTube 影片 `exitVideo()`，所以邀請朋友、遊戲說明或確認視窗都會中斷影片。現在其他 modal 只蓋在點播視窗上面；Escape 在有 modal 時本來就不處理。回歸測試在 `frontend/tests/media-modal.test.cjs`，實機重現腳本在 `tools/qa/media-modal-continuity.cjs`。

2026-10-23：本機候選2.28.0接入使用者Stitch匯出20款進場、11款共用背景與成就、獨立屍魂界網站開場、即滑即送Ping及管理員重設隔離。來源缺失修補、試用音效政策、驗證與發布限制見[本批整合](../STITCH-COSMETICS-20261023.md)。本筆取代較舊「背景僅本機」及「屍魂界是角色特效」描述。

2026-10-23後續：大廳隨機換位依最新指示改按 R，點角色仍立即開表情。獨立試玩初始化預設全成就／獎勵解鎖，正式資料不變；新介面與完整驗證見[本批整合](../STITCH-COSMETICS-20261023.md)最後一節。

2026-10-23 補充：Ping 原生圖示與音效分開保存；千本櫻新增中央花瓣飄落；網站開場維持原樣。詳見 [本次改動清單](../CHANGES-2.28.0.md)。

2026-10-23 同批追加：只更新特效.zip 中指定五款、保留千本櫻落花；成就及獎勵卡發光、帳號獎勵兌換與重設隔離、Ping 圖示同色光暈。具體範圍與證據見 [修訂與兌換](../EFFECTS-REDEMPTION-20261023.md)。

2026-10-23 最新：截圖指定九款卡片背景動態、法院灰藍石材與日夜文字對比、全廳 30 秒；四組兌換分開開獎勵，試玩不再預填成就。Issue #204 四向跨邊界僅開票；詳 [來源及驗證](../BACKGROUNDS-REWARD-CODES-20261023.md)。

2026-10-23 最新調整：[介面與新開場](../LOBBY-CLEANUP-OPENING-20261023.md)。
2026-10-22 #181 候選2.30.1：TelephoneScene 猜詞改原生 v-model 組字保護，computed setter 沿用 changeText，scope／stepId key 隔離新頁。實際元件反例先失敗，修正後2項及前端29項通過，Chrome CDP原生IME 1920／390驗證通過；真人輸入法／實機未驗。證據與界線見 docs/specs/TELEPHONE-IME-181.md；未部署，最終CI／審查以PR為準。
2026-10-22 候選2.30.0：瞎掰王語音字幕。前端 `composables/speech-captions.ts` 使用瀏覽器的 `SpeechRecognition`（zh-TW，Chrome／Edge 送 Google、Safari 送 Apple；Firefox 不支援，按鈕會停用並說明）。只有按下「講話」才收音，再按一次停止；換輪、離開口說階段、斷線或分頁隱藏時自動停止。只送文字：中途字幕每 0.7 秒最多一次，完整句子立即送出。伺服器 `POST /api/bluff/caption` 不經 action 歷史與 mutation 配額（每分鐘 150 次），`BluffRoom.caption` 只在 discussion 接受目前回合；中途字幕在記憶體中顯示 6 秒，完整句子進入 `transcript`（上限 120 句、每句 200 字），揭曉時複製到 `results[].transcript`。src/games/bluff.js 已在獨立 commit 中格式化。實機重現：`tools/qa/bluff-speech-captions.cjs`（以替身辨識器模擬，因為 headless 沒有麥克風）。

2026-10-22 #182 候選2.31.0：TelephoneRoom.revealIndex／review 快照及房主 reveal 指令，expectedIndex＋receipt 防重送跳頁；Vue／legacy 每次只呈現一個片段，結算房主移交及新局重置。9項引擎／HTTP、前端30、當時全套2583通過；最後CSS後Vue3與原生Chrome三席9片段／1920亮390暗／重整專注通過。既有完整books／歷史公開規則不變，非新增資料保密。Figma額度阻擋重取，未宣稱已同步。證據界線見 docs/specs/TELEPHONE-REVEAL-182.md；CI／審查以PR為準，未部署。

2026-10-22 #183 候選2.32.1：傳情畫意移除常駐同步／畫布額度列，store一般草稿同步保持notice空白；失敗、本地儲存／恢復及配額訊息仍顯示。固定44px回饋槽避免提交跳位。Vue／store5項通過，原生Chrome1920亮390暗持筆／ACK／放開與注入503皆驗，狀態切換外框等尺寸且像素無白屏；不含真人觸控／完整換輪。詳 docs/specs/TELEPHONE-NOTICES-183.md，CI／審查以PR為準，未部署。

2026-10-23 #184 候選2.34.0：開局 prompting 第零輪先各自出題，90秒／全員送出早開；逾時採已同步非空主題、空白選定題庫備援，下一席作畫並重設期限。歷史替換主題頁、舊出題receipt無副作用重試及畫猜成就排除均有回歸；編譯Vue／Pinia電話七項通過。最終原生三席與整合測試／雙平台CI、失敗紀錄以PR為準，未部署。詳 docs/specs/TELEPHONE-TOPICS-184.md。

2026-10-23 #214追加：QuacksFlask合併數字與獎勵為單組11格；QuacksAlchemy使用獨立預覽dialog。新Vue DOM回歸驗預覽不送出、可達與available守衛及第九輪換分。引擎未改，待使用者本機驗收後提交；測試與截圖見[本輪紀錄](../specs/QUACKS-UI-214.md)。

2026-10-23 #214同日最新：病患彈窗依使用者截圖改回原始完整玻璃板（唯讀、無store命令）；實際調製保留單組選格。病患卡刪開局長句，改短按鈕文字。取代先前預覽合併格子紀錄；詳QUACKS-UI-214.md後續指定段。
2026-10-23 #215第三輪：依使用者追加修訂聊天表情紀錄、彈幕垂直安全帶、超寬互動背景、32×64px收合框與22px視覺把手（44px點擊槽），以平均側欄寬置中遊戲。語意回歸9項及真實HTTP通過；瀏覽器控制逾時，新增桌機／手機外觀未驗收。未提交／未正式發布，詳 [最新規格與界線](../specs/ROOM-BACKGROUND-215.md)。

2026-10-23 #215第四輪：提示由focus-within改為受控4秒及互動清除；22px箭頭貼視窗左右、依面板高度置中，收合空白框改回原面板全高。32×64px短框決策已被此輪取代，3項真實Vue回歸通過；詳ROOM-BACKGROUND-215第四輪。

## 2026-10-23：大廳對話裁切修正（本機待驗收）

基線 abbdbd8，僅修改 LobbyBarrage 輸入列及本批 CHANGELOG。送出鈕使用共用網格列保持在輸入框右側，44px 操作區；焦點向內顯示的 selector 高於全站主題，避免主題的外擴 outline 被 dialog 捲動槽裁切。原截圖的按鈕掉列未在目前建置直接重現，不能宣稱已確認該部分的唯一成因；焦點框裁切已在實際 Edge 截圖確認並修正。

Windows Edge 自動回歸涵蓋 1920×1080、1280×720、390×844、320×568、640×360 深淺色及 200% 文字、hover、pending 幾何、失敗保草稿、Enter 成功送出／關閉與 Escape 返焦，14 組檢查及零 pageerror。Vue 型別／正式建置、前端57項通過。test:affected --base HEAD 因 Vue 未映射回退289檔全套：2651通過、1檔因本機缺 tar 未載入、1條件略過；於 ignored 測試依賴補齊固定 tar 7.5.22 後，該檔獨立重跑1項通過。前端缺少的 linkedom 0.18.13 亦只放 ignored 測試目錄，未變更版本控管的依賴。

證據：ignored work/playtest/chat-clipping-{regression.cjs,results.json,final.png,affected.log,archive-retest.log,frontend-tests.log,build.log}。隔離試玩 http://127.0.0.1:3030/，外部 Edge 已登入並開啟對話供驗收。未 commit／push／新PR／部署，依 AGENTS 等待使用者驗收。

2026-10-23 網站開場音效接登入手勢：Vue及legacy登入在認證await前呼叫EntryIntro.prepareSound，於原生submit同步resume AudioContext；成功後三款開場以同一context解碼播放，保留關閉／音量／略過與pagehide清理，取消下載及revision阻止晚到播放。無WebAudio或resume失敗沿用HTML音訊及手動恢復入口，不保證直接首次開網址能自動發聲。59項focused、Vue型別與建置通過；Edge全新context + document-user-activation-required + 800ms登入延遲，三款真MP3皆source.start且context running、零額外播放點擊與pageerror。聲卡聽感及Safari實機未驗。證據ignored work/playtest/entry-gesture-{tests.log,browser.cjs,browser-results.json,build.log,affected.log}。本機3031獨立資料，未提交／推送／發布；正式站尚未更新。

2026-10-23 上述入場音效最終驗證補記：test:affected --base HEAD回退全套，2654通過、0失敗、1環境條件略過；前端57通過。外部Edge以真登入操作完成開場後進入3031大廳。所有變更維持未提交。

2026-10-23 PR準備更新：先前213已納入main，改基底c73c093、新分支codex/chat-opening-audio-fix、版號2.40.2。保留main共用按鈕及壓縮音檔；補200%字體時輸入框stretch和按鈕rem尺寸。最新後端2685通過／1條件略過、前端71通過、型別／建置／Edge14項布局及3款登入音訊均通過。QA pending改用aria-busy配合main新元件。局部樣式續修後重跑瀏覽器；後端完整結果不冒稱對後續純樣式另重跑。兩輪本機差異審查核對本次範圍、取消／靜音／登入時序及無憑證，無未解重大問題；Safari實機與首次直接進站自動有聲仍不保證。證據ignored work/playtest/chat-pr-*。尚未提交／推送／建立PR，等待本次具體發布確認。

## 2026-10-23 PR #219 main 整合與複驗（2.42.1）

依使用者「拉下來解衝突後合併」授權，在獨立 worktree 將 main 38a186ca444a7a9d21fac470d75a778b52559217 合入原 PR 96752b3。四個衝突檔僅為 CHANGELOG、package／lock 及本角色紀錄；保留 main 的 #214／#215 與本 PR 歷史，原 2.40.2 候選改為 2.42.1，不重建已存在版本。相對 main 只有原 PR 十個檔案，郎中與共用房間修改沿用 main，不覆寫。

審查重現 Web Audio 路徑播放途中非零音量變更未生效，新增真實行為回歸先失敗後修正：保留 GainNode 並在 AudioSettings 訂閱時更新音量；略過、靜音及離頁仍取消下載／音源與訂閱。auth-entry 11項通過；Windows Node26.2.0 前端89項、正式 build（含型別）、UI ratchet（固定 base 38a186c）、效能 build 預算、release patch 及格式檢查通過。本機 test:affected 回退292檔全套，完整結果與最終同SHA CI另記原PR；不可沿用上一輪2685作為本輪總數。

新 Edge 工作階段、嚴格 document-user-activation-required 政策、800ms認證延遲：三款真MP3各自同context running播放，不需恢復點擊，播放中音量0.1立即生效。1920×1080／390×844／320×844、深淺色及200%字體共12組對話操作（pending幾何、503保草稿、Escape關閉、Enter真HTTP送出）通過；加三款音訊共15組、零pageerror。驗收腳本首輪因連續發送觸發既有1500ms防刷而失敗，改為等待3200ms後通過，未改正式防刷規則。隔離帳號只兌換獎勵、不造已達成成就。證據ignored work/qa-pr219/{browser.cjs,results.json,chat-mobile-dark.png,transfer-retest.log}及根目錄各測試log；Safari、實機觸控與聲卡聽感未新增驗證。此筆取代上節未提交／尚待發布的狀態描述；遠端合併／CI以PR最終紀錄為準，未部署或操作正式資料。

本輪本機全套結果補記：292檔、2691項，2689通過／2失敗／0略過；兩項均為未修改的data-transfer schema4／5 HTTP驗證，Node26 fetch回報bad port（系統隨機埠被Fetch禁用），非資料斷言失敗。同環境單獨重跑兩項全通過。最終新增音量回歸另跑auth-entry 11／11通過；不得把原全套寫成零失敗或宣稱包含新增測試。Linux Node22最終同SHA完整CI仍是合併必要門檻。

2026-10-24 #230 Draft PR #242 整合候選：RoomSceneLayout接十一款（股市除外），保留main 0f47f58的郎中流程列、人物卡切鍋與設定預覽；C00整桌／側欄表面排除has-room-space。最新main整合後後端2710過／0敗／1環境略、297檔，前端107/107；型別、正式建置、UI ratchet、效能、版號與格式檢查通過。Edge畫面88組無pageerror；撲克手機首次縮放有單次寬度瞬間讀值，單獨重測寬度390px正常；十一款桌機與手機側欄操作通過。所有階段測試依使用者要求暫停；三人兩輪未重現，不宣稱修復。PR仍為Draft，未合併、部署或跑CI。詳docs/specs/ALL-GAME-SCENES-230.md。

2026-10-24 #242 衝突整合：main 合入 #243（97b3c36，舊前端清理），保留 PR 2.43.0 及 2.42.8 歷史，統一 package／lock 版號。未重跑完整遊戲階段；只驗衝突標記、diff 與版號。PR 狀態由 GitHub 顯示 Ready for review，內文 Draft 狀態描述待同步。

2026-10-24／#246：場景戰鬥共用規則新增other兌換資格、25%暴擊及2秒護盾減傷。房間座位ID經私有seats對應帳號；不接受客戶端加成、重複兌換不疊加，不改桌遊分數／歷史。最新main獨立候選的驗證與限制見 docs/specs/SCENE-COMBAT-VFX-246.md。


## 2026-10-24：#233 共用腳本 ESM 模組化驗收

38 支現役共用腳本與呼叫端改為明確 import，public 不再承載可執行 JS；29 份文件均從 Vite 建置。發布包須保留 frontend/package.json 與 engines 原始碼，Node 22.13+ 的伺服器純計算依賴同步讀取相同 ESM。模組邊界檢查加入建置；未提高 UI baseline。#234 依使用者指示等待 #226、#227 合入。

隔離候選 2.44.3（整合 main 00b52ace）實作階段 test:affected 因未知依賴保守回退全套：1,880 通過、零失敗／略過；前端 116 通過。型別／Vite、UI ratchet、效能資源預算及實際 ffmpeg 轉碼通過。實際 HTTP 核對 29 份文件、233 個資源，其中 209 個雜湊資源位元組及 immutable 標頭相符。原生 Chrome 11 款遊戲各於 1920×1080、390×844 載入，22 組沒有水平溢出；兩個音效工具頁載入、音效庫搜尋正常。這不是所有遊戲完整真人流程或實機觸控驗收。

三名隔離玩家的 SSE 設定通知、私有題目隔離、104-byte 未變回覆、聊天及邀請推播實測通過。雙人 Chrome 作畫持筆途中雙方黑色像素 4,215；繼續持筆增為畫者 9,010／觀看者 8,602，放筆並完成確認後雙方 9,010，沒有丟失活動筆跡。倒數 115→62 秒正常；跳過確認後保留 21 批筆跡作品，第二輪角色輪替、雙方畫布清零，倒數 120→95 秒。私有 presence helper 僅維持隔離帳號在線，不是瀏覽器 presence 的驗證。早期瀏覽器操作逾時後改用獨立本機透明診斷代理複驗，請求回 200；沒有據此宣稱網際網路延遲或所有網路競態均已驗收。實際最終提交、CI 與正式部署另依 PR 紀錄核對。
