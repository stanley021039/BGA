# 程式碼格式規範

專案使用固定版本 **Prettier 3.9.10**；版本由根目錄 `package.json` 與 `package-lock.json` 鎖定。請使用專案安裝的版本，不使用全域 Prettier 或會臨時下載其他版本的指令。`tools/format.cjs` 統一處理格式設定、來源雜湊基準與檢查範圍；設定以根目錄 `.prettierrc.json` 為準，排除項目以 `.prettierignore` 及 `.gitignore` 為準。

## 開發與推送

首次取得 checkout 後執行：

```sh
npm ci
```

`prepare` 會呼叫安裝工具，把此 checkout 的 `core.hooksPath` 設為 `.githooks`。也可手動執行：

```sh
npm run hooks:install
```

每次推送前執行：

```sh
npm run format
npm run format:check
```

檢視變更、將格式修正納入提交後再推送。`format` 會改寫檔案；`format:check` 與 pre-push 只檢查，不自動改寫或提交。禁止用 `--no-verify`、停用 hook 或改用全域版本繞過格式檢查。

## pre-push 檢查的內容

`.githooks/pre-push` 把 Git 提供的 ref 清單傳給 `tools/check-push-format.cjs`。檢查器解析每個即將推送的本地 tip，將 tag 解析為 commit，對相同 commit 去重；刪除 ref 的零 SHA 不需要檢查。

每個 commit 用 `git archive` 匯出至獨立暫存目錄，再以工作區 `tools/format.cjs` 的絕對路徑及本機已安裝的固定版本依賴執行 `--check`，工作目錄設為該暫存樹。設定檔、ignore 規則及 `.format-baseline.json` 取自該 commit；缺少任一設定或基準會拒絕推送。工作目錄、staging area 及未追蹤檔案的待推送內容不參與檢查，因此尚未提交的格式修正不能掩蓋未格式化的 tip。檢查完成或失敗都會清理本次建立的暫存目錄；不會安裝推送 commit 的依賴或執行其 npm scripts。

檢查失敗會阻擋推送。修正後必須提交再重試；若一次推送多個 tip，各 tip 都必須符合規範。這項檢查不逐一掃描 tip 之前的歷史 commit，也不代替既有測試與審查。

## 安裝與平台

工具使用 Node.js、Git 及系統 `tar`；Windows 明確使用 SystemRoot 下的 System32/tar.exe，並指定 hdrcharset=UTF-8；避免 Git for Windows 的 MSYS tar 將磁碟機冒號視為遠端路徑，或系統 tar 誤解中文檔名。Linux 使用一般 Git／tar。hook 使用 LF 行尾，Linux 安裝工具會將其設為可執行。

安裝工具在 CI 及不含 `.git` 的來源封存包中跳過，此設定作用於本機 Git repository，共用它的 worktree 也會沿用；各 worktree 應先更新至包含 `.githooks` 的版本。若已有不同的 `core.hooksPath`，安裝會明確失敗並保留原設定；請先整合既有 hooks，再重新安裝，不能直接覆蓋其他檢查。使用 `--ignore-scripts` 安裝依賴後，必須另行執行 `npm run hooks:install`。

## CI 與例外

現有 Linux／Windows CI test job 在 `npm ci` 後執行 `npm run format:check`，格式失敗即停止該 job。原有 job 名稱與完整測試步驟保留。

本輪採漸進整理：`.format-baseline.json` 記錄尚未整理的 legacy 檔案原始 SHA-256。只正規化 CRLF／LF 後，內容 SHA-256 完全符合既有基準的檔案可暫時略過；任何修改都必須符合 Prettier。新檔案不享有此豁免，普通 `src/data/locks.js` 等程式來源不列為永久例外。格式化完成的 legacy 檔案可從基準刪除；禁止新增、擴增或重新產生基準來規避檢查。

永久例外由 `.prettierignore` 精確列出：Markdown（`**/*.md`，包含 `docs/**`）、`public/assets/**`、`tests/fixtures/**`、根目錄及 frontend 的兩份 `package-lock.json`、SVG、`generate-motion-art` 工具，以及 `race.html`／`thunder.js`／`tutorial.js` 對應來源。這些保留文件、素材來源與既有雜湊／字串契約；精確路徑及註解以 ignore 檔為準。不能為方便而永久排除整個舊程式目錄，新增例外必須記錄原因並一併審查。

## 排版設定

兩格空白、單引號、分號、100 字元目標行寬與 LF。HTML 使用嚴格空白敏感度；Vue 的 script／style 同樣排版。其他檔案的嵌入語言維持原內容，避免無關的範本字串重寫。

## Windows 行尾回歸（2026-10-20，PR #145）

Windows CI 原先因 Git 自動轉為 CRLF，讓 34 份 JSON／HTML／YAML 檔案不符合 LF 格式。`.gitattributes` 現已涵蓋格式工具納管的所有副檔名，讓 `core.autocrlf=true` 的 checkout 仍保留 LF；不放寬 Prettier、不重建 legacy 基準。回歸以獨立 checkout 啟用 autocrlf，檢查檔案實際 bytes 及執行 format:check，完整套件由新 head 的雙平台 CI 驗證。

本次回歸：Linux 與 Windows 各 354 份格式檢查、565 份未改 legacy，0 failures。Windows Git core.autocrlf=true：舊規則重新 checkout frontend/package.json 實際含 CRLF，套用修正重新 checkout 後為 LF。Linux format --write 為 0 formatted，git diff --check 通過；未在本機跑完整套件，未修改 UI 或部署。
