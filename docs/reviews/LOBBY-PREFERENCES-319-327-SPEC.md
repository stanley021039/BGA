# #319／#327 第一回合：規格符合性

2026-11-05，Codex 直接讀分支差異、需求、呼叫端與測試，與第二回合分開進行。

- Base／merge-base：`3f21bc48a60013e42e1211a407bb7ec37dc7cc03`。
- 受審／整合驗證 head：`12f4b5fffb01212bf93792c4f28ea53bc4e1bf31`；範圍為 base..head 單一產品提交。
- 需求：Issue #319 四項驗收、#327 三項驗收及使用者「兩票一起 PR」；參考 [背景契約](../specs/LOBBY-BACKGROUND-VISIBILITY-319.md)、[導覽契約](../specs/CREDITS-NAVIGATION-327.md)。

## 規格對照

| 驗收 | 結論與直接證據 |
| --- | --- |
| #319 共用背景一致 | 符合。伺服器選擇、解鎖與冷卻完全未改；兩個真帳號讀取同一背景。 |
| #319 個人可關閉／重開 | 符合。原 GamePreferences 中的 LobbyBackgroundPicker 加 UiCheckbox，LobbyBackdrop 同時移除動畫元件與靜態圖；角色及控制仍掛載。 |
| #319 不改共用設定或其他玩家 | 符合。visible 與 selected 分開，setVisible 只讀寫本機儲存；真雙帳號驗證 A 隱藏、B 不變，個人切換無共用背景 POST，伺服器 ID／冷卻不變。 |
| #319 重整／重入保存 | 符合。建立 store 即讀取本機偏好；真重載與離開再進入保持關閉。受限儲存以單元回歸及明確提示降級，不宣稱能強制保存或跨裝置同步。 |
| #327 共用導覽及桌機／手機深淺色 | 符合。SiteHeader 原題庫選單改為導覽選單並加 /credits；保留三個題庫網址及 main 抽卡入口。1920／390 深淺色與鍵盤／觸控八組通過。 |
| #327 主要操作與選單可用 | 符合。移除右下獨立連結及失效定位，原選單定位／Tab／Enter／Space／Shift+Tab／Escape 返焦及點外關閉保持；畫面無水平溢出、連結在視窗內且觸控高度至少 44px。 |
| #327 原內容與網址 | 符合。授權 Vue／HTML 與 base 無差異，/credits 回 200；六區塊及返回大廳連結保留，八組 DOM 雜湊一致。沒有替原獨立授權頁新增頁首。 |

範圍相符：只移植舊 #327 候選的入口修改，不納入未合併 arena；保留 main 的新招式、抽卡與右上 KDA。兩票只升一次 minor 3.18.0，package／lock／CHANGELOG 一致。沒有後端、資料遷移、新媒體或預算提升。

## 驗證與限制

審查階段新執行整合 build（含型別與模組邊界）、前端全套 273、UI ratchet、minor release、媒體 build 預算、格式及秘密模式檢查；本機 Edge 以同一 build 跑 #327 八組、#319 四組雙帳號與冷載／reduce，共用背景變更期間的個人選擇不被覆寫，pageerror 0。完整 affected 與最終 SHA 依 [整合紀錄](../LOBBY-PREFERENCES-319-327-PROGRESS.md)；不能以前兩個獨立分支的通過數取代本次整合結果。

本次已檢查範圍未發現問題，沒有待修規格 finding。觸控是 Edge 模擬，實體手機、Safari、GPU FPS、正式主機編碼未驗；Linux CI 尚未啟動。發布前如只追加審查／狀態文件，核對產品／測試樹相同並在 PR 描述記錄最終 head 才保留本結論；有產品變動則複查。
