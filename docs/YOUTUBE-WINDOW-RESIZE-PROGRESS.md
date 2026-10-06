# YouTube 視窗縮放驗收

日期：2026-10-07。候選 v1.7.0；正式部署及公開站驗收結果待補。

## 操作與契約

| 項目 | 實作 |
| --- | --- |
| 大小 | 拖曳浮窗右下角縮放；方向鍵每次20px，Shift加大為50px，Home或上方恢復大小圖示回預設。原頂端工具列仍用於移動。 |
| 個人記憶 | `bga.watch.size.v1`只存個人localStorage的width／height；原`bga.watch.window.v1`位置格式保留。縮小瀏覽器暫時限制尺寸，不覆寫原偏好；恢復大小移除尺寸key。 |
| 播放器保護 | 依實際工具列、狀態列、頁尾、字級及個人操作列高度計算最小高度，預留210px播放器高度；窗寬最低280px並受實際viewport限制。不能只檢查外框200×200。 |
| 排版 | 以浮窗自身寬度切換雙欄／單欄；縮放後選片及個人操作區必要時局部捲動，resize按鈕在iframe之外。大字級變動以ResizeObserver重新量測。 |
| 播放與流量 | 尺寸變動不換iframe、不重載影片、不送共看GET／POST，也不更改其他玩家尺寸或時間軸。極小viewport不足保護空間時停止本機觀看並保留重新加入入口。 |

官方要求播放器viewport至少200×200，另推薦16:9至少480×270；210px是本專案保護餘量。[YouTube IFrame API Requirements](https://developers.google.com/youtube/iframe_api_reference#Requirements)。視窗大小不能解決影片禁止嵌入、地區限制或瀏覽器自動播放限制。

## 已觀察證據

| 驗收 | 結果／範圍 |
| --- | --- |
| Windows完整回歸 | Node 24.14.0，914/914；fail／cancelled／skipped／todo均0，30367.1211ms。 |
| 共看focused | 舊前端及新增resize共70/70，涵蓋儲存錯誤／非有限數、pointer擁有權、close清理、keyboard／Home、兩client、偏好恢復、header/footer及大字級操作列量測。 |
| 背景Chrome桌機 | 實際YouTube播放器由526×295.875放大至776×355.875；拖到下限後246×210。DOM iframe node保持同一個，room-watch resource計數2→2；原生video觀察paused=false、readyState=4、無media error。 |
| 小螢幕 | 390×844及320×568時，播放器262×210；320時視窗280×552、四邊及44pxresize按鈕都在viewport內。測後viewport立即還原。 |
| 200%文字 | root font32px＋ui-large-text，1440×1000：播放器246×210、操作列及首按鈕均107.59375高，視窗自動增高至691.59375；原存280×578未被自動覆寫。測後字級／class／viewport還原。 |
| 恢復大小 | UI按鈕後size key移除，回560×629.875外框／526×295.875影片；位置保留。 |

本機使用隔離資料與合成帳號；瀏覽器extension的message-channel error有觀察到，沒有據此判定本站程式錯誤。本輪沒有測所有影片、所有瀏覽器或真人裝置；不承諾極短viewport仍能容納播放器加完整controls。
