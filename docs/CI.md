# 持續整合（CI）

工作流程：`.github/workflows/ci.yml`，追蹤 Issue #68／規劃 #56 第 1 項。

- 針對 main 的 pull request、main push 及手動執行；不設路徑排除
- 固定 Node.js **22.23.3**，滿足 package.json 的 >=22.13
- 標準 `ubuntu-latest`、`windows-latest` 各自 `npm ci`，不共享 node_modules
- 各自執行完整 `npm test`；npm 的 pretest 先執行 release:check，任一步非零即失敗
- 檢查名稱固定為 `test-linux-node22`、`test-windows-node22`，不要任意改名
- 每 job 20 分鐘上限；一個平台失敗不取消另一平台；同 PR／ref 的新執行取消舊執行
- `contents: read`；checkout 不保留認證；官方 checkout／setup-node pin 完整 commit SHA
- npm cache 僅加速下載；仍每次安裝 lockfile，不跳過測試，不使用正式資料或 secrets

## 查看結果

在 PR Checks／Actions 開啟對應 head 的 CI run，再分別查看兩個平台的「Run release check and full test suite」。失敗 logs 留在 Actions；不另上傳資料目錄或測試 artifact。failed、cancelled、skipped、pending 都不能當作通過。手動執行入口在 workflow 合併到預設分支後才可用。

測試失敗時先看第一個失敗測試及環境資訊，區分既有問題、平台差異與本次回歸。不要以 continue-on-error、刪除 assertions、任意略過平台或替換 OS API 強迫綠燈。版本／action SHA 更新需另外核對官方版本與完整雙平台結果。

## 費用與範圍

2026-10-09 已透過 GitHub API 確認 repository 為 public；[GitHub 官方費用說明](https://docs.github.com/en/billing/concepts/product-billing/github-actions) 列明公開 repository 使用標準 hosted runners 免費。未使用 larger runner 或付費附加服務；未來若改成 private 或更換 runner，先重新核對費用及授權。

這個工作流程不會部署、改資料或設定 main branch protection。required checks 與合併保護屬 #56 第 2 項，需另行確認。CI／文件不改產品行為，依 RELEASE-POLICY 不升版。
