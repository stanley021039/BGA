# PR53 混合真人／AI成就評論修正

2026-10-08，回應 [P2評論](https://github.com/stanley021039/BGA/pull/53#issuecomment-6056180979)，修改前head `6fb3f32`。候選仍1.19.0，沒有正式部署或資料修補。

## 根因與改動

HTTP的freezeAchievementParticipants刻意不映射AI帳號，但同頻／送禮／畫猜的mappingComplete比較全部席位數，讓含AI的正常回合降為interrupted。

三款引擎現在只接受已存在真人席位的帳號映射；開始時逐席檢查，只有明確已存在的AI可以略過帳號要求。真人少映射、無效或重複帳號、未知席位仍不完整，維持fail-closed。AI不產生個人成就參與者，實際玩法、AI排程、官方完成條件及收據冪等性保持。既有interrupted歷史收據沒有自動改寫或回補；沒有足夠正常完成事實時不推定授予。

## 驗證

Linux相關67項通過：achievement-http、achievement-unit-engines、achievement-units、achievement-pending-retry、local-ai-http。新增加三款各兩個引擎／真資料庫授予案例：3真人＋1AI正常完成時真人可授予、AI不授予；少一名真人映射時不授予任何人。另以真HTTP／真AI排程完成同頻3真人＋1AI，確認三位真人各得majority-first-vote與all-first-table及三筆progress。

引擎測試同時保留throw／partial／invalid／duplicate等拒絕案例，pending重試與冪等測試通過。未重跑整份完整suite，本輪67不能混同先前1712的固定source。送禮與畫猜混合回合驗證為引擎＋資料庫；未宣稱兩者本輪真HTTP混合端到端驗過。

## 分開審查

第一回合（需求）：對照6fb3f32追加差異，評論指出三個同樣模式全數修正；真人缺映射保護保留，PR沿用53並同步57，無額外部署。

第二回合（品質）：映射只接受真人集合，mappingComplete逐席確認而非人數比較，不能用AI或其他映射補足缺失真人；判斷在開始時凍結，後续身份變更不補授。沒有新增外部API／schema變更／歷史收據重寫。67項與release/diff check通過；本批未見阻擋問題。
