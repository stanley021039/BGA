# #93 共用文字與表面配色

2026-10-09，基線 main `4664916`。這份文件同時說明本輪實作契約與未驗證範圍；不是全站已部署聲明。

## 問題與確認範圍

使用者截圖來自其他開發者尚未整合的 `/bluff`，淺色說詞卡上的淺色字難以閱讀。本輪沒有該頁 source，不能將其根因或修復認列為已確認。

現有共用主題 dark 的 `--play-ink` 是淺色，`ui-widgets.css` 的選取分頁卻把 `--green` 作背景、文字 fallback 固定白色；在現有 playful token 組合下得到 1.10:1。通用欄位錯誤固定棕色在夜間紙底為 3.86:1，市場局部錯誤色為 2.78:1。這些是同類共用配色缺口的實際 CSS 計算證據，不代表市場／素材庫現有專用 tab selector 都壞掉；測試頁另保留其完整 class 檢查。

## 已實作契約

- playful 的 widget tokens 成對取自 `--ui-selected`／`--ui-selected-text`、`--ui-surface-panel`／`--ui-text`；錯誤取 `--ui-error`。市場／素材庫局部固定 palette 以明確 theme-scoped selector 校正，非 playful 頁維持原樣。
- 分頁背景與文字同步切換；只保留 border 過渡，避免背景動畫尚未結束而文字先切換的短暫低對比。
- 裸 button 的中性配色使用零 specificity 主題 scope，避免舊全域 button 固定淺底配上夜間淺字；有 class／狀態的元件配色仍優先。
- 一般內容卡使用 `class="ui-content-card"`，背景與正文跟隨主題；次要文字加 `ui-content-muted`。電話畫猜回顧頁已採用，既有邊距、牌面與畫布規則由原呼叫端持有。
- 要保留淺紙色的**靜態內容**，使用 `class="ui-content-card ui-content-card--paper"`；紙色、深色正文／標題／次要文字與 light color-scheme 保持成對。不要只把底色寫死、繼承外部夜間文字。
- 元件不覆蓋任意所有後代的顏色，不改動畫、插圖、畫布、牌面或遊戲狀態。紙卡不是表單／警示主題容器；若包含有獨立色彩的狀態、控制或其他元件，仍須依自身語意驗對比。

對 `/bluff` 的建議：整合共用修正後，說詞 article 採用上述一般卡或紙卡契約，移除衝突的固定背景／foreground 宣告，再量實際 computed style。utility 無法自動修復較高 specificity 或 inline 寫死的色彩；尚未取得 source，仍待整合驗收。

## 驗證與限制

Node 回歸測試讀實際 light／dark tokens、解析 alias 並計算相對亮度，正文／次要／選取／錯誤／紙卡配對至少 4.5:1；另外保留舊不合適配對低於 1.2:1 的反例。這不取代完整 cascade 或畫面驗收。

`tests/fixtures/theme-contrast.html` 是測試 fixture，不接 app 路由／DB。瀏覽器載入真實 shared、market、collection CSS，21 個樣本在日夜兩種模式皆至少 5.57:1；含裸 button、既有頁面 tab class、纸卡標題及連結、電話畫猜回顧卡與其原有白色畫布樣式。切換立即取樣通過，390px 寬度無水平溢出，hidden 卡不可見、畫布仍白色。這是共用元件 fixture，沒有認列所有正式頁面／真人遊玩／讀屏、手機實機或其他開發者 bluff 驗收。
