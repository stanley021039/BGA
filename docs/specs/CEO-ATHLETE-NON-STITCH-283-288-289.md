# CEO／運動員：不需新 Stitch 稿的功能

2026-11-02；本機候選 3.16.0。需求來自使用者「先做不需要 stitch 的」及 GitHub #283、#288、#289。分支 `codex/ceo-athlete-non-stitch`，基底 `8b63bde302edea0a68af009dc39f9d628a1073d7`（PR #294／3.15.0 已合併）。本批沿用第三份 Figma 已確認 R6 外觀與現有原版賽道／字母棋子，不另生成 Stitch／Figma 稿。設計文件、程式候選與正式環境分開記錄；本批未建立 PR、未啟動 CI、未部署，三票保留 in progress 待驗收。

## #289 私有對局保存

- 通用房間存檔另外保存 server-only `privateState`，帶 version 1／kind；私有引擎透過明確 export／restore 方法重新建立，保留 class 私有欄位的品牌。每層 envelope 限 2MiB，版本、型別、玩家／牌組／關鍵狀態與各席 projection 驗證失敗時拒絕續局。
- CEO 保存已洗牌牌庫、集團／公司、增減牌、資產／持股、回合／倒數、結算。運動員保存招募 RNG key／index、秘密選角、備選與出賽角色、Twist／reserve、待決選擇、效果 queue／context、積分及能力狀態。未發生的競速擲骰仍用現有安全亂數，不將未來結果送往客戶端。
- 原房間 seats、roundId、receipts、媒體等資料繼續沿用既有保存流程；恢復後重試同筆不重做，不同 payload 同 id 衝突仍拒絕。
- 舊 waiting 存檔可恢復；舊進行中存檔缺私有狀態或格式不支援時保留座位、明確中止且不計勝負，清除原 match／receipt、換 roundId。`restoreFailed` 僅作公開提示，房主可重開；其他房間獨立恢復。此功能沿用既有正常關閉保存，不新增每步 durable journal，不能承諾任意程序崩潰前的最後一步已落盤。
- 私有 envelope 不經 player／observer view，也不進 API、前端、公開紀錄或發布素材；既有房間 snapshot 私有保存權限與備份政策不改。

## #283／#288 呈現

只依公開事件與上一份公開投影呈現，不等待動畫才計分、提交或開放操作。新增事件時間／race／track／direction 與必要 from／to；重擲標記作廢值。骰子固定採伺服器面值，650ms 旋轉後靜止，不隨機產生假結果。移動路徑逐格取 canonical trackPoint；warp 跳過中間格，trip 於實際格位傾倒；超越沿同一路徑，Twist 造成的傳送、重置與方向變更也從公開投影補齊。推擠逐格，其餘未附中間路徑的位移採傳送，不捏造經過格。

每 owner 最多六骰／六路徑／十二個原生動畫，路徑最多128步、來源最多100事件；骰子後才播放移動，每批最長2850ms。重疊批次取消舊批；超出預算直接呈現最終結果。棋子直接使用現有 marker；擁擠集合或已消失 marker 才用無互動、aria-hidden 的暫時字母徽章。

首次載入、換房／回合／場次、斷線、重連、事件缺口及舊事件不補播。玩家思考超過通用五秒門檻後，仍可接受伺服器三秒內的新事件；回到頁面仍先建立基準。偏好停用、reduce motion、hidden、pagehide、unmount 取消原生動畫、監聽與暫時棋子；無新增音效、圖片下載、WebGL 或永久 rAF／timer。

## 驗證與證據

環境 Windows／Node v26.2.0，本機工作區；不能視為 Node22 Linux CI 結果。

- `tests/private-room-persistence.test.js` 六項：CEO完整對局每步 round-trip、三種運動員牌組完整四場每步 round-trip、RNG接續、損毀／舊版安全中止、舊 waiting，以及真實 HTTP 多次 app.close／boot。三席與觀戰 projection、秘密資訊隔離、待決 queue、同筆重試、單房損毀與重開均有斷言。
- `tests/room-persistence.test.js` 加入兩遊戲的通用保存與真實 HTTP 重啟矩陣。
- `frontend/tests/athlete-motion.test.cjs` 七項：逐格／傳送／反向／絆倒、基準／重連／去重、伺服器骰面與資源上限、取消／dispose、舊完成回呼隔離、長時間思考與過時事件，以及推擠／決賽重置／方向改變。
- 內建瀏覽器合法引擎快照重播：三個獨立 Vue／Pinia，1920×1080、390×844、320×740，六種事件（骰子、逐格、傳送、絆倒、多骰、作廢重擲）×深淺色，共36組。三席對應骰面／路徑一致，每批測得6／9／12個動畫總數（跨三席）；完成後歸零。中途停用、合成 reduce-motion、合成 pagehide 均由6降到0；相同快照重送為0。這不是三位真人連線，也不是實體手機或真 OS reduce-motion 測試。
- 本機4300真實登入：秘密選角部分鎖定後重啟服務，本人角色、座位與鎖定提示保留；競速按鈕實際送出指令，骰面與賽況格位更新；不相容存檔顯示中止、不計勝負與重開入口。瀏覽器按「再玩一局」回等待室，再按「開始經營」已成功開新局；API重開另由 HTTP 回歸斷言；專注全螢幕進出與退出入口也已實際核對。瀏覽器截圖與 JSON 保存在本機忽略目錄 `work/design-291/non-stitch-*`，不納入發布包。
- 初次整套測試在新增事件時間欄位後，有兩項舊斷言失敗；已明確驗證時間欄位，並在比較相同 seed 的測試固定時鐘。修正後 focused 15/15，最終整套結果下列補記。

實機手機、Safari、GPU FPS、真正網路斷線與 OS 減少動態仍未驗，歸 #290；瀏覽器 refresh／重啟與 owner 單元取消測試不冒充這些結果。#284 仍需要 Stitch 美術；#285–#287 的規則裁定、原圖與官方 CEO 牌庫不在此批。


### 最終檢查紀錄

- 前端全套 266/266 通過（`npm --prefix frontend test`），無略過／失敗；TypeScript／Vite 正式 build 通過，前端模組檢查通過。
- `UI_CHECK_BASE_SHA=8b63bde302edea0a68af009dc39f9d628a1073d7 npm run ui:check` 通過；沒有提高 baseline。`npm run release:check` 為3.16.0。
- `npm run perf:check -- --build` 通過：45音效／1,963,048 bytes／24來源，原預算未增加；新骰子為inline SVG，未增加可下載圖片或音檔。
- 固定 Prettier 3.9.10 的 `npm run format`／`format:check` 通過，1113檔、0 failures。首次格式化有單檔暫時開啟失敗，重跑後正常，未繞過 hook。
- 整套第二次執行為2176/2177，一項既有大廳HTTP fixture在首次fetch出現 `bad port`（臨時埠被fetch拒絕）；同檔單獨重跑8/8通過，沒有修改大廳實作或fixture。第三次 `npm run test:affected` 完整回退261/261檔，2177/2177通過、0 fail／skip／cancel，376693.2978ms；結果對應本輪最終程式樹（基底8b63bde工作區），之後僅補文件／格式，未改程式語意。

兩次交付前自查分開執行：先對照三票需求、資料保存／失敗界線及動畫狀態；再讀差異與呼叫端，核對server-only資料、receipts／roundId、取消與資源上限。已檢查範圍未發現未解重大問題；這些是本機交付前自查，正式固定base／head的兩輪PR審查與Linux Node22 CI仍需在取得本次PR授權後執行。
