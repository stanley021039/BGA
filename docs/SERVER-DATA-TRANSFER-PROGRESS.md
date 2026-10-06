# Server 資料移轉實作與驗收

更新：2026-10-05。使用者選擇「完整移轉／備份還原」，要求帳戶也搬移，以及獨立操作文件和方便管理員的 UI。本文保留歷史驗收；最新鎖修正 `0682e43` 以本節為準，管理者匯入流程的既有證據仍在末節。未部署或操作正式 DB。獨立操作文件：[SERVER-DATA-TRANSFER](SERVER-DATA-TRANSFER.md)。

## PR #31：殘留鎖競態修正

2026-10-05，使用者要求修復 [PR #31 的鎖回覆](https://github.com/stanley021039/BGA/pull/31#issuecomment-5993394421)。基線 `3233ed4`，程式修正 `0682e43`，修復工作目錄為獨立 `fix/pr31-stale-lock`；PR base 仍為 #30 的 `feature/game-stage-local`。

- 已實際重現：兩個受控 OS 程序使用 `tests/helpers/data-lock-worker.cjs`，將 B 暫停在舊程式內容比對後的 unlink 前；A 回收舊鎖並取得新鎖，再允許 B 繼續。基線上資料鎖、發布鎖、legacy 歷史鎖及 HistoryStore 均回報 A、B 同時取得鎖。資料鎖情境共用 DB，history／community／music 各自不同，後續目錄鎖未攔住問題。
- 修正：`src/data/locks.js` 移除 dead-PID 自動回收及重試；任何既有鎖均以 `DATA_IN_USE` 拒絕，保留原檔。HistoryStore 共用 legacy 排他建立。release 冪等，重複 close 不再刪同程序後來取得的新鎖；保留純 PID 相容格式。
- 回歸：新增11項，包含上述4項雙程序殘留鎖測試、3項跨程序 live-lock 排他及正常釋放後再取得、取得中途失敗回收本次已持有鎖、同程序重複 close、symlink／junction 不改目標及錯誤去敏／人工清理提示。基線回歸失敗，修後全部通過。
- 完整驗證：Windows Node **24.14.0** 的 `npm test` **374/374** 通過，fail／cancelled／skipped 均0（約16.5秒）；包含既有備份還原、發布中斷、admin 互斥、app 重新啟動與 UI HTTP／VM 測試。`git diff --check` 通過。原始測試 log 只在 ignored `work/pr31-lock-windows-tests.log`。
- 操作改變：異常終止後可能需要停全部 writer／自動重啟、保存鎖內容再人工清理，詳 [流程](SERVER-DATA-TRANSFER.md#殘留鎖的人工檢查)。發布鎖與 restore marker 保留現場、另選新代重試；不能直接刪掉啟動。不能混跑仍自動回收 stale lock 的舊 writer。

本次未重跑 Linux；前批 Linux363項是基線證據，不能寫成此修正的Linux374項。真實 Chrome「選備份資料夾→上傳」及整合後多人完整遊戲仍待驗收。本批未合併 #30／#31、調整 base、修改 AGENTS 規則、部署或操作正式資料，也未代使用者回覆 PR 評論。

## 既有功能與歷史驗收

| 原規格項目 | 完成內容 | 證據／限制 |
| --- | --- | --- |
| AI 可操作程式 | `tools/server-data.cjs` 提供 keygen／inspect／export／verify／restore，JSON request／stdout、退出碼與去敏錯誤 | CLI stdin／file／錯誤測試；npm script data:transfer。 |
| 完整帳戶 | users 全欄位相等，包括 UUID、原密碼 hash、role、disabled、appearance；原密碼重新登入 | 全量帳戶 digest、DB 深比較、admin／member HTTP 登入及停用帳號拒登。 |
| 持久資料完整包 | SQLite、BLOB、音檔、community.json、歷史 JSONL/meta 與 engine hash | digest、表筆數、外鍵與引用；私人 artwork 權限、music HEAD／Range、歷史 HTTP 回看。 |
| SQLite 一致快照 | feature-detect sqlite.backup，或 VACUUM INTO；schema 前置檢查，舊 schema 只遷移副本 | committed WAL 在兩條 snapshot 分支保存；v1／3／5／7／10→v12，來源版本、帳戶及既有圖片保持不變。 |
| 停寫及鎖 | app／admin CLI 共用 DB／history／community／music 鎖；export 加取得 legacy history PID 鎖 | running app／第二 app／admin CLI 拒絕；仍要求操作方停全部外部 writer，無跨主機 fence。 |
| 加密與驗包 | 每檔 AES-256-GCM，manifest HMAC，SHA-256／大小；白名單與檔數／容量限制 | 錯 key、改 manifest／cipher、missing／extra、symlink、traversal、case collision 均拒絕。 |
| 新資料代及 dry run | 預設 dry run；apply:true 只建立不存在的 destination；publication lock＋marker＋receipt | 既有資料不動；發布缺口啟動被擋。搬檔 ENOSPC 留 marker；連 marker 都無法建立時仍保留 publication lock 阻止啟動。容量不足清 staging，未真的填滿磁碟。 |
| 恢復安全政策 | target 刪 sessions／invites／resets；pending／sending 改 needs_review；returned config 禁外部投稿 | 舊 cookie／邀請／reset 失效；已配置 remote client 也無 recover／retry／new submission 出站。 |
| 進行中歷史 | 預設拒絕；明確 acknowledge 才在 target 追加 interruption 及最後已落盤 state | 來源 playing 不變，不偽造輸贏；未配對 intent 與截斷 JSONL 仍拒絕。 |
| 共編舊留言 | 在 restored DB 依 BoardStore 既有規則匯入 legacy issues／comments | 原 DB 筆數不變；returned restoredSummary 反映匯入，啟動不再造成未列出的首次 import。 |
| 管理員表單 | `npm run data:transfer:ui`，獨立 localhost 介面，keygen／inspect／export／verify／預演及 apply；JSON 預覽與結果統計／複製 | 不依賴運作中的遊戲服務，仍需操作方停 source／target writer。修改路徑清除停寫確認；預設預演。 |
| 管理 UI 防護 | 固定 bind127.0.0.1，驗 Host／Origin／隨機 token、JSON／容量上限、一次一工作，刷新查狀態不重送 | HTTP 驗惡意 Host／Origin／錯 token／非JSON／超額／併發、刷新保存結果及錯誤去敏。不是隔離其他本機 OS 使用者的權限系統。 |

## 最後自動驗證

| 環境 | Runtime | 結果 |
| --- | --- | --- |
| Windows | Node 24.14.0、SQLite 3.51.2 | `npm test`：259／259，0 fail／skip；移轉16項＋UI HTTP4項。 |
| Linux 隔離目錄 | Node 22.22.1、SQLite 3.46.1 | 同版 source `npm test`：259／259，0 fail／skip；未改 afterhours 正式服務。 |

原始 log 存在 Git 忽略的 `work/data-transfer-final-windows-tests.log` 與 `work/data-transfer-final-linux-tests.log`。初版為1e0809f；c831e87 補發布失敗時持續保留 publication fence，含 marker 寫入本身 ENOSPC 分支。Linux 初跑隔離 archive 遺漏根 admin.js，使最後一項缺檔失敗；補足打包後重跑全套通過，沒有以忽略失敗代替驗證。工具在最低 22.13 的 fallback 由 forceVacuum 分支驗證，未在 22.13 runtime 上執行；支援目前兩個 runtime 的跨版本資料搬移。

核心255項證據保留以上 logs；含 UI 的259項 logs 為 `work/data-transfer-ui-windows-tests.log`、`work/data-transfer-ui-linux-tests.log`。UI HTTP 實際 keygen→active source拒絕→inspect→export→verify→default dryrun→明確 apply→新服務原密碼登入成功；相同 destination 重試仍拒絕覆寫。結果收合版只改前端呈現，另重跑UI HTTP4項與JS syntax通過，未無理由重跑整套。

## 原 Chrome 背景管理 UI 驗收

主 agent 在原 Chrome 背景完成 keygen→inspect→export→verify→restore dryrun→apply→reload；合成来源帳戶1筆，bundleId `dc33ba2e-3ef3-4e4b-9f27-6766c32d3398`，不含正式資料。重新整理顯示最近結果，沒有重送還原。截圖 `work/data-transfer-admin-ui.png` 由主 agent 保存。

初版完成後完整JSON造成側欄過長；改為操作／結果JSON預設details收合、複製常駐，統計、回傳config與下一步常駐。新收合版1767×1196實測body1324，管理工具仍可少量捲動；成功狀態及重要設定可讀。COMMUNITY_DIR字尾折行再以140px label欄與nowrap修正。未驗手機版與所有瀏覽器，不宣稱每種視窗完全無捲動。

## 跨 OS／SQLite 雙向恢復

只使用合成帳戶、作品及音樂，沒有讀取正式資料。雙向 smoke 都實際建立 restored app、原密碼登入、驗 UUID、私人 artwork bytes、音樂 `Range: bytes=2-5`（206）。

| 方向 | bundleId | 結果 |
| --- | --- | --- |
| Windows SQLite 3.51.2 → Linux 3.46.1 | `9617c888-4586-4f03-a4f5-2fb7bb3b05b4` | 加密 export／restore、帳戶 digest、HTTP 登入、私人圖庫與音樂 Range 通過。 |
| Linux SQLite 3.46.1 → Windows 3.51.2 | `b63c2dad-a3d1-47ce-98bb-972673f90b20` | 同上；跨 SQLite runtime 不把 sqlite_version 當持久資料 digest 差異。 |

私有 smoke／fixture／key 留在 `work/`；不可將 key 或合成帳密寫入公開記憶。這是 Windows／Linux 兩個環境的互換，沒有第三台獨立主機驗收，也未驗 TB 大包或真實物理掉電。

## 後續邊界

最終 PR／管理 UI 整合：PR #30 資源修正 `1b8c85d` 已推送至既有 PR；移轉分支 backport `db9d0b6` 保留新的多類別、共用聲音、設定動作及移轉鎖。合併衝突逐項保留契約，沒有整檔覆蓋較新的功能。

獨立 review 找到 UI 舊狀態回應可能在新 POST 等待期間解鎖表單；`215f82c` 加本地提交旗標與查詢 epoch，POST 完整回應前不解鎖，過期 idle／busy／error／result 不覆蓋新工作。未知狀態維持鎖住並只重試 GET，不自動重送移轉。新增11項 VM 回歸与原4項 HTTP 共15/15；競態使用可控制的回應次序驗證，普通 Chrome 流程不當作競態重現證據。

| 最終環境 | Runtime | 完整整合結果 |
| --- | --- | --- |
| Windows | Node 24.14.0 | **304/304 通過**，0 fail／skip／cancel；約9秒。 |
| Linux 獨立臨時目錄 | Node 22.22.1 | **304/304 通過**，0 fail／skip／cancel；約67秒。 |

Linux包456檔，SHA256 `7eb9cdadde6cdbb7a1b66e1b0cfd13dc2ccf3bf450186195201bdd7a692aca92`；完成後逐檔 manifest 與 `215f82c` 工作樹一致。測試目錄已驗絕對路徑及擁有者後清除，未碰正式服務。原始log為 `work/data-transfer-combined-windows-tests.log` 與 `work/data-transfer-combined-linux-tests.log`。

最終 Chrome 刷新恢復成功結果、JSON 收合、完整設定與下一步可見，無 console error；截圖 `work/data-transfer-admin-ui.png`。本機3122、3187測試服務與測試分頁已關閉。正式站未部署此批程式，未發新的移轉 MR，未搬正式資料。

尚未執行真實 server 資料搬移、路由切換、停止正式 writer 或啟用新正式資料代。工具不代做 SSH、systemd、active symlink、Tunnel、GitHub 人工 reconcile、帳戶 merge、雙端資料合併、PostgreSQL／object store、房間續局、匿名化 prod→dev；上述原規格保持提案狀態。日後若執行正式切換，須先取得具體來源／目標與停寫窗口，再在新代驗收及保留相容舊代，不能把本批 fixture 成功宣稱已完成正式遷移。

2026-10-05 後續整合 `e71989e`：加入 PR #30 的失敗開局歷史淘汰、I/O fault 容量記帳與分批畫布恢復，移轉 CLI／UI 契約未修改。Windows Node24.14.0 完整 **323/323** 通過；對應 PR source `3b19720` 在 Windows／Linux 各279/279。本次未重跑整合分支的Linux全套，舊304項仍只代表215f82c當時版本。原始記錄 `work/pr30-followup-combined-windows-tests.log`，詳 [PR 後續複查](PR30-RESOURCE-LIMITS.md#後續複查失敗開局與重連恢復)。

## 送審前最終複查

已發出 [PR #31：完整資料備份還原與管理 UI、畫猜及共用操作改善](https://github.com/stanley021039/BGA/pull/31)，狀態 open、非 draft，接續 [PR #30](https://github.com/stanley021039/BGA/pull/30)。base 為 `feature/game-stage-local`；先合併 #30，再將 #31 改以 `main` 為 base。本次只送審，未合併、部署或搬移正式資料；此筆取代前述各批「未發新的移轉 MR」狀態。

2026-10-05 使用者要求確認 PR 問題全部修正後發出 PR。獨立 agent 確認 PR #30 四項回覆，固定 head `7f44f20` 的相關八檔測試 **65/65 通過**，詳 [PR 複查](PR30-RESOURCE-LIMITS.md#發出接續-pr-前的獨立複查)。整合提交 `cc02b56` 接上 PR #30，tree 與 `22d02c3` 相同；畫猜多類別、共用音效、彈幕、房間設定、猜題者畫布與移轉工具皆保留。

移轉獨立審查另找到 schema 1–7 升級新增空 BLOB 表會誤判 digest 不同。修正 `6e655de` 逐表核對來源既有 BLOB，只允許 migration 3／5／8 新增空表，帳戶 digest 仍完全比對。四個 schema 1／3／5／7 回歸在修正前均重現失敗，修正後完整加密匯出、預演、還原、原密碼登入及來源不變皆通過。帳戶改動、既有 BLOB 改動、非空新表及未知新 BLOB 表仍拒絕發布；相關移轉／UI／設定／出站測試 **39/39 通過**。

| 本次完整驗收 | 程式來源 | 結果 |
| --- | --- | --- |
| Windows Node 24.14.0 | `6e655de` | **335/335 通過**，0 fail／skip／cancel，約 10 秒。 |
| Linux Node 22.22.1 獨立臨時目錄 | 同一份 460 檔 source-only 包 | **335/335 通過**，0 fail／skip／cancel，約 80 秒。 |

Linux 包 SHA-256 `31ac2c5ea9d6d185858aa2070d9371a7cbe9b86b620ee069c27dbae11efdfe55`，上傳前、Linux 測試前後及本機測試後的逐檔 manifest 一致。下載 log 後，驗證臨時目錄絕對路徑及擁有者標記再清理；未碰正式服務。原始 log、manifest 及打包程式只在 ignored `work/pr-publish-*`。`git diff --check`、敏感檔案／新增內容檢查通過；沒有提交帳密、raw HAR、私有 DB 或交接檔。

上述取代舊 304／323／330 項作為此整合版本的最新完整測試數字。既有背景 Chrome 驗收仍按各功能文件記載的版本與範圍解讀，本次未重新進行多人完整遊戲。YouTube、成就擴充與動畫研究仍依 spec 狀態處理，不能當作已實作或部署。

## 管理者匯入流程與背景 Chrome 驗收

2026-10-05，使用者澄清要「把別的站點資料匯入目前站點」，並要求提供管理者 UI、自行測試。程式 `47d79c7` 將首頁改為選取加密備份資料夾及金鑰 → 驗證 → 預演 → 建立全新目錄；保留本機路徑與來源站備份操作。帳戶、作品、題庫、音樂、歷史五類統計常駐，目的地屬於管理工具主機的路徑，與瀏覽器的選檔位置清楚區分。

上傳採同源 token 與全域 busy，manifest 白名單、精確 byte 數及有界串流；完成後由真正 verify 驗包。刷新可看見已驗證／未完成批次，使用或清理，不會重送還原。正常結束等待目前工作再刪 owned upload 與金鑰；強殺留下暫存的界線見操作文件。UI 仍是獨立 localhost 工具，不是正式站公開 `/admin` 功能。

獨立 agent 找到並重現兩個問題，已修正：

| 問題 | 修正與證據 |
| --- | --- |
| A 包預演後，同路徑被換成同 key 的 B 包，仍能套用 B | UI 帶 verify 的 `expectedBundleId`；core 完整驗包後、policy／publish 前比對。A／B 合成包回歸確認 dryrun 與 apply 均回 BUNDLE_CHANGED，未建立目標或殘留 staging。 |
| DELETE 已完成但回應遺失，殘留 upload ID 讓後續上傳永久重試 404 | 以 idle server 清單校正 pending ID；DELETE 404 視為已清理。可直接重新選檔開始新批次，VM 重排回應驗證。 |

### 自動測試

| 環境 | 程式 | 結果 |
| --- | --- | --- |
| Windows Node 24.14.0 | `47d79c7` 程式內容 | **363/363 通過**，0 fail／skip／cancel，約 11 秒。 |
| Linux Node 22.22.1，獨立 `/tmp` | 同一份 462 檔 source-only 包 | **363/363 通過**，0 fail／skip／cancel，約 84 秒。 |

上傳 HTTP 新增 10 項、core 身分 2 項、前端 VM 由 11 增至 27 項；本節取代 335 作為最新完整總數。涵蓋真 GCM 與錯 key／竄改、缺檔／額外檔／路徑／大小／總配額、並行 PUT／DELETE／run、Host／Origin／token、正常關閉等待／清理、刷新及回應次序。另有真實 socket 傳半檔後斷線，busy 解除、failed 可見並可清理。獨立複查的相關 43 項全過，無未解阻擋 finding。

Linux 包 SHA-256 `8d64ca6aaddffea0a64fb0d58f2ae47c430aa09668dd73da99ba60521f38dbab`；測試前後與本機逐檔 manifest 一致，只有文件在程式凍結後更新。下載測試 log 後，檢查固定絕對路徑、owner marker 及非 symlink 再清理該隔離目錄。未操作正式服務。

### 背景 Chrome 與隔離資料驗收

全程使用原 Chrome 背景分頁，未提高視窗。合成來源有管理員、會員、停用帳號共 3 個帳戶；1 張私人作品、1 自訂角色／表情、1 禮物、畫猜／共編各 1 題、1 首音樂、1 份已完成歷史。另一個測試站持有自己的帳戶與作品，作為既有資料保留對照。

- 透過本機路徑表單驗證錯 key 拒絕、正確 key 統計、既有目的地拒絕、dryrun 不建立目的地，以及變更目的地後撤銷 apply 資格。
- 上傳真實加密包由 HTTP fixture 準備，再由 Chrome 重新整理找回批次，按「使用此備份」→ 預演 → 勾確認 → 建立新目錄。確認 JSON 帶 expectedBundleId；成功後重新整理只顯示結果。UI 清理上傳暫存後，新資料與來源備份仍存在。
- 使用測試 helper 依 receipt 明確啟動隔離新站，Chrome 以來源站原帳密登入並在收藏庫看到「我的・私人」作品。啟動由 helper 完成，不能宣稱管理 UI 會自動啟動或切換正式服務。
- 另外 12 項 HTTP／資料檢核全過：來源與原測試站帳戶／BLOB digest 不變；新站 UUID、密碼 hash、role、disabled、appearance 保留；停用帳號拒登、私人作品無法被另一帳號讀取；圖片 hash、音樂原檔與 Range 206、題庫、歷史與外部投稿 false 正確。
- 1280×720 桌機、390×844 手機無水平溢出；內容仍需垂直捲動，未宣稱一屏顯示全部。測後已 reset viewport。

**選檔驗收限制：**Chrome 金鑰單檔選擇成功；自動化工具的資料夾 chooser 在传入目錄或其檔案清單後均未帶入檔案，沒有完成「真實 Chrome 資料夾選檔→上傳」端到端驗收。前端 WebKit 相對路徑、manifest 先傳及缺／額外檔由 VM 驗證，實際串流及加密驗包由 HTTP 驗證；不能把後者當成瀏覽器選檔成功。沒有為繞過工具限制修改瀏覽器權限或提高視窗。讀到一筆重新整理時的 extension message-channel 訊息，未帶 app stack，不當成應用程式崩潰證據。

證據只在 ignored `work/migration-ui-*`：成功 UI、收藏庫、桌機／手機截圖，fixture、12 項報告、Windows／Linux logs 與 source manifest。合成帳密、金鑰及實際私有路徑不放公開文件。測試用 3188／3189／3190 服務與暫存上傳已關閉／清理；另開一般 localhost 管理 UI 供使用者操作，實際 port／process 只記私有交接。

本批更新既有 PR #31，不另開重複 PR。未合併、部署、停止正式 writer、切换路由或匯入正式資料。來源站備份尚未提供；此版仍為完整還原、不合併兩站資料。若正式使用，需取得完整來源包及分開保存的 key，依獨立指南做隔離驗收及部署切換。
