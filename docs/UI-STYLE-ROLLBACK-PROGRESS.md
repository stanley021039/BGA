# 撤回手繪網站外觀

2026-10-08使用者指出網站整體風格不一致，要求先改回去。候選 **v1.15.1**，基線正式v1.15.0／f4cbdfa；僅撤回v1.14.1–1.14.2引入的Freehand外觀，不退整個程式版本。以下為發布前紀錄；正式結果待補。

| 範圍 | 修改 | 保留 |
| --- | --- | --- |
| 大廳 | index.html回到手繪導入前a930752的原本深色、大幅CSS／模型插圖和卡片配色，撤下紙卡主題CSS與Freehand SVG。 | 已存在六款入口、好友大廳、建立／加入／恢復房間，與v1.15內建彈幕框設定module。 |
| 畫猜／送禮／同頻／雷霆 | 撤下標題旁手繪badge與Freehand stylesheet，恢復原標題DOM。 | 玩家區、畫布／工具／倒數、聊天、車隊／骰子／WebGL、媒體與共用圖示控件；功能腳本不回退。 |
| 共用設定 | 撤下手繪素材入口。 | 音量／音效、動畫、文字emoji彈幕、個人框飾與版號。 |
| 授權頁 | /credits改用原本club-page深色表面，使用credits.css；歷史授權記錄、fixed asset routes／CSP／SVG provenance留存。 | 不再有active Freehand主題頁面；未刪除素材授權或既有tag。 |
| 個人彈幕框 | 功能與選擇保留，屬個人選項。 | default仍預設；paper／comic／pixel不強制更改整站主題。PNG上傳與收藏仍未做。 |

原生背景Chrome隔離驗收：1280×720大廳恢復RGB(16,22,19)、三欄；點畫猜同步選中與建立label；390×844單欄、無橫向溢出。四遊戲等待頁marker／Freehand link均0、玩家區與44px選框入口存在；native選框四choice。從恢復的大廳真正建立新畫猜房成功（1人等待）；授權頁同深色、無橫向溢出。沒有重跑所有玩法phase，renderer／傳輸／WebGL實作沒有修改。

Windows Node24.14.0完整 **1,432／1,432／38,249.5792ms**，fail／cancel／skip／todo0；focused Freehand provenance＋frame client/API **11／11**。原本五頁DOM逐一與a930752比對，差異只有v1.15新增frame imports；20 header入口載入契約保留，HTML active Freehand stylesheet／theme／badge均0。本批為可逆外觀修正，沒有新增鏡像CSS測試；使用既有功能回歸與實際畫面驗收。

後續風格變更先檢查大廳、房間、設定與其他頁的整體一致性；局部插圖研究或預覽不代表應直接套用全站。此回饋取代Freehand頁面目前使用狀態，歷史研究與受測tag仍保留。Linux、固定source、備份、正式與清理待最新發布節記錄；沒有新PR／push。
