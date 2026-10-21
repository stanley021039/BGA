# 遊戲音檔準備與接線（2026-10-19）

2026-10-21最新：前奏統一改8秒，取代下方歷史6.5秒設定；答題與精華仍30秒。預設音檔目錄改為`local-audio/eight-second`。本機1420首前奏已重新裁切並逐檔解析MP3影格長度（8.046–8.072秒，含編碼延遲），未逐首聽審。舊素材保留，音檔不納入Git。

本機2.18.0同批候選，未PR／部署。使用者確認由現有YouTube來源批次取得音訊；完整來源留本機，網站使用6.5秒前奏與30秒精華MP3，不將音檔或ZIP上傳GitHub。

## 實作

- `src/music/game-audio.js`讀取外部`manifest.json`，只使用已備妥、起點與目前題目相符的片段。共用影片的不同樂章依各自起點識別。
- 音檔端點`/api/game-song-audio`沿用登入、入座與踢人驗證，只服務當前回合／題目；不接受任意檔名。不公開完整音源或本機路徑，拒絕舊題目、錯誤stage、非本模式、錯誤選項與非法Range。支援GET、HEAD、單段及suffix Range。
- 猜歌挑戰取得音檔後使用原生audio，前奏與精華換段會停用／清理舊播放器及音量訂閱，忽略舊回呼；音樂靜音時不自動啟播。缺少對應音檔時暫時沿用既有YouTube分支。
- 猜歌二選一的音檔試聽仍由個人點擊，兩首各自開啟；關閉、換題與離頁停止播放，個人音量與既有設定共用。
- `GAME_AUDIO_DIR`可設獨立存放位置。一般server設定預設專案local-audio；直接createApp的呼叫端若未指定則使用其DB旁game-audio，避免測試意外讀取本機私人曲庫。

## 素材流程

- ignored `local-audio/prepare-library.cjs`是本批本機工作程式，保存每首成功／失敗／處理狀態，可重新執行續傳。工具與素材均未納入Git。
- 已完成的整首MP3保留；後續保留原始WebM/Opus等完整音源，只編碼遊戲片段為128kbps／44.1kHz MP3，移除歌名與藝人metadata。
- 同一來源的多個樂章共用來源下載與互斥處理，片段按曲目ID分檔。原始《四季》併行碰撞已在續傳流程修正，四個樂章已分別重建。
- 個別登入／年齡／無法取得／403來源只列失敗，不讀取使用者Cookie、不繞過限制。失敗數與打包範圍以最終manifest及本機報告為準，不能把處理中或失敗寫成完成。
- `clipReviewed=false`保持原義：預設60秒不保證是副歌；批次輸出不等於逐首聽審。輸出包不能宣稱所有精華均已校準。

## 驗證

- 本批test:affected回退255檔完整測試：2454/2454通過，347.85秒。完整測試期間／之後補了多樂章識別與音檔生命週期，對最終來源再跑14/14通過（另含片段過短防護）；詳work/audio-affected-20261019.log、work/audio-final-focused.log。
- 真HTTP測試涵蓋未登入、未入座、過期輪次、錯誤階段、HEAD、完整請求、一般／suffix Range、416及模式隔離；使用合成位元組驗證串流，沒有將其當成音訊解碼證據。
- 隔離Edge headless另使用實際下載音檔：前奏duration=8／currentTime>0.3、精華duration=30／currentTime>0.3、二選一試聽duration=30／currentTime>0.3、readyState=4、零YouTube iframe；個人音量0.2與390px無橫向溢出通過。零pageerror。
- 證據：ignored work/qa/audio-20261019/result.json，以及intro-desktop.png、highlight-mobile.png、two-choice-audio.png。未驗證實體喇叭／耳機聽感、所有1183曲目播放或正式站。

## 手動上傳

素材包使用根目錄`manifest.json`與`clips/`。兩者一起上傳到`GAME_AUDIO_DIR`所指的伺服器資料夾；程式碼／GitHub只放讀取與播放功能。完整來源、下載工具與批次log留本機，不放網站公開目錄。

現有試玩服務未重啟；它們仍是啟動當時的後端。新的音檔端點須啟動新版服務才生效，不能僅重新整理舊服務即宣稱已切換。


## 5秒前奏更新

2026-10-19依使用者調整：前奏5秒、10選1作答仍30秒，精華30秒，插歌8秒。原8秒批次與3035試玩房保留，新素材另存ignored local-audio/five-second；預設GAME_AUDIO_DIR已指向此處。

5秒最終變更的HTTP／播放測試15/15、規則與設定31/31通過。實際Edge播放前奏duration=5，精華與二選一duration=30，currentTime均超過0.3秒、零iframe／pageerror；證據work/qa/audio-five-second-20261019/result.json。原2454項全套結果屬先前8秒版本，不冒稱此次全部重跑。

原續傳曾遇Windows檔案讀取期間rename EPERM，新增最長2秒的有界重試；素材與處理紀錄均留在ignored目錄。


## 5秒歷史素材結果

5秒批次1183首處理完成：1179成功、4失敗、無片段過短；2358個MP3共662882139 bytes。遊戲包audio-exports/game-audio-clips-20261019.zip的根目錄包含manifest.json、clips/及failures.csv，原始完整音源仍在local-audio，所有素材均被Git排除。

失敗為YOASOBI〈夜に駆ける〉（需要登入／年齡確認）、Simon & Garfunkel〈The Sound of Silence〉與ONE OK ROCK〈Wherever you are〉（來源不可用）、ONE OK ROCK〈Heartache〉（403）。未繞過登入或來源限制。缺少音檔時目前仍會使用既有YouTube分支，不能保證此4首可播放。

5秒新版測試站3036另行啟動，已登入playtest，房號4FDD38，12首音檔與2位AI；未重啟3033／3034／3035。試玩帳號僅隔離測試資料庫。


## 最新：6.5秒、卡片外觀與網頁上傳

使用者最新要求取代5秒：前奏6.5秒，10選1作答仍30秒、精華30秒、插歌8秒。GAME_AUDIO_DIR預設local-audio/six-half-second；舊試玩房與舊素材保留。新版3037測試服務另啟，已登入playtest，房號F060E9。

- 音樂卡外觀由每位玩家選擇內建彈幕框，本局所有自己的卡片共用此選擇；伺服器在房間snapshot提供musicCardFrame，其他玩家可看見。選擇跨回合保留，未新增帳號永久偏好。成就限定框必須已領取，伺服器驗權；只接受內建allowlist，不接受外部HTML。
- 卡片收藏區可展開各玩家的卡片，DJ年代時間軸亦套同款。沿用現有彈幕框藝術，沒有宣稱新增Stitch／Figma稿。
- 管理後台 /admin/game-audio 提供分類篩選、單曲兩段上傳及解壓後clips資料夾批次上傳；分類依既有題庫，不修改歌曲語言。沒有直接ZIP或完整歌曲轉檔；需要6.5秒前奏／30秒精華MP3，每段最多2MB、至少128kbps。批次可停止後續項目，成功片段保留。
- 上傳端點先驗登入／admin／同源，再以2MB上限讀取；按MPEG frames檢查完整性及實際秒數，拒絕損壞、錯長、低位元率、錯誤曲目／stage。伺服器按內建曲目ID決定檔名，拒絕目錄連結；不信任客戶檔名或傳來的時長。音檔外存，不進GitHub。兩段齊全後即用現有受當前題目限制的音檔串流。
- 個別上傳可覆蓋同曲同階段片段；沒有撤銷舊片段版本。需避免與外部批次腳本同時修改同一manifest。

四首重試結果：Heartache已成功取得並補入；夜に駆ける仍需要年齡登入，The Sound of Silence及Wherever you are來源仍不可用。最新1180/1183成功、3失敗、無短片段，2360個MP3共691555520 bytes。新包audio-exports/game-audio-clips-6p5-20261019-r2.zip為705504732 bytes，全部CRC與根目錄manifest層級已驗證。不可把精華起點當成逐首校正的副歌。

48項focused測試通過；新增真HTTP涵蓋上傳登入／admin／同源／2MB、MP3真時長、壞檔不改manifest、兩段成對、跨玩家卡框可見與未領成就拒絕。Edge真MP3實播duration6.5／30，無iframe或pageerror。新增1920桌機／390手機實際單曲、資料夾批次、分類、錯誤及jelly卡框；證據work/qa/audio-admin-card-20261019/result.json與work/qa/audio-6p5-20261019/result.json。無實機手機／全部歌曲聽審／正式部署結論。


## 最終工作區審查

需求核對：卡片使用既有彈幕框allowlist，所有玩家state與收藏區可見；管理後台入口可選既有題庫分類及歌曲，支援單曲和資料夾兩種上傳；最新6.5秒與四首重試納入新包，未發布／部署。沒有新增任意HTML卡框、完整歌曲上傳後自動剪輯或自訂新歌曲的音檔對應；這些不在本次已驗收功能。

程式檢查：先驗權再收binary body；async handler用await讓拒絕正確回傳HTTP，實際回歸覆蓋未登入與非admin。歌曲ID映射固定檔名，MPEG frame檢查完整性與秒數；前奏與精華成對後才ready，壞檔不改manifest。卡框只更新操作玩家，成就獎勵伺服器驗證；其他玩家讀取相同descriptor。無新增憑證、資料庫schema、依賴或Git媒體素材。

完整affected首輪256檔2457/2459，兩項為新頁面盤點（27→28）與新管理頁正式路由，已更新測試契約並複驗8/8；最終256檔2459/2459通過，313.40秒；fail／cancel／skip／todo皆0，詳work/audio-card-affected-final.log。首輪失敗不記為通過。

## 完整音檔與最新題庫（2026-10-19後續，取代上方未完成及舊數量）

管理員可按既有分類／歌曲上傳完整音檔（MP3、M4A、WAV、OGG、FLAC、WebM，100MiB內、30秒至30分鐘）。伺服器須安裝FFmpeg並設定FFMPEG_PATH（預設PATH中的ffmpeg）。能源與靜音分析建議6.5秒前奏及30秒精華；這不是副歌辨識。先產生私有草稿、試聽與調整起點，再明確套用；完整音源留外部目錄供重切。每管理員最多5份未發布草稿，重整可恢復自己的草稿；舊遊戲片段在套用前保持不變。一次僅處理一個轉檔、取消會停止子程序，權限／同源檢查在讀取body前；沒有公開完整原曲端點。

兩批11連結去重後，現有1190首全部備妥、2380片段、失敗0；雨愛已收錄，Wherever you are替換來源。刪除其他兩個失效來源，夜に駆ける另收錄2020 THE HOME TAKE版本。大多數精華仍為未聽審切點，不能宣稱全部已校準。新包audio-exports/game-audio-clips-6p5-20261019-r3.zip為711561893 bytes，已核對曲目與CRC。完整音源不在遊戲ZIP，所有音檔及ZIP均ignored。

實際Edge＋FFmpeg驗收6種完整格式、6.5／30秒播放、調整2.3／75.2秒、發布前不啟用、重整恢復、1920／390無橫向溢出。上傳主功能完整affected258檔2468/2468通過（292.36秒）；之後個人判定音效另外複驗，不把舊全套當成新變更結果。

判定音效：猜歌挑戰依正式公開結果、只針對本人選答及DJ／已提交插歌行為，兩個結果間隔700ms。猜歌／情境二選一及一般同頻按個人gains播放，平票無正得分、未作答、隊伍／個人少數規則不套多數答錯語意。首載、重複、背景恢復及超過5秒的失聯追趕不補播；沿用共用音效音量／關閉，減少動畫設定不影響聲音。失敗音效由tools/generate-result-sound.py原創合成。

猜歌二選一新增真Edge三席16強／15場驗收，30秒精華使用剛上傳並調整至75.2秒的片段；音量0.2、關閉與換題停止、秘密投票、2:1票數、多數積分15/15/0、冠軍及16項排行均通過，桌機1920與手機390沒有橫向溢出。證據work/qa/full-two-choice-20261019/result.json；這是隔離測試桌的受控抽籤，不代表每首歌都逐首聽審。

猜歌挑戰的大曲庫歷史快照原本超過512KiB結果列限制，實測全題庫開局遇429。沿用同頻compact historyState方式：曲序存ID、累計輪數，完整結果保留；每次操作仍各自記錄當時結果，執行中的完整曲序、結果及公開遊戲state不變。新增真HistoryStore全曲庫開局及結算回歸，未提高全域容量。

判定音效雙人真Edge：DJ歌名正確／排序失敗，另一席歌名錯誤／插歌成功，四個WAV均觀察到playing；700ms間隔、重複輪詢不重播、重新整理不補播通過。證據work/qa/result-sounds-20261019/result.json。此項音效驗收未宣稱全頁手機排版通過：縮至390時其中一席收藏區兩張卡仍可能撐到616px，另一席390px；屬既有收藏布局，未混入本次音效修正。

最終音效／曲庫開局修正驗證：259檔完整affected 2473/2473通過，252.26秒，fail／cancel／skip／todo皆0；log為work/result-sounds-affected-final2.log。先前一次2472/2473失敗為歷史結果只保留一輪，已修正為保留完整results並重新全套通過，不將首輪記為成功。真HTTP已核對新腳本及兩種WAV為200及正確MIME；單元／真HistoryStore／原生Edge證據見上節。版號2.18.0與差異格式核對通過，未提交／PR／推送／部署。
