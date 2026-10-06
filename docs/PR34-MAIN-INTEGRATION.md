# PR #34 最新 main 整合驗證

日期：2026-10-06。原 head `585eb631e34f2867305e4ad38eef797b5000d0a1`，整合 main `b843a3f59c9ac520818e4d9c55f09cb51d421c29`（已合併 #30／#31）。本輪使用獨立 clone，未修改原開發工作樹、備份工具或其他整合工作；未帶入 PR #36，未合併、核准或部署。

## 衝突解法

- `docs/agents/README.md`、`PROGRAMMER.md`、`SERVER-DATA.md` 只有檔首新增段落重疊；保留 main 的 PR #31 殘留鎖政策與 #34 禁題／schema 13 紀錄，沒有擇一刪除。
- `AGENTS.md`、`src/data/locks.js`、`src/history/store.js`、`src/data/transfer.js` 及兩份新增鎖測試與 main 完全一致。資料、發布與 legacy 鎖拒絕任何既有檔案，不自動 reclaim；HistoryStore 關閉仍冪等。
- 本輪未修改 #34 程式或測試邏輯。回看／收藏、固定選民嚴格過半禁題、schema 13 備份還原與共用 MotionPolicy 保留。未改已撤回的 gift replay 意見。

## 本次實際驗證

| 環境／範圍 | 證據與結果 |
| --- | --- |
| Windows Node 26.2.0 | 整合工作樹 `npm test` **442/442**，失敗／取消／跳過皆 0，約 42 秒。原 #34 的 431 項加 main 的 11 項鎖回歸。 |
| 冷備份／schema | 全套包含完整 export→verify→restore→啟動、原帳戶與資產、內建／共編禁題稽核保存、v12 只在還原副本建立空禁題表、v13 缺表拒絕，以及 schema 1／3／5／7 舊 BLOB 表相容。 |
| 鎖回歸 | 全套包含資料／發布／legacy／HistoryStore 雙程序殘留鎖拒絕、held lock 排他與 release、部分取得失敗釋放、重複 close 不刪後續鎖及 publication symlink 拒絕。 |
| 後端與前端 VM | 全套包含收藏權限／去重／明確重新收藏、八輪淘汰、不可變快照、獨立收藏 encoder、固定選民／嚴格過半、跨房失效候選、DB 寫入失敗重試、同版本禁題／逆序 ACK、SSE／BFCache 及共用減動／彈幕生命週期。`*-browser.test.js` 為 Node VM harness，不能當成真正瀏覽器證據。 |
| 額外隔離 HTTP smoke | 四名合成帳戶開局，第五名揭曉後加入投舊輪回 403 `DRAW_BAN_NOT_ELIGIBLE`；2/4 需 3 票，第三票後 banned=true、門檻仍 3/4。走完四輪至 finished，第一輪快照在換輪與完局後逐欄相同；收藏重送回同一作品、作品數 1，其他帳戶讀取私人圖檔回 404。外部副作用關閉；收藏 PNG 使用現有測試素材，只驗上傳／權限契約，沒有驗證瀏覽器繪圖像素。 |
| Linux | 本次未跑。此 Windows 執行環境沒有已安裝的 WSL Linux 發行版；未安裝額外系統環境。前版 Node 22.22.1 的 431 項證據保留於原功能文件，不算本次整合的 Linux 驗證。 |
| 真正瀏覽器 UI | 本次未跑。CUA inventory 無可用 browser，隱藏內建瀏覽器建立失敗 `Browser is not available: iab`。原版 Chrome 證據是歷史資料；整合版桌機／手機版面、canvas 像素、多設備／弱網／GPU 仍待驗證。 |

本地 `work/pr34-integration-windows.log`、`work/pr34-http-smoke.log` 與 `work/pr34-ui-evidence.json` 保存本輪證據，沒有提交合成帳密、cookie、DB 或密鑰。早期手動分段 smoke 曾超過揭曉的 8 秒自動換輪窗口，快速連續猜題也觸發既有 700ms 限速；最終 runner 維持合成席位輪詢並遵守限速後全流程通過。這些是驗收腳本時序調整，沒有因此改產品行為。

PR 維持 Draft，base 已改 main。推送沿用原分支且非 force；父任務再獨立核對提交與全 diff、測試證據及剩餘 UI／Linux 缺口後，決定 Ready／Approve。未提供部署或正式資料移轉授權。
