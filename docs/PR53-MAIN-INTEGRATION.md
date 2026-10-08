# PR #53：最新 main 整合與兩輪複查

2026-10-08；實作與複查：同一位 Codex agent。此文件取代原 PR 描述中的「尚未整合 main」狀態，不改歷史發布／tag 證據。

- PR：https://github.com/stanley021039/BGA/pull/53
- Base：`7149cea8b6fc451f5f88b7c8dc1b1e520a4e7d87`（main）
- 受測程式 head：`bb3ce44887ae0a85e6d7cfa164e5e8739fbc7e5b`
- 原分支 head：`f5a89a0b2cf6070c873567f4af00cbca6d0517af`；原 merge-base：`3b9363e2c0e7b815f77643b7a7137320de70e881`
- 修正採 merge commit 保留雙方歷史；整合後 base 已是 head 的 ancestor。其後僅追加證據文件，不移動原發行 tag。
- 整合候選：**1.19.0／schema 19，尚未部署**。1.17.x／1.18.0 已有另一套正式來源，故新候選跳過已發布號碼；#57 沿用同批整合候選號碼，不另冒稱第二次發行。

## 已修正的問題

| ID | 問題／觸發 | 修正與證據 |
| --- | --- | --- |
| F53-01（高） | 成就分支與 main 市場自動化各自使用 schema 17，直接選一方會遺失功能或拒絕合法舊資料 | 區分完整歷史 feature shape，拒絕 partial／偽造形狀；共同 schema 19 含成就、自動化與數值預測。升級在同一 transaction 內完成並檢查 FK。`schema-forks.test.js` 9 項涵蓋兩種 17、main 18、原欄位／徽章日期／市場結算、缺表拒絕與晚期失敗回復。 |
| F53-02（中） | 合併市場新頁面會漏掉共享 tabs、表單驗證、dialog 取消控件與 header 彈幕偏好載入 | 保留六個市場頁籤、數值預測與放大圖，同時恢復共享 widgets、native constraints、`data-ui-close` 與 script 載入順序；既有圖片／市場／widgets 回歸通過。測試 harness 改為傳入真實 pagehide event 形狀，不改瀏覽器語意。 |
| F53-03（中） | main scheduler 的測試 AI 與原成就 transition／pending retry callback 在衝突中只能留下其中一份 | 保留 AI stroke publish、逾時計畫與逐房 `finally` 成就 callback、sweep retry；畫者 bot 不以 lastSeen 誤判斷線，真人斷線仍標 interrupted。AI scheduler、成就引擎／HTTP／retry 及隔離三席流程通過。 |

市場自動化／曲線 SQL、日期、frozen reference、數值計分、圖片預覽與 admin 權限沿用 main。共用 UI、WebGL／骰子、13 枚成就與歷史資料契約沿用原 #53。不是用單方檔案整批覆蓋另一方功能。

備份相容：原 pre17 descriptor 契約保留；缺成就 digest 的 main 17／18 備份僅在已解密驗證的實際 DB 為完整市場形狀、沒有 unit/progress 表且 descriptor maximumSchema≤18 時接受。帶單位資料或目前 descriptor 不能省略 digest；schema16/max17 的模糊缺 digest 描述仍拒絕。相關正反例與帳號／badge／BLOB 保留在全套驗證中覆蓋。

## 審查回合一：規格／範圍

對照使用者「處理既有 PR 問題」、原 #53 範圍及 main 市場／AI 已完成的功能，直接核對上述固定 base/head 的差異、呼叫端與測試。衝突已解決；兩方路由、設定、controls、AI、成就與資料模型均保留。歷史 schema17 不是以號碼猜來源，而依完整結構判定；未完成勝場／persistent outbox／自訂彈幕上傳仍明確列 backlog。此批未動正式資料或服務，符合 PR 修正範圍。

結論：本次已檢查範圍符合需求；沒有待解重大規格問題。UI 最終紙卡外觀由接續 #57 提供，#53 不冒稱已完成 #57 主題。

## 審查回合二：程式／回歸／風險

分開核對 migration 交易與回復、shape/constraints/FK、舊 bundle 認證／digest、canonical account／成就重播、scheduler 所有 continue 路徑、AI deadline、市場 revision／native form／dialog cancel、script order 和静態路由。直接執行回歸，修正後再次檢查受影響頁面。只提交程式、文件、合成資料 screenshot；帳密、cookie、SQLite、env、私有交接不進 Git。

結論：F53-01～03 已修正並複驗；本次已檢查範圍未發現待修正問題。這不是全瀏覽器／全部玩法或程序當機後 pending 永續化的保證。

## 驗證與限制

- Linux Node 22.22.1，`TMPDIR=/home/ccc/.cache/afterhours-ui-tests npm test`：**1,712/1,712**，0 failed/cancelled/skipped，282,360.896983ms。
- 初次整合 suite 1,710/1,712：漏載 header module 與舊 harness 缺 pagehide event；均已修正，最終全套重新執行。早期 schema assertion／fixture 寫法的失敗不當作通過。
- 既有市場圖片 browser 34/34；市場／curve／automation／widgets／frames 相鄰 focused 驗證完成；新分支 migration 9/9。
- Chromium 隔離三席：撲克 call/check、race 骰子視窗、同頻抽題／作答／揭曉、送禮三人分配／收禮／揭曉、畫猜實際 stroke ACK／觀看者像素／undo；五款 200% root text 無 document 溢出。`docs/evidence/pr53-integration/game-interactions.json` 與 screenshot 為本輪證據。
- `release:check --base origin/main --type minor`、syntax checks、`git diff --check` 通過。Repository 沒有 workflow 檔案；GitHub 狀態／workflow 查詢沒有記錄，不能称 CI 通過。
- 未重跑 Windows 全套；未驗 Safari／真機、完整讀屏、所有回合／FPS。原未提交 RAM pending 當機遺失風險仍在 backlog，沒有在本次衝突修正中宣稱 persistent outbox 完成。

**不部署此候選。** 正式 shhuang.cc 仍 v1.18.0／schema17。將來升級到 schema19 前需另行備份與正式驗收；升級後不可直接以不支援19的舊程式讀新資料作回退。
