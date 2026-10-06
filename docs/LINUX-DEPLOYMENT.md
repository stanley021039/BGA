# Linux 與 Cloudflare 部署紀錄

Windows／Linux 的直接連線與 Cloudflare 兩種完整操作方式見[跨平台部署指南](DEPLOYMENT.md)；本頁只記錄目前 Linux 正式主機的實際狀態。

2026-10-01 將 commit `59cf2cd` 部署到 `192.168.232.128`，同日依序更新至 `9d13d4c`（大廳房間列表）及 `8153da0`（主角色／自訂 GIF 表情與斷線重連）。2026-10-02 先更新至 `bd3e51c`（送禮達人、自訂禮物、檔案架構及公開安全修正），再更新至 `33d5ebe`（送禮揭曉與成就、圖示選禮及同步標喜好）、`b5da6f0`（300 件內建禮物及房主設定投稿比例）、`92e7725`（同頻俱樂部體驗優化）、`5525fad`（好友角色分享與帳號繪畫圖庫）、`ac2d7e0`（撲克與末路狂飆沉浸感及入門成就）、`7fcb436`（末路狂飆碰撞與特殊事件視窗），再更新至 `5a3cdc1`（修正繪畫提示與畫作按鈕遮擋），再更新至 `eee416e`（可移動角色的好友大廳），再切換至 `5870a48`（你畫我猜第一版），其後切換至 `e6dd38f`（整合最新主線圖片權限修補及根目錄整理）、`8b32222`（雷霆之路動畫預設顯示），其後為 `2eae852`（你畫我猜畫筆、猜題聊天室、題材與轉場），其後為 `d480c18`（五款遊戲的原位過場舞台），其後為 `6294dcd`（遊戲控制與逐人收禮修正），其後為 `014c113`（油漆桶與獨立形狀工具），目前為 `50e1819`（整合主線及空房清理）。原本的 `~/Desktop/splitwise`、其 SQLite 資料庫及舊 `~/Desktop/BGA` 均未覆蓋。公開入口是 <https://shhuang.cc>；沿用 Cloudflare Tunnel 的 `shhuang.cc → http://localhost:3000` 路由，沒有修改 DNS。

你畫我猜最終版 `e6dd38f` 放在獨立版本目錄 `releases/e6dd38f`，Windows／Linux 全套測試各 130/130。升級前先以 SQLite 線上備份保存 v8（完整性 `ok`、帳號 4 筆），以備份複本預演 v9 遷移；初版切換後正式 DB 為 v9。切換最終版前再備份 v9，切換後完整性 `ok`、帳號仍為 4 筆。`afterhours.service` 與 `afterhours-tunnel.service` 都是 `active`，公開 `/login`、`/draw`、腳本、樣式及 `/robots.txt` 回 200，robots 保持全站 `Disallow: /`。三個現有測試帳號從 Windows 經 shhuang.cc 開房，驗證答案保密、即時畫布、重連補圖、計分及換畫者；測試在背景 Chrome 執行。依使用者指示直接重啟，記憶體房間隨之清除。

雷霆之路動畫版 `8b32222` 獨立放在 `releases/8b32222`，Windows／Linux 全套測試各 132/132。切換前 SQLite 線上備份為 v9、完整性 `ok`、帳號 4 筆；切換後 v9 完整性仍為 `ok`，網站及 Tunnel 均為 `active`。公開 HTTPS 的賽車腳本、樣式、事件模組及登入頁均回 200。從 Windows 以正式網域的測試帳號與 AI 遊玩，瀏覽器強制減少動態且保留舊的關閉演出設定時，頁面已無動畫開關；車輛第二步位移在 0／180／480 毫秒連續變化，無 JavaScript 錯誤。房間依使用者指示直接重啟清除；其他遊戲的動畫設定沒有變更。

你畫我猜體驗版 `2eae852` 放在 `releases/2eae852`，封存 SHA-256 為 `f3495e9f3475e8cf6b7c76556a99bb0ff054a3d17f9770fe9bd43bc7a7b68e52`；Linux 全套測試 142/142。Windows 的本次功能測試 15/15，當地全套執行有 4 項既有測試在刪除 SQLite 暫存目錄時遇到 `EPERM`。正式 SQLite 線上備份 `shared/backups/pre-draw-guess-20261002T104729Z.sqlite` 為 v9、完整性 `ok`、帳號 4 筆；先在備份副本預演 v10 遷移，再切換 `current` 並重啟 `afterhours.service`。正式資料庫 v10 完整性 `ok`、帳號仍 4 筆，網站和 Tunnel 均為 `active`。公開 HTTPS 的登入頁、畫猜腳本、樣式與 robots 回 200；匿名 `/draw` 導向登入，robots 保持全站 `Disallow: /`，公開腳本與本地封存內容一致。背景 Chrome 在本機兩人局完成題材過濾、兩輪遊戲、500 毫秒延遲筆畫不閃、錯答保留超過 8 秒、快猜計分和階段轉場；公開網域的登入後多人實玩仍待使用者驗收。依使用者指示直接重啟，當時記憶體房間隨之清除。

五款遊戲原位過場版 `d480c18` 封存 SHA-256 為 `c8f8ae323918d1c1194f0f5a8cefe2ad53f1ac1ec96ed614224c9775ee5cb7af`，獨立放在 `releases/d480c18`；Windows／Linux 全套 `npm test` 各 146/146。切換前以 SQLite 線上備份建立 `shared/backups/pre-d480c18-20261002T122253Z.sqlite`，完整性 `ok`、schema v10。依使用者指示直接切換 `current` 並重啟 `afterhours.service`，當時記憶體房間隨之清除；BGA 服務與 Tunnel 均為 `active`，正式 SQLite 切換後完整性 `ok`、schema v10、帳號 4 筆。Windows 經公開 HTTPS 驗證 `/login`、五款遊戲的新腳本與樣式、共用演出模組及 `/robots.txt` 均回 200；不帶測試參數的 `/draw.js` 回應有 `Cache-Control: no-store` 且內容是新版，robots 仍為全站 `Disallow: /`。撲克與賽車中央焦點已在隱藏 Chrome 確認落在遊戲框內；公開網域登入後的多人遊玩與主觀動畫節奏待玩家驗收。正式 `GITHUB_TOKEN` 再確認為未設定，仍由接手部署 AI 在保護的 `shared/.env` 完成設定與實測。

## 目前配置

| 項目 | 位置或服務 |
| --- | --- |
| 版本目錄 | `/home/ccc/apps/afterhours/releases/d480c18`；舊版仍保留，回退前須先確認資料庫 v10 相容性 |
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

撲克與末路狂飆沉浸感版本 `ac2d7e0` 獨立放入 `releases/ac2d7e0`；Windows／Linux 全套各 111/111。切換前以 SQLite 線上備份建立 `shared/backups/pre-ac2d7e0-20261002-041206.sqlite`，完整性 `ok`、schema v8、帳號 4 筆。切換並重啟後正式資料庫完整性仍為 `ok`、帳號 4 筆，網站與 Tunnel 均為 `active`。從 Windows 經公開 HTTPS 驗證 `/login`、`/shared/immersion.js`、`/app.js`、`/race.js`、共用樣式、Kenney 短音及 `/robots.txt` 均回 200；robots 仍 `Disallow: /`，匿名遊戲頁導向登入、成就 API 回 401。隔離背景 Chrome 已驗證動畫與控制；公開多人實玩及主觀聽感尚待確認。依使用者指示直接重啟，原記憶體房間隨之清除。

末路狂飆事件視窗版本 `7fcb436` 獨立放入 `releases/7fcb436`；Windows／Linux 全套各 114/114。切換前以 SQLite 線上備份建立 `shared/backups/pre-7fcb436-20261002-044319.sqlite`，完整性 `ok`、schema v8、帳號 4 筆。切換並重啟後完整性仍為 `ok`，服務與 Tunnel 均為 `active`。公開 HTTPS 驗證 `/login`、新版 `/race.js`、`/race.css`、`/shared/race-event-cues.js`、`/robots.txt` 均回 200；robots 仍 `Disallow: /`，匿名賽車頁導向登入。390px 背景瀏覽器確認事件卡在畫面內、無橫向溢出；公開多人實玩及動畫節奏、音效聽感待確認。依使用者指示直接重啟，原記憶體房間隨之清除。

帳號繪畫編輯器版本 `e040927` 獨立放入 `releases/e040927`；Windows／Linux 全套各 116/116。切換前以 SQLite 線上備份建立 `shared/backups/pre-e040927-20261002-051221.sqlite`，完整性 `ok`、schema v8、帳號 4 筆；切換後資料狀態一致，網站與 Tunnel 均為 `active`。公開 HTTPS 的 `/login`、新版 `/studio-editor.js`、`/studio.js`、`/club-pages.css` 和 `/robots.txt` 均回 200；robots 仍 `Disallow: /`，匿名 `/studio` 導向登入、圖庫 API 回 401。390px 背景 Chrome 已操作色輪、疊圖、繪製、去背和圖庫儲存，無橫向溢出；公開帳號實際操作待驗收。依使用者指示直接重啟，原記憶體房間隨之清除。

自訂畫布與桌機工作區版本 `ff7e13a` 獨立放入 `releases/ff7e13a`，ZIP SHA-256 為 `4f4c38713cbc4f201bc1b743c302831d1200c96454bfcbf95b7111f1856fac0e`；Windows／Linux 全套各 116/116，390px 與 1365 × 768 的隔離背景 Chrome 驗證尺寸、工具、圖層、去背及 PNG／WebP 儲存。切換前以 SQLite 線上備份建立 `shared/backups/pre-ff7e13a-20261002-134400.sqlite`，完整性 `ok`、schema v8、帳號 4 筆；切換後資料狀態一致，網站與 Tunnel 均為 `active`。公開 HTTPS 的 `/login`、新版 `/studio-editor.js`、`/studio.js`、`/club-pages.css`、`/robots.txt` 回 200，robots 仍 `Disallow: /`；匿名 `/studio` 導向登入，圖庫 API 回 401。公開帳號實際繪畫與選圖尚待驗收。依使用者指示直接重啟，原記憶體房間隨之清除。

繪畫提示與畫作按鈕遮擋修正版 `5a3cdc1` 獨立放入 `releases/5a3cdc1`，ZIP SHA-256 為 `482b94d6dc947b477c51c6e7829b04c37ce88b89458784601b04df4f88ac0630`；Windows／Linux 全套各 116/116。隔離背景 Chrome 驗證畫筆與照片圖層的提示不再被捲動區裁切，並實際點擊確認畫作「儲存」與「加入照片」各自執行正確動作。切換前 SQLite 線上備份 `shared/backups/pre-5a3cdc1-20261002-135602.sqlite`，備份及切換後完整性均為 `ok`、schema v8、帳號 4 筆；網站和 Tunnel 均為 `active`。公開 HTTPS 的新版 `/studio-editor.js`、`/club-pages.css` 與 `/robots.txt` 回 200，robots 仍 `Disallow: /`。公開帳號實際操作待驗收。依使用者指示直接重啟，原記憶體房間隨之清除。

## 尚待正式設定

伺服器 `shared/.env` 的 `PUBLIC_URL` 是 `https://shhuang.cc`，資料目錄位於 `shared/data`。**尚未設定 `GITHUB_TOKEN`**。管理者或後續部署 AI 須提供對 `stanley021039/BGA` Issues 具讀寫權限的憑證，放在只允許擁有者讀取的 `shared/.env`，重啟 `afterhours.service`，再以真實授權驗證建立、回覆、關閉及重開 Issue。此憑證不得提交到 Git 或寫入 MR 內容。

帳號繪畫圖庫僅作者可讀取及選用；被選作角色、表情或禮物後，該用途的圖片副本依原有會員／遊戲權限顯示。好友角色分享由作者控制。本站是受邀好友使用，依使用者決定不加入內容審核或檢舉流程。房間及桌邊即時留言存在記憶體，重啟後會清空；帳號、圖庫、角色圖片與永久留言板存在 SQLite。

## 維護與復原

- `systemctl status afterhours.service afterhours-tunnel.service` 查看服務；`journalctl -u afterhours.service -n 50 --no-pager` 查看伺服器日誌。不要輸出 Tunnel token 或管理者初始密碼。
- 更新時將乾淨的 Git commit 封存解壓到新的 `releases/<commit>`，把新版本 `.env` 連到 `../../shared/.env`，完成測試後切換 `current` 符號連結並重啟 `afterhours.service`。資料不可放在版本目錄。
- 回退程式時將 `current` 指回前一個版本並重啟服務；若已執行新的 SQLite schema migration，必須先確認舊版程式支援該 schema，必要時從一致性備份還原 `shared/data`。
- 定期對 `shared/data` 建立一致性備份並保存於另一台裝置；備份應包含 SQLite 主檔及其他持久資料。不要在資料庫運行時單獨複製 `.sqlite` 主檔而忽略 WAL。

2026-10-02 將可移動角色大廳版本 `eee416e` 放入獨立版本目錄，Linux `npm test` 通過 117/117。切換前以 SQLite 線上備份至 `shared/backups/pre-eee416e-20261002-140812.sqlite`，完整性 `ok`、schema v8、帳號 4 筆；切換後狀態一致，`afterhours.service` 與 Tunnel 均為 `active`。公開 HTTPS 的 `/login`、`/lobby.js`、`/lobby.css`、`/robots.txt` 回 200；匿名 `/api/lobby` 回 401，robots 仍全站 `Disallow: /`。公開帳號兩人同時移動待實際使用驗收。

2026-10-02 將大廳點擊移動與角色表情版本 `6bcd5bd` 放入獨立版本目錄，Linux `npm test` 通過 117/117。切換前以 SQLite 線上備份至 `shared/backups/pre-6bcd5bd-20261002-142215.sqlite`，完整性 `ok`、schema v8、帳號 4 筆；切換後狀態一致，`afterhours.service` 與 Tunnel 均為 `active`。公開 HTTPS 的 `/login`、`/lobby.js`、`/lobby.css`、`/robots.txt` 回 200；新版腳本含點擊移動及表情 API，無方向鍵控制，匿名 `/api/lobby`、`/api/lobby/emotes` 回 401。公開好友雙人同時操作待實際使用驗收。

2026-10-02 將大廳連續平滑移動版本 `1360519` 放入獨立版本目錄，Windows／Linux `npm test` 各 117/117。首次切換時舊 Node 程序接到 SIGTERM 後未立即退出，健康檢查超時而自動回退；調整重啟程序後再次切換成功。正式 SQLite 備份 `shared/backups/pre-1360519-20261002-143720.sqlite` 完整性 `ok`、schema v8，公開 HTTPS 新腳本與樣式回 200，匿名大廳 API 回 401。

同日依使用者回饋把走路速度減半，短距離至少播放 350 毫秒；版本 `e9b8e97` 的 Windows／Linux `npm test` 各 117/117。切換前備份 `shared/backups/pre-e9b8e97-20261002-144337.sqlite` 與切換後資料庫完整性皆為 `ok`、schema v8。正式 `current` 指向 `releases/e9b8e97`，網站和 Tunnel 為 `active`；公開 HTTPS 的 `/login`、新版 `/lobby.js`、`/lobby.css`、`/robots.txt` 回 200，匿名 `/api/lobby` 回 401。公開站主觀速度與雙人同步仍待使用者驗收。

使用者在另一台電腦的公開網站確認 `prefers-reduced-motion: reduce` 為 `true`，原 CSS 因此將角色行走轉場關閉。依使用者指示不加開關，改在大廳持續播放行走與表情動畫。`c49bb7c` 的 Windows／Linux `npm test` 各 117/117；背景 Chrome 強制減少動態時仍測得 2 秒轉場。封存 SHA-256 為 `2aad2e540d15f3d3e62a9485cae7928647ecae36ec143e21da1b6219ef0d4a62`，切換前 SQLite 線上備份 `shared/backups/pre-c49bb7c-20261002-152632.sqlite` 完整性 `ok`、schema v8、帳號 4 筆。正式 `current` 指向 `releases/c49bb7c`，網站與 Tunnel 均為 `active`，切換後 SQLite 完整性 `ok`；公開 HTTPS 的新版 `/lobby.css` 含行走轉場且無減少動態覆寫，`/login` 回 200，`/robots.txt` 保持全站 `Disallow: /`。此版公開帳號實際體感待使用者驗收。

2026-10-02 修正版 `6294dcd` 已部署至 `releases/6294dcd`，正式 `current` 已切換。包含畫猜固定倒數與左側畫具、全員收藏、賽車桌機布局與車旁事件、共用 emoji 彈幕及題庫 dialog，以及逐人確認收禮／最後完整計分。角色表情保留原行為，emoji 使用獨立彈幕入口。Windows／Linux 全套各 148/148；隔離背景 UI 驗證包含 1280×720 八人送禮布局、揭曉及結果圖表。封存 SHA-256 為 `EEF599AD6A6F37BDEE288435477FA6BBCACA55751BC7394A9BFD56DCD2119A99`。切換前 SQLite 線上備份為 `shared/backups/pre-draw-guess-20261002T140124Z.sqlite`；備份及正式資料庫皆 schema v10、完整性 `ok`、帳號 7 筆。舊程序收到 SIGTERM 後關閉監聽但沒有退出，後續終止該舊程序，由 systemd 自動重新啟動新版；網站與 Tunnel 都是 `active`。公開登入頁、robots 及三款遊戲／共用腳本和樣式皆回 200，內容與版本一致（比較時正規化 CRLF／LF）；匿名 emoji 選項 API 回 401。未恢復前景遊玩，正式站新版多人完整遊玩尚未重跑。

2026-10-02 油漆桶與小畫家式工具版 `014c113` 已部署至 `releases/014c113`，為目前正式版本。繪畫圖庫與畫猜均提供連續區域填色及獨立空心／實心形狀按鈕，共用 SVG 工具圖示。Windows／Linux 各 151/151 通過；隔離背景 UI 驗證區域填色、復原／重做及畫猜重新載入保留填色。切換前線上備份 `shared/backups/pre-draw-guess-20261002T154604Z.sqlite`；備份及正式資料庫 schema v10、完整性 ok、帳號 7 筆。網站與 Tunnel active，公開腳本／樣式與 `014c113` 一致，登入頁與 robots 回 200。封存 SHA-256：`FC89C3ABD4BDF7EF9B266B570CAC91A41FBC25EBEF40751158C99CF2338D1FF4`。背景測試截圖：`work/ui-bucket-fill.jpg`、`work/ui-draw-bucket-fill.jpg`；未操作使用者前景分頁。

2026-10-04：`feature/game-stage-local` 以 `git pull --rebase origin main` 整合主線 `61bcb14`，合併共用玩家列、音樂、素材庫與本地遊戲／填色功能；正式版本 `cdbc5b1` 已部署到 `releases/cdbc5b1`。Windows／Linux 各 162/162 通過。切換前備份 `shared/backups/pre-draw-guess-20261004T094709Z.sqlite` 為 v10、完整性 ok、7 帳號；以備份複本預演 v12 遷移成功。正式切換後 v12、完整性 ok、7 帳號，網站與 Tunnel active。公开登入、robots、所有受影響遊戲／共用腳本、音樂及素材庫腳本與樣式均回 200，與部署版本一致；匿名社交選項 API 401。封存 SHA-256：`26EEAC406646D6399ED02CFE9CD1CCFB57291AFD21927BF9F40E4DC1CBC009B1`。未 push、未新建 PR，未操作前景瀏覽器。

2026-10-04 房間生命週期版 `50e1819` 已部署至 `releases/50e1819`。返回連結先查即時房間及本人座位，點擊再次確認；過期座位清除本機記錄，網路暫時失敗保留。共用「離開房間」立即離席，房主移交其他真人；最後真人離開立即清房。全部真人關閉／斷線後保留 90 秒重連，超時清房，AI 不留住空房。Windows／Linux 各 171/171。隔離背景 UI 完成返回、離房、舊網址提示驗證；正式站三個既有測試帳號之一背景 HTTP 驗證五款遊戲的最後離房刪除、列表消失及舊號重連 404，測試房均已刪除。切換前備份 `shared/backups/pre-draw-guess-20261004T095637Z.sqlite`，备份及正式資料庫皆 v12、完整性 ok、7 帳號，網站及 Tunnel active；公開修改腳本／樣式均回 200 且版本一致。封存 SHA-256：`20E8912944AEE66DC66FB0CC99C64E8C98C98AC734A0E68E2851D77D4B8054B1`。截圖 `work/ui-room-leave-button.jpg`、`work/ui-room-closed.jpg` 為本機背景驗證。沒有操作使用者前景分頁，沒有 push 或 PR。


2026-10-04 桌機設計主體版`7346c0f`已部署至`releases/7346c0f`。共用字級／間距／SVG元件、四遊戲靜態主操作slot、固定互動順序與200%重排已整合。Windows／Linux各173/173；切換前線上備份`shared/backups/pre-draw-guess-20261004T110122Z.sqlite`，備份與正式資料庫均v12、完整性ok、7帳號；網站及Tunnel active。14份公開修改JS/CSS與版本一致，登入200、匿名社交401、robots不變。封存SHA-256為`F23EB2CB0B6BCAC0083A14B5FB6F136A0F83505B55378449D8328E698E764B06`。正式站三個既有測試帳號背景Chrome已完成送禮逐人確認／最終計分、畫猜兩輪作畫猜題與收藏、同頻三選一／填空分組計分，以及賽車移動與碰撞等事件演出；所有測試房最後離房清理。具體範圍及限制見[桌機設計進度](DESKTOP-DESIGN-PROGRESS.md)。未操作前景、未push或建立MR。


同日題庫dialog返焦修正版`49a5dab`已部署至`releases/49a5dab`，為最終正式程式版本。原題庫link被關閉的details隱藏時，返焦到可見祖先summary；普通button維持原入口。Windows／Linux各173/173；備份`shared/backups/pre-draw-guess-20261004T111538Z.sqlite`與正式DB均v12、完整性ok、7帳號，網站及Tunnel active。封存SHA-256：`D6BCC047E410F5E066077A5334515794F777CE7A9C3403FA1E3393C14D9E58DC`。14份公開資源內容一致；正式站背景撲克開局、文字/emoji、avatar維持、題庫Escape及closebutton返焦通過，最後離房測試號404。四款主要流程已在相同遊戲程式的7346c0f驗證；完整證據見桌機設計進度。未push或建立MR。
