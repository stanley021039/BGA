# Freehand 與紙張介面參考

2026-10-07，研究文件。正式基線為 v1.14.0；此文件未修改程式、圖示、版本或正式站。

建議採「整齊的桌機遊戲工作區＋紙張表面＋少量手繪圖示」。Freehand 的自然線條提供個性，玩家名單、聊天、倒數、結果與操作仍依共用網格對齊。以下實作方式是本站提案，並非外部作品已證明適合本遊戲。

## 證據範圍

主agent後續原生補充（與下方研究角色web紀錄分開）：背景Chrome實際開啟[Awwwards指定頁](https://www.awwwards.com/sites/gionatan-nese-26)及[作者網站](https://www.gionatannese.com/)，讀到黑白兩色、WebGL／GSAP／Three標籤；真畫面為白底大量留白、中央散列小作品卡／照片與兩側題字，私有截圖work/freehand-reference-gionatan.png。本站只借清楚對比与少量圖案，沒有採無限捲動／作者模型／作品圖片。

Pinterest的web403不代表Chrome不可讀。root在背景Chrome搜尋hand drawn paper game ui，讀[Onion Games手繪GDD的Pin](https://www.pinterest.com/pin/46865652369591957/)，並沿原作者連結讀[Hand drawing GDD of Onion Games](https://oniongames.jp/diary/hand-drawing-gdd-of-onion-games)。這是手繪開發筆記／概念圖，不是成品操作UI或UX效能驗證；圖片沒有確認可重用授權，未下載、收藏、反應或留言。本批採紙卡／SVG原創幾何，沒有搬Pinterest／Dribbble作品素材。

本次以 web 工具讀取作者作品頁、官方文件及公開 source；未操作外部作品的遊戲流程，未量測它們的尺寸、對比或效能。背景 in-app browser 在此環境不可用，沒有取得作品真畫面截圖。表格的「來源事實」只涵蓋實際讀到的文字、配色欄位和 CSS；不把搜尋引擎圖片摘要當親自看圖。

使用者提供的連結標籤與網址目的地分開辨識：Dribbble shot 仍按 Dribbble 作者作品處理，即使文字標為 Awwwards。Pinterest 只可作線索；本次不依未讀取的 pin 推斷作者、授權或實作，也未繞過存取限制。Gionatan Nese 的 [作者首頁](https://www.gionatannese.com/) 可讀到作品索引；Awwwards 指定頁在 web 工具回傳存取錯誤，其互動畫面另由主 agent 研究，不在此宣稱已操作或確認獎項。

## 三個可落地的參考

| 參考與 primary 來源 | 實際來源事實 | 與 Freehand 搭配的設計推論 | 本站原生實作方式 |
| --- | --- | --- | --- |
| **Creative Tim — Paper Dashboard React**。[作者 shot](https://dribbble.com/shots/5409456-Paper-Dashboard-React)、[官方產品](https://www.creative-tim.com/product/paper-dashboard-react) | 作者頁列出 `#F8F8F6`、`#0A0607` 等 palette；官方把它定位為卡片／元件構成的 dashboard。不是手繪遊戲，也沒有在本次親自量測其畫面。 | 借紙白與深墨的清晰層次；桌機的主要遊戲舞台、名單、操作區各有可辨表面。Freehand 放在操作或狀態前，不讓每张卡都增加大插圖。來源的多個飽和色只作比較，本站不全部照搬。 | 維持現有 grid／flex，從 `ui-foundation.css` 的 surface、border、shadow tokens 調整共同卡片。把 header／body／footer 間距統一；玩家卡同尺寸，選中狀態用邊線加既有勾號，不靠更多裝飾。无需安裝其 React／Bootstrap 模板。 |
| **Excalidraw — 手繪白板工作區**。[官方 repo](https://github.com/excalidraw/excalidraw)、[官方 theme source](https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/css/theme.scss)、[產品入口](https://excalidraw.com/) | repo 定義手繪風格白板及畫筆／橡皮擦／undo 等工具。讀到 CSS 的白色 island、`#6965db` 主色、`#e3e2fe` 淺主色、小陰影與獨立 icon／button 尺寸。產品入口僅回傳需 JavaScript，未在此操作。 | 手繪內容與穩定控制可共存。畫猜宜保大白畫布、可辨工具選取色與獨立操作浮層；手繪風格不必連數字、聊天正文和輸入欄位也變成手寫。紫色是參考，本站可沿用綠色品牌。 | 工具列與畫布沿同一 keyline，Freehand icon 進 GameUI registry，圖示槽与 hit area 分開。沿用 manual tabs／dialog／tooltip 契約，保 focus、disabled、pending 和減動。只取組織模式；不替換本站 canvas renderer、逐點同步或引入整個 React 編輯器。 |
| **PaperCSS — 紙張卡片／邊框示例**。[官方 cards](https://www.getpapercss.com/docs/components/cards/)、[borders/shadows](https://www.getpapercss.com/docs/utilities/borders/)、[colors](https://www.getpapercss.com/docs/utilities/colors/)、[官方 CSS](https://raw.githubusercontent.com/papercss/papercss/master/dist/paper.css) | 官方示例分 card body／header／footer，邊框有多種變體及小陰影。CSS 有白底、`#41403e` 灰墨、`#0b74d5` 次色及淺色背景，且帶全域樣式和手寫字型 import。這些是 source／文件事實，不是本站已呈現結果。 | 少量不規則邊框與薄陰影能襯托 Freehand；大量旋轉或每個元件不同邊框會破壞桌機資訊秩序。適合禮物／答案／收藏卡，操作表單和重要名單保持直線對齊。 | 自製 scoped `.ui-paper-card` 裝飾層，用 CSS 不對稱圓角或靜態 original SVG 邊框；`pointer-events:none`、不參與布局，不遮 focus ring。只容器外框略手繪，內部文字和 icon 槽無旋轉。不直接 import 全域 PaperCSS／字型。 |

以上是三種互補參考：Paper Dashboard 提供資訊層次、Excalidraw 提供作畫工作區分工、PaperCSS 提供紙張材質語彙；沒有主張它們都是桌機派對遊戲模板。

## 已找到但不納入已觀察畫面的作品

2026-10-08 root補原生觀察：[Ray Auguste的Game UI Paper Style](https://dribbble.com/shots/23710834-Game-UI-Paper-Style)在背景Chrome成功顯示作者圖，為深棕背景、米色紙張面板、破角輪廓、方形物件槽與深淺選取；私有完整頁圖freehand-reference-dribbble.png。這取代下方「root尚未取得像素」待驗狀態，下方是研究角色初期web提取的限制。作者作品沒有確認可重用授權，未下載原圖或搬用paper texture，僅補視覺比較。

[Ray Auguste — Game UI Paper Style](https://dribbble.com/shots/23710834-Game-UI-Paper-Style) 是直接相關的具體作者 shot。標題與作者已讀到，但本次 web 提取的 image link 指向 Dribbble 廣告，未取得實際作品像素，因此沒有替它編造配色、資訊布局或按鈕行為。後續可由主 agent 在背景瀏覽器觀看原頁再補比較；作品圖只供參考，不下載當本站資產。

## Freehand 的使用邊界

[Streamline 官方風格說明](https://home.streamlinehq.com/projects/content) 描述 Freehand 的自然手繪線條與 24px grid。這支持把同一 icon family 放進共用槽，但不代表所有 Freehand 資產免費，也不代表本次已挑選或匯入圖示。

實作時先逐功能盤點：邀請、設定、聊天送出、表情、媒體、播放、同步、刪除、收藏等，選同一 variation，保留語意不同的播放圖示。缺項用原創同風格 SVG 補齊或保留現有 registry，不把同一功能混成多套線條。操作仍提供中文 accessible name、hover／focus 提示和 touch 可理解出口；名稱、分數、倒數與遊戲結果仍是 DOM 正文。

[Streamline Free License](https://help.streamlinehq.com/en/articles/5354376-streamline-free-license) 要求適當署名及可讀連結，且特定 open-source set 另循其標示授權。實際採用前按選定 set／asset 核對授權，記錄來源、版本與署名；不能因作品頁可看、可下載或標「免費」就把整套素材搬進 app。本次沒有下載任何外部作品圖片、購買素材或複製模板程式。

## 本站第一批視覺提案

以下色值為**本站設計初稿**，不是從外部作品取樣或已測對比的結果：紙底 `#F6F2E8`、卡片 `#FFFDF7`、深墨 `#25392F`、操作綠 `#31584D`；淡黃／淡紫只用於選取、輪到你及少量結果提示。先與現有 light／dark tokens 一起做對比驗證，正文不放在低對比淡色上。保留必要邊線和現有品牌語意，不為統一配色更改角色圖片、emoji 或骰子結果。

| 遊戲／區域 | 優先採樣方向 | 必須保留的資訊／幾何 | 原生落點 |
| --- | --- | --- | --- |
| 整體 | 紙白卡片＋單一 Freehand 操作圖示；選取用薄色面和清楚邊線 | 固定共用入口、44px 操作區、focus、聊天與名單；不靠 hover 才看重要狀態 | GameUI registry／`ui-primitives.css`＋`ui-foundation.css` tokens；scoped paper decoration |
| 你畫我猜 | Excalidraw 的工具／白畫布分工；紙框只在外圍 | 畫布無旋轉、像素與筆跡時序不改；工具對齊、左名單／下聊天／倒數條保留 | 外層 pane／工具選取 surface；不重建 canvas 或新增逐 frame 背景 |
| 送禮達人 | PaperCSS 的禮物票卡與 card body 間距 | 常駐角色、收禮者、確認控制、完整結算；不變成大圖壓縮名單 | 禮物／結果卡的外框與 inset；gift 名稱和得分保持正文 |
| 雷霆之路 | 清楚 dashboard 信息層次，legend 圖示用同系統 | 車隊、車損、骰子、合法格與事件文字直接可讀；既有圓角 3D 骰子保持 | crew／command／legend surface；不用紙紋污染賽道、骰面或 hover 条件 |
| 同頻俱樂部 | 整齊答案紙卡，少量便利貼色面 | 玩家、選取／公開答案與結果；同尺寸卡片和鍵盤操作 | answer card＋selected check；卡片內容不旋轉、不依色彩辨狀態 |

## 後續驗收條件

先做共用元件小樣，再套各遊戲；每項列 before／after 與重要資訊仍可见的證據。需要看桌機 1280×720、寬高桌機、390px、真 200% zoom、長中文名稱、八席，以及 light／dark、hidden／disabled／pending。紙框不可遮文字、focus、下拉或 dialog；装飾不能創造額外 scroll 或改變 hit area。

若修改畫猜外框與工具，仍須持筆／ACK／換輪不閃白、viewer 逐點時序與倒數條回歸；若只改圖示，不把原 v1.14 的動效測試當新圖示可讀性驗收。效果是否較美、功能辨識是否更快，需要真畫面／玩家觀察，不能從來源名稱或研究表格直接宣布完成。
