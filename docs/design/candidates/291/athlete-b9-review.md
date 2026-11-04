# #291 運動員 B9／B10 後半流程候選

2026-10-26。五個狀態各有桌機與手機可編輯向量，共十張；已保存第三份 Figma「04｜預覽區」的[比較框2287:6266](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-6266)，9792×4760、X114000／Y60000、頁面根層級0。重新開啟後逐張核對十個子框的實際尺寸及節點URL，確認根框可見。尚未核定，不代表產品實作或整張票完成。

## 來源與候選

來源為[運動員 Stitch 專案](https://stitch.withgoogle.com/projects/6540616740381984054)的實際B9四張及B10總結算；重新載入專案後確認節點仍保留。原始真實Vue參考、合法快照、前版失敗與修訂理由見[B1～B8核對](athlete-b1-review.md)，不覆寫歷史。

| 狀態／Stitch source | 桌機SVG／尺寸／Figma | 手機SVG／尺寸／Figma |
| --- | --- | --- |
| 競速 `0dd873e521134e01847a625f824c86ec` | [SVG](athlete-b9-racing-desktop-1920.svg)・1920×1675・[2287:6269](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-6269) | [SVG](athlete-b9-racing-mobile-390.svg)・390×2497・[2287:6726](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-6726) |
| 本人能力 `e3203aef09c541efb20e0ad547837936` | [SVG](athlete-b9-own-desktop-1920.svg)・1920×1827・[2287:6960](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-6960) | [SVG](athlete-b9-own-mobile-390.svg)・390×2648・[2287:7426](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-7426) |
| 等待他人 `9c268fb49deb41269a475fcac0e1c08b` | [SVG](athlete-b9-other-desktop-1920.svg)・1920×1827・[2287:7670](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-7670) | [SVG](athlete-b9-other-mobile-390.svg)・390×2648・[2287:8132](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-8132) |
| 本場結算 `acb657927f88480f9f2f87ea7dd7e80b` | [SVG](athlete-b9-result-desktop-1920.svg)・1920×1754・[2287:8373](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-8373) | [SVG](athlete-b9-result-mobile-390.svg)・390×2462・[2287:8801](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-8801) |
| 總結算 `e2491897f20342519f10e94a98ef1ee9` | [SVG](athlete-b10-finished-desktop-1920.svg)・1920×1480・[2287:9016](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-9016) | [SVG](athlete-b10-finished-mobile-390.svg)・390×2326・[2287:9499](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2287-9499) |

B9總結算320時因明細grid最小280而溢出至318（client305），改B10原稿的inline `minmax(min(100%,280px),1fr)`，未用整頁裁切掩蓋。NULL不再雙重escape，四場賽道為曲折／漩渦／曲折／漩渦，移除前版假賽道與emoji。

## 實際核對

- 正確資料：競速0／0／6、三人0分；Avery能力僅兩個目標，Beatrice只等待；本場只Beatrice／Doppelgängster第1+3，總分0／3／0；總結算7／10／14、Charlie獲勝及全部四場明細。沒有補不存在的第2／3名、假倒數或假事件。
- 五頁×1920／390／320×深淺色，共30組標準模式量測：根scrollWidth等於client1905／375／305，五入口44×44、中文span14且內部不橫捲，收合／展開44×44且nowrap。深淺色以驗證頁僅替換原prefers-color-scheme條件控制，未變更使用者系統偏好，不宣稱實體手機測試。
- 前三頁相同斷點下的隊伍、能力、賽道、操作及日誌起點相同；桌機賽道280、操作104高，390／320賽道400、操作288高，長內容不裁切。日誌內容不同時自然延長。兩種結算保留完整資訊，不強制等高。
- 本機驗證頁五頁實際開積分dialog，Tab到確認、Esc回來源；本人選目標兩鍵disabled、其他玩家操作鍵0；回合／下一場／再玩僅顯預覽送出提示且可關閉。沒有送出真遊戲action、沒有改骰值或位置。本輪這組驗證無新增console error。

### 原稿腳本與本機驗證頁的差異

Stitch局部修訂保存了視覺HTML，但B9原script仍對不存在的btn-start-turn綁listener，且部分新目標／結算按鈕缺handler。**原Stitch互動不能記為全部通過。** 本機ignored驗證頁只補可選節點防護、各狀態純預覽事件及提示關閉焦點；移除script後的整份視覺文件逐字比較及SHA256均相同。以上互動結果對準這份明確修補的驗證頁，不冒稱Stitch已保存腳本修正，也不是產品程式。

SVG擷取初始畫面，保留文字、向量、描邊、硬影與局部捲動裁切；十張及比較框均通過XML、唯一ID、有限數值、Noto Sans TC、無script／image／foreignObject檢查。向量PNG已產生並檢視比較圖及能力／總結算手機長圖。字形基線仍使用1.16em估算，不能宣稱逐字字距等同瀏覽器；手機靜態框只顯示賽道當前捲動範圍，完整0～30仍見桌機及原型，沒有冒稱靜態SVG可左右捲。

Figma曾將新框貼進既有父框，已暫移03再回04根層並重設座標，未留在03；未改其他稿、原圖、箭頭或文字。首次選取偏差來自圖層列實際寬超出側欄裁切，改點可見Frame圖示後完成整理，未以重貼造成重複稿。實際Figma重開截圖、十框尺寸／URL、本機矩陣及原始HTML僅留ignored `work/design-291`；Figma編輯器截圖標實際尺寸，不冒稱產品1920×1080畫面。

## 驗證與未完成項目

新增十張SVG後，`test:affected`因未知候選路徑回退241/241檔，2030/2030通過，fail／cancel／skip／todo皆0，407546.7829ms；執行時HEAD `a221dc62f4865b88f3b27228d3f88a887c0b83de`、merge-base `74a0193877107abbd1464bda26c2d51a4a643f5b`，工作區含本批新SVG。後續僅更新紀錄及格式，不將舊CI當成新提交通過。

這批補齊五個核心後半流程候選，尚缺等待室／牌庫設定、原圖完整對應、同格多人及能力／規則展開稿、中止／重連等矩陣，以及CEO既有缺口。未完成Component／Instance、auto-layout與Figma互動原型，R6完整視覺／字距／對比／觸控及人工核定仍待；不把幾何與部分鍵盤驗證擴大成全站驗收。未修改產品、未啟動CI、未合併或部署。
