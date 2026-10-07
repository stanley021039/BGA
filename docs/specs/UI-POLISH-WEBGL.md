# 介面美化與 WebGL 第一批規格

日期：2026-10-07。階段：實作與驗收中。起始分支 `feat/ui-polish-webgl`、基線 `38c1497`；本批獨立於已送審的 PR #46。完成、測試與發布狀態只以 [進度文件](../UI-POLISH-WEBGL-PROGRESS.md) 的實際證據為準。

依據 [介面美化研究](../research/UI-POLISH-DES13-ASSESSMENT.md)、[WebGL 評估](../research/WEBGL-ADOPTION-ASSESSMENT.md)、[共用對齊](SHARED-UI-ALIGNMENT.md) 與 [作畫順暢度](DRAWING-SMOOTHNESS.md)。保留暖白／森林綠與各遊戲配色，以共用表面、邊界、浮窗層次和選取回饋建立一致性。桌機優先，手機與放大文字仍須可用；本批不搬移主要區塊、不新增大型插圖或收合重要資訊。

## 第一批範圍與資訊分級

實作限於既有共用 CSS 的視覺 tokens／呼叫端，以及雷霆之路車旁的原生 WebGL 裝飾層。既有 grid、padding、遊戲區尺寸、控制尺寸、重要字級與操作流程保留；字體不另換套件，也不以全域 selector 強行覆寫所有特殊內容。必要的小範圍修正必須記錄原因及實際尺寸。

| 資訊級別 | 判斷與具體內容 | 允許的呈現方式 |
| --- | --- | --- |
| P0 立即決策 | 全桌玩家／角色、畫者與猜中狀態、剩車／骰子、當前行動、合法格、倒數、個人選取、輸入及可恢復錯誤 | 主要介面常駐可辨識；不能改為管理、下拉或額外點擊後才看到。空間不足可自然流或局部捲動，內容不能被裁切。 |
| P1 當輪脈絡 | 公開結果、分數、房號、階段、目前媒體及共享／個人影響範圍 | 保留既有資訊與公開時序；用字級、圖示與分組整理，不以透明度把他人狀態消去。 |
| P2 低頻說明 | 詳細教學、設定說明、操作名稱 | 沿用設定／問號／hover 與 focus 提示；圖示操作仍有中文可讀名稱與 touch 說明。 |
| 裝飾 | 陰影、紋理、火花、煙霧、光點 | 可降低、關閉或退回；不阻擋操作，不承擔唯一成功／危險提示。 |

## 依設計理念與遊戲分類

下表「第一批」是實作契約；「保留／驗收」是完成條件，不能當作已通過。各遊戲現有資訊架構保持，未列入的小尺寸歷史文字另列後續盤點，不假設已全站收斂。

| 理念 | 遊戲 | 第一批 | 保留／驗收 |
| --- | --- | --- | --- |
| 少數字級與數字基線 | 整體遊戲 | 沿用 14／16／20／28／32 字級 tokens 與中文系統字型；常用數值採 lining／tabular 形式，避免裝飾數字字型。 | 房號、時間、分數與相鄰中文基線合理；200% 文字不截字。是否支援數字形式須看實際字型。 |
| 少數字級與數字基線 | 你畫我猜 | 保留醒目的倒數與同寬時間條；人物姓名／分數沿用共用元件。 | 不恢復已移除的題材與重複成功文字，不縮小畫布；長名、猜中標記及畫者身分可讀。 |
| 少數字級與數字基線 | 送禮達人 | 分數與階段數字採一致形式，不重寫選禮／排序內容字級。 | 禮物名稱、目前收禮者、分數及確認仍可辨認，不提前公開未揭曉內容。 |
| 少數字級與數字基線 | 雷霆之路 | 房號、輪次、道路加分及車隊數值使用共同數字契約。 | 其他玩家剩車／骰子／角色保持可見；數字不因風格更換而上下跳動。 |
| 少數字級與數字基線 | 同頻俱樂部 | 題目／選項／公開票數沿用既有層級，數值形式一致。 | 選項和結果文字可讀；不揭露其他玩家尚未公開的選擇。 |
| 對齊與間距 | 整體遊戲 | 容器繼續負責 grid／flex 與 gap，圖示槽維持無外部 margin；視覺更新不增加區塊高度。 | header、玩家區、操作列原本 key lines 保留；不因陰影／邊框遮擋下拉、focus 或按鈕。 |
| 對齊與間距 | 你畫我猜 | 畫具與畫布仍共用對齊線，左玩家區與底部聊天室原高度契約保持。 | 畫布／工具、聊天室／玩家下緣不倒退；聊天室輸入仍在最後；角色卡內外 gap 保留。 |
| 對齊與間距 | 送禮達人 | 保留依實際剩餘高度分配、操作與彈幕輸入的既有間距。 | 高桌機不重現固定上限捲軸；矮視窗也不把開始按鈕與輸入貼在一起。 |
| 對齊與間距 | 雷霆之路 | 圖例、車隊與操作表面共用 radius／邊界，位置與 hit area 維持。 | 法定落點、圖例框、地形說明和行動按鈕的可觸及範圍不縮小。 |
| 對齊與間距 | 同頻俱樂部 | 選項與结果卡維持原格線與內容間距。 | 長文字、最大座位數與揭曉 chip 不重疊或被裁切。 |
| 表面與浮窗層次 | 整體遊戲 | 定義背景／卡片／浮窗的少量 surface、radius、shadow tokens；保留 light／dark 與各遊戲 accent。 | light／dark 文字與 focus 足夠辨識；dialog、設定、表情、tooltip 層級正確，`[hidden]` 仍不顯示。 |
| 表面與浮窗層次 | 你畫我猜 | 主舞台／工具列／聊天室用同族表面；白色畫布仍是視覺主角。 | 不透明覆蓋畫布、不添加畫布 filter、不更動 backing pixels 或結果存圖。 |
| 表面與浮窗層次 | 送禮達人 | 既有選禮／排序／揭曉卡套相容表面與 radius。 | 當前收禮者、禮物名稱與確認按鈕優先；畫面不增加大 Hero。 |
| 表面與浮窗層次 | 雷霆之路 | 暗色賽道／操作區／車隊仍保遊戲風格，浮窗層次用共用契約。 | 地形與車輛不被背景紋理吞沒；骰子對抗 dialog 仍蓋於賽道之上。 |
| 表面與浮窗層次 | 同頻俱樂部 | 題目、選項、已揭曉結果用一致卡片語彙。 | 勝出與普通結果可區分，卡片不只靠微弱陰影提供必要狀態。 |
| 選取與操作辨識 | 整體遊戲 | GameUI registry／提示／focus 沿用；選取邊界加强，狀態文字／圖意與色彩互補。 | light 裝飾邊框不能作唯一選取線索；disabled／pending／error 與選取分得開。媒體細桌機 compact、coarse 44px 與 queue 4／6px 密度保持。 |
| 選取與操作辨識 | 你畫我猜 | 現有 selected 工具與顏色呈現更明確，圖示風格不另換套件。 | 每個工具 hover／focus 可讀；選中、不可用與 active stroke 行為保持。 |
| 選取與操作辨識 | 送禮達人 | 被選禮物／偏好卡保留強輪廓與原選取語意。 | 不添加會遮住名稱的裝飾；鍵盤選取、儲存狀態與防重複提交維持。 |
| 選取與操作辨識 | 雷霆之路 | 合法格、選車／選骰與不可用指令維持多重線索。 | hover 路徑／地形功能仍可看、Enter／Space 可操作；不可用指令仍 disabled。 |
| 選取與操作辨識 | 同頻俱樂部 | 個人選項輪廓與已公開結果各保留原狀態類別。 | 不把未公開答案的顏色暗示成其他玩家選擇；一般席與房主權限不變。 |
| 適量動效與技術邊界 | 整體遊戲 | 只新增有用途的單次裝飾，遵循 MotionPolicy；禁止裝飾常駐 ticker。 | hidden／減少動態／停用／離頁取消，不補播舊粒子；不增加每幀 API 封包。 |
| 適量動效與技術邊界 | 你畫我猜 | 不導入 WebGL renderer；保留 Canvas 2D、atomic presentation、點時間回放與平滑倒數。 | 每輪驗畫者持筆／up／ACK／換輪途中不閃白，觀看者逐點、揭曉完整；不能只比較終點 PNG。 |
| 適量動效與技術邊界 | 送禮達人 | 既有送禮入場與收禮者確認時序保持；首批不加粒子層。 | 全員一起送給目前收禮者，確認才前進；全員收完才顯示完整結果。 |
| 適量動效與技術邊界 | 雷霆之路 | 氮氣、煙霧、火花用透明原生 WebGL1 point shader 局部特效層。 | 原 SVG／CSS 與事件文字永遠保留；逐格／碰撞／連鎖事件時序不改，失敗安全回退。 |
| 適量動效與技術邊界 | 同頻俱樂部 | 既有公開答案聚合動作保持；首批不把 chip 或文字搬進 canvas。 | 結果先由 DOM 正確公開，動效不承擔結果裁決。 |

### 共用視覺實作契約

呼叫端沿用 `ui-surface-base/panel/inset/floating/title`、`ui-control-border`、`ui-selected/text/soft`、`ui-accent-soft`、`ui-radius-control/card/panel` 與 `ui-shadow-panel/floating`。首批 radius 為8／12／16px；dark base／panel／floating 為 `#141c17`／`#1d2a22`／`#24342a`，light 為 `#f3f1eb`／`#fffdf8`／`#fffefa`，必要控制邊界 dark `#83977f`、light `#74806e`。選禮 accent soft 使用 dark `#393044`／light `#f0e8f5`，foreground 與 badge 同時配套；hover 不蓋選取。這些原始 token 不等於各 caller 已驗對比。

首批呼叫端為 `public/shared/ui-foundation.css`、`table-media.css`、`public/draw.css`、`gift.css`、`majority.css`、`race.css`。畫布保持白色；選中畫具、選禮、選項與車卡沿用原類別，不新加權威狀態。只調數字 family／lining／tabular，不改控制尺寸或全面更換字級。表面變更不能覆寫 `[hidden]`／disabled 或破壞介面資訊。

## WebGL 模組契約

本批選原生 WebGL1 而非研究提出的 PixiJS 候選：效果限三類 point particles，無新套件／貼圖／字型。這是縮小依賴與功能範圍的工程選擇，不代表已證實比 PixiJS、SVG 或 Canvas 2D 更快。

| 契約 | 第一批設計 |
| --- | --- |
| 建立 | `GameFxLayer.create(hostOrCanvas, { policy, onAvailability, maxParticles:192, maxEffects:6, maxDpr:1.5, maxPixels:1500000 })`；透明 canvas，`pointer-events:none`、`aria-hidden`，不成為 Tab stop。同 host 重用，全頁至多2個 context，第一個有效 play 才初始化。 |
| 播放 | `play(id, kind, anchor, options)`；kind 為 nitro／smoke／sparks，anchor 是局部 CSS 座標或回傳當前位置的函式；每次最多48粒子、120–1800ms，可接受已過時間與方向。 |
| 限額 | 預設192粒子／6效果／DPR1.5／150萬pixels；可設定值仍有256粒子／8效果／DPR2／200萬pixels硬上限。seen最多256；不得無界排隊。 |
| 更新／清理 | `resize()`、`clear({resetSeen})`、`destroy()`、`getState()`；resize 不重播，clear 取消 active frame，destroy 釋放 buffers／shader／program／canvas／監聽器。 |
| 事件來源 | 只消費已接受的公開 race eventId 和既有 live gate；重送／舊 snapshot／重連不重播。車旁位置跟隨當前視覺移動，不能從 server 最終位置直接跳躍。 |
| 時序 | 不等待 WebGL 結束才進行規則；原 RaceMovement／checkpoint 繼續負責逐格移動與事件先處理。射擊與碰撞特效不改車輛 transform。 |
| 生命週期 | 空閒不排 rAF；hidden／reduce／MotionPolicy 停用即清理舊特效，恢復時不補播；首次初始化／shader 失敗或 context lost 停用裝飾，SVG／CSS／標字與所有遊戲操作繼續。 |
| 復原 | context restored 重新建立 GPU 資源，僅允許後續新事件；不把先前消失的粒子補回。超額或不合法輸入安全拒絕／限額，不無限排隊。 |
| 權威與資料 | 不改 DB／API schema、封包／座位權限、骰子結果、繪畫格式或 server 負擔；不為幀更新傳送車位置。 |

## 必要驗收矩陣

所有列先標待驗；進度文件分開記錄 source／VM／原生畫面／正式站。背景分頁的 rAF 節流不能當成前景 FPS，也不以 WebGL context 成功等同硬體加速或效能收益。

| 驗收分類 | 情境與方法 | 通過標準 |
| --- | --- | --- |
| 五款重要資訊 | 同資料比較 waiting／active／公開 result；畫猜含畫者與猜者，送禮含選禮／排序／確認，雷霆含選骰／移動／事件，同頻含作答／揭曉 | P0／P1 內容位置、數量與可讀性保留；名單不改收合，未公開資料不洩漏。記錄實際涵蓋階段，不以一張等待畫面代表所有玩法。 |
| 一般桌機 | 1280×720、寬高桌機（如1920×1080）、現有最大座位數／長中英數姓名 | 主操作無重疊，原一屏布局不倒退；必要局部 scroll 可到尾，不能加固定高度導致高視窗空白與無謂 scroll。 |
| 小螢幕／放大 | 390×844、較窄320px、200% 文字；空間不足允許自然流 | 無水平裁切，輸入／確認／最後名單可觸及，字不遮按鈕；不能以縮字或隱藏重要資訊通過。 |
| 字體／色彩 | 實測 computed 字級、數字基線、light／dark／selected／disabled／focus／error | 正文／重要內容不變小；一般文字4.5:1、大字與必要圖形狀態線索3:1，裝飾邊框與必要邊界分開判定；不把透明合成背景當不透明 token 計算。 |
| 浮窗與輸入 | 設定、表情、地形提示、素材 dialog、媒體雙窗；開到上下邊緣／拖曳／resize／scroll 到尾 | 內容不被遮住、popover 在可用區域，tooltip 不蓋操作；Esc／返焦／Tab／disabled／pending／`[hidden]` 正常。媒体 same iframe、個人尺寸與零幾何 POST 保留。 |
| 圖示可達性 | hover、focus、touch、中文 accessible name；合法格 Enter／Space | 图示功能有可讀名稱，focus 可見；WebGL 不攔 pointer／focus，舊 hit target 與尺寸保持。 |
| 畫猜防閃回歸 | 兩席持筆、尾點、ACK、填色／undo、揭曉／換輪；观察途中與完成圖，逐點 queue 與倒數條 | 無非預期白底／丟活動筆跡、收到批次仍逐點呈現、換 epoch 無舊尾；倒數連續且 deadline 語意一致。 |
| 原生 WebGL | 真 Chrome 成功建立、當場 nitro／smoke／sparks、同車移動中 anchor、resize／DPR | 實際 shader／buffer／canvas 可見且不蓋標字；粒子／效果／pixels 有界，空閒无active rAF。不宣称60fps。 |
| 強制回退 | 無 WebGL、初始化／shader 失敗、`WEBGL_lose_context` 若可用、恢復後新事件 | 舊 SVG／CSS、事件文字、道路 hover 與操作仍可用；失去context即停止，恢復只播新事件。未取得擴充或未執行須標限制。 |
| 動態設定與離頁 | OS reduce、MotionPolicy disable、visibility hidden、pagehide／重進／destroy | 取消 active effects／frame，無已清理 callback 重啟；不補播舊事件，不影響移動／檢定裁決。 |
| 規則與交通量 | 同一段逐格＋道路事件＋碰撞 trace，新舊規則與 request count 比較 | 事件先處理再繼續、碰撞交換仍平滑；GL 層不發請求，不增加每幀封包；超額特效不延遲規則。 |
| 共用作用範圍 | 撲克與至少一個非遊戲入口 smoke | 共用CSS不把隱藏內容打開，不污染正面多區卡、非遊戲header或表單；不將此 smoke 宣稱完整玩法驗收。 |

## 尚未納入

整張賽道、車輛／人物、畫猜 renderer、文字／emoji 彈幕及其他遊戲不遷移 WebGL。50／250／1000 粒子壓力與前景效能對比仍是研究候選，不是本批192粒子產品上限的已測負載。完整跨 OS 字型、實體手機／讀屏、真弱網／另一台電腦、所有長名與自然多輪仍依實際證據列限制。

## 協作責任

共用視覺 agent 實作 tokens／caller；WebGL agent 實作模組與失敗／生命週期測試；主 agent 整合公開事件、背景多席畫面、版本與交付；規格 agent 保存矩陣與實際結果。沒有回報或測試資料不能寫「通過」，各角色不以美化理由修改遊戲規則或隱藏重要資訊。
