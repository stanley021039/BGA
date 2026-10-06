# 你畫我猜：建房類別與等待名單修正

日期：2026-10-05。分支 `fix/draw-room-categories`；程式基線為正式 `9f041d3`，本地另含agent記憶提交 `2673546`。

| 要求 | 實作 | 驗收與進度 |
| --- | --- | --- |
| 共編題庫與旁邊文字對齊 | toolbar連結及按鈕共用44px高、flex置中、相同padding／line-height；修正原本anchor盒子已置中但字仍頂端的問題。 | 本機1280×720，房號／人數／邀請／題庫／說明中心均90px；題庫dialog完整落在視窗內、Escape返焦原入口。 |
| 類別可多選，自定義也是一類 | 開房／房主設定共用九類checkbox、全選／清除；server檢查非空合法不重複清單，只從勾選內建題材及獨立自定義來源抽取。 | API／引擎驗兩類聯集、排除未選類別與投稿、只抽自定義、混合來源、空清單及空自定義庫；本機Chrome開房／修改／reload保持一致。 |
| 大幅等待插圖換已入座的人 | 舞台改完整1–8人角色卡、姓名、房主及離線狀態；開局恢復原比分名單。 | 隔離八席，其中七席API；1280×720無頁面捲動、八張64×80角色；長名換行。390×844單欄、無水平溢出；开局仍有8人比分，底704px。 |
| 入座時保留操作 | 名單及開始按鈕局部更新，房主未儲存的類別草稿及展開狀態不因其他人入座重設。 | Chrome未保存food／animals／custom時其餘7席加入，仍保留三勾選與設定展開、開始由disabled變enabled；保存後server及reload一致。 |

新API `topics` 以固定類別順序保存；新UI不再另设投稿比例，自定義只依來源勾選。舊 `topic/customPercent` 呼叫及歷史仍相容，避免改寫原有回放語意。只勾自定義時所有投稿都可抽，不因投稿的食物／動物／綜合標籤而排除。題庫不足三題可提供實際可抽數，沒有任何題目則拒絕開始，不偷偷用未選類別補題。

本地全套初次229/229；補入「入座不丟設定」回歸後畫猜前端14/14，最終Windows／Linux全套各230/230。此報告不是不同真人的遊戲評價，也未完成八人完整遊戲；本次驗收重點是建立、設定、名單及選題權限。

私人證據：`work/draw-setup-entry-local.png`、`draw-waiting-eight-local.json`及後续正式站截圖。帳密、cookies與短期房碼不放此文件。

## 正式部署與驗收

程式來源 `50b7f62` 已部署shhuang.cc，current=`releases/50b7f62`；封存SHA-256 `C73E3223C656155478C430296095E28A146BBA6B8808ADB0E1DD7F68DEA267A9`。切換前正式房間列表為空；SQLite線上備份 `pre-draw-guess-20261005T020903Z.sqlite`，備份與切換後均v12、integrity ok、7帳號，網站／Tunnel active，loopback登入200。

原Chrome全程背景操作；三個既有測試帳號，主帳號UI、另外兩席API。正式UI建立food／transport／custom，名單立即顯示3人；改為food／transport並保存，server與reload均保留兩類。開始後三候選為香蕉、挖土機、披薩，都在所選兩類，另兩席無私有候選；UI選香蕉進入作畫，畫具顯示且三人比分仍可見。這不是完整三輪遊戲或滑鼠作畫驗收。

正式1280×720頁寬／高均等於視窗，三張角色64×80；toolbar五項中心均90px，題庫／邀請／說明文字flex置中。修正HTML／JS／CSS三份正式內容與本機一致。證據 `work/draw-room-entry-prod.png`、`draw-room-waiting-prod.png`、`draw-room-prod-layout.json`、`draw-room-prod-assets.json`。

測試後全部本機／正式專用席位正常離房，正式舊號404；保活及本機3119服務已停止，暫時viewport還原。角色偏好記錄U14與程式接手事項已同步。此修正尚未push或另發MR，不將其宣稱包含在先前PR #30。
