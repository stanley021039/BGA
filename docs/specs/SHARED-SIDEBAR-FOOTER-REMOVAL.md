# 共用側欄重複區塊移除

2026-10-12：依截圖移除共用側欄的等待／回合狀態色塊、對局歷史連結及其分隔線。範圍是共用GameShell，不是各遊戲主要階段提示或網站歷史導覽。

shared-turn改為ui-sr-only的span，維持role=status／aria-live=polite与turnOf更新；不再套shared-turn色塊幾何。保留作為既有DOM搬移anchor，避免改動玩家／表情／媒體控制。draw／gift／majority靜態側欄history-link刪除；GameShell不再注入同類連結，初始化會清除既有舊側欄連結。主要網站導覽仍可進歷史頁。

驗收以桌機／手機、亮暗與waiting／active／finished狀態確認：沒有可見狀態色塊或sidebar history-link，讀屏狀態仍更新，主要操作與emoji／媒體保留。有限瀏覽器fixture不等於全遊戲真人實玩；完整測試、CI、兩回合審查與正式部署證據見本批PR。
