# 撤回手繪網站外觀

最新正式：**v1.15.1／c1e59d4**，已完成還原與公開驗收；下方候選／待驗是歷史，最終節取代發布狀態。

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

## 發布前基礎設施狀況

同source Linux Node22.22.1完整1,432／1,432／256,071.171617ms，fail/cancel/skip/todo0；使用root-filesystem私有TMPDIR，避免前批大容量測試/tmp tmpfs限制。source/tag v1.15.1固定c1e59d44b395c9e65ca3bed0dce03b936f815e39，canonical archive SHA256 61e8f8dd2101b94e52a348a28df38e0b4fed4d455498b4092160a4ad0f186ca5。

首次UTC01:40:31零房間guard後，舊PID166218收到SIGTERM但35秒健康檢查未完成：current已c1e59d4、舊cwd仍f4cbdfa、3000停止listen、四data locks仍活PID持有，沒有刪鎖。readonly snapshots確認9帳戶與21non-session表保留；代理重連前兩次fresh guard均0，均正常logout。對已驗UID/command/Restart=always的cloudflared PID166219發SIGTERM協助釋放連線，backend正常完成close／釋放鎖，服務重啟PID172662、proxy172663，local version1.15.1。這支持既有連線拖住shutdown的判斷，不宣稱重現每一種連線原因。

恢復驗證曾因writePrivate使用wx不能寫既有失敗receipt而未返回成功；原紀錄完整保留為activation-failed／activation-timeout receipt，另建confirmed後原子切換，最終正常postcheck通過schema16／22表、users9/allfields、env/data paths及inactive import generation。沒有強殺server、刪活lock、覆寫DB或退舊env。公開smoke第一次早於切換完成，version1.15.0不符而退出，未登入／建房；待正常postcheck後才重跑，最終公開結果以下節為準。

## 最終正式結果

- Windows／Linux完整各1,432項，fail/cancel/skip/todo0；source/tag c1e59d44b395c9e65ca3bed0dce03b936f815e39不移。current releases/c1e59d4，backend PID172662／proxy172663，两service active。
- 備份 `/home/ccc/apps/afterhours/shared/backups/pre-style-rollback-c1e59d4-20261008T013954Z-69578747-006d-4166-b34b-1de615a03cc2`；在線SQLite加另時點files/env archive，非atomic cold snapshot。schema16／22schemas、21non-session表rows與BLOB、9帳戶allfields／13市場圖片與新鮮備份一致，integrity ok／FK0；env与active data paths維持，import generation inactive。
- 公開HTTPS **27份exactbytes／no-store／MIME**：20會員可讀HTML（含歷史credits，admin403不列）＋6shared資源＋credits.css。五款三席內建框／avatars保留，均等待phase，不宣稱完整玩法實玩。
- 正式背景Chrome受限auth proxy（真shhuang.cc內容/API，非fixture）：首頁RGB(16,22,19)、Freehand stylesheet／image0、三欄、poker可選中、無橫向overflow；截图私有work/style-rollback-production-home.png。四房三席waiting marker／hand stylesheet0，玩家／車隊資料可見與frame入口保留；無橫向overflow。其餘playing／讀屏／200%／多設備／FPS未做本輪人工驗收；功能／renderer實作未回退。
- 自有五房leave後state404，3正式測試帳戶logout＋auth/me401；3次room guard登入亦成功logout。sessions242→248為6次驗證登入，不能說session rows不變。8個自有房間cache、viewport、own Chrome tabs、隔離server與公開proxy均清理；無新PR／push。

後續待辦仍見SPEC-BACKLOG；這次先處理使用者撤回外觀的要求，B01內建彈幕框繼續完成狀態，B02–B09沒有因還原而增加或完成。
