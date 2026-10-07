# Threads 推薦元件庫與本站美化評估

查核日期：2026-10-07。結論：可以參考這五個庫的元件結構、選取回饋與短動效，但本站先以既有 GameUI、原生 DOM/CSS 和局部 WebGL 落地，不為美化搬入整套 React／Next.js。最適合的三個模式是**清楚的操作分組與選取、可達的 dialog／tooltip、有限時的事件回饋**。

## 來源與證據邊界

使用者指定 [Threads 主串](https://www.threads.com/@this.web/post/DV7hkDtkgJc/)。主 agent 以背景 Chrome 讀到主串及五則作者續帖，確認推薦 Magic UI、Aceternity UI、shadcn/ui、React Aria、React Bits；web 工具直接讀 Threads 不成功。作者對通知、捲動、表單、鍵盤與 shaders 的描述是推薦觀點，不是本站效能測量、授權證明或已完成實作。

本文件另查官方元件、registry、安裝文件及 license。GitHub 星數、宣傳的元件數與熱門排名不作採用理由。下面「可採用」代表設計模式適合；「局部轉寫」指依本站需求自行實作，不表示把 React 原始碼刪掉 import 就能直接使用，也不免除衍生程式碼的授權條件。

## 五庫比較與採用方式

| 官方庫／具體元件 | 實際依賴及授權查核 | 本站適合之處與實作映射 | 本批判斷與不採用部分 |
| --- | --- | --- | --- |
| **Magic UI**：[Animated List](https://magicui.design/docs/components/animated-list) | 官方 [registry](https://magicui.design/r/animated-list.json) 是 React TSX，使用 `motion/react`；[安裝](https://magicui.design/docs/installation) 走 shadcn CLI。免費 repo 的 [LICENSE.md](https://github.com/magicuidesign/magicui/blob/main/LICENSE.md) 為 MIT；Pro 模板不能由此推定同條款。 | 借通知卡的圖示／標題／次要資訊層級，用現有 surface／radius／shadow tokens。新通知可一次淡入或小幅位移；公開分數和內容先更新 DOM。 | **可參考視覺、局部自製短回饋**。原 Animated List 延時逐項展示的方式不直接套在玩家名單、猜題聊天或待播清單，避免延遲資訊、反轉既有排序或不断跳版。 |
| **Aceternity UI**：[Animated Tabs](https://ui.aceternity.com/components/tabs)、[Card Hover Effect](https://ui.aceternity.com/components/card-hover-effect) | 官方定位是 [React／Tailwind／Motion 元件](https://ui.aceternity.com/)，元件使用 shadcn registry；[Pro 安裝](https://ui.aceternity.com/installation) 另有 React／Next.js 與 Tailwind 流程。[licence](https://ui.aceternity.com/licence) 是 Aceternity／Pro 條款，允許產品用途並限制素材或模板再分發；本次未找到可把所有免費單件概括為 MIT 的官方依據。 | 借 tabs 的共同選取表面與卡片分組。本站選禮／選項／畫具保留真實 `selected`／`chosen`／`aria-pressed`，以边框＋文字或圖意表達。 | **參考模式，直接複用程式碼須逐件再查授權**。不採大型視差 Hero、scroll 敘事、攝影機 pixel grid、3D 傾斜重要控制、隱藏捲軸或無限背景；不讓 hover 取代鍵盤狀態。 |
| **shadcn/ui**：[Button Group](https://ui.shadcn.com/docs/components/button-group)、[Tabs](https://ui.shadcn.com/docs/components/tabs)、[Dialog](https://ui.shadcn.com/docs/components/radix/dialog) | [repo license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md) 為 MIT；官方程式是 React 元件，依元件／variant 使用 Base UI、React Aria 或 Radix，不能一律說全庫只依賴 Radix。[安裝](https://ui.shadcn.com/docs/installation) 提供框架與 manual 流程，並非原生 script 一檔即插即用。 | **優先採模式**：動作按鈕用有名稱的 `role="group"`，切換狀態才用 toggle／tab；同組邊界、少量分隔、disabled 與 focus 清楚。媒體全桌／個人控制已是兩個命名 group，延伸共用 GameUI 與 tokens 即可。 | **通用模式最適合，本批不安裝框架**。不能把所有分組都改成 tabs、把管理等低頻入口做高亮，或為統一外觀隱藏重要數值。維持現有圖示 registry，不混入另一套 icon 風格。 |
| **React Aria**：[Tabs](https://react-aria.adobe.com/Tabs)、[useDialog](https://react-aria.adobe.com/Modal/useDialog) | [getting started](https://react-aria.adobe.com/getting-started) 安裝 `react-aria-components`，CSS 示例仍對應 React；hooks 亦使用 React。Adobe repo 的 [LICENSE](https://github.com/adobe/react-spectrum/blob/main/LICENSE) 為 Apache-2.0。Tabs 文件区分自動／手動鍵盤 activation 及 disabled；Dialog 文件說明命名與焦點進出／限制。 | **優先採互動契約**：對話框標題关联、Escape／close 返回觸發點、modal 焦點不漏出；提示支援 hover／focus、中文可讀名稱、邊界定位與必要 touch 說明。保留本站原生 `<dialog>` 與 `GameUI` top-layer hint。 | **參考鍵盤與可達性，非整套移植**。原生實作必須自行驗收，不能借用了外觀就宣稱獲得 React Aria 的整套可達性。官方舊 `useDialog` 文案對 `<dialog>` 支援的歷史概述不作本站當日瀏覽器結論。 |
| **React Bits**：[Particles 原始碼](https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/Particles/Particles.jsx)、[官方站](https://reactbits.dev/) | 受檢 Particles 使用 React hooks＋`ogl` WebGL 封裝；不是所有 React Bits 元件都依賴 OGL。[當前 LICENSE.md](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md) 是 **MIT＋Commons Clause**：可作網站／產品、含商業用途，但限制元件本身的轉售、再授權或再分發，包含 bundle／移植版，且須保留適用 notice；不能記成純 MIT。 | 借粒子色彩／形狀與低干擾回饋概念。本站首批 `game-fx-layer.js` 自製原生 WebGL1，只在車旁短時氮氣／煙霧／火花；原 SVG、文字、車輛與互動保留。 | **只參考效果概念，本批獨立手刻 shader**。不複製其元件或 shader、沒有安裝 React／OGL，也不宣稱效能等同該庫。將來若複用或發布元件移植版，要依具體檔案與當時條款再確認；不加入全桌持續流動背景。 |

授權欄是當日官方檔案摘要，沒有替尚未選定的單件、付費 pack、第三方圖片／字型或外部依賴核准使用。參考結構並自行設計與直接複製／改作來源碼要分開記錄；本次未購買服務、安裝這五庫或上傳玩家資產。

## 優先落地的三個模式

| 模式 | 本站候選與方式 | 必要驗收與避免的問題 |
| --- | --- | --- |
| **一、操作分組＋固定選取** | 媒體沿用全桌／個人 group；畫具、選禮、同頻選項沿用狀態。用共享 panel／inset、控制邊線、8／12／16px 圓角；字級仍14／16／20／28／32，重要數字 lining／tabular。 | 動作 group 不能冒充 tabs；tab 若實作須有完整 panel 关联與鍵盤契約。選取同時有強輪廓與既有文字／圖意，hover 不抹掉選取。36px 細桌機媒體、44px coarse 操作、queue 4／6px 密度保留。 |
| **二、浮窗＋可達提示** | 設定、表情、素材庫與媒體用 floating／title 表面；提示繼續一個共用 top-layer 節點與 viewport clamp，圖示中文名稱不省。 | `<dialog>` 開閉／Escape／返回焦點、被遮擋与視窗邊緣、disabled／pending／hidden、touch 與200%文字。影片移動／縮放不能重建 iframe 或發媒體控制封包；題庫 dialog 不變為新頁面。 |
| **三、單次短回饋＋局部粒子** | 日後新成就／公開結果可在正確 DOM 內容上做一次小幅 opacity／transform；雷霆首批粒子沿現有權威事件觸發。 | 候選120–180ms不是已量得最佳值；粒子使用獨立有限生命週期。MotionPolicy、OS reduced motion、背景、換輪、resize、離頁與 context loss 清理；無常駐 rAF 或每幀 API；不延後車輛逐格／碰撞／事件處理。 |

第三項的短通知與成就外觀仍是後續候選，不能和本批車旁 WebGL 混寫成全部已完成。遊戲輸入不採磁吸按鈕、跟隨游標鏡頭或重要文字逐字揭露；它們會改变 hit area、遮擋或延遲讀取，與桌機單畫面資訊優先的方向不符。這是本站設計判斷，不是宣稱那些庫的元件本身有缺陷。

## 現有程式映射與待確認

本批共用 CSS tokens、各遊戲表面與原生 WebGL 的實作是延續 [DES13 評估](UI-POLISH-DES13-ASSESSMENT.md) 和 [WebGL 評估](WEBGL-ADOPTION-ASSESSMENT.md)。它們已由本站程式方獨立開發，不能因後來閱讀這五庫就說成「已移植 Magic UI／React Bits」。source 契約、測試、背景 Chrome 與發布狀態以 [第一批 spec](../specs/UI-POLISH-WEBGL.md)／[進度](../UI-POLISH-WEBGL-PROGRESS.md) 為準；本研究沒有另發 PR 或部署。

| 現有位置 | 可借的模式 | 邊界／下一個證據 |
| --- | --- | --- |
| `public/shared/ui-foundation.css`、各遊戲 CSS | shadcn／Aceternity 的表面與選取結構 | 重要玩家／角色／剩車／骰子常駐。每個 caller 實際對比與字體需驗，token 公式不等於螢幕像素；只有陰影不能表示必要狀態。 |
| `public/shared/ui-components.js`、`ui-primitives.css` | shadcn／React Aria 的 group、命名、focus、tooltip | 共用 registry／symbol／hint，不增第二套圖示系統。先驗全站同類問題；本研究沒有重做全部 tabs／dialog 或跑讀屏認證。 |
| `public/shared/table-media.js`、`table-media.css` | 命名 group、浮窗／單行清單 | 保留原生本機 seek＋明確發布、房間 ACL、個人关闭、兩窗順序與 drag／resize 清理，不把 UI 模板當媒體協定。 |
| `public/shared/game-fx-layer.js`、`race-vehicle-effects.js` | React Bits 的局部粒子概念 | 本站原創 point shader與SVG／CSS回退。實際 GPU／軟體 renderer、像素可見、frame budget、context loss 等以本批實測為準；網站 demo 不能證明本站更快。 |

後續若選定複用單件，先固定來源 commit、原始 license／notice 和該單件依賴，做同尺寸／同資料的前後比較，再決定加入。Aceternity 免費單件的授權尚須逐件確認；React Bits 元件作移植庫再分發的適用性尚未核准。本批不因這兩項待確認而阻止原創 CSS／WebGL 實作。

這次完成官方研究與取捨，尚未量測五庫 demo 的效能、正式遊戲所有流程、不同硬體／讀屏或真人喜好；沒有 FPS 排名、加速比例或自動 Canvas fallback 的承諾。
