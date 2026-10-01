# Linux 與 Cloudflare 部署紀錄

Windows／Linux 的直接連線與 Cloudflare 兩種完整操作方式見[跨平台部署指南](DEPLOYMENT.md)；本頁只記錄目前 Linux 正式主機的實際狀態。

2026-10-01 將 commit `59cf2cd` 部署到 `192.168.232.128`。原本的 `~/Desktop/splitwise`、其 SQLite 資料庫及舊 `~/Desktop/BGA` 均未覆蓋。公開入口是 <https://shhuang.cc>；原有 Cloudflare 遠端管理 Tunnel 已設定 `shhuang.cc → http://localhost:3000`，這次復用該路由，沒有修改 DNS。

## 目前配置

| 項目 | 位置或服務 |
| --- | --- |
| 版本目錄 | `/home/ccc/apps/afterhours/releases/59cf2cd` |
| 執行入口 | `/home/ccc/apps/afterhours/current` 符號連結 |
| 持久資料與設定 | `/home/ccc/apps/afterhours/shared`，只有擁有者可讀寫 |
| BGA 服務 | `afterhours.service`，以 `ccc` 執行，只監聽 `127.0.0.1:3000` |
| Tunnel 服務 | `afterhours-tunnel.service`，以 `ccc` 執行，憑證存於 `~/.config/cloudflared/afterhours.token` |
| 初始管理者 | 帳號 `ccc`；初始密碼僅存於 `shared/admin-bootstrap.txt`，首次登入後應立即重設並刪除該檔 |

兩個 systemd 服務均已設為開機自啟。部署前 VM 系統時鐘落後約 19 小時；已依硬體時鐘校正，`timedatectl` 顯示 NTP 同步。Linux Node.js 22.22.1 的測試結果為 80/80；公開 HTTPS 的登入頁、管理者登入、Secure cookie 與 session 已驗證。

## 尚待正式設定

伺服器 `shared/.env` 的 `PUBLIC_URL` 是 `https://shhuang.cc`，資料目錄位於 `shared/data`。**尚未設定 `GITHUB_TOKEN`**。管理者或後續部署 AI 須提供對 `stanley021039/BGA` Issues 具讀寫權限的憑證，放在只允許擁有者讀取的 `shared/.env`，重啟 `afterhours.service`，再以真實授權驗證建立、回覆、關閉及重開 Issue。此憑證不得提交到 Git 或寫入 MR 內容。

玩家上傳角色只有作者可選用，但其他已登入玩家可看到使用中的角色圖片。公開共享作品前仍須加入授權審查、檢舉與移除機制。房間及桌邊即時留言存在記憶體，重啟後會清空；帳號、角色圖片與永久留言板存在 SQLite。

## 維護與復原

- `systemctl status afterhours.service afterhours-tunnel.service` 查看服務；`journalctl -u afterhours.service -n 50 --no-pager` 查看伺服器日誌。不要輸出 Tunnel token 或管理者初始密碼。
- 更新時將乾淨的 Git commit 封存解壓到新的 `releases/<commit>`，把新版本 `.env` 連到 `../../shared/.env`，完成測試後切換 `current` 符號連結並重啟 `afterhours.service`。資料不可放在版本目錄。
- 回退程式時將 `current` 指回前一個版本並重啟服務；若已執行新的 SQLite schema migration，必須先確認舊版程式支援該 schema，必要時從一致性備份還原 `shared/data`。
- 定期對 `shared/data` 建立一致性備份並保存於另一台裝置；備份應包含 SQLite 主檔及其他持久資料。不要在資料庫運行時單獨複製 `.sqlite` 主檔而忽略 WAL。
