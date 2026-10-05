# 雷霆之路：多格移動與路徑預覽

初始日期：2026-10-05。分支 `feat/party-content-and-race-paths`；最新正式狀態見下方按版本排列的紀錄。此項承接使用者「一次走多格、滑鼠移過去先顯示路線、盡量避開障礙，仍能一格一格走」要求。主 agent 背景Chrome已完成單步＋連續五步、hover零命令／遠格一個POST、键盤焦點及狀態重繪保留；不是真人樂趣或GPU效能量測。詳 [整合驗收](PARTY-UPGRADE-PROGRESS.md)。

## 2026-10-06：途中事件checkpoint，正式 v1.1.3

使用者要求確認移動中遇到事件時先處理事件、再繼續位移。本增量為呈現加入定位metadata：`event()`統一帶`afterMotion`，指向事件發生時最後確認的motion group；由引擎最後寫入，extra不可覆寫。car／target事件捕捉當下公開x／y，既有顯式x／y保留；車輛稍後移動不改寫舊事件位置。Thunder公開events由12筆增至最多64筆，與有界motions分開保存，供前端在連續位移之間定位事件。玻璃排入下一個forced move前新增`glass`事件，checkpoint位於剛進入玻璃的那段位移後；新增紀錄沿用既有event的version／log機制。既有回覆與輪詢的事件payload增加，但沒有新增HTTP、伺服器timer或DB欄位。

前端依`afterMotion`將checkpoint插入確認位移之間：抵達事件格後先呈現文字及效果，一般事件停留1600ms、道路事件3200ms，再播放下一段位移。同一checkpoint的連鎖事件一次呈現全部文字，最高優先事件只決定插圖；事件位置使用當下捕捉座標。位移效果由`onMove`在該段實際開始時觸發，不會在前一事件停留時提前噴氣／滑移。presence重繪保留elapsed及已發送callback，不隱藏當前事件、不重播或延長停留。

只有事件、沒有新位移時仍可停留並鎖遊戲動作；移動及事件全部完成後才呈現dice／controls／winner／教學下一步，poll／roster／chat不中斷。略過或Escape只縮短當前事件停留，不跳過後續位移、不替玩家擲骰或確認。hidden／reduced-motion／停用／重連直接同步最新狀態，不補播舊checkpoint。延遲只在本機呈現，使用客戶端排程，不以動畫callback推進伺服器規則。

**只改呈現、公開事件metadata與有界紀錄，不改地形／碰撞規則優先順序。**引擎仍每一格先drain效果、再判斷是否能進入下一普通格；dice／pending暫停，停車／死亡、位置變更、道路換片或回合變更會丟棄舊route。acceptDice只處理已確認效果，不自動續跑原遠目標；有剩餘點數時依新狀態重新選路。原本玻璃格同時有敵車時先滑向下一格、丟棄過時原格collision的行為保留，本增量沒有宣稱「任何車都必須先碰撞」。

本地引擎增量新增6項真回歸：必經火焰首格afterMotion1、其後普通位移2／3；玻璃1→地雷／損傷2→打滑落點火焰3；未知油漬先awaiting、accept後只滑移並記新落點事件、不偷偷續原route；checkpoint不可覆寫／位置及隱私；16格事件全保留與64筆上限；玻璃同敵車的原語義。嵌入教學引擎一致性亦在測試內。整合後Windows完整 **625/625** 通過（失敗／取消／跳過0，約13秒），證據`work/race-event-order-windows-tests.log`；控制器／呈現 **43/43**，新增22項涵蓋自動／手動事件、尾端沒有motion的等待、presence、略過、取消及舊callback隔離。

主agent背景Chrome在隔離localhost3199、正常1794×1010 viewport、兩個合成帳戶及受控地形，實際點擊並觀察火焰抵達→「事件處理中」停住→續走，以及玻璃提示→滑移→地雷／損傷同批提示→打滑→火焰提示。油漬案例先顯示擲骰dialog，約1秒骰子動畫後才可確認；另直接進油漬格，確認方向後先滑至跳台，再顯示跳台檢定，確認後弧線跳躍抵達才換下一位。遠目標油漬案例停下並提示重新選路；直接油漬→跳台案例用鄰格操作，完整遠目標連鎖另由真引擎／控制器回歸驗證。頁面沒有新console error。真控制器／render回歸抓到at0與presence重繪隱藏當前事件卡，以及舊撞擊CSS在抵達前播放，均已修正；後續Chrome實測亦確認提示正常。私有截圖`work/event-order-*.jpg`、時間紀錄`work/event-order-frames.json`，35張真截圖匯出`work/race-event-order-demo.gif`。本機測試服務已正常停止；這不是GPU／FPS量測；雙平台與正式站結果見下方正式驗收。

正式驗收（2026-10-06）：受測程式提交`22a9d6fd71ba0523a456321567fc71d6a856e171`，Windows／Linux Node22.22.1各 **625/625**（失敗／取消／跳過0，Linux約115秒）。乾淨提交建立本地annotated `v1.1.3`，未push／新PR；後續純驗收文件不移動tag。隔離副本schema13、15表逐列一致、完整性ok、外鍵0、啟動成功。發布包SHA-256 `1c84f65ecbed1598f21fd7d2933b4788ae28c9b764bff6f8d3037f2511e980c0`，未包含本機私人偏好與QA檔案。備份`shared/backups/pre-party-22a9d6f-20261005T181838Z`（UTC）另存SQLite及持久檔案，不宣稱同一原子時間點。

切換前再次確認零房間；正式current `releases/22a9d6f`，PID40729→42200，service與tunnel active。schema13、7帳戶全欄位逐列一致、既有session有效；公開/api/version為1.1.3且no-store，race HTML及7資源（race.js、movement、dice dialog、event cues、vehicle effects、header JS／CSS）與受測程式一致。背景Chrome正式設定顯示「版本 v1.1.3」，截圖`work/race-event-order-production-version.jpg`；正式未新建遊戲房間。本機錄影與正式資源驗收分開記錄，不把受控本機動畫冒稱正式實玩。Linux證據`work/race-event-order-linux-tests.log`，公開驗證`work/version-production-verification.json`。

## 2026-10-06：所有位移與操作順序，正式 v1.1.2

使用者要求撞車時先在地圖平滑移動、抵達後再進下一步，推移／交換位置等有位移的動作都需動畫。本節是後續實作與正式驗收記錄，**取代下方 v1.1.1「不鎖操作」、「淘汰車不回放」、「強制位移僅接末點」的行為說明**。v1.1.1 的既有發布證據保留；本節v1.1.2已部署至shhuang.cc，Linux與正式切換證據見本節末。

原先只從前後快照推算位移，會漏掉連續玻璃的中間格、碰撞推回原點、出界淘汰及跨終點；撞入占用格時骰子modal又先於地圖動畫開啟。引擎現在另提供公開 `motions` journal，每個group含單調遞增id、原因kind及公開car／player ID與from／to座標。同group同時位移，group之間按順序演出；最多64 groups／128 transfers，超限移除完整最舊group。起跑from允許x:null；出界／終點保留嘗試落點，地震預置座標不重複記錄，重開清journal但serial不歸零。view逐層深拷貝，沒有secret。journal不新增HTTP、伺服器timer、log事件或額外game version增量，沿用原操作回覆及輪詢，規則結算仍由伺服器裁決。

| 項目 | 候選呈現及實作 | 已有證據與限制 |
| --- | --- | --- |
| 單步／多格與強制位移 | `race-movement.js`消費journal，普通移動、玻璃、油漬、碰撞推移、打滑、暈頭轉向依序滑動，每格240ms；地震group全部車並行。SVG presence重繪保留elapsed及尚未播完的順序。 | 真引擎回歸包含撞入後明確accept才推移、推回原點、連續玻璃、12車地震及過時preplaced拒絕；控制器回歸驗順序、重繪及同時位移。 |
| 跳躍／拋飛 | 跳台與爆炸使用弧線關鍵影格；只演實際起點與落點，中間不追加規則檢定。 | 引擎／控制器回歸通過；本節尚無這兩類的Chrome實玩證據。 |
| 淘汰／終點與直升機 | 對已淘汰但剛有位移的車保留短暫motion ghost，抵達後才消失；跨既定終點時保留確認的視覺落點。直升機從入口或真舊位置滑向部署格。 | 引擎／控制器覆蓋出界、致命地形、終點attempt及chopper；Chrome地震出界及終點實測已補；chopper仍以引擎／控制器回歸驗證。ghost不改權威存活狀態或提供合法操作。 |
| 道路換片 | 先完成車輛位移，再將舊／新道路視口平移480ms，避免boardMin更新使整排車突然跳位。 | 控制器驗收有road pan；Chrome已錄製車輛先前進、道路再向左平移及最後三段道路。 |
| 下一步與必要資訊 | 移動結束後才開dice dialog、顯示下一步controls／winner及推進教學畫面。等待期間鎖遊戲動作，保留輪詢、玩家名單與聊天更新；沒有延遲伺服器規則或靠動畫回呼推進引擎。 | render／教學與骰子回歸通過；主agent背景Chrome已截圖觀察碰撞接近後才出現modal，Chrome另驗碰撞推移、玻璃連滑、六車地震（含一車出界）、道路换片及終點。 |
| 重連及個人動畫設定 | hydration／重連、頁面隱藏、reduced-motion及停用動畫直接同步最新呈現，不補播舊journal；取消等待時解除本機操作鎖並清理動畫。 | 控制器及render回歸通過；不把來源／VM斷言當作所有瀏覽器情境實測。 |

截至候選驗收，Windows完整 **591/591** 通過（失敗／取消／跳過0，約13秒）。新引擎回歸 `tests/race-displacements.test.js` 11項，另有控制器、render順序、教學及延後骰子呈現的回歸；完整計數之後如有增量，以後續驗收記錄為準。背景Chrome在隔離localhost3199、正常1794×1010 viewport用合成帳號與受控地形，實際點擊並錄製碰撞接近→modal→擲骰→推移→下一步、玻璃三段滑動、六車地震含出界、車先前進再道路換片及抵達終點才顯示勝利。私有QA截圖為 `work/displacement-*.jpg`，時間紀錄 `work/displacement-frames.json`，29張實際碰撞截圖匯出 `work/race-displacements-demo.gif`。Chrome抓到route preview插入非直接父層的NotFoundError；已改為同一race-world父層並補真巢狀DOM限制回歸，後續頁面不再出現新錯誤。這是受控本機真畫面觀察，正式站另驗版本及資源；不是GPU／FPS量測。

正式驗收補充（2026-10-06）：程式提交`a27dd1fec3b98f07365b3911a2a10f6c87304d67`，乾淨受測提交建立本地annotated `v1.1.2`；未push／未發新PR。Windows／Linux Node22.22.1均 **591/591**（失敗／取消／跳過0，Linux約114秒）。隔離副本schema13、15表逐列一致、integrity ok、外鍵0、啟動成功。發布包SHA-256 `26549b8bf8ec1a332a795fa049436d5e42ab7c44a053eeb62e26f5ffe0585a8b`，排除本機私人偏好與QA檔案。SQLite線上備份及持久檔案另存`shared/backups/pre-party-a27dd1f-20261005T175523Z`（UTC），不宣稱同一原子時間點。

切換前確認房間數0，正式current為`releases/a27dd1f`，PID39316→40729；service及tunnel active。schema仍13、7帳戶全欄位逐列一致，既有session有效；匿名/api/version 200且no-store，race HTML、race.js、race-movement.js、race-dice-dialog.js及共用header資源一致。背景Chrome正式設定實際顯示「版本 v1.1.2」，證據`work/race-displacements-production-version.jpg`。位移GIF及受控遊戲截圖來自隔離localhost3199，正式站驗版本／資源／帳戶，不把本機動畫錄影冒稱正式站實玩。Linux證據`work/race-displacements-linux-tests.log`；後續純驗收文件提交不移動tag。

本機QA收尾：隔離fixture曾將未入場車的y設成null，與正式引擎的-1不同，留下的房間在90秒閒置代走時產生terrain錯誤。錄製階段操作車位置有效，位移證據與全套測試不受此fixture問題影響；私有fixture已改回y:-1，測試服務已正常關閉。此錯誤沒有據以改動正式規則，也不把隔離環境宣稱完全零伺服器錯誤。

## 2026-10-06：逐格滑動修正，正式 v1.1.1

多格規則先前已沿各格結算，但視覺動畫被總長900ms上限壓縮，SVG重繪又取消動畫；從起跑區出發也缺少原座標。這一筆在v1.1.1發布時取代2026-10-05的動畫實作說明；其後續限制已由上節v1.1.2候選修正。程式提交`2eb4104d3732325ac68d2981fadc09826b1c5f55`、本地annotated tag `v1.1.1`已發布至shhuang.cc，未push／未發新PR。

`public/shared/race-movement.js`以伺服器確認的movePath步驟建立WAAPI關鍵影格，每格240ms，八格配置1.92秒；取消總長上限。SVG重建保留起始時間，在同一繪製前恢復elapsed，連續指令接到尚未完成的路徑後方。從起跑區滑入第一格、路線中斷則停在確認位置；消失／淘汰、權威位置衝突、換房、等待、隱藏頁面或關動畫會清理，不重播重連時的舊事件。一般单格也沿用同一移動控制器。

只改客戶端顯示，不加逐格請求／timer，不延遲引擎結算或鎖操作；伺服器規則、路徑選擇及費用不變。減少動態／停用動畫仍直接呈現最新位置，不要求逐格播放。道路事件與車旁效果保持各自原政策；淘汰車不新增幽靈回放，強制位移僅接實際確認的末點，不捏造未記錄的路線。

Windows完整 **554/554**，新增6項回歸涵蓋每格時長及座標、presence重繪elapsed、連續指令接續、中斷與起跑、hydration／重送／隱藏／停用及權威衝突／換房。`release:check --base v1.1.0 --type patch`通過。

背景Chrome在隔離localhost3198用合成帳號、正常1794×1010viewport操作八格路線；真實畫面截圖可見中間位置，觀眾改名造成重繪後仍可見後续移動，終點與剩4點正確。被動Network觀察一次`/api/action` POST，無截斷／待分頁，沒有逐格網路。證據為核准私有QA位置 `work/race-motion-frames/`、`race-motion-frame-times.json`、`race-motion-demo.gif`及`race-motion-network-proof.json`。GIF由實際截圖縮小匯出，動畫中的截圖間隔約100–150ms，不能當作GPU／FPS量測。DOM只讀工具同批的矩形快照未持續刷新，捨棄該數字，不用它宣稱平滑度。

Linux Node22.22.1完整 **554/554**（失敗／取消／跳過0，約114秒）。副本schema13、15張既有表逐列不變、完整性ok、外鍵錯誤0、隔離啟動成功。發布包SHA-256 `13843878858c4b0a19b6175c36d643b9cfdb427fbb5e1ae8e673f7195ec419a5`，無本機私人偏好或QA檔案。備份`shared/backups/pre-party-2eb4104-20261005T172809Z`（UTC）；SQLite線上備份與持久檔案分别保存，不宣稱同一原子時間點。

切換前確認唯一房間只有核准測試帳號與電腦玩家；經正常leave、保存歷史後房間數0。正式目錄`releases/2eb4104`、服務及tunnel active；schema仍13、7帳戶完整逐列一致、外鍵0及integrity ok，既有session有效。公開`/api/version`匿名200且no-store，race HTML、race.js、race-movement.js及共用header與發布包內容一致。背景Chrome正式設定實際顯示「版本 v1.1.1」，證據`work/race-motion-production-version.jpg`。逐格行為的實玩證據來自上述隔離本機房間，正式站做版本／資源與帳戶驗證，未把本機GIF冒稱正式站錄影。

| 分類 | 適用遊戲 | 行為與實作 | 狀態 |
| --- | --- | --- | --- |
| 桌機操作 | 雷霆之路 | 剩餘點數可到達的遠格顯示淺綠虛線框；原相鄰三格保留原亮框及逐格 API。滑鼠／鍵盤焦點預覽同一条線、步數與消耗點數；真正移出或玩法狀態失效即清除，純重繪恢復。 | 完成，VM及Chrome通過 |
| 路徑選擇 | 雷霆之路 | 前左／前／前右鄰接。有界、確定性的共用 planner，以公開資訊優先避開岩壁、車輛、直升機、停止地形、未知危險，再考量火焰、泥地及荒地。風險分數較低優先，其次少耗點、少步；完全平手按固定鄰接順序。 | 已實作、引擎通過 |
| 費用 | 雷霆之路 | 泥地 2 點，其餘 1 點；保留原版最後只剩 1 點仍能進泥地並耗盡的規則。氮氣、公路加速、滑行的點數由原引擎提供，不另消耗骰子。 | 已實作、引擎通過 |
| 權威及重送 | 雷霆之路 | 遠目標只送 car／version／x／y，server 用同一份 masked public state 重算路線。舊版本、錯車、無法到達、非整數／超大目標與客戶端自報 route／path 全部拒絕。接受後 version 改變，重送舊命令不能再走一次。 | 已實作、引擎通過 |
| 中斷與檢定 | 雷霆之路 | 每格沿用 moveEffect／drain，原地形、碰撞、傷害及勝利規則照常結算。任何骰子／決策、隱藏危險揭露、位置偏離、stop、道路換片或回合結束就丟棄剩餘路線。沒有持久待執行意圖，不在 acceptDice 後自動續走。 | 已實作、引擎通過 |
| 流量與範圍 | 雷霆之路 | Hover/focus 本地計算、不發網路；一次遠格點擊只發一次原 `/api/action` POST。v1.1.2候選另在state加入有界motions journal，不新增逐格HTTP、伺服器timer、輪詢或DB schema。 | 原movePath的Chrome觀測為零hover命令／一次POST；新journal與順序驗收見上方候選記錄 |
| 動態資訊 | 雷霆之路 | `movePath`事件保留最多16格實際嘗試步驟、成本與中斷理由；v1.1.2候選以motions還原每段確認位移，期間鎖遊戲動作，抵達後再開下一步。關動畫／背景／重連直接同步，不補播舊路線。 | 舊Chrome預覽／停點證據保留；新碰撞先後及尚待驗收項目見上方，未量測GPUFPS |

## API

原相鄰格仍為 `POST /api/action`：`{code,action:"move",x,y}`。原版法定三鄰格及起跑六格不改。

遠目標為 `POST /api/action`：`{code,action:"movePath",car,version,x,y}`。`version` 必須是目前 engine version；`car` 必須是當前 active 車。既有登入／座位／輪到誰驗證與歷史 transaction 仍在原路由。客戶端無權決定或跳過中間格，preview 不構成授權。

共用來源 `public/shared/race-paths.js` 同時在 Node／瀏覽器使用；只依公開 tile，未揭露危險的真實種類不影響規劃。最多16點／3000個處理狀態、三段道路及下一段邊界，任何 route 最多16格。雷霆教學 HTML 的引擎副本已同步，載入同一 planner；後續改引擎仍需同步副本及執行一致性測試。

## 驗收

2026-10-05 Windows：`node --test tests/race-*.test.js tests/thunder.test.js tests/tutorial.test.js` 最終 **94/94 通過**，其中新增回歸19項。教學引擎副本一致性、原骰子 dialog、地形提示與30場原自動對局也在此組通過。`node --check public/race.js` 及修改檔案 `git diff --check` 通過（既有 Windows LF→CRLF 提醒不影響結果）。引擎agent未跑Linux或操作瀏覽器；Chrome證據由主agent補在整合進度。

後續查到presence-only狀態更新會重建SVG、清除預覽而沒有新pointerover。前端記錄真pointer座標、重建後elementFromPoint確認仍在track才恢復；键盤捕捉原焦點格、新SVG可達且無dialog時恢復，不搶其他控制焦點。新增三項真事件wiring＋render/renderBoard VM回歸，Chrome另一玩家改名觸發重繪亦保留線及焦點。舊版本回覆在清線之前直接忽略。

新回歸涵蓋多步費用／不多耗骰、繞開車輛／岩壁／停止地形、隱藏內容不影響選路、泥地與最後1點、stale／篡改／重送、未知危險截斷、碰撞／油漬／跳台明確擲骰、玻璃強制位移、地雷傷害、道路换片／終點、公路／氮氣／起跑，以及 Node/瀏覽器相同路線。VM 驗了真實 preview helper 的 SVG 層／文字與指令選擇，沒有以字串斷言代替這些操作。

## 限制

- 預覽不是安全保證。未揭露危險可能增加費用、停止或淘汰；即使是安全道路，首次揭露也取消餘路，讓玩家依最新資訊重新選擇。
- 不預測下一段尚未產生的道路；到邊界更新道路後重新選路。可能已走部分路線而不是抵達原遠目標；實際停點／剩餘點數由 server 回覆決定。
- 已知會變更位置／需要檢定的格子可作目標，不作中途格。甩尾可穿車仍可逐格操作，planner 保守不選車輛格作中途站。
- 每格進入仍使用原引擎的效果順序；輸入一個遠目標不提供停止移動、免除剩餘點數或略過擲骰的能力。
- 本批沒有新增房間續局持久化、規則選項或新遊戲地形，也沒有修改共看、共用 shell／動畫政策及音效偏好。
