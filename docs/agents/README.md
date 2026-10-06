# Agent 長期記憶索引

2026-10-06正式 **v1.3.0**：畫猜本人猜中／畫者輪次及雷霆骰聲／shot／slam／nitro／skid已接共用事件音效。Windows Node24.14.0 **761/761**（25286ms）、Linux Node22.22.1 **761/761**（130827ms），失敗／取消／跳過均0。受測程式 `4732450fe44d2640ecaf961cf2d8dee9d8bd5e95` 與本地 annotated tag `v1.3.0`，正式 current `releases/4732450`；零房間切換，PID50471→52510，service／tunnel active。schema14不變、integrity ok、外鍵錯誤0，原7帳戶全欄位保留；預演副本16張既有表逐列一致。匿名no-store版號、既有session、7份HTML、24份資源（含7WAV的精確bytes及MIME）一致，背景Chrome設定顯示「版本 v1.3.0」。7短音（2Kenney CC0改作＋5固定seed原創）、兩個新聲音模組、遊戲2／總4段上限及1秒載入timeout已驗；Chromeplaying／清理／靜音及所有限制見 [音效實證](../GAME-SOUNDS-PROGRESS.md)。第二批遊戲候選仍為規格，沒有真人聽感／喇叭測試；無新PR／push，純驗收文件不移動tag。

2026-10-06新增「音效師」：角色方法與限制見 [SOUND-DESIGNER](SOUND-DESIGNER.md)，不同素材網站的具體授權見 [素材來源](../research/SOUND-ASSET-SOURCES.md)，五款遊戲的既有音效、候選位置、優先序、事件時序及實際討論見 [音效計畫](../specs/GAME-SOUND-PLAN.md)。這筆是研究階段紀錄；第一批後續正式實作見上方v1.3.0，第二批候選仍未做。

2026-10-06最新正式 **v1.2.0**：角色自訂表情可加入最多10秒音效，作者上傳／試聽／移除，五款遊戲與大廳沿用共用效果音開關／音量。Windows Node24.14.0 **727/727**（24185ms）、Linux Node22.22.1 **727/727**（125824ms），失敗／取消／跳過均0。背景Chrome邊界、轉檔、停止、一次載入及靜音均驗。受測程式 `9b1fdd4148ea9e1ceec5215f8ca112ffd99cd893` 與本地 annotated tag `v1.2.0`；正式 current `releases/9b1fdd4`，零房間切換，PID 48811→50471，service／tunnel active。正式 schema14、integrity ok、外鍵錯誤0，原7帳戶全欄位完整保留；預演時15張既有表逐列一致，只新增空 `character_sounds` 第16表。匿名 no-store 版本API、既有session、7份HTML及14份資源比對通過，背景Chrome設定顯示「版本 v1.2.0」。schema1–13副本升級與完整音效備份還原已驗；無新PR／push，纯驗收文件不移動tag。詳細契約、備份、證據與測試範圍見 [角色表情音效](../CHARACTER-ASSET-TEMPLATE.md)，較早部署狀態保留為歷史。

2026-10-06先前正式 **v1.1.4**：PR #36共看失聯重試及HTTP安全UUID修正已整合，Windows／Linux各663/663、HTTP真Chrome實播及pause／stop各503後同revision恢復通過。受測93ba350／本地v1.1.4 tag，正式current releases/93ba350、schema13／7帳戶完整保留、公開版本與資源已驗。#34雙平台442與Chrome四輪回看收藏禁題補齊，另一端已合併；#36來源552雙平台、原PR已更新5f2dd93／main／Ready、無衝突，未合併。以下較早部署及待驗文字屬歷史，以 [最新發布](../RELEASE-PROGRESS.md)與 [共看實證](../YOUTUBE-WATCH-PROGRESS.md)為準。

2026-10-06版本管理：新功能必須打版。先讀 [打版規範](../RELEASE-POLICY.md)及 [最新驗收](../RELEASE-PROGRESS.md)，判斷候選／正式狀態；不要沿用package曾長期固定1.0.0的做法。

本批最新遊戲程式來源 **4bab53a**，Windows／Linux整合各 **543/543** 通過。2026-10-06正式站已切換發布版 **8fcda4d**：schema13、完整性ok、7帳戶全欄位保留，公開15份資源及既有session驗證通過。新功能未push／未新PR；以下較早「未部署」為歷史狀態，最新範圍與限制以 [整合進度末節](../PARTY-UPGRADE-PROGRESS.md#正式部署驗證2026-10-06)為準。

2026-10-05 U33 最新：YouTube已發 [PR #36](https://github.com/stanley021039/BGA/pull/36)（head2eeb398，接續#34，未部署），取代下段「未PR」。另六項需求在本地 `feat/party-content-and-race-paths`，前五項程式／背景Chrome已驗；彈幕框僅規格評估。接手先讀 [整合進度](../PARTY-UPGRADE-PROGRESS.md)、[改名](../PLAYER-RENAME-PROGRESS.md)、[內容及來源](../PARTY-CONTENT-PROGRESS.md)、[多格路線](../RACE-MULTI-MOVE-PROGRESS.md)和 [框規格](../specs/CUSTOM-BARRAGE-FRAMES.md)，以整合文件最後測試／commit狀態為準。這六項未push／PR／部署，正常Chrome viewport未覆寫；帳密仍只在核准私有交接。

最新本地增量：`400cb6d`、U32「在這裡開始播放」只給房主顯示，Windows前端52項及兩個背景Chrome帳號驗收通過。原 `631eabf`、U29／U30的YouTube共看及共用媒體浮窗基線曾通過Windows／Linux各503項；本增量未重跑兩平台全套，未push／PR／部署。接手先讀 [共看進度與操作](../YOUTUBE-WATCH-PROGRESS.md)，再读PROGRAMMER／SERVER-DATA／PLAYER；舊共看spec的SSE、輪詢及固定modal方案被取代。測試viewport已逐tab還原，後续尺寸測完立即reset，不留左上角模擬區。隔離預覽／合成帳密／cookie只在ignored work私人交接，不能沿用房號當正式站資料。

2026-10-05 最新追加 U28：程式 **2cf8a44** 已加入畫猜揭曉後的禁止題目投票。揭曉固定選民、嚴格過半、最近八輪補投，通過後內建／共編題目全站持久停用；schema 13 與完整備份還原相容。Windows／Linux 各 **431/431**、原 Chrome 背景按鈕及版面驗收通過，接續 PR #34，未部署。詳細規則、限制與證據見 [禁題進度](../DRAW-WORD-BAN-PROGRESS.md)。這是以下 U26／U27 的後續版本。

2026-10-05 PR #31 鎖修正：程式 `0682e43` 停止自動回收殘留資料／發布／歷史鎖，HistoryStore 共用排他鎖且關閉冪等。受控雙程序已在舊程式重現兩者同時取得鎖；Windows Node 24.14.0 完整 **374/374** 通過（新增11項），本次未重跑 Linux。人工清理與半份還原處理見 [操作指南](../SERVER-DATA-TRANSFER.md#殘留鎖的人工檢查)，證據與剩餘驗收見 [PR #31 修正進度](../SERVER-DATA-TRANSFER-PROGRESS.md#pr-31殘留鎖競態修正)。此筆更新鎖行為及本次測試數字，不代表正式服務已更新。

更新：2026-10-05。這些檔案是後續 session 可讀取、校正與延續的專案記憶；不是模型權重訓練，也不會讓未讀文件的 agent 自動知道內容。專案根 `AGENTS.md` 指引下一個工作回合載入索引及相關角色。

最新遊戲程式 **93d7a84**（U26／U27）：畫猜最近八輪回看與收藏、等待／離線提示、猜中卡勾選高亮，以及五款共用動效／彈幕規則已實作。Windows／Linux 各 **402/402** 通過，原 Chrome 背景完成跨輪 PNG／重送／重連與設定驗收；8 席720p仍需少量垂直捲動。讀 [完整證據及限制](../DRAW-REVIEW-MOTION-PROGRESS.md)，此項取代下方研究階段「PL-01／PL-02 與共用政策尚未實作」的現況，不表示成就／YouTube已做或已部署。

最新資料移轉程式 `47d79c7`：管理者可選備份資料夾＋金鑰，驗證、預演並建立新資料目錄；刷新恢復與備份身分比對已實作。Windows／Linux 完整各 **363/363** 通過，原 Chrome 背景已驗本機路徑與恢復上傳批次後的還原、原密碼登入及私人作品。資料夾選檔受自動化工具限制，與 HTTP 上傳驗收分別記錄，詳 [最新驗收](../SERVER-DATA-TRANSFER-PROGRESS.md#管理者匯入流程與背景-chrome-驗收)。仍未搬移正式資料或部署公開管理頁。

| 角色 | 記憶入口 | 本輪研究／spec | 長期責任 |
| --- | --- | --- | --- |
| 玩家 | [PLAYER](PLAYER.md) | [評論與評分標準](../research/PLAYER-REVIEW-RUBRIC.md)、[實玩評估](../research/PLAYER-PLAYTEST-ASSESSMENT.md) | 把評論變成可測評分，區分新手／熟手、競技／派對需求，指出缺口與反例。 |
| 動畫 | [ANIMATION](ANIMATION.md) | [動效與素材方案](../specs/ANIMATION-ASSET-PLAN.md) | 盤點事件、節奏、資訊傳達、減少動態、失敗及重連。 |
| 音效師 | [SOUND-DESIGNER](SOUND-DESIGNER.md) | [素材來源](../research/SOUND-ASSET-SOURCES.md)、[遊戲音效計畫](../specs/GAME-SOUND-PLAN.md) | 定義聲音語彙、挑選與製作素材、核對逐檔授權、事件時序、密度、混音與靜音體驗。 |
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

同日送審前最終程式 `6e655de`：已接上 PR #30，新增舊 schema BLOB 表相容修正與回歸，完整整合 **Windows／Linux 各335/335 通過**，取代先前整合版本測試數字。PR #30 四項回覆另經獨立 agent 複查及65項回歸確認。已發出非 draft [PR #31](https://github.com/stanley021039/BGA/pull/31)，base 為 #30 的 `feature/game-stage-local`；先合 #30，再調整 #31 base 至 main。詳 [移轉進度末節](../SERVER-DATA-TRANSFER-PROGRESS.md#送審前最終複查)，未部署或搬移正式資料。
