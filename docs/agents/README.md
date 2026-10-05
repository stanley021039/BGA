# Agent 長期記憶索引

更新：2026-10-05。這些檔案是後續 session 可讀取、校正與延續的專案記憶；不是模型權重訓練，也不會讓未讀文件的 agent 自動知道內容。專案根 `AGENTS.md` 指引下一個工作回合載入索引及相關角色。

| 角色 | 記憶入口 | 本輪研究／spec | 長期責任 |
| --- | --- | --- | --- |
| 玩家 | [PLAYER](PLAYER.md) | [評論與評分標準](../research/PLAYER-REVIEW-RUBRIC.md)、[實玩評估](../research/PLAYER-PLAYTEST-ASSESSMENT.md) | 把評論變成可測評分，區分新手／熟手、競技／派對需求，指出缺口與反例。 |
| 動畫 | [ANIMATION](ANIMATION.md) | [動效與素材方案](../specs/ANIMATION-ASSET-PLAN.md) | 盤點事件、節奏、資訊傳達、減少動態、失敗及重連。 |
| 美術 | [ART](ART.md) | [動效與素材方案](../specs/ANIMATION-ASSET-PLAN.md) | 查具體素材及授權，定義原創圖案風格與可辨識性。 |
| 設計師 | [DESIGNER](DESIGNER.md) | [成就與勝利紀錄](../specs/ACHIEVEMENTS-AND-RECORDS.md)、[設計攻防](../research/AGENT-DESIGN-DEBATE.md) | 提出趣味方案，回應玩家質疑，定義判定及誘因取捨。 |
| 程式 | [PROGRAMMER](PROGRAMMER.md) | [共享 YouTube](../specs/SHARED-YOUTUBE-PLAYER.md)、原型生成器 `tools/prototypes/` | 以現有架構核對可行性、權限、狀態協議與可驗收行為。 |
| 伺服器／資料 | [SERVER-DATA](SERVER-DATA.md) | [多環境資料移轉](../specs/MULTI-ENV-DATA-MIGRATION.md)、[已實作完整移轉 CLI](../SERVER-DATA-TRANSFER.md)、[驗收進度](../SERVER-DATA-TRANSFER-PROGRESS.md) | 定義權威資料、隔離、備份、遷移、衝突與回復演練。 |

角色名稱是可重用的責任，不綁定某個暫時 agent thread。本輪由 `player_research` 負責玩家及成就 spec、`typography_design` 負責動畫／美術／設計、`layout_design` 負責程式／資料，主 agent 負責實玩與整合。

先讀 [使用者偏好及決策](MEMORY-LEDGER.md)；更新時遵守 [記憶協議](MEMORY-PROTOCOL.md)。後續按 [本輪整合與實作順序](../specs/AGENT-UPGRADE-ROADMAP.md) 分批實作；提案與孤立原型不等於正式遊戲功能。

2026-10-05後續已實作項目另有 [畫猜房間](../DRAW-ROOM-SETUP-PROGRESS.md)、[共用聲音](../SHARED-AUDIO-PROGRESS.md)及 [彈幕／房間設定整合](../BARRAGE-ROOM-SETTINGS-PROGRESS.md)驗收文件；最新正式程式來源 `15af1dd`。研究提案維持各自狀態，下一輪仍需查當前Git及部署版本。

2026-10-05 完整資料移轉第一版程式 `c831e87` 已本地驗收（Windows／Linux 各255项及兩方向 restore／登入），包括原帳戶密碼與權限，未執行正式 migration／部署。最新使用者決策 U17 及接手流程見 SERVER-DATA、MEMORY-LEDGER；研究 spec 中 merge／Postgres 等項目不能混稱完成。

使用者追加 U18 獨立移轉文件及管理員 UI。`2618c4b` 提供 `npm run data:transfer:ui` localhost 表單，結果收合／對齊補充至31c91dd，仍沿用冷移轉與防覆寫政策；Windows／Linux 各259項（UI HTTP4項）與原Chrome背景完整表單流程／重新整理通過，見同一操作文件及進度。

同日最終來源至 `215f82c`：移轉UI及過期狀態競態修正、PR資源修正與最新遊戲功能已整合，Windows／Linux各304項及背景Chrome驗收通過；PR #30更新至1b8c85d，未部署。接手優先讀 [獨立移轉指南](../SERVER-DATA-TRANSFER.md)、[最終進度](../SERVER-DATA-TRANSFER-PROGRESS.md) 與 [PR修正](../PR30-RESOURCE-LIMITS.md)。Gartic無HAR證據，不能推測其協議。

同日後續來源 `e71989e` 整合 PR 程式 `3b19720`：補失敗開局歷史淘汰／故障容量記帳與分批畫布恢復。PR Windows／Linux各279項，本地完整整合Windows323項；沒有本次Linux323項證據。Chrome多人重連／復原／儲存通過，HAR仍待取得；接手讀 [後續複查](../PR30-RESOURCE-LIMITS.md#後續複查失敗開局與重連恢復) 與 [錄製方法](../research/GARTIC-NETWORK-REFERENCE.md)。

同日 U22 後續已由設定 UI 啟用完整 CDP，隱藏內建瀏覽器完成 Gartic 單席 Masterpiece 的實際封包採樣與 HAR 匯出，取代上述「未取得 HAR」狀態。有效操作窗 24 批無 truncated；早期載入缺漏仍保留。畫筆／填色／復原為小型命令，相簿回傳最後剩餘的向量；不能推論其他模式、CPU 或 server 內部策略。詳 [實錄與對照](../research/GARTIC-NETWORK-REFERENCE.md)，raw 與 HAR 只在 ignored work。

最新程式 `e60f853`／本地整合 `7c25c7b` 另修新局 round 1 沿用舊配額：每輪畫布有獨立 canvasEpoch，隔離所有延遲操作／回覆。PR Windows／Linux各286項、本地整合Windows330項及背景重開／填色驗收通過；PR #30已推至 `7f44f20`，未部署。詳 [PR 修正文件](../PR30-RESOURCE-LIMITS.md)。本次沒有重跑本地整合Linux330項。
