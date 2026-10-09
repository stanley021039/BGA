# #87／#88 驗收進度

2026-10-09。base 1fb45d51098333cd9a6961b3f7e329835380ede7，branch codex/issues87-88-room-controls；候選1.27.0、schema19不變，尚未合併／打tag／部署。規則與取捨見 [spec](specs/ROOM-CONTROLS-87-88.md)。

## 實作與測試

#87 建房結算欄位／驗證、設定摘要、跨圈固定總題數、完整揭曉後分數達標、64題上限與最近八輪有界結果；舊client的單圈流程／設定保留。#88 主視窗缩小續播、展開／小窗清單／明確停止、切片保留模式及原生可見性／音樂／離頁保護。沒有改描繪 renderer、SSE 或正式資料。

Windows Node22.23.3／npm10.9.9，隔離合成資料、外部side effects關閉。npm ci／minor release check、node syntax與diff check通過。首輪 media107/103，四項舊測試仍把主視窗X當真正停止；保留音樂實際close語意，將三個真正停止／取消測試改為小窗第二次X，原斷言不刪。首輪新regression一項把音量重套也當播放重啟，改為查play/pause/seek/cue/destroy，仍保留player／iframe同一性斷言。最後focused **124/124**。

完整首輪 **1,974/1,974**；補小窗清單、暫停與下一片、類型對應按鈕說明以及legacy結束原因後，完整 **1,975/1,975**，fail／skip／cancel0、exit0，116,953ms。新增八項（七引擎／媒體regression、一HTTP），驗分數不提前截題、固定12題跨圈、64題上限、非法值／legacy、建房保存／舊設定保留／局中禁止、小窗metadata不重建、真正退出與pagehide、paused不被queued更新復活、next仍縮小。日誌 issues87-88-full.log／full-final.log／focused-final.log 在checkout外，不提交合成帳密／cookie。

## 原生瀏覽器範圍

內建瀏覽器1280×720，loopback fixture／合成帳號，未操作正式資料：

- 建房固定一題，房內摘要與1/1正確；兩次單題都在時間到正常結束，保留最後畫作與最近畫作。第二次觀察鍵盤點、之後指標線段、放開／確認後與結算最後畫作仍有點／線，沒有把第一個未見畫面的drag直接當已接受資料丟失。未拍持筆中逐點trace／雙真人觀看者時序，這部分不算驗過。
- 分數模式建房100分，房內顯示目標100／最多64題。原生沒有真人成功達標場景；引擎測試三席第一人達標仍drawing、其他人完成才finished，HTTP驗條件保存與局中拒改。
- 公開Google官方示範影片 M7lc1UVf-VE 實際播放，有原生暫停按鈕、時間與字幕前進；縮小前後iframe widget2同一，實際327×246，未重建。小窗直接開清單並加入bZb4Zj7MfK0待播，同一widget2、字幕繼續，清單與影片並排；停止自己的小窗後iframe移除，換房清理。原生沒有等待22分鐘自然ended／多裝置長時間同步，不算此驗收。

初次在展開的大視窗直接開清單曾触發既有遮擋保護並停止影片，重新加入後繼續。這是原有可見性行為；本輪驗證的續播入口是主視窗收起後的小窗清單，不宣稱任意遮擋／超小視窗下也會續播。

截圖 issues87-ending-preview.png／issues87-score-preview.png／issues88-miniplayer-preview.png 位於checkout外。console error0。手機／觸控／旋轉、200%／完整讀屏、雙席逐點時序、自然ended切片與弱網長局待驗；未改原renderer／作畫同步。

## main 與交付

本輪開始、途中、測試前多次fetch main，均為1fb45d5；提交、推送與交付前繼續檢查，有新commit就比對差異再整合。保留Draft，CI與固定SHA兩回合自查將在PR補實際結果；#87/#88會留言已做／未做，不把候選當已上線。
