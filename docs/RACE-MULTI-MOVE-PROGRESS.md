# 雷霆之路：多格移動與路徑預覽

日期：2026-10-05。分支 `feat/party-content-and-race-paths`；本地實作，未 push／PR／部署。此項承接使用者「一次走多格、滑鼠移過去先顯示路線、盡量避開障礙，仍能一格一格走」要求。主 agent 背景Chrome已完成單步＋連續五步、hover零命令／遠格一個POST、键盤焦點及狀態重繪保留；不是真人樂趣或GPU效能量測。詳 [整合驗收](PARTY-UPGRADE-PROGRESS.md)。

## 2026-10-06：逐格滑動修正，正式 v1.1.1

多格規則先前已沿各格結算，但視覺動畫被總長900ms上限壓縮，SVG重繪又取消動畫；從起跑區出發也缺少原座標。這一筆取代上述動畫完成狀態的實作說明，程式提交`2eb4104d3732325ac68d2981fadc09826b1c5f55`、本地annotated tag `v1.1.1`已發布至shhuang.cc，未push／未發新PR。

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
| 流量與範圍 | 雷霆之路 | Hover/focus 本地計算、不發網路；一次遠格點擊只發一次原 `/api/action` POST。伺服器只在該指令重新規劃，不增加 state 欄位、timer、輪詢或 DB schema。 | 完成，Chrome觀測零hover命令／一次movePath POST |
| 動態資訊 | 雷霆之路 | `movePath` 公開事件含最多16格實際嘗試步驟、成本與中斷理由；移動軌跡沿各格绘製。允許動畫時車輛沿路線移動，不鎖操作；關動畫、背景與換畫面取消局部動畫。 | 完成，Chrome版面／預覽與實際停點已驗；未量測GPUFPS |

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
