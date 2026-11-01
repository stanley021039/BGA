# #291 運動員 D1 展開狀態核對

2026-10-28（Asia/Taipei）。接續 C3，本批只處理設計候選，沒有修改產品程式或正式資料。第三份 Figma 是後續候選目的地；D1 尚未通過核對，沒有當成最終設計匯入。

## 真實參考與來源

在分支 3.7.0 上，以現有 `SecondWindGame` 執行合法行動，取得三人同格與第二場 Whirly 快照；Twist 沿用 B1 第一場結算快照。權威隨機結果已保存，不能宣稱只靠 seed 可重播。以真正 `AthleteScene`、Pinia 房間 store 及現有素材渲染；遊戲 command 為不送出的 stub，沒有建立帳號、資料庫或向房間送出行動。這是合法資料的 UI 參考，不是多人真人驗收。

| 參考 | 核對資料 |
| --- | --- |
| 同格清單／能力展開 | 第一場 Twisty、Beatrice 視角及回合，順序 Beatrice → Charlie → Avery。三人均零分、直立且在第 0 格；Hotel／Beatrice、Penguin／Charlie、Le Saboteur／Avery。 |
| Twist | 第一場結算，Avery 視角；Magical Athlete／Avery 第 13 格淘汰、Doppelgängster／Beatrice 第 9 格唯一存活完賽並獲 3 分、Switcharoo／Charlie 第 16 格淘汰。scrying-pool 效果為主移動至少六格改淘汰，不把唯一存活者移到終點。 |
| 漩渦規則 | 第二場 Whirly、Beatrice 視角及回合；Avery／Beatrice／Charlie 為 1／0／3 分，Kingtripper／Understudy／Hopfrog 全在第 0 格。Understudy 已複製 Hopfrog；Whirly 無 Twist。配對為 4↔6、8↔12、11↔15、17↔22、20↔23、24↔28，停在入口才傳送。 |

已實際打開四種展開狀態並保存截圖：同格清單完整圖 1904×1404、能力列表完整圖 1904×1900、Twist 與漩渦視窗各 1905×1053；桌機 viewport 為 1920×1080，不把長圖或工具回傳尺寸誤標為 1920×1080。Stitch 附件選擇器未回傳 filechooser，圖片剪貼簿也沒有產生附件，因此本輪只送出逐項核對後的文字規格，沒有宣稱四圖已上傳。

## Stitch D1 實際結果

來源：[運動員 Stitch 專案](https://stitch.withgoogle.com/projects/6540616740381984054)。四張原始 HTML、清理後原稿、量測及截圖保存於本機 ignored 證據區。

| 狀態 | Stitch 節點 |
| --- | --- |
| 同格三位角色 | `819b77629308473bad4002af75010cf9` |
| 本場角色與能力展開 | `f23f3fdb1ecf43d59143dd909c4c1520` |
| 本場 Twist | `1464cad81f5a49dbb17bc53fab199442` |
| 漩渦規則 | `3e821c862cbf49eb9365d95e836c8641` |

四頁 × 1920／390／320 × 深淺色，共 24 組量測：120 個導覽按鈕均 44×44，可見中文 14px；1920／390 無整頁水平溢出，但八組 320px 均有頁首階段徽章超出，clientWidth 305、scrollWidth 310。三種原生 dialog 初始均為 modal、具標題關聯且焦點在內，不能因此推論全部鍵盤互動通過。

實際切換 Hotel／Penguin 會顯示相符能力與附註，能力列表亦包含三位完整文字。仍有以下缺口：同格非阻擋浮動清單被改成 modal，阻擋背景且初始焦點落在關閉鍵；「查看本場所有角色」只有 toast 導向另一候選，未真展開；漩渦 dialog 按 Esc 後關閉但焦點仍落在已關閉 dialog，未返回來源。腳本沒有明確 Tab 邊界循環，生成器宣稱完整焦點陷阱並未當成驗收證據。原圖僅預留文字槽，沒有補成獨立美術或解決 #286。

Stitch 的 `srcdoc` 會把 vh 改成固定高度，同時把原始 CSS 保存在 `data-stitch-css-vh`。初次清理僅移除屬性，造成漩渦視窗過高；其後已先還原屬性中的原始 CSS 再移除注入腳本，重跑 24 組：所有 dialog 均在視口內，320px 頁首八組溢出仍存在。保留兩輪證據，不把清理工具造成的高度問題歸咎原稿，也不把先前截圖當成已還原版本。

## D2 複驗與 D3 修訂

D2 四份實際 HTML 已保存；同格最初另有一張改名但內容仍為 D1 的節點 `28e0a835dde540e4860405de72fafbb1`，不當成已修正版本。實際新版來源如下：

| 狀態 | D2 節點 |
| --- | --- |
| 同格三位角色 | `634bcb9581844086a27e26268b308652` |
| 能力展開 | `3cf9245e36c14c3983c64655a1789dc6` |
| 本場 Twist | `b1d74a9a57d64daea48ab0455629a422` |
| 漩渦規則 | `da26f3f10b9a40c1936e19d933d995b2` |

D2-01 已能在同頁展開完整三人能力；Hotel／Penguin 可切換，選單 Esc 返來源通過。桌機房間 dialog 的 Esc 返焦及 Tab 最後→第一、Shift+Tab 第一→最後也實際通過。仍有兩組 320px 整頁橫溢：積分卡 `minmax(280px,1fr)` 使 clientWidth 305／scrollWidth 325，展開卡 `minmax(290px,1fr)` 又擴至 332。非 modal 浮層放在賽道捲動容器中，被容器裁切；320px 面板約 182px 寬、位置 y884／高566，初始未聚焦第一選項。

另外三頁改成新 main 片段卻保留 D2-01 舊腳本與標題／候選標記。瀏覽器實際出現 null `addEventListener` TypeError，舊腳本在綁定房間／玩家／聊天／說明／專注之前中斷；不能以新規則 dialog 能延後開啟，推論整頁互動完成。24 組初次導航量測中這三頁無整頁橫溢，但規則 modal 有延後開啟的 timer，即時 DOM 讀取未見 open 不等於永遠開不了，需另等可見狀態驗證。Whirly 頁首仍誤寫第一場 Twisty、Avery／Charlie 行動順位顛倒，並有假稱擲骰結算中的預覽提示；合法順序依 `AthleteScene.turnPlayers` 為 Beatrice→Charlie→Avery。

Stitch 大畫布下方稿件未掛載 iframe 時，已透過專案選單的 Command menu → Go to 對應畫面載入，再讀實際 HTML，沒有繞過 UI 讀取隱藏應用程式狀態。重開專案亦確認來源節點保存。響應尺寸測試後先還原預設 viewport，避免沿用測試尺寸操作設計編輯頁；讀完原稿暫關重型編輯頁後，本機 24 組導航量測完成，不據此斷言先前逾時的唯一根因。

已送出 D3 四張獨立完整頁面修訂，要求刪除殘留腳本、修正上述資料與幾何、非 modal 浮層放到不受賽道裁切的位置，以及初始 dialog 明確使用入口返焦。仍須核對實際結果；D1／D2 未匯入 Figma 作為最終設計，未完成人工驗收、CI、合併或部署。

後續實際 D3／D4 複驗、九張 Figma 匯入及雲端保存限制見 [最新候選紀錄](athlete-d3-review.md)，取代上段當時待生成的狀態。
