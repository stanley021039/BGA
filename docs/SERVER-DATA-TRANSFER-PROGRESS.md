# Server 資料移轉實作與驗收

更新：2026-10-05。使用者選擇「完整移轉／備份還原」，要求帳戶也搬移，以及獨立操作文件和方便管理員的 UI。移轉核心 `c831e87`，本機管理 UI `2618c4b`、結果收合／對齊至 `31c91dd`，分支 `feat/server-data-transfer`。以下保留歷史驗收，最新程式 `6e655de` 與送審狀態以末節「送審前最終複查」為準；未部署或操作正式 DB。獨立操作文件：[SERVER-DATA-TRANSFER](SERVER-DATA-TRANSFER.md)。

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
