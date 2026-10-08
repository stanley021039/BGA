# PR #57：全站繽紛紙卡與亮暗模式整合複查

2026-10-08；同一位 Codex agent 分開完成規格及程式／風險兩個回合。

- PR：https://github.com/stanley021039/BGA/pull/57
- 相依 base #53：`6fb3f32a107b278d411334ebe14b71116e492584`；其中受測程式 `bb3ce44887ae0a85e6d7cfa164e5e8739fbc7e5b`，後續只補證據文件。
- 本 PR 受測程式：`7d20d1bfda2c481a3502461ed76d63355cf75bdd`；`9bbd18549c9c860948597215ad02835b047889d0` 再納入 #53 的證據文件，實際程式未改。
- 審查範圍：目前 base #53 到上述 head 的差異；共同 main ancestor 為 `7149cea8b6fc451f5f88b7c8dc1b1e520a4e7d87`。#53 已另外完成雙回合與全套；本 PR 不以舊發布測試冒稱整合驗證。
- 候選 1.19.0 與 #53 為同批整合，避免重用已發布 1.17／1.18 的 tag；**尚未部署**。正式 shhuang.cc 仍 `v1.18.0`／`8a1d0e1`。

## 回合一：需求／規格

對照使用者已確認的紙卡範本與後续要求，直接核對頁面、token、controls 與實際流程：

| 需求 | 結果／證據 |
| --- | --- |
| 全站一致的 playful board-game 語言 | 六張原創 SVG、共用 tokens；登入、等待、遊戲、帳號、題庫、Dialog 等 21 HTML 啟用同一主題。78 組最新 dark matrix 無 document 溢出／pageerror。 |
| 大廳角色移動與原玩法保留 | 未更換 lobby movement 或作畫 renderer；原 JS／權威房間契約保留，五款三席原生流程通過。 |
| 各遊戲可以不同排版，只要對齊 | 撲克、race、同頻、送禮與畫猜各保留原 board geometry，統一內容／操作框對齊及間距，不强制三欄。 |
| 開房使用帳號設定的暱稱 | 隱藏舊兼容欄位、canonical displayName 仍由 server 驗證；直接撲克開桌補上既有 type 契約，測試覆蓋舊版失敗。 |
| 系統 dark preference、鮮明亮色、設定旁切換 | head bootstrap 先讀取 auto/light/dark；近黑與鮮綠／粉紅／橘黃／藍紫；亮色區深色字。太陽／月亮按鈕、reload、storage、回復auto、保留表單草稿及320px focus通過。 |
| 多種可選風格的未來方向 | `STYLE-BRANCHES.md` 記錄維護／保存分支與主題系統計畫；多風格選單未實作。archive分支保留ba0811b不移動。 |
| 相依整合不能丟失 main 新功能 | #53 schema19、AI、市場自動化／數值預測／六頁籤保留；新市場卡片／table／plot加入同一主題。實際range→投票ACK、live curve、行情／排行／admin、五組light/dark響應式圖通過。 |

結論：本次已檢查範圍符合已確認需求；沒有待解重大規格問題。不是只有大廳樣板，也不把尚未完成的多風格選擇器寫成上線功能。

## 回合二：程式品質／回歸／風險

分開讀取實際差異與呼叫端：確認共用 token 優先序、原生 [hidden]／disabled／pending、亮色填滿區的文字、特殊白畫布／紅黑牌、SVG plot 軸與表格內部捲動；查看 Carousel pointer／keyboard／finite bounds／reduced motion。核對 appearance 白名單、讀／寫storage失敗回退、media change、跨分頁及匿名頁、registry圖示／aria-pressed／可讀名稱；不寫帳號或房間資料。

直接核對 create payload、canonical names、static asset allowlist、GameShell 玩家／媒體 docking，确认相依 AI 支援與市場新控件沒有被樣式覆蓋或丟失。市場 numeric UI 只改表面／stroke／字色，slider、計分 math／frozen reference、media responsive geometry和API保留。

只有原創 SVG、程式、文件與合成測試／匿名正式登入頁 screenshot 進 Git。沒有包含帳密、cookie、環境檔、SQLite 或私人測試登入 JSON。固定 tag 和保存分支不移動，正式 writer 沒有重新啟動或升級資料。

結論：本次已檢查範圍未發現待修正問題；既有 #53 衝突修正已納入。限制按下節記錄，不保證所有環境／玩法沒有 bug。

## 本輪驗證

- Linux Node22.22.1，`TMPDIR=/home/ccc/.cache/afterhours-ui-tests npm test`：**1,726/1,726**，0 failed/cancelled/skipped，287,315.513462ms；對應 7d20d1b 的程式。
- #53完整1,712；9個新歷史分支migration／備份正反例，以及共同schema19原子升級在相依報告中記錄。
- Chromium dark matrix 78；1440×900／768×1024／390×844。manual toggle另驗320／390／768／1440、Enter、reload、跨分頁、auto与modal草稿。
- 五款隔離三席：poker call/check；race 原生骰子視窗；majority question／三席答案／reveal；gift give/wishes／accept／reveal；draw native持筆、ACK、觀看者canvas像素與undo。五款200% root text无document溢出。
- 市場 actual slider→POST ACK，live plot、六頁籤與main功能保留；light/dark desktop/tablet/mobile screenshots及table內部scroll。
- 固定普通文字／solid background的對比抽樣沒有失敗；不是全面WCAG認證或完整讀屏驗收。
- `release:check --base v1.18.0 --type minor`、`git diff --check`；GitHub沒有 workflow／CI記錄，不宣稱CI通過。

證據：`docs/playful-ui/pr57-integration/dark/` 與 `market/`。本輪隔離 temporary DB，externalSideEffects與marketAutomation均關閉；沒有在正式站建立房間／預測或改帳號設定。未重跑Windows完整套件、真機Safari／讀屏／所有回合／FPS。輸入事件的途中品質只按本次取樣記錄，不由最終圖片推定所有影格。

合併順序：先 #53，接著把 #57 base 改為 main再合併。此次只提交供審查，不合併、不部署1.19。schema19正式切換／回退限制見 [PR53整合](../PR53-MAIN-INTEGRATION.md)。
