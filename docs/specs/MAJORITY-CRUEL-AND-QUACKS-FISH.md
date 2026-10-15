# 同頻俱樂部：殘酷2選1圖片題與郎中 fish 爆鍋聲

2026-10-14；候選2.6.0，base origin/main 88823b6（已合併PR122）。本輪新增工作在 feat/majority-cruel-two，本機實作，未建立新PR或部署。

## 規則與題庫

分類名稱為「殘酷2選1」，只有二選一雙圖題。普通同頻仍可從分類抽三張候選圖片題，沿用原先同頻計分；一般文字題、三選一與填空不變。新模式可在房間設定選取：

- 雙人隊：4／6／8人，房主開局前可更換任意搭檔，配對不重複；隊伍及十題固定開局名單。同隊兩人有效答案相同，該隊得1分；全桌A/B平票仍各隊獨立比對。成員顯示鏡像隊分，不是隊伍一次得到2分。最高隊並列共享勝出。
- 個人：1–12人，固定十題。多人時開局選「多數得分／少數得分」，唯一多數或唯一非空少數組每人1分；兩邊平票不加分，所有人選同一邊時不存在少數。真正1人只記錄偏好，沒有假對手／假分數／假勝者，十題後展示雙圖及本人選擇回顧。
- 每人整場一次換題，限尚未有人交卷且未逾時；被換掉的卡不重抽，題號不增加。換題後舊題ID的答案或同時換題會拒絕，不耗掉另一人的機會。已提交的答案只在本人端可见，揭曉後全桌公開。可在全員尚未交卷時收回答案。
- 十題自動抽牌，不使用普通預備題佇列。晚入座者只能觀看，下一局參與；開局參與者離席／踢出時中止，避免半隊仍領獎。離線不當作離席，既有120秒期限結束後缺答不計分。
- 保留測試AI、歷史來源快照、帳號座位、媒體及專注；AI同樣只能使用本人可見的作答題目。歷史附帶cruel rules／catalog原始碼，維持版本可追溯。

60張原創題／120張原創SVG插畫，日常、感情、成人觀念、道德、尷尬、黑色幽默各10張；成人觀念包括親密關係、成人作品、開放關係與性幻想溝通，插畫用非露骨情境與物件。使用者照片作主題／雙圖版型參考，沒有掃描或移植商業卡牌插畫；不整批複製網站題庫。配色A粉紅／B藍，題目及選項文字保留清楚可讀，圖片有替代文字。題型限制由分類資料及伺服器共同驗證；文字投稿不能冒充雙圖題。

## 研究來源

- [龐奇桌遊：殘酷二選一規則介紹](https://www.punchboardgame.com/en/blog/posts/%E6%AE%98%E9%85%B7%E4%BA%8C%E9%81%B8%E4%B8%80-%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87%E7%89%88-%E9%96%8B%E7%AE%B1%E5%8F%8A%E8%A6%8F%E5%89%87%E4%BB%8B%E7%B4%B9-%E9%AB%98%E9%9B%84%E9%BE%90%E5%A5%87%E6%A1%8C%E9%81%8A)：自由作答，可自訂多數／少數玩法。本輪雙人隊十題／每人一次換題，依使用者提供的第六張規則照片採用，沒有宣稱是這款卡牌唯一官方計分。
- [Spin Master：Would You Rather](https://www.spinmaster.com/en-us/brands/spin-master-family-games/spin-master-games-would-you-rather-funny-party-card-game-for-college-friendsgiving-birthdays-and-more-for-teens-and-adults-3-6-players-for-ages-14-and-up/)：圖像兩難及多題材的設計方向，未搬用其500題或150張插畫。
- [Linguaholic：Would You Rather題目](https://www.linguaholic.com/games/would-you-rather/)：日常、感情、荒謬、工作、金錢與道德等主題發想。本輪卡片獨立撰寫，不把公開可閱讀當作整套轉載授權。
- [Conversation Starters 可列印題卡](https://www.conversationstarters.com/Would-You-Rather-Question-Cards.pdf)：找到相似卡式題庫，僅列為延伸參考，未匯入圖片或全文。

## 介面與共用修正

殘酷模式使用朋友左、雙圖中、聊天室右；手機縱向堆疊，專注時隱藏朋友／聊天並保留選擇與鎖定／換題控制。等待室提供可見配對卡，設定沿用共用auto-save。共用RoomControls切換設定來源時只替換舊設定節點，保留原有操作區；solo最低人數1，雙人队只允许4／6／8。同頻控制區保留穩定節點及native start標記，避免切換設定後開始按鈕與預備題目被刪除。其他遊戲最低人數與原有源操作不變。

## fish 音效

使用者提供fish.mp3，解碼片段約567ms，聲音接在郎中原創840ms爆炸＋20ms間隔之後。原爆炸22050Hz先重採樣24000Hz，再與語音拼接，總約1428ms；避免不同取樣率直接拼接造成音高或速度改變。語音高通60Hz／低通6500Hz，峰值目標0.32，短淡入／40ms淡出。成品quacks-explosion-fish.wav為mono PCM16；quacks-manifest.json記錄來源hash、原爆炸hash及生成器。

郎中專用quacks-explosion cue使用此成品，其他遊戲的explosion cue仍使用原音檔。同桌觀察到新explosionId的人播放一次；同快照多人爆鍋合併，初載／重連／hidden不補播，靜音與共用容量維持。原fish.mp3留在使用者提供的位置，不另提交。

## 驗證

具體最終結果於交付前追加。證據僅來自隔離合成帳號，沒有重置／重啟使用者既有牌局。音效native playing不等於已用耳機／喇叭完成主觀聽感驗收，實機手機／Safari未驗。


Windows Node24完整2216/2216，fail/cancel/skip/todo0，226072ms，work/playtest/cruel-fish-final-full-tests.log。真無視窗Edge四位合成真人，房主改搭檔、native開始、雙圖載入、換題、舊題拒絕、未揭曉不暴露答案、十題隊賽與1人十題0分回顧通過；另驗一般同頻仍能抽出三張雙圖候選並native出題，原功能連線無錯誤。桌機三欄相對位置、夜間／390px與專注通過，0頁面錯誤。新共用設定來源替換與solo最低人數增加回歸；快照接收器測試補上既有renderAction依賴，沒有刪除原有快照／表情斷言。

郎中兩人自然抽藥爆鍋：每端1抽卡／6抽藥／1複合爆鍋音效native playing，音量25%，重載不補播；390px／減少動態／專注，0頁面錯誤。證據work/qa/quacks-explosion/evidence.json、work/qa/majority-cruel/evidence.json及相關截图。一次高速測試曾遇到Windows隔離歷史meta檔rename EPERM；未修改正式儲存邏輯，最終原生測試以合成操作間40ms節奏完整通過，不宣稱驗證過該系統鎖檔問題的所有情況。

3010另建隔離資料試玩站，read-only VACUUM INTO複製舊3009測試SQLite快照，保留帳戶；新增兩桌等待開局。正式／外部副作用關閉，test成就。原3009及更舊牌局未重啟或重置。七個服務資源逐位元比對通過，包括成人題SVG與fish成品；房碼／程序／資料僅存ignored work/playtest/cruel-fish-runtime.json。


## 最終 main 整合（2026-10-14）
已整合 origin/main 931b602（PR123藥材書翻面瀏覽、選中印章與效果說明），保留對方最新UI與兩側角色紀錄；僅CHANGELOG／角色文件／package版本文字衝突，保留双方紀錄並維持候選2.6.0。主程式及UI自動合併，沒有恢復舊的藥材書畫面。

整合後完整Windows Node24 **2225/2225**，fail/cancel/skip/todo0，213247ms，證據work/playtest/cruel-fish-main-integration-tests.log。真Edge新模式、真正solo、一般同頻抽雙圖分類重新全部通過，0頁面錯誤；朋友／題卡／聊天相對位置、暗色與390px專注完成。最新測試來源e1a621a整合提交；後續僅文件與測試尾空白整理，沒有功能修改。

另建3011整合版隔離站，保留3010及原有牌局，兩桌等待開局；十個服務資源逐位元與整合原始碼一致，包含main新版書卡控制、原創圖片與fish音效。release check對origin/main為minor通過，永久記憶與測試資料仍ignored。未推送功能分支、發新PR、合併本次新功能或部署。
