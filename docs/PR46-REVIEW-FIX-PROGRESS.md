# PR46 審查修正與正式同步

2026-10-07：[PR #46](https://github.com/stanley021039/BGA/pull/46) 的 Stanley 兩項 P2 已修正，已在 PR 分支整合 main `72ed917`、推送受測程式 `3b9363e2c0e7b815f77643b7a7137320de70e881`（候選v1.9.1），[逐項回覆](https://github.com/stanley021039/BGA/pull/46#issuecomment-6034927131) 後標 Ready 並再次請 Stanley 審查，**未合併 PR46**。原審查：[問題留言](https://github.com/stanley021039/BGA/pull/46#issuecomment-6033480529)。

正式同步保留此前已發布的UI／WebGL，使用另一分支 **v1.11.0**／`67e49a164ac5fcb4c3b3cce0fe2b8d899c860e62`；本地 annotated tag `v1.11.0` 固定該程式。PR來源與正式整合來源分開驗，不把UI／WebGL塞回PR46，也不因後續文件提交移動tag。

## 修正與回歸契約

| 項目 | 實作與先失敗證據 | 最終驗收 |
| --- | --- | --- |
| 重建中clear／undo留下舊圖 | `surfaceRevision`／`presentedSurfaceRevision`分別追staging實際寫入與最後可見提交；clear／undo雖沒有新增stroke，只要surface未呈現，latest權威job完成仍提交。latest job／generation保護，settled no-op不copy。 | 兩項fail-before重現，renderer focused45／45。真Canvas2D 512×256的clear／undo × classic／canonical／layered × sync／cooperative，共12種組合最終RGBA等fresh、old job false、copy一次、途中舊完整畫面仍可見。 |
| 切回分頁音樂未恢復 | `interruptedAudio`只記此次hidden自動pause的Audio／clip key／epoch，等fresh marker對上才恢復。停止、換曲／過時promise不復活舊clip，不加poll／seek。 | 6新回歸、先3fail後media70／70；manualpause／settingsdisabled／browserreject／sharedpaused與videoexit仍保持。真HTMLAudio visibility測試詳下表。 |
| main整合 | 四處衝突保留MarketImageStore、schema16、pngjs7／sharp0.35.5、market upload3MiB／approve128KiB、角色4MiB、preserveImportedSessions及共用GameUI／gallery入口。 | 圖片store／HTTP／data-transfer／角色圖片focused165／165，含cold15副本升16、full16帶PNG審核資料還原。 |

這不是單純以目標version判斷畫布是否需copy；可見surface若仍舊、staging已因clear／undo寫入就必須present。媒體也不能把所有paused Audio自動play；自動visibility中斷與玩家／共用設定意圖須分清。

## 最終完整測試

| 受測來源 | Windows | Linux | 狀態 |
| --- | --- | --- | --- |
| PR46固定程式／v1.9.1候選 | **1,263／1,263**，**45,389.7554ms** | **1,263／1,263**，**215,289.670901ms** | fail／cancel／skip／todo均0；沒有網卡preload。 |
| 保留UI／WebGL的正式v1.11.0 | **1,284／1,284**，**37,712.5192ms** | **1,284／1,284**，**212,541.059917ms** | fail／cancel／skip／todo均0；來源與本地tag一致。 |

focused是上表內的部分回歸，不再加總；過去待驗／Draft／舊測試數保留為歷史，不能代表本次結果。正式source archive SHA-256：`628a89339ca46bff33d277248768900fd7ffbc489ed07085c6697d3db0266cf6`。

## 背景原生驗收

| 場景 | 實際觀察 | 範圍／限制 |
| --- | --- | --- |
| 12種畫布清理／撤銷 | 真512×256Canvas2D最終RGBA等fresh，舊job不覆蓋、只copy一次、途中仍舊完整可見畫面。 | `work/pr46-canvas-native-result.json`；不是只用fake raster結論，也不宣稱所有畫作／硬體均一致。 |
| 第二輪真持筆 | 6move／artist30樣本whiteAfterInk0，兩席13timedpoints；viewer7partial，最後pending0／frame false。 | `work/pr46-draw-artist2-native.json`／`pr46-draw-viewer2-native.json`。第一輪viewer誤把array傳view取樣已排除，以逐stroke第二輪為準；不當FPS。 |
| 揭曉／換輪 | 兩席第一輪held、reveal與第二輪新epoch空baseline已查。 | 合法空圖與非預期閃白分開；單段trace不表示全部自然多輪均驗。 |
| 音樂hidden→visible | 真HTMLAudio無聲MP3：hidden paused、time1.237931s；visible同Audio playing、time36.639237s。room-media requests3→3，沒有多發同步。 | `work/pr46-media-native-result.json`；FocusEmulation改真document.hidden／visibility，不是物理切頁或實體喇叭驗收。 |
| 個人關聲音 | 點關音樂後hide／show仍muted／paused true。 | 驗setting意圖不被自動resume蓋過；其他拒播／過期條件另有契約測試。 |
| 市場入口 | `/market`每日預測／圖片投稿／admin審核空庫入口smoke，hidden正常、無橫溢。 | 沒有真圖片upload→審核完整native流程；資料／HTTP／備份還原另測。 |
| 清理 | 三owned背景tab已FocusEmulation false後close，TTYpreview正常stop／exit0，3480..3483無listen。 | 測試未將Chrome提到前景；不改使用者帳戶／前景偏好。 |

## 正式發布與資料保全

2026-10-07T09:15:24.105Z，fresh rooms0 guard後由v1.10.0切v1.11.0；PID131939→136722，服務／tunnel health正常。線上SQLite備份與另時點檔案archive，不是atomic cold snapshot；隔離副本schema15→16只新增空`market_images`，migration及boot兩次均驗21舊表allrows／BLOB與8users全fields保持。

| 正式檢查 | 結果 |
| --- | --- |
| 啟動／schema | v1.11.0／固定source，schema16／22表、integrity ok／FK0，既有環境與資料路徑保持。 |
| 公開畫猜 | 22assets精確受測來源，SSE點時間、dedupe／quota、undo／clear額度不退與nonartist拒絕通過。 |
| 公開媒體 | 23assets精確受測來源，房間manager／一般席控制與promote／demote ACL通過。 |
| 公開市場 | mine200／admin403符合一般會員權限。初次QA script比對市場HTML遺漏`.html`，創房前已logout；修script重跑通過，非產品故障。 |
| 最後資料 | 20舊non-session表allrows／BLOB、8users全fields保持；新market_images0，sessions191→201是失敗QA3登入＋guard1＋smoke6，不能說sessions不變。 |
| 收尾 | 自有驗收房刪除／session登出，QA history保留；原profiles／artwork不寫，source／tag不因文件更動。 |

截至本批，schema16取代此前「目前schema15」狀態；[PR45市場圖片](MARKET-GALLERY.md)已在main，正式1.11保留其功能，但不把空庫native入口smoke稱完整圖片審核實玩。後續比較仍可涵蓋自然多輪、弱網、多硬體、真圖片上傳審核與實體切頁／音響。沒有全玩法、前景FPS、GPU加速或喇叭結論。

公開文件不包含私人偏好、帳密、房號、cookie、主機私有路徑與raw HAR。最後驗收紀錄為純文件更新，不更動受測程式或發行tag。
