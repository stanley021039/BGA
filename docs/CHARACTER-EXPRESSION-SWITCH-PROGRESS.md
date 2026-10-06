# 角色表情切換修正

2026-10-07，候選 v1.7.1；完整雙平台及正式驗收待補。

使用者回報上傳faker後，在遊戲「角色 > 表情」無法切換。正式唯讀檢查：faker主圖及flip表情均存在，GIF分別296,327／975,438 bytes，一個有效帳戶選用faker平常外觀。原始兩圖片副本在本機隔離環境解碼正常，分別220×187／25幀與306×498／40幀、皆循環播放。沒有修改原角色或登入原玩家。

## 已確認原因及修改

| 範圍 | 原因 | 修改 |
| --- | --- | --- |
| 雷霆之路 | 表情是5秒臨時事件，不增加遊戲version；同version的poll僅更新被隱藏的共用角色列，可見車隊卡與本地state不更新。 | receive同版只更新state及renderCrews，重用可見車隊渲染；保留移動／道路／骰子controller，不重畫地圖。 |
| 共用送出流程 | social成功ACK只更新GameShell自己的角色列，未交给各遊戲原receive／render。 | RoomHost.acceptSnapshot驗房間／席位／game及新舊快照後呼叫目前遊戲callback；五款可見名單在ACK時更新。 |
| 弱網亂序 | 較早開始的GET可能在新表情ACK之後回來，相同version仍覆蓋新圖。 | 共用RoomHost.isStaleSnapshot拒較低version，或相同房間／席位／game／version但較舊finite serverNow；五款receive／render套用。版本增長優先，沒有用不同房間的時鐘比大小。 |

表情仍是5秒暫時外觀，不修改已保存profile、圖片權限／hash或房間協議，不增加poll／網路心跳／額外POST。原圖沒有重編碼。本輪沒有改GIF重送時的動畫起點；兩個實際GIF都循環，對話中未提供原房號／遊戲，不能把隔離重現當成觀看過原玩家操作。

## 背景Chrome證據

隔離SQLite及合成3帳戶，以原圖片副本建立測試角色。舊版v1.7.0前端：真點flip回「已送出」，hidden共享列換成emote URL，但可見crews仍`/characters/...`、version3不變。候選前端：同版本3，自己及另一席均換成flip的hash URL、圖片naturalWidth306，5秒後皆回原URL；主圖naturalWidth220。私人證據 `work/expression-switch-local-browser.json`。

另外畫猜／送禮／同頻／poker真UI各點flip，成功ACK後主要玩家卡／牌桌座位立即換圖，沒有等待phase或其他game action；前三款version仍3，poker原快照沒有version欄位。證據 `work/expression-switch-local-all-games.json`。本機API runtime啟動於升版前，前端為候選檔；不把該preview API版號當成正式v1.7.1。

新增回歸驗五款真callback及主卡markup、另一席、同版本還原、舊房／席／game／version／clock ACK與GET拒絕、最新expiry及版本優先；雷霆真presentation驗同版表情不重畫track、不取消移動或重新開骰子動畫。既有multi-move harness補載新receiver定義；最初全套3個slice fixture缺函式的失敗已修正，最終完整數字待補。
