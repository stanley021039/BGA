# 完整伺服器資料移轉與備份還原

狀態：2026-10-05，第一版已在本地實作，程式來源 `c831e87`；Windows／Linux 合成資料驗收通過。這是一支給 AI 或管理者操作的 JSON CLI，產生加密備份並還原到**全新資料目錄**。實際正式資料、服務切換及部署尚未執行。詳細證據見 [驗收進度](SERVER-DATA-TRANSFER-PROGRESS.md)，架構邊界見 [原規格](specs/MULTI-ENV-DATA-MIGRATION.md)。

## 保留的資料

| 資料 | 第一版行為 |
| --- | --- |
| 帳戶 | 完整保留 `users`，包括 UUID、登入名稱、顯示名稱、原密碼 hash、管理者／會員權限、停用狀態、appearance 與建立時間；玩家用**原帳號及原密碼**重新登入。 |
| 登入／邀請／重設連結 | 備份包含來源資料；只在還原副本刪除 sessions、invites、password_resets。舊 cookie、邀請與重設連結不能在新環境沿用。 |
| 角色、表情、作品、禮物 | SQLite BLOB、所有權、分享欄位及 profile 引用原樣保存；還原前驗證外鍵、引用與 BLOB digest。 |
| 題庫、留言、成就 | 保存 SQLite 資料、共編 `community.json`；舊 JSON 留言及回覆在還原副本依現有 BoardStore 規則匯入。未新增勝場統計。 |
| 音樂 | SQLite metadata 與外部原始音檔一起保存；驗證 metadata、大小、音訊格式。符合檔名規則的孤立音檔也保留並報告數量。 |
| 歷史 | 保存 session／match JSONL、meta、引擎原碼及 hash；嚴格拒絕缺檔、截斷、未配對操作或 hash 不符。 |
| 外部投稿 | 保留 payload、remote identity 及完成狀態；pending／sending 改為 needs_review，需管理者查核 GitHub 後決定重試。 |
| 來源身份 | `source.envId` 與永久 `dataInstanceId` 放入 manifest。首次 export 在 DB 旁建立 `.<DB檔名>.data-instance.json`，後續沿用。 |

`.env`、GitHub／Tunnel token、SSH key、部署程式與當前記憶體房間不放進包。內建 `public/assets` 跟程式部署，bundle 記錄其 fingerprint 並在還原前比對；不會自動下載或切換程式。帳戶 hash、素材及完整歷史仍是敏感資料，`accountCredentialsIncluded` 明確為 true；這不是匿名化開發副本。

## 執行介面

需 Node.js 22.13 以上，無額外 npm 套件。使用對應程式版本，在專案根目錄執行：

```text
node tools/server-data.cjs --help
node tools/server-data.cjs --request <JSON檔案>
node tools/server-data.cjs --request -
```

最後一種由 stdin 讀取完整 JSON。`npm run data:transfer -- --request <JSON檔案>` 也可供人工使用；AI 直接執行 node，避免 npm 標題混入 stdout。所有資料路徑都必須是當前 OS 的絕對路徑；Windows JSON 可使用 `C:/...`。請把含私人路徑的 request 放在 Git 忽略的 `work/` 或私有位置。

每次 stdout 只輸出一筆 JSON，成功退出碼 0，失敗退出碼 1：

```json
{"ok":true,"result":{"action":"verify","bundleId":"..."}}
```

```json
{"ok":false,"error":{"code":"DATA_IN_USE","message":"Data is in use; stop all writers first"}}
```

Node 的 SQLite experimental warning 可能出現在 stderr；AI 應解析 stdout JSON 與退出碼，不把 stderr 當 JSON。錯誤回應不輸出原始 SQLite 錯誤、stack、密碼 hash、cookie 或 JSON 自由文字。request 上限 1 MiB。

| action | 必要欄位 | 結果與作用 |
| --- | --- | --- |
| keygen | keyFile | 建立全新的 32-byte 二進位 key；只回傳路徑及 fingerprint，不回傳 key 內容。 |
| inspect | sourceStopped:true、source | 冷資料盤點，回傳表筆數、帳戶／BLOB digest、音樂及歷史數量；不遷移來源 schema。 |
| export | sourceStopped:true、source.envId、source 路徑、keyFile、outputDir | 一致 SQLite snapshot，加密全部持久資料，驗完才發布新 bundle 目錄。 |
| verify | bundleDir、keyFile | 認證、解密至暫存位置並驗完整性；不產生可啟用的資料代。 |
| restore | bundleDir、keyFile、destinationDir | 預設完整 dry run：解密、遷移副本、套用還原政策、驗證後清理暫存。只有 `apply:true` 才發布新資料代。 |

`source` 必須有 dbFile、historyDir、communityDir；musicDir 可省略，預設 DB 旁的 music/。三個外部目錄須存在且彼此獨立，不能包住 DB。空目錄可先由管理者建立。sourceStopped 不是停止服務的指令；呼叫者必須先實際停止所有 writer。

可選參數：maxBytes 預設 10 GiB，最大 1 TiB；verify 的 tempDir 可指定絕對暫存目錄；forceVacuum:true 可強制 SQLite `VACUUM INTO` 備份分支。最多 20,000 個檔案。history 單列上限 16 MiB，JSON 文件及 manifest 也有讀取限制。容量檢查留足 staging／驗證空間；磁碟滿仍可能在寫入時失敗。

## 一次完整操作

以下為 Linux 示範路径，不能直接當目前正式主機設定。先查實際 DB_FILE／HISTORY_DIR／COMMUNITY_DIR／MUSIC_DIR，完成或明确中斷進行中的對局，再正常停止服務、scheduler、投稿、upload 及其他會直接寫資料的程式。新版服務與 admin CLI 使用共用資料鎖；export 也取得舊版 history PID 鎖。鎖不是阻止任意外部 SQL 程式寫入的 OS sandbox，也不支援跨主機共開 SQLite。

1. 建立並保管 key，request 例：

```json
{"action":"keygen","keyFile":"/private/afterhours-backup.key"}
```

key 不是文字密碼，不要在 CLI 參數或聊天貼出 bytes；分開保存 key 與 bundle，保留離線備援。遺失 key 就不能恢復。POSIX 使用 0600／0700 權限；Windows 必須由操作方確認私有目錄的 ACL，Node mode 不會建立 Windows ACL。

2. 盤點並 export，新 outputDir 必須不存在，且與來源及 key 分開：

```json
{
  "action":"export",
  "sourceStopped":true,
  "source":{
    "envId":"production",
    "dbFile":"/old-data/afterhours.sqlite",
    "historyDir":"/old-data/history",
    "communityDir":"/old-data/community",
    "musicDir":"/old-data/music"
  },
  "keyFile":"/private/afterhours-backup.key",
  "outputDir":"/backups/2026-10-05-generation"
}
```

inspect 使用同一 source，action 改 inspect 並移除 keyFile／outputDir。一般情況拒絕 playing 歷史。若已確認服務停妥、接受房間無法續局，可在 export **及 restore** 分別提供 acknowledgeInterruptedMatches:true；restore 才會在副本追加 interruption 紀錄，保留最後已落盤 state，不產生虛構分數。

3. 傳輸整個 bundle 目錄，在目標用相容程式及同一套內建素材 verify：

```json
{"action":"verify","bundleDir":"/backups/2026-10-05-generation","keyFile":"/private/afterhours-backup.key"}
```

bundle 是目錄格式，不是 tar 檔：只有 manifest.json 與 payload/000001.bin 等檔。全部 payload 使用 AES-256-GCM；manifest 使用 HKDF 分開衍生的 HMAC key 認證，另驗明文／密文 SHA-256 與大小。manifest 的來源標籤、數量、digest、版本是可讀的 metadata；認證表示包由 key 持有人產生，不會證明任意填入的 envId 是真實主機。

4. dry run 預演新資料代：

```json
{
  "action":"restore",
  "bundleDir":"/backups/2026-10-05-generation",
  "keyFile":"/private/afterhours-backup.key",
  "destinationDir":"/data-generations/generation-2026-10-05",
  "apply":false
}
```

回報 dryRun:true、原／還原筆數與 digest、撤銷 token 數、held submissions 數及預計 config。未產生 destination，不能用這份預計路徑啟動服務；暫存父目錄可能已建立。確認結果後用相同 request 將 apply 改為 literal true。既有 destination **即使是空目錄**也拒絕；重複執行不能覆寫或 double-import。

5. 成功 apply 回傳新設定，並在 destination 保存 restore-receipt.json：

```json
{
  "DB_FILE":"/data-generations/generation-2026-10-05/db/afterhours.sqlite",
  "HISTORY_DIR":"/data-generations/generation-2026-10-05/history",
  "COMMUNITY_DIR":"/data-generations/generation-2026-10-05/community",
  "MUSIC_DIR":"/data-generations/generation-2026-10-05/music",
  "EXTERNAL_SIDE_EFFECTS_ENABLED":"false"
}
```

將 config 明確套用到隔離服務，設定 HOST=127.0.0.1 和獨立 PORT，避免對外路由。CLI 不會改 .env、啟動 systemd、修改 active symlink／Tunnel 或執行 SSH。系統環境變數優先於 .env，須核對實際啟動程序使用新路徑及 false；不能沿用 `.env.example` 的 true 就宣稱已隔離。

EXTERNAL_SIDE_EFFECTS_ENABLED=false 會封鎖新投稿、重試、遠端查核及 recover，即使已設定 GitHub token；遊戲資料操作仍可進行。這個旗標目前涵蓋 SubmissionService 的 GitHub 整合，不是所有未來外部服務的通用網路防火牆。查核 needs_review remote identity 後才可以在正式切換時明確啟用。

6. 驗收原密碼登入、admin／member 權限、停用帳號拒登、私人角色／圖庫授權、profile 引用、音樂 HEAD／Range、題庫、歷史及 pending 投稿。保留舊 code＋資料代，確認舊 writer 與路由已停止，再由部署流程切換權威。新服務沒有原記憶體房間，玩家需重新登入及開房。

## 失敗與回退

| error.code | 操作方應做的事 |
| --- | --- |
| SOURCE_NOT_STOPPED／DATA_IN_USE | 確認所有 writer 停止；不同主機或无法辨認的鎖不要直接刪掉。 |
| DESTINATION_EXISTS／UNSAFE_PATH | 選新目錄；拒絕來源／輸出相互包含、symlink／junction、路徑穿越與大小寫撞名。 |
| AUTHENTICATION_FAILED／CORRUPT_BUNDLE | 查 key 與傳輸是否完整；不啟用不完整資料。 |
| UNSUPPORTED_SCHEMA／UNSUPPORTED_BUNDLE／ASSET_VERSION_MISMATCH | 使用相容程式及素材。較新 schema 在任何 migration 前拒絕；舊 schema 只遷移副本。 |
| FOREIGN_KEY_FAILED／BROKEN_REFERENCE／INVALID_HISTORY／MISSING_MUSIC | 修復或重新取得完整冷備份，不能忽略錯誤強制匯入。 |
| UNFINISHED_MATCHES | 完成對局，或明確接受還原時中斷的政策。 |
| INSUFFICIENT_SPACE／ENOSPC | 釋放／更換 staging 磁碟空間，使用新 destination 重試。 |
| PARTIAL_RESTORE／RESTORE_IN_PROGRESS | 新資料代禁止啟動；继续使用舊資料代，調查失敗並另選全新目錄重試。 |

發布前使用 sibling publication lock；發布中 `.afterhours-restore-in-progress` marker 阻止新版服務／admin 開啟資料；完成後才移除 marker。若發生程序終止、磁碟故障或只搬了一部分，新代可能留 marker 或 publication lock。**不要靠手動刪 marker 宣稱成功**；保留證據、確認沒有 writer、核對 receipt／全部資料後，通常重新 restore 至新目錄較清楚。CLI 不會自動接續半份 restore，也不會清除舊正式資料。

新 writer 尚未接受任何寫入時，可停新服務並切回相容的舊 code＋舊資料代；若已接受新登入或其他寫入，先冷備份新代再做受控前向修復，直接回舊 snapshot 會丟新資料。GitHub 外部操作不能由本地 DB rollback 撤銷。

第一版未實作真實正式切換、雙端 merge、PostgreSQL、匿名化正式資料副本、房間續局、跨主機 lock 或自動 retention。schema 目前仍 v12。
