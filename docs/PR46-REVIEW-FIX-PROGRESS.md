# PR46 審查修正與正式同步

2026-10-07最新正式同步：**shhuang.cc v1.12.0／83ffcab**已發布，保留PR46合併後相同三份media程式／測試並加入本批原生UI；雙平台1,386、公開與資料核對完成，見 [UI實績](UI-COMPONENT-PATTERNS-PROGRESS.md)。PR46程式／tag1.9.3仍固定a2、雙平台1,300，外部merge1ea916a／headf36b679保持，沒有root merge操作、沒有新UI PR或推merged分支。下方formal1.11.1／Ready為歷史；closed PR body已同步正式1.12實績、[follow-up6039588219](https://github.com/stanley021039/BGA/pull/46#issuecomment-6039588219)已發，state仍closed／merged true。

2026-10-07最新GitHub狀態：**PR46已closed／merged**，merged_at `2026-10-07T13:44:38Z`，merge `1ea916ad651c4b8cad0babfdceed154348a20156`、head f36b679。這是外部已合併，root沒有merge操作；fetch後核對三份media程式／測試與a2c5589及patterns固定83ffcab一致，不需runtime變更。下方Ready／尚未合併是歷史；PR1.9.3雙平台1,300與UI1.12雙平台1,386分開，本批新UI不屬PR46。正式部署以 [patterns進度](UI-COMPONENT-PATTERNS-PROGRESS.md)最新實績為準，不推已merged PR分支。

## 2026-10-07：新事件排序驗收與重新送審完成

[Stanley新回覆](https://github.com/stanley021039/BGA/pull/46#issuecomment-6037336371)對bb7b3d提出media state／event排序風險。候選 **v1.9.3**／固定程式 `a2c5589232ed2d4d595a5ac33fbaef572a04fd4f`已完成雙平台各1,300、focused126／獨立複查與fresh真原型API的Pause／最後Play／正常visibility三情境；release／merge-tree／diff checks通過。未加patterns或改renderer。PR已推送4604dce、更新描述與 [最終回覆](https://github.com/stanley021039/BGA/pull/46#issuecomment-6038913529)、Ready（draft=false）並再次請Stanley審查，未合併。本地tag v1.9.3固定a2c5589，後續純文檔提交不移動tag；正式仍v1.11.1，patterns未發布也不加入本PR。中間回覆只保留歷史。

| 本次範圍 | 已知與待驗 |
| --- | --- |
| 舊三項P2與main | 已有固定source、雙平台和native證據；前次actual AudioSettings focused104與main整合保持。下面結果不是本次新風險的反證或fresh驗收。 |
| 新mediastate／event order | 原生play／pause狀態先改、事件另排media task；HTTP body JSON Promise可在事件前恢復舊播放。不能只看當下paused／timestamp或假設加capture即安全。用本機play／pause Promise建立同Audio事件fence，區分owned與較新意圖。 |
| 有界與意圖 | 每fence事件buffer≤64、current＋最多7個predecessor共8、每flow corrections≤8；超限failclosed並保可讀重試。external API／pointer／keyboard取消舊proof，最後bare Play可forward並保本機位置；queue-only GET不seek。 |
| 回退／cleanup | genuine opt-in照原權限forward；mute／sharedpause／retire／過期clip不能復活。清監聽器、proof事件／predecessor、preview callbacks與method wrapper；不加poll／seek／media請求。 |
| 收尾 | Windows／Linux frozen全套、126focused／獨立複查、fresh原型Pause／最後Play／normal與proxy流量已驗；ownfixture／tabs／overrides已清理。PR已推送／Ready／再次請Stanley審查，未合併；未發布新正式patch。 |
| 正式與UI | 正式仍已驗v1.11.1／df983da；未因新回覆變更服務或資料。未發布patterns候選1.12不加入PR46，另於main恢復整合。 |

| 新固定來源驗收 | 結果／範圍 |
| --- | --- |
| Windows Node24.14.0 | **1,300／1,300**，**60,842.6149ms**，fail／cancel／skip／todo均0。 |
| Focused／獨立peer | media107＋actual AudioSettings19＝**126**；獨立126＋10probes通過，不加進完整總數。 |
| Linux Node22.22.1 | **1,300／1,300**，**219,640.107979ms**，fail／cancel／skip／todo均0；frozen archive SHA-256 `f0fec37eac453173a031fd0b3b3d9c9bafa3539f9a87f63620ad68de17a9e555`。 |
| 原生修前 | bb7b3d真Audio原型Play／Pause繞過instance wrapper、Ready4、Input0；釋放持有的真HTTP JSON body Promise在media events前完成，最後sameAudio1／paused false。`work/pr46-ordering-native-before.json`。 |
| 最終source原生 | Debugger載入JS SHA `b27d3b7b8deed09b2176a8c041d0efa8bf07dab5a1e72fc5b46f1772c659f14f`；同原型／body Promise條件，最後paused true／sameAudio1／dialog visible，GET4→4。`work/pr46-ordering-native-final.json`，早期draft4624／2d1結果排除作final。 |

較早原型case仍觀察到own resume短暫約1ms後被正確Pause；fresh最終case約3.6ms，見下表，**不能寫零瞬間播放／零 transient**。Input0的實際原型API不是physical UA controls／硬體按鍵，也不能由trusted media event推成人手點擊；沒有喇叭、前景FPS或所有裝置結論。

### 測試gate更正與fresh控制驗收

先前normal marker9／snapshot7、gatePending1是QA gate仍持有JSON；client `gateEnabled=false`不會release已held body。已drain、restore fetch後另以freshfixture驗證，這個舊診斷不算產品故障／正式blocker。晚期Performance Resource Timing buffer已滿，舊performance計數不當HTTP證據；下表使用 **proxy `/__qa/log`**，不外推舊case4→4。

fresh三case皆Debugger驗載入SHA `b27d3b7b8deed09b2176a8c041d0efa8bf07dab5a1e72fc5b46f1772c659f14f`、truncated false；原型API繞instance wrapper、無pointer／key，readyState4，持有真HTTP JSON Promise在same developer task釋放。

| Fresh case | 最終狀態／proxy流量 | 證據與限制 |
| --- | --- | --- |
| Play→Pause→late GET | paused true／sameAudio／audioCount1／dialog open；總media請求4→4，GET3→3／POST1→1。 | `work/pr46-ordering-native-fresh-pause.json`。有trusted media events，own resume約3.6ms後correct pause；不稱zero transient或physical UA控制。 |
| Play→Pause→seek37→最後Play→late GET | paused false／time37.155091／ready4／同Audio；總media請求5→5，GET4→4／POST1→1。 | `work/pr46-ordering-native-fresh-play.json`。最後Play及本機進度保留，proxy證明本次無新增GET／POST，不當全流量benchmark。 |
| 正常hide→show | hidden paused true／ready4→visible paused false／ready4，同Audio、pending0；總media請求5→5，GET4→4／POST1→1。 | `work/pr46-ordering-native-fresh-normal.json`。是受控visibility／原生Audio狀態，不是喇叭／實體切頁／所有裝置。 |

原 `pr46-ordering-native-final.json`的約1ms transient仍是較早case，不把它與fresh約3.6ms拼成同一次測量；fresh是本次最終控制驗收。已restore fetch、drain held JSON、Debugger.disable、clearFocus／metrics、關兩ownChrome tabs、停止fixture；沒有正式或其他使用者資料操作。

本段不推翻下面第三P2／正式1.11.1歷史；新問題已有受控native重現，但未把它寫成正式站自然故障。公開文檔不存原帳密、房號、私有prefs或HAR，未執行新部署；patterns仍暫停未發布。

## 2026-10-07：第三項 P2 驗收完成／正式v1.11.1

使用者要求先處理PR再繼續其他UI。本段針對 [Stanley的新回覆](https://github.com/stanley021039/BGA/pull/46#issuecomment-6035554999)，起始head `ed0071d`；修正已固定PR候選 **v1.9.2**／`cf64bfc4a4f86877c50f024b56706efdd5898e80`，Windows／Linux完整及最後原生controls通過。保留已發布UI／WebGL的正式 **v1.11.1**／`df983da7714efcf9382d6953746b828e026c76a0`已發布，本地tag固定df983da，沒有未發布patterns。本段取代舊待驗來源與中間數字，下方1,263／1,284與前次Audio trace仍是歷史。

兩筆程式修正與驗收文件已推送 PR46，最終受測程式仍為 cf64bfc；已更新 PR 描述、[逐項回覆](https://github.com/stanley021039/BGA/pull/46#issuecomment-6037042380)、標 Ready 並再次請 Stanley 審查。GitHub 已確認 mergeable=true、draft=false；未合併 PR46，未推送正式整合分支。後續純文件提交不改受測程式。

| 新問題 | 必須保持的行為 | 目前狀態／待驗 |
| --- | --- | --- |
| hidden→show等待fresh marker期間，延遲queue-only GET晚於原生Play→Pause，舊visibility中斷記錄誤自動play並覆蓋較新Pause | 原生Play後再Pause撤銷舊resume資格；同clip／key／epoch與fresh marker不能代替本機意圖。晚GET可以更新清單，不能蓋較新Pause。 | 已修並有先失敗回歸，最終cf64bfc的fresh真UA controls驗paused true／同Audio／requests8→8；不再只沿用初版9→9。 |
| pending播放被hidden中斷 | pending play在visibility自動pause後的Abort／resolve／finally不得遺失仍合資格的中斷resume；保留native pause／mute／retire與noLoop保護。 | 15新case含7項pending Abort／resolve／mute／native／retire／noLoop；actual AudioSettings的media85＋settings19 focused共104。 |
| 權威播放／最低流量 | manualpause／settingsdisabled／browserreject／sharedpaused／videoexit與staleclip／promise保持，不加poll／seek。 | 最終原生意圖requests8→8；受控pending retry也無新增media request。修前4→4／初版9→9／正常恢復與mute10→10是分開案例，不是完整流量benchmark。 |

| 固定來源 | Windows最終 | Linux |
| --- | --- | --- |
| PR v1.9.2／cf64bfc | **1,278／1,278**，**59,104.0983ms** | Node22.22.1 **1,278／1,278**，**228,063.200118ms**。 |
| 正式v1.11.1／df983da | **1,299／1,299**，**58,586.974ms** | Node22.22.1 **1,299／1,299**，**227,952.418304ms**。 |

兩平台各來源fail／cancel／skip／todo均0，沒有網卡preload，input／tar固定來源與SHA一致；focused不加到完整總數。1,271／1,292及早期pending版本、較早36項等中間數字由最終來源取代。正式source archive SHA-256：`7d2dac00d60a78fabb0e887eb3784bc1556573bfa70484734634e8e88ee46d01`。

| 原生情境 | 真實觀察 | 尚未驗或限制 |
| --- | --- | --- |
| 原審查head修前 | 原生UA controls Play→Pause＋delay GET，最後同Audio數1卻paused false、可見／dialog開啟，requests4→4。 | 是真controls重現，不拿第一輪renderer錯誤array樣本或前次Audio resume當此次證據。 |
| 最終source原生controls | cf64bfc：FocusEmulation真hidden／visible、hold queue GET；實際UA controls Play→Pause後late GET仍paused true／sameAudio1，nativeVisible／dialogOpen true、play／pause事件全trusted，requests8→8。 | `work/pr46-intent-native-final.json`。是最終source的freshcase；初版9→9與正常／mute10→10保留為另外樣本，不冒稱所有分支皆真實切頁。 |
| HAVE_NOTHING原生promise | 真HTMLAudio held bytes、readyState0；實際native.pause造成trusted pause與真AbortError。中間pending版plays1／paused true／pending false、誤blocked提示；cf64bfc Abort後只重試自己的plays2／paused false／pending true／status空、同clip、無新增media request。 | visibility用受控document.hidden getter／events（已刪除），不是physical native切頁；release bytes後second promise resolved但自然結束切video，不能稱sameClip持續播放。精確METADATA1與notify-playing取出正常resolve、mute／native／retire分支由media85／focused104的VM驗。 |

這些是無聲MP3／controlled native promise與controls證據，不是端到端metadata1、實體切頁／喇叭或全部弱網情境。

本次canvasrenderer未修改；clear／undo surfaceRevision及先前12個原生組合屬已獨立複查的既有scope，不宣稱已重跑本次所有畫猜流程。前兩P2與main衝突已獨立複查通過；第三項 source、雙平台與 fresh 原生證據已完成，修正已推送並再次送審，等待 reviewer 複查。

### 正式v1.11.1發布與資料保全

2026-10-07T11:22:46.109Z零房間guard後已切至 **v1.11.1**，PID141961，本地／公開版本一致，服務與tunnel active。線上SQLite備份＋另時點files不是atomic cold snapshot；schema16→16副本migration與隔離boot均保22表allrows／BLOB、8帳戶allfields、env與資料路徑。

| 正式驗收 | 結果 |
| --- | --- |
| 發行pin | df983da／本地v1.11.1 tag與受測input／tar一致，保留既有UI／WebGL，無pending patterns。 |
| 公開媒體 | 23資源exact frozen；3自有會員promote／demote／seek／skip ACL通過，市場mine200／admin403。 |
| 公開畫猜 | 22資源exact frozen；SSE points／times、dedupe／quota、undo／clear額度不退與nonartist拒絕通過。 |
| 最後資料 | schema16／22表，**21個non-session表**allrows／BLOB未變、8帳戶全fields保留，integrity ok／FK0；sessions201→208為guard1＋smoke6，已登出。 |
| 正式QA收尾 | 兩自有房已刪、session登出，QA history保留，profiles／artwork未寫；本機 native fixture 已正常停止，owned tabs 已關閉，FocusEmulation／viewport／受控 hidden getter 已清除，3480–3493 無測試 listener。 |

未發布patterns v1.12.0仍暫停。純文件不移動程式tag、不推正式分支，不含私人偏好、帳密、房號、私有backup路徑或rawHAR。下方v1.11.0是前次歷史，不是目前正式狀態。

以下為前次修正與正式發布紀錄。

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
