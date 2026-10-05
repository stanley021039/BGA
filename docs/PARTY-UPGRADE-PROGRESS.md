# 遊戲內容與操作擴充進度

2026-10-05，使用者 U33。YouTube共看已發 [PR #36](https://github.com/stanley021039/BGA/pull/36)，head `2eeb398`、base `feat/draw-review-motion`（接續#34）。下列新需求在本地 `feat/party-content-and-race-paths`，不推送、不發PR、未部署。

最終遊戲程式本地提交 **`4bab53a`**；此前 `3780e6d` 合入main至`b843a3f`，保留PR#31鎖修正及角色記憶。PR#36仍停在2eeb398，這六項不進該PR。

| 需求 | 範圍／決策 | 目前狀態 |
| --- | --- | --- |
| 玩家改名 | 修改帳戶暱稱，保留登入帳號、席位、比分及歷史身分；更新現在房間與大廳 | 完成，Chrome已驗儲存及另一玩家名單同步；[改名細節](PLAYER-RENAME-PROGRESS.md) |
| 畫猜meme與約1000題 | 保留原內建題目ID，新增meme分類；多選、投稿及題庫查詢皆可用 | 完成1000題，其中100題meme；Chrome已驗篩選、儲存及選題；[內容來源](PARTY-CONTENT-PROGRESS.md) |
| 雷霆多格移動 | 本地hover預覽／server重算，優先避已知障礙；依原每步費用與事件走，遇擲骰或意外位置立即停路線 | 完成，Chrome單格後連續五格；hover零移動請求、遠格一次POST；重繪後焦點／路線保留；[規則](RACE-MULTI-MOVE-PROGRESS.md) |
| 成人禮物 | 獨立成人派對分類，房主明確選用；一般預設不混入 | 完成50件，預設關閉；Chrome已驗房主保存、guest摘要及題庫；未收到風格回答，採曖昧惡搞＋夜生活 |
| 入場過場 | 大廳標題／場地／可見遊戲插圖420ms小幅入場，一次載入只播放一次；不阻擋控制 | 完成，Chrome實際位移／透明度及停用驗收；共用motion測試8項通過 |
| 客製彈幕框 | 靜態PNG＋九宮格、收藏／分享／私人受眾及移轉計畫 | [實作評估](specs/CUSTOM-BARRAGE-FRAMES.md)完成，尚未加入遊戲 |

## 大廳入場

`public/hub.js` 使用既有 `MotionPolicy.animate`；首次有效登入資料到達後，對當下可見的標題／大廳及遊戲插圖播放420ms、至多165ms錯開。只改opacity／transform，內容始終可操作，沒有覆蓋畫面、播放音效或等待動畫完成才進入。

關閉動畫、系統減少動態或背景載入都跳過；隱藏／離頁透過共用政策取消，回到分頁不補播。頁面重新整理是新的入場；BFCache及房間列表輪詢不觸發重播。`node --check public/hub.js`及共用motion8/8通過，尚未據此宣稱GPU流暢度。

動畫可停用的原則參考 [W3C Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions)；420ms與小幅移動是本專案設計值，不是規範要求。

## 整合驗收（2026-10-05）

Windows Node 24.14.0 `npm test` 最終整合 **543/543** 通過，包含 main 的 PR #31 殘留鎖修正、新改名／內容／路線回歸及原五款功能。大廳舊 VM harness 已補上真實瀏覽器原有的 window／document 事件介面。路線組獨立94/94；內容63/63；共用motion8/8。沒有本批 Linux 完整測試證據。

原 Chrome 兩個登入身分、三個合成席位，正常 **3440×1271** 視窗、不加 viewport override、不將 Chrome 提到 OS 最上層；隔離 SQLite 與房間位於 localhost:3195，無正式資料或外部投稿副作用。其他席位部分操作由 HTTP 控制完成，不是三位真人。

| 項目 | 已觀察結果 | 限制 |
| --- | --- | --- |
| 改名 | 設定頁保存成功；另一帳號畫猜名單及大廳改為同一新暱稱 | 暱稱可改，登入username保留；不是改登入帳號 |
| meme | 房間只勾meme並保存；題庫dialog篩出100題；開局三張皆meme | 題庫1000題唯一／原120題相容由Node回歸；未逐題真人校準 |
| 成人禮物 | 初次checkbox未勾；房主儲存後非房主只讀摘要「成人派對開啟」；題庫成人分類50件 | 本輪一般隨機抽出四件舊禮物，不宣稱該輪恰好抽中成人；抽取來源／投稿過濾由HTTP及引擎回歸驗證 |
| 多格移動 | 六點骰先單步；再hover顯示5格／5點路線繞開未知危險；一次movePath POST，紀錄連走5格到達；鍵盤也有7格預覽 | 不跳過危險／檢定；正常畫面無水平溢出，沒有GPU幀率或真人公平性結論 |
| 入場 | 重新整理時讀到透明度0.7347→0.9430、Y位移9.47→2.03px，再回1／none；關動畫後8次皆1／none；還原偏好不補播 | 取樣是實際DOM computed style，不是螢幕呈現FPS；背景與reduced-motion取消由共用政策回歸驗證 |

後續Chrome重繪驗收：第二玩家選遠格5步／5點預覽後，第三合成帳號修改暱稱促成狀態重繪；新名出現且線仍在、焦點恢復原格。補三項回歸：presence-only重建恢復hover、keyboard恢復、骰dialog／過期版本不搶焦點或誤清線。真正移出／隱藏仍清除；不為自動化工具游標實際移開而硬保留。

證據及截圖在核准私有QA位置 `work/party-chrome-evidence.json`、`work/party-upgrade-windows-tests.log` 及 `work/party-*-ui.*`；不提交合成帳密／cookie。測試頁保留給使用者檢視，不沿用房碼當正式站。
