# Server 資料移轉實作與驗收

更新：2026-10-05。使用者選擇「完整移轉／備份還原」，並要求帳戶資料也搬移。程式來源 `c831e87`，分支 `feat/server-data-transfer`。本批只建立工具及隔離驗收，未 push、MR、部署或操作正式 DB。操作文件：[SERVER-DATA-TRANSFER](SERVER-DATA-TRANSFER.md)。

| 原規格項目 | 完成內容 | 證據／限制 |
| --- | --- | --- |
| AI 可操作程式 | `tools/server-data.cjs` 提供 keygen／inspect／export／verify／restore，JSON request／stdout、退出碼與去敏錯誤 | CLI stdin／file／錯誤測試；npm script data:transfer。 |
| 完整帳戶 | users 全欄位相等，包括 UUID、原密碼 hash、role、disabled、appearance；原密碼重新登入 | 全量帳戶 digest、DB 深比較、admin／member HTTP 登入及停用帳號拒登。 |
| 持久資料完整包 | SQLite、BLOB、音檔、community.json、歷史 JSONL/meta 與 engine hash | digest、表筆數、外鍵與引用；私人 artwork 權限、music HEAD／Range、歷史 HTTP 回看。 |
| SQLite 一致快照 | feature-detect sqlite.backup，或 VACUUM INTO；schema 前置檢查，舊 schema 只遷移副本 | committed WAL 在兩條 snapshot 分支保存；v10→v12、副本遷移而來源維持 v10。 |
| 停寫及鎖 | app／admin CLI 共用 DB／history／community／music 鎖；export 加取得 legacy history PID 鎖 | running app／第二 app／admin CLI 拒絕；仍要求操作方停全部外部 writer，無跨主機 fence。 |
| 加密與驗包 | 每檔 AES-256-GCM，manifest HMAC，SHA-256／大小；白名單與檔數／容量限制 | 錯 key、改 manifest／cipher、missing／extra、symlink、traversal、case collision 均拒絕。 |
| 新資料代及 dry run | 預設 dry run；apply:true 只建立不存在的 destination；publication lock＋marker＋receipt | 既有資料不動；發布缺口啟動被擋。搬檔 ENOSPC 留 marker；連 marker 都無法建立時仍保留 publication lock 阻止啟動。容量不足清 staging，未真的填滿磁碟。 |
| 恢復安全政策 | target 刪 sessions／invites／resets；pending／sending 改 needs_review；returned config 禁外部投稿 | 舊 cookie／邀請／reset 失效；已配置 remote client 也無 recover／retry／new submission 出站。 |
| 進行中歷史 | 預設拒絕；明確 acknowledge 才在 target 追加 interruption 及最後已落盤 state | 來源 playing 不變，不偽造輸贏；未配對 intent 與截斷 JSONL 仍拒絕。 |
| 共編舊留言 | 在 restored DB 依 BoardStore 既有規則匯入 legacy issues／comments | 原 DB 筆數不變；returned restoredSummary 反映匯入，啟動不再造成未列出的首次 import。 |

## 最後自動驗證

| 環境 | Runtime | 結果 |
| --- | --- | --- |
| Windows | Node 24.14.0、SQLite 3.51.2 | `npm test`：255／255，0 fail／skip；其中移轉 16 項。 |
| Linux 隔離目錄 | Node 22.22.1、SQLite 3.46.1 | 同版 source `npm test`：255／255，0 fail／skip；未改 afterhours 正式服務。 |

原始 log 存在 Git 忽略的 `work/data-transfer-final-windows-tests.log` 與 `work/data-transfer-final-linux-tests.log`。初版為1e0809f；c831e87 補發布失敗時持續保留 publication fence，含 marker 寫入本身 ENOSPC 分支。Linux 初跑隔離 archive 遺漏根 admin.js，使最後一項缺檔失敗；補足打包後重跑全套通過，沒有以忽略失敗代替驗證。工具在最低 22.13 的 fallback 由 forceVacuum 分支驗證，未在 22.13 runtime 上執行；支援目前兩個 runtime 的跨版本資料搬移。

## 跨 OS／SQLite 雙向恢復

只使用合成帳戶、作品及音樂，沒有讀取正式資料。雙向 smoke 都實際建立 restored app、原密碼登入、驗 UUID、私人 artwork bytes、音樂 `Range: bytes=2-5`（206）。

| 方向 | bundleId | 結果 |
| --- | --- | --- |
| Windows SQLite 3.51.2 → Linux 3.46.1 | `9617c888-4586-4f03-a4f5-2fb7bb3b05b4` | 加密 export／restore、帳戶 digest、HTTP 登入、私人圖庫與音樂 Range 通過。 |
| Linux SQLite 3.46.1 → Windows 3.51.2 | `b63c2dad-a3d1-47ce-98bb-972673f90b20` | 同上；跨 SQLite runtime 不把 sqlite_version 當持久資料 digest 差異。 |

私有 smoke／fixture／key 留在 `work/`；不可將 key 或合成帳密寫入公開記憶。這是 Windows／Linux 兩個環境的互換，沒有第三台獨立主機驗收，也未驗 TB 大包或真實物理掉電。

## 後續邊界

尚未執行真實 server 資料搬移、路由切換、停止正式 writer 或啟用新正式資料代。工具不代做 SSH、systemd、active symlink、Tunnel、GitHub 人工 reconcile、帳戶 merge、雙端資料合併、PostgreSQL／object store、房間續局、匿名化 prod→dev；上述原規格保持提案狀態。日後若執行正式切換，須先取得具體來源／目標與停寫窗口，再在新代驗收及保留相容舊代，不能把本批 fixture 成功宣稱已完成正式遷移。
