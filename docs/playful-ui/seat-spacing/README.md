# 賽道紀錄內距與空座位修正

2026-10-08，PR #57 追加修正；候選仍為 v1.19.0。正式 v1.18.0 未部署本批。

## 改動

- `public/shared/playful-theme.css`：雷霆側欄賽道紀錄加入 16px 內距、標題下方 8px 間距。原本側欄將 padding 清成 0，主題重新加入邊框後文字只隔 2px 框線。
- `public/app.js`：未入座位置使用空的 hidden 節點，保留六個 nth-child 定位槽，不顯示空位框或文字。
- `public/race.js`：沒有玩家時不產生車隊卡片。仍顯示實際玩家，包括離線、棄牌、出局及 AI。
- `tests/empty-player-slots.test.js`：執行實際 renderer 片段，驗證撲克 1–6 人原座位索引、空位 hidden 與雷霆空車隊／離線出局玩家。
- `CHANGELOG.md`、角色記憶與本文件補記驗證。API、server、資料庫、WebSocket 與遊戲規則沒有變更。

## 驗證與證據

Linux Node 測試 41 項通過（empty-player-slots、race-presentation、poker-create-contract、room-components、color-scheme）；`npm run release:check`、`git diff --check` 通過。本輪沒有重跑完整 suite；先前 1,726 項紀錄仍只適用其固定 source。

Chromium 載入 Linux 隔離伺服器／暫存資料庫：兩款遊戲各測 2、3、滿席，1440×900／768×1024／390×844，亮暗兩模式，共 36 組版面。檢查實際 DOM 玩家數、空位可見性、撲克原座位索引、賽道標題與邊框距離及文件溢出。修正後全部通過，雷霆 padding 為 16px、文字距框外緣 18px（包含 2px border）。兩款滿席及兩人房皆透過原 API 開始；兩人 playing 狀態空位仍不顯示。

`before/` 與 `after/` 各有 8 張前後截圖及 results.json。前圖第一輪來源為修改前程式；為移除媒體同意視窗遮擋，保存的前圖由瀏覽器攔截三份靜態資源還原這次修改前字串／規則重新拍攝，伺服器及正式環境未回退。後圖直接使用修改後資源。只用測試帳戶與 AI；未接觸正式房間。

已目視確認雷霆暗色手機、撲克亮色桌機截圖。未宣稱所有遊戲 phase、真實多人網路、FPS、讀屏或完整 accessibility 全數驗證。

## 分開審查

第一回合（需求／範圍）：對照上一個 head `13bd59c` 的追加差異，兩項使用者需求均完成；沿用 PR #57，不改其依賴 PR #53，不合併、不部署。等待畫面也不再顯示空位框，實際玩家與原座位布局保留。

第二回合（品質／回歸）：hidden 由現有全域規則設為 display:none，nth-child 槽位未被刪除；雷霆只略過 null 玩家，不過濾 offline/out。CSS 限定 playful/race 側欄，不改棋盤、畫布或 renderer 動畫。回歸測試與瀏覽器矩陣通過，未見本批阻擋問題。schema19 整合候選仍未部署，部署須另行安排。
