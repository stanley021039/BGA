# 統一房間媒體與房間角色進度

2026-10-07最新PR1.9.3／a2c5589：有界play／pause Promise fence等契約雙平台各1,300／126focused／peer與freshPause／最後Play／normal已驗。Debugger載SHA／無input原型API是受控測試；proxy Pause總media4→4（GET3→3／POST1→1），最後Play／normal總media5→5（GET4→4／POST1→1），fresh ownresume约3.6ms後correctPause，非零transient／physical UA。heldgate／full ResourceTiming buffer已更正、own QA已清，詳 [最新scope](PR46-REVIEW-FIX-PROGRESS.md)。PR本地尚待push／Ready，正式1.11.1不變，patterns暫停。

2026-10-07 PR46第三P2已驗／正式 **v1.11.1**：晚queue-only GET不覆蓋較新native Pause，pending visibility播放只恢復自己的合法中斷，manual／mute／sharedpaused／videoexit保持、不加poll／seek。PR1.9.2／cf64bfc雙平台各1,278，正式df983da雙平台各1,299，actual AudioSettings focused104；最終真controls requests8→8與HAVE_NOTHING受控promise／VM METADATA1範圍分開，見 [最新進度](PR46-REVIEW-FIX-PROGRESS.md)。PR已推送、標 Ready 並再次請 Stanley 審查，未合併，patterns仍暫停未發布；下方九項與1,034等數字為歷史。

日期：2026-10-07。本批正式 **v1.8.0**，受測來源／不可覆寫本地 tag 為 `56875616c9367a25dd369c175c2b949f7861de9c`，取代 v1.7.2；台北時間 **10:24:21**（`2026-10-07T02:24:21Z`）已完成正式發布與公開 API 驗收。Windows／Linux完整各1034項通過；真正背景Chrome三席的播放及UI證據來自隔離fixture，公開站另外驗權限／資源／資料保存，兩者分開記錄。沒有新PR或push，不修改原PR43；後續文件提交不移動受測tag。規格見 [共用媒體契約](specs/UNIFIED-ROOM-MEDIA.md)，外部播放政策的研究與未驗範圍見 [政策查核](research/ROOM-MEDIA-AUTOPLAY-POLICY.md)。

## 九項需求對照

| # | 需求 | 已完成程式行為 | 驗證與狀態 |
| --- | --- | --- | --- |
| 1 | 音樂與影片只能同時播一個 | 每房只有一個 current；切換類型先停止 Audio 或卸載 YouTube，player epoch 防止舊 play Promise／ready callback 回播。舊 API 接管後只能讀同一 current。 | Node／VM與隔離Chrome通過：音樂雙席實播、影片時Audio0、manager切音樂B後Audio readyState4／paused=false／iframe0。公开站另驗單一current的API。 |
| 2 | 同一播放清單列名稱、點播人與類型 | MusicStore 提供歌曲可信名稱／時長；YouTube 可填名稱或有界 metadata fallback；混排待播列显示名稱、點播人及歌曲／影片。 | 回歸與Chrome混排／另一席同序通過；影片本次自填title，真正oEmbed成功、極長名稱視覺尚未驗，不以mock名稱當外部成功。 |
| 3 | 播放清單可拖曳排序 | host／manager 可拖、鍵盤上下及按鈕移動；一次送完整待播集合，current 不加入待播排序。dragstart 凍結版本與集合，途中清單改變提示重拖，不將舊意圖套在新清單。 | Chrome native dragstart＋dragover＋drop成功，B上移後另一席同序；鍵盤排序通過。stale drag／完整集合／返焦及ACL另有真模組VM回歸。 |
| 4 | 點媒體直接顯示一個完整視窗與音樂進度 | 一次開啟可拖移／縮放的非 modal 浮窗，current、進度、操作、歌庫、URL及queue直接可見；位置／尺寸只存个人 `bga.media.window.v1`／`bga.media.size.v1`。 | 最後source Chrome1280×720時window900×620在viewport內；390×844自然直列、區間12px、無水平溢出。host鍵盤尺寸920×620，guest維持900×620；本批未真測200%字級。 |
| 5 | 入房詢問接受影片或暫不觀看 | 每個 room instance／seat 詢問一次；拒絕不建 iframe／載 Google API，之後可重新接受。保留 autoplay blocked 提示、原生控制與本機播放入口。 | Chrome拒絕guest iframe／Google script均0，之後接受可加入；host关自己不停止global。idle後新片不自開與blocked恢復另有VM；本批未真觸發Google autoplay拒絕。 |
| 6 | 房主／管理者可切下一筆 | skip 改 current／session；可信歌曲可由既有請求按時長惰性推進。前端 ended 只在有權且共享 playing／有效時長接近結束時送，不以本機提前拖到終點切全桌。 | Chrome manager影片→musicB切歌及實播通過；公開API驗manager seek12且paused／skip。paused／提前ended／未知／超限時長及去重由Node／VM回歸，未等完整22分影片自然結束。 |
| 7 | host／manager／member 房間權限 | host 在管理升降其他真人；manager 可控媒體、踢一般真人，不能升人或踢 host／同級／自己／bot。角色只在當前 room 記憶體，leave／kick清除，有效 seat 的短暫重連保留。 | 三席Chrome普通點播與manager升／撤時即時按鈕ACL通過；公開普通transport403、升級後seek／skip、降級後403，網站帳戶role未變。kick／prune／重連由helper／HTTP／VM回歸，未冒稱真人踢人實玩。 |
| 8 | 管理按鈕和其他工具同色 | 管理／離房及共用媒體工具沿用中性 surface／text／border tokens，管理不是高亮主操作；manager 也有管理入口。 | Chrome管理升／撤與桌機／手機共用工具已檢；五款入口沿同tokens。hidden／pending及角色動作互斥由VM回歸，不宣稱所有對局phase逐一真人檢完。 |
| 9 | 表情集中在同一 emoji 彈幕入口 | 同 popover 先一般 emoji，分隔線後有名稱與 hover 的角色表情；保留原 social kind 與有聲表情，不另占角色工具。 | Chrome一般emoji及開心角色event送出通過；五款各有shared media／emoji、沒有舊media scripts或獨立角色button。原social／音效契約回歸保留，本批未真人喇叭聽感驗收。 |

## 共用實作

| 區域 | 程式 | 核心契約 |
| --- | --- | --- |
| 權威媒體 | `src/media/room.js` | 單一 current＋混合 queue＋server anchor；UUID instance／session、revision及request fingerprint。待播50、每人含current10、request cache256／TTL10分鐘；registry綁room物件，六碼重用不繼承。 |
| 影片名稱 | `src/media/youtube-title.js` | 固定 YouTube oEmbed URL、11字ID、拒redirect；32 KiB／2秒、cache256／pending32；失敗或外部副作用停用fallback，自填名稱略過查詢。 |
| 角色 ACL | `src/rooms/permissions.js` | 六個共用helpers、non-enumerable `room.managerIds` Set，不寫 users 角色。有效active seat／bot／kicked防護；host即時由room.host判定。 |
| 共用路由 | `src/app.js` | room-media／room-role、canonical membership及snapshot permissions／player.roomRole／media marker；metadata await 後重新驗身份與原room，再act重驗revision；legacy gate／delete／leave／kick清理。 |
| 媒體前端 | `public/shared/table-media.js`／`.css` | 一個 window、混合 queue、個人接受／退出、原生 fallback／Player生命週期、拖移／縮放、stale drag與有界GET重試；既有update帶marker，沒有每秒進度POST或獨立網路poll。 |
| 管理前端 | `public/shared/room-host.js`／`.css` | 同一管理modal、角色標示、升降與kick；pending互斥、原生modal／返焦／44px、snapshot freshness與目前遊戲callback，舊room/seat/instance ACK不覆蓋新畫面。 |
| 遊戲接線 | 五款HTML、`public/shared/game-shell.js`／`.css` | 只mount/update TableMedia，斷線／離頁cleanup；同emoji popover合併兩類social入口，不修改角色表情所有權或效果音模組。 |

schema 仍為 15；曲庫metadata與原音檔仍沿用既有保存／移轉。current、queue、角色、影片接受選擇與window設定不納入跨站帳戶搬移或房間續局。房間manager不等於網站管理員；原有遊戲開始／玩法設定依host規則。管理與一般玩家都能點播，只有host／manager能控制或排序。

## 舊 API 與網路負擔

第一次讀取／操作 room-media 採納舊music／watch的單一current、paused／position與影片提案。接管後舊兩種POST均回 `409 MEDIA_API_REQUIRED`，GET只提供同一權威current的投影；接管前也拒一般席以舊transport替換／重播已有項目。新版五款不mount舊media模組或音樂SSE；舊客戶端相容路由保留，不表示舊頁面具有新版完整queue體驗。

客戶端從既有遊戲state的 `{roomInstanceId,revision,hasCurrent}` marker取快照；明確操作才POST，localTimeline／大小／位置／音量沒有每秒上報。YouTube duration／ended為有權角色的有限通知，前端按current／session／revision去重，server再檢查ACL／item／revision。

獨立複核先重現一次GET503後同marker永久卡死，現已改為首取＋2次、失敗後至少1秒／4秒的update-driven重試；成功後穩態不GET，401／403／404等永久停重試（408／429可有界重試）。manual open／新marker重置預算，關窗取消該GET；晚到失敗不能覆蓋較新command ACK或新room預算。沒有為重試新增網路timer。

## 當前驗證證據

| 驗證 | 結果／限制 |
| --- | --- |
| 房間ACL／管理UI及原遊戲回歸 | 子任務Windows Node24.14.0 focused88/88、0fail／cancel／skip，165.5234ms；log `work/room-permissions-ui-focused.log`。涵蓋角色helper、真RoomHost及五款callback、kick／lifecycle、social freshness與race presentation；不是CSS或跨設備驗收。 |
| 最後前端獨立複核 | `node --test tests/table-media.test.js tests/game-shell-media.test.js` 34/34、0fail／cancel／skip／todo，478.6373ms。實際模組VM覆蓋GET重試／永久錯誤／晚ACK、paused／提早ended／未知或超限時長、frozen drag／keyboard、個人關閉／consent、播放類型互斥及單一GameShell入口。 |
| 本批 Windows 完整 | Node24.14.0，**1034/1034**，32080.9156ms；fail／cancel／skip／todo0。證據 `work/unified-media-windows-tests.log`。 |
| 本批 Linux 完整 | Node22.22.1，乾淨受測source **1034/1034**，155673.254745ms；fail／cancel／skip／todo0。證據 `work/unified-media-linux-tests.log`及`unified-media-linux.json`。 |
| 真正 Chrome | 隔離三席已驗真Audio／YouTube、排序、角色升降、影片接受與個人退出及五款接線；最後固定source另重驗390px手機／1280×720桌機。詳細如下；不以替身冒稱實播。 |
| 正式發布 | `v1.8.0`／`5687561`已切換，台北10:24:21公開版號no-store與6資源精確比對、三自有會員API及schema／資料保存通過；詳下方發布與清理證據。 |

較早focused與Chrome迭代只對當時working tree成立；正式來源以最後受測commit／tag及完整雙平台結果為準，後續文件提交不改tag。

## 真正背景 Chrome 的實際證據

隔離fixture使用三個合成有效座位，不改正式玩家profile。Chrome配合產品調整反覆迭代；最後兩個CSS修正已在固定source重新驗收：range原生margin引起2px水平溢出，修正後primary clientWidth／scrollWidth都451；窄窗改一個body自然流與scroll，保留所有controls，390×844兩區間12px且無水平溢出，沒有以hidden overflow遮掉問題。最後桌機1280×720，window900×620四邊在viewport內。

| 操作 | 實際結果及限制 |
| --- | --- |
| 歌曲實播 | 原創合成靜音MP3長260.625秒，host／guest Audio readyState4，一次currentTime19.950748／19.991229。這是一次本機觀察，不承諾逐幀同步，也不是喇叭聽感。 |
| 排序 | Chrome native dragstart／dragover／drop成功，B移到前方後另一席同序；另驗鍵盤改序。stale drag與完整集合校驗由真模組VM回歸。 |
| YouTube實播 | 官方原生播放器時間由6.299前進至8.213秒、顯示總長22分24秒；host iframe450.8125×210，Audio0。影片本次自填title，不以此證明server oEmbed成功。 |
| 個人選擇 | 初始拒絕的guest iframe與Google API script均0；host關自己的影片後global current／播放不停止，guest之後接受可加入觀看。未真的觸發Google autoplay拒絕，blocked處理仍以VM證據限定。 |
| 權限與互斥 | 普通peer點播成功；host提升／撤manager後按鈕ACL立即更新。manager切影片→musicB，Audio readyState4、paused=false、iframe0。 |
| 五款接線與表情 | 撲克、雷霆、同頻、送禮、畫猜各有shared media／emoji，無舊media scripts或角色button；一般emoji與開心角色event送出。沒有宣稱全部遊戲phase或各種自訂有聲表情都真人試過。 |
| 個人尺寸及流量 | host鍵盤大小920×620，guest保持900×620；local位置／尺寸不改全桌。30秒觀察media POST0，包含其餘四個遊戲頁導航的8個GET，不能宣稱本次idle零GET。 |

私人Chrome去敏receipt `work/unified-media-chrome-receipt.json`、視覺證據 `unified-media-flat-final.png`及`unified-media-mobile-final.png`；公開HTTP驗收另存 `unified-media-public-smoke.json`。本批未真正測200%字級、多設備／弱網、喇叭聽感、Google autoplay被擋或外部oEmbed成功。fixture proxy反覆導航後有draw重連提示；其舊upstream SSE未跟隨取消的轉接限制可能影響，沒有據此診斷正式站bug，也不宣稱Chrome全程draw SSE無問題。尺寸契約與回歸不能替代未做的真人情境。

測試preview已停止，三個自有Chrome分頁已關閉，臨時viewport還原1794×1109；沒有將前景視窗提到最上層。這些清理只作用在自己的隔離fixture，正式服務保持運行。

## 正式發布、資料與清理

受測commit及不可覆寫本地annotated tag `v1.8.0`均為 `56875616c9367a25dd369c175c2b949f7861de9c`；archive SHA-256 `71dd5440d37e1aa616a4664dcdd51ffa5f6b7fb5fbac46d632872ad27fb27a79`，私人設定、work與env未封存。沒有新PR或push，不將此批混入PR43。後續純文件提交不重新打tag。

部署前SQLite線上一致性備份、持久files及env分開取得，時間不同，非原子冷快照；備份留在核准私有位置。隔離副本preflight在外部副作用停用下啟動，21表所有rows與完整帳戶欄位不變。前兩次prepare因私有helper輸出缺少SHA／tests欄位而被驗證器拒絕；receipt原有值，修正ignored helper輸出後再prepare成功，兩次備份保留，拒絕期間正式仍舊版，沒有越過guard啟用未核對候選。

`2026-10-07T02:24:07Z`觀察rooms0，30秒內啟用；正式於`02:24:21Z`驗收為`releases/5687561`、PID107492，service／tunnel active。公開v1.8.0 API no-store，6份資源bytes與受測source精確相同；環境與原active data paths不變，外站匯入generation沒有啟用。

公開站另以三個既有自有測試會員作API驗收：普通enqueue成功、普通transport403；升manager後seek12且paused、skip成功，降級後立即403，網站users角色不變。自有等待房刪除、所有QA登入均登出、profile沒有寫入，等待房QA歷史保留。不把API三席當成公開站三席實際YouTube播放。

最終schema15／21表schema、20張非session表所有rows及BLOB與備份精確一致，8個帳戶全欄位保留；integrity ok、foreign-key錯誤0。sessions157→161為正常QA登入新增且已登出，不宣稱session rows／bytes未變。證據 `work/unified-media-postcheck-result.json`及`unified-media-final-data-check-result.json`；snapshot與helper細節不公開帳密、cookie或原房號。

YouTube接受不保證可聽autoplay或每部影片可嵌入；影片與歌曲直接由各client載入，同一server anchor不承諾逐幀零延遲同步。既有個人效果音設定保留，沒有為全桌媒體同步新增進度心跳、影片代理或持久化房間續局。
