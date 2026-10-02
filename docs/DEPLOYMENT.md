# 部署方式：直接連線與 Cloudflare 網域

Afterhours 需要 Node.js **22.13 或更新版**，Windows 與 Linux 使用同一份程式碼。以下兩種模式都可運作；選擇一種作為正式入口，再依作業系統設定。現行正式服務是 **Linux + Cloudflare**，實際路徑及服務名稱見 [Linux 實際部署紀錄](LINUX-DEPLOYMENT.md)。

| 模式 | 網址 | `HOST` | `PUBLIC_URL` | 適用情況 |
| --- | --- | --- | --- | --- |
| 直接連線（原本方式） | `http://<可連到主機的 IP>:3000` | `0.0.0.0` | 留空自動偵測 VPN，或填入該 HTTP 網址 | 同一個可信任的 VPN／區域網路 |
| Cloudflare 網域 | `https://shhuang.cc` | `127.0.0.1` | `https://shhuang.cc` | 透過 Tunnel 公開 HTTPS 網址 |

`PORT` 預設為 `3000`。`PUBLIC_URL` 只決定邀請連結與 HTTPS cookie 設定，不會自己建立 HTTPS 或開放防火牆。**兩種設定不能直接混用**：網域模式會使用 Secure cookie，透過區網的純 HTTP 網址無法正常維持登入。切換模式後要重啟 BGA、重新登入；重啟會清空記憶體中的房間。若換到另一台主機，帳號與留言不會自動搬移，需先安排 SQLite 與 `data/` 的一致性備份及遷移。

首次在全新資料庫啟動前，複製 `.env.example` 為 `.env`，設定 `PORT`、`HOST`、`PUBLIC_URL` 及持久資料路徑，執行 `npm test`，再用 `node admin.js init <管理者帳號>` 建立唯一的初始管理者。此命令只可在沒有使用者的資料庫執行一次，並會顯示一次性初始密碼；登入後立即重設。`.env` 與資料目錄不可提交到 Git。GitHub Issue 同步另需 `GITHUB_TOKEN`，權限與待驗事項見 [Linux 實際部署紀錄](LINUX-DEPLOYMENT.md)。

## Windows：直接連線（Radmin VPN 或可信任區網）

1. 安裝 Node.js 22.13+，在專案根目錄用 PowerShell 執行 `Copy-Item .env.example .env`。將 `.env` 設成 `PORT=3000`、`HOST=0.0.0.0`、`PUBLIC_URL=`。使用 Radmin VPN 時留空可讓首頁優先選擇 `26.x.x.x` 位址；其他區網則可明填 `PUBLIC_URL=http://<主機 IP>:3000`。
2. 執行 `npm test`、首次的 `node admin.js init <帳號>`，再執行 `npm start` 或雙擊 `start.bat`。保持伺服器視窗運作。
3. Radmin VPN 的雙方需在同一網路。以系統管理員身分執行 `allow-vpn.bat`，它只允許 Radmin 介面的 TCP 3000 入站；若不是 Radmin，改為只允許實際使用的可信任網段，勿直接關閉整個防火牆。
4. 在另一台已連上 VPN／區網的電腦開啟 `http://<主機 IP>:3000/login`；成功登入並能開房間才算完成。朋友使用首頁複製的連結或同一網址，不需要路由器轉發。

2026-10-01 以隔離資料、臨時埠 `3001` 驗證 Windows 程式可監聽 `0.0.0.0`，且從主機自己的 Radmin 位址請求登入頁回傳 200；臨時服務已停止。其他 VPN 成員的連線仍需依第 3 步設定防火牆並從第二台電腦驗證。

## Linux：直接連線（可信任 VPN 或區網）

1. 將程式放在 Linux 並安裝 Node.js 22.13+；在 `.env` 設定 `PORT=3000`、`HOST=0.0.0.0`、`PUBLIC_URL=http://<Linux 可連線 IP>:3000`。以目前 VM 為例，測試網址是 `http://192.168.232.128:3000`；其他網路需改成當時實際 IP。
2. 執行 `npm test`，首次建立管理者，然後執行 `npm start`；需要重開機後自動啟動時，可使用下述 `afterhours.service`。若由目前網域模式切到純直連模式，先停用 `afterhours-tunnel.service`，更改 `.env` 後重啟 `afterhours.service`。
3. 若 Linux 防火牆已啟用，只對可信任的 VPN／區網開放 TCP 3000。例如 UFW 可使用 `sudo ufw allow from <可信任網段> to any port 3000 proto tcp`；網段必須按實際網路替換。
4. 從**另一台**同網路電腦執行 `curl -I http://<Linux IP>:3000/login`，應回傳 `200`；再以瀏覽器登入測試。2026-10-01 已從 Windows 對此 VM 的隔離測試埠 `3001` 驗證直連回傳 200，測試程序已停止。

目前 Linux 的常駐 BGA 服務位於 `/etc/systemd/system/afterhours.service`。若改用其他 Linux 主機，可用下列內容建立該檔；`User`、`WorkingDirectory` 和 Node 路徑要改成當地值。資料放在版本目錄外，並保留 `UMask=0077`。

```ini
[Unit]
Description=Afterhours board game server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ccc
Group=ccc
WorkingDirectory=/home/ccc/apps/afterhours/current
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
UMask=0077
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

安裝單元後執行 `sudo systemctl daemon-reload`、`sudo systemctl enable --now afterhours.service`，再檢查 `systemctl is-active afterhours.service`。

## Windows：Cloudflare 網域

1. 在 `.env` 設定 `PORT=3000`、`HOST=127.0.0.1`、`PUBLIC_URL=https://shhuang.cc`，啟動 BGA 並先確認 `http://127.0.0.1:3000/login` 回傳 200。Cloudflare Tunnel 與 BGA 必須在同一台 Windows 主機，或明確把 Tunnel 的來源服務改成 BGA 主機位址。
2. 從 [Cloudflare 官方下載頁](https://developers.cloudflare.com/tunnel/downloads/)安裝 `cloudflared`。在 Cloudflare Dashboard 的 Tunnel「Published application」確認 `shhuang.cc` 的服務 URL 是 `http://localhost:3000`。把此 Tunnel 的 token 存在專案外、限制讀取權限的檔案；`cloudflared tunnel run --token-file <token 檔案路徑>` 可用於前景試跑，長期運行則依[官方 Windows 服務指引](https://developers.cloudflare.com/tunnel/get-started/)安裝服務。不要把 token 放入 Git、MR 或公開終端紀錄。
3. **先停止 Linux 上同一 Tunnel 的 connector**，再啟動 Windows connector；兩台同時連線可能把相同網域的流量送到不同主機。從另一個網路檢查 `https://shhuang.cc/login`，再實際登入。Tunnel 只需對 Cloudflare 建立外連，不需開放公網 TCP 3000 入站。

目前 Windows 尚未安裝 `cloudflared`，所以這一節是可執行的切換程序，**不是已完成的 Windows 網域驗收**。切換前要先遷移或重新建立 Windows 端帳號資料，並安排停止 Linux 服務的時間。

## Linux：Cloudflare 網域（目前運行模式）

1. `.env` 設定 `PORT=3000`、`HOST=127.0.0.1`、`PUBLIC_URL=https://shhuang.cc`。先啟動 BGA，確認 `curl -I http://127.0.0.1:3000/login` 回傳 200。
2. 從 [Cloudflare Dashboard](https://developers.cloudflare.com/tunnel/get-started/)建立或選擇遠端管理的 Tunnel，Published application 設定 `shhuang.cc → http://localhost:3000`，在主機安裝 `cloudflared` 並以受保護的 token file 啟動。現行主機已復用原 Tunnel，`afterhours-tunnel.service` 會開機自啟；不需再新增 DNS 記錄。
3. 確認 `systemctl is-active afterhours.service afterhours-tunnel.service` 都是 `active`，公開 `https://shhuang.cc/login` 回傳 200，管理者可登入，cookie 帶 `Secure`。2026-10-01 已完成以上驗證。Tunnel 模式的 BGA 只監聽 loopback，不應為網站開放公網 TCP 3000。

若在另一台 Linux 主機建立同樣的 Tunnel 常駐服務，可將以下單元放在 `/etc/systemd/system/afterhours-tunnel.service`，並依實際 `cloudflared` 安裝位置及 token file 路徑修改。token file 須在專案外且只有服務使用者能讀取。安裝後執行 `sudo systemctl daemon-reload` 和 `sudo systemctl enable --now afterhours-tunnel.service`。

```ini
[Unit]
Description=Cloudflare Tunnel for Afterhours
After=network-online.target afterhours.service
Wants=network-online.target
Requires=afterhours.service

[Service]
Type=simple
User=ccc
Group=ccc
ExecStart=/usr/local/bin/cloudflared tunnel run --token-file /home/ccc/.config/cloudflared/afterhours.token
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

兩種 Cloudflare 操作的路由及 connector 行為以 [Cloudflare 官方 Tunnel 文件](https://developers.cloudflare.com/tunnel/get-started/)為準。若公開網址回傳 1033，先檢查 `cloudflared` 是否運行、VM 時鐘是否同步及 Tunnel 的來源服務；登入頁正常卻無法登入時，再檢查 `PUBLIC_URL` 是否為 HTTPS 網域。
