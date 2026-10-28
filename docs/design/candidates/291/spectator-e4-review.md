# #291 E4／E2 公開觀戰候選與 Bridge 保存核對

2026-10-28。**未核定設計候選、無產品修改。** 本輪使用第三份 Figma 的「04｜預覽區」，不覆蓋共用元件或測試站／正式站畫面。前輪來源、工具失敗與限制保留於 [E1](spectator-e1-review.md)。

## 實際來源與修正

來源均在既有 [運動員 Stitch 專案](https://stitch.withgoogle.com/projects/6540616740381984054)，參考 main `4127a035`／3.12.1 合法公開投影。

| 狀態 | 最終候選來源 |
| --- | --- |
| 能力等待 E4-01 | `34b12b4925034cf081c9d5d4f21af0da` |
| 秘密選角 E2-02 | `704feb47d6f049e299c482320299097e` |
| 連接失敗 E2-03 | `c3ae642aa5e043ac8cfc9ba066059ab3` |

E2 三張實際 HTML 已核對：移除錯稱真實 Vue 元件的標記；離開入口改真正連結，能力等待 `/second-wind/ABC009`、秘密選角 `/second-wind/ABC007`、未知房間 `/ceo/ABCFFF`，沒有 confirm／console 假離開或返回大廳宣稱。錯誤不再推測觀戰授權或結束不可看；保持錯誤、重試、離開三者語意。全螢幕退出改14px且44px高。

E2 能力等待仍有每格約70px寬／固定120px高，角色姓名碎裂及同格第二人需垂直捲動的缺陷；保留 E2 歷史。E3 `dd3138e8f96c497586f232338697ed4c` 改寬格、同格完整名冊與僅水平捲動，但三個括號角色名又低於14px。E4 只補這三處共用字級，不改合法位置、名冊或其他狀態。E1／E2／E3 均未冒充最新全數通過版本。

## 實際核對與證據界線

- 最終組合為 E4 能力等待及 E2 秘密選角／失敗：三狀態 × 1920×1080／390×1080／320×1080 × 深／淺，共 **18組**。要求尺寸與 innerWidth 一致，文件 scrollWidth 不超過 clientWidth；可見文字節點無低於14px，無 input／select／textarea 或遊戲提交控制。
- 深／淺色在本機候選副本只切換原始 `prefers-color-scheme: dark` 媒體條件，沒有另改配色／排版或動作邏輯；實測背景與面板有分開。這不是 OS 主題偏好持久化驗收。
- E4 賽道0～30格完整；0格同時可見 Beatrice／Mr. Dice Guy 與 Charlie／Spoilsport，6格為 Avery／The Hose。每格加寬，捲動容器只有水平方向需要捲動，scrollHeight／clientHeight相同。此批 Figma 保存起始水平位置，最右端捲動稿與完整鍵盤水平捲動驗收仍未完成。
- E2三頁各深淺色共六次320px專注進入／Esc退出返焦通過；E4再驗320px退出14px／44px、返焦入口。錯誤重試有實際 disabled／pending，600ms後回同一錯誤並返焦重試鍵；未宣稱真實重連成功。瀏覽器 warn／error 記錄為零。
- 只用引擎合成公開 DTO 與本機候選；不把只讀 UI 或少數快照當成完整私密欄位審計，也沒有真人多端、正式網路或測試站驗收。

本機擷取 E3 時，完整 DOM 超過工具輸出上限而截斷，改以唯讀序列化排除頂層 Stitch injected 節點；初版序列化把 HTML 註解變成可見英文，已修正保留註解後重擷取，未修改 Stitch 原稿。另一輪因新開 Figma 分頁使 viewport 設定套到其他分頁，實測寬度一直320；該輪輸出另存 stale-viewport-history，不採用。重新建立單一驗收分頁，逐組先核對 innerWidth，尺寸不符即停止匯出；有效十二張向量及長圖才用於下述匯入。沒有用錯尺寸的畫面冒充1920／390通過。

## Bridge 與 Figma

桌面重新開啟後的工作階段沒有開發外掛項目，重新載入本機既有 Bridge 0.0.25 manifest；原生視窗最小化須先恢復。外掛起初 Unknown file／Disconnected，選取框架圖示觸發狀態交換後，`list_files` 恢復第三份文件，metadata確認04頁。未啟用 `run_script`；本輪圖層建立、SVG匯入及完整讀回均透過 Bridge。Computer Use 只用於恢復外掛與畫面核對。

Bridge 先讀現有04頁105個直接子項並檢查放置不重疊；新[比較框2331:15246](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2331-15246)為 **11808×3183、X160000／Y60000**。六欄依能力等待／秘密選角／錯誤各淺深色，桌機在上、手機在下。以下均已從獨立瀏覽器雲端重開，逐框選取尺寸核對 **12/12**：

| 狀態／主題 | 桌機節點／尺寸 | 手機節點／完整高度 |
| --- | --- | --- |
| 能力等待／淺 | `2331:15826`／1920×1252 | `2331:16036`／390×1675 |
| 能力等待／深 | `2331:15931`／1920×1252 | `2331:16127`／390×1675 |
| 秘密選角／淺 | `2331:15250`／1920×1080 | `2331:15448`／390×1673 |
| 秘密選角／深 | `2331:15349`／1920×1080 | `2331:15550`／390×1673 |
| 連接失敗／淺 | `2331:15652`／1920×1080 | `2331:15736`／390×1080 |
| 連接失敗／深 | `2331:15694`／1920×1080 | `2331:15781`／390×1080 |

完整 Bridge 讀回確認十二框、**528個可編輯文字**，Component／Instance均零；沒有整頁點陣圖匯入。文字基線、部分邊線／陰影仍為向量近似；沒有 auto-layout、token變數綁定或 prototype接線，不能稱共用元件化完成。Bridge overview PNG實際 **1772×478**，不把邏輯根框尺寸誤寫成PNG像素。

本輪也已在雲端重開先前 [D3／D4九框](athlete-d3-review.md)，根框7824×5662、X150000／Y60000，九個子框逐張尺寸 **9/9** 通過。這項取代前輪「雲端重開未確認」保存限制；不順帶核定其小字／原型等其他缺口。

Ignored 證據包括 `spectator-e2-matrix.json`、`spectator-e2-interactions.json`、`spectator-e2-retry-final.json`、`spectator-e4-checks.json`、`spectator-e4-focus.json`、`spectator-ready-matrix.json`、`spectator-ready-exports.json`、`figma-e-import-progress.json`、`figma-e-readback.json`、`figma-e-cloud-twelve-frames.json`、`figma-d-cloud-reopened-nine-frames.json`、各SVG／PNG與兩批雲端重開截圖。

## 未完成

觀戰其餘公開階段、賽道水平捲動後視圖、等待室完整展開、CEO等待／錯誤／未參與、中止／真實重連、完整共用元件及新版外殼核對仍待。#291不關閉；#284／#283／#288尚未開始。沿用Draft PR #294，未啟動CI／合併／部署。前批2155／前端254與build為main整合證據，沒有當作本輪重新執行。

本輪Git僅上述六份Markdown；`npm run test:affected -- --base HEAD` 對準 `4799df96` 文件差異，選取0/257，沒有執行自動測試；3.12.1版號一致性通過。`npm run format`／`npm run format:check` 為1066 checked、0 formatted、111 unchanged legacy、0 failures；diff check通過。不把瀏覽器候選操作當成產品測試或遠端CI。
