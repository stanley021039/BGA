# COC：使用已登入 ChatGPT 的 Codex CLI 主持

網站、朋友連線、骰值與存檔仍由 BGA 伺服器處理。管理者可選擇在伺服器的獨立 CLI profile 登入，或在自己已登入 Codex 的電腦啟動 SSH worker。兩種模式都呼叫官方 CLI，不會自動改用另外計費的 API。

## 本機主持電腦模式

需要 Python 3.11 以上、OpenSSH、官方 Codex CLI，以及可用的 ChatGPT 登入。先在主持電腦執行 `codex login status`；需要登入時，使用 CLI 的正常登入流程。請勿把 key、token 或登入檔交給網站或其他玩家。

伺服器環境設定範例（路徑需由管理者指定；queue 目錄必須在網站公開目錄之外）：

```dotenv
COC_CLI_ENABLED=true
COC_CLI_MODE=ssh-worker
COC_CLI_QUEUE_ROOT=/srv/private/bga-coc-cli
COC_CLI_MODEL=gpt-6.1-sol
COC_STATION_TOKENS_PER_DAY=500000
```

在主持電腦建立不納入 Git 的私人 JSON 設定：

```json
{
  "host": "operator@example-vm",
  "queueRoot": "/srv/private/bga-coc-cli",
  "model": "gpt-6.1-sol"
}
```

`host` 使用現有可連線的 SSH 目標，先完成 SSH host key 核對與登入設定。可選欄位 `sshPort`、`cli`（官方執行檔絕對路徑）、`stateDir`（私人暫存目錄）及 `stopFile`（停止標記；預設為 stateDir 下的 stop）。程式不會建立 SSH 憑證或自動接受新 host key。

啟動：

```powershell
python tools/coc-cli-worker.py --config C:/private/coc-worker.json
```

看到 `CLI_KEEPER_CONNECTED` 後，在網站設定確認「CLI 主持電腦已連線」，再開局或重試主持。預設最多運行 4 小時／200 次請求；可用 `--max-minutes`、`--max-requests` 調整，網站的團務與每日用量上限仍會生效。按 Ctrl+C 或建立停止標記即可結束；下次啟動前刪除該標記。這不是開機服務，電腦休眠、關閉程式或 SSH 中斷時，主持會離線；其他玩家仍可連進網站查看已保存進度。

中斷後重新執行同一命令，等網站顯示已連線，再由房主按重試。系統保留已擲骰值與已扣資源，不自動重擲，也不自動切換付費 API。回覆是否完成無法確定時，保留該次用量預留，避免把未知消耗當成零。另一個仍在線的 worker 持有同一 queue 時，新 worker 會拒絕啟動。

## 伺服器原生模式

設定 `COC_CLI_MODE=native`，並指定 `COC_CLI_TOOLS_ROOT`、`COC_CLI_HOME`、`COC_CLI_WORK_ROOT` 絕對路徑。需要 Linux Bubblewrap 和獨立安裝的官方 CLI；登入只在該獨立 profile 完成。不要複製其他電腦的登入檔來取代正常登入。

## 運作範圍

- 每次請求是臨時、唯讀的 CLI 執行，停用 shell、web、MCP、個人規則與其他工具；只取得指定 JSON 格式的主持文字或意圖分類。
- 角色、劇情真相、規則判定、資源與亂數由伺服器掌握，CLI 無權修改資料庫。
- SSH worker 僅交換該團提供給主持的有限遊戲資料和 JSON 回覆；不讀取或傳輸 Codex 登入檔。臨時請求目錄在完成／取消後清除。
- 額度屬於 CLI 登入帳號；訂閱的實際可用額度與限制以帳號為準。網站 token 記錄是本團追蹤與上限控制，不能直接換算成訂閱剩餘百分比。

官方非互動執行說明：[Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)。

## 正式發布與備份

COC 使用資料庫 schema 21；從 schema 20 升級只新增獨立資料表。部署前先用 SQLite 線上備份副本預演，逐表確認既有資料與 schema 不變。正式切換時先停止寫入並備份資料庫及既有資料目錄，再啟動新版本。舊版不支援 schema 21，失敗時不能只切回舊程式；必須停寫並保留失敗現場，再依備份與新資料狀態處理回復，避免覆蓋發布後的新進度。

加密金鑰的 master 預設位於資料庫路徑加上 `.coc-private/master.key`，權限 0600；需在核准的私人備份中一併保存，不能進 Git、發布包或一般下載。資料庫備份本身不包含這把 master。正式站使用獨立的 SSH worker queue，不能沿用測試站的工作佇列或搬入測試帳號與冒險。CLI 連線測試只開放管理者；一般成員仍可查看主持連線狀態。

插圖只交付 256／512／1024 像素 WebP，每檔低於 256 KiB。URL 包含尺寸與內容 hash，原始生成 PNG 不在發布包。由於素材受即時成員與探索權限控制，回應採 `private, no-cache` 與 ETag；回訪仍重驗權限，有效的條件請求回 304 而不重傳圖片，撤銷成員資格後不能沿快取驗證取得素材。

COC 從大廳建立獨立新桌，或從「我的冒險存檔」恢復；不列入既有一般房間的遊戲轉換清單，避免一般桌的電腦玩家與臨時狀態混入持久冒險。
