# YouTube 視窗縮放驗收

日期：2026-10-07。正式 **v1.7.0**／`82149a4`，已完成公開站背景Chrome驗收。

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
| 背景Chrome桌機 | 實際YouTube播放器由526×295.875放大至776×355.875；拖到下限後246×210。room-watch resource計數2→2；原生video觀察paused=false、readyState=4、無media error。 |
| 小螢幕 | 390×844及320×568時，播放器262×210；320時視窗280×552、四邊及44pxresize按鈕都在viewport內。測後viewport立即還原。 |
| 200%文字 | root font32px＋ui-large-text，1440×1000：播放器246×210、操作列及首按鈕均107.59375高，視窗自動增高至691.59375；原存280×578未被自動覆寫。測後字級／class／viewport還原。 |
| 恢復大小 | UI按鈕後size key移除，回560×629.875外框／526×295.875影片；位置保留。 |

本機使用隔離資料與合成帳號；瀏覽器extension的message-channel error有觀察到，沒有據此判定本站程式錯誤。本輪沒有測所有影片、所有瀏覽器或真人裝置；不承諾極短viewport仍能容納播放器加完整controls。

## 正式發布与公開驗收

Windows Node24.14.0及Linux Node22.22.1完整各 **914/914**，Linux149785.896649ms，fail／cancelled／skipped／todo均0。Linux從乾淨Git archive執行；受測程式及不可覆寫本地annotated tag `v1.7.0`為`82149a42e09ea9940a6ea16316f23f70af04cfa9`，archive SHA256 `cfc94f4437e320accba4a123a902c64c20da04c8979f2e6704d39404353da212`。release:check以v1.6.0驗minor通過，私有檔／work／env未封存；沒有新PR或push。後續純文件不移動tag。

新鮮備份 `/home/ccc/apps/afterhours/shared/backups/pre-watch-resize-fixes-82149a4-20261006T210801Z-78ecef76-a07e-4e3a-8486-b559d6fcbc36`：SQLite線上一致性備份，檔案及env分開備份，非跨檔原子冷快照。副本啟動前後21表schema／rows／BLOB相同，8帳戶全欄位保留。0房間切換至`releases/82149a4`，核對舊PID83301後SIGTERM，由既有服務重啟為85927；service及tunnel active。schema15／integrity ok／FK0、env與原資料路徑不變，外站資料代未啟用。

公開v1.7.0及table-watch JS／CSS、GameUI JS共3份內容／MIME／no-store精確比對通過。兩個僅loopback代理綁既有合成會員，資料及資源請求來自shhuang.cc，沒有改使用者真正正式站的Chrome登入。3席等待桌選官方範例影片，2個背景Chrome加入，房主以個人按鈕播放、觀看者使用原生YouTube播放。跨frame高階click曾被工具報header攔截；核對iframe與內部按鈕幾何後，以CDP虛擬指標在實際原生按鈕中心成功播放，沒有提高視窗或用force略過檢查。

| 正式驗收 | 結果 |
| --- | --- |
| 實播縮放 | 房主526×295.875→776×375.875→246×210；觀看者維持526×295.875，另用Shift方向鍵變576×295.875。兩邊room-watch resource均2→2，全桌仍revision1／paused；本機video皆paused=false、readyState4、error=null，一次讀值104.2616／80.0312秒。兩人從不同時間手動開始，這是尺寸測試，不能用此數值宣稱同步。 |
| Player identity | 保留iframe的Runtime物件reference，經最小尺寸、viewport、字級及觀看者鍵盤操作後，兩席仍與現存iframe嚴格相等。DOM.getDocument重新取得的frontend node ID會變，不把它當作重建或保持的判據。 |
| 窄螢幕 | 320×568：浮窗280×506、四邊與44px把手在viewport內，播放器262×210／iframe保留。 |
| 200%文字 | 1440×1000、root32px＋large text：視窗自動280×613.59375，player246×210，本機操作列及首按鈕均107.59375；原size280×506不覆寫。 |
| 雙欄 | 展開controls後將視窗放到950×756，narrow=false、player564.140625×396，controls331.84375×537；watch仍2筆。 |
| 成果 | 截圖影片766×396，`work/watch-resize-public-final.jpg`；原始去敏量測`watch-resize-public-browser.json`、HTTP確認`watch-resize-public-verification.json`，兩tab console error0。 |

測後字級／class／viewport及兩來源原尺寸／位置key還原，兩個iframe關閉、tab／proxy／presence停止；自己的3席正常離房、3個session登出，rooms0。最後20非session表所有rows／BLOB及21schema與新鮮備份相同，8帳戶全欄位保留；session149→152是正常QA登入／登出，不宣稱sessions逐列一致。PID85927仍正常。
