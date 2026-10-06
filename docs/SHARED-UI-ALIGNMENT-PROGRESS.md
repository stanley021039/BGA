# 共用元件對齊修正進度

2026-10-07，依使用者「題卡問號置中、同類问题全專案檢查、與程式設計師討論並保存」要求。候選 patch 版本 v1.5.3；上一正式版 v1.5.2。

| 範圍 | 實作與證據 | 狀態 |
| --- | --- | --- |
| 畫猜非畫者選題背面 | 移除背面承接正面 space-between 的分佈；使用共用 ui-center-content、ui-symbol 與同風格 unknown SVG。原三張卡內容往上偏 38.5px，修正後桌機及390px手機三卡 dx／dy 均0。畫者正面仍 space-between、保留題材、題目與選題按鈕。 | 背景 Chrome 通過 |
| 全站基礎元件 | 新增 ui-primitives.css，20份HTML共用載入；GameUI新增symbol，非遊戲頁也共用相同registry／button／pending契約。從foundation移除重複定義；主題／字級／版面仍留原tokens。 | 來源及20入口通過 |
| 關閉圖示與外邊距污染 | 全站settings close用44px操作槽與共用close SVG；history的全域 header span margin-left:auto使圖示computed左邊距18px、中心偏右9px。共用symbol／icon／label重設内部margin／padding，外部間距由parent gap管理。20入口close均44×44、dx／dy0、可開啟及關閉。 | 背景 Chrome 通過 |
| 資訊徽章 | 撲克D使用共用symbol，保留21×21資訊尺寸；實際正常加入牌桌後文字Range dx0／dy−0.5px。沒有把被動徽章強制放大至44px。 | 背景 Chrome 通過 |
| 放大與狀態 | 200%文字（root32px）close為88×88、dx／dy0，中心及四個四分之一角命中正確。四種primitive的hidden均display:none、零rect；pending禁用與aria-busy、解除後disabled恢復已驗。測試節點、字體及tab viewport已移除／還原。 | 背景 Chrome 通過 |
| 程式回歸 | Windows Node24.14.0全套863/863（29158.0331ms），失敗／取消／跳過0，patch版號檢查通過。 | Linux及正式部署待驗 |

程式設計師盤點20HTML／23CSS／46JS，區分確認缺口、保留與待驗，並完成提案→質疑→決策的實際討論紀錄：[元件規格與逐頁表](specs/SHARED-UI-ALIGNMENT.md)。有意分佈的資訊卡、文字段落、角色圖片、素材、emoji及場景SVG不做一律置中；送禮fallback沒有相同space-between缺陷。

20份HTML來源均檢查；背景測試20個頁面入口的共用資源、關閉圖示與開關。`/rules`會進入race教學頁，因此這個數字不表示20種所有玩法全面實玩。實際手機題卡390×844及畫者1280×720已驗；其他平台字型／Safari、所有emoji的光學外形、studio較小工具命中區及壞素材流程仍未全面驗。背景畫面與量測存在本機私人驗收位置，不保存帳密或房號於此文件。
