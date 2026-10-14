# 共用遊戲模板：大廳與你畫我猜

本批依 [Stitch 專案 4415628963581301508](https://stitch.withgoogle.com/projects/4415628963581301508) 匯出的 HTML 與畫面實作。來源包含大廳扇形卡牌稿、UX02–UX17 獨立畫面與修正版 UX14；匯出原檔只作設計參考，不執行其中的範例引擎或編輯器注入腳本。原生畫布仍為 512×256，完整工具、伺服器計分、秘密答案與權限保持原契約。Playful Paper 的紙卡、角色素材與原卡片扇形、拖曳、旋轉、位移效果保留。

## 元件階層

| 層級 | 來源與介面 | 責任 |
|---|---|---|
| 品牌與基礎值 | `playful-theme.css`、`ui-foundation.css` | 既有顏色、字體、互動尺寸、亮暗配對 |
| 語意 tokens | `template-tokens.css` | Stitch 奶油紙底、可可深色表面、成對前景、2px 墨線、24px 間距、欄寬及操作槽 |
| 基本物件 | `GameUI.Template.objects` | 安全文字與屬性節點、圖示按鈕、角色外觀、語意 class |
| 組合元件 | `GameUI.Template.compositions`、`GameUI.framePanel` | header/body/footer 面板、漸進展開、控制列、提示、狀態與表情槽 |
| 功能區塊 | `GameUI.Template.patterns` | 玩家區、舞台、聊天室 grid；穩定角色反應；畫布顯示尺寸量測 |
| 頁面模板 | `GameUI.Template.pages`、`template-layout.css` | 大廳與繪畫頁的配置、斷點、單視窗高度預算 |
| 遊戲 adapter | `draw.js`、`lobby.js`、RoomControls／RoomWaiting／SharedChat | 遊戲階段、事件、權限、資料與原生操作；不放進基礎元件 |

新頁使用 `data-ui-template="tactile"` 才啟用；其他遊戲的既有布局不自動搬動。腳本需在 GameUI 與 MotionPolicy 之後載入、在遊戲 adapter 之前載入。CSS 依 tokens → components → layout 放在原有主題之後。

`objects.button` 重用圖示 registry 與中文可讀名稱；`compositions.panel` 提供可保留節點的 header/body/footer；`compositions.disclosure` 重用共用 popover；`compositions.dialogPanel` 包含共用關閉按鈕、內容槽與焦點還原，等待室聊天及下一局設定都使用它。原生 canvas、input、表單與有事件的按鈕保持原節點。角色反應使用伺服器 expression、純文字泡泡與 MotionPolicy，初始／重連不補播、減少動態不演出。設定入口只在 hidden 值改變時更新，避免觀察器重複觸發。

## 布局契約

- 1101px 以上、680px 高以上採桌機同屏策略。大廳上方是角色交誼區，下方左卡牌、右加入代碼及房間列表。等待室採左角色、中插畫、右完整設定，聊天從圖示入口展開；實際遊戲採左角色、中舞台與猜題、右彈幕。
- 一般桌機使用上方常用色票與左側雙列工具欄；高度 800px 以下改用畫布下方橫向十工具及合併狀態列。画布由固定 grid 槽量測，避免用自身位置反覆放大；backing bitmap 與筆跡同步不變。
- 畫者直接在中央三張題卡選題；猜題者只看未公開的背面。結算保留中央角色頒獎、私人收藏、回大廳與再開局；下一局設定移入獨立視窗。長排行榜在自己的槽內捲動，底部操作列保持可見。
- 專注模式隱藏網站導覽與社交聊天，保留角色、中央作畫／猜題、揭曉和重開操作及退出入口；結算底部另提供下一局設定入口。
- 外框、欄寬、操作列與提示列預留固定槽位，表情及回饋不使工具溢出。桌機目標 1280×720、1440×900；低高度、放大文字與手機允許頁面重排與捲動。
- 手機角色列表橫向捲動，工具仍完整可達；不裁切圖示、表單或必要結果。

## 功能入口對照

| 原功能 | 新版入口／元件 | 權限／階段 |
|---|---|---|
| 12 遊戲選擇、拖曳／箭頭／鍵盤 | 原 GameCardCarousel、縮放紙卡槽 | 大廳 |
| 開桌、房名、玩法、房間代碼、列表與返回席位 | 原建房 dialog、同屏房間面板 | 大廳 |
| 角色移動、角色表情 | 原大廳角色＋共用表情按鈕 | 自己的角色 |
| 帳號、收藏、成就、管理、題庫與歷史 | 原頁首選單 | 依帳號權限 |
| 外觀、音樂、音效、動畫、彈幕與框 | 原全域設定與 ColorScheme | 個人偏好 |
| 類別、秒數、結算方式、數值 | 等待室右欄／結算「下一局設定」視窗 | 房主等待／結束；非房主唯讀 |
| 加 AI、開始、管理／踢人、離房 | 名單末格／固定操作列／確認 dialog | 保留原權限 |
| 15 秒三選一 | 中央三張可點選題卡 | 僅画者見題目 |
| 10 個工具、顏色、調色盤、筆刷 | 共用完整工具列 | 僅畫者；依原狀態 disabled |
| 猜題／Enter、錯誤猜測、答對 | 中央猜題區 | 猜題者；不與彈幕合併 |
| Emoji、角色表情、160 字彈幕 | 原 SharedChat 選單與穩定 footer | 原社交權限 |
| 媒體同意、播放、清單、個人音量、同步、排序 | 原 TableMedia 視窗與子選單 | 原房間／個人權限 |
| 最近八輪、答案、畫作、得分、禁題、收藏、重試 | 原 DrawResults dialog | 已公開結果與原投票／收藏權限 |
| 揭曉、成績、重開、專注、離線／重連 | 原階段 adapter、GameFocus、DrawController | 原引擎與權限 |

功能存在與已實際驗收須分開記錄，未觸發的狀態不算通過。

## 架構參考

- [USWDS design tokens](https://designsystem.digital.gov/design-tokens/)：設計值作共同來源。
- [Material foundations](https://m3.material.io/foundations/)：布局、互動、可及性與 tokens 分離。
- [Digital.gov reusable patterns](https://digital.gov/guides/research-collaboration/designing/reusable-patterns)：以共用模式與使用規範承接頁面。

採用分層原則而非搬入外部框架，沿用本站原生 JavaScript 與共用 GameUI。
