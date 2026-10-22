# 傳情畫意中文組字修正（#181）

2026-10-22，候選 2.29.3；基準 main `27d928709ee0661434a8bdabf68c222fde72f9e5`。只處理猜詞輸入，不包含 #182 結算、#183 提示精簡或 #184 出題階段。使用既有第三份 Figma 共用介面與現行版面；不涉及視覺重新設計。

## 原因與修正

`TelephoneScene.vue` 原先將原生 input 的 `:value` 綁定至已完成草稿，組字期間卻略過 input 更新。同一場景消費每 250ms 更新的 `telephone.now`，重繪將 DOM 未完成組字蓋回舊草稿。實際 SFC 編譯、Vue runtime-dom 與 DOM 測試先得到失敗反例：預期「原有注音」，實際「原有」。

改用原生 `v-model` 的 composition 保護，透過 computed setter 繼續走原本 `changeText`，不繞過權限、80 Unicode 碼點及控制字元正規化。既有 input handler 僅把完成輸入的 DOM 正規化為 store 接受值；保留組字期間的提交停用。輸入框以 room scope／stepId 為 key，換頁不沿用舊組字狀態。

## 已執行證據

- `node --test frontend/tests/telephone-ime.test.cjs`：2 項通過。實際編譯並掛載場景，使用 Vue 真實 DOM 更新；涵蓋倒數與快照更新、未完成組字不入草稿、完成／取消選字、換頁途中重建、英文／貼上／控制字元、80 個 emoji 及超限時 DOM 回寫。
- `npm --prefix frontend test`：29 項通過。
- `npm run frontend:build`（含型別檢查）：通過。
- `NODE_PATH=<local playwright runtime> node tools/qa/telephone-ime.cjs`：Chrome headless 原生 CDP IME composition，1920×1080 與 390×844 均通過；組字跨越五次倒數／快照更新，完成選字及追加選字後 DOM 與草稿一致，換頁清除，pageerror 為零。
- 新增的 linkedom 是前端測試開發依賴，沒有加入產品執行期；CI 安裝鎖定前端依賴並在雙平台執行此回歸。

本機 test:affected 因 Vue／前端依賴及 CI 接線保守回退全套 280 檔；最終結果與固定 head 的兩輪審查／CI 證據見 PR。上述測試以隔離場景及模擬 store 驗證輸入生命週期，沒有修改或操作正式資料。未宣稱真人注音候選視窗、實機手機鍵盤、Safari 或完整多人網路對局已驗；現有伺服器／草稿佇列沒有改動。
