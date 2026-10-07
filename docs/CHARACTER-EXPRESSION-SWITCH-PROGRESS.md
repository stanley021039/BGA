# 角色表情切換修正

2026-10-07，正式 **v1.7.1**／`3d82e3f`；已完成完整雙平台及公開站驗收。

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

新增回歸驗五款真callback及主卡markup、另一席、同版本還原、舊房／席／game／version／clock ACK與GET拒絕、最新expiry及版本優先；雷霆真presentation驗同版表情不重畫track、不取消移動或重新開骰子動畫。既有multi-move harness補載新receiver定義；最初全套3個slice fixture缺函式的失敗已修正。最新新增／相關focused50/50；完整Windows Node24.14.0 **940/940**、30674.1292ms，Linux Node22.22.1乾淨Git archive **940/940**、150087.989714ms，fail／cancelled／skipped／todo均0。私人完整日誌`work/expression-switch-{windows,linux}-tests.log`。

本機最新guard重新載入後真點flip仍成功，成果`work/expression-switch-faker-local-final.jpg`。兩local tab有extension message-channel error記錄；未觀察到本站uncaught error，沒有把extension訊息當成本站故障或宣稱完全無console訊息。local preview／baseline代理／presence及tabs已停止。

## 正式發布與資料

受測程式及不可覆寫本地annotated tag `v1.7.1`：`3d82e3f6946ffdd7af6329e678df190ae5b0eb6d`；archive SHA256 `88c3bebc5137b833d9aed995c727c0da788a07adafc914ae803c8b0846727e70`。release:check以v1.7.0驗patch通過，發布包未含private檔／work／env；後續純文件不移動tag，沒有新PR或push。

新鮮備份 `/home/ccc/apps/afterhours/shared/backups/pre-expression-switch-fixes-3d82e3f-20261006T213013Z-3c5599cd-af23-4545-b7fa-b0151fb263a4`：SQLite線上一致性備份，持久檔及env另外備份，非跨檔原子冷快照。副本啟動前後21表schema／rows／BLOB相同，8帳戶全欄位保留。0房間切換至`releases/3d82e3f`，核對舊PID85927後SIGTERM，由既有服務重啟為88602；service／tunnel active。schema15／integrity ok／FK0、env與原資料路徑不變，外站資料代未啟用。

## 公開背景Chrome

公開版號v1.7.1及五game JS＋GameShell／RoomHost共7份內容／text/javascript MIME／no-store精確比對。兩個僅loopback代理綁既有合成會員，所有遊戲及表情請求來自shhuang.cc；沒有更改真正shhuang.cc的Chrome登入。公開驗收使用合成會員已選用角色的開心表情，沒有上傳faker副本或寫profile；原faker已在前述隔離環境驗證。

| 正式驗收 | 結果 |
| --- | --- |
| 雷霆雙席 | host與guest可見crew由原`/characters/...`換成traveler-happy.gif，皆complete／naturalWidth256，version3不变。host social0→1，guest0→0；5秒後兩人同version回原avatar。 |
| 另外四款雙席 | 畫猜／送禮／同頻主卡與poker牌桌座位，host真點角色選單後ACK即換圖，guest也看到同GIF、complete／naturalWidth256。每頁host social0→1，前三款version3不變，poker原本沒有version欄位。 |
| 遊戲狀態 | 五款3席各讀快照，皆保持waiting及原version（poker null），沒有假造遊戲version以強制刷新。 |
| 證據 | `work/expression-switch-public-browser.json`、`expression-switch-public-verification.json`、`expression-switch-public-final.jpg`。兩public tab console error0。 |

自己的五桌／3個session正常清理，rooms0；tab／代理／presence停止，兩來源僅移除本輪房號的本機返回記錄，沒有調整viewport或字級。最後21schema及20非session表所有rows／BLOB與新鮮備份相同，8帳戶全欄位保留；sessions152→155是QA登入／登出，不宣稱sessions逐列相同。正式faker兩圖片與選用狀態再次核對相同，PID88602正常。

沒有真人設備、弱網實際封包延遲或所有遊戲phase實玩；亂序、賽車移動及骰子動畫由真函式回歸覆蓋，公開UI測等待桌。沒有用正式原玩家身分發表情，亦未改5秒顯示規則或角色分享設定。
