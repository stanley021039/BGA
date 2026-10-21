# 網站音效與用途盤點（2026-10-19）

範圍是整個桌遊網站，不只猜歌挑戰。下表列共用播放器註冊音源與實際前端引用；沒有引用的註冊別名不當成仍有播放。相同檔案可能對應多個事件，不等於多份錄音。毫秒是最長播放保護值，實際以ended提早結束；聲音仍受個人音效開關／音量、背景停止及瀏覽器手勢政策限制。

| 事件 | 檔案 | 用途 | 呼叫／引用位置 |
| --- | --- | --- | --- |
| ping-ping | /assets/game-sounds/ping-ping.wav | LoL 一般標記原音效；保留個人靜音與音量 | 無固定字串引用，保留註冊別名；動態事件另核對 |
| ping-attention | /assets/game-sounds/ping-attention.wav | LoL 危險／撤退原音效；保留個人靜音與音量 | public/shared/ping-model.js、public/shared/ui-components.js |
| ping-question | /assets/game-sounds/ping-question.wav | LoL 敵人消失原音效；保留個人靜音與音量 | public/shared/ping-model.js、public/shared/ui-components.js |
| ping-help | /assets/game-sounds/ping-help.wav | LoL 請求協助原音效；保留個人靜音與音量 | public/shared/ping-model.js、public/shared/ui-components.js |
| ping-look | /assets/game-sounds/ping-look.wav | LoL 正在路上原音效；保留個人靜音與音量 | public/shared/ping-model.js、public/shared/ui-components.js |
| quacks-stop | /assets/game-sounds/quacks-decline-user.wav | 郎中停止抽藥（現行停手語音） | public/quacks-fx.js、public/shared/game-sounds.js |
| quacks-settlement | /assets/game-sounds/quacks-settlement-user.wav | 郎中回合結算 | public/quacks-fx.js、public/shared/game-sounds.js |
| quacks-explosion | /assets/game-sounds/quacks-explosion-fish.wav | 郎中爆鍋 | public/quacks-fx.js、public/shared/game-sounds.js |
| quacks-danger | /assets/game-sounds/quacks-danger.wav | 郎中接近爆鍋上限提醒 | public/quacks-stitch.js、public/shared/game-sounds.js |
| quacks-buy | /assets/game-sounds/quacks-buy.wav | 購買藥材 | public/quacks-stitch.js、public/shared/game-sounds.js |
| quacks-ruby | /assets/game-sounds/quacks-ruby.wav | 取得／使用紅寶石 | public/quacks-stitch.js、public/shared/game-sounds.js |
| quacks-witch | /assets/game-sounds/quacks-witch.wav | 使用女巫能力 | public/quacks-stitch.js、public/shared/game-sounds.js |
| settlement | /assets/game-sounds/quacks-settlement.wav | 一般結算短提示 | public/quacks-fx.js、public/quacks-stitch.js、public/quacks.js、public/shared/game-sounds.js |
| potion-drink | /assets/game-sounds/quacks-drink-real.mp3 | 郎中喝藥水（咕嚕飲用錄音） | public/quacks-fx.js、public/shared/game-sounds.js |
| ingredient-draw | /assets/game-sounds/quacks-push-user.wav | 郎中抽藥語音「要拚」 | public/quacks-fx.js、public/shared/game-sounds.js |
| card-draw | /assets/game-sounds/quacks-card.wav | 郎中抽占卜／事件卡 | public/quacks-fx.js、public/shared/game-sounds.js |
| bluff-reaction | /assets/game-sounds/bluff-reaction.mp3 | 瞎掰王表態／反應 | public/bluff-reactions.js |
| confirm | /assets/gift-sounds/confirmation_001.wav | 本人操作確認，如答案已鎖定；不是判定答對 | public/app.js、public/gift.js、public/majority.js、public/race.js、public/shared/game-sounds.js、public/shared/site-header.js |
| reveal | /assets/gift-sounds/open_001.wav | 揭曉或一般事件確認（各遊戲呼叫處） | public/app.js、public/bluff.js、public/draw.js、public/gift.js、public/majority-cruel.js、public/majority-tournament.js、public/majority.js、public/musicquiz.js、public/party-games.js、public/race.js、public/shared/game-result-sounds.js、public/shared/game-sounds.js、public/shared/race-game-sounds.js、public/trpg.js |
| turn | /assets/game-sounds/turn.wav | 輪到本人／倒數提醒；countdown-warning使用同一音源 | public/app.js、public/bluff.js、public/draw.js、public/shared/game-sounds.js |
| correct | /assets/game-sounds/correct-user.mp3 | 答對：猜歌歌名／年代、同頻選中多數、畫猜猜中；本次改用使用者答對.mp3 | public/draw.js、public/shared/game-result-sounds.js、public/shared/game-sounds.js |
| incorrect | /assets/game-sounds/incorrect-user.mp3 | 答錯：猜歌判定失敗、同頻少數；本次改用使用者錯誤.mp3 | public/shared/game-result-sounds.js |
| dice-roll | /assets/game-sounds/dice-roll.wav | 雷霆骰子擲出 | public/quacks.js、public/shared/game-sounds.js、public/shared/race-game-sounds.js |
| shot | /assets/game-sounds/shot.wav | 雷霆射擊 | public/race.js、public/shared/game-sounds.js、public/shared/race-event-cues.js、public/shared/race-game-sounds.js、public/shared/race-movement.js、public/shared/race-vehicle-effects.js |
| slam | /assets/game-sounds/slam.wav | 雷霆撞擊 | public/race.js、public/shared/game-sounds.js、public/shared/race-game-sounds.js、public/shared/race-movement.js、public/shared/race-vehicle-effects.js |
| explosion | /assets/game-sounds/quacks-explosion.wav | 雷霆車輛爆炸 | public/shared/game-sounds.js |
| nitro | /assets/game-sounds/nitro.wav | 雷霆加速 | public/race.js、public/shared/game-fx-layer.js、public/shared/game-sounds.js、public/shared/race-game-sounds.js、public/shared/race-vehicle-effects.js |
| skid | /assets/game-sounds/skid.wav | 雷霆打滑 | public/race.js、public/shared/game-sounds.js、public/shared/race-game-sounds.js、public/shared/race-vehicle-effects.js |

## 可自訂或不固定的聲音

- 角色表情：使用者上傳的happy／sad／surprised／thinking／angry／自訂表情音檔；內容依帳號設定，不能用一份固定名單代表所有人的素材。依伺服器白名單URL播放，最長10秒。
- 房間共用音樂／YouTube：玩家點播的背景音樂，屬音樂而非遊戲提示音；各玩家控制個人音量。
- 猜歌片段：6.5秒前奏及30秒精華；歌單另有1190首，不把2380片段混列為提示音效。
- 音效試聽：設定面板可試聽；不代表遊戲事件已發生。

## 本次替換與暫停規則

使用者提供的答對.mp3與錯誤.mp3分別製作correct-user.mp3／incorrect-user.mp3，答對約3.21秒，錯誤依後續指示剪成1.5秒並加尾端淡出（原檔5.26秒）。不是自製或重新授權素材。音效開始前暫停註冊的猜歌音樂／個人試聽與背景音樂；兩個判定按實際ended依序播放，全部結束後才恢復先前正在播放的曲目。換題或關閉播放器不會救活已移除音源；關閉音效不改全桌音樂狀態。

被新版取代的7個音檔及公開路由已刪除，試聽與壓縮包僅列現行音檔。舊事件名稱可導向現行檔案，不保留舊聲音。

補充：原生猜歌與YouTube API備援皆會暫停。猜歌二選一的原生音檔可在音效結束後恢復；無音檔時的簡易YouTube備援會送出暫停命令，由玩家在原生播放器手動繼續，避免誤啟動從未播放過的影片。

1～5已依使用者要求改為LoL遊戲音效，來源為darrenprx/lolPing公開擷取素材，權利屬Riot Games，不再標記專案原創／CC0。來源commit、SHA256與轉換細節見public/assets/game-sounds/lol-ping-manifest.json。
