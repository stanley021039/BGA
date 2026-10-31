# #291 CEO E5／E6 公開觀戰候選

2026-10-28。使用第三份Figma／既有[CEO Stitch專案](https://stitch.withgoogle.com/projects/13570029563096816049)。**尚未核定、十二張已透過 Bridge 匯入並雲端重開核對，無產品修改。** 這批是公開觀戰視角，不覆寫先前玩家F1經營／結算候選。

## 參考與資料

以main `4127a035`／3.12.1的真實 `RoomSpectator` 加既有合法公開投影快照，重開GET-only本機參考服務。等待ABC000、進行ABC001、結算ABC002；三狀態各1920／390深淺色12組，實際viewport一致、頁面無橫向溢出，保留唯讀、專注及同房玩家入口離開連結。保存六張淺色桌機／手機完整長圖，向CEO專案提供等待手機、進行桌機／手機、結算手機四張實際參考及各自公開DTO。

等待只有三名AI公開名冊與暫用牌庫說明。進行有公開市場六項、六集團、公開持股／現金；不得提前搬入結算揭曉值。這條合法合成流程的結算是第10輪，Avery486、Beatrice275、Charlie554，與舊玩家F1第13輪260／506／590來源不同。沒有真實帳號、正式網路或資料庫寫入。

## E5實際產出與初測

| 候選 | Stitch來源 |
| --- | --- |
| E5-01等待 | `a8175d5ba946462a961ac8587c51a319` |
| E5-02進行 | `ec0a1fa1d5d645e8851506d43357cd36` |
| E5-03結算 | `e4e6bf68c5f14e29a0676a3501b39ab5` |

三頁已讀實際渲染HTML，還原原始viewport CSS並排除編輯器注入節點，沒有另改候選互動。1920／390／320各深淺色18組：innerWidth與要求一致、文件無橫向溢出、可見文字無低於14px、沒有input／select／textarea或遊戲提交控制；三頁離開連結對準各自 `/ceo/ABC000`、`/ceo/ABC001`、`/ceo/ABC002`。逐項核對公開姓名、持股／現金行、section標題／說明、市場及集團label／detail：5＋37＋44共86個字串全部出現，不以只看總分代替資料核對；未宣稱完整隱藏資訊審計。

尚未通過：全螢幕原型實際呼叫 `requestFullscreen`／`exitFullscreen`，點後未見指定的頁內focus class或明確退出button，觀察document.fullscreenElement仍null；不推測是瀏覽器拒絕的唯一原因。當時圖示button有中文aria-label／title，但沒有手機常駐中文，接續要求改圖文入口。這是生成候選的問題，不將它誤記為目前產品RoomSpectator專注功能失效。原型另有Tailwind CDN非正式環境警告，沒有把warn寫成零；未發現console error。

已向Stitch送出E6三張精準修訂：移除原生全螢幕API，改本頁專注class，保留遊戲內容／離開與14px、44px高明確退出入口；進入移焦退出，退出／Esc／原入口均還原並返焦。新增常駐14px「全螢幕」圖文button、保持正確離開href與全部公開資料，移除頁內工程名稱，保留歷史。確認送出後輸入欄清空；E6實際HTML及複驗仍待，不能只憑回覆說明當完成。

Ignored證據：`ceo-watch-e5-reference-matrix.json`、`ceo-watch-e5-stitch-screens.json`、`ceo-watch-e5-first-matrix.json`、`ceo-watch-e5-public-data-check.json`及各參考／候選長圖、實際HTML、E5／E6提示。此輪觀戰新增未進產品，#291及Draft PR #294維持進行中；無CI／合併／部署。


## E6 實際失敗與本機 F1 修訂

E6來源：等待 `0ceb8a989dd3475c955d2c5aec681b1b`、進行 `d9afcb8733aa4b5f808a300cee2f7f24`、結算 `e5e1e3ab4ddf4d188f6c6af55258944c`。重新載入專案並定位實際畫面後，等待／進行仍呼叫原生全螢幕 API；結算保留舊事件又追加新事件。生成器的完成說明不能作為修好證據，E6沒有直接匯入。

以 E5 的實際渲染 DOM 建立明確標示的「本機 F1 預覽修訂」：保留已編譯樣式，移除外部執行腳本，改為頁內專注 class；入口有常駐14px中文、44px高度，退出列保留遊戲資訊與離開入口。進入移焦退出按鈕，Esc／退出按鈕／原入口均還原並返焦。這是 ignored 候選 HTML 的修改，沒有修改產品 RoomSpectator，也不冒稱 Stitch E6 已修好。

三狀態各1920／390／320深淺色18組，實際 viewport、字級至少14px、控制高度與頁面無橫溢通過；86個公開資料字串再次全部存在。320px三狀態各深淺色、三種退出方式共18次操作，進入焦點、退出返焦、退出列隱藏及沒有原生全螢幕均通過。證據為 `ceo-watch-f1-matrix.json`、`ceo-watch-f1-data.json`、`ceo-watch-f1-interactions.json`；不是產品自動測試或真人手機驗收。

## Bridge 匯入與雲端保存

第三份04預覽區新增[比較框2335:16570](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2335-16570)，11808×5563、X180000／Y60000。十二張靜態向量候選、724個可編輯文字，Component／Instance為零。初次雲端定位尚未出現，之後重新載入04頁已出現完整比較框，逐一選取下列十二個框，尺寸12/12一致；沒有把 Bridge Connected 當作雲端保存證據。

| 狀態 | 淺／深桌機節點與完整尺寸 | 淺／深手機節點與完整尺寸 |
| --- | --- | --- |
| 等待 | 2335:16574／2335:16627，1920×1080 | 2335:16680／2335:16735，390×1080 |
| 進行 | 2335:16790／2335:16902，1920×2133 | 2335:17014／2335:17134，390×2409 |
| 結算 | 2335:17254／2335:17385，1920×2489 | 2335:17516／2335:17658，390×2818 |

保存證據：`figma-ceo-watch-f1-import-progress.json`、`figma-ceo-watch-f1-readback.json`、`figma-ceo-watch-f1-cloud-twelve.json`、`figma-ceo-watch-f1-cloud-root.png`及各完整SVG／PNG。文字基線、部分邊線與陰影為向量近似；沒有 auto-layout、token變數綁定或 prototype，HTML專注測試不能當作Figma原型接線已完成。三階段全長圖依實際高度記錄，不誤標1080高。

CEO玩家等待／錯誤／未參與、等待室完整展開、中止／真實重連、其餘公開階段及共用元件化仍待。#291與Draft PR #294持續進行，未核定、未產品實作、未CI／合併／部署。

本輪Git只新增／更新五份Markdown；`npm run test:affected -- --base HEAD` 對準 `c45a4077`，選取0/257，未執行自動測試，版號一致性3.12.1通過。main整合時的完整2155／前端254與build是前批證據，不列為本輪重跑。
