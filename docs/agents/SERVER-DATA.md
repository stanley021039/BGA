# Server／資料 agent 記憶

正式仍v1.12.0／83ffcab／schema16，新增私有GitHub token並重載服務，當次PID147993。設定前備份私有env與線上SQLite；freshrooms0，沒有清房或DB restore。9帳戶全欄位、其他18表內容與22schema保持，只有session及測試board_issue／comment／submission按功能新增；3筆done無待處理。GitHub token只存正式私有env，不複製到sanitized開發資料或記憶文件。下一次重新盤點PID／env，舊1.12部署env摘要不能當新設定的pin；詳 [同步紀錄](../GITHUB-BOARD-SYNC.md)。

2026-10-07最新正式 **v1.11.0／schema16／22表**：固定source／tag `67e49a164ac5fcb4c3b3cce0fe2b8d899c860e62`。線上SQLite備份＋另時點files不是atomic cold；隔離schema15→16只加空market_images，migration／boot兩次21舊表allrows／BLOB、8users全fields保持。09:15:24.105Z rooms0 guard後服務／tunnel健康；最終20舊non-session表資料、8users保持，FK0／integrity ok、新圖片0；sessions191→201是失敗QA3＋guard1＋smoke6，不說session未變。cold15升16與full16帶PNG審核資料還原已有focused證據，角色4MiB／preserveImportedSessions兼容保留。正式來源保UI／WebGL，與PR46候選source分開；[最新證據](../PR46-REVIEW-FIX-PROGRESS.md)取代下方schema15／早期部署現況，下次仍重新盤點。

2026-10-07最新正式v1.7.1／`3d82e3f`／PID88602：角色表情前端共用回覆與亂序修正，schema15／21表不變；兩平台各940、0房間切換，fresh backup副本21schema／rows／BLOB及8帳戶全欄位保留。正式五game双席使用own既有角色測臨時表情，不寫profile／原faker；own五桌離房、3session登出、代理／presence／tab清理後rooms0。21schema及20非session表所有rows／BLOB與備份相同，sessions152→155為QA登入／登出，env／原資料路徑／service／tunnel正常、integrity ok／FK0。原faker GIF副本僅隔離診斷；外站資料代未啟用，下一次重新盤點，不沿用85927／1.7.0guard。非原子冷備份與來源見 [表情發布](../CHARACTER-EXPRESSION-SWITCH-PROGRESS.md)。

2026-10-07最新正式v1.7.0／`82149a4`／PID85927：僅影片個人視窗尺寸及共用icon／測試，watch協議與schema15／21表保持。Windows／Linux各914、0房間切換，fresh backup副本21schema／rows／BLOB及8帳戶全欄位相同；公開2會員實播縮放零watch請求、3席revision1仍paused。own席位離房／3session登出，tab／proxy／presence停止，rooms0；20非session表所有rows／BLOB與備份相同、21schema保持，sessions149→152為QA登入／登出。env／原資料路徑／service／tunnel正常，integrity ok／FK0，外站資料代未啟用。下一次重新盤點，不能沿用83301／v1.6.0guard；非原子冷備份及來源見 [尺寸發布](../YOUTUBE-WINDOW-RESIZE-PROGRESS.md)。

2026-10-07最新正式v1.6.0／`74372ed`／PID83301：共用歌曲選曲權限及UI，schema15／21表不變；兩平台各896，0房間切換、新鮮備份副本21schema／rows／BLOB一致，8帳戶全欄位保留。公開真上傳及非房主選播／兩Audio已驗，own歌曲／席位清理、3session登出／proxy／presence／tab停止、rooms0。最後20非session表所有rows／BLOB與備份相同，21schema保持；session146→149正常QA登入／登出，env／原資料路徑／service／tunnel正常、integrity ok／FK0。備份非原子冷快照，外站資料代未啟用；下一次重新盤點，不沿用下方80949／v1.5.8guard。詳 [歌曲發布](../MUSIC-SHARING-PROGRESS.md)。

2026-10-07最新正式v1.5.8／`470ab26`／PID80949：角色及表情上限4MiB，source／schema15不需migration。新鮮備份副本21表schema／rows／BLOB相同，0房間切換，8帳戶全欄位保留／integrity ok／FK0；Windows／Linux各889及正式真Chrome4MiB／三route bytes已驗。清理own測試角色後20非session表所有rows／BLOB與備份相同、21schema不變；session因一次QA登入／登出145→146，已登出。proxy／tab／viewport清理、rooms0；env／資料路徑／service／tunnel正常，外站資料代未啟用。下一次重新盤點，不用下方78591／1.5.7guard。備份非原子冷快照及詳細來源見 [最新圖片上限發布](../CHARACTER-IMAGE-SIZE-PROGRESS.md)。

2026-10-07最新正式v1.5.7／`4c5b5e7`／PID78591：前端姓名／卡片修正，schema15／21表、8帳戶全欄位、env及原路徑保留，integrity ok／FK0。新鮮備份副本21表schema／rows／BLOB一致，0房間切換；公開30資源／3席後原暱稱核對恢復、own席位離房／session登出／proxy停止，房間0。最後全users rows仍與備份完全相同。備份不是原子冷快照，外站資料代未啟用；下一次重新盤點，勿用下方76509／1.5.6guard。詳 [最新姓名發布](../DRAW-PLAYER-NAME-PROGRESS.md)。

2026-10-07最新正式v1.5.6／`5941c03`／PID76509：畫猜高度修正，schema15／21表、8帳戶全欄位、env及原資料路徑保留，integrity ok／FK0。新鮮備份副本啟動前後21表schema／rows／BLOB一致、0房間切換；公開26資源／3席驗收後own席位離房／session登出／proxy停止，房間0。SQLite與持久檔另備非原子冷快照，外站資料代未啟用。後續重新盤點，不沿用下方73168／1.5.5guard。詳 [發布證據](../DRAW-VIEWPORT-FIT-PROGRESS.md)。

2026-10-07最新正式v1.5.5／`18d21ae`／PID73168：倒數UI及原生軌道繪製修正，schema15／21表不變，8帳戶全欄位／.env／原資料路徑保留，integrity ok／FK0、service／tunnel正常。新鮮備份副本21表schema／rows／BLOB一致，0房間切換；正式3席／26資源與進度像素比例已驗，測試席位離開及session登出後0房間，沒有啟用外站資料。SQLite與持久檔另備而非原子冷快照；新發布／匯入須重新盤點，不沿用下方舊PID／版本guard。詳 [最新倒數發布](../DRAW-TIMER-VISIBILITY-PROGRESS.md)。

2026-10-07最新正式v1.5.3／`0609c01`／PID68975：只同步共用UI對齊；schema15／21表，8帳戶全欄位、.env／原路徑保留，integrity ok／FK0，service／tunnel正常。副本啟動前後21表schema／rows／BLOB一致，0房間切換，公開25資源及正式3席題卡確認；測試席位離开及session登出後0房間。備份不是跨檔原子冷快照，外站資料代未啟用。不要沿用下方7939090／PID66841盤點作下一次發布或匯入guard；詳 [最新同步](../SHARED-UI-ALIGNMENT-PROGRESS.md)。

2026-10-07最新正式v1.5.2／`7939090`／PID66841：只同步PR43跳台與音效時鐘修正，schema15不變。新鮮8帳戶備份及隔離啟動前後21表schema／rows／BLOB一致；零房間切換後8帳戶全欄位與備份相同、integrity ok／FK0，.env／原資料路徑不變，service／tunnel正常。SQLite一致性備份與持久檔另備並非原子冷快照；原PR43 Ready未合併，受測本地tag固定7939090，双平台各863及公開API／資源已驗。外站shadow仍未啟用；後續匯入必須重新盤點，不沿用歷史PID／版本／帳戶數。證據見 [正式同步](../PR43-PRODUCTION-FIX-PROGRESS.md)，下方v1.5.1為歷史。

2026-10-07最新正式v1.5.1／`d4e3b4a`／PID62990：原shhuang.cc資料升schema15，切換前0房間，service／tunnel正常。以最新8帳戶備份預演，16個舊表schema／rows／BLOB完全保留，只新增5個空市場表；正式8帳戶全欄位（含近期重設雜湊）一致、integrity ok／FK0。現站原資料路徑及.env不變，外站shadow仍未啟用，原ZIP／移轉key及副本保留。外站來源3帳戶要取代／合併現在8帳戶仍待使用者決定；後續不得沿用舊4732450／schema14／7帳戶guard，須重新盤點並使用最新UI程式避免倒退。備份不是跨檔原子冷快照；完整記錄見 [畫猜发布](../DRAW-DESKTOP-LAYOUT-PROGRESS.md)，下方1.5.0shadow及1.3.0正式為歷史。

2026-10-06：依使用者明確要求，已重設正式站既有管理者密碼。先建立線上一致性 SQLite 備份，再使用既有密碼重設流程；公開站登入、管理者權限及驗證 session 登出通過，原有 10 筆登入狀態已撤銷，其餘 6 個帳戶全欄位不變。未重啟服務、未切換程式或外部匯入資料。帳密不放在此文件；若後續選擇來源整份取代，帳戶密碼仍以來源資料為準，不能沿用這次現站重設結果。

2026-10-06最新v1.5.0本地候選／`723fbe4`：legacy附件typed allowlist與HISTORY_PRESERVE_IMPORTED_SESSIONS旗標，完整兩平台834項、實際來源本機／server shadow 49logs／3帳戶／1作品／2音樂／5PNG及backfill保全通過。來源ZIP不執行程式，WAL讀入consistent SQLite snapshot；來源跨檔原子性只有來源宣稱，沒有自動重啟獨立證據。正式未改，待使用者決定來源3帳戶是否整份取代現站7帳戶，尚未做切換完整冷備份。下列舊schema14／候選驗收為歷史，以 [最新進度](../LEGACY-IMPORT-PROGRESS.md)為準。

2026-10-06 最新整合：候選 **v1.4.0**、[PR #43](https://github.com/stanley021039/BGA/pull/43) 已建立，受測程式及本地tag為 `bdd77d146ef8f207c8d94c06390aefd2a857d986`。Windows／Linux完整各 **790/790**、schema15兩種舊14布局及完整移轉回歸通過；既有帳戶／音效／市場資料保留。已接main `b744464`，後續只含README／驗收文件，執行程式未變。正式仍v1.3.0，排版及整合候選尚未切換；先前PR及測試數字保留為歷史，送審狀態以PR頁及下方最新整批進度為準。

本輪 source、schema 相容性、測試及送審狀態見 [整批 PR 進度](../PARTY-PR-INTEGRATION-PROGRESS.md)。

## 本輪候選資料契約：schema 15

統一禁題、角色音效與市場五表；legacy 13 接受完整禁題／完整市場或兩者兼具，音效表若提前存在只能是有效空表。legacy 14 須有禁題，並有有效音效表或完整市場至少一方；保留已有資料、在還原副本補缺少的另一方空表並升 15。schema 15 任一必備表缺少、任意版本部分市場表、畸形表結構或壞音效／市場歷史均拒絕，空表也要驗欄位／PK／FK／unique。來源不動、users 全欄位及已有 BLOB digest 不變；市場版 14 可只新增空 `character_sounds`，音效版 14 的既有 bytes 不可放寬。契約與布局表見 [移轉指南](../SERVER-DATA-TRANSFER.md#本輪候選統一-schema-15)。本輪實作／回歸驗收尚在進行，不能使用以下先前 727／761／463 項當作整合驗收。

2026-10-06最新正式v1.3.0（遊戲事件音效）：受測程式 `4732450fe44d2640ecaf961cf2d8dee9d8bd5e95` 與本地 annotated tag `v1.3.0`，正式 current `releases/4732450`；零房間切換，PID50471→52510，service／tunnel active。schema14不變、integrity ok、外鍵錯誤0，原7帳戶全欄位保留；預演副本16張既有表逐列一致。匿名no-store版號、既有session、7份HTML、24份資源（含7WAV的精確bytes及MIME）一致，背景Chrome設定顯示「版本 v1.3.0」。沒有schema或資料格式變動、sound BLOB仍隨完整bundle保存。備份`shared/backups/pre-party-4732450-20261006T043416Z`（UTC），SQLite與檔案另備；未搬入其他站。素材重建及Windows Node24.14.0 **761/761**（25286ms）、Linux Node22.22.1 **761/761**（130827ms），失敗／取消／跳過均0。詳 [聲音發布證據](../GAME-SOUNDS-PROGRESS.md)，下方v1.2.0為schema14導入歷史。

## 正式導入歷史：schema 14 表情音效與移轉（2026-10-06）

v1.2.0 在 `src/db/index.js` 新增 `character_sounds(character_id,expression,mime,bytes,duration_ms)`，複合主鍵及外鍵綁 `character_images(character_id,expression)`，刪除表情連帶移除音效。資料留在 SQLite BLOB，不新增磁碟媒體路徑；`src/profiles/sounds.js` 的 `inspectExpressionSound` 只接受標準 44-byte 頭、24000Hz／mono／PCM16 WAV，實 sample 數正且最多 240000，bytes 最多 480044，duration_ms 為 `ceil(samples/24)` 且最多 10000。

`src/data/validation.js` 要求 schema 14 含音效表，檢查複合 PK／FK、非 neutral 的既有表情及 canonical bytes／MIME／duration 一致；inspect、export、verify、restore 共用檢查。v1–13 的非空音效表拒絕，不能用旧 schema 標籤绕過驗證。`src/data/transfer.js` 的既有 BLOB 保全規則新增 migration 14：只允許目標副本多出空音效表，來源、users 全欄位、既有 BLOB digest 不變；bundle 格式不變，schema 14 不能直接交給舊 schema 13 程式啟動。

回歸來源為 `tests/data-transfer.test.js`：原 bytes／長度、原密碼登入及選用角色，schema 1–13 完整還原、空新表 digest、非空 migration 注入，以及重簽加密包中的壞音效／長度／MIME／引用／缺 FK 拒絕。`tests/draw-word-ban.test.js` 的 v12 fixture 先移除音效表，再降版，仍保留 v13 缺禁題表拒絕的獨立移轉測試。Windows Node 24.14.0 執行 `node --test tests/data-transfer.test.js tests/draw-word-ban.test.js` 共 63/63 通過；Windows Node24.14.0 **727/727**（24185ms）、Linux Node22.22.1 **727/727**（125824ms），失敗／取消／跳過均0。隔離背景Chrome已驗10秒邊界、轉檔、試聽停止、房間與大廳一次載入及靜音。受測程式 `9b1fdd4148ea9e1ceec5215f8ca112ffd99cd893` 與本地 annotated tag `v1.2.0`；正式 current `releases/9b1fdd4`，零房間切換，PID 48811→50471，service／tunnel active。正式 schema14、integrity ok、外鍵錯誤0，原7帳戶全欄位完整保留；預演時15張既有表逐列一致，只新增空 `character_sounds` 第16表。匿名 no-store 版本API、既有session、7份HTML及14份資源比對通過，背景Chrome設定顯示「版本 v1.2.0」。切換前備份 `shared/backups/pre-party-9b1fdd4-20261006T034156Z`（UTC）；SQLite與檔案另備，不宣稱原子。正式只升本站資料，沒有匯入其他站或合併兩站。以下schema13正式紀錄為歷史，最新證據見 [音效契約](../CHARACTER-ASSET-TEMPLATE.md)。

## 先前正式版本核對（2026-10-06）

正式 `current` 為 `releases/8fcda4d`，本批Windows／Linux完整各543/543。部署前SQLite線上一致性備份及持久檔案另存，副本預演schema12→13後14張既有表全部一致；正式切換後schema13、完整性ok、外鍵錯誤0、7帳戶全欄位保留。既有公開session可用，網站與Tunnel active。部署加入共看及派對擴充，不是其他站資料匯入；共看仍在記憶體，沒有新增影音轉送或同步計時器。來源、備份及限制見 [本批部署驗證](../PARTY-UPGRADE-PROGRESS.md#正式部署驗證2026-10-06)。舊正式版15af1dd僅支援schema12，不能在v13資料上直接切回啟動。下列較早「未部署」為歷史狀態。

## 歷史：共看暫存資料（2026-10-05）

`631eabf`在本地提供YouTube共看，沒有DB schema／備份範圍變動。registry綁實際room物件與UUID，不因六碼重用繼承影片；最後真人離房及app.close清空。提案8／每人2、request ledger128及10分鐘TTL有界，帳戶限流、seat／控權／版本驗證沿用同源API。server只解析YouTube白名單URL取ID，不出站取metadata／影片、不加SSE／timer／心跳，也不記觀看log。

控權離線30秒借既有房間活動reconcile：先撤銷過期控制，再刷新seat；全員離線後第一席直接GET須恢復控制，host換人但controller不變也要更新marker權限。外部素材直接由YouTube到client，本機影片位置不移轉。後端18項、完整Windows／Linux各503項與限制見 [共看進度](../YOUTUBE-WATCH-PROGRESS.md)；未正式部署，冷移轉不包含記憶體房間續局的政策不變。

## 2026-10-06：schema 13 與拒絕殘留鎖整合

PR #34 接上 main `b843a3f`，schema 13 禁題資料與 #31 拒絕殘留鎖／HistoryStore 冪等 close 同時保留；鎖程式與 main 完全一致。Windows Node 26.2.0 完整 **442/442** 包含完整還原、v12 副本升級／v13 缺表拒絕及 11 項鎖回歸。本次沒有 Linux、正式資料或真正 browser 驗收，詳 [整合驗證](../PR34-MAIN-INTEGRATION.md)；早期 v12 敘述為歷史基線，現 PR schema 為 13。維持 Draft，待獨立複審。

## 2026-10-05：殘留鎖政策更新

PR #31 修正 `0682e43` 取代先前自動回收 dead-PID 鎖的行為。server／admin／transfer／HistoryStore 拒絕任何既有資料或 legacy 鎖；publication 同樣不回收。正常 owner 釋放冪等，仍保留 legacy 純 PID 格式供舊程式辨識，但不能同時運行仍自動回收鎖的舊 writer。

異常終止後先停所有 writer 及自動重啟，再核對實際 DB／history／community／music 鎖與內容，保存證據後人工處理；不能只憑 PID 已結束刪檔。發布鎖與 restore marker 可能代表半份還原，保留現場並另選新目錄重試，不能當一般資料鎖刪掉後啟動。操作流程見 [人工檢查](../SERVER-DATA-TRANSFER.md#殘留鎖的人工檢查)。Windows Node24.14.0 完整374/374與11項鎖回歸通過，本次未重跑Linux，未操作正式資料；詳 [進度](../SERVER-DATA-TRANSFER-PROGRESS.md#pr-31殘留鎖競態修正)。

## 2026-10-05 追加：schema 13 禁題資料

程式 `2cf8a44` 新增 `draw_word_exclusions`，保存內建／共編題目 ID、正規化題名、首次通過的房間／result／gameRun、至多八名選民與票者、過半門檻及時間；不存帳密或畫布。移轉驗證的 schema 必備表同步至 v13。完整備份還原原樣保存已通過禁題，v12 來源只在還原副本建立空 ledger；來源不變，v13 缺表拒絕。

未過半 ballot 與最近八輪結果只存在 room 記憶體，不屬於資料包。Windows／Linux 各431項，其中移轉26項及3項新禁題相容性回歸通過，詳 [禁題進度](../DRAW-WORD-BAN-PROGRESS.md)。尚未操作正式資料，沒有解除禁題 UI；不要把 soft exclusion 說成已刪除歷史作品。

更新：2026-10-05。主規格：[多環境資料移轉](../specs/MULTI-ENV-DATA-MIGRATION.md)。第一版工具已完成實作與隔離驗收，操作入口：[完整備份還原](../SERVER-DATA-TRANSFER.md)，最新送審與證據：[驗收進度](../SERVER-DATA-TRANSFER-PROGRESS.md#送審前最終複查)。未備份、切換或遷移正式資料。

## 責任

負責持久資料、schema相容、origin identity、asset與history一致性、權威切換／回退、安全環境設定及restore驗收。需求超過兩台開發機先做環境隔離，不預設把live SQLite雙向複製。

## 本專案真相

| 項目 | 現況 |
| --- | --- |
| DB | `src/db/index.js` v14、Node sqlite DatabaseSync、WAL、foreign_keys/busy_timeout、BEGIN IMMEDIATE |
| users/media | 帳號、角色表情圖片／音效／gift／artwork bytes在DB BLOB；users.appearance有JSON引用 |
| music | metadata在music_tracks，實音檔在`MUSIC_DIR || dirname(DB_FILE)/music`；settings 已映射 MUSIC_DIR |
| community | `COMMUNITY_DIR/community.json`存majority題庫與舊issue；BoardStore啟動legacy import |
| history | `HISTORY_DIR`每session/match JSONL＋meta＋enginehash；`.lock`是當地PID，不隨restore複製 |
| transient | room/seats/maps/draw canvas/current music/dice continuations在記憶體，重啟不恢复 |
| deploy | 既有Linux `shared`與current release symlink/systemd，詳[部署指南](../DEPLOYMENT.md)／[歷史紀錄](../LINUX-DEPLOYMENT.md)，執行前重查實況 |

## 穩定判斷

- 多dev各自DB/data/origin；prod單寫。SQLite WAL不可跨SMB/NFS同開；一份consistent SQLite backup仍不等於跨music/history的完整一致備份。
- 先排空／interrupt房間並停所有writer，完整bundle SHA-256/row counts/foreign_key_check/integrity_check/music bytes/JSONL驗证；到全新shadow目录dry-run migration後整代切換。active前保留舊code＋data rollback；接受新寫入後不可直接回舊snapshot丟交易。
- 不能打印`.env`／cookie／token／password_hash。認證資料与secret分開，還原預設revoke session。dev sanitized fixture禁遠端投稿side effects，不能把prod admin/GitHub/Tunnel keys複製過去。
- UUID避免隨手整數撞號，但不同origin同username仍不能自動合併；所有FK、appearance/payload/source引用皆需typed mapping。相同UUID不同digest是hard conflict。created_at不足true merge，需base revision/tombstone/change ledger。
- 待新增game_results/match_participants/processed_results/processed_unit_events與player agent對齊。result_unit match UUID／canonical user id是永久去重；roomcode／seatname不行。dev/staging結果不可授予prod胜利/成就，舊缺user映射history標unverifiable。
- 正常quota完局與timeout／斷線品質旗標分離；第一次finalize凍結勝者／參與者，之後離房不重新算結果。詳[成就與戰績規格](../specs/ACHIEVEMENTS-AND-RECORDS.md)。
- 多正式worker需中央DB/objectstore＋一房一個權威worker/lease/fence/routing；Postgres本身不會讓本地Map共享，也不會把logical replication變多主自動merge。

## 接手執行順序

1. 讀使用者授權與最新AGENTS／role index，resolve實際paths而非猜repo data。
2. 匯出manifest與操作計畫，先在合成fixture驗三台restore與故意損壞／schema超前／少音檔／FK／partialcopy／磁碟滿／duplicateimport。
3. 確認單寫切換窗口、restart房間影響、rollback schema/code資料三者相容，再執行被授權的正式步驟。
4. 記錄bundleId/source commit/schema/node/sqlite與不含祕密的驗收結果；升級證據和「未驗」清楚分開。

Node 官方 backup API 必須 feature-detect；現工具採 sqlite.backup 或 VACUUM INTO，不熱拷 main DB 漏 WAL。Windows Node24.14.0／SQLite3.51.2 與 Linux22.22.1／3.46.1 各255項及雙向 restore／原密碼登入／私人圖片／音樂 Range 已驗；forceVacuum 分支通過，不等於真的跑過最低22.13 runtime。詳驗收文件。

## 第一版實作接手（取代舊「僅研究」狀態）

來源 `c831e87`，使用者選完整移轉／備份還原並要求帳戶一起搬。`tools/server-data.cjs --request <file|->` 是 JSON 契約入口；keygen／inspect／export／verify／restore。保留 users 全欄位、UUID／原密碼 hash／role／disabled／appearance；只有 target 撤銷 sessions／invites／resets。帳戶 digest 与 BLOB digest 在 policy／副本 migration 後核對，舊資料不因還原被升級或重設密碼。

sourceStopped:true 必須對應實際停所有 writer；app／admin CLI 與 transfer 共用四類資料鎖，legacy history PID 鎖也取得。不會阻止任意不遵守契約的外部 SQL 程式，沒有跨主機鎖。export 首次寫 DB 旁的 origin identity JSON；其餘 source 持久內容保留。

AES-256-GCM payload＋HKDF/HMAC manifest、hash／size／rowcount／FK／appearance／music／JSONL engine 驗證。完整包含敏感帳戶 hash／歷史，key 和 bundle 分開保管；Windows ACL 要操作方確認。內建素材 fingerprint 必須相同，application commit 僅記錄，程式相容與切換仍需驗。

restore 預設 dry run，只有 literal apply:true 發布全新 destination；existing 即空目錄也拒絕。migration、BoardStore legacy import、token 刪除、pending／sending→needs_review 只在副本執行。returned config 明確 EXTERNAL_SIDE_EFFECTS_ENABLED=false；操作方須真的套到服務，這支程式不改 .env／systemd／Tunnel。publication lock／marker 阻止半份新代開啟；失敗不要手刪 marker 啟動，保留舊代並另選新代重試。

初版當時未發 MR，最新送審狀態見驗收進度；未執行正式資料搬移／部署，未做 merge、Postgres、匿名化 prod→dev、記憶體房間續局、TB 包、第三主機或真實掉電。後續正式移轉需來源／目標／停寫窗口及部署流程，新代接受寫入後不能直接退舊 snapshot。

## 管理員本機 UI 補充

2026-10-05、來源2618c4b：`npm run data:transfer:ui` 啟動獨立 server，只綁127.0.0.1，不能透過公開站 `/admin` 做冷移轉。管理者填 OS 絕對路徑、keyFile 及操作，JSON 預覽可交AI使用；預設 dryrun、apply 明確選擇並勾目標停寫，改資料路徑重新確認。API 重用同一 transfer.run，不削弱資料鎖、publication fence 或新代限制。

Host／Origin／每次啟動随机 token 保護端點，操作串行，重整只查正在跑的工作與最近去敏結果，不重送。這是本機 OS 使用者工具，沒有用停掉的遊戲服務 session 認證，不能拿去公開 Tunnel；同機能讀本機頁面的程序不在此權限隔離範圍。Ctrl+C 等現有工作收尾，強殺仍依 lock／marker 回復流程。

Windows／Linux 各259項通過（移轉16＋UI HTTP4）；完整 HTTP workflow 原密碼登入、active source拒絕、錯origin/token/host、忙碌與刷新已驗。主agent原Chrome背景keygen→inspect→export→verify→dryrun→apply→reload通過，只合成帳戶1筆。收合版31c91dd預設隱藏完整JSON，重要統計/config/下一步可見；1767×1196仍可小捲，未驗手機，證據見進度文件。

後續 `215f82c` 補 localSubmitting／stateEpoch，避免舊查詢解鎖新移轉與不明狀態重送；11項UI VM回歸已驗。PR資源修正backport `db9d0b6` 後，Windows／Linux完整整合各304項通過，取代259項作為最新總數，詳 [進度](../SERVER-DATA-TRANSFER-PROGRESS.md)。新服務啟動前須核對 `HISTORY_*`：預設30天／512MiB／1000份 archive 會淘汰舊已完成歷史，完整包仍保存原始資料。保留期與容量要依需要先設定，不可把驗包成功解釋成服務永不淘汰。

2026-10-05 送審複查修正 `6e655de`：不能比較升級前後整個 BLOB digest map 是否相同，因 schema 3／5／8 會新增資料表。既有表 digest、帳戶 digest 必須完全一致；新表只限明確 migration 表且為空，其餘差異仍阻止發布。schema 1／3／5／7 完整還原與原密碼登入、來源不變及破壞注入回歸已驗；完整 Windows／Linux 各 **335/335**，取代此前整合測試數字，詳同一進度末節。這不是正式搬移驗收。

## 管理者從其他站匯入

2026-10-05，`47d79c7`：UI 預設選取瀏覽器本機的加密備份資料夾＋32-byte key，上傳到管理工具主機，再驗包、預演、發布全新目錄。目的地仍是工具主機的絕對路徑；SSH 同埠轉發可供遠端操作，沒有公開站 `/admin` 路由或自動部署。手填伺服器路徑及來源站 keygen／inspect／export 仍保留。使用者沒有要求兩站合併，實際來源尚未提供。

新增 `ui-uploads.js`：token／Origin／Host 後逐檔串流，manifest 先傳且只允許其 payload 白名單、精確 bytes；10 GiB／20,000 payload／5 MiB manifest／四批次上限。API 與 transfer 共用 busy，finish 呼叫真正 verify；已驗證 entry 封存。GET state 回安全摘要讓刷新恢复／清理，不回傳 key bytes。正常關閉等待工作完成再清理 owned temp；強殺不保證清理，也不自動刪其他程序的暫存。永久 key／backup／destination 禁止落入受管暫存根目錄。

審查以 A→B 同 key 換包重現 path 指紋不足；restore 新增可選 `expectedBundleId`，完整驗包後、policy／publish 前比較，不符 `BUNDLE_CHANGED`。UI 自動從 verify 帶到 dryrun 與 apply；AI 也應帶入。CLI 未帶此欄位保留舊契約，不能宣稱所有 CLI 操作都要求先預演。合成資料與背景 Chrome 證據、完整最新測試總數见 [進度末節](../SERVER-DATA-TRANSFER-PROGRESS.md#管理者匯入流程與背景-chrome-驗收)。

## 2026-10-06：schema 13 股市冥燈（本機）

基底 main b843a3f 的隔離本地分支新增 market_rounds／votes／settlements／ledger／requests 五張非BLOB表，已有日期／唯一帳號票／結果版本／反向撤銷／冪等收據。上限13取代先前最新上限12，歷史記錄保持其當時版本。完整加密包保存五表；validation新增逐版計分與撤銷一致性。合成12版升級不改帳號hash／UUID／role，13版 export／verify／預演／restore 保留全部市場紀錄且撤銷sessions、原密碼可登入；損壞計分拒絕。Windows Node26.2.0 完整387/387與背景Chrome已驗，詳 [本機說明](../MARKET-JINX.md)。舊12程式不可開13資料，未提供降版；將來回退需舊程式及升級前完整備份一併恢復。本次未讀寫既有專案或正式備份資料，未部署或正式升級。

同日 PR #38 審查修正：時鐘回退可讓投票 updated_at 早於 created_at，合法API寫入後反而無法完整備份，已以注入時間與真實 export 重現。更新票改取 now／原created_at／原updated_at最大值；不改以鎖後實際時間裁決截止的政策、不放寬語意驗證。回歸先前時間+2秒再回退至建立時間−1秒，票可修改、完整export／verify通過，精確截止仍拒絕。市場17／Windows完整391項通過，取代上段387的最新數字；沒有修改OS時鐘或正式備份，詳 [逐項證據](../MARKET-JINX.md#2026-10-06pr-38-獨立審查修正)。

同日與main `1447430` 必要整合：當前schema14取代最新13上限；完整legacy13禁題版與市場版均能冷export／verify／預演／restore，來源不變、目標升14、兩方已有行／帳號原值保留、sessions撤銷。14缺表、13部分市場布局／兩方皆缺及13壞積分拒絕；14混合備份保存禁題稽核與更正ledger。市場21／移轉26、Windows完整463/463通過；#34相關自動回歸保留，資料鎖／transfer核心與main相同。詳 [整合證據](../MARKET-JINX-MAIN-INTEGRATION.md)。未提供降版，未操作正式資料或備份。
