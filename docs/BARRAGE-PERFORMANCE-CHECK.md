# 彈幕卡頓檢查

日期：2026-10-05。使用者回報另一台電腦看到彈幕掉幀，要求檢查實作；目前控制的電腦測試沒有問題即可先忽略。正式程式來源仍為 `15af1dd`。本輪只檢查、量測與記錄，沒有修改正式程式、重新部署或發 MR。

## 實作檢查

- `public/shared/game-shell.css` 的 `game-barrage-travel` 只動畫 `transform: translateX(...)`，8秒線性移動；`left:100%` 是固定起点，沒有每幀改動 left/top。
- `public/shared/game-shell.js:showBarrages` 依訊息ID去重，不隨每次輪詢重建或重播既有彈幕。新增時讀取舞台寬、文字寬，設定完整移動距離；animationend移除。原地淡出分支已於上批移除。
- 新增一批訊息時仍有 append→量寬的同步layout；這是可研究的成本，並非已證實持續卡頓原因。現有文字陰影也需實際paint／compositor分析才知道個別裝置成本，不能僅看CSS就判定使用GPU或一定順暢。
- 畫猜的舞台由state signature決定重建，彈幕層位於舞台外的穩定容器；輪詢及笔畫同步不會重置彈幕節點。公開站 game-shell JS／CSS及draw.js與本地一致。
- 移動方式符合 [Chrome動畫效能指南](https://web.dev/articles/animations-guide) 的transform建議。指南也要求先量測，避免直接大量加will-change；本輪沒有盲目加入圖層提示。

## 目前電腦的實測

在原Chrome154、1767×1196、八人畫猜桌背景操作，沒有提高視窗。測試分頁回報visibility=visible、hiddenEvents=0；沒有把已隱藏分頁的節流誤當遊戲掉幀。使用隔離本地DB與真實遊戲程式，僅在本地HTML附加診斷脚本；沒有在正式站注入診斷。主席UI登入／點擊診斷，其他七席API加入。

| 每次10秒取樣 | 每秒rAF回呼 | 中位間隔ms | P95間隔ms | 最大間隔ms | >34ms間隔 | >50ms長任務／長動畫幀 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 無彈幕基準 | 131.02 | 7.7 | 7.8 | 8.4 | 0 | 0／0 |
| 1則文字彈幕 | 130.68 | 7.7 | 7.9 | 8.7 | 0 | 0／0 |
| 8則文字彈幕同時移動 | 129.43 | 7.7 | 8.1 | 8.5 | 0 | 0／0 |
| 8則彈幕＋作畫同步 | 129.63 | 7.7 | 8.0 | 31.0 | 0 | 0／0 |

八則情境實際收到8個animationstart及8個animationend，最大同時8個；沒有動畫重播／中途取消。文字每秒位置取樣持续向左，透明度1。作畫負載由API在30秒內送出115批，每批24個合法點，約每250ms一批；Chrome由原本SSE及畫布重繪處理。作畫時出現一次較長31ms回呼間隔，不能寫成「完全零掉幀」，但此測試未見持續停頓或>50ms長任務。

方法參考 [Long Animation Frames API](https://developer.chrome.com/docs/web-platform/long-animation-frames)。rAF量的是主執行緒更新回呼，並非實體螢幕/GPU實際呈現幀率；Long Animation Frame亦不能涵蓋所有較短漏幀。這台電腦的結果不能確定另一台是硬體、瀏覽器圖形加速、擴充套件、系統負載或其他因素。Chrome內部GPU診斷頁受瀏覽器工具URL政策限制，沒有讀取或繞過限制；也未取得另一台的trace／GPU狀態。

## 結論與交接

目前控制的電腦沒有量到與回報相符的持續卡頓；依使用者指示保留實作。若後續取得卡頓裝置的遊戲／瀏覽器與Performance錄製，再比對frame、paint、compositor、長任務及彈幕批次加入時點。不能把本次不同裝置的陰性結果寫成已排除正式站缺陷，或直接歸因使用者電腦。

私有證據在Git忽略的 `work/barrage-performance-draw-waiting.json`、`barrage-performance-draw-active.json`、`barrage-performance-strokes.json`及 `barrage-performance-proof.png`。截圖在取樣結束後保留診斷結果，房間已自動換輪，不能當作作畫期間影格。測試房僅在本地建立；畫猜正常全員離席及GET404，清理時另遇到一間閒置房已404，本地診斷server已停止、記憶體房間隨之清除；原Chrome回公開站首頁，無臨時viewport override。正式站沒有建立新測試房。
