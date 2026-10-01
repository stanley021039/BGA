# Linux 與 Cloudflare 部署紀錄

Windows／Linux 的直接連線與 Cloudflare 兩種完整操作方式見[跨平台部署指南](DEPLOYMENT.md)；本頁只記錄目前 Linux 正式主機的實際狀態。

2026-10-01 將 commit `59cf2cd` 部署到 `192.168.232.128`，同日依序更新至 `9d13d4c`（大廳房間列表）及 `8153da0`（主角色／自訂 GIF 表情與斷線重連）。2026-10-02 更新至 `bd3e51c`（送禮達人、自訂禮物、檔案架構及公開安全修正）。原本的 `~/Desktop/splitwise`、其 SQLite 資料庫及舊 `~/Desktop/BGA` 均未覆蓋。公開入口是 <https://shhuang.cc>；沿用 Cloudflare Tunnel 的 `shhuang.cc → http://localhost:3000` 路由，沒有修改 DNS。

## 目前配置

| 項目 | 位置或服務 |
| --- | --- |
| 版本目錄 | `/home/ccc/apps/afterhours/releases/bd3e51c`；舊版仍保留，但資料庫 v5 不可直接用舊版程式開啟 |
| 執行入口 | `/home/ccc/apps/afterhours/current` 符號連結 |
| 持久資料與設定 | `/home/ccc/apps/afterhours/shared`，只有擁有者可讀寫 |
| BGA 服務 | `afterhours.service`，以 `ccc` 執行，只監聽 `127.0.0.1:3000` |
| Tunnel 服務 | `afterhours-tunnel.service`，以 `ccc` 執行，憑證存於 `~/.config/cloudflared/afterhours.token` |
| 管理者 | 帳號 `ccc`；舊的初始密碼已失效，`shared/admin-bootstrap.txt` 已移除；以現有密碼登入 |

兩個 systemd 服務均已設為開機自啟。部署前 VM 系統時鐘落後約 19 小時；已依硬體時鐘校正，`timedatectl` 顯示 NTP 同步。Linux Node.js 22.22.1 對 `8153da0` 執行 `npm test` 為 85/85。更新前兩次確認進行中房間數為零；以 Python SQLite `Connection.backup` 對運作中的資料庫建立一致性備份 `shared/backups/afterhours-pre-v4-20261001-225056.sqlite`（版本 3、完整性 `ok`）。更新後 SQLite 為版本 4、完整性 `ok`；Linux 主機本機登入與 `/api/rooms`、`/api/profile/options`、`/profile`、`/room-reconnect.js` 均回 200，無效房號重連回 404；從 Windows 測得公開 HTTPS 登入頁及重連腳本均回 200。VM 自身呼叫公開網域的登入 POST 被 Cloudflare 回應 1010，因此本次尚未從公開入口完成有效帳號的端到端登入驗證；舊版曾驗證管理者登入、Secure cookie 與 session。

2026-10-02 在新版本目錄執行 Linux `npm test` 通過 99/99；切換前用 SQLite 線上備份保存 v4 資料庫及其他資料於 `shared/backups/pre-bd3e51c-20261002-014458`，完整性 `ok`。切換 `current` 並重啟 `afterhours.service` 後，資料庫升至 v5，完整性 `ok`。網站與 Tunnel 均運行且開機自啟；程式只監聽 `127.0.0.1:3000`，從 Windows 無法直連 VM 的 3000 埠。從 Windows 經公開 HTTPS 測得 `/login`、`/robots.txt` 回 200，首頁及 `/gifts` 未登入時導向登入，`/gift/ABC123` 保留登入後回房路徑。公開 `/robots.txt` 回 `User-agent: *` 與 `Disallow: /`；登入頁及 robots 回應含 `X-Robots-Tag: noindex, nofollow, noarchive`，HTTPS 回應含 HSTS。

VM 的 UFW 已啟用，預設拒絕入站，只允許 `192.168.232.0/24` 連入 22/tcp；SSH 停用密碼、互動式密碼與 root 登入，管理者須使用已安裝的 SSH 金鑰。`.env` 和 Tunnel token 權限為 600，資料目錄為 700。詳見[安全檢查](SECURITY-REVIEW.md)。部署重啟會清除記憶體房間；本次無法以未知的現有管理者密碼查詢重啟前房間數，也未用正式帳號從公開入口驗證遊戲操作。

2026-10-02 在目前正式版本的程式碼上，以隔離測試資料庫執行送禮達人三帳號 HTTP 驗收，`gift.test.js` 5/5 通過；涵蓋自訂圖片禮物、兩輪遊戲、隱藏選擇、重連、計分、勝利及歷史。沒有更動正式帳號、題庫或房間。

## 尚待正式設定

伺服器 `shared/.env` 的 `PUBLIC_URL` 是 `https://shhuang.cc`，資料目錄位於 `shared/data`。**尚未設定 `GITHUB_TOKEN`**。管理者或後續部署 AI 須提供對 `stanley021039/BGA` Issues 具讀寫權限的憑證，放在只允許擁有者讀取的 `shared/.env`，重啟 `afterhours.service`，再以真實授權驗證建立、回覆、關閉及重開 Issue。此憑證不得提交到 Git 或寫入 MR 內容。

玩家上傳角色只有作者可選用，但其他已登入玩家可看到使用中的角色圖片。公開共享作品前仍須加入授權審查、檢舉與移除機制。房間及桌邊即時留言存在記憶體，重啟後會清空；帳號、角色圖片與永久留言板存在 SQLite。

## 維護與復原

- `systemctl status afterhours.service afterhours-tunnel.service` 查看服務；`journalctl -u afterhours.service -n 50 --no-pager` 查看伺服器日誌。不要輸出 Tunnel token 或管理者初始密碼。
- 更新時將乾淨的 Git commit 封存解壓到新的 `releases/<commit>`，把新版本 `.env` 連到 `../../shared/.env`，完成測試後切換 `current` 符號連結並重啟 `afterhours.service`。資料不可放在版本目錄。
- 回退程式時將 `current` 指回前一個版本並重啟服務；若已執行新的 SQLite schema migration，必須先確認舊版程式支援該 schema，必要時從一致性備份還原 `shared/data`。
- 定期對 `shared/data` 建立一致性備份並保存於另一台裝置；備份應包含 SQLite 主檔及其他持久資料。不要在資料庫運行時單獨複製 `.sqlite` 主檔而忽略 WAL。
