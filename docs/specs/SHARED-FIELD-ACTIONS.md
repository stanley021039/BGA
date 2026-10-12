# 共用欄位與操作排版

2026-10-12：傳情畫意的題庫選單與「開始傳遞」需有明確gap，排列方式作為基本元件。

ui-primitives.css提供ui-control-group（列間12px）、ui-field（label與控制列8px）、ui-control-row ui-field-actions（控制間12px、垂直置中、可換列、最小44px高度）。沿用既有ui-row-gap、ui-control-gap及ui-info-action-gap，不新增逐頁margin。欄位操作列的直接子button／select清除頁面margin，保留各自字型、配色、外框、disabled與可讀名稱；hidden仍隱藏。

傳情畫意等待與結束後再開局套同一組元件；題庫label繼續對應sources，新增腳本夥伴放獨立操作列，三種題庫與start／bot行為不變。作畫畫布、送出及猜詞流程不改。

驗收：1440／390px、亮暗兩主題、waiting／finished，量測選單與開始／再來一場間12px或換列後垂直12px；檢查pending鎖定、hidden、鍵盤與無頁面水平溢出。真實觸控、跨瀏覽器與全phase不由有限矩陣推定。完整測試、CI、兩回合審查與公開站結果見本批PR。
