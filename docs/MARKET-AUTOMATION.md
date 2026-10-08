# 股市官方收盤自動化與排行榜

2026-10-08 排程政策更新：每日 14:00–16:00 有界重試、成功停止、歷史僅缺漏及管理員手動核對，詳 [每日抓取規格](specs/MARKET-DAILY-FETCH.md)。以下舊版測試／候選版本屬當時紀錄。

2026-10-07，Issue [#47](https://github.com/stanley021039/BGA/issues/47)，候選 v1.10.0、schema 17。基於合併 PR #46 後的 main `1ea916ad651c4b8cad0babfdceed154348a20156`。本功能尚未部署；不表示正式環境已啟用排程。

## 玩家流程

- 頁首常駐「目前預測」日期與星期；前一個日曆日台北時間 23:59:59.999 仍可提交，交易日 00:00 起截止。舊版規則快照不改寫。
- 台北 14:00 起查核當日官方日收盤。14:00 只是查詢門檻，不是資料已收盤的證明。
- 指定日期、報表種類、數值與另一份官方日報互相吻合後，自動結算既有投票。資料缺漏、仍是昨日、格式不明、欄位不完整、特殊處理或來源不一致時等待重試，不以零值、即時盤中價或猜測補入。
- 建立下一個預測日期與等待舊日結算分開；官方日曆確認下一交易日後即可建立，不把延遲的當日資料帶入下一日。
- 近一個月表格使用「上一日曆月同日（月底則取有效末日）至今日」的台北日期區間，並非最近 30 個交易日。僅列已核對的每日資料；缺資料不代表休市。
- 排行榜只計市場 ledger 的終身累積積分，猜中 +5、猜錯 −1、持平 0；未投票不計分。因休市作廢的未結算場次不產生假 0% 收盤或積分。
- 排行榜顯示暱稱、名次、市場積分與自己標記，不洩露其他會員帳號、UUID 或票選內容。停用帳號不列入；同分並列競賽名次（1、1、3），同分順序依建立時間與 UUID 穩定排列；最多列 100 人並另外顯示自己的名次。

## 官方資料契約

即時查核只使用固定的 HTTPS 證交所日資料端點：

1. [MI_INDEX](https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX)：精確選取「發行量加權股價指數」，ROC 日期、收盤、漲跌符號／點數、漲跌百分比、特殊處理註記
2. [MI_5MINS_HIST](https://openapi.twse.com.tw/v1/indicesReport/MI_5MINS_HIST)：每日 OHLC；不是盤中五分鐘即時資料，且 OpenAPI 僅提供最近月份
3. [FMTQIK](https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK)：每日加權指數與漲跌點數
4. [年度開休市表](https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule)：要區分「開始／最後交易日」與真正休市行，未知項目拒絕猜測

官方資料集說明：[每日收盤行情](https://data.gov.tw/dataset/11555)、[加權指數歷史資料](https://data.gov.tw/dataset/11755)、[開休市日期](https://data.gov.tw/dataset/11761)。沒有找到 14:00 發布 SLA 或永久不修正的 final flag。

跨月查詢採從官方網站操作取得、實際開啟的月報列印網址：

- [2026 年 9 月加權指數歷史](https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST?date=20260901&response=html)
- [2026 年 9 月市场成交資訊](https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?date=20260901&response=html)

請求使用固定報表路徑及有效年月，嚴格核對表頭、標題年月、每列實際日期、唯一日期、OHLC 上下界與兩報表收盤值。官方 UI 的九月兩份真實月報共 20 個日期／收盤逐筆吻合，且同月相鄰 19 個漲跌差核對一致；產品 parser 也以兩份完整實際表格通過 20 筆。另以本次 cloud Node 實際 `createOfficialProvider().fetchCloses({from:"2026-09-30",to:"2026-10-07"})` 直接 HTTP 成功回傳 09/30、10/01、10/02、10/05、10/06 五筆，0 failure；完整 09/07～10/07 區間亦以直接 HTTP 取得 20 筆／0 failure（目前最後為 10/06）。10/07 因 MI_INDEX 仍是 10/06 而保留等待，不以較新的單一報表先結算。正式部署主機連線仍未驗。

指數與漲跌點數以整數百分之一點儲存；當日以官方刊載兩位小數百分比為準，同時以整數有理數核對計算結果。歷史月報的百分比依 `漲跌點數 ÷ 前收盤 × 100` 精確計算並四捨五入至官方相同的兩位小數，標记 `computed-from-official-close-change`。分類依這個兩位小數日漲跌幅，保留原有 ±2%、±5% 邊界，不拿二進位浮點計算誤差猜邊界。

HTTP 契約限制：不接受轉址、登入頁或其他網域；10 秒 timeout，單份 2 MiB 上限，Content-Type 與 UTF-8／JSON／HTML 結構驗證。每份證據記錄實際 URL、原始回應 SHA-256、取得時間；日資料另存語意 fingerprint。已結算原始日資料及證據保留，後續相同數值查核只新增有界 audit，不取代原始結算證據。

## 日曆、例外與更正

- 年度日曆須通過年份、交易開始／結束標記與節日完整性檢查，才承認該年覆盖範圍；已確認各年快照持久保存。官方年度列印頁實測以 `date=YYYY0101&response=html` 選定西元年度，2025／2026 各回傳正確年度；2027 當下查無資料，不能因選單可選就當成已公布。最終 provider 直接 HTTP 於 14:15:56Z 成功取得2026的24個休市日期與3個交易標記，仍不納入未公布2027。
- 同年度兩份官方日曆若矛盾，保留舊快照供稽核但立即封鎖該年覆蓋；重新取得一致來源才解除，不能因快取仍存在就繼續猜下一日期或自動結算。
- 日曆覆蓋以內才套週末及官方開休市例外。未知年度、跨年缺資料或不認識的公告條目時不推測下一日期，畫面說明等待年度資料。
- 年度表本身不能排除臨時颱風停市。管理員可在市場頁明確確認日期、開休市、官方 TWSE 公告 URL 與原因，覆蓋指定日期；帳號權限、requestId 與時間一併稽核。前端日期不會被移到別日，原投票仍保留。
- 已有但未結算的休市日期設為作廢，禁止新投票或結算。已結算日期不自動撤分；發現官方修正或與人工結果不同時標示待管理員覆核。原版積分、結果版本、第一份官方證據不悄悄重寫。
- 更正仍沿用原有管理員預覽、明確確認、版本檢查和原因，先撤銷舊 ledger 再授予新結果。待覆核旗標保留供管理員確認外部原因，不因下一次抓取而自動消失。

## 排程與隔離

`src/market/automation.js` 在既有 app 與資料目錄單寫者鎖內啟停；沒有第二個服務或第二個正式 SQLite writer。網路等待不持有 DB transaction，單次 job 不重疊，停止會 abort 並等待 job 收尾後才關 DB。

- 啟動查核年度快照與未完成日期，持久化下次嘗試時間；同一輪所有來源記錄、結果與分數在一個 SQLite transaction 內提交
- 官方資料延遲／錯誤依每日有界時點重試；成功日期停止自動重抓，改由管理員手動核對修正。日曆仍六小時更新一次、失敗五分鐘重試
- 14:00 前可回補過去日期，但當日資料不能結算；14:00 到達後依來源實際內容驗證
- 首次初始化最近一個日曆月，以後只選缺漏；輪流處理一個更早未結算月份，有限次數後交管理員，避免無界重試
- 重啟或重送不重複加扣分；既有 `result_revision`、結果唯一鍵、ledger 唯一鍵及 `BEGIN IMMEDIATE` 序列化人工作業與自動結算
- `EXTERNAL_SIDE_EFFECTS_ENABLED=false` 關閉全部自動 fetch、開場、結算及自動 audit 寫入。新增 `MARKET_AUTOMATION_ENABLED=false` 可單獨關閉市場自動化。這些是配置說明，本 PR 沒有修改部署設定
- 直接嵌入 `createApp` 且未明確給 `externalSideEffectsEnabled:true` 時，市場排程預設不啟動。一般 server 的 `settings()` 仍依既有環境設定提供明確值

## Schema 17 與備份

新增五表：`market_daily_closes`、`market_calendar_years`、`market_calendar_overrides`、`market_fetch_audit`、`market_automation_state`。市場日期及結算增加 user/system actor；system 的 created_by 為 NULL，沒有虛構管理員帳號。市場日期亦增加作廢原因／時間。

遷移將舊日期／結算父表重建、保留 rowid 與所有既有欄位；外層 transaction 加 savepoint 保證任何版本的升級錯誤都回到原版本。遷移前後驗證 foreign keys，成功後重新啟用 FK。所有新增資料由完整加密備份保存，schema／來源證據／積分語意損壞均拒絕匯出或還原。

舊版程式不能開啟 schema 17；退回必須使用升級前完整備份及對應舊程式，不能只回退 code。正式資料沒有在本任務中遷移。

## 驗證狀態

- 已完成 focused：精確日期／歷史 parser、官方來源不一致、±2／±5 邊界、原子失敗回滾、重複／跨 SQLite 連線、重啟、人工競態、日曆／跨年／臨時休市、排行榜隱私與更正、HTTP 權限、隔離開關、完整 schema 1–16 升級和加密備份還原
- UI 使用實際 client 的 DOM/VM 測試：日期切換、晚回應、投票草稿、歷史缺資料、排行榜同分與自己、作廢、override 確認及既有圖片庫回歸
- 原生 Chromium 在頁面載入前因 executor `socket() Operation not permitted` 失敗；本批沒有實體手機、原生桌機視覺或輔助技術通過的主張
- Node v24.19.0：最終原生 full suite 1409/1410，唯一失敗為既有 `web-features` 的 `/api/info`；基底受審 PR46 同項亦重現500，單獨呼叫 `os.networkInterfaces()` 確認 executor `uv_interface_addresses` 系統限制。同一份最終程式，繼承到子 server 的 test-only `networkInterfaces=()=>({})` 替身完整 1410/1410，fail/cancel/skip/todo 全0。替身未加入產品程式；不能把替身通過稱為原生全綠。後續測試與精確 commit 以 PR 最新驗收為準

尚未合併、部署、操作正式資料或修改使用者權限。正式啟用前需在預定執行主機確認固定官方來源可以存取，並保留完整備份與未知年度／臨時休市的管理處理流程。

## 2026-10-07 獨立審查修正

- 已知年度日曆衝突不因其中一份來源暫時失敗而解除。正常首次載入仍容許一份有效官方年度表；一旦衝突，必須兩份固定來源實際一致，保留兩份 URL／hash／取得時間後才恢復該年。單來源恢復仍保持封鎖與五分鐘重試。
- 管理員明確開放的單一日期可在年度封鎖中建立預測並以同日已核對收盤自動結算；其他日期仍被封鎖，覆蓋不會解除整年度限制。
- fetch audit 的 hash 依記錄的 sourceUrl 在證據中精確查找。歷史 FMTQIK 主來源不能誤記另一份 OHLC 報表的 hash；初次、重複、首次更正及待覆核重查皆驗，sourceUrl 缺對應證據則拒絕。
- 三份獨立重現案例改用修正後預期均通過；新增 actual-provider→runner 日曆降級／雙來源恢復、逐日override、URL／hash一致性回歸。修正後 focused provider／automation／schema 95/95；完整結果以後續固定提交驗收為準。
