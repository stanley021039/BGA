# 內建彈幕框 Stage A 進度

最新正式：**v1.15.0／f4cbdfa**，2026-10-08已完成發布與有限公開驗收。下方候選／待驗為歷史，最後一節取代發布狀態；Stage B/C仍未完成。

2026-10-08（Asia/Taipei）。依 [CUSTOM-BARRAGE-FRAMES](specs/CUSTOM-BARRAGE-FRAMES.md) Stage A 實作；基線 v1.14.2／8ae5c4f，候選 **v1.15.0**。本段為發布前紀錄，正式結果另補。

| 範圍 | 完成内容 | 驗收／邊界 |
| --- | --- | --- |
| 共用入口 | 五款遊戲文字輸入列新增 registry `frame` 圖示按鈕；原生選框 dialog，default／paper／comic／pixel 四選一。 | 中文可讀名稱、hover／focus 提示、Escape 返焦；重要玩家資訊與角色表情保留。 |
| 內建裝飾 | 三套本站原創 CSS 邊框；16px 正文，同 12／16px padding，邊飾全部 inset。 | 不取遠端素材、不新增外部字型或無限動態；文字及 sender 為 text nodes。 |
| 伺服器 | exact primitive ID 白名單、版本 1 immutable descriptor 固定到確認訊息；舊 client 缺欄位 default。 | 既有房員授權、40字、1.5秒限流不變；不接受 URL／CSS／物件框、emoji 不帶框 descriptor。 |
| 個人設定 | 20個 header 入口共用本機設定，跨分頁同步；「顯示彈幕框」只切收到文字的裝飾與色彩。 | 獨立於 MotionPolicy，關框不清掉文字、emoji 或已送出訊息；picker 預覽保留款式。改選僅影響後續送出。 |
| 避疊／清理 | 首次建立量測文字完整高度，固定 8px 垂直間隔；不足空間直接略過、不排隊，最多4則。 | 保原8秒 translate／減動5秒静態；resize清舊氣泡、pagehide清理，renderer false／同步finish／例外釋放lane不留timer。 |
| 尚未實作 | Stage B PNG上傳、收藏、分享、private grants／schema／移轉；Stage C 完整壞圖／弱網品質。 | 本批無DB變更，不把三套內建框宣稱完整客製上傳。成就／永久戰績等見 [backlog](SPEC-BACKLOG.md)。 |

初步證據：server catalog4、client5、MotionPolicy12、真HTTP4 focused全通過。HTTP包括五遊戲×四框、非法輸入、會員權限、舊client／後續改框不改前一event、emoji／角色表情不帶框、JS／CSS exact bytes／MIME／no-store。

背景 Chrome 隔離三帳戶：真HTTP送出紙張長文74px、漫畫／像素短文50px；top12／94／152，8px gap。個人關框後三則相同 node／top／height，decor none／default backdrop block。真動畫 probe 一秒內 transform 0→約−70px，背景初期 sample300ms未advance，不能稱60fps或判斷另一台硬體。1280×720四preview同50px、Escape返回trigger；390×844單欄dialog555px、controls44×44、無横向溢出。五款等待畫面原生入口各四選項、640×335 dialog及44px按鈕、重要玩家區仍存在；此證據不代表每一玩法phase均已人工驗。

協作：components_design查核舊spec後補拒絕renderer回歸；visual_webgl_spec提供server catalog／HTTP測試；pr46_canvas_fix提供統一幾何CSS；主agent整合API／picker／設定／實際高度與原生驗收。新設定不進MotionPolicy，因其偏好通知會清理lane；收框偏好與是否收文字必須分開。

## 發布前驗收

Windows Node24.14.0完整 **1,432／1,432，37,815.3583ms**，fail／cancel／skip／todo均0；release:check相對v1.14.2 minor通過。Linux／固定source與正式發布仍待下節實證。

隔離原生壓力fixture（不冒稱server接納的訊息）：16字名字＋40 Unicode字（含🎉）五則輸入，只建四則；四款均74px，top12／94／176／258，無文字溢出。OS減動模擬四則均static／animation none；viewport變更並觀察layout後舊氣泡0。真正背景draw三席第1輪持筆18次移動：墨跡樣本0→529→1037→1523，ACK後1517、觀看者1517；本輪自然結束進第2輪重設0，角色換畫者、倒數可見。只限取樣軌跡，不推定所有途中影格無閃白、全多輪／FPS或別台硬體。renderer／codec／傳輸本批未修改。

Linux首次同source測試1,431／1,432、220,394.573269ms：既有market-images quota fixture第195行寫65×4MiB SQLite時disk I/O error。當時/tmp為1.7GiB tmpfs、已用1.1GiB／剩572MiB；正式data filesystem另有163GiB。失敗原log另存保留，同f4cbdfa／canonical archive改用私人root-filesystem TMPDIR重跑完整套件，不降低測試、不修改產品或覆寫tag；重跑結果待補。這是環境限制的推測，未以首次failure單獨斷言因果。

## 最終發布與清理

- 受測固定source／本地immutable tag v1.15.0：`f4cbdfae4ad6f6c60f78311d38aff79b8c3b54dc`；canonical archive SHA256 `c56e6581ab1b079e08b848d83056185a27236b9b849dbd98f8e9dfaf50019677`。排除work／.local／私有env；後續純驗收文件不移動tag。
- Windows Node24.14.0 **1,432／1,432／37,815.3583ms**；同source Linux Node22.22.1完整root-filesystem TMPDIR重跑 **1,432／1,432／256,432.664183ms**，各fail/cancel/skip/todo0。首輪disk I/O failure完整保留；同測試後通過支持暫存環境因素，但未量測瞬間/tmp占用，不宣稱已證實唯一原因。
- 正式UTC **2026-10-07T16:48:40.676Z** fresh zero-room guard=0後切換；current `releases/f4cbdfa`，PID160751→166218，afterhours／tunnel active，正式API／原生設定版本v1.15.0。
- 備份 `/home/ccc/apps/afterhours/shared/backups/pre-barrage-frames-f4cbdfa-20261007T164817Z-164e3be8-3986-4a8e-8de8-b951b1f3c4fe`；SQLite在線備份、另時點files/env archive，**不是atomic cold snapshot**。隔離啟動與22既有表保留預演通過；未啟用外站資料代。
- 公開HTTPS：19會員可讀HTML＋6shared資源，共 **25份exact bytes／MIME／no-store**；管理頁因正常member403未列公開HTML，20入口載入契約另有source回歸。五款各3既有測試會員、每房三種框server確認、avatars保留；不是五款完整遊玩／全phase。
- 正式background Chrome使用受限私有auth proxy，內容／API來自shhuang.cc而非fixture；原生三席畫猜picker640×335、四choice、pixel真傳送形成live bubble。共用設定顯示v1.15.0及個人框開關；390×844 settings在x8/y110、320×726，底836、無横向overflow。截图在私有work，本批沒有全讀屏／200%zoom／跨設備／FPS結論。
- own五房state均404後三帳戶logout＋auth/me401；zero-room guard登入也已logout。正式schema16／22schemas，**21非session表rows及BLOB、9帳戶全部欄位、13市場圖片**與新鮮備份相同，integrity ok／FK0；sessions **238→242**為這4次驗證登入，不能說sessions不變。臨時prefs／viewport／own Chrome tabs／兩proxy均清理；隔離preview stdin未保持，驗證PID與command後僅停止該owned process，ports3500–3503已無listener。

本批無新PR／push。接續缺功能以 [SPEC-BACKLOG](SPEC-BACKLOG.md)為準：B01完成；B02成就metadata、B03正常unit／match帳號ledger、B04–B08徽章及永久戰績、B09框上傳收藏仍未做，不能把歷史動畫／共看／backup的pending重新當缺功能。
