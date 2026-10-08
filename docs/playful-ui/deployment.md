# 2026-10-08 shhuang.cc 部署驗證

使用者直接授權「更新到shhuang.cc測試」後，部署版本 **1.17.0**，固定程式提交 **6be11b4506ce88d4621eb4deaff1d0f17e914307**、annotated tag **v1.17.0**。這份紀錄取代 README／test-results 中「未部署／未打 tag」狀態；原先測試紀錄保留作為歷史。

## 測試失敗根因與重新驗收

原先 market-images quota 測試 SQLite I/O 失敗是 VM `/tmp`（tmpfs）可用空間不足，不是本次 UI 改動所致。未修改程式、未跳過測試，改用磁碟暫存目录 `/home/ccc/.cache/afterhours-ui-tests`：

- 該組 23/23 通過。
- `TMPDIR=/home/ccc/.cache/afterhours-ui-tests npm test`：**1,519/1,519 通過，0 failed/skipped/cancelled**，255,746.906ms。
- release:check `--base 8a9cbfd --type minor` 通過。
- 固定封存 release：隔離暫存資料庫、version、8個靜態資源 exact bytes 與登入重新導向通過。

## 切換與資料保留

- 切換前正式瀏覽器確認 0 間房間。
- SQLite 使用 online backup 並做 integrity_check；history/community/music 另備份，置於正式伺服器 private shared/backups 下，沒有封存進 Git。
- 使用 clean commit 的 git archive 封存 `/home/ccc/apps/afterhours/releases/6be11b4`；locked npm ci，沿用原 shared/.env 及絕對 shared data 路徑。
- current symlink 原子切換由 `releases/8a9cbfd` 至 `releases/6be11b4`。
- 對 ccc 自己擁有的舊 node 程序發 SIGTERM，正常 close 並由既有 systemd Restart=always 重啟；沒有改 service、tunnel、系統權限或帳戶設定。origin 健康檢查失敗會切回舊 release，本次無需回退。
- 上線後資料 integrity_check=ok、schema unchanged，4個帳號／角色／作品／成就資料表與備份內容指紋相同；没有重置或匯入正式資料。

## 上線驗證

- 正式 https://shhuang.cc/ 瀏覽器：既有登入狀態保留，新主題顯示，六張遊戲插畫 complete=true、naturalWidth>0。
- 下一款切換雷霆→同頻，counter、selected、CTA、教學連結同步更新。
- 建立同頻 dialog 可開啟／關閉，沿用已登入暱稱；公開驗收沒有真的建立測試桌或投票。
- 正式設定面板顯示 **版本 v1.17.0**。
- origin `/api/version`=1.17.0，8個靜態資源 exact bytes 通過；afterhours.service 與 afterhours-tunnel.service 均 active。
- VM 的直接 HTTPS urllib 請求被 403 拒絕，因此公開網址驗收改用正常瀏覽器，未繞過網站保護；沒有將 origin 的 byte check 冒稱公開 HTTP byte check。

本次仍僅大廳新視覺及輪播上線。其他頁面維持原樣，真機 Safari／完整遊戲回合的新視覺驗收不屬於本次已驗證範圍。舊版封存 8a9cbfd 留存供程式回退，資料 schema 無改動。
