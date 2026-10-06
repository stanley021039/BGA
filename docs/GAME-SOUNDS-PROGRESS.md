# 首批遊戲音效實作與驗收

日期：2026-10-06。候選版 **v1.3.0**，接續正式 v1.2.0。範圍為 [音效計畫](specs/GAME-SOUND-PLAN.md)第一批，其他候選仍未實作。Windows完整已通過，背景Chrome與Linux／正式發布證據持續補齊。

| 遊戲／功能 | 本批行為 | 聲音長度 |
| --- | --- | --- |
| 畫猜輪次 | 新輪由本人選題時一次提示；首載、重連或回焦不補播。 | 320ms |
| 畫猜猜中 | 本人已確認的新correct才播一次，其他人猜中不公播；換canvasEpoch後重新計次。 | 220ms |
| 雷霆擲骰 | 每個check.id＋startedAt cycle一次，包含重擲／位移後首次呈現的deferred骰子；未揭曉前不用結果挑聲音。 | 650ms |
| 雷霆射擊／碰撞 | 按公開事件及已確認呈現checkpoint；同batch挑主因，取代該處舊reveal，避免雙播。 | 280／350ms |
| 雷霆氮氣 | 已確認command；在賽道上配合尾焰，車庫則等首次真正進場，不在等待選格時先響。 | 500ms |
| 雷霆打滑 | 油漬／skid的實際位移開始；相連同類滑格只一段，普通多格移動沒有逐格引擎聲。 | 480ms |

## 共用控制與事件時序

`GameSounds`有room／version／可見／失聯及5秒gap gate、256個seen上限、epoch隔離延後callback；動畫設定與音效分開。首载、靜音、零音量、hidden、重連等遇到的事件仍消耗，不會之後補播；離房與reset只停該controller的clip，不切斷其他角色音效。已確認聲音不推進遊戲規則。

`AudioSettings`保留右上共用音效開關／音量。固定遊戲cue含舊confirm/reveal最多同時2段，與自訂表情共4段；满額捨棄新聲，沒有截斷自訂表情或保留關鍵聲道。低優先動作cue有250ms間隔，不排隊。新cue載入1秒未開始就丟棄，實際開播後依長度停止，晚play promise不能重新播放或開timer。角色最長10秒契約不變。

雷霆onMove／onCue及dialog首次rolling是唯一owner；普通presence不重播，ACK若已有專屬owner略過confirm。中途關閉動畫不補之前的journal；下一個新公開事件在減動／動畫關閉下仍可出聲。公開事件與私有聲音不增加音效poll或server混音；固定靜態白名單服務2個新JS及7個WAV。

## 素材與追溯

七個WAV合計 **134,708 bytes**，24kHz／mono／PCM16，精確320／220／650／280／350／500／480ms，首末sample為0、峰值不超過0.24，沒有削波。turn／correct改作自Kenney Interface Sounds 1.0的CC0具體檔；其他五段為固定seed的專案原創noise／tone。包來源、母檔、授權、改作、SHA與波形查核見 [採用紀錄](research/SOUND-ASSET-SOURCES.md)，逐檔manifest在`public/assets/game-sounds/manifest.json`。

`node scripts/build-game-sounds.cjs --check`可離線驗重建，文字hash以UTF-8 LF正規化，WAV按完整bytes。manifest的`auditionReviewed:false`表示未由真人評估耳機／喇叭聽感，不代表程式沒有媒體播放驗收。

## 驗收與限制

Windows Node24.14.0完整 **759/759**、失敗／取消／跳過0、25360ms；其中新增32項涵蓋共用控制、HTTP／素材及真draw／race render。初次整合發現3個舊multi-move抽取render fixture沒有新owner，已補fixture且保持既有路線驗收，再跑全套通過。私有完整log `work/game-sounds-windows-tests.log`。

雷霆focused126項涵蓋garage首次進場、shot→skid／途中checkpoint、deferred骰子與重擲、動畫關閉／減動、重連與reset；畫猜focused41項涵蓋本人／別人／ACK+state去重、同輪及跨輪、首載／hidden／失聯與減動。HTTP測試逐檔比對2JS／7WAV，陌生路徑與來源母檔不對外提供。

背景Chrome使用隔離localhost3211及8個合成帳戶，正常1794×1010viewport。以開局／猜題UI真操作確認turn／correct各一次WAV GET200、實際`playing`，之後clip paused且src清除。雷霆關動畫時4骰及nitro各一次播放；射擊透過真擲骰／確認UI，確認之前只有骰聲，之後shot才播放且沒有額外reveal。控制端以公開HTTP配合合成場景，不宣稱8台client真人同時試聽。

為避免打擾工作，僅隔離測試來源以CDP診斷暫設音量0.000001，包裝Audio觀察playing／清理，不改clip行為。這是媒體事件與網路證據，沒有把極低音量下的解碼當成耳機／喇叭聽感，配置ms亦非實測播放延遲或FPS。診斷及偏好在收尾恢復，分頁與QA程序結束後不保留到正式站。

待補：最終Chrome撞擊／打滑／靜音、Linux全套、備份預演與正式版本／資源檢查。本批未新PR／push，受測程式tag與純驗收文件分開保存。
