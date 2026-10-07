# Agent 長期記憶索引

2026-10-07 [WebGL導入評估](../research/WEBGL-ADOPTION-ASSESSMENT.md)：已按v1.8.1程式與官方資料盤點；建議雷霆特效局部原型，大廳先比較transform，畫猜renderer與傳送瓶頸分開。這是研究提案，未安裝或實作WebGL、未跑效能原型，不改正式v1.8.1；接手先讀該文件及PROGRAMMER／ANIMATION最新記錄。

2026-10-07畫猜順暢度第一批 **P0／有限local-draft P1完成並正式v1.8.1**：140ms時間flush、有界單in-flight sender與rAF／coalesced；P1只有限明確local draft走opaque layer，settled／viewer原同surfaceclassic，任意fill sticky classic至reset，單組15checkpoints＋1base≤8MiB。P2並行POST／P3抽稀未做，API／codec／PR30額度不变。

正式v1.8.1／6707a9edf07839c3307dd230ff6eeca5fa92bf62已於UTC03:30:44.024Z零房間guard部署，PID107492→110715、service／tunnel active。Windows1076／1076／37689.229ms，Linux Node22.22.1 1076／1076／189955.125522ms，各fail/cancel/skip/todo0；本地受測tag固定，沒有新PR／push、PR43未改。schema15／21schemas／20non-session rows+BLOB與8帳戶全fields保留、integrity ok／FK0；sessions161→165為已登出的QA登入，不說sessions不變。SQLite線上備份與另時點files/env archive不是atomic cold snapshot。公開版號與5資源精確內容/no-store已驗，沒有逐項驗5資源MIME；正式3會員HTTP/SSE duplicate／nonartist400／undo-clear quota不退已驗。Chrome正式僅背景home版號；local像素／輸入證據另列，own房／auth／tabs／preview／control已清理，不改前景或偏好。

native19場景18個對fresh strict RGBA0；fill-dependent362 RGB／max13／alpha0／exactmask0，新wrapper與legacy SHA同而整體strict flag仍false。captured dense3場景均fresh0。實際1000 synthetic-move／948有效點／16chunks963含anchors兩席同JSON，但artistfresh0／viewerclassic67 RGB／max54、viewer baseCopies0／mutable0；同capture timeout20ms／warmup0及1的原classic與opt-in Infinity同樣67／max54、old/new直接diff0／SHA相同。此證據只限受測trace，不歸因layer／硬體／GPU／CPU，不寫19native全部fresh strict或所有雙席pixels相同；兩組rAF控制2秒未advance而未完成，不能列pass。工具慢線／背景970ms不作人體FPS。

來源、備份、精確scope、未驗rAF／原生取消／真收藏或其他硬體與後續提案见 [本批進度](../DRAWING-SMOOTHNESS-PROGRESS.md)與 [spec](../specs/DRAWING-SMOOTHNESS.md)。下方v1.8.0與更早紀錄為歷史，後續文件提交不移動受測tag；原HAR／cookies／帳密與.local偏好不提交。

2026-10-07正式 **v1.8.0**／`5687561`：五款單一current／混合queue／timeline、一般席點播、host／manager共享控制及角色、個人影片接受／退出、同emoji與角色入口已發布。Windows Node24.14.0／Linux Node22.22.1完整各1034，隔離背景Chrome三席真Audio／YouTube、排序／角色與最後390px／1280×720通過；台北10:24:21（UTC02:24:21）公开版號no-store／6資源與三自有會員API驗收完成。正式PID107492／services active；schema15、21schema、20非session rows／BLOB與8帳戶全欄位保留，sessions157→161是已登出的QA登入，不能宣稱sessions未變。own房間／session／preview／分頁已清理，等待房QA歷史保留；原PR43未改，無新PR／push，tag固定受測程式。接手讀 [九項證據及限制](../UNIFIED-ROOM-MEDIA-PROGRESS.md)及 [共用契約](../specs/UNIFIED-ROOM-MEDIA.md)。queue與manager只屬room instance；200%文字、真Google拒播／oEmbed、多設備／弱網／喇叭未驗，fixture導航的draw重連提示不作正式SSE診斷。下方v1.7.2為歷史基線。

2026-10-07正式 **v1.7.2**／`6fcd55c`：PR43新P2舊state晚於新social ACK補播過期音效已修正，server anchor按performance經過時間前進，old/equal/missing不重設age，gap亦用mono。原PR v1.4.2／`ca931b7`雙平台各815、正式雙平台各947，Chrome隔離真單調clock過期0／fresh1（播放替身）；正式schema15／8帳戶與21schema保留、20非session表rows／BLOB一致、PID103459／service／tunnel正常、rooms0。證據及legacy限制見 [亂序修正](../PR43-EXPRESSION-CLOCK-FIX.md)；下方v1.7.1為歷史，作畫效能改善仍只研究／spec，外站資料代未啟用。

2026-10-07畫猜順暢度研究完成：Chrome官方Gartic單席Masterpiece與隔離本站雙席對照，25點持筆本站0POST／觀看者空白，放開才送；Gartic24則放開前＋1則放開後小向量更新，含累積前綴。真renderer操作計數顯示活動長筆O(N²)，人工400ms回覆延遲8短筆queue3,314ms。研究與 [改善spec](../specs/DRAWING-SMOOTHNESS.md)已保存，完整條件／HAR缺漏／未解像素差異見 [實測對照](../research/GARTIC-BGA-DRAWING-COMPARISON.md)；沒有FPS排名或使用者另一台電腦結論。產品未改、仍v1.7.1；分頁與隔離server已清理，沒有新PR／部署。

2026-10-07最新正式 **v1.7.1**／`3d82e3f`：修角色表情ACK只改隱藏列、雷霆同version漏crew及舊poll蓋新表情；RoomHost共用snapshot freshness與callback，雷霆same-version只改crew／state不重畫track。原faker GIF副本重現並驗雙席／還原，正式五款雙席用既有測試角色通過，兩平台各940。原faker／8帳戶／schema15保留、20非session表所有rows／BLOB相同、PID88602／service／tunnel正常，own五桌／session／proxy／tab清理後rooms0。來源與限制見 [表情驗收](../CHARACTER-EXPRESSION-SWITCH-PROGRESS.md)；下方v1.7.0及更早為歷史，沒有新PR或push，外站資料代未啟用。

2026-10-07最新正式 **v1.7.0**／`82149a4`：YouTube影片窗可拖曳縮放、鍵盤微調、恢復大小及個人尺寸記憶，依實際字級／chrome保護210px播放器；正常resize零watch流量且保持iframe。Windows／Linux各914、公開兩會員實播／窄屏／200%文字及雙欄通過；8帳戶／schema15保留，20非session表所有rows／BLOB相同，PID85927／service／tunnel正常。own席位／session／proxy／tab及臨時設定清理，rooms0。完整證據及邊界見 [影片尺寸验收](../YOUTUBE-WINDOW-RESIZE-PROGRESS.md)；下方v1.6.0及更早為歷史，外站資料代未啟用，沒有新PR或push。

2026-10-07最新正式 **v1.6.0**／`74372ed`：上傳歌曲供登入會員共用，同房玩家皆可選曲，guest開始以select重播同曲；每次展開取新歌庫，個人收聽／音量及YouTube規則保留。Windows／Linux各896、背景Chrome跨會員真上傳／非房主選播／兩位實際Audio通過。schema15／8帳戶全欄位保留、20非session表所有rows／BLOB與新鮮備份相同，PID83301／service／tunnel正常；own曲目／房間／session／proxy／tab清理後rooms0。詳細來源及未驗範圍見 [最新歌曲驗收](../MUSIC-SHARING-PROGRESS.md)。下方v1.5.8及更早為歷史，沒有新PR／push，外站資料代未啟用。

2026-10-07最新正式 **v1.5.8**／`470ab26`：角色主圖、固定及自訂表情每張4MiB，角色頁／收藏庫同步；其他圖片仍1MiB，三route JSON cap5,600,600、schema15不變。Windows／Linux各889、背景Chrome三表單及公開4MiB真上傳／三route／+1拒且原圖保留、加密備份還原已驗。own測試角色／session／tab／proxy已清理，0房間；8帳戶全欄位及20非session表所有rows／BLOB與備份一致，PID80949／service／tunnel正常。詳 [最新圖片上限驗收](../CHARACTER-IMAGE-SIZE-PROGRESS.md)；下方v1.5.7及更早為歷史，沒有新PR／push，外站資料代未啟用。

2026-10-07最新正式 **v1.5.7**／`4c5b5e7`：畫猜名單／結算卡等尺寸，所有玩家以同一排名卡格線呈現；GameUI.playerName單文字／完整title／只超寬才跑馬燈，suffix固定在外，五款重用，hover／focus暫停及MotionPolicy／reduce／hidden停動。八席桌機／手機／200%已驗，Windows／Linux各883；正式30資源／3席尺寸、長名實際位移及hover通過。測試暱稱還原、own席位及proxy清理後0房間；8帳戶全欄位／schema15保留，PID78591／service／tunnel正常。詳細來源／備份／限制見 [姓名驗收](../DRAW-PLAYER-NAME-PROGRESS.md)。下方v1.5.6及更早為歷史，外站資料未啟用，本輪沒有新PR／push。

2026-10-07最新正式 **v1.5.6**／`5941c03`：畫猜玩家／聊天室共用剩高、底邊對齊，桌機單屏、input最後；canvas512×256及比例保留、倒數同寬，8席重要資訊保留並必要局部scroll，125%不足空間自然流／加高恢復fit已驗。Windows／Linux各867，公開26資源／3席720p／1440／1920通過；8帳戶／schema15保留，PID76509／service／tunnel正常，測試席位及proxy清理後0房間。詳細來源／備份／邊界見 [高度驗收](../DRAW-VIEWPORT-FIT-PROGRESS.md)。下方v1.5.5及更早為歷史，外站資料仍未啟用，本輪沒有新PR／push。

2026-10-07最新正式 **v1.5.5**／`18d21ae`：畫猜倒數文字32px／軌道14px較亮橙色，與畫布同寬；畫者工具仍對齊畫布，作畫題材／難度／字數行移除。手機及320px／200%文字通過；原生progress停用width transition後，正式截圖像素68.9573%與native值68.9625%相符。Windows／Linux各864、正式26資源及3席通過，8帳戶／schema15保留、PID73168／service／tunnel正常；測試席位／session與preview已清理。詳細證據與v1.5.4歷史見 [倒數進度](../DRAW-TIMER-VISIBILITY-PROGRESS.md)。下方v1.5.3及更早為歷史，外站資料仍未啟用、沒有新PR／push。

2026-10-07最新正式 **v1.5.3**／`0609c01`：全站20HTML載入共享primitives／GameUI；題卡背面unknown、settings close與D徽章修正，history header span auto-margin污染也已隔離。20入口背景Chrome、桌機／390手機／200%文字與hidden／pending已驗，Windows／Linux各863；正式3席題卡與25份資源通過，8帳戶及schema15保留、PID68975／service／tunnel正常，測試房間已離开及session登出。與程式設計師的實際討論、逐頁表及長期契約見 [規格](../specs/SHARED-UI-ALIGNMENT.md)，部署證據／未驗界線見 [進度](../SHARED-UI-ALIGNMENT-PROGRESS.md)。下方v1.5.2為歷史；原PR43保持Ready未合併，沒有新PR或UI push，外站資料仍未啟用。

2026-10-07最新正式 **v1.5.2**／`7939090`：PR43 Stanley 兩項 P2（跳台方向風險／表情音效時鐘）已修正，原 PR 已更新且 Ready、未合併。原 PR v1.4.1 雙平台各808；保留畫猜版面及附件相容性的正式 v1.5.2 雙平台各863。零房間切換，schema15／21表及8帳戶全欄位保留、PID66841／service／tunnel正常，公開7份資源及五款遊戲／大廳 serverNow通過。外站資料未啟用；下方 v1.5.1 為歷史。詳細證據見 [審查修正與正式同步](../PR43-PRODUCTION-FIX-PROGRESS.md)，tag固定受測程式、後續文件不移動tag。

2026-10-07最新正式 **v1.5.1**／`d4e3b4a`：畫猜左側玩家、框線及畫具對齊、底部直列聊天室與最後輸入框、倒數進度及緊湊結算已上線；Windows／Linux完整各845項，背景Chrome多角色／八席／手機及正式3席驗收通過。正式schema15、8帳戶全欄位保留，切換前0房間，PID62990／service／tunnel正常；外站資料仍未匯入，取代／合併範圍仍待選擇。完整證據見 [畫猜最新進度](../DRAW-DESKTOP-LAYOUT-PROGRESS.md)。下方v1.5.0候選／v1.4.0整合／v1.3.0正式為歷史；來源ZIP、金鑰與shadow資料代保留但未啟用。PR43沒有加入本輪，無新PR／push，受測tag不隨文件提交移動。

2026-10-06最新本地候選v1.5.0／`723fbe4`：舊版community PNG／GitHub對應檔完整移轉與可選保留匯入session logs，Windows／Linux各834項通過；實際來源在兩端shadow資料代first boot後49logs與全部檔／帳戶／BLOB核對一致。正式仍v1.3.0；來源3帳戶與現站7帳戶有同名異UUID，等待取代／合併選擇，未切正式或push新分支，PR43保持原範圍。詳 [最新相容性與匯入狀態](../LEGACY-IMPORT-PROGRESS.md)。

2026-10-06 最新整合：候選 **v1.4.0**、[PR #43](https://github.com/stanley021039/BGA/pull/43) 已建立，受測程式及本地tag為 `bdd77d146ef8f207c8d94c06390aefd2a857d986`。Windows／Linux完整各 **790/790**、schema15兩種舊14布局及完整移轉回歸通過；既有帳戶／音效／市場資料保留。已接main `b744464`，後續只含README／驗收文件，執行程式未變。正式仍v1.3.0，排版及整合候選尚未切換；先前PR及測試數字保留為歷史，送審狀態以PR頁及下方最新整批進度為準。

本輪 source、schema 相容性、測試及送審狀態見 [整批 PR 進度](../PARTY-PR-INTEGRATION-PROGRESS.md)。

2026-10-06候選 **v1.3.2**：送禮主區改依實際剩餘視窗高度伸展，包含v1.3.1的16px間距；Chrome高視窗／720p／八席等待及選禮／手機通過，Windows／Linux各761項，備份及16表副本預演通過，受測來源／本地tag `df7846d`。正式仍v1.3.0；v1.3.1未單獨部署，tag保持不動。以 [高度驗收及發布狀態](../GIFT-VIEWPORT-HEIGHT-PROGRESS.md)為準。

2026-10-06正式 **v1.3.0**：畫猜本人猜中／畫者輪次及雷霆骰聲／shot／slam／nitro／skid已接共用事件音效。Windows Node24.14.0 **761/761**（25286ms）、Linux Node22.22.1 **761/761**（130827ms），失敗／取消／跳過均0。受測程式 `4732450fe44d2640ecaf961cf2d8dee9d8bd5e95` 與本地 annotated tag `v1.3.0`，正式 current `releases/4732450`；零房間切換，PID50471→52510，service／tunnel active。schema14不變、integrity ok、外鍵錯誤0，原7帳戶全欄位保留；預演副本16張既有表逐列一致。匿名no-store版號、既有session、7份HTML、24份資源（含7WAV的精確bytes及MIME）一致，背景Chrome設定顯示「版本 v1.3.0」。7短音（2Kenney CC0改作＋5固定seed原創）、兩個新聲音模組、遊戲2／總4段上限及1秒載入timeout已驗；Chromeplaying／清理／靜音及所有限制見 [音效實證](../GAME-SOUNDS-PROGRESS.md)。第二批遊戲候選仍為規格，沒有真人聽感／喇叭測試；無新PR／push，純驗收文件不移動tag。

2026-10-06新增「音效師」：角色方法與限制見 [SOUND-DESIGNER](SOUND-DESIGNER.md)，不同素材網站的具體授權見 [素材來源](../research/SOUND-ASSET-SOURCES.md)，五款遊戲的既有音效、候選位置、優先序、事件時序及實際討論見 [音效計畫](../specs/GAME-SOUND-PLAN.md)。這筆是研究階段紀錄；第一批後續正式實作見上方v1.3.0，第二批候選仍未做。

2026-10-06先前正式 **v1.2.0**：角色自訂表情可加入最多10秒音效，作者上傳／試聽／移除，五款遊戲與大廳沿用共用效果音開關／音量。Windows Node24.14.0 **727/727**（24185ms）、Linux Node22.22.1 **727/727**（125824ms），失敗／取消／跳過均0。背景Chrome邊界、轉檔、停止、一次載入及靜音均驗。受測程式 `9b1fdd4148ea9e1ceec5215f8ca112ffd99cd893` 與本地 annotated tag `v1.2.0`；正式 current `releases/9b1fdd4`，零房間切換，PID 48811→50471，service／tunnel active。正式 schema14、integrity ok、外鍵錯誤0，原7帳戶全欄位完整保留；預演時15張既有表逐列一致，只新增空 `character_sounds` 第16表。匿名 no-store 版本API、既有session、7份HTML及14份資源比對通過，背景Chrome設定顯示「版本 v1.2.0」。schema1–13副本升級與完整音效備份還原已驗；無新PR／push，纯驗收文件不移動tag。詳細契約、備份、證據與測試範圍見 [角色表情音效](../CHARACTER-ASSET-TEMPLATE.md)，較早部署狀態保留為歷史。

2026-10-06先前正式 **v1.1.4**：PR #36共看失聯重試及HTTP安全UUID修正已整合，Windows／Linux各663/663、HTTP真Chrome實播及pause／stop各503後同revision恢復通過。受測93ba350／本地v1.1.4 tag，正式current releases/93ba350、schema13／7帳戶完整保留、公開版本與資源已驗。#34雙平台442與Chrome四輪回看收藏禁題補齊，另一端已合併；#36來源552雙平台、原PR已更新5f2dd93／main／Ready、無衝突，未合併。以下較早部署及待驗文字屬歷史，以 [最新發布](../RELEASE-PROGRESS.md)與 [共看實證](../YOUTUBE-WATCH-PROGRESS.md)為準。

2026-10-06版本管理：新功能必須打版。先讀 [打版規範](../RELEASE-POLICY.md)及 [最新驗收](../RELEASE-PROGRESS.md)，判斷候選／正式狀態；不要沿用package曾長期固定1.0.0的做法。

本批最新遊戲程式來源 **4bab53a**，Windows／Linux整合各 **543/543** 通過。2026-10-06正式站已切換發布版 **8fcda4d**：schema13、完整性ok、7帳戶全欄位保留，公開15份資源及既有session驗證通過。新功能未push／未新PR；以下較早「未部署」為歷史狀態，最新範圍與限制以 [整合進度末節](../PARTY-UPGRADE-PROGRESS.md#正式部署驗證2026-10-06)為準。

2026-10-05 U33 最新：YouTube已發 [PR #36](https://github.com/stanley021039/BGA/pull/36)（head2eeb398，接續#34，未部署），取代下段「未PR」。另六項需求在本地 `feat/party-content-and-race-paths`，前五項程式／背景Chrome已驗；彈幕框僅規格評估。接手先讀 [整合進度](../PARTY-UPGRADE-PROGRESS.md)、[改名](../PLAYER-RENAME-PROGRESS.md)、[內容及來源](../PARTY-CONTENT-PROGRESS.md)、[多格路線](../RACE-MULTI-MOVE-PROGRESS.md)和 [框規格](../specs/CUSTOM-BARRAGE-FRAMES.md)，以整合文件最後測試／commit狀態為準。這六項未push／PR／部署，正常Chrome viewport未覆寫；帳密仍只在核准私有交接。

2026-10-06 PR #36 合併準備：整合最新 main `9dd6282`（含 #38），靜態資源衝突保留 YouTube 與 market 路由及 market 登入返回路徑；記憶保留雙方決策，重複編號以 U29-market 區分。Windows Node 26.2.0 完整 573/573 通過，失敗／取消／跳過 0。本輪未重跑 Linux 或瀏覽器；使用者已明確授權推送與合併 main，未部署。

2026-10-06 PR #36 修正程式d4020ef已接main1447430：Windows／Linux各552/552，前端90、focused123；非loopbackHTTP真Chrome提案／播放及暫停／停止各一次503後同revision200恢復，穩態零watch事件。PR #34完整雙平台442與四輪UI／回看收藏禁題已驗，#34在驗收期間由另一端合併；cc771b8驗收文件一併帶入此分支。主agent尚未合併本PR，正式分支發布獨立記錄。詳 [共看審查驗收](../YOUTUBE-WATCH-PROGRESS.md)。

最新本地增量：`400cb6d`、U32「在這裡開始播放」只給房主顯示，Windows前端52項及兩個背景Chrome帳號驗收通過。原 `631eabf`、U29／U30的YouTube共看及共用媒體浮窗基線曾通過Windows／Linux各503項；本增量未重跑兩平台全套，未push／PR／部署。接手先讀 [共看進度與操作](../YOUTUBE-WATCH-PROGRESS.md)，再读PROGRAMMER／SERVER-DATA／PLAYER；舊共看spec的SSE、輪詢及固定modal方案被取代。測試viewport已逐tab還原，後续尺寸測完立即reset，不留左上角模擬區。隔離預覽／合成帳密／cookie只在ignored work私人交接，不能沿用房號當正式站資料。

2026-10-06 PR #34 最新整合提交 `3dde6a4` 已由隔離 checkout 複驗：包含 main `b843a3f`，Windows Node 24.14.0／Linux Node 22.22.1 完整各 **442/442**，失敗／取消／跳過 0；main 鎖程式與 11 項回歸完整保留，未帶入 PR #36 或後續六項功能。Linux 為乾淨 archive 的獨立測試副本，未操作正式服務或 DB。父任務背景Chrome一席UI配合合成API走完四輪，跨輪／完局回看、收藏及3/4禁題通過；真人多設備、手機與弱網／GPU仍未重驗。詳 [最新複驗](../PR34-MAIN-INTEGRATION.md#2026-10-06最新整合提交複驗)。此筆取代下一段「沒有 Linux」的缺口，未核准／合併／部署。

2026-10-06 PR #34 已在隔離 clone 整合 main `b843a3f`，保留新版 AGENTS、#31 殘留鎖修正及 #34 全功能；三份角色記憶新增段落衝突保留雙方。Windows Node 26.2.0 完整 **442/442** 與合成 HTTP 四輪／禁題／收藏權限通過；本次沒有 Linux 或真正瀏覽器 UI 證據。Draft／main base，待父任務獨立複審，未核准／合併／部署。詳 [整合驗證](../PR34-MAIN-INTEGRATION.md)。此筆取代以下兩批分開的測試數字作為本輪整合證據。

2026-10-05 PR #31 鎖修正：程式 `0682e43` 停止自動回收殘留資料／發布／歷史鎖，HistoryStore 共用排他鎖且關閉冪等。受控雙程序已在舊程式重現兩者同時取得鎖；Windows Node 24.14.0 完整 **374/374** 通過（新增11項），本次未重跑 Linux。人工清理與半份還原處理見 [操作指南](../SERVER-DATA-TRANSFER.md#殘留鎖的人工檢查)，證據與剩餘驗收見 [PR #31 修正進度](../SERVER-DATA-TRANSFER-PROGRESS.md#pr-31殘留鎖競態修正)。此筆更新鎖行為及本次測試數字，不代表正式服務已更新。

2026-10-05 最新追加 U28：程式 **2cf8a44** 已加入畫猜揭曉後的禁止題目投票。揭曉固定選民、嚴格過半、最近八輪補投，通過後內建／共編題目全站持久停用；schema 13 與完整備份還原相容。Windows／Linux 各 **431/431**、原 Chrome 背景按鈕及版面驗收通過，接續 PR #34，未部署。詳細規則、限制與證據見 [禁題進度](../DRAW-WORD-BAN-PROGRESS.md)。這是以下 U26／U27 的後續版本。

更新：2026-10-05。這些檔案是後續 session 可讀取、校正與延續的專案記憶；不是模型權重訓練，也不會讓未讀文件的 agent 自動知道內容。專案根 `AGENTS.md` 指引下一個工作回合載入索引及相關角色。

最新遊戲程式 **93d7a84**（U26／U27）：畫猜最近八輪回看與收藏、等待／離線提示、猜中卡勾選高亮，以及五款共用動效／彈幕規則已實作。Windows／Linux 各 **402/402** 通過，原 Chrome 背景完成跨輪 PNG／重送／重連與設定驗收；8 席720p仍需少量垂直捲動。讀 [完整證據及限制](../DRAW-REVIEW-MOTION-PROGRESS.md)，此項取代下方研究階段「PL-01／PL-02 與共用政策尚未實作」的現況，不表示成就／YouTube已做或已部署。

最新資料移轉程式 `47d79c7`：管理者可選備份資料夾＋金鑰，驗證、預演並建立新資料目錄；刷新恢復與備份身分比對已實作。Windows／Linux 完整各 **363/363** 通過，原 Chrome 背景已驗本機路徑與恢復上傳批次後的還原、原密碼登入及私人作品。資料夾選檔受自動化工具限制，與 HTTP 上傳驗收分別記錄，詳 [最新驗收](../SERVER-DATA-TRANSFER-PROGRESS.md#管理者匯入流程與背景-chrome-驗收)。仍未搬移正式資料或部署公開管理頁。

| 角色 | 記憶入口 | 本輪研究／spec | 長期責任 |
| --- | --- | --- | --- |
| 玩家 | [PLAYER](PLAYER.md) | [評論與評分標準](../research/PLAYER-REVIEW-RUBRIC.md)、[實玩評估](../research/PLAYER-PLAYTEST-ASSESSMENT.md) | 把評論變成可測評分，區分新手／熟手、競技／派對需求，指出缺口與反例。 |
| 動畫 | [ANIMATION](ANIMATION.md) | [動效與素材方案](../specs/ANIMATION-ASSET-PLAN.md) | 盤點事件、節奏、資訊傳達、減少動態、失敗及重連。 |
| 音效師 | [SOUND-DESIGNER](SOUND-DESIGNER.md) | [素材來源](../research/SOUND-ASSET-SOURCES.md)、[遊戲音效計畫](../specs/GAME-SOUND-PLAN.md) | 定義聲音語彙、挑選與製作素材、核對逐檔授權、事件時序、密度、混音與靜音體驗。 |
| 美術 | [ART](ART.md) | [動效與素材方案](../specs/ANIMATION-ASSET-PLAN.md) | 查具體素材及授權，定義原創圖案風格與可辨識性。 |
| 設計師 | [DESIGNER](DESIGNER.md) | [成就與勝利紀錄](../specs/ACHIEVEMENTS-AND-RECORDS.md)、[設計攻防](../research/AGENT-DESIGN-DEBATE.md) | 提出趣味方案，回應玩家質疑，定義判定及誘因取捨。 |
| 程式 | [PROGRAMMER](PROGRAMMER.md) | [共享 YouTube](../specs/SHARED-YOUTUBE-PLAYER.md)、原型生成器 `tools/prototypes/` | 以現有架構核對可行性、權限、狀態協議與可驗收行為。 |
| 伺服器／資料 | [SERVER-DATA](SERVER-DATA.md) | [多環境資料移轉](../specs/MULTI-ENV-DATA-MIGRATION.md)、[已實作完整移轉 CLI](../SERVER-DATA-TRANSFER.md)、[驗收進度](../SERVER-DATA-TRANSFER-PROGRESS.md) | 定義權威資料、隔離、備份、遷移、衝突與回復演練。 |

角色名稱是可重用的責任，不綁定某個暫時 agent thread。本輪由 `player_research` 負責玩家及成就 spec、`typography_design` 負責動畫／美術／設計、`layout_design` 負責程式／資料，主 agent 負責實玩與整合。

先讀 [使用者偏好及決策](MEMORY-LEDGER.md)；更新時遵守 [記憶協議](MEMORY-PROTOCOL.md)。後續按 [本輪整合與實作順序](../specs/AGENT-UPGRADE-ROADMAP.md) 分批實作；提案與孤立原型不等於正式遊戲功能。

2026-10-05後續已實作項目另有 [畫猜房間](../DRAW-ROOM-SETUP-PROGRESS.md)、[共用聲音](../SHARED-AUDIO-PROGRESS.md)及 [彈幕／房間設定整合](../BARRAGE-ROOM-SETTINGS-PROGRESS.md)驗收文件；最新正式程式來源 `15af1dd`。研究提案維持各自狀態，下一輪仍需查當前Git及部署版本。

2026-10-05 完整資料移轉第一版程式 `c831e87` 已本地驗收（Windows／Linux 各255项及兩方向 restore／登入），包括原帳戶密碼與權限，未執行正式 migration／部署。最新使用者決策 U17 及接手流程見 SERVER-DATA、MEMORY-LEDGER；研究 spec 中 merge／Postgres 等項目不能混稱完成。

使用者追加 U18 獨立移轉文件及管理員 UI。`2618c4b` 提供 `npm run data:transfer:ui` localhost 表單，結果收合／對齊補充至31c91dd，仍沿用冷移轉與防覆寫政策；Windows／Linux 各259項（UI HTTP4項）與原Chrome背景完整表單流程／重新整理通過，見同一操作文件及進度。

同日最終來源至 `215f82c`：移轉UI及過期狀態競態修正、PR資源修正與最新遊戲功能已整合，Windows／Linux各304項及背景Chrome驗收通過；PR #30更新至1b8c85d，未部署。接手優先讀 [獨立移轉指南](../SERVER-DATA-TRANSFER.md)、[最終進度](../SERVER-DATA-TRANSFER-PROGRESS.md) 與 [PR修正](../PR30-RESOURCE-LIMITS.md)。Gartic無HAR證據，不能推測其協議。

同日後續來源 `e71989e` 整合 PR 程式 `3b19720`：補失敗開局歷史淘汰／故障容量記帳與分批畫布恢復。PR Windows／Linux各279項，本地完整整合Windows323項；沒有本次Linux323項證據。Chrome多人重連／復原／儲存通過，HAR仍待取得；接手讀 [後續複查](../PR30-RESOURCE-LIMITS.md#後續複查失敗開局與重連恢復) 與 [錄製方法](../research/GARTIC-NETWORK-REFERENCE.md)。

同日 U22 後續已由設定 UI 啟用完整 CDP，隱藏內建瀏覽器完成 Gartic 單席 Masterpiece 的實際封包採樣與 HAR 匯出，取代上述「未取得 HAR」狀態。有效操作窗 24 批無 truncated；早期載入缺漏仍保留。畫筆／填色／復原為小型命令，相簿回傳最後剩餘的向量；不能推論其他模式、CPU 或 server 內部策略。詳 [實錄與對照](../research/GARTIC-NETWORK-REFERENCE.md)，raw 與 HAR 只在 ignored work。

最新程式 `e60f853`／本地整合 `7c25c7b` 另修新局 round 1 沿用舊配額：每輪畫布有獨立 canvasEpoch，隔離所有延遲操作／回覆。PR Windows／Linux各286項、本地整合Windows330項及背景重開／填色驗收通過；PR #30已推至 `7f44f20`，未部署。詳 [PR 修正文件](../PR30-RESOURCE-LIMITS.md)。本次沒有重跑本地整合Linux330項。

同日送審前最終程式 `6e655de`：已接上 PR #30，新增舊 schema BLOB 表相容修正與回歸，完整整合 **Windows／Linux 各335/335 通過**，取代先前整合版本測試數字。PR #30 四項回覆另經獨立 agent 複查及65項回歸確認。已發出非 draft [PR #31](https://github.com/stanley021039/BGA/pull/31)，base 為 #30 的 `feature/game-stage-local`；先合 #30，再調整 #31 base 至 main。詳 [移轉進度末節](../SERVER-DATA-TRANSFER-PROGRESS.md#送審前最終複查)，未部署或搬移正式資料。

2026-10-06 股市冥燈：隔離 main b843a3f 的本機整合加入 /market、既有帳號／管理者權限與 SQLite schema 13；Windows Node 26.2.0 完整387/387及背景 Chrome桌機／手機流程通過。以Draft送審，未合併、部署或變更正式資料，詳 [本機接手](../MARKET-JINX.md)。本筆取代程式與資料記憶中的最新 schema 上限12；歷史驗收數字保留原版本含義。

2026-10-06 PR #38 審查後：確認並修正投票 409 草稿版本未同步、手動更新與提交交錯、時鐘回退造成投票時間戳倒置。新增4項回歸，Windows完整391/391取代上筆387作為本分支最新數字；背景Chrome再驗更新鎖／焦點、1280／390／320導覽。詳 [逐項證據](../MARKET-JINX.md#2026-10-06pr-38-獨立審查修正)，仍保持Draft、未合併或部署。

同日 #38 整合已包含 #34 的 main `1447430`：兩種舊schema13升級為共同schema14，保留禁題／回看／動效及市場功能，沒有改AGENTS或覆蓋角色記憶。Windows完整463/463、市場21／移轉26與整合版背景Chrome全流程通過，取代上笔391與schema13的最新分支狀態。詳 [整合接手](../MARKET-JINX-MAIN-INTEGRATION.md)。#38仍Draft、未合併或部署，Linux／Safari／#34完整canvas實玩未重驗。
