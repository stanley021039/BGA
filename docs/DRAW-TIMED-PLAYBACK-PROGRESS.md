# 畫猜防閃爍、逐點播放與平滑倒數進度

日期：2026-10-07。本輪已完成並發布 **v1.9.0**；本頁取代先前本輪「候選／待完整測試／待部署」段落。受測程式與不可覆寫的本地 tag `v1.9.0` 指向 `bfacd7ba0eae94e359489b4a33539fed5a381ef5`。發布時尚未新增 PR；後續文件提交不移動 tag。

送審更新：使用者於完成後明確要求發 PR，已建立 [PR46](https://github.com/stanley021039/BGA/pull/46)，標 Ready 並請 Stanley 審查。分支 `feat/draw-media-v1-9` 已整合包含 PR43 的最新 main；衝突解決後，程式、測試與其他非 Markdown 檔逐檔仍和受測 v1.9.0 相同，只補文件與合併紀錄。PR 包含 v1.5.0–v1.9.0 尚未送審的已完成功能，未合併 PR46。

本輪同時完成安靜的成功回饋及媒體視窗／手動同步需求。規範見 [作畫順暢度](specs/DRAWING-SMOOTHNESS.md)、[媒體視窗](specs/MEDIA-ICON-WINDOW-UI.md)；更早發布的畫猜改善保留在 [歷史進度](DRAWING-SMOOTHNESS-PROGRESS.md)。

## 實作與證據

| 項目 | 實作方式 | 已驗證結果與界線 |
| --- | --- | --- |
| A 原子呈現 | 畫猜 opt-in `atomicPresentation:true`；合作式重建在長駐 opaque staging 完成後，identity／generation 有效才整幅複製至 visible。yield 期間保留上一份完整畫作，artist ACK 不先清空 visible。 | renderer focused 41/41；四個 Chrome 控制案例與 legacy／fresh 嚴格 RGBA 差皆 0。兩個 fill 案例有 3／4 次 yield，途中 visible 未改；兩個 dense 案例同步完成，沒有中途採樣。 |
| A cache／context | 512×256 的 staging、opaque base 及 checkpoints 合計不超過 8MiB。保留 caller 原始 context creation options，不能把省略的 `willReadFrequently` 轉成明示 false。 | cache、取消、whenIdle 及原子呈現回歸通過。context 改正前有 native AA 差，改正後四例皆 0；不推斷使用者其他電腦的 GPU／CPU 原因。 |
| T 點時間 | brush／erase 可選 `pointTimes`，與 points 等長、safe integer 0..120000ms、chunk 內非遞減。捕捉 coalesced／pointerup 時間，carry anchor 保留原相對時間；immutable retries 不修改 batch body。 | backend focused 30/30（含新 7 項）；非法 timing 不改版本或額度，points／times 分別 clone。公開 ACK、SSE、snapshot 保留 `[0,40,130]`。 |
| T 接收端回放 | canonical acceptance／version 立即更新；viewer live brush／erase 用單一 rAF 逐点呈現，artist 不回放自己的 ACK。新筆 buffer 60ms、gap 上限 300ms、batch 展開上限 700ms、總 lead 上限 900ms；過度積壓回 canonical。 | 背景 Chrome trace：viewer 62 個採樣 frame 中 25 個 partial frame，最終 queue 排空；證明該 trace 逐步呈現，不等於自然 60fps或完整停頓錄影。 |
| T 基線／保存 | snapshot、reconnect、gap、reveal、undo、clear、fill、shape 等立即回完整 canonical 並取消舊尾巴。原 draw/stroke／SSE 與 quota 沿用，不加伺服器逐點或逐 frame timer。 | 自動回歸與公開 duplicate／nonartist／undo／clear 驗證通過。永久收藏仍 PNG，DB schema 未變；不宣稱本輪另做過真 UI 收藏。 |
| C 平滑倒數 | 共用 CountdownBar 用 WAAPI linear scaleX；native progress／秒數以 server deadline 為準。epoch／phase／新 deadline 重設，hidden／pagehide 取消，恢復時重建 baseline；currentTime 與 wall elapsed 漂移達 100ms 才補正。 | 三項專用回歸通過；控制 Animation.currentTime 在 0／8／16／32／64／120／200ms 間，scale 約 .643658→.641992 連續單調，之後還原。沒有新增逐 frame JS 或網路輪詢。 |
| Q 安靜回饋 | 移除 artist「輪到你畫圖」及成功「操作已完成」「猜測已送出」提示；錯誤、重新連線、儲存設定回饋仍保留。 | 真 Chrome 開始／選題／猜錯後，artist actions 與 guess status 為空；輸入清空，猜測留在聊天室。 |
| V 影片高度 | 沒有個人尺寸偏好時，active video 視窗使用 viewport 高度扣 16px；量測實際 chrome／間隔，player flex 填滿主區。既存個人尺寸仍尊重；music／empty／個人退出回原預設。 | Chrome 1794×1053：原視窗900×620／iframe870×321.203125，修後900×1037／iframe約870×757–762。640×1200 窄窗無水平溢出；390×260 的不足空間護欄保留。YouTube 自身長寬比留白與原生品牌連結不屬本站移除範圍。 |
| V 縮放／按鈕 | 修正 keyboard resize 把 DOMRect spread 丟失非 enumerable 欄位，改為明確讀取 left／top／width／height。桌機影片下方按鈕36px；coarse／mobile 保留44px。本站「在YouTube開啟」出口刪除。 | getter DOMRect 回歸先失敗後通過；八個 keyboard 邊緣實際縮放且保持同 iframe。原生 mouse 跨 iframe trace 不完整，不列成功拖曳證據。 |
| P 手動同步 | 全桌 seek slider 改為「同步我的播放進度」icon；controller 先調自己的原生 YouTube／Audio，只有按此鈕才讀 currentTime 並送既有 seek。普通席隱藏；未 ready／無 API fallback 禁用並說明。 | 真 YouTube API controlled seek47.25：shared仍0.001 paused／seek POST0；實際按鈕後雙席47.25／POST1。真 Audio controlled seek31.5：shared仍0.001 paused／revision18／累計POST1；按鈕後雙席31.5／revision19／POST2，兩席readyState4，member鈕隱藏。不是 mouse slider drag 驗收。 |

root 確認的閃白路徑是 visible clear／copyBase 後完整 suffix 尚未完成就 yield，以及 mutable→canonical ACK 重建先清空。五個真正 yield 的回歸修前 1 pass／4 fail；修後完成。原生持筆 trace 的 artist 56 個採樣 frame、26 次 ink 增長、whiteAfterInk 0；26 batches／51 個含 anchors 點。另一有效六次移動 trace 的兩席最終 PNG SHA 相同、版本 8、七批十三點皆有 timing，renderer／queue 排空。這些是有限的背景工具輸入與控制案例，不是所有輪、所有裝置或使用者另一台電腦的保證。

## 完整測試、發布與資料保存

| 驗收 | 結果 |
| --- | --- |
| Windows 全套 | Node24.14.0，1144/1144，37744.583ms。 |
| Linux 全套 | Node22.22.1，1144/1144，198338.756991ms。 |
| 結果完整性 | 兩平台 fail／cancel／skip／todo 皆 0。中間1131／1132／1134來源已被本頁最終1144取代。 |
| 版號 | minor1.9.0；release check 對 v1.8.3／minor 通過；發布包 SHA-256 `c65e033f50c3045208507dfd81bf067ada9b4f456a110a77dc1008d7a13f6106`。 |
| 備份／预演 | online SQLite backup＋另時點的 files／env archive，不是 atomic cold snapshot。副本 schema15／21表、8帳戶全欄位保留，隔離候選外部副作用關閉。 |
| 啟用 | 使用者明確選擇現在重啟，接受等待房間失效；UTC07:13:48 fresh inventory 後切換，啟用健康確認時間 UTC07:13:55.380Z，正式 v1.9.0，PID119055→128765，service／tunnel active。 |
| 公開畫猜 | UTC07:14:07.091Z，11資源精確 source／no-store，3個自有 member；timing ACK／SSE／snapshot、duplicate 額度、nonartist拒絕、undo／clear lifetime quota通過。單trace ACK29ms／SSE觀察29ms，不能作一般延遲或FPS排名。 |
| 公開媒體 | UTC07:15:00.076Z，13資源精確source／MIME／no-store；三自有 member點播、普通席 transport403、room manager seek／skip、降權即時、site role不變。 |
| 正式資料 | schema15，21表schemas、20個非session表既有rows／BLOB及8帳戶全欄位相同；integrity ok、FK0。有效data／env路徑不變、import generation未啟用。session173→184包含本輪已登出QA登入，不能寫全DB逐列不變。 |
| 清理 | 自有正式驗收房已離席刪除、sessions登出；兩個local media Chrome分頁關閉、viewport override還原、隔離preview／proxy／SSE／presence正常停止。未將瀏覽器提到前景。 |

去敏診斷檔與截圖保存在本機 ignored `work/`，包括 `draw-timed-atomic-native-final.json`、`draw-timed-native-artist.json`、`draw-timed-countdown-native-final.json`、`draw-timed-live-pixel-proof.json`、`draw-timed-quiet-native.json`、`media-manual-music-verification.json`。截圖 `draw-timed-quiet-proof.png` 與 `media-manual-sync-final-proof.png` 已人工檢視；private credentials、cookie、原始 HAR 與本機偏好不進 Git 或發布包。

## 長期檢查與尚未實測範圍

每次改畫猜 input／transport／renderer，每輪都檢查持筆、ACK settle、reveal→新畫者／canvasEpoch 是否閃白、殘影或丟草稿；並檢查 viewer逐點時序、baseline操作取消、倒數及隊列清理。規則已寫入 [AGENTS](../AGENTS.md) 及角色記憶，不能只靠最終圖片相同宣稱途中順暢。

本輪沒有完整多輪真人 native矩陣、不同硬體、真弱網／封包遺失、自然60fps量測、原生 mouse timeline拖曳或喇叭聽感驗收。既有自動測試與上述有限trace不能替代這些；後續依問題補針對性驗證。播放器時間讀取保留2秒deadline、generation／playerEpoch／currentKey／revision／playback signature／provider／ACL／關窗取消與晚回覆防護，不能為了少量延遲而放寬權限或主動逐秒同步。
