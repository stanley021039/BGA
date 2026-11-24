# 共用戰鬥命中反饋（#420）

2026-11-24，使用者選擇「爽快清楚、輕微震動」。候選3.35.0，基準main 8b7b078196f6f9a5fa0ca64728ac590bfe1e6cd5。

## 已確認方向與實作

沿大廳／訓練場／競技場共用LobbyAttackLayer，以伺服器已結算的hit紀錄觸發；pending、miss、零傷害與過期事件不當成命中。格擋使用獨立藍色衝擊圈與短音。保留傷害、回能、命中判定與移動；只處理前端表現。

普通命中：短受擊回彈與54px衝擊圈、至多0.6px輕震；暴擊：較大66px衝擊圈與1.2px輕震；R大招：78px衝擊圈、較明顯的190ms回彈及至多2px輕震。回彈前段保持極短受擊姿態後回正，不暫停伺服器時鐘、輸入、位移或整體畫面。

震動只作用於角色層及攻擊層，背景、HUD、操作與鏡頭跟隨transform維持原本機制。音效重用既有slam／explosion／glint壓縮音源，走GameSounds與AudioSettings獨立開關、音量及全站聲道預算，沒有新增素材或提高容量。只有本人施放或本人被命中的反饋觸發音效與輕震；其他可見角色保留局部命中圈。

同一hit以attack id、目標、phase或reflectionIndex去重；每位角色110ms內合併反應，每批優先大招／暴擊。音效至少間隔250ms，輕震至少間隔220ms。同時至多6個角色反應、6個局部衝擊圈及2個震動層；不新增rAF或輪詢timer。去重最多512筆，溢出時前移時間水位，過載捨棄舊事件而不重播。

第一次快照、重連、切換房間或場景只建立基準；750ms以前的已結算命中不補播。隱藏、pagehide、斷線及卸載停止聲音與視覺；關閉動畫或系統reduce立即停止視覺，聲音依獨立偏好。恢復動態不重播已消耗事件。所有動畫到期或取消均回到原位、原比例並釋放DOM與訂閱。

750ms視窗涵蓋既有串流400ms合併間隔與250ms掃描，不改伺服器排程。可見場景有其他角色時預先準備三段既有音源；靜音、零音量、hidden與省流量／慢連線跳過預載，沿共用URL去重。180ms內未開始的命中聲放棄，避免之後補出脫節聲音。房間專注遊戲或inert狀態停用背景戰鬥反饋。

## 設計參考

使用者提供的截圖指向[awesome-gamedev-agent-skills game-feel](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-feel/SKILL.md)。本輪參考事件集中、分級反饋、短促回彈、受控震動與恢復原位的原則；本站為Vue／DOM／Canvas權威快照架構，使用專案原生實作，不引入引擎時間縮放。

## 驗收與限制

新增回歸涵蓋權威結算／pending轉settled、首次與重複快照、miss／zero／blocked／cancelled、群體及多段合併、本地音效、背景不晃、動畫回正、reduce／hidden／pagehide／disconnect／destroy與過載上限。前端382項全部通過；型別／正式建置、UI檢查（明確base為本文件首列SHA）、素材及build預算、release一致性與diff空白檢查通過。

正式編譯產物在Edge實際驗證1920×1080與390×844、深淺色、靜音、系統reduce與Save-Data偏好共7組，無pageerror。第一次攻擊前確認快連線有三段預載，靜音／省流量沒有預載；Q命中與R十六刀能觸發反應，途中reduce立即取消，招式結束後恢復不重播。另1組本人被機器人擊中時按方向鍵，伺服器位置仍改變。截圖只暫停局部衝擊圈以擷取170ms短效果，未暫停遊戲、角色反應或震動。

桌機及手機各稽核大廳／訓練場／競技場三頁，兩次皆0圖片問題。本輪沒有新圖片或音檔；81支音效合計2,227,796 bytes，預算未變。既有三段音源冷／暖載皆回傳audio/mpeg、ETag及private,no-cache，條件請求回304；原生Audio確認實際開始播放。證據在本機ignored `work/hit-feedback-420/` 的browser-results、incoming-results、cache-results、image-desktop及image-phone。

第一次前端測試因既有元件fixture缺少新service mock失敗，補mock後完整382項通過。瀏覽器fixture曾因同帳號稽核與攻擊並行而無目標，序列驗證通過。第一輪完整後端測試遭執行環境更新中斷，不列通過；本輪補跑完整298個測試檔已完成：2,518項，2,517通過、0失敗、1項因缺少FFmpeg略過，exit 0，745秒。另外實際pagehide離頁取消活動中的命中圈及角色／圖層動畫，lifetime-results皆0。無頭Edge切換分頁／視窗最小化未產生真實hidden，因此hidden只以自動化回歸驗證，不列為原生瀏覽器通過。手機實機、喇叭主觀聽感與GPU FPS未驗；Save-Data為瀏覽器偏好模擬，不宣稱量測真實3G。

未PR／CI／合併／部署。

2026-11-24接續#421／#422時補驗Boss：Boss使用每位受害者累計傷害而非逐段時間，原先以施放時間判斷可能漏掉蓄力後命中。前端改以活動串流的新增加總量觸發，沿連線重置、基準不重播、演出效期及512筆記錄上限。新增回歸並以最後387項前端測試／型別／正式建置覆蓋；漩渦獸在桌機與手機的雙向命中及Boss回彈實測通過，證據work/random-421/boss-results.json。其餘Boss同樣走此共用格式，但未逐隻實玩。最新綜合驗證見[續作規格](RANDOM-LOADOUT-BRAWL-421-422.md)。
