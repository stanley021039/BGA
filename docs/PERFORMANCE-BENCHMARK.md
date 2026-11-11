# 多人效能 benchmark（#311）

現有 `perf:check` 繼續檢查素材與編譯容量；`perf:benchmark` 量測實際瀏覽器及 HTTP server。開發工具不改產品行為，不升產品版號。

## 固定情境

`lobby-ten-effects-v2`：10 個獨立登入 session／BrowserContext，1920×1080、動態開啟。先同時冷載大廳、同一 context 重載，再量 10 秒閒置及兩波 10 人同時 Q／E 特效與移動（波距 2500ms，最後再觀察 1500ms）。使用實際瀏覽器 fetch、正式 REST 與 renderer；不是 UI 鍵盤輸入時間測試。所有頁面必須維持可見且觀察到十位 benchmark 玩家，十位都要成功發動至少一次特效，事件投遞率至少 95%，每頁須建立可見的動畫 canvas。

每頁最多三個同時特效是既有顯示契約，因此「所有事件都收到」與「實際建立特效」分別報告。409 `SCENE_RESPAWNING`／`NO_ATTACK_TARGET` 保留為玩法拒絕，HTTP 總拒絕率仍包含它們；另外列出非預期錯誤，不能把 429、500 或網路失敗當成正常玩法。特效後截圖在量測窗口外拍攝。

## 執行

使用 Node ≥22.13 與鎖定的套件：

```sh
npm ci
npm --prefix frontend ci
npm run frontend:build
npx --no-install playwright install chromium
npm run perf:benchmark -- --out work/benchmark/run1.json
npm run perf:benchmark -- --baseline work/benchmark/run1.json --out work/benchmark/run2.json
```

Windows 預設使用已安裝 Chrome；Linux 使用 Playwright Chromium。可用 `BGA_CHROMIUM_PATH` 指定執行檔。預設只啟動全新暫存 DB 的 loopback fixture，不讀 `.env`、不接正式帳號或外部同步；結束時清除自己建立的資料。首次的瀏覽器安裝只需執行一次。

已啟動的持久化測試站可搭配 `existing-test.cjs`，需要明確提供 QA 程序 PID、原始碼位置、測試 DB 及 loopback URL。工具檢查 PID 確實是 `persist-qa-server.cjs`、來源及資料目錄相符，拒絕正式 `server.js` 程序。它建立十個隨機、無可登入密碼的合成帳號，只在私有 stdin/stdout pipe 傳送暫時 session；結束撤銷 session 並刪除本次帳號。不要直接把 sidecar stdout 存入報告或 Git。

```sh
node tools/benchmark/run.cjs \
  --ssh TEST_HOST --root /path/to/test/source \
  --fixture /path/to/benchmark/tools/benchmark/existing-test.cjs \
  --test-pid TEST_PID --test-db /path/to/test/data/db.sqlite \
  --test-base http://127.0.0.1:3150 \
  --out work/benchmark/test-site.json
```

SSH 模式只將 loopback 服務轉送到本機；不重啟既有站台。測試帳號會在大廳短暫可見，未開遊戲房間；離線存在狀態由原本時限清除。冷載前先等待上一輪的存在狀態過期；其他使用者持續在線時拒絕開始。量測途中若出現其他玩家，也判定情境無效。背景工作仍可能影響 CPU／GPU 指標。

## 指標及界線

- API 完整回應時間 p50／p95／p99／max；攻擊開始到每位觀察者收到事件、到建立動畫 canvas 的時間。後兩者使用同一 client 主機的時鐘，不拿 client 與 server 時鐘相減。
- CDP 記錄冷載／重載及各階段下載 encoded bytes、快取／304、請求數；上傳只計 UTF-8 body bytes。下載包含 CDP 回報的 response 資料，並非封包擷取的 TLS／TCP 總量；未結束 stream 另累加實收 encoded chunks。
- client CPU：本次 Chrome process tree 的累積 CPU 時間；100% 代表一個 logical core，另提供除以 logical cores 的整機百分比。記憶體列出 process tree RSS、private bytes 峰值；加總 RSS 可能重複計算共用頁面。這是同一部 client 模擬十人的總成本，不能直接視為單一玩家的需求。
- Windows client GPU：WDDM 依 Chrome PID 過濾各 engine 使用率、dedicated／shared GPU memory。`gpu3DEnginePercent` 為各採樣的 Chrome 3D engine 指標分布；不是整張 GPU 總使用率。NVIDIA 另用 `nvidia-smi` 記錄整張卡的使用率與 VRAM，包含其他應用程式，不能全部歸因於網站。
- server CPU／RSS／private bytes：fixture 直接讀取自己的程序；既有 QA 站由 `/proc/PID` 外部採樣，包含該程序的其他活動。既有站未加 event-loop instrumentation 時該欄為 null。GPU 同時記錄可取得的 device 遙測；VMware `vmwgfx` 若沒有 GPU 使用率／VRAM counter，明確記錄 unavailable、null 及原因，不填 0。
- 資源約每兩秒採樣，保存原始資料與實際時間，峰值是採樣峰值。rAF 間隔及 long task 用來觀察卡頓，不能宣稱是實體 GPU FPS 或實機手機結果。這個情境涵蓋大廳與共用特效，尚未代表每款遊戲的對局／觀戰／教學負載，也不測 WAN 延遲或數百人容量。

## 版本比較與自動化

報告寫入 ignored 的 `work/`；包含 commit、產品版號、Node／Chrome／CPU／GPU、情境參數及有效性。比較會拒絕無效資料、不同情境、瀏覽器／硬體環境不一致。`--max-regression 30 --baseline FILE` 可明確啟用 30% 的相對退步門檻；預設只報差異，沒有經過確認的絕對效能 SLA。

`npm run perf:history -- --refs BEFORE,AFTER --runs 3` 會從指定 commit 建立 Git archive，各自安裝鎖定套件及建置，使用同一份 harness，依 AB／BA／AB 順序執行並保留每輪 JSON 和 `summary.json`。只刪除本次 mkdtemp 目錄；不切換目前 checkout 或正式服務。舊版需要支援相同大廳協定，不支援時標為失敗，不假造比較。

`Performance benchmark` workflow 可手動指定 before／after，並在 main 的 major／minor 版號變動時自動跑三組比較、保存 JSON artifact。它不取代原有素材預算及正確性 CI；新增 workflow 檔不代表已在 GitHub 執行或通過。

## 已完成的跨版本實測

2026-10-27 已透過同一Windows Chrome client與SSH，在VM隔離測試站依序切換3.6.0、3.7.0、3.8.0、3.9.0、3.11.1，各三輪正／反／正序。十五輪來源及情境有效、投遞100%、非預期HTTP錯誤0；完整數值與同步輪詢波動限制見[近期版本比較](specs/PERFORMANCE-BENCHMARK-HISTORY-311.md)。此為實際跨版本測試站批次證據；單機`perf:history`命令及GitHub workflow尚未實際執行。

[共用 Google 試算表與八張圖表](https://docs.google.com/spreadsheets/d/1r5XVEMSVoY-4glURUqH9qAYbae7xhfx6SjKtMiSvzQI/edit)（知道連結即可檢視），保留十五輪量測、公式與不可取得的 server GPU／VRAM 說明。
