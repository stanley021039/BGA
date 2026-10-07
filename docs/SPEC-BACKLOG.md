# 規格 backlog：目前功能與未完成項

查核日期：**2026-10-08（Asia/Taipei）**。唯讀基線HEAD **2a2aec7**；正式 **v1.14.2／8ae5c4f**。
範圍：[ANIMATION-ASSET-PLAN](specs/ANIMATION-ASSET-PLAN.md)、[ACHIEVEMENTS-AND-RECORDS](specs/ACHIEVEMENTS-AND-RECORDS.md)、[AGENT-UPGRADE-ROADMAP](specs/AGENT-UPGRADE-ROADMAP.md)，另列主agent考慮的[CUSTOM-BARRAGE-FRAMES](specs/CUSTOM-BARRAGE-FRAMES.md) Stage A依賴。
本文件只做source／最新進度對照，未開browser、跑測試、改runtime／版本或部署。下列QA限制沿用實際證據，不由歷史suite數量推定全部通過。

主agent後續更新：B01 Stage A已實作為候選v1.15.0，Windows1,432與有限背景三席／五入口／桌機手機通過，固定source／Linux／正式結果以 [內建彈幕框進度](BARRAGE-FRAMES-PROGRESS.md) 最新節為準；下面「基線缺口」保留盤點歷史，B09上傳／收藏仍未實作。

## 已實作：不再當作缺功能排程

| 舊spec／roadmap項目 | 目前碼證據 | 最新證據／狀態 |
| --- | --- | --- |
| A00／D01／roadmap1：公開畫猜結果、跨輪回看／收藏context | src/games/draw-guess.js:13,147–174：resultId/gameRunId、凍結result＋canvas，保留8公開輪；src/app.js:429,447–455結果讀取／綁result儲存；public/shared/draw-results.js管理快照／儲存。 | 功能已在現版。原[402項進度](DRAW-REVIEW-MOTION-PROGRESS.md)的「未部署」是歷史；後續[畫猜發布](DRAW-TIMED-PLAYBACK-PROGRESS.md)等沿用此功能。房間RAM保留8輪與永續勝場是不同範圍，不要求改成無限回看。 |
| PL-02／D02：等待／離線／猜中提示、收藏ACK | draw.js名單與shared/draw-results.js:150成功後confirm；猜中／回看結果具原有狀態。 | 已實作；不是要重新加入全頁常駐「已連線」。原生跨輪／收藏證據留原進度，未測其他硬體另列QA。 |
| A01／A02／R02／roadmap4：共用gate、彈幕開關、busy/error／reduce／hidden去重 | public/shared/motion-policy.js:3–69：prefs、createGate、4lane、不排溢出／disconnect；game-shell.js:72–83動效與清理；ui-notifications.js:51,77通知與earned tracker。 | 已實作且[UI patterns v1.12進度](UI-COMPONENT-PATTERNS-PROGRESS.md)補上成就通知／短粒子；原「通知尚無共用政策」過時。密度自選是研究候選，固定四軌與開關已存在。 |
| G01／G02／M01／P01視覺層：收禮／結算／聚合／下注動效 | gift.js:153–168 live gate、192–193入場／總分；majority.js:77–93,142聚合及公開觸發；app.js:12–37籌碼與攤牌。 | 既有去重／收禮確認／最後結算／同頻聚合已實作。G02/M02的新趣味徽章與poker精確勝場仍缺，不能因動畫存在說成就完成。 |
| R01及粒子候選：同步骰子、車旁FX／氮氣 | race-dice-dialog.js／race-dice-webgl.js權威mask與立體骰；game-fx-layer.js及race-vehicle-effects.js公開event、移動anchor／連續尾焰。 | [骰子v1.13](RACE-DICE-WEBGL-PROGRESS.md)、[精修v1.14](RACE-FX-VISUAL-REFINEMENT-PROGRESS.md)已发布；原「YouTube／粒子仍只是研究」不適用現況。原生hidden／某些連鎖／FPS未驗是QA，不是缺renderer。 |
| roadmap5：YouTube單端嵌入、多人同步／控制 | public/shared/table-watch.js／table-media.js、src/media/room.js:14,133：共享current／queue／server anchor／room instance。 | [共看](YOUTUBE-WATCH-PROGRESS.md)＋[統一媒體v1.8](UNIFIED-ROOM-MEDIA-PROGRESS.md)已實作／發布，後續尺寸亦已修。跨設備／弱網／真拒播等仍有限QA；不重做播放器。 |
| roadmap6：backup／dry-run／restore CLI與管理UI | src/data/transfer.js、src/data/validation.js、src/data/ui.js、tools/server-data-ui.cjs與transfer tests。 | [移轉進度](SERVER-DATA-TRANSFER-PROGRESS.md)與後續發布保留功能；「尚未做CLI」已過時。外站取代／合併、正式多主DB是另外需求，不能把未切外站資料寫成CLI未完成。 |
| 成就頁只寫送禮、未動態列metadata | public/achievements.html:12通用收藏文案；achievements.js:3–17按API列名稱／description／解鎖日期；store.js:27–29回傳defs。 | 基礎不一致已修。新metadata的rule_version／condition_key／icon_key／visibility／status與按遊戲分類尚未齊全，列下面小批後續。 |

## 真缺功能：可拆批次及前置條件

P1表示建議下一輪規劃；排序仍待使用者優先選擇，不能把所有歷史候選一次開工。主agent目前傾向B01，其他支線不用等B01的DB。

| ID／優先 | 可獨立交付範圍 | 現在缺口／source證據 | 依賴與完成條件 |
| --- | --- | --- | --- |
| B01／P1候選先做 | 客製彈幕框 **Stage A**：預設＋三種本站內建框、選框／個人顯示、長文與軌道尺寸 | CUSTOM-BARRAGE-FRAMES:68–72；基線game-shell.js只建DOM bubble，motion-policy只有既有四lane／開關；没有選框、frame id／內建frame樣式契約。 | 無新DB或上傳；保原8秒／減動／離房、不改角色表情；大框按實際高度避疊，改框不跳動已建立訊息。與achievement ledger無依賴。 |
| B02／P1小批 | 成就metadata／收藏冊分類補齊 | store.js:3–18只有五個基本defs；前端全部同✦，缺完整新欄位與分類／可選展示。 | 可先為既有五枚補metadata與遊戲分類，不改已授ID／日期、不假註冊未做predicate的新徽章；不需要完整win ledger。 |
| B03／P1基礎 | 權威unit／match事件、凍結帳號參與映射、持久processed／result ledger | store.js:23 WeakSet僅runtime；src/app.js:45 seats為RAM；history/store.js:108 metadata玩家只名字；db/index.js:155只有user_achievements，無game_results／match_participants／processed_results／processed_unit_events／achievement_progress。draw雖已有UUID結果，不能推廣為五款持久ledger已完成。 | 先設normal／abandoned／interrupted＋quality flags、canonical user/seat、unit與match分離；SQLite transaction／outbox或reconciliation、schema／export/restore回歸。不能按暱稱補舊史、用room.version作跨環境事件ID。 |
| B04／P1 | 畫猜入門 draw-first-round＋all-first-table | AchievementStore沒有awardDraw；src/app.js:111–116只gift/majority/poker/thunder；defs無draw。 | 最小依賴是可靠正常round事件、曾被server接受的stroke/guess與凍結帳號參與snapshot、持久一次授予。不能只看仍在場玩家／最終畫布是否空白；clear/undo後合法參與仍有證據，中斷artist單位不發。按原spec由B03權威unit支線支援，不需等全五款wins UI完成。 |
| B05／P1逐遊戲小批 | 六枚趣味徽章：draw-soul-artist、draw-first-correct；gift-coincidental-twins、gift-wishlist-echo；majority-one-channel、majority-tied-signals | ACHIEVEMENTS spec:42–60已有accepted候選；當前store五defs／四award方法没有這些ID或predicate。新earned toast只是現有徽章呈現，不等這些成就已發。 | B03正常unit／帳號映射及dedupe；逐遊戲按已確認stroke/guess、gift整輪全部accept後entries、majority正式score後groups。不可按動畫click／review預覽／他人秘密資料發放。 |
| B06／P1，B03後 | all-two-tables探索進度 | 無achievement_progress或完成遊戲集合；目前all-first-table只一次INSERT。 | 權威有效unit計不同game set；重送／重啟／archive匯入不增進度，跟入門／勝場分開。 |
| B07／P1基礎可先拆 | 撲克per-pot winner IDs／split／refund快照 | src/games/poker.js:46,54–55結果按name/amount/hand聚合；多筆results不是同pot平手證據，未跟注款退回不可計win。 | 補immutable pot分類／canonical座位ID與原分配數值一致，不改玩法；可先做server metadata回歸，再接B03。 |
| B08／P1，B03＋B07 | 精確永久戰績與本人查閱／自選公開 | 尚無帳號綁定game_results／participant ledger、wins API／UI與個人公開選擇；history JSONL不是此功能。 | 按各遊戲match/race/hand單位與quality／AI分桶；win＋shared_win、draw／abandoned分開，退出／刪房不回算已凍結結果。poker等B07，其他遊戲可逐款開，不推排行榜／連勝壓力。 |
| B09／P2後續 | 彈幕框Stage B上傳／收藏／分享及Stage C品質 | 基線無frame表、上傳、版本grant／private audience。collection現有角色／畫作不等框收藏。 | 先B01穩定樣式；新schema／PNG decode重存、像素／切線上限、ACL／版本快取、刪除回退／備份還原，再做手機／壞圖／高度壓力。不能把Stage A完成說成完整客製上傳。 |

B02的完整展示／通知個人控制如另開批次，須保預設私人、不曝他人locked與私密答案；本表不把公共profile／全桌任務當既有授權。
B03是最重的一條基礎支線，可先做unit identity／account mapping，再逐款落資料，避免為B04一次重寫全部引擎。

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

若沒有新的優先指示：先B01（獨立、可見、無schema），同時以B03作資料方案／正常unit契約；B02可另小批，B04→B05／B06等unit支線完成後逐款做。B07可獨立補metadata，B08永續戰績再接結果ledger。
本次僅保存盤點；未把舊「未部署」或本批尚未驗的研究寫成新的bug，也沒有啟動上述功能實作。

