# #291 最終核稿索引（2026-10-31）

狀態：**本票設計整理與補稿已完成，待使用者核稿**。CEO／運動員的主要流程、權限、觀戰、等待室展開、處理中／失敗／恢復與結算均有對應稿；本頁指定唯一最新入口。這不是產品已實作、人工已驗收或正式站已更新。沿用原票與 Draft PR #294，不另開重複開發。

文件固定為第三份「BGA｜03 Stitch 最終設計・共用元件」的 **04｜預覽區**。第一份正式基準及第二份測試站未替換。日期為台北 2026-10-31。歷史候選保留以維持節點／留言關聯；較早文件中的待辦由本索引逐項取代，未列為最新的失敗生成稿不得混用。

## 核稿順序與完整覆蓋

| 範圍 | 最新入口／來源 | 涵蓋內容 |
| --- | --- | --- |
| 運動員前半流程 | [K1-F3](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10104)；原 Stitch A3／F2 衍生 | 選秀先手未擲／本人已擲、蛇形選秀、賽前先手未擲／已擲、秘密選角未鎖／已鎖；完整能力入口與原卡 |
| 運動員後半流程 | [K2-F1](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-34259)；原 Stitch B9／B10 衍生修訂 | 本人競速、本人／他人能力決策、本場結算、四場總結算；原版角色肖像與兩種賽道、完整出賽能力及名次分／賽道規則展開 |
| 運動員特殊規則 | [K2 Twist](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-34259)及[既有 D3／D4](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2313-11472) | 原版 Scrying Pool 卡及觸發／淘汰結果；疊加能力與漩渦逆向說明沿既有合法 D1 衍生稿。K2 取代 D3 Twist 圖像槽與 B9 小字；不把舊占位稿列為最新 |
| 運動員觀戰 | [K1-F3](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10104)＋[E4／E2](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2331-15246)＋[右端](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2331-16217) | 等待、兩類先手、選秀、競速、本場結算、總結算；能力等待、秘密選角與失敗；只顯示公開投影，保留完整公開紀錄／名單與水平捲動 |
| 運動員網路／未參與 | [K2-F1](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-34259)＋[K1-F3](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10104) | 傳送中、未確認／重試、斷線、恢復座位均保留合法 cached 賽況；中止與入房等待另列。K1 四類簡化網路示意已標 HISTORY，以 K2 為準 |
| 運動員等待室及共用入口 | [K1-F3](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10104)＋[C3](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2303-15246) | 完整等待室、房間／玩家／聊天／規則展開；桌機雙側、手機收合；不以偽造功能取代實際入口 |
| CEO 一般／最後一輪 | [H1](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2359-22970)＋[G1/F1](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2354-17799) | 經營、等待他人、資金不足、市場耗盡啟動、最後一輪；公司與操作紀錄完整展開 |
| CEO 結算 | [K1-F3](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10104) | 39 步合法對局的個人／集團、股票／公司明細；保留本站替代卡與非原版註記 |
| CEO 等待室／異常 | [H1](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2359-22970)＋[G1/F1](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2354-17799) | 房主／管理者／一般玩家等待權限、未參與、中止、pending、未確認及同筆重試；專注模式／Esc |
| CEO 觀戰 | [E5/F1](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2335-16570) | 公開等待、進行、結算；不暴露玩家私有投影 |
| 房間管理與換遊戲 | [J1](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2389-26913)＋[J2](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2409-28602)＋[K1 邊界](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10104) | 線上邀請／邀請連結、房主管理／管理者僅踢一般玩家、二層確認；未選／已選、超出上限、不足起局人數但可換、遊戲進行中不可換、斷線與忙碌 |
| 聊天及邀請異常 | [J3](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2439-5721)＋[J4](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2448-8090) | 草稿、傳送中、未確認、同 ID 收到；邀請空名單、載入、載入失敗、傳送中、傳送失敗。必要資訊持續顯示 |
| 共用元件實例對照 | [R6 原生實例](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2448-9963) | 21 個直接 Instance、含巢狀共 34 個；按鈕、欄位、tabs、dialog、popover、badge、notice、empty、choice、heading、list。來源 2179:11730，容器 auto-layout |

## 設計與實作差異／交付界線

1. 設計是既有 Stitch 產出的明確本機衍生修訂；本輪沒有重新呼叫 Stitch 生成器。CEO 對局與共用真實元件參考固定 main `4127a035`／3.12.1；運動員原始合法 fixtures 部分來自 3.7.0，版本不混寫。已核對目前 origin/main `bcb3b20e` 中兩款核心場景／store 及邀請／換遊戲／觀戰元件未改；共用 UiField 新增可選 labelHidden、GameRoomPage 的預設變動未改兩款對應契約。此核對不等於以最新產品重跑真人對局。
2. 原圖按需使用既有原版素材：角色卡／肖像、兩張賽道、Twist 卡。K2 共 15 個來源，WebP 轉 PNG 後解碼 RGBA 位元組相同，僅因 Bridge 不支援 WebP 而序列化；圖片是獨立圖層，頁面文字／向量可編輯。沒有整頁點陣圖；本票沒有需要另造的獨立插畫。大廳美術 #284 及動畫 #283／#288 不屬本票完成項目。
3. `RoomInvite` 失敗使用的 StatusSlot／UiNotice 預設約四秒隱藏，輪詢也會重新啟動提示；新稿讓必要空狀態、載入、傳送中與失敗持續可見。見 J4 實際元件證據。
4. `AthleteScene` 把重試 UiButton 放在 UiNotice 預設 slot，但 UiNotice 模板沒有 `<slot>`，現有產品沒有顯示該重試入口。K2 表現預期持續錯誤及重試入口；**尚未修改產品**，也沒有把靜態按鈕當真網路重試通過。
5. `PartyActions.pending` 提示未設 persistent，可能先於十秒等待結束隱藏。新稿保留固定提示槽；競速、pending、未確認、斷線及恢復在同斷點的積分面板位置相同，不丟棄既有賽況。
6. 畫面採可編輯文字／向量與獨立原圖；共用 R6 有原生 Instance 對照，但**不是每張畫面均已改成 Instance／token 綁定／auto-layout 的完整元件樹，也未完成 Figma prototype 接線**。這些不是原 #291 全階段設計整理驗收的硬性條件；不能將 HTML 專注／Tab 測試當作 Figma 原型測試。後續依本稿寫產品仍須使用 Ui 元件與 stitch tokens。
7. 圖片載入與布局核對是合成預覽，本票未新增產品圖片路由／快取。資料不取正式帳號，未發真邀請、聊天、換遊戲或遊戲命令；沒有真人網路重連驗收。保留原版英文，不偽稱取得素材授權。
8. 設計稿與實際產品、人工核稿、CI、合併／部署分開追蹤。PR294 保持 Draft；本階段提交含 skip ci，未啟動 CI／合併／部署。使用者核稿後再依 AGENTS 進入後續交付階段。

## 本輪證據

- K1-F3：120 個外框保存，3508 個可編輯文字、56 個獨立原卡圖層；保留所有外框與原卡圖 ID。26 類最新狀態共 104 張，另 4 類網路舊示意共 16 張標 HISTORY，以 K2 取代。根框 118080×8835，X339000／Y60000。
- K2-F1：56 個外框保存，最終 4828 個可編輯文字、432 個獨立原圖呈現；15 個原始圖片來源。根框 55104×7404，X460000／Y60000；完整長圖高度逐框列下。清除舊 B9／D3 混入的英文製圖備註，修正 320px 導覽溢位，修正圖片／遮罩／位置標記的匯入層級，原 56 外框 ID 保留。
- K1 最新 180 組三尺寸／深淺色布局：字級至少14、按鈕至少44、無頁面橫向溢位。前輪 180 組鍵盤核對（174 次專注／返焦、42 組對話框，busy 不允許 Esc 關閉）保留；F3 改動為頁名、資料、內容與圖片位置，未改鍵盤腳本。不把前輪鍵盤稱為本輪重跑。
- K2 最新 60 組布局；五組初次原圖尚未載入，另逐一讀回確認載入成功，均記在原紀錄。與 K1 共用換遊戲真實元件 30 組三尺寸／主題邊界參考已核對，沒有送出真命令。
- K2 另實際打開兩賽道與 Twist 規則，手機深淺色六組 Esc 關閉通過；兩種原圖賽道深淺色四組方向鍵左右捲動有效。這四組沒有把非零返回位置記成已回起點，也未聲稱全賽道逐段截圖。
- Bridge 每批完整節點讀回並實際檢視 PNG；K1 讀回 120，K2 讀回 56。K1 舊 F2 的雲端尺寸紀錄是 60 手機＋6 桌機樣本，**不是 F3 120 張逐張雲端重驗**。本輪重新載入雲端確認 K1 根框118080×8835、K2根框55104×7404，另實際選取 K2深色手機 Twist390×844／完整能力390×4242；不是176張逐框雲端重驗。
- 本機原始證據位於 ignored `work/design-291/`：`final291-f3-layout-checks.json`、`final291-keyboard-checks.json`、`final291-switch-reference-checks.json`、`final291-k2-final-layout-checks.json`、`figma-final291-f3-repair.json`、`figma-final291-k2-repair.json`、兩份 final-readback 與 PNG。下面節點／尺寸表是可共享的持久索引，不公開私有本機偏好。

## K1-F3 最新逐框索引

桌機基準 viewport 1920×1080；手機 viewport390×844，表中是完整匯出尺寸，長圖不標成1080高。320px 只做布局驗證，沒有聲稱另匯出320框。每列一個狀態／主題，桌機與手機連到真實外框。

| 狀態 | 主題 | 桌機節點／完整尺寸 | 手機節點／完整尺寸 |
| --- | --- | --- | --- |
| 選秀先手擲骰 | light | [2465:10108](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10108) 1920×1080 | [2465:14384](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14384) 390×1345 |
| 選秀先手擲骰 | dark | [2465:12246](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-12246) 1920×1080 | [2465:16137](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16137) 390×1345 |
| 選秀先手擲骰・本人已擲 | light | [2465:10176](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10176) 1920×1080 | [2465:14439](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14439) 390×1345 |
| 選秀先手擲骰・本人已擲 | dark | [2465:12314](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-12314) 1920×1080 | [2465:16192](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16192) 390×1345 |
| 蛇形選秀 | light | [2465:10243](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10243) 1920×2010 | [2465:14493](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14493) 390×4901 |
| 蛇形選秀 | dark | [2465:12381](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-12381) 1920×2010 | [2465:16246](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16246) 390×4901 |
| 首場先手擲骰 | light | [2465:10353](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10353) 1920×1080 | [2465:14588](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14588) 390×1777 |
| 首場先手擲骰 | dark | [2465:12491](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-12491) 1920×1080 | [2465:16341](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16341) 390×1777 |
| 首場先手擲骰・本人已擲 | light | [2465:10436](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10436) 1920×1080 | [2465:14658](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14658) 390×1777 |
| 首場先手擲骰・本人已擲 | dark | [2465:12574](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-12574) 1920×1080 | [2465:16411](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16411) 390×1777 |
| 秘密選角 | light | [2465:10518](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10518) 1920×1632 | [2465:14727](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14727) 390×4074 |
| 秘密選角 | dark | [2465:12656](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-12656) 1920×1632 | [2465:16480](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16480) 390×4074 |
| 秘密選角・已鎖定 | light | [2465:10634](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10634) 1920×1632 | [2465:14830](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14830) 390×4074 |
| 秘密選角・已鎖定 | dark | [2465:12772](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-12772) 1920×1632 | [2465:16583](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16583) 390×4074 |
| 運動員・本局中止 | light | [2465:10902](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10902) 1920×1080 | [2465:15029](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15029) 390×844 |
| 運動員・本局中止 | dark | [2465:13040](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13040) 1920×1080 | [2465:16782](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16782) 390×844 |
| 運動員・尚未入座 | light | [2465:10940](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10940) 1920×1080 | [2465:15053](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15053) 390×844 |
| 運動員・尚未入座 | dark | [2465:13078](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13078) 1920×1080 | [2465:16806](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16806) 390×844 |
| 運動員觀戰・等待開局 | light | [2465:10983](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-10983) 1920×1080 | [2465:15082](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15082) 390×844 |
| 運動員觀戰・等待開局 | dark | [2465:13121](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13121) 1920×1080 | [2465:16835](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16835) 390×844 |
| 運動員觀戰・決定選秀先手 | light | [2465:11023](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11023) 1920×1080 | [2465:15108](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15108) 390×1342 |
| 運動員觀戰・決定選秀先手 | dark | [2465:13161](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13161) 1920×1080 | [2465:16861](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16861) 390×1342 |
| 運動員觀戰・選秀中 | light | [2465:11082](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11082) 1920×1386 | [2465:15153](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15153) 390×1722 |
| 運動員觀戰・選秀中 | dark | [2465:13220](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13220) 1920×1386 | [2465:16906](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16906) 390×1722 |
| 運動員觀戰・決定競速先手 | light | [2465:11160](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11160) 1920×1080 | [2465:15217](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15217) 390×1414 |
| 運動員觀戰・決定競速先手 | dark | [2465:13298](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13298) 1920×1080 | [2465:16970](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-16970) 390×1414 |
| 運動員觀戰・競速中 | light | [2465:11222](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11222) 1920×1145 | [2465:15265](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15265) 390×1520 |
| 運動員觀戰・競速中 | dark | [2465:13360](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13360) 1920×1145 | [2465:17018](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17018) 390×1520 |
| 運動員觀戰・本場賽果 | light | [2465:11344](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11344) 1920×1170 | [2465:15380](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15380) 390×1546 |
| 運動員觀戰・本場賽果 | dark | [2465:13482](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13482) 1920×1170 | [2465:17133](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17133) 390×1546 |
| 運動員觀戰・本局結束 | light | [2465:11470](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11470) 1920×1314 | [2465:15499](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15499) 390×1666 |
| 運動員觀戰・本局結束 | dark | [2465:13608](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13608) 1920×1314 | [2465:17252](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17252) 390×1666 |
| 房間資訊 | light | [2465:11602](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11602) 1920×1080 | [2465:15623](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15623) 390×844 |
| 房間資訊 | dark | [2465:13740](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13740) 1920×1080 | [2465:17376](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17376) 390×844 |
| 參賽玩家 | light | [2465:11663](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11663) 1920×1080 | [2465:15671](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15671) 390×844 |
| 參賽玩家 | dark | [2465:13801](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13801) 1920×1080 | [2465:17424](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17424) 390×844 |
| 房間彈幕與閒聊 | light | [2465:11719](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11719) 1920×1080 | [2465:15713](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15713) 390×844 |
| 房間彈幕與閒聊 | dark | [2465:13857](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13857) 1920×1080 | [2465:17466](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17466) 390×844 |
| 遊戲說明 | light | [2465:11772](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11772) 1920×1080 | [2465:15752](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15752) 390×844 |
| 遊戲說明 | dark | [2465:13910](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13910) 1920×1080 | [2465:17505](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17505) 390×844 |
| 更換遊戲・超出人數 | light | [2465:11833](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11833) 1920×1080 | [2465:15804](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15804) 390×844 |
| 更換遊戲・超出人數 | dark | [2465:13971](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-13971) 1920×1080 | [2465:17557](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17557) 390×844 |
| 更換遊戲・低於開局人數 | light | [2465:11889](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11889) 1920×1080 | [2465:15847](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15847) 390×844 |
| 更換遊戲・低於開局人數 | dark | [2465:14027](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14027) 1920×1080 | [2465:17600](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17600) 390×844 |
| 更換遊戲・進行中 | light | [2465:11946](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11946) 1920×1080 | [2465:15893](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15893) 390×844 |
| 更換遊戲・進行中 | dark | [2465:14084](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14084) 1920×1080 | [2465:17646](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17646) 390×844 |
| 更換遊戲・斷線 | light | [2465:11977](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-11977) 1920×1080 | [2465:15910](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15910) 390×844 |
| 更換遊戲・斷線 | dark | [2465:14115](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14115) 1920×1080 | [2465:17663](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17663) 390×844 |
| 更換遊戲・傳送中 | light | [2465:12010](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-12010) 1920×1080 | [2465:15929](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15929) 390×844 |
| 更換遊戲・傳送中 | dark | [2465:14148](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14148) 1920×1080 | [2465:17682](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17682) 390×844 |
| 王牌執行長・結算 | light | [2465:12065](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-12065) 1920×3654 | [2465:15970](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-15970) 390×4046 |
| 王牌執行長・結算 | dark | [2465:14203](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-14203) 1920×3654 | [2465:17723](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2465-17723) 390×4046 |

## K2-F1 最新逐框索引

| 狀態／展開 | 主題 | 桌機節點／完整尺寸 | 手機節點／完整尺寸 |
| --- | --- | --- | --- |
| racing／page | light | [2492:34263](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-34263) 1920×2429 | [2492:37652](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-37652) 390×3468 |
| racing／page | dark | [2492:40656](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-40656) 1920×2429 | [2493:44045](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-44045) 390×3468 |
| own／page | light | [2492:34538](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-34538) 1920×2581 | [2492:37897](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-37897) 390×3620 |
| own／page | dark | [2492:40931](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-40931) 1920×2581 | [2493:44290](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-44290) 390×3620 |
| other／page | light | [2492:34822](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-34822) 1920×2581 | [2492:38152](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-38152) 390×3618 |
| other／page | dark | [2492:41215](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-41215) 1920×2581 | [2493:44545](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-44545) 390×3618 |
| result／page | light | [2492:35102](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-35102) 1920×2519 | [2492:38404](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-38404) 390×3464 |
| result／page | dark | [2492:41495](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-41495) 1920×2519 | [2493:44797](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-44797) 390×3464 |
| finished／page | light | [2492:35356](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-35356) 1920×2376 | [2492:38638](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-38638) 390×3122 |
| finished／page | dark | [2492:41749](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-41749) 1920×2376 | [2493:45031](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-45031) 390×3122 |
| pending／page | light | [2492:35613](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-35613) 1920×2429 | [2492:38853](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-38853) 390×3468 |
| pending／page | dark | [2492:42006](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-42006) 1920×2429 | [2493:45246](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-45246) 390×3468 |
| uncertain／page | light | [2492:35894](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-35894) 1920×2429 | [2492:39104](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-39104) 390×3468 |
| uncertain／page | dark | [2492:42287](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-42287) 1920×2429 | [2493:45497](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-45497) 390×3468 |
| disconnected／page | light | [2492:36178](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-36178) 1920×2429 | [2492:39359](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-39359) 390×3468 |
| disconnected／page | dark | [2492:42571](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-42571) 1920×2429 | [2493:45752](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-45752) 390×3468 |
| recovering／page | light | [2492:36459](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-36459) 1920×2429 | [2492:39610](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-39610) 390×3468 |
| recovering／page | dark | [2492:42852](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-42852) 1920×2429 | [2493:46003](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-46003) 390×3468 |
| racing／score | light | [2492:36740](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-36740) 1920×1080 | [2492:39861](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-39861) 390×844 |
| racing／score | dark | [2492:43133](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-43133) 1920×1080 | [2493:46254](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-46254) 390×844 |
| racing／track-rule | light | [2492:36892](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-36892) 1920×1080 | [2492:39999](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-39999) 390×844 |
| racing／track-rule | dark | [2492:43285](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-43285) 1920×1080 | [2493:46392](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-46392) 390×844 |
| finished／track-rule | light | [2492:37022](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-37022) 1920×1080 | [2492:40134](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-40134) 390×844 |
| finished／track-rule | dark | [2493:43415](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-43415) 1920×1080 | [2493:46527](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-46527) 390×844 |
| abilities／abilities | light | [2492:37149](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-37149) 1920×2882 | [2492:40264](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-40264) 390×4242 |
| abilities／abilities | dark | [2493:43542](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-43542) 1920×2882 | [2493:46657](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-46657) 390×4242 |
| twist／twist | light | [2492:37440](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-37440) 1920×1080 | [2492:40540](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2492-40540) 390×844 |
| twist／twist | dark | [2493:43833](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-43833) 1920×1080 | [2493:46933](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2493-46933) 390×844 |

## 舊批次的使用方式

H1、G、J1–J4、E4／E5、C3、D3 未被上表取代的狀態保留各批來源、證據與限制，見同目錄各 review。舊 A1/A2/G2/J2 失敗稿及 B9 圖槽不作最終依據；較早 README 已移至 HISTORY-20261031.md。不得只憑某批完成文字推定人工核稿通過。
