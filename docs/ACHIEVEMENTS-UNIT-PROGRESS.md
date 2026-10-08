# 成就單位與收藏冊進度 — 2026-10-08

目前：v1.16.0 程式候選完成，Windows 最終全套 1,518／1,518 通過（fail／cancelled／skipped／todo 皆 0），等待固定提交、Linux 全套與正式驗收。上一次正式版為 v1.15.1；本檔後續正式紀錄才是部署證據。

## 交付範圍

| 分類 | 已實作 | 判定邊界 |
| --- | --- | --- |
| 定義／收藏 UI | 保留原五枚；共十三枚，按六組遊戲／探索分類，遊戲與解鎖狀態篩選 | 依使用者最新指示以高亮區分取得狀態，卡片不重複顯示解鎖字樣；私人收藏的名稱、短條件、取得日期、類型可讀，讀屏保留狀態。內部 ID／規則版本留在 API，不占玩家介面 |
| 畫猜 | 畫猜初登場、靈魂畫手，有人懂、字幕組準時上班 | 正常揭曉、合法筆畫／猜測；畫者缺席／離開為中斷。清空／復原不刪已接受筆畫證據，重送不增加資格 |
| 送禮 | 心意撞車、願望清單有回音 | 全部收禮者確認後正式 entries；同 giftId 至少兩份，正向排名 great/good/ok。noWay／未排名不算願望；收禮中移除玩家不冒稱全部確認 |
| 同頻 | 同頻不用 Wi-Fi、訊號撞成平手 | 使用官方確認分組與有效答案；同組至少三人全部回答，平手至少兩組且每組至少兩人。review 預覽不授予 |
| 探索 | 跨桌搬零食 | 正式有效操作完成兩種不同遊戲單位；持久保存首次遊戲類型，不從舊徽章日期倒推進度 |
| 原牌局／賽車入口 | 原 intro 條件、名稱、日期保留；往後有效單位也可計探索 | 真人合法牌局決策／有本人操作且完成的回合，正常結算後處理；沒有新增勝率或輸家徽章 |

## 事件、帳號與移轉

- schema 17 新增 `processed_unit_events`、`achievement_progress`；舊 `user_achievements` 欄位與已授予事實保持相容。單位事件、首次探索與新授獎在同一 SQLite transaction 提交。
- 每局／單位使用 UUID，開始時凍結 canonical user／seat 映射。姓名、房號、房間 version 不作持久身份；映射缺失／不完整時，成就單位記為 interrupted，不晚補身份。
- canonical 帳號鍵是資料庫原始 user ID，包含合法大寫 UUID 的既有／匯入帳號；不因 UUID 格式正規化而改寫帳號參照。event／match UUID 自行正規化，帳號去重仍辨認 UUID 大小寫變體。
- 持久 facts 只存最小資格旗標、單位與官方統計，不存畫作、題目、原始答案、禮物 ID／喜好、手牌或 session。API 收藏冊不暴露其他玩家的私人資料。
- 同 UUID 同 facts 重播不重授、不增加進度；同 UUID 不同 facts，或同對局／單位序號換 UUID，均拒絕為衝突。只有 production／game_server 正常單位可授予；test、tutorial 與中斷只存 receipt。
- 三引擎先凍結 pending 再通知，成功 commit 才 ack。每房 pending 上限 256；到達上限時下一輪開始前拒絕，不淘汰未存事件。應用層待處理隊列保留已刪房的事件並重試，4096 筆以上停止建立／開始新房間以限制故障積壓。
- 新備份摘要含三表有序 rows 的 `achievementsSha256`；還原必須保持。僅已認證、maximumSchema／DB schema 均早於 17 的舊描述可缺此新增欄位；新描述不能省略。單位 facts／fingerprint／欄位、帳號參照與探索資格皆作語意驗證。
- 匯入歷史是 archive，不掃描歷史重授；舊五枚不改日期或來源。schema 16 升級只加兩張空表，不捏造舊探索紀錄。

## 已驗證與待驗證

有針對性測試涵蓋三引擎、store、真 HTTP、migration／加密備份還原、前端篩選與設定用途。HTTP regression 已驗正常 draw／majority、畫者離房、中斷不授、restart／去重、poker test/tutorial 不授，及資料庫失敗後刪房仍由程序內隊列補寫一次。

背景 Chrome 隔離三帳號已用原生頁面開始畫猜、選題、持筆與兩人猜中。畫者取得入門／有人懂，猜題者取得入門／字幕組；取得日期可讀。1794×1109、1280×720、390×844 無水平溢出，主文字 16px、篩選 44px，未見成就頁 console error。臨時 viewport 已清除。六個背景 rAF 樣本中，畫者與觀看者活動墨跡逐步增加、沒有減少；背景分頁會節流，這不是前景 FPS 基準，也不以終圖一致代替完整途中驗收。

本地私人證據在 `work/achievement-preview-*`、`work/achievement-held-drawing.json` 與測試 log；不納入發行包。正式來源、測試數與公開站證據等待下方正式紀錄。

## 尚未交付

- B03 的整局 `game_results`／`match_participants`／`processed_results` 與跨程序 persistent outbox；本版已提交 receipt 可跨重啟去重，但未提交 RAM pending 在程序當機時仍可能遺失。
- B07 的 poker 各 pot 明細與可靠共同勝利分類。
- B08 的永久勝場、本人战績檢視與自行選擇公開徽章；目前沒有勝率排行榜、公開個人履歷或 XP。
- 未核准的 P2 趣味徽章不在本批啟用。

規格與後續清單：[成就與戰績](specs/ACHIEVEMENTS-AND-RECORDS.md)、[Spec backlog](SPEC-BACKLOG.md)。
