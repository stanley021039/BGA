# Stitch猜歌與同頻內容整合

來源：使用者提供stitch_ (1).zip，SHA256 cc7c2c5a896873dca0a64723fa60082e5c8bfd2713082e9974ad250ee69a1dda。原稿安全解包至ignored work/stitch-import-20261020；未執行HTML中的腳本、未新增CDN依賴，未匯入其他不相關成就頁。

採用：_5等待室題庫卡、_8年代插槽與黑膠主題、_6揭曉，以及20261018_1920_1結算、20261018_1920_2秘密投票的內容表現。最新使用者指示為外層模板與外框保留，所以不套原稿整頁header、玩家欄、聊天欄、底部播放器、字型或版型。改動限定MusicQuizScene／TournamentScene／MajorityScene／MajorityResults內容元件與專用stitch-party-content.scss；音樂卡沿用已選allowlist外框並改直式比例。

真實資料：DJ、輪次、片段秒數、年代卡、選項、得票、得票率、選擇者、本人標記及個人得分均取房間snapshot。秘密投票時不顯示票數與其他玩家選擇。沒有使用稿中示意玩家、假票數、假進度、Spotify匯入、賠率、額外重播次數或新計分規則。前奏仍6.5秒。

個人聲音：前奏提交後個人判定一次；正式揭曉只播本人的年代排序／插歌判定，不重播前奏、不播別人。首次載入／重整不補播。移除共用GameSongClip重新載入音訊按鈕。

先前郎中與Ping基線完整2500項通過；前奏及直式卡階段2501項通過。最後整合驗證另見work/stitch-party-complete-*。桌機與手機真實瀏覽器視覺尚未複驗，外部Edge操作受工具網址辨識限制，不能宣稱已真人聽審或逐頁對圖通過。

最後驗證：完整2501／2501通過（208.17秒）；介面補驗11／11通過，型別／Vite打包通過。最新短字優先與市集提示補驗見work/last-ui-*，HTTP頁面與三個音效來源200記錄見work/stitch-party-http-smoke.json。
