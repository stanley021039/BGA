# Server／資料 agent 記憶

更新：2026-10-05。主規格：[多環境資料移轉](../specs/MULTI-ENV-DATA-MIGRATION.md)。此文件不表示已備份、已切換或已遷移。

## 責任

負責持久資料、schema相容、origin identity、asset與history一致性、權威切換／回退、安全環境設定及restore驗收。需求超過兩台開發機先做環境隔離，不預設把live SQLite雙向複製。

## 本專案真相

| 項目 | 現況 |
| --- | --- |
| DB | `src/db/index.js` v12、Node sqlite DatabaseSync、WAL、foreign_keys/busy_timeout、BEGIN IMMEDIATE |
| users/media | 帳號、角色表情／gift／artwork bytes在DB BLOB；users.appearance有JSON引用 |
| music | metadata在music_tracks，實音檔在`musicDir || dirname(DB_FILE)/music`；env settings尚未映射MUSIC_DIR |
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

Node官方backup API须feature-detect與runtime檢查；本機讀到Node24.14.0有backup，不推論正式Node或最低22.13相同。可用既有Python Connection.backup，勿熱拷main DB漏WAL。此輪只有research與isolated prototype，沒有正式migration／Chrome／commit/push/deploy。
