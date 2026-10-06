# 畫猜倒數可見度修正

2026-10-07，UI版v1.5.4已發布；公開畫面驗收再發現原生進度條過渡動畫的滯後，追加相容patch候選v1.5.5。依使用者要求提高剩餘作畫時間的亮度、大小與長度，移除作畫中的題材／難度／字數提示。

| 項目 | 完成內容與證據 | 狀態 |
| --- | --- | --- |
| 倒數文字與軌道 | 20px→32px文字、8px→14px軌道，改為較亮的橙色及淺色底；仍使用lining／tabular數字。shared ui-timebar提供軌道、緊迫色及減少動態契約，caller負責deadline／value與布局。 | 已實作 |
| 與畫布同寬 | 倒數獨立放在畫布上方；畫者桌機只占畫布欄，畫具仍和畫布上緣對齊。1440猜題者bar／frame均831px；1280畫者均499px且x同429，畫具／畫布top均311；原生canvas維持512×256。390手機兩者均325px，畫者工具重排在畫布上方。 | 背景Chrome通過 |
| 移除題材資訊 | 作畫階段boardHint為空且hidden，畫者／猜題者均不顯示題材、難度或字數。等待房間的題目分類仍可見。 | 回歸及背景Chrome通過 |
| 放大文字 | 320px／200%文字時倒數改為分行排列；順便約束聊天grid的min-content，避免內容把頁面撐寬。bar／frame均255px、x同25；scrollWidth未超過viewport。所有測試字級／viewport已還原。 | 背景Chrome通過 |
| 時序與權限 | 沿用server deadline／clockOffset，presence不重置倒數，不新增輪詢或重繪畫布；猜題輸入與畫者權限保留。Focused倒數7/7，Windows Node24.14.0完整864/864（29244.7807ms）、失敗／取消／跳過0。 | Linux與正式驗收待完成 |

這是畫猜版面與共用軌道的相容修正，沒有更動DB schema或匯入其他站資料。新class採opt-in，不替換其他遊戲尚未使用ui-timebar的時間UI。Chrome桌機、390手機及320放大文字已驗；未宣稱所有平台字型／Safari均驗過。正式部署與公開資源／畫面證據完成後補記固定提交、備份與帳戶檢查。

首次v1.5.4公開验收：版號/no-store、26份HTML／CSS／JS與固定提交一致，正式3席bar／frame均846px、x同257，文字32px、條14px、drawing hint空且hidden。原生progress的數值與aria按server deadline更新，但背景Chrome截圖仍可能顯示滿格；實際value/max约0.70時不相符。以暫時CSS關閉width transition做對照，value/max约0.146時實際條形恢復约14%，測完還原注入。追加v1.5.5停止原生value層的width transition，保持原有250ms更新與所有時間／權限規則，不冒稱是跨所有瀏覽器的相同缺陷。首次驗證席位與session已退出、房間0；v1.5.4受測tag保留不移動，v1.5.5獨立驗收後再發布。
