# 公開部署安全檢查（2026-10-02）

本次修正已部署至 `https://shhuang.cc`；公開 `/robots.txt` 回傳全站 `Disallow: /`，登入頁帶 `X-Robots-Tag`，VM 的應用程式埠無法從 Windows 直連。

## 已檢查與修正

- Linux 服務只監聽 `127.0.0.1:3000`，網域經 Cloudflare Tunnel 轉送。UFW 預設拒絕入站，只允許 `192.168.232.0/24` 連入 SSH 22；SSH 停用密碼、互動式密碼及 root 登入，改以專用金鑰登入。Tunnel 憑證、`.env` 和 SQLite 資料目錄僅允許擁有者讀寫。
- 公開 `/robots.txt` 設定 `User-agent: *`、`Disallow: /`；所有回應加上 `X-Robots-Tag: noindex, nofollow, noarchive`，並設 `nosniff`、禁止嵌入頁面、Referrer Policy、Permissions Policy、HTTPS HSTS。爬蟲規則屬自願遵守，登入保護和防火牆才是實際存取控制。
- 登入、註冊、重設及留言操作已有限流；原本只看 socket 位址，經 Tunnel 時所有訪客共用 loopback 位址。現在僅在 origin 綁 `127.0.0.1` 且公開網址為 HTTPS、連線同時來自 loopback 時，才接受格式正確的 `CF-Connecting-IP` 作為限流位址。無效或直接外部轉送標頭不受信任。限流超過回 429。
- SQLite 使用固定 SQL 和參數綁定。帳號、密碼、邀請碼、重設碼、題庫、禮物、留言、房間及遊戲操作均經型別、長度、白名單或狀態檢查；HTML 動態文字輸出使用跳脫或 `textContent`。補充禁止暱稱及角色名稱含控制字元；GitHub Issue 連結只接受 `https://github.com/stanley021039/BGA/issues/<編號>`，避免不安全的連結 scheme 進入頁面。
- 主角色、表情、帳號圖庫與禮物圖檢查檔案內容及 MIME，只接受 PNG／GIF／WebP，單張上限 1 MB；依產品需求不限制像素。圖庫最多 100 件／帳號，原圖只允許本人讀取或用於其他功能；使用時複製圖片，避免藉已分享的角色或禮物讀取私人圖庫。API 要求 JSON、限制請求長度，跨站 POST 檢查 Origin；session cookie 設 `HttpOnly`、`SameSite=Lax`，HTTPS 設 `Secure`。
- HTTP headers 與 request 設有逾時，避免慢速連線長期占用資源。

## 剩餘限制

- `robots.txt` 不能阻擋惡意掃描或保證搜尋引擎從未發現網址。若要阻止所有未授權訪客連登入頁，需額外在 Cloudflare 設 Access 或其他網路層准入政策，屆時一般訪客也無法直接打開登入頁。
- `GITHUB_TOKEN` 尚未設於 Linux 正式環境；留言同步 Issue 無法進行正式寫入驗收，待具權限的管理者補入後再驗證。
- 遊戲房間位於記憶體；部署重啟會清除進行中的房間。角色作品只在登入會員之間由作者主動分享，不設公開匿名作品市集；新增／修改／停止分享都檢查作者權限，圖片仍受格式、大小、請求與速率限制。使用者已決定好友範圍內不建置內容審核或檢舉流程。
