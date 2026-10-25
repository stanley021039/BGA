# #227 初代 36 名角色與 main 3.2 整合

2026-10-25，使用者要求續做 #227 新留言「好像有缺36隻初代腳色」，並將最新 main 整合到既有 worktree。沿用 `codex/second-wind-227` 與原票；#226、#227 均保持進行中。這是 3.3.0 人工驗收候選，未宣稱已發布、部署或完成全部官方裁定。

## 範圍與已實作候選

- 整合當次 `origin/main` `4d9bc79`（3.2.0）。保留 main 移除歷史功能、房間管理員與 Document PiP 的方向；CEO／運動員刪除失效的 history hook，HTTP 回歸改驗證歷史路由 404，不恢復舊功能。
- 新增 CMYK 2025 初代本體 36 名角色，與原 Second Wind 36 名分開。等待室可選 Second Wind 36／初代 36／混合 72，預設仍為 Second Wind。設定與開局使用 main 的房主／管理員權限；一般玩家、無效牌庫及賽中修改均拒絕。已開局牌庫不被後續設定改寫。
- 36 名均有能力執行分支，含替代主移動、可選重擲、骰值與距離分離、絆倒、超越、同格、跟隨、複製、開賽抽牌、預測、插隊與能力積分。私有抽牌與選擇沿用伺服器投影與 revision／receipt 機制。
- 英文卡面 36 張與獨立 96px 頭像 36 張共 581,070 bytes，WebP、Vite hash、延後載入，沒有原 PDF 或遠端執行期圖片。manifest 記錄來源／輸出 SHA256、尺寸、容量與來源頁碼；工具 `tools/second-wind-base-art.py` 可從本機 PDF 重建。沿用既有卡面裁邊與中文能力 hover。
- 保留 Second Wind 的兩條賽道、13 張 Twist 與使用者核准暫用獎分。這一輪沒有新增初代賽道、舊版角色或玩家自製擴充。

## 規則與圖片來源

- [CMYK 官方產品](https://www.cmyk.games/products/magical-athlete)。
- CMYK 更新版英文規則書，實體頁 23 的連鎖／同時抵達／修正順序，頁 24–27 的完整卡面與能力註解。[發行商編寫 PDF 的鏡像](https://johnnlds.github.io/Magical-Athlete-Racers/officialrules.pdf) 僅用於取得規則書，不採用該網站的自製角色。
- [IELLO 官方遊戲頁](https://iello.fr/jeux/athletes-de-compete-magical-athlete/)、[法文規則書](https://iello.fr/wp-content/uploads/2026/02/Magical-Athlete_Rulebook_FR_Light.pdf) 與 [官方 FAQ](https://iello.fr/wp-content/uploads/2026/07/Point-regle-Athletes-de-compete.pdf) 作交叉核對。
- 本機英文 PDF SHA256：`97afcd9db3dd45d6fe589d9d1abc8a409217ec6dfe72660dfa546206b3282c47`。來源 PDF 留在 ignored 工作目錄。

## 驗證界線與未決項目

- 角色卡頁與 36 張擷取卡的接觸表已逐頁／整組目視核對；來源為規則書小圖，並非高解析原卡。素材對外發行權利仍待核定。
- 初代與 Second Wind 混合時，罕見多重複製、同一角色同時具多種替代移動、Mastermind 與 Season Finale、多人複製 Mastermind／Suckerfish 等裁定仍需更多官方資料及實玩。不能將存在能力分支或抽樣流程通過視為所有組合均獲官方確認。
- 延續原票待核對：後三場獎分、Twist 觸發界線、逐步移動動畫及 Figma 同步。Figma 依使用者先前指示暫緩。
- 這份規格不是人工驗收、兩輪審查、同 SHA Linux CI 或部署證明。

## 2026-10-25 本機驗證

- Node 24.22.1 `npm run test:affected` 因核心／共用與已刪歷史測試回退完整 234 檔，1971/1971 通過，245500.2374ms；fail／cancel／skip／todo 均為 0。這次新增的 base 能力與跨牌庫邊界測試在該完整執行內。
- 三種牌庫共 120 組 3–6 人完整四場，檢查終局、隊伍消耗、積分與事件身份。首次擴充測試抓到固定骰 Skipper 無限插隊；改為偵測當前強制骰席位的重複賽況，保留玩家裁定入口後完整重跑通過。沒有把安全步數上限當作官方勝負。
- 前端 165/165 通過，含真 room 投影的 36／36／72 契約、重複角色／無效牌庫拒絕、72 個新增素材 hash／容量／尺寸。型別與 Vite 正式 build 通過；整分支 UI 防倒退指定 base `4d9bc79`、媒體預算、3.3.0 release check 通過。
- Edge 三個隔離真人席位：初代與混合牌庫分別從 UI 儲存設定、開始、跑完四場。各 39 項，包含等待、選秀、秘密選角、競速、單場／總結算，1920×1080／390×844／320×844、深淺色、重整與專注／Esc；沒有 pageerror 或整頁水平溢出。CEO 另外 24 項通過，含買股、503 同筆重試與各尺寸深淺色。不是每個能力按鈕均逐一人工點擊，也不是實體手機／GPU 效能測量。
- 早期瀏覽器腳本用精確 label 尋找含欄位提示的選單而逾時；改為可存取的 combobox 名稱比對後兩種牌庫重新跑完，沒有把逾時當作通過。
- ignored `work/second-wind-227/base36` 保存本機測試輸出。隔離站另開 `127.0.0.15:3064`，獨立資料庫、僅解鎖試玩獎勵、不預填成就；舊試玩行程與房間保留。此站不是正式部署。
