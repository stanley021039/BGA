# PR #30 回覆修正與驗收

日期：2026-10-05。對應 [PR #30](https://github.com/stanley021039/BGA/pull/30) 與 [使用者回覆](https://github.com/stanley021039/BGA/pull/30#issuecomment-5987678845)。評論提出資源耗盡風險；沒有對正式站進行攻擊測試。本文件記錄隔離環境的修正與證據。

| 問題 | 修正行為 | 驗證 |
| --- | --- | --- |
| 重複入座、離席累積玩家紀錄 | 等待房間刪除離席紀錄；進行中保留計分引用但限制 64 筆，同帳戶自行離席後復用原座位；被踢玩家維持禁止重入。 | 三款遊戲各 1,000 次循環，名單、快照及 session 檔案保持有界；正常重連與房主移交回歸。 |
| 操作造成歷史檔無限增加 | 帳戶及 IP 分別限制加入、離席頻率；session 輪替、完整對局容量及全目錄配額；淘汰已完成／中斷的舊紀錄，保留正在進行的對局。 | 輪替後基線、intent/result 配對、容量預檢與 archive 淘汰回歸。 |
| 填色每次重算全部歷史 | 確認過的畫布前綴持續保留，新 SSE 只繪製新筆畫；復原使用成本分布的有限快取。 | 真像素比較與筆畫／填色工作次數回歸；Chrome 填色、復原及重連兩席畫布一致。 |
| 填色成本與一個畫筆點相同 | 填色每秒最多 2 次、每輪最多 48 次；undo/clear 不退回配額；客戶端最多一筆待確認填色，顯示拒絕原因並回復權威畫面。 | 畫筆可繼續、超額拒絕、重送不重計、復原後額度及 SSE／HTTP 次序回歸。 |
| 磁碟失敗或容量耗盡 | 寫入失敗暫停後續遊戲操作並顯示共用警示；故障期間仍可離席，最後真人離開清除房間；清理錯誤不讓整個服務中止。 | I/O 失敗、quota 及離席清理回歸。 |

## 預設上限與操作

加入及離席各自計算：每帳戶每分鐘 30 次、每 IP 每分鐘 120 次；已入座的重連不耗新座位額度。開房每分鐘 20 次；會記錄歷史的遊戲操作每帳戶每分鐘 120 次。畫布另外使用自身速率及每輪成本額度。

歷史預設 session 2 MiB、每局 64 MiB、目錄 512 MiB、1,000 份 archive、2,200 個檔案及 30 天保留期。intent 寫入前預留結果與 metadata 空間；trace 超過 256 KiB 時明確標示截斷，結果仍完整記錄。正常結果單列上限 512 KiB、header 等單列上限 3 MiB。設定方式見 `.env.example` 的 `HISTORY_*`。調低配額會減少可保留的歷史，不能把正在進行的紀錄截斷湊空間。

Live 畫布仍為 512 × 256；最多 16 個 RGBA checkpoint，圖片快取上限 8 MiB。共用 studio 的原有 `redraw`／填色契約保持可用。沒有新增 Worker；是否需要 Worker 應根據剩餘單次填色成本與實機量測決定。

## Gartic Phone 參考範圍

初次在使用者原 Chrome 的背景分頁，以單一匿名席完成 Masterpiece 填色、復原及相簿流程，當時只確認介面行為，未取得 HAR。後續使用者明確要求開啟完整 CDP，已透過設定 UI 啟用，並在隱藏內建瀏覽器完成新的單席錄製；詳下節及 [Gartic 網路參考](research/GARTIC-NETWORK-REFERENCE.md)。沒有加入陌生人的房間。

私有截圖與本機測試帳戶只保存在 Git 忽略的 `work/`。正式帳戶、正式 DB 與正式服務未修改。

## 整合驗收進度

Windows Node 24.14.0、Linux Node 22.22.1 全套各 **260/260 通過**；新增 renderer／同步回歸 19 項、伺服器資源及故障回歸 14 項。Linux 僅使用獨立臨時測試目錄，結束後已清理。語法與 `git diff --check` 通過。

原 Chrome 背景操作兩個登入來源：房主與另一位玩家使用真正 UI；第三席以正常 API 建立。UI 執行填色與 undo，另一席重新整理後仍一致。連續填色壓力由本機 API 準備，兩席接收正常 SSE：第一段 35 筆新增填色每筆僅應用一次，單次渲染最高約 24 ms；完整 48 次上限準備後，API 第 49 次回 429 `DRAW_WORK_LIMIT`，油漆桶 disabled，畫筆仍可由 UI 作畫與同步。Undo 不返還填色配額。最終兩席像素 hash 同為 `29d49dc5`，快取均為 16 張／8 MiB。

**效能限制：**載入 48 次全畫布填色的初次快照仍同步執行一次，實測約 486–524 ms，尚未使用 Worker 或預先合成快照。此修正消除逐次接收的重複全歷史重繪，不能宣稱任何重連都無停頓。背景 Chrome 的 rAF 有約一秒節流間隔，本次不把它當成畫面 FPS 或其他電腦硬體問題的證據。工作次數、快取大小與像素一致性是此輪主要證據。

私有證據：`work/pr30-tests.log`、`pr30-linux-tests.log`、`pr30-live-stress.json`、`pr30-browser-evidence.json` 及 Chrome 截圖。既有 PR 更新此批修正；**尚未部署**，舊版本的部署記錄不能當成本次驗收。

## 後續複查：失敗開局與重連恢復

2026-10-05 使用者要求繼續 HAR 與 PR 修正。重新讀取 PR #30 回覆後，既有玩家紀錄上限仍成立；獨立複查另外重現並修正以下缺口。

| 缺口 | 行為與限制 | 驗證 |
| --- | --- | --- |
| 單人房重複開局失敗，產生不能淘汰的 `playing` archive | 未真正進入遊戲的失敗開局標為 `interrupted`，保留失敗 intent/result，不沿用上一局 winner。 | 五款遊戲各 12 次失敗開局，在 archive 上限 2 下仍有界；補足玩家後可正常開局，其他房間可運作。 |
| 寫入成功但 fsync 失敗、或 metadata rename 失敗，容量帳面少計 | 故障後讀實體大小，包含遺留 `.tmp`；仍暫停操作並回報錯誤，不把未完成 fsync 說成已可靠保存。 | 故障注入後記帳與實體 bytes 相同；不偽造缺少的歷史結果。 |
| 首次重連同步重播 48 次填色，主執行緒約半秒不能回應 | 大量恢復透過 MessageChannel 分批，每批最多 1 次 fill、16 筆 stroke 或約 8 ms 軟預算。新快照、復原與換輪可取消舊工作；背景不依賴 rAF。 | 真像素、取消／替換、active draft、快取及儲存時序回歸；單次 fill 仍不可搶占，不宣稱零停頓。 |

恢復期間暫停新增作畫，猜題與玩家資訊仍可使用；素材庫儲存等最新畫布完成。回復失敗或已換輪會保留錯誤，禁止把部分畫布或下一輪空畫布當原作品上傳。原同步 renderer 與 studio 契約保留。

同一台原 Chrome、512 × 256、48 次交替整張填色，舊／新各依序 3 次：

| 量測 | 舊版 `1b8c85d` | 本次分批恢復 |
| --- | --- | --- |
| 恢復總時間 | 477.3–505.9 ms | 474.1–552.2 ms |
| PerformanceObserver 長任務 | 每次各 1 筆，483／513／486 ms | 3 次均未觀察到大於 50 ms 長任務 |
| 每批最大實際工作時間 | 完整恢復同步執行 | 15.7–18.4 ms；每批 1 fill |
| 填色應用次數／快取 | 48 次／8 MiB | 48 次／8 MiB |
| 最終像素 hash | `29d49dc5` | `29d49dc5` |

首次 MessageChannel 探針等待 0.1–56.8 ms，含瀏覽器排程，不能等同每批 CPU 時間或實際呈現 FPS。改進是將工作拆開讓主執行緒可處理其他工作，總填色成本沒有消失。以上取代前節「完整重連仍全部同步」的現況描述，前節保留作為基線。

真實遊戲本機隔離驗收：兩席由 Chrome UI 登入並重連完整 48 fill，兩席各 48 次 yield、hash 相同。房主用 UI 復原與畫筆作畫後，兩席 hash 同為 `2f93ce38`；填色第 49 次仍回 429，brush 可用。後續回合由受控本機 API 準備完整畫作，結束後 Chrome 重連並以 UI 加入素材庫成功，hash `29d49dc5`。沒有將 API 準備步驟冒稱真人 UI 作畫。

本次程式來源 `3b19720`：Windows Node 24.14.0、Linux Node 22.22.1 完整測試各 **279/279 通過**，無失敗／跳過／取消；新增畫布 11 項及 history 8 項。Linux source-only 包 444 檔，SHA-256 `e0a8e0fd5354ce5db533d27c660e85832a5377f4fb5b351f6c293524feb7e3df`，兩端及測試後 manifest 一致，隔離目錄已清理。語法／diff 檢查通過，Chrome 兩席無 console error。

本次私有證據：`work/pr30-followup-windows-tests.log`、`work/pr30-followup-linux-tests.log`、`work/pr30-cold-recovery-metrics.json`、`work/pr30-recovery-browser-evidence.json`、`work/pr30-recovery-browser.png`、`work/pr30-finished-state.json`。本機 3122／3123 測試服務與測試分頁已關閉。這些 BGA 測試不是 Gartic 封包證據；後續實錄另列於下節。未部署或修改正式資料。

## 後續實錄：Gartic 畫具與完成送圖

2026-10-05 透過官方 tab CDP `Network` 在隱藏內建瀏覽器正常遊玩單席 Masterpiece，記錄畫筆、外框、區域／全畫布填色、復原／重做、Done 及相簿，返回首頁後停止錄製並關閉分頁。User-Agent 回報 Chrome 154.0.0.0、1280 × 720。6,943 事件去重為 6,129；早期載入有 6 批 truncated，穩定作畫觀察窗 273.703 秒、24 批無 truncated。HAR 是離線轉換官方 CDP 事件，並非 Chrome DevTools 匯出按鈕的產物。

本次 brush 送出 57＋100 bytes、區域填色 64 bytes、全畫布填色 61 bytes，內容是含顏色／數值的操作向量；undo 每次 27 bytes，為 scalar 控制訊號。後一筆 brush 含當前筆畫的前綴，不能宣稱每次只送新點。Done 是 13 bytes 的 boolean 完成訊號；相簿收到剩餘繪圖命令，與最後保留的填色一致。這些是邏輯 payload 大小，不含 TLS／壓縮等線上成本。

BGA 已有 POST stroke／SSE stroke 增量傳輸與缺版快照恢復；本次證據支持命令增量方向，不能證明 Gartic 的 CPU、checkpoint、server 配額或資料保留策略。未測另一席接收／重連，亦未另錄 BGA HAR。PR 的資源與 renderer 修正仍以自身回歸測試和 Chrome 工作量量測驗證。

HAR 的 1,035 entries、57 則 WS 訊息通過格式檢查，另外 127 個不完整觀察保存在擴充欄位；匯出器 10/10 合成測試通過，未執行 Chrome Import UI。原始內容與截圖只在 `BGA-draw-guess/work/`，檔案、雜湊及限制見 [完整網路參考](research/GARTIC-NETWORK-REFERENCE.md)。

## 追蹤回覆：新對局第 1 輪的配額隔離

再次核對回覆後確認：第 1 輪用完配額、因玩家離席提前結束、重新加入並再開第 1 輪，原 client 只比較 round，因而保留上一局配額。原 server 也只驗 round，同畫者延遲的舊 POST 可能寫入新局。

修正來源 `e60f853`：每次新畫布由 server 產生 `canvasEpoch`，state、snapshot、ACK、SSE stroke／reset／ready 和修改請求都攜帶它。新 epoch 清零 client 配額、草稿、繪圖工作與發送佇列；clear／undo 保持相同 epoch，不退回額度。舊 ACK／SSE／snapshot／較舊 state 不可恢復舊配額；排隊筆畫在實際發出前再次驗 epoch。舊 command 的回覆或 finally 不會清空新畫布或解除新操作鎖。素材庫儲存同時驗 round＋epoch，避免等待期間重開同輪號而誤存新局畫布。

Server 在去重、配額及畫布修改前拒絕缺少／過期 epoch 的 stroke／command。這是必要的新 client／server 契約，部署時須一起更新，已開啟的舊版畫猜頁面須重新整理；不能為相容 round-only 請求而繞過隔離。

新增 7 項回歸涵蓋 48 fill／1,000 batch／30,000 point 全額耗盡後離席／復座／重開、同 batch ID 跨 epoch、延遲 POST／ACK／SSE／snapshot／state／command finally、先收到新 SSE 後才收到 state，以及儲存等待期間重開第 1 輪。PR Windows Node 24.14.0、Linux Node 22.22.1 完整各 **286/286 通過**，無失敗／跳過／取消。Linux source-only 包含 445 檔，SHA-256 `758b8d3aedaefc1d27ceebc5101bdfea04c8c1e3277ec2968320cc401c4bb2e5`。

1280 × 720 隱藏內建瀏覽器隔離驗收：舊局 48 次填色及另一席離房／加入由正常本機 API 準備；房主實際 UI 登入、返回房間、按「再玩一局」、選題及填色。舊 round 1 的油漆桶 disabled，新 round 1 恢復 enabled 且填色成功，server 配額為 1／1／1。另送舊 epoch 的 stroke 與 clear 均回 400，快照及新局配額保持不變。瀏覽器無 console warning／error；未把合成測試的延遲訊息注入冒稱真人操作。

私有證據：`work/pr30-epoch-windows-tests.log`、`work/pr30-epoch-linux-tests.log`、`work/pr30-epoch-linux-source-manifest.json`、`work/pr30-epoch-browser-evidence.json`、`work/pr30-epoch-stale-result.json`、`work/pr30-epoch-exhausted.png`、`work/pr30-epoch-new-round.png`。本機 3124 已停止、測試分頁已關閉；未部署或修改正式資料。

## 發出接續 PR 前的獨立複查

2026-10-05 再次讀取 PR #30 最新回覆（最後更新 05:09:28 UTC），四項問題皆已有對應修正。獨立 agent 在固定 PR head `7f44f20` 重跑八個相關測試檔，Windows Node 24.14.0 **65/65 通過**，沒有失敗、跳過或取消：

| 回覆項目 | 複查結果與回歸 |
| --- | --- |
| 反覆進出造成玩家及歷史無界 | 等待階段移除、進行中重用身份與 64 筆上限、HTTP 限流、history 配額／輪替／淘汰；`server-resource-limits.test.js`。 |
| 填色重播成本放大 | 增量 renderer、有界 checkpoint、分批恢復、每秒／每輪 fill 限額；stroke-canvas、cooperative、renderer-sync 及 recovery 測試。 |
| 開局失敗留下 playing archive | 未成功開局改為 interrupted 並清 current；低配額、其他房間及寫入故障回歸；`history-failed-start.test.js`。 |
| 新局同為 round 1 沿用舊配額 | canvasEpoch 隔離請求、ACK、SSE、snapshot、queue、command 及儲存；`draw-canvas-epoch.test.js` 與 recovery 測試。 |

整合提交 `cc02b56` 將 PR #30 接入 `feat/server-data-transfer`；其檔案內容與原整合 `22d02c3` 完全相同，沒有覆蓋後續畫猜／音效／移轉修改。此處的 65 項是本次固定 PR head 的針對測試；接續分支的完整 Windows／Linux 驗收另見 [移轉整合進度](SERVER-DATA-TRANSFER-PROGRESS.md)。這是程式與測試複查，不能當作 GitHub reviewer 已批准或正式部署完成。
