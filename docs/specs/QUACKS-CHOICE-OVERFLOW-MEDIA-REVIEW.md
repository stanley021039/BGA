# 藥材、溢出盆與橫條續播：兩回合自查

日期：2026-10-16。同一位實作者分開執行兩回合；未安排外部 reviewer。

Base：eb2d4455647a8a1d00cc1b6b9eec6bba59fd92ef

受審程式 Head：d3cff127bb77198552b88be6e56578ea3b7c49d5

直接核對 base..head 差異、需求截圖、引擎／UI接線與驗收證據。目標 stanley021039/BGA；分支 feat/room-media-pot-polish；本紀錄之後的提交僅文件，未推送／新 PR／GitHub 合併／部署。

## 第一回合：需求與驗收

- 愚人草、其他占卜／女巫／特效藥候選共用圖示；複數收回與交換前後均顯示完整藥材，保留可讀名稱、費用與不能選的狀態。
- 快速成交先選幣再選藥材，第一步沒有扣幣或HTTP操作，最後仍是原本一筆choice交易；可退回、重選或保留幣。
- 中央本輪投入移除；普通畫面浮動專注鍵移除，更多入口、專注退出及Esc仍可用。原生1440驗證選單進出。
- 特效藥在1440×900、1280×720、1024×640、390×844確認按鈕完整在框內，內外scrollHeight均等於clientHeight，沒有以裁切隱藏必要資訊。
- 52格後連續三片溢出盆原生poll更新通過；引擎實際draw命令、白彈爆炸、盆分數與下輪回袋亦通過。未改遊戲規則。
- 播放器橫條與保留影片小視窗分開；依最後補充橫條仍播放音樂及影片音訊。切換同一播放器、無全桌pause/stop；可見工具全部在56px橫條內，桌機手機已驗。可見清單標題去掉，accessible title保留。
- 結論：已驗範圍符合；本機3024提供新試玩，3023與舊站保留。真YT網路、喇叭聽感、實體觸控／Safari與九輪全部組合未新增驗收。

## 第二回合：程式品質、回歸與資料邊界

- 公開選項只衍生已提供的顏色／數值／費用，不發送raw ops、藥材ID或隱藏袋序。交易仍由服務端原choiceValid、choiceId／optionId與command去重處理，沒有把扣幣改為兩段請求。
- 本機選幣以房／玩家／roundId／pending.id隔離，輪詢不重設；busy與disabled阻擋本機重選和提交。實際函式抽出測試，不另寫一份UI實作。
- 大釜cache key新增overflow與擴充開關，保留相同資料不重畫；hidden對手的overflow仍為null，既有保密測試保留。
- 橫條由明確最小化動作設定，僅該模式略過影片可見尺寸／intersection退出；正常／小視窗、關閉／換桌、同意、頁面hidden與共享控制權沿用既有處理。最小化／恢復不強制seek重播。
- 修正一次原生驗收發現的Stitch20px內距覆蓋，限定media-collapsed；沒有改動遊戲工作區或一般dialog。CSS ownership通過。
- 無DB schema／遷移或正式資料操作；新試玩使用SQLite快照與獨立資料目錄。永久記憶、登入憑證、work與.private資料均不在本提交。
- 結論：上述固定差異未發現未解重大問題；剩餘未驗範圍如第一回合。非外部安全審計。

## 證據

Windows Node完整2,314／2,314，fail／cancel／skip／todo均0；126受影響項通過。Edge四尺寸郎中及1280暗／390亮媒體真HTTP＋可控YT fixture、22個管理入口與清單捲動／續播回歸通過；無pageerror。版本minor相對v2.14.1、style ownership及diff whitespace通過。3024/api/version=2.15.0，六項公開資源逐位元與受測來源一致。

詳細範圍與可重跑工具見[本批紀錄](QUACKS-CHOICE-OVERFLOW-MEDIA.md)。YT fixture不能推定第三方真播放／實際聽感。未推送，無本次遠端CI結論。
