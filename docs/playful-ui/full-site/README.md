# 全站纸卡介面與對齊，候選 1.17.1

日期：2026-10-08。正確來源是 Linux `/home/ccc/apps/afterhours/worktrees/playful-ui`，分支 `codex/playful-board-game-ui`，正式基線 1.17.0／6be11b4。沿用原生 HTML/CSS/JS、GameUI、MotionPolicy 及既有所有 API／多人傳輸，沒有換 framework 或加入依賴。

## 使用者決策與實作範圍

這輪將大廳已接受的紙卡視覺擴展到登入、五款等待房／遊戲中、股市冥燈，以及角色、形象設定、收藏、成就、歷史、題庫、留言板、音樂與管理頁。共 21 份 HTML 使用同一 opt-in 主題。

最新指示是「排版方式可以根據遊戲不同，只是要對齊」。最终保留撲克牌桌＋側欄、雷霆寬賽道＋下方車隊、同頻／送禮內容＋操作區＋下方玩家、畫猜既有布局；沒有統一成三欄。頂部／欄間距與內距共用 token，沒有依靠 overflow:hidden 遮住超出頁面的內容。原本已有的舞台、賽道、玩家列表局部捲動保留。

開房暱稱欄位移除，使用帳號「形象設定」保存的 displayName。為相容原 handler，舊 input ID 改成原生 hidden input；不再是可編輯／可聚焦欄位。Server 本來就以 authenticated user.display_name 決定入座名字，不信任 client name。新增回歸測試覆蓋五款 create/join 及修改帳號暱稱後的名稱一致性。

直接進入撲克入口另發現既有 create handler 未傳 type，實際 API 返回 INVALID_GAME。僅在 create 補 type:poker，join 保留依房間 code 解析原行為。新增 actual enter() 測試先確認舊碼失敗，再修正通過；不是重寫撲克引擎。

## 檔案

- `public/shared/playful-theme.css`：配色／字體／間距／邊框／陰影與各頁 opt-in 表面；針對舊深色文字及 panel 明確覆蓋，保留撲克紅黑花色、暗牌背面、車隊色、純白畫布、選取框及急迫計時狀態。各遊戲區塊的 alignment 規則放在同檔末段。
- 21 份 `public/*.html`：共用主題引入；登入換用既有原創插畫、呈現六款遊戲；同頻／送禮階段標頭及步驟移到完整 grid row，令內容與操作區從同高度開始；雷霆等待圖採原創 SVG；大廳與撲克開房 input 改 hidden；撲克次要資訊與動態可展開。
- `public/shared/game-shell.js`：沿用 GameUI utility 圖示與說明，紙卡撲克的牌桌資訊用 native details；沒有改座位、權限、事件或傳輸。
- `public/majority.js`：只改 entry template 的暱稱欄位為 hidden，既有讀值與帳號 refresh 保留。
- `public/app.js`：撲克直接 create 補 type，其他玩法與 handler 不變。
- `tests/room-account-name.test.js`、`tests/poker-create-contract.test.js`：名稱權威與直接開桌契約回歸。
- package / lock / CHANGELOG：相容排版及流程修正 patch 至 1.17.1。

Git diff 核對：src/（含 API、DB、引擎、room lifecycle）、hub.js、lobby.js、race.js、gift.js、draw.js、作畫 transport／renderer 均無修改。必要的前端 changes 已逐項列出，不宣稱所有 JS 均未變。

## 證據與驗證

- `before/`：1.17.0 既有介面 75 組截图（登入、14個輔助入口、五款等待／開始後，三種 viewport）。
- `after/`：全站主題初版與實際遊戲操作證據；`aligned/` 是採納最終「各遊戲布局不同，只需對齊」後的最新 75 組畫面。較早中間檢查不代表最終方案。
- 三 viewport：1440×900、768×1024、390×844；最新矩陣 75/75 無 document 水平溢出、無 pageerror，原生 [hidden] 沒有顯示出來。
- 四款等待房 actual DOM 量測：主要內容與操作區 topDifference 全是 0px，columnGap 全是 16px，見 `aligned/alignment-results.json`。畫猜保留原排列，不使用這四個遊戲的兩欄規則。
- 原生登入表單真實成功；原五款三席等待→start→遊戲狀態通過。
- 實際操作：撲克 call/check ACK；雷霆 round dice dialog 與車隊色；同頻抽題／選題／三人作答／揭曉；送禮三人配禮／四心願／逐人收禮／計分；畫猜選題／鼠標筆跡／真實 stroke ACK／觀看者 canvas 像素／undo command。見 `after/game-interactions.json` 及對應圖。
- 五款實際遊戲頁 200% root text（以 root style 觸發既有 text-scale observer）無 document 溢出，OS reduced motion 對 MotionPolicy 生效。中途以新增 stylesheet 放大、不觸發 observer 的診斷不是產品缺陷，未為此改 renderer 或文字 policy。
- `aligned/account-name-results.json`：獨立測試帳號經實際形象設定表單保存名字，再從大廳／撲克／同頻入口建立房間。沒有可見暱稱 input，server state 使用保存的 displayName。
- 固定實際普通文字、solid background 抽樣對比檢查沒有低於對應閾值的結果，見 `after/contrast-audit.json`。這不是全面 WCAG 合規或真人讀屏驗證。
- 完整 Linux `TMPDIR=/home/ccc/.cache/afterhours-ui-tests npm test`：**1,526/1,526 通過**，0 failed/cancelled/skipped，258,083.711972ms。新／相關 focused 13/13 通過；直接開桌 regression 已有修正前失敗證據。
- release:check --base v1.17.0 --type patch 與 git diff --check 通過；最新 changelog 只補文字，gift 空行 whitespace 修正不影響程式行為。

所有自動化帳號、房間、profile 設定及遊戲操作均在 Linux localhost 的隔離暫存資料庫執行，externalSideEffectsEnabled=false。沒有在正式站建立測試帳號、遊戲桌、貼文、投票或變更使用者暱稱。截圖中的身份／房號均為測試資料；credential／cookie／raw auth responses 沒有進 Git。

## 未驗範圍與發布

真機 iOS／Android、Safari、真人讀屏、全部棋盤組合／每款所有回合、真 YouTube 播放、FPS／負載未驗。沒有新增動畫或更換作畫 renderer，不以最終畫作像素推定逐點時序全面原生驗收。

上線結果與固定 commit／tag／資料備份／公開驗證將另記 `deployment.md`。部署授權延續使用者已明確要求更新 shhuang.cc 測試的本次工作；資料 schema 沒有修改。
