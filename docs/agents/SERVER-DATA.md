# Server／資料 agent 記憶

更新：2026-10-05。主規格：[多環境資料移轉](../specs/MULTI-ENV-DATA-MIGRATION.md)。第一版工具已本地實作，操作入口：[完整備份還原](../SERVER-DATA-TRANSFER.md)，證據：[驗收進度](../SERVER-DATA-TRANSFER-PROGRESS.md)。未備份、切換或遷移正式資料。

## 責任

負責持久資料、schema相容、origin identity、asset與history一致性、權威切換／回退、安全環境設定及restore驗收。需求超過兩台開發機先做環境隔離，不預設把live SQLite雙向複製。

## 本專案真相

| 項目 | 現況 |
| --- | --- |
| DB | `src/db/index.js` v12、Node sqlite DatabaseSync、WAL、foreign_keys/busy_timeout、BEGIN IMMEDIATE |
| users/media | 帳號、角色表情／gift／artwork bytes在DB BLOB；users.appearance有JSON引用 |
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

未執行正式資料搬移／部署／MR；未做 merge、Postgres、匿名化 prod→dev、記憶體房間續局、TB 包、第三主機或真實掉電。後續正式移轉需來源／目標／停寫窗口及部署流程，新代接受寫入後不能直接退舊 snapshot。
