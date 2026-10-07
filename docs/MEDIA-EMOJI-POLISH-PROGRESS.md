# 播放控制與表情選單修正

2026-10-07。正式v1.8.3已發布。受測程式與不可覆寫本地tag ff1d00b6539aedbfa3833b60639cdaffed1d4acf；Windows／Linux各1111/1111（37936.8023ms／192716.305548ms），fail/cancel/skip/todo均0。發布包SHA-256 1c7aa0a739ebfdbff02174b52edefd690b3a38df7eab23d0d6f6b5fa4394f4b7。零房間切換，PID116191→119055，current releases/ff1d00b，service／tunnel active。schema15與21表schema保持，20非session表既有rows/BLOB與8帳戶全欄位一致，integrity ok／FK0；session169→173為驗收登入，不宣稱逐列不變。公開5份HTML＋8份shared資源精確內容、MIME、no-store、版號及三個自有member的room ACL通過，驗收房刪除、自己的sessions登出。背景Chrome既有ccc登入的設定顯示版本v1.8.3，只讀設定，沒有改身份、登出或調偏好。備份 pre-media-emoji-polish-fixes-ff1d00b-20261007T052008Z-13647c70-8cf5-4d7e-891c-a52cd1a05580，online SQLite備份＋分開檔案封存，非原子冷備份；副本啟動與資料保存已驗。

| 使用者需求 | 實作／驗證 | 狀態 |
| --- | --- | --- |
| 兩個播放圖示應區分 | 全桌保留三角play，本機用playLocal螢幕＋三角、名稱「在自己的裝置播放」；受阻提示跟著名稱更新。兩組中文aria、控制權限保留。 | source／focused／native完成 |
| 控制按鈕同一列 | 同一mediaControlRow包含全桌、個人、清單入口；用輕直線分組，影片高度只扣整列一次。900px窗所有可見按鈕top784.796875一致、44px控制；音量120px。390px自然換行，row scrollWidth/clientWidth同為352，音量仍120px。 | source／native完成 |
| 表情捲軸往下卡住 | 共用UIPopover忽略自己及內部scroll；重新定位不暫時放大maxHeight，保留scrollTop、外部anchor更新及取消清理。模型修前400→116、修後保持400。 | 回歸／native完成 |
| 角色表情卡去文字 | 保留原IMG與payload，移除可見span；64×64卡、54×54圖，六張textContent皆空；data-ui-hint接共用hover/focus、中文aria/title。200%為88×88方形。 | source／native完成 |

共用hint透過data-ui-hint支援圖片卡，沒有套44px icon-button幾何或替換圖片；新增子IMG hover、focus、Escape與移除清理回歸。media focused60/60；popover／emoji／shared hint等focused32/32（涵蓋root新case），不能當成另一套完整測試加總。

## 實際背景Chrome

- 1280×720 popup 355.2×383，clientHeight381、scrollHeight447。wheel後scrollTop66保留；實際拖scrollbar向上為0、向下為66且選單仍開著，後續hover也保持66。以更新後狀態記結果，沒有把wheel立即返回的第一讀值当最終結果。
- hover顯示「送出『開心』表情」的共用top-layer提示；選取後實際收到「已送出『開心』表情」，picker隱藏、focus回emoji入口。圖片與既有角色資產未更動。
- Native尺寸、ARIA與卡片已觀察；沒有真人讀屏或實體手機測試。捲动與role卡優先在畫猜入口驗，其他遊戲共用相同source；不宣稱五款所有phase均實玩。
- 字體与raw viewport已還原，自己的Chrome tab已關、隔離fixture正常stop。截圖在ignored work/media-emoji-polish-controls.png（已重擷取確認可見）與work/media-emoji-polish-expressions.png，不提交帳密或原封包。
- 導覽期間捕捉到兩筆async message-channel error，沒有stack可歸因；本輪操作通過，未冒稱console全部無錯。

## 美化研究

指定文章的可採用工作法與桌機優先修改表已另存 [DES13評估](research/UI-POLISH-DES13-ASSESSMENT.md)。文章評分、工具價格與行銷趨勢不作實作指令。研究提案沒有整批套用，優先字級、對齊、表面層次，再比較少量動效。

## 發行

正式v1.8.3；不移動已發v1.8.2 tag，本批沒有新PR／push，後續純文件不移動既有tag。

最後module截圖 work/media-emoji-polish-player-detail.png 已實際開啟圖片確認，完整single-row控制與playLocal圖意可見。背景tab、font／viewport與隔離fixture全部已清理；正式讀設定後再比資料，8帳戶與20非session表仍一致。
