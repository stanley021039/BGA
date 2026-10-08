# PR57 評論修正

2026-10-08，回應 [Carousel P2](https://github.com/stanley021039/BGA/pull/57#issuecomment-6056197645)。沿用原PR；1.19.0尚未合併／部署。

## Carousel

原本350ms滑動尾端click防護攔住controller自己觸發的click，畫面切換但hub selected未更新。現在以activationCard標記同步的controller activation，只豁免其選中卡片的click；try/finally立即清除标记，不縮短原生尾端click防護窗口。gesture終了不再暫時清除整個防護。

`tests/carousel-selection.test.js`執行實際carousel與hub selection／create函式：swipe→100ms內ArrowLeft／ArrowRight／Home／End／Previous／Next，確認可見卡片、dialog、hub selected及create type；End到市場時保持不開房。防護期間非controller卡片click仍被攔，超時後可點擊。

真Chromium滑鼠拖曳thunder→majority，緊接在350ms內透過瀏覽器KeyboardEvent或導航button.click切換，再用原生開房按鈕呼叫真正HTTP：ArrowRight／Next建立gift，ArrowLeft／Previous建立thunder。非controller click防護仍有效。這裡的鍵盤驗證是瀏覽器事件，不宣稱本輪實體鍵盤硬體操作。量測見 [carousel-review-results.json](carousel-review-results.json)。

## 相依 PR53

已同步`bf545ae`的混合真人／AI成就修正到本branch，三款引擎與測試跟PR53一致。真人缺映射仍fail-closed，AI不授成就，歷史interrupted receipts不改寫。詳 [PR53本輪紀錄](../PR53-MIXED-AI-REVIEW.md)。CHANGELOG合併衝突只保留雙方條目，没有丟棄前次內距／空位修正。

## 本輪驗證

Linux相關69項通過：carousel-selection、playful-assets、achievement-http、achievement-unit-engines、achievement-units、achievement-pending-retry、local-ai-http。release check與diff check通過。PR53單獨67項亦通過。未重跑全suite，前次完整1712／1726只對應前次固定source。

## 分開審查

第一回合（需求／範圍）：核對相依base `bf545ae`與本輪code head `fe9ad5b9b512f90224452c419a21330845daf000`，Carousel評論所有輸入路径覆盖；PR53修正完整承接；沒有改既有API或大廳角色移動，沒有新PR、合併main或部署。

第二回合（品質／回歸）：對照e308b5e追加差異，controller豁免仅在chosen.click同步呼叫期間有效、finally清理；普通拖曳尾端事件仍阻挡，有限邊界／市場入口保持。真人AI身份在開始時凍結、缺真人映射不能由AI補足；pending／冪等／真AI排程回歸通過。本批未見未解阻擋問題。正式v1.18.0與其資料沒有操作。
