# 共用文字徽章

2026-10-12：1.28.3。本輪依使用者「已入座與外框之間要有gap，相關UI共用基本元件」要求實作。最終PR、完整測試及部署以本批驗收留言為準。

## 共用契約

`public/shared/ui-primitives.css` 的 `.ui-badge` 是非互動文字標籤的幾何元件。文字、圖示、可讀名稱與資料狀態由既有呼叫端負責，配色由原主題與語意class负责；外側margin與列间距由父布局负责。基本內距block2px／inline8px、子項gap4px、最小高度28px、radius999px以 `--ui-badge-*` tokens定义，頁面不重複定義padding／radius。min-height容許換行成長，max-width與overflow-wrap保留長文字。`[hidden]`必须隱藏。

```html
<span class="ui-badge room-status is-open">已入座</span>
```

已套用：房間狀態（含已入座／等待／進行／結束／無法加入）、大廳人數、留言分類與處理狀態、同頻階段與結果人數、送禮階段與心願標記、畫猜階段標記、圖片核准狀態與榜單本人標記、收藏數量。原CSS的color／背景／border／font-size／外側margin保留，幾何移回共用元件。房間操作欄另用父布局token保留120px寬度，按鈕填滿槽位，狀態文字不改欄寬。

適用邊界：徽章是文字狀態／類別／計數；不套玩家資訊卡、牌桌D符號、裝飾籌碼、按鈕本身、倒數條或screen-reader-only文字。未知新標籤須先判斷用途再opt-in，不能靠border-radius或名稱包含pill自動套用。

## 驗證與限制

headless Chrome七種頁面、1440／390、日夜共28布局：逐個量測內距2／8／2／8、最小高度28，短／長文字不裁切／不溢出、hidden不顯示；真hub.js渲染已入座與進行中房卡，操作欄同為120px。新增房間狀態／加入權限六案例回歸；既有榜單測試改用class token匹配，以容許共用元件class，同時保留昵称escaping與排序驗證。

畫猜原生補驗：15個持筆途中取樣、stroke ACK、觀看者筆跡、倒數、揭曉與換輪通過；沒有改renderer／transport。僅有限場景，非真人觸控／所有遊戲phase／讀屏全面驗收。最終完整測試與公開結果見PR。
