# 討論區與 GitHub Issue 同步

2026-10-07已在 **shhuang.cc** 啟用，目標為 [stanley021039/BGA](https://github.com/stanley021039/BGA)。本次只設定正式環境，程式仍為 **v1.12.0／83ffcab**，沒有修改程式、升版或另發 PR。

## 已支援的操作

| 本站操作 | GitHub 結果 | 權限 |
| --- | --- | --- |
| 建立留言 | 建立 Issue，內容附遊戲分類與本站留言者 | 登入會員 |
| 留下回覆 | 新增該 Issue 的 comment，內容附本站回覆者 | 登入會員 |
| 標記已處理／重新開啟 | 關閉／重開相同 Issue | 本站管理員 |

目前是 **本站 → GitHub**。GitHub 上直接修改的回覆與狀態不會自動拉回本站；既有未連結 GitHub 編號的舊留言也不會自動補送。房間管理者不是本站管理員。

本站表單會先告知留言標題與內容將公開到 GitHub。GitHub 操作者為伺服器配置的帳戶；各會員的本站暱稱另外寫入 Issue／回覆內容。

## 私有設定與維護

- 正式服務的私有 `.env` 設定 `GITHUB_TOKEN`。現有 `EXTERNAL_SIDE_EFFECTS_ENABLED=true` 保留；來源與資料路徑未變。
- 本次使用本機 Git Credential Manager 的既有登入憑證，先在本機與正式主機確認 GitHub 帳戶／目標 repository，再透過加密 SSH stdin 傳入。沒有把 token 放進命令列、前端、Git、驗收文件或輸出紀錄。
- 正式 `.env` 為服務帳戶擁有的私有檔案，權限 `0600`；改動前備份原設定與線上 SQLite，私有備份目錄權限 `0700`。不能將正式 token 複製到開發／移轉驗收環境。
- 替換 token 後需重新載入服務。先確認即時版本、服務身份、資料備份及 **零房間**，不要沿用本文件的 PID 當下一次操作的依據。
- 隔離環境維持 `EXTERNAL_SIDE_EFFECTS_ENABLED=false`。僅有 token 而旗標為 false，仍不能對 GitHub 投稿。

若改用 fine-grained token，目標 repository 的 Issues 需要寫入權限；參考官方 [建立 Issue](https://docs.github.com/en/rest/issues/issues#create-an-issue)／[建立回覆](https://docs.github.com/en/rest/issues/comments#create-an-issue-comment)契約。憑證到期或被撤銷時，應更新伺服器私有設定，不要把新 token 貼在公開 Issue 或文件中。

## 不明結果與重送

`SubmissionService` 用 UUID 與隱藏 marker 區分提交。相同提交 UUID 重送會取回原結果；HTTP 逾時先查核 GitHub，結果不明時記為 `needs_review`。管理員在後台重試前，先確認 GitHub 是否已有對應內容。不要把舊的待處理記錄一律改成 pending，或每次不明結果都用新 UUID 重送。

服務啟動會恢復 pending／sending。本次設定前已確認 outbox 為空，沒有自動補送歷史訊息。

## 本次正式驗收

- 零房間檢查：UTC **2026-10-07T14:21:10.820Z**；設定重載後服務 PID147993、程式版本仍1.12.0，服務與 tunnel 健康。
- [測試 Issue #48](https://github.com/stanley021039/BGA/issues/48)由正式站建立；重送相同 UUID 仍指向同一 Issue。一般會員更改處理狀態被拒絕（403）。
- 背景 Chrome 的正式前端送出一則回覆，再由管理員標記已處理；GitHub／本站均為 closed、均有1則回覆。測試記錄保留為已處理，沒有刪除討論資料。
- 最終 submissions **3筆 done**，沒有 pending／sending／needs_review／failed。既有9帳戶所有欄位、其他18個資料表內容與22表 schema保持，SQLite schema16、integrity ok、foreign-key errors0。
- 既有 submissions 綜合測試1/1通過；獨立 source／模擬複查涵蓋去重、逾時查核、權限與單向範圍。本次未重跑原程式的1,386项全套，設定驗收不冒稱程式發行測試。
- 自有測試登入已登出，背景測試頁已關閉；沒有修改使用者前景分頁、個人偏好或角色。

主要程式位置：`src/integrations/github/client.js`、`submissions.js`、`src/community/board.js`、`public/community.js`。敏感設定與私有驗收輸入不納入 repository。
