# 版本管理實作與驗收

2026-10-07正式 **v1.8.0**：五款遊戲統一音樂／影片待播清單、共享播放錨點、拖曳排序、房間管理者及表情入口。固定來源／本地 annotated tag `56875616c9367a25dd369c175c2b949f7861de9c`；封包 SHA-256 `71dd5440d37e1aa616a4664dcdd51ffa5f6b7fb5fbac46d632872ad27fb27a79`。Windows Node24.14.0 **1034/1034**（32080.9156ms）、Linux Node22.22.1 **1034/1034**（155673.254745ms），失敗／取消／跳過均0。背景 Chrome 三席實測音樂→真正YouTube→音樂、普通房員點播、管理者升降／控制、原生拖曳與鍵盤排序、個人關閉／縮放、五款共用入口；桌機1280×720與手機390×844通過受影響版面檢查。不是多設備弱網、200%文字或喇叭聽感驗證。

正式 current `releases/5687561`，2026-10-07T02:24Z 切換前30秒內確認零房間，PID103459→107492，service／tunnel active。SQLite線上備份及另時點的持久檔案／環境檔備份後，隔離副本預演21張表與全部帳戶欄位一致；不宣稱原子冷備份。公開no-store版本與6份受影響資源精確內容／MIME通過。正式三個既有自有測試member帳號驗點播、transport 403、promote／pause／seek／skip／demote；只建立待機測試房並正常離房刪除，QA sessions已登出，待機驗收歷史保留。schema15、21張表schema、20張非session表的既有rows／BLOB及8帳戶全欄位保持一致，integrity ok／FK0；session157→161是登入驗收變動，不宣稱session逐列不變。首兩次prepare的回傳欄位缺SHA／tests，驗證拒絕且未切換；補齊私有helper欄位後重新預演通過，先前備份保留。詳細需求與限制見 [統一媒體驗收](UNIFIED-ROOM-MEDIA-PROGRESS.md)。本批未發新PR／push，PR43未改；後續純文件提交不移動v1.8.0 tag。

2026-10-06候選 **v1.4.0**／[PR #43](https://github.com/stanley021039/BGA/pull/43)：全部已完成派對功能與最新main整合，schema15統一兩種舊14布局。受測程式及本地tag `bdd77d1`；Windows／Linux各790/790，既有帳戶／音效／市場資料保留。後續只有README及验收文件，既有版本tag不動；正式仍v1.3.0，較早排版候選未單獨切換。詳 [整批驗收與送審狀態](PARTY-PR-INTEGRATION-PROGRESS.md)。

2026-10-06候選 **v1.3.2**：送禮主區由固定560px上限改為按實際導覽／玩家列高度分配視窗空間，包含前一筆16px間距。Chrome高視窗／720p／八席等待及選禮／手機通過，Windows／Linux各761/761，備份及16表副本預演通過；受測來源／本地tag `df7846d`。v1.3.1未單獨部署，tag保持不動；正式仍為v1.3.0，等待更新時機。詳 [高度驗收及發布狀態](GIFT-VIEWPORT-HEIGHT-PROGRESS.md)。

2026-10-06正式 **v1.3.0**：畫猜本人猜中／畫者輪次及雷霆骰聲／shot／slam／nitro／skid已接共用事件音效。Windows Node24.14.0 **761/761**（25286ms）、Linux Node22.22.1 **761/761**（130827ms），失敗／取消／跳過均0。受測程式 `4732450fe44d2640ecaf961cf2d8dee9d8bd5e95` 與本地 annotated tag `v1.3.0`，正式 current `releases/4732450`；零房間切換，PID50471→52510，service／tunnel active。schema14不變、integrity ok、外鍵錯誤0，原7帳戶全欄位保留；預演副本16張既有表逐列一致。匿名no-store版號、既有session、7份HTML、24份資源（含7WAV的精確bytes及MIME）一致，背景Chrome設定顯示「版本 v1.3.0」。7短音（2Kenney CC0改作＋5固定seed原創）、兩個新聲音模組、遊戲2／總4段上限及1秒載入timeout已驗；Chromeplaying／清理／靜音及所有限制見 [音效實證](GAME-SOUNDS-PROGRESS.md)。第二批遊戲候選仍為規格，沒有真人聽感／喇叭測試；無新PR／push，純驗收文件不移動tag。

2026-10-06正式 **v1.2.0**：角色表情可上傳、試聽及移除最多10秒音效，五款遊戲與大廳共用效果音設定。schema14新增SQLite sound BLOB，完整移轉及v1–13副本升級已驗。Windows Node24.14.0 **727/727**（24185ms）、Linux Node22.22.1 **727/727**（125824ms），失敗／取消／跳過均0。背景Chrome11秒拒／10秒轉檔保存／試聽停止／房間與大廳一次載入／靜音零音效GET通過。受測程式 `9b1fdd4148ea9e1ceec5215f8ca112ffd99cd893` 與本地 annotated tag `v1.2.0`；正式 current `releases/9b1fdd4`，零房間切換，PID 48811→50471，service／tunnel active。正式 schema14、integrity ok、外鍵錯誤0，原7帳戶全欄位完整保留；預演時15張既有表逐列一致，只新增空 `character_sounds` 第16表。匿名 no-store 版本API、既有session、7份HTML及14份資源比對通過，背景Chrome設定顯示「版本 v1.2.0」。無新PR／push；後續純驗收文件不移動tag。詳 [音效契約與驗收](CHARACTER-ASSET-TEMPLATE.md)。

2026-10-06正式 **v1.1.4**：共看GET短暫失聯由既有遊戲state有界重試、HTTP區網用安全亂數UUIDfallback，以及合併marker已追上時不多抓一次。PR #36來源`d4020ef`Windows／Linux各552項；正式整合各663項與真HTTP背景Chrome播放／503恢復通過。受測`93ba3501aaca22768c8605609637fbdf0df2d557`及本地annotated `v1.1.4`，current releases/93ba350；零房間切換、7帳戶全欄位保留、schema13、15表副本一致，公開版本／8資源／Chrome設定通過。原PR #36非force更新並Ready，正式分支與tag未push；純驗收文件不移動tag。詳 [共看驗收與備份](YOUTUBE-WATCH-PROGRESS.md)。

2026-10-06正式 **v1.1.3**：雷霆途中事件先呈現、再續移動的相容修正。Windows／Linux各625/625，背景Chrome火焰／玻璃／地雷／打滑／油漬與跳台順序通過。受測提交`22a9d6fd71ba0523a456321567fc71d6a856e171`及本地annotated tag `v1.1.3`；正式current `releases/22a9d6f`，零房間切換，service／tunnel active。7帳戶完整保留、schema13、15表副本逐列一致；公開版本API、race HTML、7資源及Chrome設定已驗1.1.3。備份與錄影詳 [事件與位移进度](RACE-MULTI-MOVE-PROGRESS.md)。無新PR／push，後續纯驗收文件不移動tag。

2026-10-06正式 **v1.1.2**：雷霆完整位移與抵達後下一步修正；Windows／Linux各591/591，背景Chrome碰撞／玻璃／地震／道路換片／終點驗收通過。受測程式a27dd1fec3b98f07365b3911a2a10f6c87304d67及本地annotated tag v1.1.2，正式current releases/a27dd1f。零房間切換、7帳戶全欄位保留、schema13／15表副本逐列一致；公開API、受影響資源及Chrome設定顯示1.1.2。備份與完整證據詳 [位移進度](RACE-MULTI-MOVE-PROGRESS.md)。無新PR／push；純驗收文件不移動tag。

2026-10-06後續正式 **v1.1.1**：相容修正雷霆多格逐格滑動及重繪接續，Windows／Linux各554/554、背景Chrome八格及一次POST驗收通過，詳 [移動進度](RACE-MULTI-MOVE-PROGRESS.md)。固定程式提交`2eb4104d3732325ac68d2981fadc09826b1c5f55`及本地annotated tag `v1.1.1`；正式站已切至`releases/2eb4104`，公开API及Chrome設定顯示1.1.1。7帳戶完整保留、schema13未變、15表副本逐列一致，服務及tunnel active。備份與完整驗收見同一移動文件；無新PR／push。

既有v1.1.0 tag保持原提交；1.1.0候選未單獨切換，直接由8fcda4d更新至1.1.1。相較正式基線的minor門檻與相較v1.1.0的patch門檻均通過。之前待處理的更新時機已由確認測試帳號／電腦玩家、正常離房及零房間切換解除；沒有中斷其他真人座位。下列v1.1.0紀錄保留作歷史，狀態以本節為準。

2026-10-06：候選 **v1.1.0**，從現有package基線1.0.0升minor。annotated tag `v1.1.0`指向受測程式提交 `238da0e22438ab3264107bf13115bc1c13906b5a`。正式站當前發布目錄仍為8fcda4d；尚未把候選當作上線。打版規則見 [規範](RELEASE-POLICY.md)，功能紀錄在根目錄CHANGELOG。

## 已完成

- `package.json.version`作單一來源；匿名只讀`GET /api/version`只回版號、no-store，不暴露其他資料。
- 共用右上角設定顯示版本，第一次開啟才請求，成功只讀一次，沒有新timer／poll；失敗下次展開可重試。
- `release:bump`支援minor／patch／major、摘要及日期，同步package／可選lock與CHANGELOG；不自行commit／tag／push。
- `release:check`檢查版本紀錄一致；搭配base及type可拒絕未升版／新功能只升patch。npm test前執行基本檢查。
- AGENTS新增必須打版的規則，規範涵蓋相容性、批次、不可覆寫tag、純文件及部署／DB版本分工。

## 驗收證據

Windows Node24.14.0全套 **548/548**，包含新增5項CLI／Git基準／HTTP回歸；失敗0、取消0、跳過0。證據在核准私有QA位置 `work/version-windows-tests.log`。

背景Chrome使用獨立localhost3197及合成帳號，不改正式帳戶／房间。正常1794×1010 viewport、不加覆寫；實際展開設定顯示「版本 v1.1.0」。面板320×617，底部703.5px；版本底部682.5px，在畫面內。重開設定的CDP被動觀察版號請求0，無截斷／待分頁事件。這不是FPS或所有手機尺寸的驗證。

模擬封鎖本機版號請求時顯示「版本暫時無法取得」，解除封鎖後重開設定恢復v1.1.0；阻擋已清除。沒有修改其他頁面或帳戶偏好。

Linux Node22.22.1完整 **548/548**，失敗／取消／跳過均0；發布包內無Git目錄，基本check及獨立Git基準fixture皆通過。副本schema13、15張既有表逐列一致、完整性ok、外鍵錯誤0；隔離3196啟動成功。證據 `work/version-linux-tests.log`。

已準備發布目錄 `releases/238da0e`；SHA-256為 `1c2f5b53d2e87e4c355565bcfcc5c9910b404416fa6e6ff0dc1e3897dce7a950`。切換前線上備份 `shared/backups/pre-party-238da0e-20261005T170101Z`（UTC），7帳戶、schema13，持久檔案另備份；SQLite與檔案不宣稱同一原子時間點。首次切換檢查发现一間兩人賽車局進行中，尚未重啟；正式API／畫面驗收等待切換完成。tag為本地，未push／未發新PR。後续純文件驗收更新不改已受測的版本標記。
