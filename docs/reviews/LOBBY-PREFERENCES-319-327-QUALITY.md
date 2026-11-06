# #319／#327 第二回合：程式品質與風險

2026-11-05，由同一位 Codex 另作第二回合，直接追非同步、資源與權限路徑。

- Base／merge-base：`3f21bc48a60013e42e1211a407bb7ec37dc7cc03`。
- 受審 head：`12f4b5fffb01212bf93792c4f28ea53bc4e1bf31`。
- 範圍、需求與 [第一回合](LOBBY-PREFERENCES-319-327-SPEC.md) 相同，base..head 單一產品提交。

## 已檢查路徑

- 本機／共享狀態：visible 是獨立 ref，只有本機 key 的 on／off 決定；receive 只更新共用 selected 與冷卻，不覆寫 visible。pending／message 的原共享 API 路徑不變，切換個人顯示不觸及 API、授權或資料庫。
- 儲存與錯誤：同步讀取避免等候快照才套偏好；讀寫例外不阻止切換，visibilityPersisted 提示保留失敗事實。storage 僅接受本 key 或 clear；scope dispose 解除監聽。字串比較不解析無界 JSON，也不儲存帳號／cookie／秘密。
- 生命週期：v-if 卸載 LobbyBackgroundArt，原清理解除 visibility／輸入 listener 與 idle timer；useSteppedAnimations 的 onScopeDispose 移除此 source 並在沒有 source 時清 interval。沒有新增輪詢、計時器、動畫循環或提高預算。重新顯示使用最新伺服器背景，reduce 的 paused 路徑保留。
- 選單及焦點：沿用 moreOpen、浮動定位及關閉流程，新增的是同源固定 /credits 連結。Escape 回原按鈕，點外部／離開頁首關閉，原 disclosure 的 Tab 連結順序可用。取消 `.version-note` 只有移除失效樣式，保留 main 的 KDA grid 與 gacha 導覽。
- 測試可信度：三項新增真 Pinia store 回歸涵蓋不發請求、另一玩家、重建 store、儲存受限及 listener 清理；原兩項背景接受／冷卻斷言保留。整合 QA 使用真 build／SQLite／兩個帳號及原生鍵盤／合成觸控，未用伺服器 mock 假裝同步。
- 秘密與發布：檢查 tracked diff、新文件及測試準備；未發現私鑰／GitHub／OpenAI token 模式。試玩密碼執行時產生，登入 JSON／SQLite／截圖／QA 腳本在 ignored work，未追蹤；本機記憶、私有音源及正式資料不加入提交。模式掃描不保證辨識所有秘密形式。
- 相容性：沒有後端／資料 migration／私有資源入口變動。圖片／音效檔與交付網址未變，不新增網路依賴；/credits 內容與 URL 保留。新設定是本瀏覽器偏好，不擴張成帳號雲端同步。

## 結論與證據

本次已檢查範圍未發現問題，沒有待修邏輯、回歸、安全或資源 finding。實際整合驗證、完整測試、歷史失敗與未驗限制以 [整合紀錄](../LOBBY-PREFERENCES-319-327-PROGRESS.md) 為準；前端 273、兩套 UI 矩陣及冷載／reduce 通過。沒有把初期錯用另一份預覽帳號的 QA 401 當產品失敗或成功；更正 QA 合成帳號後重新執行，產品未改。

兩回合對準同組 base／head；後續純審查／進度文件必須比較 src／frontend／tests／tools／public／package／lock 無差異，再於 PR 描述記錄最終候選 SHA，才可保留結論。完整本機驗證不取代最終 head Linux CI，尚未建立 PR、Ready、合併或部署。
