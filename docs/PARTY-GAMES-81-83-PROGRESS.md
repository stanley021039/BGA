# #81／#83 初版驗收

日期 2026-10-09，base `0d1f16d2e97669507d7bb05bb052a713968be13b`，branch `codex/issues81-83-party-games`，候選 v1.26.0／schema 19。尚未合併、打 tag、部署或操作正式資料。規則／題源／來源與未做內容見 [spec](specs/PARTY-GAMES-81-83.md)。

## 已完成與測試

- 猜歌：1–8 人，三個不重複六秒自製傳統／古典旋律片段，登入入座／round UUID 取音訊，標準化別名、一次作答、全員揭曉 +1、最高分、歷史。未接上傳歌曲／流行歌或外部平台。
- 極簡：3–6 人，伺服器驗直線／真圓、40 圖形上限、私人 draft／ready、最後一人 10 秒、採已同步圖形、排序／平手輪替、每圖一次猜、+2/+1、輪替與回顧。未修改原畫猜 renderer 或複製商業題卡。
- 共用大廳／登入回跳／重連／腳本／權限／正常與中止歷史／renderer，PartyRoom 只供這兩款共用。音訊是目前片段，不在 URL 或未揭曉 view 放曲名。

Windows Node22.23.3／npm10.9.9，合成隔離 fixture、外部 side effects 關閉。npm ci 成功；`npm test` **1,967/1,967**，fail／skip／cancel 0、exit 0，131,840 ms。新增 **16 項**（引擎 12、HTTP 1、client 3），驗人數與輪替、數學形狀、保密、一次操作、低筆畫與平手順序、10 秒與晚稿拒絕、空白／錯猜、+2/+1／歌名別名、六秒 mono 非靜音 PCM、音訊權限／舊輪拒絕、nonce 衝突、離席、完整兩款 HTTP／歷史、草稿與 BFCache／音訊 binding 釋放。既有頁數與首頁款數常數按新增兩頁改期望值，沒有刪／跳過原斷言。

全套後補房號、最高分與圖形可及名稱／歷史猜詞回顧，並收緊圓的外框邊界（固定 4px 筆寬預留 2px，避免完整幾何圓的外框被裁成弧），新增貼邊反例斷言。受影響 focused 新遊戲／client／HTTP／資源 **18/18**，不是重新宣稱全套已對最後增量重跑。release:check minor、node --check 與 diff check 通過；最新 PR CI 另確認交付 head。原始日誌 `issues81-83-full.log`、`issues81-83-focused-final.log` 保留 checkout 外，不提交合成測試帳密／cookie。

## 已觀察的瀏覽器範圍

隔離 loopback、合成帳號、內建瀏覽器 1280×720 深色模式。猜歌已從新卡建房、加腳本、三題完局；原生播放 readyState4、duration6、paused false／muted false／error null，標準詞與 Ode to Joy 別名得到共 3 分，換題單播放器、新欄位，草稿 reload 恢復，前題結果保留。這證明解碼／播放狀態，不等於真人喇叭聽感或音樂識別評分。截圖 `issues81-musicquiz-preview.png` 在 checkout 外。

極簡從新卡建房、兩腳本、猜題者答案隱藏、錯猜換到下一張圖、零分中性揭曉；第二輪實際拖線與圓，同步後超過十秒，自動截止仍採兩個圖形並揭曉；第三輪新畫布沒有舊图，提交一筆後排在腳本兩筆前。實際走完六輪，每人當兩次猜題者；工具／腳本全錯，因此並列 0 分，不能當真人遊玩或原生正確加分案例（+2/+1 由引擎與 HTTP fixture 驗）。完成後歷史 36 狀態最後一步列出六輪圖／筆畫／猜詞，猜歌歷史 13 狀態列三題與本人 3 分。console error 0；歷史桌機 DOM scrollWidth1265 ≤ viewport1280。極簡完局截圖 `issues83-minimal-preview.png` 保存在 checkout 外；沒有觀察到的流程不算 pass。

手機／觸控／旋轉、200%／完整讀屏、雙真人接手對照、弱網活動圖形、實體聽感與題目難度／朋友桌樂趣待驗。腳本猜詞／畫圖不代表 AI 能辨識。本輪不部署，沒有更新正式資料或啟動 Windows 正式服務。

## main 同步紀錄

使用者要求定期檢查 main。本輪在建立分支前、引擎後、版號前、完整測試前、完整測試後及 UI／推送準備時多次 `git fetch origin main`；均為 `0d1f16d`，沒有需整合的新提交。推送／交付前仍會再查，後續有新提交則比對差異並補相關檢查。本紀錄不代替未來每輪重新 fetch。
