# 瞎掰王擴充及共用專注模式

2026-10-12；分支 feat/bluff-round-options，基線 main de526dc（PR #95 已合併），候選 1.29.0。未發布新 PR、合併或部署。

## 已實作

- 每輪想想私下三選一，只收到題名／難度，不收到正解；選定後才開始全員 10／30／60 秒角色倒數。其他玩家等待。測試 AI 也會選題。九人同一難度可完成每人一次、不重複的場次，未選題可重新出現。
- 揭曉／結束後的題目提供禁題投票。該輪真人席位為固定選民，過半數門檻 floor(N/2)+1；一人一票，AI 不投票。投票成功寫入 community.json 的 bluffBans，重新開站與其他房間的新抽題均排除。保存失敗不先計入達標票，可重試；已抽到但後來禁用的題目不得選擇。不修改既有 schema。
- 當輪非想想真人在口說階段可按反應，固定文字「哦是哦真的假的555555」，每人 5 秒冷卻；事件保留最多 12 筆，6 秒後不再回傳。使用本機 MP3，依共用音效開關／音量，接收端去重、5 秒播放間隔、初載及背景不補播，換階段／离頁停止；沒有 YouTube 播放器。
- 11 款現有遊戲皆接入共用 game-focus.js/css，保留遊戲 DOM、操作、分數及必要提示，隱藏導覽／旁邊聊天／管理及媒體工具。再點／Esc／原生 fullscreenchange 回復。支援瀏覽器原生全螢幕；不支援或拒絕時仍提供頁內專注畫面。沒有移動／重新建立遊戲 DOM、改遊戲狀態或儲存使用者偏好。新遊戲須標 data-game-focus、載入共用模組與 ui-primitives，已寫入 AGENTS.md。
- 瀏覽器驗收發現跑團缺 ui-primitives，提示框遮住新圖示按鈕；已補齊所有遊戲的必要依賴並以接入測試防回歸。新增資源採 1.29.0 版本 URL。

## 音效來源與格式

使用者指定 https://www.youtube.com/watch?v=pezuzuUDvyc；影片標題「統神之喔是喔真的假的55555」。依使用者明確要求轉檔，未宣稱為自製或已核對第三方授權。yt-dlp / FFmpeg 安裝及原始中間檔只留 ignored work；正式資源 public/assets/game-sounds/bluff-reaction.mp3，128 kbps、48 kHz stereo，約 1.66 秒；FFmpeg 完整解碼、peak -6.9 dB，无解碼錯誤。

Chromium 隔離 QA 載入真 AudioSettings、BluffReactions 及 MP3，原生 playing：duration 1.625417、volume 0.25、URL 為本機資源；靜音仍顯示文字，沒有新增 playing；無 console error/warn，無 iframe。這不代表已完成喇叭／耳機主觀聽感、手機實機、Safari 或弱網驗收。

## 驗證

- 新玩法／既有引擎／真 HTTP／音效及共用全螢幕初次 focused 40/40。
- 新增回歸：三選一私密性、禁止代選、計時開始點、九人選替代題不重複、多數決／重複投票／跨 store reload及新房間排除、保存失敗重試、AI 排除、反應權限／receipt／冷卻／逾時、外部禁用題目拒絕。
- 最初完整 Windows 2019/2019 通過（173020ms）。後續瀏覽器修正後的最終驗證以本文件後續記錄為準，不將這筆冒稱最終檔案測試。
- Chromium 實際瞎掰王：三個按鈕、選海洋雪後才出現 30 秒倒數、准备正常；共用專注與退出可用。其餘遊戲逐頁檢查，跑團／市場特殊依賴已修正。
- native 全螢幕與 Esc 使用 VM 模擬 API 驗證；內建瀏覽器實測的是頁內專注回退，不宣稱已完成真 OS 全螢幕或實機全款完整遊玩。


## 2026-10-12 最終交付驗證

完整 Windows 2023/2023 通過，fail/cancel/skip 0，132730ms（work/bluff-focus-final-tests.log）；此後補跨房間禁題即時替換選項，受影響瞎掰王引擎／真 HTTP／前端反應／專注測試 33/33 通過（work/bluff-final-game-tests.log）。專注最後補 root 幾何標記與外層單欄 CSS；交付前對共用資源／圖示配色與 overlay 再驗。

Chromium 隔離實際房間 BB07C0：想想三題中選海洋雪後才顯示30秒；揭曉正確計分，1位真人＋2AI投票門檻1，按禁題後顯示1/1、已全站禁用；下一輪AI想想選題，人類可按固定文字反應，專注內也可見。撲克先完成原有媒體同意（暫不觀看）後，專注進出正常；雷霆、跑團、市場及其餘房間頁都確認專注 root 可見、導覽隱藏。共用頁面不重新建遊戲 DOM；內建瀏覽器驗證的是頁內回退。

已補資料標記保留旁觀反應與必要 DIALOG／tooltip；相關回歸7/7。音效本機原生playing及靜音案例通過，證據使用 screenshot bluff-reaction-audio.png；專注實際房間 screenshot bluff-focus-final.png。全部 QA 為隔離站及合成帳號，沒有操作使用者房間或正式禁題資料。所有新版首頁遊戲自動由 data-game 目錄納入接入回歸，未來新增遊戲缺共用模組／ui-primitives 將使測試失敗。

候選仍1.29.0，release check以origin/main de526dc為minor通過；永久記憶更新本機且ignored。未推送、發布新PR、合併或部署。原生OS全螢幕、實機Safari、真人語音與主觀聽感仍未驗，沿用此前限制。

交付前最終影響範圍：玩法／HTTP／音效／反應／專注overlay／共用資源／日夜配色57/57通過，fail/cancel/skip0（2863ms，work/bluff-focus-delivery-tests.log）。本輪沒有將最後新增跨房間回歸冒稱包含在先前完整2023之中；以57項補驗最終修改。已保存最終專注內反應截圖，QA分頁已關閉。
