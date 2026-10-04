# Agent 長期記憶索引

更新：2026-10-05。這些檔案是後續 session 可讀取、校正與延續的專案記憶；不是模型權重訓練，也不會讓未讀文件的 agent 自動知道內容。專案根 `AGENTS.md` 指引下一個工作回合載入索引及相關角色。

| 角色 | 記憶入口 | 本輪研究／spec | 長期責任 |
| --- | --- | --- | --- |
| 玩家 | [PLAYER](PLAYER.md) | [評論與評分標準](../research/PLAYER-REVIEW-RUBRIC.md)、[實玩評估](../research/PLAYER-PLAYTEST-ASSESSMENT.md) | 把評論變成可測評分，區分新手／熟手、競技／派對需求，指出缺口與反例。 |
| 動畫 | [ANIMATION](ANIMATION.md) | [動效與素材方案](../specs/ANIMATION-ASSET-PLAN.md) | 盤點事件、節奏、資訊傳達、減少動態、失敗及重連。 |
| 美術 | [ART](ART.md) | [動效與素材方案](../specs/ANIMATION-ASSET-PLAN.md) | 查具體素材及授權，定義原創圖案風格與可辨識性。 |
| 設計師 | [DESIGNER](DESIGNER.md) | [成就與勝利紀錄](../specs/ACHIEVEMENTS-AND-RECORDS.md)、[設計攻防](../research/AGENT-DESIGN-DEBATE.md) | 提出趣味方案，回應玩家質疑，定義判定及誘因取捨。 |
| 程式 | [PROGRAMMER](PROGRAMMER.md) | [共享 YouTube](../specs/SHARED-YOUTUBE-PLAYER.md)、原型生成器 `tools/prototypes/` | 以現有架構核對可行性、權限、狀態協議與可驗收行為。 |
| 伺服器／資料 | [SERVER-DATA](SERVER-DATA.md) | [多環境資料移轉](../specs/MULTI-ENV-DATA-MIGRATION.md) | 定義權威資料、隔離、備份、遷移、衝突與回復演練。 |

角色名稱是可重用的責任，不綁定某個暫時 agent thread。本輪由 `player_research` 負責玩家及成就 spec、`typography_design` 負責動畫／美術／設計、`layout_design` 負責程式／資料，主 agent 負責實玩與整合。

先讀 [使用者偏好及決策](MEMORY-LEDGER.md)；更新時遵守 [記憶協議](MEMORY-PROTOCOL.md)。後續按 [本輪整合與實作順序](../specs/AGENT-UPGRADE-ROADMAP.md) 分批實作；提案與孤立原型不等於正式遊戲功能。
