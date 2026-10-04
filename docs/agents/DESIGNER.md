# 設計師角色記憶

更新：2026-10-05。先讀 [共用偏好](MEMORY-LEDGER.md)、[記憶協議](MEMORY-PROTOCOL.md)、[玩家成就spec](../specs/ACHIEVEMENTS-AND-RECORDS.md)及 [實際攻防](../research/AGENT-DESIGN-DEBATE.md)。玩家方執筆正式候選採否，設計方提出樂趣、反例修訂、圖案與可判定事件。

## 已驗證與來源

| 類型 | 結論 | 證據／限制 |
| --- | --- | --- |
| 程式事實 | 現有僅gift/majority/poker/thunder四入門徽章及all-first-table；沒有draw hook及持久勝場總計。 | `src/achievements/store.js`。INSERT OR IGNORE持久防同一徽章重發，WeakSet僅runtime處理去重，不能用作新多次紀錄的完整設計。 |
| 程式事實 | 雷霆repair僅己方未淘汰受損車；擲骰按鈕與確認不等同完成駕駛回合。 | `src/games/thunder.js:begin/newRound`；成就需合法before/after及completedHumanTurn，不以UIclick判定。 |
| 程式事實 | poker results聚合不同side pot後只保留name/amount/hand；多結果不是同pot平手證據，暱稱也不是持久identity。 | `src/games/poker.js:settle/view`。共享勝利須server保留per-pot winnerIds、返還／平手分類，未實作。 |
| 討論結果 | 0分羞辱、碰撞次數、少數答案、非必要重擲相同值不列首版；禮物巧合從3份改2份讓3人桌也可成立。 | player_research實際v2及設計回應；gift單件無0分（3/2/1/-4/-1），錯誤初稿保留補正；每項採否／未定在攻防文件，不虛構一致投票。 |
| 實玩觀察（轉述） | 畫猜錯過8秒揭曉後沒有上一輪回看／收藏入口。 | 主 agent2026-10-05回報；結果快照P0先於成就演出。 |

## 設計推論與方法

趣味来自正常遊玩中的巧合、自嘲與共同時刻；不用別人輸掉、故意拖延、断線、灌投稿、隱私披露或不利操作換徽章。條件即使只在解鎖後公開，仍可能被看見後誘導策略，不能把「私人」當萬用免責。

先提出名稱＋預期樂趣＋權威predicate＋誰獲得＋圖案，再交玩家找反例、程式核對證據。記錄提案→反駁→修訂→採否，不以agent人數投票。正常勝場／共享勝利與幽默徽章分開，不增加XP、排行榜、能力、每日任務或催促同桌的桌上進度。

入門正常有效參與先補齊畫猜；同條件不塞兩枚徽章，趣味名稱可作皮膚或收藏描述。玩家v3補正「跨桌搬零食」為2款不同遊戲正常有效完成，門檻不同於第一桌，可列P1探索候選；設計方接受。低信心的erase/repair/特殊fold留P2真人觀察；不為每款必須有兩項就把兩項都排成實作。新圖案不能暗示還未確認的condition已成立。

## 假設與待驗證

- 2份同禮物、全員同頻是P1採用候選；4顆原始骰全1及全桌有效操作列最終玩家spec的P2研究，尚無真人偏好／頻率數據。
- 幽默名可能因不同朋友群語境讓人尷尬，玩家可選靜音／不展示是提案，現有store沒有此設定。
- 畫者有效stroke、guess.correct、dice accepted snapshot、per-pot winnerIds、持久gameRunId等predicate需求要程式方定義，不接受客户端或暱稱回推。

## 後續與授權界線

玩家方完成 [成就與紀錄](../specs/ACHIEVEMENTS-AND-RECORDS.md)，主 agent整合roadmap。程式方先做權威資料／冪等／正常結算，再由美術與動畫方套展示。原型與研究文件不表示已整合、已上線或獲得新的發布授權；引用Steam等平台資料也不是替本專案決定遊戲規則。
