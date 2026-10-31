# #291 CEO J1／本機 F1 房間操作候選

2026-10-30，第三份 Figma「04｜預覽區」。**未核定，未修改產品程式。** 本批完成邀請線上朋友、邀請連結、房主管理、踢出確認四個視圖；換遊戲、管理者專屬稿及聊天狀態仍待接續，不能將本批當成整張 #291 完成。

## 真實來源與權限

參考 main `4127a035`／3.12.1，直接掛載真實 RoomInvite、RoomManager、RoomGameSwitcher、RoomChat 與 store／樣式，以 CeoRoom 及真實 permissionsView 建立三位真人類型合成角色：Avery 房主、Beatrice 管理者、Charlie 一般玩家。只匯出 room.view，不含座位 secret。fixture 在忽略的 work/design-291，沒有正式帳號、朋友名單或資料庫；本機 API 只接受 GET，寫入回 405，遊戲指令不執行。

- 房主可設定管理者、踢出其他玩家；管理者只能踢出一般玩家，沒有升降角色控制；一般玩家的房間管理停用，管理者／一般玩家沒有更換遊戲入口。
- 「移交房主／解散房間」是畫猜專屬，不畫入 CEO。
- 邀請線上名單使用 Dana（合成）可邀請、Emery（合成）已邀請停用。沒有送出任何邀請；連結稿使用 example.invalid 合成網址。
- 真實換遊戲清單有十一款，沒有 CEO／運動員；目前 CEO 未選擇目標時確認停用，選你畫我猜後顯示三人／2–8 人並可確認。只選擇及關閉，未真正切換遊戲。
- 真實聊天合成 transport 觀察到「傳送中…」，未確認錯誤出現時草稿保留、輸入與送出恢復。初次太晚擷取，輪詢已清掉錯誤，不能算錯誤畫面；最後以明確錯誤文字等待後保存 ceo-j1-chat-failure.json／-valid.png。這是合成傳送失敗參考，不代表真網路斷線或多人聊天驗收。

三種角色、1920×1080／390×844／320×844、深淺色共48組入口／管理／邀請實際參考無頁面橫溢，dialog 均在 viewport 內。聊天室標題仍12px，明確列為參考缺口，沒有把真實產品寫成通過14px。證據 ceo-j1-reference-matrix.json。早期 helper 封存了舊分頁綁定，標籤與量測不符的 ceo-j1-reference-evidence.json 不列為有效矩陣；改成明確傳入分頁、驗實際 viewport 後重跑。

## Stitch 與本機修訂

既有 [CEO Stitch 專案](https://stitch.withgoogle.com/projects/13570029563096816049) 本輪兩張實際結果：

| 視圖 | Stitch source |
| --- | --- |
| 邀請 | `e3461432ef08480095bed9d4d714421e` |
| 房主管理 | `d049176c3ba44d29b1ed6f262f99b8ae` |

保存實際 iframe DOM，而非相同的172114字預覽啟動碼。原稿保留 H1 舊外殼、虛構等候集團／額外在線活動、模擬成功回饋，管理確認只在卡片內展開；不採生成回覆的全數完成主張。

J1-F1 明確保留原稿 CSS／dialog 設計，背景換為先前已核對的 H1-F1 等待室；修正本人／管理者、移除虛構席位集團、重複頁首與假成功訊息，刪除實際傳送、複製、角色變更或踢人事件。踢出 Charlie 改為第二層原生確認 dialog，取消／Esc 回到管理，主窗 Esc 回到房間入口。確認踢出在候選中故意停用並標「靜態候選」，與產品可確認不同；未模擬執行成功。

24組四狀態／三尺寸／深淺色候選均無頁面橫溢、可見字至少14px、按鈕至少44px，dialog 外框完整在 viewport；24組雙向Tab邊界與12次Esc關閉返焦通過。第一次320px管理窗870高超出視窗，修成依 viewport 高度限制及內文捲動後複驗，失敗另存 ceo-jf1-first-checks-failed.json。最後證據 ceo-jf1-checks.json、ceo-jf1-tabchecks.json、ceo-jf1-focus.json。

本機候選不是產品共用元件實作；仍有生成器外觀差異（如邀請的emoji圖示、確認停用控制外觀尚未元件化、管理提示區與徽章）。確認控件最終應回接真正 UiButton／ConfirmDialog，不把本批說成已完成所有R6外觀。公司／遊戲功能與專注流程沿用先前批次證據，本輪沒有重新驗證。

## Figma 保存

Bridge [比較框2389:26913](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2389-26913)，**15744×2180，X262000／Y60000**。四視圖各桌機／手機、深淺色共16張，完整讀回730個可編輯文字，Component／Instance零。不是整頁 bitmap；仍無 auto-layout、token 變數綁定或 Figma prototype。

首次 XML 序列化產生 ns0:svg，Bridge 拒絕匯入；當時只有根框及標籤。修正 SVG 命名空間後讀回原根框，沿用2389:26913接續，沒有重建重複比較區。16張 SVG 均 XML 可解析、無 image；輸入文字裁切於欄內、排除背景聊天placeholder，原生dialog遮罩以向量保存。字基線、邊框／陰影及原生裁切為近似，不宣稱像素完全一致。

內建瀏覽器獨立重開第三份後，先切04預覽頁，再逐張等待正確 selected-root 及 Width／Height：**16/16** 保存核對通過。證據 figma-ceo-j-cloud-sixteen.json／-cloud-root.png，完整讀回 figma-ceo-j-ready-readback.json。已檢視實際 Figma 手機邀請、手機雙層確認與桌機邀請連結 PNG，不以 XML 或連線成功代替視覺核對。

| 視圖／主題 | 節點 | 尺寸 |
| --- | --- | --- |
| invite-base／light | `2389:26917` | 1920×1080 |
| invite-link／light | `2389:27022` | 1920×1080 |
| invite-base／light | `2389:27114` | 390×844 |
| invite-link／light | `2389:27194` | 390×844 |
| invite-base／dark | `2389:27256` | 1920×1080 |
| invite-link／dark | `2389:27361` | 1920×1080 |
| invite-base／dark | `2389:27453` | 390×844 |
| invite-link／dark | `2389:27533` | 390×844 |
| manager-base／light | `2389:27595` | 1920×1080 |
| manager-confirm／light | `2389:27729` | 1920×1080 |
| manager-base／light | `2389:27875` | 390×844 |
| manager-confirm／light | `2389:27979` | 390×844 |
| manager-base／dark | `2389:28099` | 1920×1080 |
| manager-confirm／dark | `2389:28233` | 1920×1080 |
| manager-base／dark | `2389:28379` | 390×844 |
| manager-confirm／dark | `2389:28483` | 390×844 |

## 交付範圍與待辦

本批只將四份 Markdown 納入 Git，無產品功能／版號變更。格式、受影響測試選取及提交證據以本批交付記錄為準；前批2155後端／254前端及build不是本輪重跑。

仍待管理者與一般玩家專屬候選、邀請空名單／失敗／處理中、更換遊戲各條件、聊天草稿／傳送中／未確認／重試稿、其他公開階段、原創美術及共用元件化。#291 維持 in progress，既有 #294 維持 Draft；未人工核定、未啟動CI、未合併或部署。#284／#283／#288 未開始。
