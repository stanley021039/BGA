# #291 CEO J2／本機 F1 管理者與換遊戲候選

2026-10-30，第三份 Figma「04｜預覽區」。**未核定、無產品修改。** 接續 [J1](ceo-j1-review.md) 的真實共用元件及三人房間投影，補 Beatrice 管理者視角、踢出 Charlie 確認、房主換遊戲未選與已選，共四視圖。

## 來源與修訂

[既有 CEO Stitch 專案](https://stitch.withgoogle.com/projects/13570029563096816049) 實際新增兩張：管理者 `3ba7142ada8e4c258ab5dd7cf83d57d7`、更換遊戲 `57425319ad0142c68d6b894f32455c7f`。已保存實際 DOM 與 ceo-j2-raw-check.json；沒有憑生成回覆認定通過。

J2 管理稿只帶未定義 utility，混入 H1 房主舊外殼、90秒回合及假踢出請求訊息；換遊戲稿包含100萬資產、房主可調席次／隨時切換等不實背景，且初始其實已選你畫我猜。保留失敗，最終本機F1明確採以下來源：

- 管理者稿沿用 J1 實際管理窗版面＋本機F1修訂，不冒稱 J2 原稿已修好。本人 Beatrice，Avery 房主與本人均無操作，Charlie 只有踢出；沒有升降角色、踢房主、移交房主或解散房間。管理提示與真實 RoomManager 相同。第二層原生確認、取消／Esc返焦；確認踢出仍刻意停用為靜態候選。
- 換遊戲採 J2 實際 dialog／CSS＋已核對的 H1-F1 房主背景。由真實 roomGames 提供十一個目標及人數範圍，沒有 CEO／運動員選項。初始清空選擇、提示請選擇遊戲、確認停用；選你畫我猜後提示三人／2–8人並啟用確認。初始提示移除成功色。確認沒有伺服器指令或假跳轉；取消／Esc只關閉並返焦。

此為合成原型，不執行真實邀請、角色修改、踢出或換遊戲。生成器的 emoji／提示樣式、靜態確認控制及其它外觀差異仍需共用元件化，不能宣稱已完成產品R6驗收。

## 有效驗證

四視圖 × 1920×1080／390×844／320×844 × 深淺色共24組：viewport 實際尺寸正確、頁面無橫溢、可見字至少14px、按鈕至少44px、dialog 外框位於 viewport。24組雙向Tab邊界、12次Esc回到入口通過；12組管理／確認核對本人與唯一踢出權限，12組未選／已選核對確認停用與相容提示。保存 ceo-j2f1-checks.json、-tabs.json、-focus.json。

J1 角色參考48組另外補驗：最初三組邀請截到名單尚未載入，改等待 Dana／已邀請可見後重跑全部18組邀請，最終48組權限斷言通過（ceo-j1-permission-checks.json）。補驗曾有本輪參考分頁輸入逾時，關閉本輪已完成的25個參考分頁後接續，不操作使用者瀏覽器或重建Figma內容。

## Figma 保存

Bridge [比較框2409:28602](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2409-28602)，**15744×2180，X280000／Y60000**。16張桌機／手機深淺色、684個可編輯文字，Component／Instance零；沒有整頁 bitmap。輸出 XML／無image檢查16/16，select 選中文字另外轉成可編輯文字並裁切於欄內，不依賴原生option自動匯出。

完整讀回 figma-ceo-j2-ready-readback.json；已檢視實際 Figma 手機管理者與選中你畫我猜 PNG，角色控制及提示正確。仍無 auto-layout、token綁定或 Figma prototype；HTML互動通過不是Figma原型接線完成。原生選單箭頭、字基線及裁切為近似，未宣稱像素完全一致。

雲端初次仍只有J1，重新載入也未見J2。桌面Figma原本最小化，恢復後看到「Some changes won't be synced until Figma is able to reconnect.」。在同份文件觸發Ctrl+S，之後獨立雲端出現J2；逐張等待正確selected-root與Width／Height更新，16/16通過（figma-ceo-j2-cloud-sixteen.json／-cloud-root.png）。另以全新分頁再重開確認根框，沒有重匯入或要求使用者接手。Computer Use僅用於恢復視窗、讀同步提示及觸發儲存，全部設計寫入與讀回仍走Bridge；Connected不等於已同步，後續仍須獨立核對。

| 視圖／主題 | 節點 | 尺寸 |
| --- | --- | --- |
| manager-base／light | `2409:28606` | 1920×1080 |
| manager-confirm／light | `2409:28727` | 1920×1080 |
| manager-base／light | `2409:28863` | 390×844 |
| manager-confirm／light | `2409:28949` | 390×844 |
| manager-base／dark | `2409:29051` | 1920×1080 |
| manager-confirm／dark | `2409:29172` | 1920×1080 |
| manager-base／dark | `2409:29308` | 390×844 |
| manager-confirm／dark | `2409:29394` | 390×844 |
| switch-base／light | `2409:29496` | 1920×1080 |
| switch-draw／light | `2409:29608` | 1920×1080 |
| switch-base／light | `2409:29721` | 390×844 |
| switch-draw／light | `2409:29798` | 390×844 |
| switch-base／dark | `2409:29876` | 1920×1080 |
| switch-draw／dark | `2409:29988` | 1920×1080 |
| switch-base／dark | `2409:30101` | 390×844 |
| switch-draw／dark | `2409:30178` | 390×844 |

## 交付與待辦

本批僅文件，無產品功能／版號修改；前批2155後端／254前端及build不是本輪重跑。J1已以06eb73e1推送既有Draft PR294，訊息含skip ci，必要Prettier hook通過，未啟動CI。本批四份Markdown，test:affected對準06eb73e1選取0/257，沒有執行自動測試，版號一致性3.12.1通過。format／format:check均1066 checked、0 formatted、111 legacy、0 failures；同步狀態補記後推送前再執行格式檢查。diff check通過。

仍待邀請空名單／失敗／處理中、聊天草稿／傳送中／未確認／重試候選、換遊戲人數不符與進行中邊界、其他公開階段、原創美術與共用元件化。#291維持in progress，#294保持Draft；未人工核定、CI、合併或部署，#284／#283／#288未開始。
