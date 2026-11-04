# #291 運動員手機 F2 候選

2026-10-26。這是依Stitch A3實際稿製作的**本機修訂候選**，不是Stitch未修改的最終稿，也沒有進產品實作。保留[A3來源](athlete-a3-review.md)及[A4／A5未實際修正的證據](athlete-a4-review.md)，不覆寫歷史。

## 修正與證據

- 六張使用同一手機頁首幾何：標題／階段第一列，五個44×44入口第二列；標題28px不縮字、不換行，入口保留14px中文名稱。元件展示的長入口簡稱為主題／側欄／專注，可及名稱仍保留。
- 修正根與grid子項min-width、穩定捲軸槽、手機側欄寬度；專注退出入口改44高、14字及至少88寬。未鎖／已鎖提示改上下排列並保留160高槽位，避免進度被壓成直排；桌機仍維持原單列。
- 以HTML解析器移除Stitch預覽注入的腳本／樣式與重複CSS屬性，還原doctype標準模式；原遊戲資料、規則文字與操作權屬未改。F2沒有!important。這是候選清理與幾何修正，不改產品元件或UI baseline。
- 六張×390／320共12組在CSS1Compat模式重新量測，均無水平溢出；標題寬82.5，入口皆在視口內且高44。手機含15px垂直捲軸，390的clientWidth375、320為305，不將兩者混稱。
- 320實際操作積分頁內彈窗與四列測試獎分、Esc關閉、聊天側欄及專注／退出；退出按鈕44×88、字14，側欄在視口內。另抽驗390深色（原稿data-theme變體）及1920桌機，不宣稱全矩陣／實機觸控驗收。
- 本機證據為ignored `work/design-291/athlete-f2-final-mobile-audit.json`、彈窗／側欄／專注與深色／桌機截圖。完整長頁截圖API仍失敗，沒有把上半／下半畫面稱為全頁像素驗收。

## 可編輯候選與Figma

| 畫面 | 檔案 | 完整尺寸 | 文字段 | Figma子框 |
| --- | --- | --- | --- | --- |
| 本人已擲5等待 | [SVG](athlete-f2-rolled-390.svg) | 390×1575 | 30 | [2270:7646](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2270-7646) |
| 蛇形選秀 | [SVG](athlete-f2-drafting-390.svg) | 390×3266 | 57 | [2270:7930](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2270-7930) |
| 秘密選角未鎖 | [SVG](athlete-f2-choosing-390.svg) | 390×2960 | 48 | [2270:8434](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2270-8434) |

三張位於第三份04預覽區的[比較框2270:7642](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2270-7642)，1218×3338、X111000／Y60000；子框寬均390，分別保留完整高度。曾暫移03以脫離既有父框，已移回04根層級，不留在已確認稿區。

SVG保留文字、向量、實際描邊／選取圈與裁切矩形，沒有整頁bitmap、image、script或foreignObject。XML、唯一ID、有限數值與Noto Sans TC檢查通過，三張向量預覽已產生；匯出資料先在瀏覽器轉JSON，避免工具將重複裁切物件誤標Circular而使內容消失。文字基線仍使用1.16em估算，不宣稱逐字與字距完全相同；尚無Component／Instance、auto-layout、互動原型及原卡圖像，圖像槽位不是美術完成。

## 仍待完成

這三張解決手機頁首與提示排版候選，不代表#291或設計流程全數完成。Stitch原稿仍有缺陷，尚未取得整批最終稿核定；競速、能力決策、特殊賽道、逐場／總結算、等待／失敗／中斷、原圖與完整深淺／手機／觸控驗收仍依本批矩陣接續。不得依此宣稱產品已實作、人工驗收、CI或部署完成。

本輪新增三張候選SVG後，test:affected依規則回退240/240檔，2020/2020通過，fail／cancel／skip／todo皆0，302761.1435ms；此結果對準3.6.0設計分支，不能沿用作後續整合新main的測試結論。
