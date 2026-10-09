# #70–79 本地驗收增量

日期：2026-10-09；狀態：Draft／HOLD。僅證據文件更新，未修改 runtime、tests、版號或 schema。

Base／merge-base：`2a5a197094c254d4a16cdec682d441af31692c76`。
本輪受驗 head：`d6101860e479c8e421afe060696236fdfa574724`，與受測 code head `cfd437d0bf797b6b131ee2e53050482a43c64dfa` 之間只有文件差異。
[Draft PR #82](https://github.com/stanley021039/BGA/pull/82)。

## 已完成

- Windows 隔離 Node22.23.3／npm10.9.9 全套1916/1916、fail/skip/cancel 0、exit0；上一輪紀錄仍保留。
- [CI run 37879539800](https://github.com/stanley021039/BGA/actions/runs/37879539800)：test-linux-node22、test-windows-node22 均 completed/success；本次透過 GitHub connector 核對 run 與兩 job 結果。這是 d610186 的 CI，後續文件 head 必須重新核對，不能冒稱已通過。
- Windows Node22 focused：`node --test tests/app-runtime.test.js tests/room-runtime.test.js tests/room-lifecycle.test.js tests/refactor-integration.test.js tests/draw-controller.test.js tests/race-controller.test.js`，41/41，fail/skip/cancel 0、exit0，9806ms。包括兩app隔離、並行close、startup unwind、真SSE drain、in-flight HTTP drain、controller晚結果及取消等測試；不是每項都經過真瀏覽器驗證。
- 瀏覽器：Codex內建瀏覽器，實際1280×720；只用loopback、新暫存SQLite/history/community/music、合成帳戶、externalSideEffectsEnabled=false、marketAutomationEnabled=false、achievementPurpose=test、githubClient configured=false。沒有讀正式.env或使用正式帳號。

## 真瀏覽器矩陣

| 項目 | 狀態 | 實際證據／限制 |
| --- | --- | --- |
| 畫猜兩席滑鼠筆跡／倒數同步 | 有限通過 | 原生drag完成後兩席顯示同線，倒數同83秒；未捕捉完整持筆跨ACK逐幀trace，不能宣稱零閃白 |
| 畫猜鍵盤入口／可讀名稱 | 有限操作 | canvas方向鍵／空白鍵操作、座標回饋及中文工具名称可見；未做完整讀屏／鍵盤矩陣 |
| 畫猜離頁返回 | 有限通過 | 同一瀏覽器頁面轉大廳後Back恢復原席位／本輪畫布與倒數；未證明BFCache命中或單SSE owner數量 |
| 賽跑擲骰／連續三步 | 有限通過 | live三席擲骰，qa_host取得先手；分配3點，逐格1→2→3，途中heading「車輛移動中」、控制鎖定；完成後QA guest行動，紀錄前進3格 |
| 賽跑離頁返回 | 有限通過 | 大廳→Back後保留已走位置／當前玩家；沒有重現第二輪骰子或額外擲骰modal，不推定所有背景恢復／timer數量已驗 |
| 賽跑教學切章／重試 | 有限通過 | 實作1分配移動骰並以Enter確認，走一步後切實作2，重試回到分配狀態；未保證每次切換都落在queued microtask的精確窗口 |
| 手機尺寸／resize／旋轉 | 待驗 | viewport.set(390×844)回傳後既有和新tab的innerWidth仍1280、innerHeight720；已reset。保存的draw-mobile檔案仍為桌機，不能當手機證據 |
| 真實觸控／裝置旋轉 | 待驗 | 使用者回答「沒有，先記錄為待驗」；這不是驗收通過或門檻豁免 |
| 持筆跨ACK、換輪／epoch晚回覆、中途viewer逐點／倒數frame | 待驗 | 有unit／raster／controller回歸，缺完整原生途中矩陣 |
| pending request時斷線、timeout、換session、kick、hidden／BFCache、presence/dice DOM identity | 待驗 | 自動測試不代替native矩陣，沒有完整browser網路／生命週期觀測 |
| 賽跑完整事件／碰撞／射擊／結束流程及音效不重播 | 待驗 | 只完成上述有限live及lesson操作 |

## 證據與中止

本地截圖名稱：draw-artist.png、draw-viewer.png、race-dice.png、race-move-mid.png、race-return.png、race-lesson-reset.png。原始檔留本地驗收目錄，未上傳完整私人日誌／帳戶session。draw-mobile.png為未生效的桌機截圖，不作mobile成功證據。

嘗試用Windows Chrome裝置模擬補驗時，Computer Use工具自動中止：無法可靠辨識當前browser URL以執行政策。遵照工具立即停止該輪操作，未繞過。內建瀏覽器沒有CDP／offline／touch capability；未以頁面注入或另一私有控制協定繞過。

測試listener在上一輪中止後仍存在，loopback限定。後續停止嘗試的write_stdin回報stdin closed，尚未完成graceful cleanup；不可宣稱服務／測試資料已清理。未操作正式服務。

## 審查與剩餘門檻

本輪只讀 combined transport／controllers、race頁面呼叫端、runtime ownership／startup shutdown、lobby factory及教學source checker；上述41項複驗通過。讀取範圍未確認新增缺陷，但完整spec對照及品質／回歸／安全／密鑰兩回合最終結論仍待，不能把本輪partial review冒稱兩輪完成。

Node26的schema3 restore測試 bad port 仍是未解診斷結果；Node22本地與CI通過，不抹掉Node26失敗記錄。後續需保留問題追蹤，不能以mock／skip繞過。

保持Draft／HOLD，未tag、合併、部署、操作正式資料或修改main保護。下一步補可用工具／裝置的native矩陣、cleanup、最終兩輪審查，並核對最終文件head的CI。
