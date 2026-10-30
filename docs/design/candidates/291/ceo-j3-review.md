# #291 CEO J3／本機 F1 聊天狀態候選

2026-10-31，第三份 Figma「04｜預覽區」。**未核定、無產品程式修改。** 本批補草稿、傳送中、結果未確認、同筆重試後收到訊息四狀態，含桌機、完整手機收合頁及手機聊天抽屜，共24張。

## Bridge 恢復與來源

使用者已開啟桌面App並要求先連Bridge。服務54工具握手正常，但最初連線文件為零；在同一份第三文件執行已安裝的 Figma MCP Bridge 後，WebSocket Connected，list_files正確。新session key重新發現，沒有沿用舊key；上一批J2根框2409:28602完整讀回與舊快照完全相等。恢復期間使用者以實體Esc中止Computer Use，當輪即停止；其後明確允許繼續。

接續匯入直接指定父頁1749:9086，不要求桌面切頁。metadata仍停00共用元件時，所有新框已正確建立在04；沒有再操作桌面Figma。建立／修正／讀回均走Bridge，內建瀏覽器用於Stitch、實際候選及獨立雲端核對，未啟用run_script。

參考main `4127a035`／3.12.1真實RoomChat、chat store及readChatReceipt。以真實CeoRoom與permissionsView三人房間投影為背景，Avery房主本人、Beatrice管理者、Charlie一般玩家；合成transport不接正式帳號、朋友名單、資料庫或其他玩家。本機API僅GET，非GET回405；傳送請求只進fixture記錄，不出本機。

- 草稿為「我先看一下規則。」；傳送中保持草稿並停用輸入／表情／發送，沒有提前插入訊息。
- 第一次合成傳送未確認，保持必要錯誤與草稿，恢復輸入／表情／發送並提供重新載入入口。
- 第二次回傳合法receipt，清單只有一則Avery訊息，草稿清空；兩次請求ID相同。這只驗證真實store的合成流程，不代表真網路故障、伺服器去重或真人收訊成功。
- 每個1920／390／320深淺色共24組真實參考無橫溢，六組同筆重試ID全部一致。真實RoomChat標題仍12px，保留產品外觀缺口，不記為14px通過。證據 ceo-j3-reference-matrix.json、-reference-retries.json。

## Stitch 實稿與本機修訂

[既有CEO Stitch專案](https://stitch.withgoogle.com/projects/13570029563096816049) 新增兩張實際輸出：傳送中 `239340dc20de458ea043b87f96ae3e1e`、結果未確認 `6c4172ee3771400c807ecee0720218c4`。實際iframe DOM已保存。原稿仍帶雙頁首／舊標籤、競標與百萬資產、字型圖示，未確認頁更新增假的Charlie／Beatrice對話；沒有憑生成回覆宣稱完成。

最終J3-F1明確採已核對的H1-F1等待室背景，依J3聊天室分區與真實元件狀態重建語意HTML／CSS，刪除虛構玩法及歷史。草稿／收到為同版面衍生候選，收到的唯一訊息源自合法合成receipt，不冒稱Stitch原稿或產品已修好。原型控制不執行傳送、重連、表情或遊戲指令。

## 本機核對

- 四狀態24組三尺寸／深淺色布局，viewport實值正確、無頁面橫溢、可見字至少14px、按鈕至少44px。手機預設玩家／聊天收合。
- 390／320深淺色16組聊天抽屜外框均在viewport內，雙向Tab不離開dialog，Esc關閉且回到聊天入口；pending三個控制停用，其餘恢復可用。錯誤與必要提示常駐。輸入列Y在四狀態均692，沒有上下跳動。
- 桌機1920×1080，手機收合頁完整390×1445，不誤標為1080或844；抽屜另390×844。
- 手機候選的部分輸入讀值被瀏覽器工具遮罩，沒有算成逐欄讀回通過。匯出草稿使用已知的合成fixture字串，另以實際PNG核對；disabled與幾何依實際DOM驗證。
- 第一輪量測函式用了不支援的全域parseFloat，改Number.parseFloat後重跑，屬量測工具錯誤，不是產品bug。證據 ceo-j3f1-candidate-checks.json、-drawer-checks.json、-focus-checks.json、ceo-j3-data-checks.json。

## Figma 保存與視覺修正

Bridge [比較框2439:5721](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2439-5721)，**15744×3713，X298000／Y60000**。24張、最終808個可編輯文字，Component／Instance零；不是整頁bitmap。24份SVG均XML可解析、無image，手機收合稿為完整高度、dialog包含向量遮罩；文字基線、細邊框及原生控制仍有近似，不宣稱像素完全一致。

初次Figma PNG發現草稿／收到的空提示槽呈現無內容色塊；改透明但保留96高槽位，操作列Y仍692。八張桌機／抽屜替換內部SVG，**保留24個外框ID及幾何**，修正前節點與PNG另存。最終完整讀回 figma-ceo-j3-ready-final-readback.json、修正記錄 figma-ceo-j3-empty-slot-repair.json；已檢視實際Figma未確認手機、傳送中桌機與修正後深色收到手機PNG。

獨立內建瀏覽器雲端重開：24個外框逐張等待正確selected-root及Width／Height，24/24通過。另核對八張修正後內部向量8/8，沒有只用舊外框尺寸冒稱內容已更新。首次內部核對因圖層虛擬化找不到清單頂端，收合／重開根框並按完整圖層順序接續後通過，沒有重匯入。證據 figma-ceo-j3-cloud-twentyfour.json、-cloud-repaired-eight.json、-cloud-root.png。

仍無auto-layout、token變數綁定或Figma prototype；本機抽屜互動不代表Figma原型接線完成，也未進入產品實作。

| 狀態／主題 | 節點 | 實際尺寸 |
| --- | --- | --- |
| draft-base／light | `2439:5725` | 1920×1080 |
| draft-base／light | `2439:5811` | 390×1445 |
| draft-drawer／light | `2439:5868` | 390×844 |
| draft-base／dark | `2439:5934` | 1920×1080 |
| draft-base／dark | `2439:6020` | 390×1445 |
| draft-drawer／dark | `2439:6077` | 390×844 |
| pending-base／light | `2439:6143` | 1920×1080 |
| pending-base／light | `2439:6232` | 390×1445 |
| pending-drawer／light | `2439:6289` | 390×844 |
| pending-base／dark | `2439:6358` | 1920×1080 |
| pending-base／dark | `2439:6447` | 390×1445 |
| pending-drawer／dark | `2439:6504` | 390×844 |
| error-base／light | `2439:6573` | 1920×1080 |
| error-base／light | `2439:6670` | 390×1445 |
| error-drawer／light | `2439:6727` | 390×844 |
| error-base／dark | `2439:6803` | 1920×1080 |
| error-base／dark | `2439:6900` | 390×1445 |
| error-drawer／dark | `2439:6957` | 390×844 |
| received-base／light | `2439:7033` | 1920×1080 |
| received-base／light | `2439:7125` | 390×1445 |
| received-drawer／light | `2439:7182` | 390×844 |
| received-base／dark | `2439:7254` | 1920×1080 |
| received-base／dark | `2439:7346` | 390×1445 |
| received-drawer／dark | `2439:7403` | 390×844 |

## 交付與待辦

本批僅四份Markdown，無產品功能或版號改動。格式、affected選取與push結果以交付記錄為準；前批2155後端／254前端及build不是本輪重跑。

仍待邀請空名單／處理中／失敗、換遊戲人數不符及進行中邊界、其他公開階段及最終差異核對。獨立美術視實際需要，共用元件化與人工核定尚未完成。#291維持in progress、既有#294保持Draft；未CI、合併或部署。#284／#283／#288未開始。
