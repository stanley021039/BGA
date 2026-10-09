# 最小權限與重構回退手冊

本頁是 **review-ready 操作檢查表，不是正式操作完成紀錄**。來源基線：`2a5a197094c254d4a16cdec682d441af31692c76`；對應 [Issue #79](https://github.com/stanley021039/BGA/issues/79)。合併其他切片後須重新固定 base／head 並核對下列契約，不能把舊 SHA 的測試移作新 head 的證據。

只盤點公開程式及 `.env.example`。本文不建立／讀取正式憑證、不修改 repository／OS／network 權限、不部署、不停正式服務、不備份或還原正式資料。實際操作、秘密處理與服務切換須另有明確授權。歷史部署文件記錄的是當時狀態，不能用來推斷目前服務、資料、token 或 main 保護已配置。

## 1. 來源與交付邊界

- [PR 審查](PR-REVIEW.md)：相同 base／head／merge-base 的規格與品質／風險兩回合，各自留下證據
- [CI](CI.md)／[workflow](../.github/workflows/ci.yml)：Linux／Windows 的 final-head checks；main required checks／branch protection 屬獨立設定，本文沒有配置或驗證其生效
- [打版](RELEASE-POLICY.md)：程式版本、Git SHA、SQLite schema 分開記錄；本次純文件不升版、不移 tag
- [跨平台部署](DEPLOYMENT.md)／[Linux 歷史紀錄](LINUX-DEPLOYMENT.md)：服務操作參考，不是可直接套用的主機盤點
- [資料移轉操作契約](SERVER-DATA-TRANSFER.md)、[資料契約工作 #77](https://github.com/stanley021039/BGA/issues/77)：以當前 [transfer](../src/data/transfer.js)、[validation](../src/data/validation.js)、[locks](../src/data/locks.js)、[DB](../src/db/index.js) 實作為準；舊文件中的 schema15 等段落是歷史相容性證據，基線程式的 `SCHEMA_VERSION` 為 19

| 階段 | 可證明的事 | 不代表 |
| --- | --- | --- |
| 安裝／測試 | `npm ci` 依 lockfile 安裝；`npm test` 執行 pretest release check 及測試 | 沒有 `build` script，不能虛構 `npm run build` 或把安裝當打包 |
| 發行 | 依 RELEASE-POLICY 固定受測 SHA／不可覆寫 tag，另記素材 fingerprint | 發 PR、合 main、打 tag 均不等於部署 |
| 部署 | 經授權選程式與資料代、單一 writer、切入口並完成驗收 | CI 綠燈不代表正式資料相容或恢復成功 |
| 資料 restore | 經驗包、預演後建立全新資料代 | 不會自動改 `.env`、切 symlink、啟停服務、改 Tunnel 或合併兩站資料 |

## 2. 最小權限盤點（現有行為與建議分開）

| 身分／入口 | 程式目前需要的能力 | 最小化建議／限制 |
| --- | --- | --- |
| GitHub CI | workflow 明列 `contents: read`；checkout `persist-credentials:false`；官方 actions 固定 SHA；標準 Linux／Windows runners | 測試不需要正式 secrets、Issues write、deploy 或 repository administration；workflow 不上傳資料 artifact |
| GitHub 投稿 client | `GET /issues`、`GET /issues/:number`、`GET /issues/:number/comments` 做查核；`POST /issues`、`POST /issues/:number/comments`、`PATCH /issues/:number` 做投稿／回覆／狀態同步 | `.env.example` 建議限指定 repository 的 fine-grained `Issues: read/write`；不需要 Contents write、Actions write 或管理權。此為需求盤點，不證明實際 token scope 已最小化 |
| 遊戲會員／管理者 | 投稿服務只讓本人／admin 看提交，status 與 retry 僅 admin；使用 [submissions](../src/integrations/github/submissions.js) 的 UUID／狀態／冪等查核 | 應用角色不等於 OS 身分或 GitHub 權限；`needs_review` 須先查遠端結果，不能盲重試 |
| BGA OS 使用者 | 讀取程式／素材／必要設定，讀寫指定 DB（含 WAL／SHM）、history／community／music 與程式衍生 cache／locks | 建議專用非 root 身分、程式版本與持久資料分離；不要為 runtime 配置 repository 寫權或任意系統管理權 |
| 資料 CLI／本機 UI | 來源讀取、建立資料鎖；export 可建立來源 data-instance sidecar；寫私有暫存、新 bundle／generation，讀指定 key | 不是唯讀操作；UI 使用 OS 權限，沒有遊戲 admin session 隔離。只綁 loopback，不公開管理埠；權限變更仍須另授權 |
| Tunnel／部署操作者 | Tunnel 讀自己的 token、外連 provider；部署者依授權管理版本／服務與流量 | BGA 與 Tunnel 憑證用途分離；不要把 token 放程式碼或 CI。現有部署單元範例的 `NoNewPrivileges`／`UMask` 不代表所有主機都已設定 |

GitHub 路由依 [client](../src/integrations/github/client.js)。`GITHUB_TOKEN` 是服務端秘密；沒設定時投稿回 `GITHUB_NOT_CONFIGURED`，這不是完整隔離方式。`GITHUB_API_BASE` 可由環境覆寫 client endpoint，公開範例未列它；不得讓真 token 隨任意 endpoint 測試。使用假 client／mock fetch 做測試。

### 隔離設定的真實範圍

依 [config](../src/config.js) 與 [app](../src/app.js)：

- 作業系統環境優先於 `.env`；`DB_FILE`、`HISTORY_DIR`、`COMMUNITY_DIR`、`MUSIC_DIR` 必須指向本次隔離資料，不能沿用預設 production 路徑
- `EXTERNAL_SIDE_EFFECTS_ENABLED=false` 阻止 GitHub submit／retry／reconcile／recover，也在 app 組裝時停用市場自動抓取及 YouTube title resolver。不是 OS 網路防火牆，也不停止本機遊戲資料寫入或瀏覽器第三方播放器
- `MARKET_AUTOMATION_ENABLED=false` 可另行明確關閉市場自動化；預設為 true，但市場啟用同時要求 `externalSideEffectsEnabled===true`。兩個設定都必須核對，不從名稱猜測範圍
- `HOST=127.0.0.1`、未使用的獨立 `PORT`，不接公開入口；測試用非正式 `PUBLIC_URL`／無真 token。`PUBLIC_URL` 只管邀請 origin 與 Secure cookie，不建立 HTTPS 或防火牆
- `ACHIEVEMENT_PURPOSE=test` 或 `tutorial` 是已支援的資料用途標籤，不是隔離資料或禁止外連的替代品
- `HISTORY_*` 配額／保留天數與 `HISTORY_PRESERVE_IMPORTED_SESSIONS` 要在第一次啟動前核對；服務可能淘汰過期／超額歷史，驗包成功不表示永不淘汰

## 3. 秘密與可公開證據

公開摘要只列變數名稱及遮罩，例如 `GITHUB_TOKEN=<redacted>`，不要貼真值、部分 token、cookie、Authorization header、備份 key、密碼或 hash。`.env`、私人主機路徑、憑證、HAR、原始資料與操作交接留在經授權的私有位置；gitignore 不是保護邊界。

每次 PR／發行前檢查：

- diff、staged／untracked 檔、全部待發布 commits，不只最終檔案；確認沒有 `.env`、key、資料庫、backup bundle、私有 request／receipt 或實際主機資訊
- test fixtures 必須是合成帳戶／資料；不可從 production 複製「看似無害」的 DB、BLOB、session 或 logs
- stdout／stderr、失敗 stack、CI logs、截圖、影片、archive 與 artifact 逐項檢查；測試假資料也不可被誤當真憑證公開
- bundle 的 payload 加密但含完整帳戶 credentials；manifest metadata／digest／數量仍可讀。verify／dry run 會解密到磁碟暫存，需私有空間、足夠容量與中斷後處理
- `safeError` 會去除 CLI 未知錯誤細節，不保證任何其他日誌都已去敏；不要直接上傳整包日誌作證據
- 發現疑似秘密：停止發布，私下提供不含值的位置與風險；輪替／撤銷／持續存取設定需另授權，不以刪掉一行代替事件處理

## 4. 操作前檢查表（未授權時到此為止）

記錄但不公開私人值：来源與候選 SHA、原／目標 schema 與實際布局、素材 fingerprint、Node/npm/OS、備份 ID、預計停機與恢復目標、資料代映射、writer／自動重啟來源及回退決策人。每個命令記 pass／fail／skip／cancel／blocked，未做的標未驗。

在**隔離 clone、合成 fixture、無正式 `.env`** 中執行以下現有入口；Node >=22.13，CI 固定 Node22 版本以 workflow 為準：

```text
npm ci
npm run release:check
node tools/server-data.cjs --help
node --test tests/config.test.js tests/submissions.test.js tests/data-locks.test.js tests/data-transfer.test.js tests/data-transfer-legacy-community.test.js tests/market-images-transfer.test.js
npm test
git diff --check
```

`npm ci` 是安裝而非 build；受限環境若需使用可寫 cache，記錄實際 `npm ci --cache <可寫絕對路徑>`，不能隱去先前失敗。必要檢查失敗、工具受阻、CI pending／cancelled／skipped 都不能視為通過；未解前保持未推送／未合併。新 head 重核兩回合與雙平台必要 CI。完整測試不等同正式還原、實體 Windows 操作或瀏覽器實玩。

## 5. 冷備份與 writer 停止策略

下列是**另行授權後**的順序，不是本文件已執行的操作：

1. 先確認玩家／房间，完成對局或取得接受中斷的決定。重啟會清掉記憶體房間，沒有續局還原。
2. 停止新流量與全部 writer：BGA、admin CLI、scheduler、投稿／upload、移轉工作與任何外部 SQL 程序。處理服務自動重啟，不能只關 terminal／Tunnel 或設定 `sourceStopped:true`。
3. 依 [server](../src/server.js) 的 SIGINT／SIGTERM 正常關閉；[app.close](../src/app.js) 會停 scheduler／市場／thumbnail、處理成就、結束 streams／server、關 history、等投稿 in-flight、關 DB 再釋放鎖。送 signal 不等於已停妥；逾時、程序仍在或鎖不明即停止，不默默強殺後繼續。
4. 核對四個來源路徑互不包覆、來源與備份／key 分離，沒有 symlink／junction、未知檔案；確認私有 staging／輸出空間。使用實際受測版本的 CLI help 與 [JSON 契約](SERVER-DATA-TRANSFER.md#執行介面)。
5. inspect／export 都要求 `sourceStopped:true` 並取得共用資料鎖及 legacy history `.lock`。鎖不會阻擋任意 SQL 工具或另一主機不守約的 writer，不能拿鎖代替停寫確認。
6. export 對 SQLite 使用一致 snapshot（備援 `VACUUM INTO`），並在同一停寫窗口保存外部檔案、驗證加密包後發布新目錄。運作中只複製 `.sqlite` 或把不同時點的 DB 與 files 相加，不是完整一致冷備份；不可漏 WAL 狀態。
7. bundle 不含 `.env`／部署秘密／程式／活動房間；秘密另按已授權私有備援流程保管。key 必須分開保存且可恢復，不能在命令列或公開證據放 bytes。首次 export 可能建立 DB 旁 data-instance sidecar，不宣稱來源完全零寫入。

## 6. verify → dry run → 新 generation → 驗收

CLI 只有 `--help` 與 `--request <file|->`；沒有 `--dry-run`、`--force`、`--overwrite` 或自動 rollback 旗標。`node tools/server-data.cjs --request <JSON檔案>` 讀 JSON；Windows JSON 使用 `C:/...` 或正確 escaping，Linux 使用絕對 POSIX 路徑。以下僅顯示欄位，不是可直接執行的正式 request：

```json
{
  "action": "restore",
  "bundleDir": "/isolated/example-bundle",
  "keyFile": "/isolated-private/example.key",
  "destinationDir": "/isolated/example-new-generation",
  "expectedBundleId": "<verify 回傳的 UUID>",
  "apply": false
}
```

1. 先用 `action:"verify"`、`bundleDir`、`keyFile` 驗包；可指定 `tempDir`。驗簽、hash、格式、內容及素材 fingerprint 不符即停。
2. 用 verify 的 `bundleId` 填 `expectedBundleId`，對不存在的 destination 預演。`apply:false`（或未填）會真解密、遷移副本、套 restore policy 並驗證，最後清暫存；不發布 destination，也不是零磁碟寫入。
3. 核對來源／還原 summary、帳戶／成就／BLOB digests、檔案／音樂／歷史、schema 及預期 policy 變化。舊布局只按明確 migration 升級副本；schema 數字相同也不保證布局或 metadata 相容。
4. `sessions`、`invites`、`password_resets` 清除；`pending`／`sending` 投稿改 `needs_review`。帳戶 UUID／credential hash 保留；故原密碼仍可登入，但舊 session／邀請／reset link 不可沿用。未完對局若需中斷，export／restore 各需明確 `acknowledgeInterruptedMatches:true`；不產生虛構成績。
5. 經授權才以相同內容、相同 bundle ID、全新 destination 將 `apply` 改 literal `true`。既有目錄即使為空也拒絕；不合併、不覆寫。核對 `restore-receipt.json`、回傳新四路徑與 publication 完成。
6. 應用回傳 `config`，另核對第 2 節隔離設定。CLI 回傳 `EXTERNAL_SIDE_EFFECTS_ENABLED:false`，但不替你寫進程序環境。先隔離啟動驗登入、角色／私人素材授權、音樂 HEAD／Range、歷史、題庫、成就／市場相關資料及投稿保持停用。對 synthetic fixtures 可跑真流程；不得把正式備份當一般測試素材。
7. 首啟可能有 migration／history retention／cache 寫入，驗前後差異需區分預期變動與資料遺失。正式入口切換前停掉舊 writer，保留舊程式＋資料代；不得兩服務同寫一份 SQLite。

POSIX mode 0600／0700 不會替 Windows 建立 ACL；Windows 私有目錄 ACL 必須另核。Node 的 directory fsync 在 Windows 不執行，file fsync 仍執行；不要承諾跨平台相同的斷電耐久保證。服務停止方式也依實際 supervisor：Linux systemd 指令不可直接照搬 Windows。

## 7. 失敗停止與回退決策

| 發現 | 停止條件與下一步 |
| --- | --- |
| `SOURCE_NOT_STOPPED`／`DATA_IN_USE` | 不繞過鎖。確認全部 writer／自動重啟，調查 owner／nonce／主機與中斷原因；單看 PID 消失不足以刪鎖 |
| 殘留 data locks | 依 [鎖清理程序](SERVER-DATA-TRANSFER.md#殘留鎖的人工檢查)，經核實及授權才人工處理精確路徑；不用萬用字元或自動搶鎖 |
| `PARTIAL_RESTORE`／`RESTORE_IN_PROGRESS` | 不啟動新代、不刪 marker 假裝成功；保留 publication lock／marker／現場，繼續安全舊代或維持停機，另選新 destination 重做 |
| `BUNDLE_CHANGED`／認證或 hash 失敗 | 重新確認來源、完整傳輸、key 與 verify／預演；不移除 ID 比對或跳過驗證 |
| schema／素材／外鍵／引用／容量失敗 | 使用相容程式與完整冷備份，修正原因再從驗包開始；不存在強制匯入開關 |
| 公開健康檢查或資料核對失敗 | 不開放流量、不啟用外部副作用；依是否已接受新寫入決定退回或前向修復 |

**程式 revert 與資料 restore 不同：**純文件切片可用 revert PR 撤回，重跑受影響檢查，無需資料 restore。程式行為重構若無不相容資料變動，可評估退回受測舊 code；若 schema、metadata validator 或 assets 不相容，不能只換舊 binary。工具沒有 downgrade；需相容舊 code＋相容資料代成套回退並先預演。

新代未接受任何新寫入時，授權後可停新服務切回相容舊 code＋舊代；已接受登入或其他寫入後，直接回舊 snapshot 會丟新資料，先冷備份新代並安排受控前向修復／資料差異處理。遠端 GitHub 已發生的寫入不能由本機 DB restore 撤回；查核 `needs_review` 與 remote identity 後才決定是否重試／重啟外部功能。

## 8. 恢復成功的最低證據

- 目前啟動 SHA／版本／schema、四個資料路徑、單一 writer 與實際環境已核對；無 publication fence，正常 locks 屬於該服務
- `/login` 與 `/api/version`、受影響資源內容／MIME／cache、內部入口及授權的公開入口分開驗；200 不是 DB 完整性或多人遊戲驗收
- 授權帳戶重新登入、admin／member／停用帳號及私人素材權限；不把 revoked session 誤報成帳號消失
- SQLite integrity／foreign keys、帳戶／成就／BLOB、音樂／歷史與預期差異核對；完整檢查與抽樣 smoke 分開記
- 新房建立／受影響遊戲流程按範圍驗，清理僅本次合成或已授權測試資料；沒有活動房間續局保證
- 外部副作用仍停用直到另行確認；備份、key、receipt、舊代保留政策已決定，公開記錄只放去敏摘要

未達以上證據就標待驗／受阻；不得把這份手冊、合成測試或舊部署紀錄稱為已完成正式 recovery 演練。

## 9. #70–79 整合後的界線核對

本批本地候選整合後，資料 CLI／verify／restore／locks／schema 與基線保持相同；不因 RoomRuntime 拆分而提供 hot backup、跨程序 pending 恢復或自動殘留鎖回收。app shutdown 現由 RoomRuntime 管理 registries／scheduler／SSE，close 的所有呼叫者等待相同清理結果；HTTP 與背景作業結束後才釋放資料鎖。操作方仍須確認所有 writer 與重啟策略確實停止，不把 API close 的改善當正式停寫證據。對照 [runtime ownership](refactors/ROOM-RUNTIME.md)、[契約矩陣](GAME-DATA-CONTRACTS.md) 與 [整合驗證](refactors/BATCH-70-79-INTEGRATION.md)。沒有執行部署、正式資料、主分支保護或權限設定操作。
