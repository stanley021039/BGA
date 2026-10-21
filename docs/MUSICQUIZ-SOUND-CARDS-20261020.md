# 猜歌音效與音樂卡修正

音樂卡依年代、歌曲、歌手分行，時間軸同樣保留歌手。外框仍使用原有allowlist renderer，不影響其他彈幕及播放器預覽。

根因：game-result-sounds的UMD僅在非CommonJS分支註冊window.GameResultSounds。Vue打包器提供module.exports後走另一分支，RoomEffects無法取得create，因此完全無聲。現在同時提供CommonJS匯出與瀏覽器API；新增VM模擬打包環境回歸。先前另修正正常等待超過5秒被誤判為過期。

判定仍在本輪正式揭曉才播放，前奏作答後立即顯示已提交但不洩漏答案；答對及答錯沿用使用者提供的現行MP3。整串音效暫停原生歌曲，結束後恢復。首次載入、重整、重複狀態、斷線及背景不補播。

相關檢查：work/music-card-focused.log、work/music-card-types.log、work/music-card-build.log、work/music-card-affected.log。外部Edge操作被工具網址辨識阻擋，尚未完成實際聽審，不能將自動測試宣稱為真人聽感驗收。
