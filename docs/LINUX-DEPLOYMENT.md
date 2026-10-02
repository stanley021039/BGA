# Linux 與 Cloudflare 部署紀錄

Windows／Linux 的直接連線與 Cloudflare 兩種完整操作方式見[跨平台部署指南](DEPLOYMENT.md)；本頁只記錄目前 Linux 正式主機的實際狀態。

2026-10-01 將 commit `59cf2cd` 部署到 `192.168.232.128`，同日依序更新至 `9d13d4c`（大廳房間列表）及 `8153da0`（主角色／自訂 GIF 表情與斷線重連）。2026-10-02 先更新至 `bd3e51c`（送禮達人、自訂禮物、檔案架構及公開安全修正），再更新至 `33d5ebe`（送禮揭曉與成就、圖示選禮及同步標喜好）、`b5da6f0`（300 件內建禮物及房主設定投稿比例）、`92e7725`（同頻俱樂部體驗優化），目前切換至 `5525fad`（好友角色分享與帳號繪畫圖庫）。原本的 `~/Desktop/splitwise`、其 SQLite 資料庫及舊 `~/Desktop/BGA` 均未覆蓋。公開入口是 <https://shhuang.cc>；沿用 Cloudflare Tunnel 的 `shhuang.cc → http://localhost:3000` 路由，沒有修改 DNS。

## 目前配置

| 項目 | 位置或服務 |
| --- | --- |
| 版本目錄 | `/home/ccc/apps/afterhours/releases/5525fad`；舊版仍保留，回退前須先確認資料庫 v8 相容性 |
| 執行入口 | `/home/ccc/apps/afterhours/current` 符號連結 |
| 持久資料與設定 | `/home/ccc/apps/afterhours/shared`，只有擁有者可讀寫 |
| BGA 服務 | `afterhours.service`，以 `ccc` 執行，只監聽 `127.0.0.1:3000` |
| Tunnel 服務 | `afterhours-tunnel.service`，以 `ccc` 執行，憑證存於 `~/.config/cloudflared/afterhours.token` |
| 管理者 | 帳號 `ccc`；舊的初始密碼已失效，`shared/admin-bootstrap.txt` 已移除；以現有密碼登入 |

兩個 systemd 服務均已設為開機自啟。部署前 VM 系統時鐘落後約 19 小時；已依硬體時鐘校正，`timedatectl` 顯示 NTP 同步。Linux Node.js 22.22.1 對 `8153da0` 執行 `npm test` 為 85/85。更新前兩次確認進行中房間數為零；以 Python SQLite `Connection.backup` 對運作中的資料庫建立一致性備份 `shared/backups/afterhours-pre-v4-20261001-225056.sqlite`（版本 3、完整性 `ok`）。更新後 SQLite 為版本 4、完整性 `ok`；Linux 主機本機登入與 `/api/rooms`、`/api/profile/options`、`/profile`、`/room-reconnect.js` 均回 200，無效房號重連回 404；從 Windows 測得公開 HTTPS 登入頁及重連腳本均回 200。VM 自身呼叫公開網域的登入 POST 被 Cloudflare 回應 1010，因此本次尚未從公開入口完成有效帳號的端到端登入驗證；舊版曾驗證管理者登入、Secure cookie 與 session。

2026-10-02 在新版本目錄執行 Linux `npm test` 通過 99/99；切換前用 SQLite 線上備份保存 v4 資料庫及其他資料於 `shared/backups/pre-bd3e51c-20261002-014458`，完整性 `ok`。切換 `current` 並重啟 `afterhours.service` 後，資料庫升至 v5，完整性 `ok`。網站與 Tunnel 均運行且開機自啟；程式只監聽 `127.0.0.1:3000`，從 Windows 無法直連 VM 的 3000 埠。從 Windows 經公開 HTTPS 測得 `/login`、`/robots.txt` 回 200，首頁及 `/gifts` 未登入時導向登入，`/gift/ABC123` 保留登入後回房路徑。公開 `/robots.txt` 回 `User-agent: *` 與 `Disallow: /`；登入頁及 robots 回應含 `X-Robots-Tag: noindex, nofollow, noarchive`，HTTPS 回應含 HSTS。

VM 的 UFW 已啟用，預設拒絕入站，只允許 `192.168.232.0/24` 連入 22/tcp；SSH 停用密碼、互動式密碼與 root 登入，管理者須使用已安裝的 SSH 金鑰。`.env` 和 Tunnel token 權限為 600，資料目錄為 700。詳見[安全檢查](SECURITY-REVIEW.md)。部署重啟會清除記憶體房間；本次無法以未知的現有管理者密碼查詢重啟前房間數，也未用正式帳號從公開入口驗證遊戲操作。

2026-10-02 在目前正式版本的程式碼上，以隔離測試資料庫執行送禮達人三帳號 HTTP 驗收，`gift.test.js` 5/5 通過；涵蓋自訂圖片禮物、兩輪遊戲、隱藏選擇、重連、計分、勝利及歷史。沒有更動正式帳號、題庫或房間。

2026-10-02 新版 `33d5ebe` 已放入獨立的 `releases/33d5ebe`，Linux `npm test` 通過 102/102。切換前再以 SQLite 線上備份建立 `shared/backups/pre-33d5ebe-20261002-013904.sqlite`，完整性 `ok`、schema v5、帳號 4 筆。使用者同意清除揭曉中的舊房後，切換 `current` 並重啟 `afterhours.service`；舊房 `F5C5B2` 隨重啟清除。網站與 Tunnel 均為 `active`，本機 `/login` 回 200。正式 SQLite 升至 v6，完整性 `ok`、帳號仍為 4 筆。從 Windows 經公開 HTTPS 驗證 `/login`、`/gift.js`、`/robots.txt` 均回 200，新腳本含圖示送禮與喜好選擇；三組測試帳號逐一登入並讀取 `/api/auth/me` 和送禮頁皆成功，成就 API 可讀。驗證時已有其他新房建立，未再次重啟。

300 件內建禮物的候選版 `3283617` 曾獨立放入 `releases/3283617`；壓縮檔 SHA-256 為 `27c0f4208741eb575123c4a6e7e3f50f1152f44513c93de7c443698a8400b8a6`，Windows 與 Linux 當時全套測試各 102/102。正式 SQLite 當時另以線上備份保存為 `shared/backups/pre-3283617-20261002-020020.sqlite`，完整性 `ok`、schema v6、帳號 4 筆。該候選版沒有單獨切換到正式服務；300 件禮物後來隨 `b5da6f0` 一起上線。

房主設定投稿比例的新版 `b5da6f0` 已獨立放入 `releases/b5da6f0`，包含前述 300 件禮物；Windows／Linux 全套測試各 105/105。房主可在等待室選依題庫比例或 0／25／50／75／100%，送禮達人每輪禮物與同頻俱樂部每次三張候選題分別套用。使用者同意清除所有現有房間後，以 SQLite 線上備份建立 `shared/backups/pre-b5da6f0-20261002-101814.sqlite`，完整性 `ok`、schema v6、帳號 4 筆；隨後切換 `current` 至 `releases/b5da6f0` 並重啟。`afterhours.service`、`afterhours-tunnel.service` 皆為 `active`，正式 SQLite 再檢查完整性 `ok`。從 Windows 經公開 HTTPS 驗證登入頁、兩款遊戲腳本與 robots 均回 200，兩款腳本皆含 `customPercent`，robots 仍全站 `Disallow: /`。新禮物圖檔只允許登入會員讀取，公開匿名要求回 `LOGIN_REQUIRED`；本次尚未以公開帳號實際進房確認房主設定或抽到新圖。

同頻俱樂部體驗改版 `001e967` 先放入獨立的 `releases/001e967` 候選目錄，Windows／Linux 全套測試各 106/106；包含倒扣交卷便箋、完整票數／得分、可跳過焦點、個人音效與「第一次舉牌」成就，詳細驗證見[同頻進度](MAJORITY-IMMERSION-PROGRESS.md)。候選 ZIP SHA-256 為 `82295c7d859c5eb24afdec861e19b06a0d8ea32a86d3e6ad3a92a692d48ef42d`，當時 SQLite 線上備份 `shared/backups/pre-001e967-20261002-104410.sqlite` 完整性 `ok`。

使用者明確指示新版都同步到 shhuang.cc，且不需檢查是否有人正在玩，可直接重啟。最終封存 `92e7725` 已獨立放入 `releases/92e7725`，Linux 全套再次通過 106/106，ZIP SHA-256 為 `f84dfced84471ae2d92cfc9356abe7b272a62b79780aaef6860b04fad7660fbc`。切換前以 SQLite 線上備份建立 `shared/backups/pre-92e7725-20261002-105515.sqlite`，完整性 `ok`、schema v6、帳號 4 筆；切換 `current` 並重啟 `afterhours.service` 後，網站及 Tunnel 都是 `active`，正式資料庫完整性仍為 `ok`、帳號 4 筆。公開 HTTPS 的 `/login`、`/majority.js`、`/majority.css`、音檔及 `/robots.txt` 回 200，腳本與正式提交內容相符（只有 CRLF／LF 差異）；robots 繼續全站 `Disallow: /`，回應含 `X-Robots-Tag`。重啟會清除所有當時的記憶體房間；公開多人實際完成一局與短音主觀聽感仍待確認。

好友角色分享與帳號繪畫圖庫封存為 `5525fad`，獨立放入 `releases/5525fad`。Windows／Linux 全套各 108/108；切換前以 SQLite 線上備份建立 `shared/backups/pre-5525fad-20261002-034828.sqlite`，完整性 `ok`、schema v6、帳號 4 筆。備份複本預演遷移至 v8 也為 `ok`，正式切換並重啟後 schema v8、完整性 `ok`、帳號仍為 4 筆，服務與 Tunnel 皆為 `active`。從 Windows 經公開 HTTPS 驗證 `/login`、新版 `/studio.js`、`/profile.js`、`/gifts.js`、`/robots.txt`；匿名 `/studio` 導向登入、圖庫 API／圖片回 401，robots 仍 `Disallow: /`。本機隔離瀏覽器已驗證繪畫、存入圖庫及選用為角色／禮物；公開帳號端到端實際操作尚待驗收。依使用者指示，重啟前沒有檢查進行中的房間。

## 尚待正式設定

伺服器 `shared/.env` 的 `PUBLIC_URL` 是 `https://shhuang.cc`，資料目錄位於 `shared/data`。**尚未設定 `GITHUB_TOKEN`**。管理者或後續部署 AI 須提供對 `stanley021039/BGA` Issues 具讀寫權限的憑證，放在只允許擁有者讀取的 `shared/.env`，重啟 `afterhours.service`，再以真實授權驗證建立、回覆、關閉及重開 Issue。此憑證不得提交到 Git 或寫入 MR 內容。

帳號繪畫圖庫僅作者可讀取及選用；被選作角色、表情或禮物後，該用途的圖片副本依原有會員／遊戲權限顯示。好友角色分享由作者控制。本站是受邀好友使用，依使用者決定不加入內容審核或檢舉流程。房間及桌邊即時留言存在記憶體，重啟後會清空；帳號、圖庫、角色圖片與永久留言板存在 SQLite。

## 維護與復原

- `systemctl status afterhours.service afterhours-tunnel.service` 查看服務；`journalctl -u afterhours.service -n 50 --no-pager` 查看伺服器日誌。不要輸出 Tunnel token 或管理者初始密碼。
- 更新時將乾淨的 Git commit 封存解壓到新的 `releases/<commit>`，把新版本 `.env` 連到 `../../shared/.env`，完成測試後切換 `current` 符號連結並重啟 `afterhours.service`。資料不可放在版本目錄。
- 回退程式時將 `current` 指回前一個版本並重啟服務；若已執行新的 SQLite schema migration，必須先確認舊版程式支援該 schema，必要時從一致性備份還原 `shared/data`。
- 定期對 `shared/data` 建立一致性備份並保存於另一台裝置；備份應包含 SQLite 主檔及其他持久資料。不要在資料庫運行時單獨複製 `.sqlite` 主檔而忽略 WAL。
