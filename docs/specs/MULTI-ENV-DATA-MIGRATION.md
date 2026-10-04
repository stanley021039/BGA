# 多環境伺服器資料與移轉規格

狀態：2026-10-05研究／待實作，未連線、備份或遷移正式DB。現況依 `src/db/index.js` schema v12、`src/app.js`、`src/music/store.js`、`src/history/store.js` 與部署文件盤點。正式主機路徑是既有部署文件的紀錄，切換前仍须重新確認，不把本文當即時服務狀態。

## 建議決策

開發超過兩台機器，先採**每個dev/staging獨立資料＋prod單一寫入權威**。開發同步的是程式版本／schema及人工核准的素材、題目包，不是整份live資料庫。換正式主機用完整一致快照及一次切換；舊主機退出寫入後才新主機開始。

此為尚未獲使用者確認的工作假設：多台機器主要是不同開發／測試環境。使用者若要求同一份正式資料同時由多台server提供服務，改採下述中央DB＋單房間權威worker方案，不能以開發隔離回答正式多機共用需求。

若確實要兩台正式app同時服務同一批帳號，第二階段使用中央PostgreSQL與物件儲存；房間仍須一房一個權威worker／lease及路由。Postgres共享持久資料不會自動共享當前Map房間，也不是雙向合併兩份SQLite的工具。

| 方案 | 適用 | 邊界 |
| --- | --- | --- |
| 隔離dev/staging/prod | 現在優先；3台以上開發 | 專屬DB/檔案/hostname/auth/session；禁止dev寫正式成就或GitHub |
| 一台權威app+SQLite，其他由API讀寫 | 小型正式站、換主機 | DB及WAL在單一host；備援平時不寫；restart無記憶體房間 |
| 中央Postgres+物件儲存 | 多正式worker／寫入量明確需要 | 要改同步DB API、資料存取層、room lease/routing、media/history管理 |
| 離線全量快照replace | 正式換主機／受控災難還原 | 不是merge；source一個一致時點；destination先有rollback bundle |
| 真正雙端merge | 必須離線兩邊都寫且都保留變更 | 現有schema缺變更基準／tombstone／revision，尚不可安全自動做 |

SQLite WAL要求同一host共享記憶體，不能把`.sqlite`放SMB/NFS让跨主機同時開啟；同一DB只有一個writer。[SQLite WAL](https://www.sqlite.org/wal.html)

## 真正要搬的資料

| 分類 | 本專案路徑／欄位 | 移轉內容／限制 |
| --- | --- | --- |
| 帳號與認證 | `DB_FILE`預設`data/afterhours.sqlite`；users/sessions/invites/password_resets | UUID、密碼hash與角色皆敏感；dev不得沿用prod session；跨主機正式切換亦預設撤銷session要求重新登入 |
| 客製角色與表情 | player_characters、character_images.bytes/mime/label | bytes在SQLite BLOB；`/assets/characters/user/...`是授權HTTP虛擬路由，不是獨立圖片目錄 |
| 頭像／畫作 | users.appearance JSON、user_artworks.bytes、shared | 头像引用characterId/expression或artworkId；保留或重映射引用，不只搬users表 |
| 自訂禮物／猜題 | community_gifts.image_bytes、title_key；draw_words.aliases/topic/title_key | BLOB、JSON文字、唯一title_key与owner FK皆需驗證 |
| 留言／遠端投稿 | board_issues、board_comments、submissions.payload/state/remote_id | 維持GitHub remote identity；還原後禁止自動再發pending投稿；人工reconcile避免外部重複Issue |
| 成就 | user_achievements(user_id,achievement_id,source_key,unlocked_at) | DB唯一解鎖；目前處理結果WeakSet不跨restart，未有持久勝場aggregate |
| 音樂 | music_tracks metadata＋`config.musicDir || dirname(DB_FILE)/music/{id}.{ext}` | 音訊不在SQLite；settings目前沒有MUSIC_DIR環境映射，不能以為搬DB就有音樂 |
| 共編題库／舊留言 | `COMMUNITY_DIR`預設`data/community/community.json` | majority題庫仍JSON；BoardStore啟動時會import legacy issues，不能丟掉或重複誤判 |
| 歷史 | `HISTORY_DIR`預設`data/history/*.jsonl`、`*.meta.json` | session與match UUID、engine source/hash、隨機trace、before/after；秘題／喜好完整內容屬敏感資料，非預設公開資產 |
| 內建素材／目錄 | `public/assets`、內建character/gift目錄及game catalogs | 跟對應code release一起部署；manifest保存release hash，不把public圖片當user BLOB |
| 進行中狀態 | rooms/seats/musicRooms/social/reconnectGrace、draw canvas、diceCheck continuation | 只在記憶體；目前restart即丟失，不承諾restore會讓玩家無縫續局 |
| 環境祕密 | `.env`、GITHUB_TOKEN、Tunnel token、SSH key、DB credentials | 專属機器祕密，另走祕密管理，不進Git／通用bundle／日志。設定範本只列變數名 |

正式部署文件記錄 `current` release symlink、`/home/ccc/apps/afterhours/shared`、afterhours/tunnel systemd。移轉要覆蓋配置解析到的實際絕對路徑，不依賴repo `data/`猜測。歷史`.lock`是當地程序PID，不能從source直接複製當destination有效鎖；staging驗證和正式服務也不能共用同historyDir。

## 環境隔離與外部副作用

規劃 `APP_ENV=development|staging|production`、永久`ENV_ID`與`DATA_INSTANCE_ID`，三者納入manifest／result provenance。現行settings只提供PORT/HOST/PUBLIC_URL/DB_FILE/HISTORY_DIR/COMMUNITY_DIR，新增變數仍待實作。

- 不同環境必須有不同DB、history/music/community目录、port与origin。若同hostname不同port，現在cookie名`ah-session`可能互相覆蓋，localStorage也不能当登入隔離；优先用不同hostname，仍規劃環境特定cookie名。不同DB令相同cookie不可被驗證不等於使用者不會被登出。
- prod→dev預設合成fixture；若需真實副本，先於封閉環境去除sessions/invites/password_resets、禁用／替換password_hash、管理者身份、外部投稿queue与GitHub凭证，再匿名化users／題目自由文字／圖片／音訊與歷史。不把原歷史中的帳號／秘密答案遗漏在JSONL。
- 所有環境必須以真正防護關閉不允許的外部寫入。缺GITHUB_TOKEN可能讓投稿失敗，不等於安全地停止整個outbox；新增externalSideEffectsEnabled旗標／fakeGitHub adapter後驗證無出站寫入。
- 兩台connector連同一Tunnel不等於本專案有多主房間／DB。權威切換需撤下舊路由／停舊writer，不能讓同域同時送到獨立rooms Map的兩台機器。[本專案部署指南](../DEPLOYMENT.md)

## 一致快照與bundle manifest

SQLite online backup API可取一致DB副本；`VACUUM INTO`也產生一致快照，destination必須不存在或為空，意外中斷輸出可能不完整。必須等待完成、驗證後才發布bundle。[SQLite backup](https://www.sqlite.org/backup.html)、[VACUUM INTO](https://www.sqlite.org/lang_vacuum.html)

可用經版本確認的Node `node:sqlite.backup`；本次只讀runtime probe為Node24.14.0、backup可用，這不代表最低Node22.13及正式host均有同API。實作要feature-detect并明確記錄runtime；既有部署使用的Python `Connection.backup`可作替代。[Node SQLite](https://nodejs.org/api/sqlite.html)、[Python backup](https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup)

禁止直接複製運作中的main `.sqlite`而忽略WAL，或分不同時間複製db/wal/shm假裝一致。關閉所有連線後的冷備份可行，但須確認正常關閉與相關WAL狀態；checkpoint不是跨DB與檔案的全域交易。

SQLite snapshot只保證DB的一致性。`MusicStore.add`先寫檔才insert、remove先unlink再DELETE；history和community也各自寫檔，因此此版採**短暫全域停寫／排空房間**的完整bundle。不僅凍結HTTP：scheduler、自動投稿、音樂upload/delete、historyappend也必須停；目前無maintenance API，第一版用正常停服務取得冷的一致時點，不能宣稱online零停機。先完成進行中對局或明確interrupt，不秘密中止並算玩家輸。

```json
{
  "bundleSchema": 1,
  "bundleId": "UUID",
  "sourceEnvId": "prod-origin-id",
  "dataInstanceId": "UUID",
  "snapshotAt": "ISO-8601 UTC",
  "applicationCommit": "Git commit",
  "db": { "path": "db/afterhours.sqlite", "userVersion": 12, "sha256": "...", "bytes": 0 },
  "files": [ { "path": "music/UUID.mp3", "sha256": "...", "bytes": 0, "mime": "audio/mpeg" } ],
  "history": { "sessions": 0, "matches": 0, "playing": 0 },
  "counts": { "users": 0, "music_tracks": 0, "character_images": 0, "user_artworks": 0 },
  "runtime": { "node": "...", "sqlite": "..." },
  "policy": { "mode": "replace", "secretsExcluded": true, "accountCredentialsIncluded": true, "sessionsRevokedOnRestore": true }
}
```

manifest必須列出全部music/community/history檔、資料表rowcount與BLOB總bytes／digest、內建資產release/hash、預期owner關係、excluded secrets。relativepath一律驗證在bundle root內、拒絕`..`／absolute／symboliclink逃逸及archive炸彈；verified SHA-256只是檢完整性，不是可信來源認證，從認證加密通道傳輸並使用受保護簽章／HMAC驗origin。包含password_hash的DB與完整history包須加密及限權。

`secretsExcluded:true`只表示部署keys/token/.env不入包，不表示包內沒有敏感認證資料。正式restore包仍含users.password_hash，因此accountCredentialsIncluded:true。dev sanitized bundle須實際去除／不可登入地替換認證與恢復token，才可標accountCredentialsIncluded:false，並附sanitization report；不是僅改manifest布林值。

## 移轉程序與rollback

1. **盤點與dry-run**：source/destination绝对路径、code/node/sqlite/user_version、磁碟容量、目標owner权限、存取方式與當前房間確認。空destination與任何existing-data merge有不同模式，不自動覆寫。
2. **source停寫**：拒新房与新提交，正常完成或interrupt現有對局；停scheduler與服务／关DB。每一步有時間、角色和bundleId紀錄；清房是顯式切換效果。
3. **產出**：一致DB備份與同時點檔案collect到temporary bundle；驗所有檔案digest、sqlite `integrity_check`=`ok`、`foreign_key_check`零列、user_version在相容範圍、music_tracks→實檔bytes/ext、history meta→可讀JSONL与enginehash。失敗不發布finished manifest。
4. **staging restore**：只解至新獨立目录，DB開啟前先檢schema拒新於目标support上限。在副本預演migration；不要呼叫`openDatabase`直接升正式檔當相容性檢查。撤銷session／invites／resets依環境政策；禁止外部side effects。
5. **應用驗收**：匿名不能看私有素材；合法帳號測角色/表情/画作头像/自訂gift/drawword/majorityJSON題库、音樂Range/HEAD及歷史回看。count和digest相符不是功能全部通過的證明。歷史constructor把playing改interrupted，應在snapshot時已有清楚interrupt紀錄，而非誤把意外截斷當完成。
6. **destination備援**：若原已有資料，先產同規格rollback bundle與旧code release。整個新data generation準備完再停destination，切active pointer／配置并启动一次；OS內同filesystem rename可用于單檔/目錄切换，但不是跨DB+objectstore交易。
7. **權威切換**：確認source writer被fence／connector退出，變更route到新權威。新服務查登入／權限／asset bytes／音樂Range／回看；cookie需重新登入，原記憶體房不存在应正確顯示。
8. **失敗還原**：新writer尚未接受寫入，可停服務、切回舊code＋旧整包data。不只把code降版指向新schema。已接受新寫入後，不可直接回舊snapshot丟交易；再停寫保存新包、比對並前向修復或做受控delta reconciliation。外部GitHub寫入不能靠本地ROLLBACK撤回，依remote id reconcile。

明確驗收：第三台全新空host可從bundle恢复；故意少一個music檔、破壞digest、較新schema、缺FK、壞JSONL、撞UUID、磁碟滿、半包傳輸及不符ACL全部在active switch前失敗且舊資料不動。重复restore同bundle不得double-award／double-submit。测试过程不触碰正式DB。

## identity、勝利紀錄與跨環境import

`users.id`目前已是UUID，username小寫唯一；room seat id也是UUID但不是帳號，6位room code可能重用。不能用名稱或room碼合併身份。`users.appearance`、source_key及submission payload內含引用，重映射不能只改FK欄位；所有JSON引用應以型別schema處理，不任意文字replace。

與玩家研究對齊的**待新增**資料：

| 表／唯一鍵 | 目的 |
| --- | --- |
| game_results `match_id UUID PK`、`result_event_id UUID UNIQUE` | result_unit一次結算：env_id/game_type/rules_version/result_unit/status/finished_at/source_sha256/match_format/quality_flags；status為rules_completed/abandoned/interrupted；unit若hand/round另存parent_match_id/unit_index唯一 |
| match_participants `(match_id,user_id) PK` | canonical帳號、seat snapshot、outcome=`win/shared_win/loss/draw/participated/abandoned`、tie_rank、score_breakdown、server participation_evidence；AI另存非帳號身份 |
| processed_results `result_event_id PK`、`match_id UNIQUE` | 正常finalization與勝利aggregate／achievement授予同一DB交易去重 |
| processed_unit_events `unit_event_id PK` | 入門徽章按round/hand授予，不能過早把整場processed而阻最後勝利 |
| import_batches `bundle_id UNIQUE`、identity_links、import_conflicts | 匯入冪等、origin到canonical user UUID與人工衝突裁定／digest |

一個poker hand可以是獨立result_unit，不能把長期房間session當每手match_id。自由離房不抹掉先前正常已結算的win；未完局abandoned不當loss污染勝率。正常走完quota但有round_timeout/artist_disconnected/participant_absent時，status與quality_flags分開，按玩家規格分桶，不把所有timeout一律抹掉既定勝利。首次權威finalize凍結結果與參與者；之后離房／kick不能重算winner。prod finalization唯一權威，dev/staging的遊戲記錄只能進隔離／研究archive，不增加正式勝場或成就。舊history只有玩家顯示name或room seat UUID、缺immutable user mapping時，標unverifiable，不補勝。詳見[成就與戰績規格](ACHIEVEMENTS-AND-RECORDS.md)。

同UUID同payload digest可跳過；同UUID不同payload硬衝突。不同UUID同username不自動合併：需使用者驗證兩端帳號權、以origin namespace或人工決定canonical identity；password hash、admin role、disabled狀態與sharing不得最後寫入者勝出。題材title_key碰撞時保持兩內容做人工比對／重新命名，不默默丟資料；歷史相同matchUUID不同checksum禁止append合併。

## 真雙端merge與PostgreSQL升級邊界

現有多數表只有created_at，沒有base revision／刪除tombstone；時間戳與「更新較新者贏」無法辨識時鐘偏差、同時編輯或已刪內容。若确有離線雙端寫需求，先新增immutable change_id/origin_env_id/entity_id/base_revision/revision、操作型別、delete tombstone與outbox；明確分append-only内容可union、同row修改三方merge、權限/帳號衝突人工解。每batch先預覽衝突再原子apply到shadow generation；不把SQLite changeset的REPLACE直接當產品merge策略。

Postgres原生logical replication碰到唯一約束會停止，某些update/delete缺資料會略過；不是自動多主衝突解決。[PostgreSQL conflicts](https://www.postgresql.org/docs/current/logical-replication-conflicts.html)

真正升級需先抽repository與async transaction boundary（不可把async callback放現行同步`transaction`裡）；保留UUID，TEXT JSON適配jsonb，BLOB→bytea或immutable object refs，INTEGER booleans→boolean，ISO文字→timestamptz、placeholder `?`→`$n`、INSERT OR IGNORE→明確ON CONFLICT、部分unique index／CHECK／FK逐一對照。引入schema_migrations，不再用PRAGMA版本作Postgres版本。

以隔離source consistent snapshot→型別驗證ETL→全新Postgres shadow schema→table count/FK/BLOBhash/UTF8/unique keys／授權與server tests→短停寫final delta→單寫切換。DB之外music/history移到共享immutable object storage，metadata與outbox同交易、asset publish/GC有crash recovery。多worker房間採owner lease+fencing token、room routing／snapshot／事件恢復；沒有它們仍只准一個app worker。

Postgres後續備援用`pg_dump`/`pg_restore`；restore可用`--single-transaction --exit-on-error`保證失敗不留下部分restore（須評估size/lock），但dump schema內容本身要信任，且外部assets還是另包驗證。它不是直接吃SQLite SQL dump的轉換器。[pg_restore官方](https://www.postgresql.org/docs/current/app-pgrestore.html)

## 本階段完成與未完成

完成：source audit、官方研究、建議取捨、bundle与结果identity提案、驗收及rollback程序。未完成：maintenance/export/import工具、schema變更、Postgres adapter、物件儲存、真正雙向merge；未拿正式資料演練。正式執行前需完成上述本地fixture失敗演練與具體切換窗口。
