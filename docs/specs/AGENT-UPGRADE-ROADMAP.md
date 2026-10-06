# Agent 強化：研究成果、進度與後續實作

**2026-10-06音效師追加**：已建立第七個角色入口 [SOUND-DESIGNER](../agents/SOUND-DESIGNER.md)、[素材網站查核](../research/SOUND-ASSET-SOURCES.md)及 [五款遊戲音效盤點](GAME-SOUND-PLAN.md)。候選先從畫猜輪次／本人猜中、雷霆骰聲／公開動作開始；其他遊戲也列出時序、私密資訊與密度條件。此批僅文件研究，沒有採用新音檔或發布新遊戲程式。以下2026-10-05狀態為歷史，其他功能現況以 [最新發布](../RELEASE-PROGRESS.md)為準。

**接續進度（2026-10-05）**：第1步 PL-01／PL-02 與第4步共用動效政策、小批送禮／收藏動效已由 **93d7a84** 完成；新增使用者 U27 已猜中卡勾選高亮。Windows／Linux各402項＋背景Chrome驗收，見 [完整紀錄](../DRAW-REVIEW-MOTION-PROGRESS.md)。第6步完整備份／還原及管理者UI已在 [PR #31](https://github.com/stanley021039/BGA/pull/31)，見 [移轉文件](../SERVER-DATA-TRANSFER.md)。這些取代下方研究批次的未實作狀態。第2／3步 persistent勝場與趣味成就、第5步YouTube、第7步真人桌校正仍待執行；不是正式資料已搬移或程式已部署。

更新：2026-10-05。工作分支 `research/agent-memory-and-next-stage`，程式基線為 PR #30 的 `0aa6c75`；本輪未修改正式遊戲、未部署、未再發 MR。先前介面與雷霆改版的 MR：[PR #30](https://github.com/stanley021039/BGA/pull/30)。本頁整合本輪研究、實玩與孤立原型，不把提案寫成現有功能。

## 成果與狀態

| 使用者要求 | 已完成內容 | 文件／成果 | 狀態與限制 |
| --- | --- | --- | --- |
| 本地長期記憶 | 六個角色入口、共用偏好、證據分類、更新與攻防流程；根目錄 AGENTS.md 指引後续 session 讀取相關角色。 | [角色索引](../agents/README.md)、[記憶協議](../agents/MEMORY-PROTOCOL.md)、[使用者偏好](../agents/MEMORY-LEDGER.md) | 已落檔；是可讀取的專案記憶，不是模型權重訓練。每輪仍需核對現況。 |
| 玩家長評與實玩 | 7 個來源網域，6 位有跨篇發表證據的作者；八維度、0–4 錨點、證據等级。以三席畫猜測等待、跨輪閱讀、刷新與畫者失聯。 | [評論評分規則](../research/PLAYER-REVIEW-RUBRIC.md)、[實玩評估](../research/PLAYER-PLAYTEST-ASSESSMENT.md) | 已研究／實測；已測 38.75／65，覆蓋65%，未測保留NA。主 Chrome UI＋兩席 API，由同一 agent 操作，不能代替真人滿意度。其他遊戲本輪為 code／歷史盤點。 |
| 動畫／素材／手刻 | 五個素材供應商的具體項目、授權與採否；保留既有動效，新增候選含狀態、reduced-motion、重連及讀字時間。設計／程式討論後產出兩個原創 SVG 動效。 | [動效素材 spec](ANIMATION-ASSET-PLAN.md)、[原型](../prototypes/motion-art.html)、[Node 生成器](../../tools/prototypes/generate-motion-art.cjs) | 研究及孤立原型完成；新素材未下載／購買，沒有呼叫圖片模型，沒有接正式遊戲。 |
| YouTube 共看與時間軸 | 官方 IFrame API 可行性、提案者控制權、host 接管、server anchor／revision 同步、各端同意播放、失敗與政策限制。 | [共享 YouTube spec](SHARED-YOUTUBE-PLAYER.md) | spec 完成；尚未實際嵌入影片或驗證多端同步。V1不信任client duration，不承諾逐幀一致。 |
| 無厘頭成就及獲勝紀錄 | 20 個候選的玩家／設計攻防，首批7個可規劃候選；可靠帳號身份、正常結果、平手、品質標籤及事件去重。畫猜入門缺口另列。 | [成就與戰績 spec](ACHIEVEMENTS-AND-RECORDS.md)、[真實討論記錄](../research/AGENT-DESIGN-DEBATE.md) | spec 完成；不是已發放徽章。候選採用與優先順序以成就 spec 最終表為準。 |
| 多 server／DB 移轉 | 盤點 SQLite BLOB、音樂、community、JSONL history、RAM 房間；完整一致 bundle、驗證、演練、切換及 rollback。亦提出正式多機共用的中央DB／房間權威方案。 | [多環境資料移轉 spec](MULTI-ENV-DATA-MIGRATION.md) | spec 完成；未操作正式DB。預設「開發／測試隔離，正式單一權威」是尚未獲使用者確認的工作假設，不能替代正式多機需求。 |

## 本輪最優先缺口

畫猜揭曉只留短暫窗口。實測在揭曉剩2秒時開遊戲說明，背後換輪，關閉後上一輪畫作／答案／收藏入口均消失。這是 **PL-01／P0 公開結果回看缺口**，不是已證明錯存其他輪畫作。改善必須先保存不可變公開結果及画布快照，收藏綁定該結果，再提供固定「最近結果」入口；不能靠多停幾秒動畫代替。

名單應直接解釋誰未完成、誰離線。這是相關玩家的異常狀態資訊，不恢復使用者已要求移除的全頁「已連線」。畫者15秒無心跳後揭曉的政策先做真人弱網／切頁測試，不能單憑受控失聯就斷言時間一定不適合。

## 後續實作順序與驗收

以下是依賴與可驗收範圍，並非本輪已實作項目。

| 順序／owner | 工作 | 前置條件 | 完成判定 |
| --- | --- | --- | --- |
| 1／程式＋玩家 | PL-01公開結果快照／回看／收藏；PL-02直接可見完成與離線狀態。 | 明確区分當前秘密與已公開結果，限定保留數量。 | 開說明跨輪、兩輪後收藏、保存延遲／重送／reload仍指向正確畫作；名單不藏重要狀態。 |
| 2／程式＋資料＋玩家 | 持久 match identity、帳號映射、unit／result事件與正常結算ledger。 | game_results／match_participants／processed事件模型，跨文件寫入 outbox；定義 abandoned 與 quality_flags。 | 同事件重送、重連、DB匯入均不重算；平手與主動離房一致；開發測試不灌正式勝場。撲克可靠勝者資料另補。 |
| 3／設計＋玩家＋程式 | 畫猜入門與成就 spec 首批7候選。 | 第二步伺服器事件可可靠判定；玩家檢視誘因。 | 無需故意拖延、送負分禮物、撞擊他人或灌投稿；徽章可不公開，胜利紀錄獨立。 |
| 4／動畫＋美術＋程式 | 共用首次／重連／hidden／減少動態政策，再按動效表小批實作。 | 第一、二步事件 identity；保留所有關鍵文字與玩家資訊。 | 只新事件播一次，失敗／重連不假成功；靜態仍可理解；不阻塞操控、不搶焦點。原創圖案先在24／48／64尺寸查可辨識性。 |
| 5／程式＋玩家 | YouTube 真實單端嵌入 proof，再實作多端時間軸與權限。 | 官方條款／referrer再次核對，足夠dialog尺寸，各端主動加入。 | 兩個不同設備驗加入、pause／seek、接管、重連、不能嵌入、autoplay拒絕／廣告；其他玩家不能偽造控制或全桌ended。 |
| 6／資料＋程式 | 用不含正式認證／個资的fixture做 backup／dry-run／restore／rollback CLI。 | 確認多server目的是隔離開發或正式共用；維護柵欄與schema上下界。 | digest、BLOB、音樂、JSONL與owner關係一致；故障注入可回復，切換後新寫入不丟；禁止複製活躍SQLite檔作多主合併。 |
| 7／玩家＋設計 | 不同真人桌校正 rubric、等待／可及性與新功能取捨。 | 可重現版本與測試任務，不在正式場中灌徽章。 | P1／P5等未測維度有真人證據；保留分歧，不把評論者偏好當所有玩家需求。 |

## 原型驗證紀錄

- Node 語法與生成內容／SHA檢查通過；LF／CRLF兩種生成器來源在隔離目錄產出的四檔bytes完全一致，CRLF輸出也能通過校驗。證據 `work/prototype-eol-qa.json`。
- 主 agent 使用同一 Chrome 背景操作兩個「播放一次」按鈕，狀態都由播放中到完成，無自動循環。配置為700ms；沒有量測精確牆鐘動畫時長。
- 正常1767×1196視窗與390×844暫時尺寸檢視：兩按鈕44px高，窄版頁寬375px，沒有水平溢出；暫時尺寸已還原。減少動態僅檢查程式，尚未瀏覽器模擬。
- 兩張 SVG 經本地 raster 檢視無裁邊。原型沒有外網請求、YouTube IFrame 或正式server事件，所以不宣稱共看／成就功能驗收。
- 私有證據 `work/agent-prototype-proof.png`、`work/original-motion-icons-qa.png`；帳密／cookie／短期房號不進公開文件。
- 23個本輪交付檔的本地連結、空白、私有憑證排除及原型script語法檢查通過；正式 `src/`、`public/` 沒有變更，因此未把前輪226個測試重跑稱本輪功能驗收。
- 收尾時兩個專用畫猜房間均已回404；背景保活與原型預覽server已停止，原Chrome分頁留在正式站首頁。

## 下一輪讀取

先從 [角色索引](../agents/README.md) 與對應 spec 讀起。依 [記憶協議](../agents/MEMORY-PROTOCOL.md) 更新觀察、未解問題及被取代的決策；具體實作後才能把本頁狀態改為完成。素材授權、YouTube政策及runtime能力要在真正採用時再次確認。
