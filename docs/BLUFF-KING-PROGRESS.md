# 瞎掰王口說版本機驗證（2026-10-09）

基線 main／origin/main 1fb45d5，候選分支 feat/bluff-king，版本 1.27.0；未提交、推送、發布 PR 或部署。規則、網站輪數改編、題庫及 AI 限制見 [規格](specs/BLUFF-KING.md)。

完成大廳／房間／登入回跳／重連／歷史與本機測試 AI 接線。15 題皆採可查證資料自行中文改寫，揭曉前只老實人取得正解，揭曉後顯示來源。

Windows 完整 node --test tests/*.test.js：1979/1979 通過，0 失敗／跳過（130539ms），紀錄於 ignored work/bluff-verified-tests.log。12 項專用引擎／AI／題庫／HTTP 測試包括權限、秘密資訊、計分與重複操作、過期回合、題目不足／少於三人開局與 RNG 失敗原子性。新增頁面及遊戲後同步固定頁數／卡片數檢查。release check minor 1.27.0 與 diff --check 通過。

隔離 localhost 測試資料、停用市場排程與外部副作用。內建 Chromium 瀏覽器完成登入、建房、兩位測試 AI、三輪完整口說管理流程、公三小、正解及誤選計分、AI 想想、結果來源與重新整理重連。390×844 viewport 無橫向溢出；截圖 work/bluff-preview/preview.png。未驗證真人多人語音互動、實體手機触控、Safari 或 Linux；AI 是簡單測試說詞與隨機判斷，無 API 或語音理解。

最後拉取 origin/main 仍為 1fb45d5。正式帳戶與資料未操作；測試帳號憑證未写入文件。沒有新增永久偏好。

## 2026-10-10 身分倒數與題庫追加（取代上方候選版本及題庫數字）

候選 feat/bluff-king 1.28.0，已快轉整合 origin/main 4664916（1.27.0），保留畫猜結束條件與媒體視窗更新。原始未提交改動另有 Git stash 本機備份；本輪未提交、推送、發布 PR 或部署。

題庫 60 題：冷知識 30、迷因 15、文學形式 15；每級 20 題，各有 5 題迷因與 5 題文學。保留 bk01–bk15 ID，增加 bk16–bk60；正解用中文改寫，揭曉後附逐題来源。來源於 2026-10-09 搜尋核對，科學／文學採機構或作者組織資料、迷因採 Know Your Meme 百科；Poetry Foundation 的 kenning 核對搜尋摘要，頁面直接讀取遭 403，未聲稱全文抓取成功。難度與中文名稱屬設計判斷，仍需真人試玩調整。

開桌前及房內等待／完場可選 10／30／60 秒，預設 30 秒。每輪全員共用伺服器期限；全員 ready 可提前開始，期限到由排程透過歷史交易自動進入口說。API 即使排程未執行，也在精確期限起隱去 myRole／secretAnswer；前端以 serverNow 與單調時鐘收起秘密卡。AI 只記憶自己的準備階段 view，期限後可使用該記憶說詞。

驗證：25/25 focused（work/bluff-timer-focused.log）；整合最新 main 後 Windows 全套 1991/1991 通過，0 失敗／取消／跳過，128040ms（work/bluff-timer-integrated.log）。涵蓋設定驗證原子性、精確到期保密、自動階段冪等、下一輪新期限、全員提前 ready、AI 自身記憶與實際排程 timeout。release check minor 1.28.0 與 diff --check 通過。

隔離 localhost Chromium 實玩：開桌 select 預設 30、三選項可見、選 10 秒建房 526D4E，加入兩位測試 AI；第一輪不 ready，10 秒自動口說，秘密卡收起、重載仍隱藏，AI 正解記憶保留。第二／三輪重新給 10 秒，第三輪 Stonks 老實人卡可看，ready 後隱藏；真人口頭完成按钮與 AI 想想回合正常。未驗真人多人語音、實體手機、Safari、Linux；本機 AI 不懂語音，不能替代真人遊玩平衡驗收。

補充最後實玩：三輪正常完場（含 Stonks 迷因題及來源）；390×844 房內與開桌對話框無橫向溢出，預設 30 秒仍正確。發現深色 AI 說詞沿用不存在的 surface token 而出現淺底淺字，改用 ui-surface-inset／ui-text；瀏覽器核對 rgb(18,18,18) 底與 rgb(247,241,231) 字。此 CSS 調整後 31/31 相關與亮暗測試通過（1549ms，work/bluff-timer-final-focused.log）；1991 全套結果在該 CSS 小修前完成。截圖 work/bluff-preview/timer-settings.png。已恢復一般 viewport、保留本機服務供試玩。

## 2026-10-10 秒數顯示追加

使用者要求看倒數秒數：將看身分倒數移到 game 區最上方，放大數字、sticky 固定於捲動畫面頂部；準備階段沿用既有伺服器期限與 250ms 更新，最後 5 秒加強邊框。口說階段保留『看身分已結束 0 秒』，等待／揭曉／完場隱藏；未新增口說期限。Chromium 在使用者目前 CAB7B6 房間確認 0 秒文字及捲動後 top 約 16px；未推進使用者回合，本輪未重新實玩準備倒數，前輪倒數實玩證據保留。31/31 相關測試通過（5199ms，work/bluff-countdown-visible-tests.log），語法與 release check 通過。截圖 work/bluff-preview/countdown-visible.png。同一未發行批次維持 1.28.0，未發 PR／部署。

## 2026-10-10 隨機首位想想及最後五秒音效

同一未發行候選 1.28.0。開局先从有效席位隨機選第一位想想，之後依座位順序循環，每人一次；每次重新開局重新抽選，已離席玩家不列入。抽題、老實人及首位想想的 RNG 驗證均在 prepare 前完成，抽選失敗不清空舊場或改分。輪替表只留伺服器，不加到玩家 view。

看身分剩 5、4、3、2、1 秒各播一次既有 turn.wav（320ms），使用 GameSounds / AudioSettings，按 roundId＋秒數去重；音量、靜音及零音量遵從共用遊戲音效偏好，與動畫偏好無關。首載、背景、斷線／過期 snapshot、回焦及 BFCache 不補播，提前進入口說、中止或離頁會停止本頁提示。拒播／載入失敗不阻擋倒數或操作；沒有新增音檔及外部音訊服務。

驗證：50/50 focused（引擎、完整 client VM、共用播放器）；Windows 完整 2000/2000，fail/cancel/skip 0，123249ms，ignored work/bluff-countdown-rotation-tests.log。新回歸覆盖三／九席每個可能起始座位、下一場重抽、原子失敗與離席排除，以及 250ms／poll 重複、5→1、精確零秒、下一輪新鍵、提前 ready、靜音／零音量、減動、背景、斷線、失去新鮮度、BFCache 及 autoplay 拒絕。release check 1.28.0 與 diff check 通過。

隔離 localhost 在零房間時重啟自己的 preview server；只刪除已驗證屬於停止 PID 的五份測試鎖，保留測試資料。Chromium 房間 022CFD：首輪隨機結果恰為房主（合法可能），第二輪依席位轉給測試 AI 1；倒數到零進入口說、私卡收起及計分正常，頁面無 error/warn。原生畫面曾顯示 5 秒，但截圖時間已到 0 秒，不把截圖當 5 秒或實際音訊播放證據。音效曾由 UI 暫開供流程驗證後恢復原先關閉、25% 音量；沒有喇叭／耳機主觀聽感或原生 playing 事件證據。截圖 work/bluff-preview/countdown-random-proof.png。未部署、推送或發布 PR；真人多人語音及遊玩平衡仍待試玩。

清理補充：已透過 UI 離開自己建立的 022CFD 測試房，大廳確認 0 房間，保留本機服務及試玩入口。

## 2026-10-10 三種看身分秒數的音效補驗

使用者要求測試不同秒數。只擴充 tests/bluff-game-sounds.test.js 和驗證文件，沒有更動遊戲音效／引擎程式或升版；候選仍 1.28.0。fixture 使用真 bluff client、GameSounds、AudioSettings，250ms 畫面 tick／1500ms state poll 完整跑 10／30／60 秒，逐項核對 5→1 各一次、零秒不播、下一輪新鍵、靜音／零音量及提前 ready。相关 56/56、fail/cancel/skip 0，542ms；ignored work/bluff-sound-durations-tests.log。上一節完整 2000 的結果保留為先前程式驗證，這輪未重跑全套，不宣稱完整 2006 已通過。

另外建立 ignored work/bluff-preview/sound-qa 隔離測試服務（隨機 loopback port，不使用 3000、帳號、cookie、DB 或其他房間）。原版 BluffRoom 和原版 bluff.js / audio-settings.js / game-sounds.js / turn.wav 均直接由目前檔案載入；其他登入／入座邊界為合成測試替身。以瀏覽器按鈕啟動真實時間 10 秒、30 秒、60 秒，不加速時鐘。測試頁 Audio 包裝器保留原生 Audio / play，只記錄 playing/error/拒播、目前可見倒數及音量到 DOM，未取代音訊解碼或播放器。

Chromium 三種時長各取得 5 次原生 playing，依序剩 5、4、3、2、1 秒；音檔 duration 0.32 秒、readyState 4、volume 0.25，同時播放各 1 段，零載入／拒播錯誤及零漏播／重播。10 秒靜音無 Audio 建立／播放；10 秒提前準備在 5／4 各播一次，階段確認轉入口說後沒有後續聲音。五項原生案例均通過，console error/warn 空。首次載入造成第一段 playing 比觸發晚約 250–270ms，仍在對應秒數內、低於共用 1 秒載入期限；第二段實播間隔約 0.76 秒，其餘約 1 秒，沒有重疊。資料與 source SHA256 分別為 sound-qa/results.json、sound-qa/source-hashes.json；證據截圖 sound-qa/results.png。

這筆取代上節「沒有原生 playing 事件證據」的音效驗收限制，仍沒有喇叭／耳機主觀聽感、Safari、多人跨裝置或弱網實測。只在隔離 origin 改測試音效偏好，結束後關閉並停止音效；原本試玩站設定與使用者房間均未操作。測試分頁與服務已於驗證後清理，結果保留 ignored 本機檔案；未發 PR、部署或新增永久偏好。


## 2026-10-10 PR 發布前最終驗證

候選版 1.28.0；完整 node --test tests/*.test.js：2006/2006 通過，fail/cancel/skip 0，93923ms。這筆更新取代上一輪未重跑完整 2006 的驗證限制。另有倒數音效 focused 56/56，以及 Chromium 原生播放五項案例通過；仍未驗證喇叭／耳機主觀聽感、Safari、真人跨裝置語音與弱網。完整記錄保留於 ignored work/bluff-pr-final-tests.log；原生證據沿用 work/bluff-preview/sound-qa/results.json。

目標 stanley021039/BGA，feat/bluff-king → main；本機準備提交供發布確認，尚未推送、建立 PR、合併或部署。
