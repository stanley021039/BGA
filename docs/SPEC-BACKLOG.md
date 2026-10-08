# 規格 backlog：目前功能與未完成項

更新日期：**2026-10-08（Asia/Taipei）**。本批 **v1.16.0 候選**已實作 B02／B04／B05／B06 與 B03 的 unit 支線，正式部署／最終發行驗收待主 agent；正式基線 **v1.15.1**。固定 source 與實績以 [成就單位進度](ACHIEVEMENTS-UNIT-PROGRESS.md) 最新節為準。
範圍：[ANIMATION-ASSET-PLAN](specs/ANIMATION-ASSET-PLAN.md)、[ACHIEVEMENTS-AND-RECORDS](specs/ACHIEVEMENTS-AND-RECORDS.md)、[AGENT-UPGRADE-ROADMAP](specs/AGENT-UPGRADE-ROADMAP.md)，另列主agent考慮的[CUSTOM-BARRAGE-FRAMES](specs/CUSTOM-BARRAGE-FRAMES.md) Stage A依賴。
最初盤點為唯讀基線 2a2aec7／正式 v1.14.2，保留為歷史；本次按已實作 source 及 focused 回歸更新狀態，未由文件編輯者部署。下列 QA 限制不由歷史 suite 數量推定全部通過。

主agent最終更新：B01 Stage A已發布正式v1.15.0／f4cbdfa，Windows與Linux各1,432、有限背景三席／五入口／桌機手機及公開25資源通過，固定source／完整正式與QA限制以 [內建彈幕框進度](BARRAGE-FRAMES-PROGRESS.md) 最新節為準；下面「基線缺口」保留盤點歷史，B09上傳／收藏仍未實作。

## 已實作：不再當作缺功能排程

| 舊spec／roadmap項目 | 目前碼證據 | 最新證據／狀態 |
| --- | --- | --- |
| A00／D01／roadmap1：公開畫猜結果、跨輪回看／收藏context | src/games/draw-guess.js:13,147–174：resultId/gameRunId、凍結result＋canvas，保留8公開輪；src/app.js:429,447–455結果讀取／綁result儲存；public/shared/draw-results.js管理快照／儲存。 | 功能已在現版。原[402項進度](DRAW-REVIEW-MOTION-PROGRESS.md)的「未部署」是歷史；後續[畫猜發布](DRAW-TIMED-PLAYBACK-PROGRESS.md)等沿用此功能。房間RAM保留8輪與永續勝場是不同範圍，不要求改成無限回看。 |
| PL-02／D02：等待／離線／猜中提示、收藏ACK | draw.js名單與shared/draw-results.js:150成功後confirm；猜中／回看結果具原有狀態。 | 已實作；不是要重新加入全頁常駐「已連線」。原生跨輪／收藏證據留原進度，未測其他硬體另列QA。 |
| A01／A02／R02／roadmap4：共用gate、彈幕開關、busy/error／reduce／hidden去重 | public/shared/motion-policy.js:3–69：prefs、createGate、4lane、不排溢出／disconnect；game-shell.js:72–83動效與清理；ui-notifications.js:51,77通知與earned tracker。 | 已實作且[UI patterns v1.12進度](UI-COMPONENT-PATTERNS-PROGRESS.md)補上成就通知／短粒子；原「通知尚無共用政策」過時。密度自選是研究候選，固定四軌與開關已存在。 |
| G01／G02／M01／P01視覺層：收禮／結算／聚合／下注動效 | gift.js live gate、入場／總分；majority.js 聚合及公開觸發；app.js 籌碼與攤牌。 | 既有動效已實作；G02／M02 六枚趣味條件已進本批候選 B05，poker 精確勝場仍缺。不能單憑動畫說成就完成。 |
| R01及粒子候選：同步骰子、車旁FX／氮氣 | race-dice-dialog.js／race-dice-webgl.js權威mask與立體骰；game-fx-layer.js及race-vehicle-effects.js公開event、移動anchor／連續尾焰。 | [骰子v1.13](RACE-DICE-WEBGL-PROGRESS.md)、[精修v1.14](RACE-FX-VISUAL-REFINEMENT-PROGRESS.md)已发布；原「YouTube／粒子仍只是研究」不適用現況。原生hidden／某些連鎖／FPS未驗是QA，不是缺renderer。 |
| roadmap5：YouTube單端嵌入、多人同步／控制 | public/shared/table-watch.js／table-media.js、src/media/room.js:14,133：共享current／queue／server anchor／room instance。 | [共看](YOUTUBE-WATCH-PROGRESS.md)＋[統一媒體v1.8](UNIFIED-ROOM-MEDIA-PROGRESS.md)已實作／發布，後續尺寸亦已修。跨設備／弱網／真拒播等仍有限QA；不重做播放器。 |
| roadmap6：backup／dry-run／restore CLI與管理UI | src/data/transfer.js、src/data/validation.js、src/data/ui.js、tools/server-data-ui.cjs與transfer tests。 | [移轉進度](SERVER-DATA-TRANSFER-PROGRESS.md)與後續發布保留功能；「尚未做CLI」已過時。外站取代／合併、正式多主DB是另外需求，不能把未切外站資料寫成CLI未完成。 |
| 成就 metadata／收藏冊分類 | src/achievements/catalog.js 13 枚完整定義；store.list 保持 id／unlockedAt；public/achievements.js 依 API metadata 分類。 | B02 本批候選已完成程式，不改原五枚 ID／名稱／日期／來源。正式／最終 UI 驗收見成就進度；自選公開展示仍未做。 |

## 實作狀態與仍缺功能：可拆批次及前置條件

本批已選 B02、B03 unit、B04–B06；其餘 P1 是後續規劃，不把所有研究候選一次開工。表中「已實作」不等於已部署。

| ID／優先 | 可獨立交付範圍 | 現在缺口／source證據 | 依賴與完成條件 |
| --- | --- | --- | --- |
| B01／已完成 | 客製彈幕框 **Stage A**：預設＋三種本站內建框、選框／個人顯示、長文與軌道尺寸 | CUSTOM-BARRAGE-FRAMES:68–72；歷史盤點基線game-shell.js只建DOM bubble，motion-policy只有既有四lane／開關；当時没有選框、frame id／內建frame樣式契約；現v1.15.0已交付，詳最新進度。 | 已完成，無新DB或上傳；保原8秒／減動／離房、不改角色表情；大框按實際高度避疊，改框不跳動已建立訊息。與achievement ledger無依賴。 |
| B02／已實作，待正式驗收 | 成就 metadata／收藏冊分類 | catalog.js 13 枚具 id／achievement_id、game、title／description、rule_version、condition_key、icon_key、private／enabled；前端按六種遊戲／探索分組。 | 原五枚記錄保留，新增八枚有本批 predicates；未增加自選公開展示，不需完整 win ledger。 |
| B03／unit 已實作；match／outbox 待做 | 權威單位／凍結帳號映射／持久處理 | schema17 processed_unit_events＋achievement_progress；store.processUnit 同 transaction 記 receipt／進度／授獎。未建立 game_results／match_participants／processed_results 或完整 wins ledger。 | 開輪映射、normal／interrupted／abandoned、purpose／source 與 UUID 指紋；映射不足 interrupted，test／tutorial 不授。已提交重播／重啟去重；RAM pending 在程序存活、刪房後可重試，**程序崩潰前未提交者不能恢復**。永久 outbox／JSONL 與 DB reconciliation 留後續。 |
| B04／已實作，待正式驗收 | draw-first-round＋all-first-table | draw 引擎 accepted stroke／guess 與正常單位，app callback 接 processUnit，永久一次授予。 | clear／undo 不抹合法參與；artist 中斷不發，已合法完成者不撤銷；不能只看最終畫布或當下名單。 |
| B05／已實作，待正式驗收 | 六枚 draw／gift／majority 趣味徽章 | units.js predicates＋三引擎 immutable minimal flags；六個新 ID 已入目錄。 | 合法作畫／猜中、正式完成全部收禮確認的 twins／positiveWish、正式 groups allSame／tiedLargest；不存原答案／喜好，動畫或 click 不授獎。 |
| B06／已實作，待正式驗收 | all-two-tables 探索 | progress 每 user／achievement／rule_version／game 一列，引用首次有效單位；五款新合格單位可累積不同 game。 | 同 transaction／receipt 去重，不由舊徽章或名字／archive 回填；與入門、永久勝場分開。 |
| B07／P1基礎可先拆 | 撲克per-pot winner IDs／split／refund快照 | src/games/poker.js:46,54–55結果按name/amount/hand聚合；多筆results不是同pot平手證據，未跟注款退回不可計win。 | 補immutable pot分類／canonical座位ID與原分配數值一致，不改玩法；可先做server metadata回歸，再接B03。 |
| B08／P1，B03＋B07 | 精確永久戰績與本人查閱／自選公開 | 尚無帳號綁定game_results／participant ledger、wins API／UI與個人公開選擇；history JSONL不是此功能。 | 按各遊戲match/race/hand單位與quality／AI分桶；win＋shared_win、draw／abandoned分開，退出／刪房不回算已凍結結果。poker等B07，其他遊戲可逐款開，不推排行榜／連勝壓力。 |
| B09／P2後續 | 彈幕框Stage B上傳／收藏／分享及Stage C品質 | 基線無frame表、上傳、版本grant／private audience。collection現有角色／畫作不等框收藏。 | 先B01穩定樣式；新schema／PNG decode重存、像素／切線上限、ACL／版本快取、刪除回退／備份還原，再做手機／壞圖／高度壓力。不能把Stage A完成說成完整客製上傳。 |

B02 目錄／分類已有本批程式；通知個人控制及公開展示若另開批次，仍保私人、不曝他人 locked／私密答案。B03 本批刻意限於單位，不把两張表或 RAM 重試稱為永久 match／wins／crash recovery。

本批 focused／移轉證據檔：tests/achievement-units.test.js、tests/achievement-unit-engines.test.js、tests/achievement-pending-retry.test.js、tests/achievement-migration.test.js、tests/achievement-http.test.js、tests/achievements-ui.test.js；既有條件回歸 tests/immersion-achievements.test.js。schema17 新表與全列成就 digest、舊 schema16 空表升級及 encrypted bundle 相容；完整 source／最終 Windows／Linux／原生／正式實績以成就進度為準，不從這份盤點假定已部署。

## 已實作但驗收不足／研究保留：不混入缺功能

| 類型 | 項目與來源 | 下一步 |
| --- | --- | --- |
| QA | roadmap7：真人桌rubric／等待／可及性；現紀錄主要同一agent＋API／背景Chrome，不是不同真人桌。 | 有參與者時補真人多設備／弱網／分歧；不自行宣稱完成，也不阻擋B01開發。 |
| QA | 共看真跨設備／oEmbed／Google拒播、全phase／讀屏／真正200%zoom；UI patterns進度明列有限原生scope。 | 只補對應情境證據，除非重現bug，不新寫一個播放器／dialog system。 |
| QA | 新骰子／尾焰hidden／玻璃→跳台→道路pan、不同GPU／喇叭聽感；兩份RACE進度及GAME-SOUNDS進度保有限覆蓋。 | 真native／硬體條件再驗；配置duration、VM或過去suite不能當GPU FPS／真人聽感。 |
| 研究／非必須功能 | ANIMATION S01等未選Kenney粒子／UI整包、OGA／Henry、Game-icons；docs/prototypes兩個SVG仍孤立。 | 現在已有原創GL／SVG與可讀動效；未採特定素材不是缺功能。沒有新使用用途不為完成清單去購買／下載整包。 |
| 研究／暫緩 | ACHIEVEMENTS P2全桌共同／骰運；erase／repair／fold候選曾因誘因質疑暫緩，部分候選明確否決。 | 不自動註冊成正式badge。先權威accepted dice／participation metrics，再真人比較；否決項不回收為backlog。 |
| 另行決策 | 外站資料取代／合併與正式多server共享權威 | [LEGACY-IMPORT-PROGRESS](LEGACY-IMPORT-PROGRESS.md)是已有相容／預演而未啟用外站來源；[MULTI-ENV](specs/MULTI-ENV-DATA-MIGRATION.md)正式分散式權威尚非現行架構。不要與現成backup CLI或新badge schema混為同一工作。 |

## 建議下一批範圍

B01 已發布；本批 B02／B04／B05／B06 及 B03 unit 已實作，待最終正式验收。接續優先可規劃 B03 持久 outbox／match ledger，B07 撲克 pot metadata 可獨立做；B08 永久戰績待這兩項，B09 彈幕框上傳／收藏仍另批。
不要重做已實作的入門／趣味 predicates，也不把舊「未部署」、P2 未選素材或有限原生 QA 當成新功能缺口。

