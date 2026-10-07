# 等大角色卡與共用姓名槽

2026-10-07：正式 **v1.5.7**／`4c5b5e7`，Windows／Linux各883、公開30資源及3席姓名／卡片驗收通過。

| 分類 | 實作 | 驗收方式 |
| --- | --- | --- |
| 一致尺寸 | 畫猜名單grid-auto-rows:1fr；結算以同一份玩家排名卡格線展示所有玩家，4／2／1欄（桌機／手機／大字），不同姓名不撐開卡。 | 同群組寬高相同；勝者與其他玩家、分數及頭像都保留。 |
| 姓名顯示 | 共用GameUI.playerName(name)，單份文字與安全escaped原生title；自己／AI suffix放在姓名槽外。 | 短名／剛好可容納者不動，超寬者按實際差距移動；hover全名提示不被卡片overflow裁掉。 |
| 對齊 | 姓名固定單行，結算短名置中，長名槽滿寬；56×64頭像、固定排名與勝者標記。 | 名字長短不改高度或擠掉比分；不用縮字補尺寸。 |
| 動態與效能 | RO／MO＋單rAF批次讀寫，transform動畫，不複製文字、不加poll／timer／永久will-change。 | 同值不反覆寫；hover／focus暫停，系統reduce／共用停動／背景立即停，字體／重命名／hidden／移除／BFCache正確處理。 |
| 重用 | GameShell.playerRow供畫猜／送禮／同頻／撲克；通用shared-player及雷霆crew-name也用同一姓名槽。 | 只限制姓名；角色狀態、車輛、骰子與比分保留。 |

## 本機背景 Chrome

隔離loopback及合成帳戶；實際完成八輪，8位同分798。沒有操作使用者前景／正式登入。

| 視窗／案例 | 結果 |
| --- | --- |
| 1280×720 | 8張結算卡均151.75×162；8張名單均167×81；page1280×720，必要名單／結果局部scroll。 |
| 1440×1000 | 8張結算卡均189.75×162；8張名單均182×81；page1440×1000。 |
| 1920×1080 | 8張結算卡均269.75×162；8張名單均202×81；page1920×1080。 |
| 390×844 | 結算8張138.5×162，名單8張325×88；自然直排page寬375（垂直scrollbar15px），無橫向overflow。 |
| 390px／200%文字 | 一欄8張均289×216；page寬375，內容自然scroll。 |
| 16字長名1440 | 姓名文字256px／slot162px，僅超寬者data-name-overflow=true，shift−94px；實際transform x−57.3015證明有移動。 |
| hover與停動 | 模擬Chrome mouseMoved後hover=true／animationPlayState=paused，title完整16字；共用MotionPolicy關閉後motion=off／animation=none；系統reduce的CSS也none。臨時設定均還原。 |
| 其他四款 | 送禮slot228／text256、同頻250／256、撲克側欄165／256皆超寬才動；雷霆車隊398／256可容納所以不動；角色／離線／車隊狀態保留。 |

共用元件由components_design實作及測試，主agent整合renderer／格線與實Chrome。12姓名回歸涵蓋escaping、單文字、剛好尺寸、rAF batching、hidden、rename、移除／換text、BFCache與motion；3畫猜及3共用row回歸保留所有同分／非勝者／分數／安全fallback與suffix，勝者標記沿用ui-symbol置中契約。最終完整Windows Node24.14.0 **883/883**，29175.0563ms、失敗／取消／跳過0。

原始量測／PNG在ignored work。原生title內容與Chrome hover狀態已驗，Page screenshot不含作業系統原生tooltip像素；背景可見性、BFCache及節點釋放有單元證據，沒有另行聲稱完整真人多裝置實玩或全站所有卡片都改等尺寸。八席720p結果／名單可局部scroll，手機／大字不承諾單屏。

## 發布與正式驗收

受測程式及不可覆寫本地tag `v1.5.7`：`4c5b5e795fe63525b07a0c8222fd2f720eeba958`。Windows Node24.14.0 **883/883**／29175.0563ms，Linux Node22.22.1 **883/883**／145549.619768ms；失敗／取消／跳過均0。Linux為乾淨Git archive，SHA256 `681e1ef0de17685da1ccd3a75606ebc0234a567594d2d99462a9b04ee5fe70c2`；release:check patch基準v1.5.6及syntax／diff檢查通過，私人檔案、work與env未納發布包。

新鮮備份 `pre-draw-names-fixes-4c5b5e7-20261006T193336Z-cd8522e2-08c2-48ed-9978-0fc591d2ef92`：SQLite一致性備份與持久檔另備，非跨檔原子冷快照。副本隔離啟動前後21表schema／rows／BLOB一致，8帳戶全欄位保留。正式0房間切換至 `releases/4c5b5e7`；核對舊PID76509後SIGTERM，既有Restart=always啟動78591，service／tunnel active，schema15／21表、env與資料路徑不變，integrity ok／FK0。

公開v1.5.7／no-store、19HTML＋11模組共30資源逐字及MIME核對，測試會員/admin仍403。正式3席用暫時短名及16字長名驗布局（系統自動完局、0分；主動八輪／798分證據來自上方本機八席），1440×1000結果：

| 項目 | 實測 |
| --- | --- |
| 結算卡 | 三張均189.75×162；左側三張均174×88。 |
| 畫面 | page1440×1000，沒有整頁捲軸；必要結果局部scroll仍保留。 |
| 跑馬燈 | 長名text256／slot162，shift−94px；實際transform x−94，motion=on；短名overflow=false／motion=off。 |
| hover／減少動態 | Chrome mouseMoved後hover=true／paused，title完整16字；force系統reduce後animation=none／motion=off，再還原。 |
| 影像與錯誤 | 7张頭像decode成功，全頁PNG保存；console無error／warn。 |

臨時viewport／media及本機字級／motion設定還原，own3帳戶原暱稱核對復原、席位離房／session登出後0房間。所有preview／presence／proxy停止、自己的Chrome測試tab關閉；使用者原正式登入未改。最後再次核對8帳戶全欄位與新鮮備份完全相同，schema15／21表／integrity ok／FK0／PID78591正常。沒有新PR／push，外站匯入資料代仍未啟用；後續純證據文件不移動tag。
