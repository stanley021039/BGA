# #278 場外休憩區卡片圖與 #277 輪播修訂

日期：2026-10-25。候選版本沿用同一批未發行的 3.2.0 minor，不額外疊升版號。

## 最新確認範圍

使用者在本輪提供標註圖，指定先完成 #278 圖片，再將場外休憩區加入輪播、取消獨立卡片；翻頁與拖曳提示靠近且對齊中央卡片；素材授權連結回左下。此決策取代 #277 早期右下／左下固定卡片與授權置中的方案。右側加入、對話、開桌與返回房間操作保留。

## Stitch 與 Figma 實際來源

- [Stitch 專案](https://stitch.withgoogle.com/projects/995005127424505482)：BGA 278 Lounge Megaphone S-20261025 R2。
- 原創藍綠底、象牙白喇叭、紅色數字徽章；數字 3 只是插畫裝飾，不代表即時未讀數。
- R1 誤將 SVG base64 直接顯示成文字；已請 Stitch 修成 R2 inline SVG，再從實際匯出的 HTML 提取 SVG，沒有用手繪重製代替生成結果。
- 第三份 Figma 的「04｜預覽區」保存 [原始向量](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2229-7927) 及 [交付圖片](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2230-6267)，名稱含 S-20261025 R2、票號、來源專案與尺寸。已重新載入確認留存；既有畫面與連線保留。
- Figma MCP 在讀取頁面列表後遇方案額度限制，改以已登入瀏覽器匯入。原 SVG 的 Fredoka 在 Figma 缺字體，因此另保存與網站一致的點陣交付圖，避免替代字體造成徽章數字差異。
- 資源、來源／輸出 SHA256、容量與轉檔參數記於 `frontend/src/assets/lounge/source.json`。原 SVG 僅供參考，不在執行期載入；360×250 WebP 5042 bytes，720×500 WebP 11572 bytes，依 srcset／sizes 選取，沒有遠端素材、字體或 base64 執行期資源。

## 接線與驗證

- lounge 成為輪播第 13 張，沿用選取、拖曳與鍵盤循環；選到後右側「開啟場外休憩區」開原 UiDialog，保留空清單、開房、目前房間與返回座位。
- 桌機輪播與控制列共用中央欄，卡片底與翻頁列間距 24px；授權連結獨立置於左下。手機仍依文件順序顯示，無獨立場外卡片。
- 實際瀏覽器檢查 1920×1080 深色、1366×768 淺色及 375px 深淺色；圖片、翻頁、End／ArrowRight／ArrowLeft 循環、場外彈窗空／非空清單、開房與返回按鈕。375px 的 scrollWidth 等於 clientWidth；lounge DOM 僅一張，舊獨立卡片為零。圖像 HTTP 回 200、5042 bytes 與一年 immutable cache。
- 建置保留舊 hash 檔案（`npm --prefix frontend run build -- --emptyOutDir false`，含 vue-tsc），避免破壞使用者仍在試玩的 3972；另開 3974 獨立資料預覽。沒有改正式資料或部署。
- 前端 140/140 通過，新增真實 compileScript／Vue reactive 狀態的輪播回歸，涵蓋場外唯一卡片、鍵盤 End、正反循環與中央選取位置。
- `test:affected` 因共用／未知路徑回退全套，1849 項中 1848 通過；唯一失敗仍為 app-runtime SSE close 最後 reader.done 斷言，與本輪修改前相同案例。本輪未獨立重驗 main，不宣稱全套通過。
- 整分支 ui:check（base 238f0a4）、format／format:check、前端型別與建置、perf:check --build、minor release:check 及 diff check 通過。輪播改包裝後，既有原生卡片按鈕附具體 raw-control 例外，保留同一拖曳／選取控制，不增加基準額度。

本機圖片證據：`work/figma-278-delivery.png`、`work/lounge-278-1920-dark.png`、`work/lounge-278-1366-light.png`、`work/lounge-278-375-light.png`。未新增真 YouTube、多人共看同步、實機觸控、GPU 或瀏覽器快取命中率量測。待使用者驗收，未 PR／CI／合併／部署。

## 2026-10-25 後續驗收修正：大廳間距與休憩區房內

使用者追加：拖曳說明與箭頭留白加大；素材授權往上對齊右側第一桌提示。說明 margin 增為12px，授權沿用房間操作所在列、避開44px回饋槽與8px gap，桌機不移動右側操作位置。

房內根因：phaseRow=false 的浮動狀態列不占排版位置，但整合頂欄仍配置 `48px minmax(0,1fr)`，令唯一房間 grid 被塞進48px。影片舞台以 viewport 下限溢出這個小 grid，左右面板及 RoomBackground 則只有48px。修正共用 RoomHeader 的浮動狀態列列數；一般遊戲原本的48px階段列保留。休憩區 grid 統一負責最小高度，舞台使用border-box與min-block-size:0，專注時依共用可用高度填滿並不建立外部捲動。另將空的浮動 UiNotice 設為不顯示／不接收pointer，活躍提示仍保留互動並置中，修復空槽遮住左側收合按鈕。

實際隔離站1920×1080：左右面板、背景及影片舞台均930px；空聊天室不縮，兩側收合／展開狀態與高度已驗。背景模式點中央，人物由(12,38)走到(50,50)，方向鍵再至x=55；沿用原HTTP移動與伺服器規則，未另改互動協定。全螢幕grid client/scroll=1080/1080、main=988/988、stage=986/986；375×812專注main=720/720、stage=718/718，沒有內容溢出。手機一般模式可收合抽屜且無水平溢出。native全螢幕的IAB截圖有畫幅裁切限制，完整範圍另以DOM幾何核對，未把裁切圖當作整個退出入口的視覺驗收。

新增4項SCSS／DOM契約回歸，涵蓋整合／未整合頂欄、一般階段列不退化、grid高度責任、邊框溢出與空通知不擋點擊；前端144/144通過。空通知回歸首次因fixture未建立通知節點失敗，補正fixture後全通過。此批 test:affected 再次回退226檔、1849項中1848通過，仍僅既有SSE close最後reader.done失敗；未宣稱全套通過。型別／建置、整分支UI與效能檢查通過；無真YouTube、實機觸控或全遊戲原生畫面新增驗收。

最新試玩為127.0.0.8:3978，獨立資料／合成帳號與獎勵工具，避免與舊本機站共用cookie；舊3972／3974程式保留。房內驗收站重啟時僅清理已確認結束之自有process鎖檔、資料庫保留；此隔離設定未驗跨重啟房間保留，不據此宣稱正式持久化通過。新增本機證據 `work/lounge-room-panels-1920.png`、`work/lounge-room-fullscreen-1920.png`、`work/lounge-room-frontend-final.log`、`work/lounge-room-tests.log`。仍待使用者驗收，未PR／CI／合併／部署。

最後大廳量測：1920×1080，拖曳提示與翻頁列相隔12px；素材授權與「挑選遊戲，開啟今晚第一桌。」的下緣皆y=960。底部44px回饋槽按共用control-height配置，document.scrollHeight=innerHeight=1080，避免原24px列裝入44px通知槽造成12px額外溢出。證據`work/lounge-spacing-final.png`。
