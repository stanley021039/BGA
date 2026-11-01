2026-10-28最新接續：[E4／E2候選已匯入及雲端12/12核對](spectator-e4-review.md)，取代本檔較早的E2待生成／尚未匯入與D3保存未確認現況；E1失敗及來源仍保留。

# #291 E1：3.12.1 公開觀戰參考

2026-10-28。第三份 Figma／Stitch 的接續範圍，**目前只有真實元件的合成資料參考，尚無 E1 最終設計或 Figma 匯入**。不將它算成產品修改、真人連線或測試站／正式站驗收。

## main 整合及驗證

分支以 merge `b5c57867` 整合 main `4127a035`（3.12.1），沒有衝突；相對該 main 的任務改動仍為設計候選 SVG 與文件。package／lock 差異僅版本，沒有更換依賴。既有 D3／D4 合法快照保留原 3.7.0 來源，不回填成 3.12.1 截圖。

整合後 `npm run test:affected` 由於分支候選 SVG 沒有受影響測試映射，依規則回退完整 257/257 檔：**2155/2155 通過**，無失敗／取消／略過。前端 **254/254 通過**；`frontend:build` 的模組邊界、vue-tsc 與 Vite 建置通過。建置有 public 靜態資源於執行期解析等警告，前端測試有測試 harness 的 Vue lifecycle 警告，沒有當成完全零警告。format／format:check 為 1066 checked、0 formatted、111 unchanged legacy、0 failures。這些是本機證據，不是 PR Linux CI 或人工驗收。

新版來源須保留 #296 公開觀戰投影、#305 桌機側欄預設展開／手機收合，以及 #297 聊天室公開操作契約。#301 玩家手機場景控制不能直接塞入唯讀觀戰頁。D3／D4 遊戲內容候選尚未核對完整新版共用場景外殼，不能用本次觀戰結果代替。

## 合成參考與實際瀏覽器核對

使用目前 Room 類別、既有觀戰 QA 的有界 AI 行動與 `spectatorView` 公開投影產生 CEO、運動員合法流程快照；Vite 掛載目前 `RoomSpectator.vue`，本機 GET-only mock 只供應公開 DTO，沒有資料庫、正式帳號或玩家寫入操作。不是重新手畫一個類似的觀戰畫面。

- CEO：等待、進行、結算，共三狀態。
- 運動員：等待、選秀先手、選秀、競速先手、秘密選角、競速、能力等待、本場賽果、全局結束，共九狀態。
- 12 狀態 × 1920×1080／390×1080 × 深／淺色，共 **48 組**，實測 innerWidth 與要求尺寸一致、文件 scrollWidth 不超過 clientWidth；逐組核對 `data-color-scheme` 與實際面板顏色，不僅依 URL 主題參數推定。所有狀態沒有 input／select／textarea，唯一 button 是專注全螢幕，另保留離開連結。
- 公開選角只顯示隊伍與「秘密選角尚未公開」；能力等待只顯示等待 Beatrice 完成，沒有選擇選項或玩家提交控制。未宣稱覆蓋所有敏感欄位組合或非零 CEO 私密修正值。
- 運動員全局結束手機頁實際切換專注模式，退出鍵取得焦點；Esc 還原並返焦原入口，無頁面橫向溢出。這只驗該狀態，不擴稱所有遊戲全螢幕均驗收。
- 未知合法格式房號的 mock 404：持續顯示錯誤與重新連接入口；點重試仍收到 404。錯誤時副標仍寫「連接中」，記為後續文案／狀態候選問題；沒有模擬成功重連，也沒有測真人斷線恢復。
- CEO 進行／結算、運動員秘密選角／能力等待／競速／結束各保存桌機與手機完整長圖，共 12 張，另保存錯誤圖。長圖依實際高度記錄，不標成全部 1080 高。瀏覽器 warn／error 記錄為零。

初輪參考工具誤用 `data-theme`，沒有接到既有 `data-color-scheme` owner，導致白底配深色面板；已在 ignored fixture 修正並載入正常頁面基礎 CSS，重跑上述 48 組及全部長圖。初輪 JSON 留為 wrong-theme-history，不當作深淺色通過。曾用 WATCH 開頭房號被真元件格式檢查拒絕，改合法十六進位六碼後才開始有效截圖；不將兩項工具問題歸因產品。

本機 ignored 證據：`spectator-e1-public-fixtures.json`、`spectator-e1-matrix.json`、`spectator-e1-focus-error.json` 與 `spectator-e1-*-full.png`。沒有上傳本機偏好、憑證或私有音源。

## E1 實際產出與初測，E2 修訂中

Stitch 三張已生成，來源：能力等待 `b0d5cf6923db4f36ae3818f61259f979`、秘密選角 `b6313b2a4ed844d491a18ac9f4d10b3c`、連接失敗 `39cc998802c74af6bfc4e29f289efa13`，均在既有[運動員專案](https://stitch.withgoogle.com/projects/6540616740381984054)。已擷取實際預覽：能力等待的 iframe srcdoc 仍是載入 bootstrap，清理後只有56字，故改讀已渲染 iframe 的完整 DOM；另外兩頁 srcdoc 有完整內容。清理只還原原始 CSS viewport 單位及移除 Stitch injected 子樹，未修產品或默默補設計互動。

三頁各 1920／390／320 共九組初測：尺寸相符、文件無橫向溢出、沒有 input／select／textarea；公開名冊、能力等待及秘密未公開提示保留。三頁320px專注進入後退出入口取得焦點，Esc還原並返焦原入口。錯誤重試實際 disabled／pending，再次觀察600ms後回原錯誤並返焦；中途尚未計時結束的觀察仍是 pending，沒有誤記成卡死。以上只驗當前瀏覽器主題，**E1候選本身深淺色未完成核對**，不沿用真元件48組結果。

初測發現未通過項：頁內沿用「真實RoomSpectator」來源標籤，容易把Stitch候選誤稱產品；離開使用button＋confirm／console而非真實同房玩家入口連結；失敗說明自創「觀戰授權關閉」及結束不能看等原因，並誤稱返回大廳；全螢幕退出按鈕為12px。這些未匯入Figma，保留E1歷史。

已送出 E2 三張獨立精準修訂，要求修正上述標記／離開href／失敗原因與R6小字，保留唯讀資料與有效互動；確認輸入框已清空。E2 實際HTML與複驗尚待，不只憑生成回覆當成完成。ignored 證據增加 `spectator-e1-stitch-screens.json`、`spectator-e1-candidate-first-matrix.json`、`spectator-e1-candidate-interactions.json`、`spectator-e1-candidate-retry-final.json` 及三張手機完整候選圖。

## 待完成

已在既有運動員 Stitch 專案貼入桌機能力等待、手機能力等待及手機錯誤三張實際參考，送出 E1-01 能力等待／E1-02 秘密選角／E1-03 連接失敗的三張獨立候選需求，E1實際HTML與三尺寸初測及缺陷以上節為準，E2複驗、R6規格核對與第三份04的可編輯匯入仍未完成；完整側欄／抽屜與跨狀態穩定尺寸也未涵蓋。D3／D4 九框仍受 Figma reconnect／雲端重開未確認限制，詳 [D3／D4](athlete-d3-review.md)。本票其餘 CEO 等待／錯誤／未參與、等待室展開、中止／重連及共用元件化缺口仍保留；#291 不關閉，PR #294 保持 Draft，未啟動 CI、合併或部署。
