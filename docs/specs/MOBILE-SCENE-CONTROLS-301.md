# 手機場景操作（#301）

2026-10-27 使用者澄清並同意：本票處理手機正常使用角色攻擊特效、瞬移等場景操作，不是手機加入遊戲或第二裝置配對。

## 範圍與驗收

- 大廳、休憩區與所有既有共用房間場景使用同一組觸控控制。重用 Stitch UiButton／UiPanel，不新增視覺系統或媒體資源。
- 手機／觸控裝置提供可收合的角色操作列：兩組目前 Q／E 配裝、隨機瞬移、四向移動。空白處點擊移動與點本人開表情維持既有行為。
- Q／E 依既有兩秒獨立冷卻，瞬移在前端節流一秒（房間伺服器亦限制一秒；大廳沿用既有服務端限流）；伺服器仍是授權、目標、傷害及冷卻的唯一依據。請求期間禁止同一操作重送，失敗可以重試並呈現原因。
- 操作不穿透成背景移動；聊天輸入、彈窗、手機側欄及隱藏分頁期間停用／隱藏。收合後可恢復；不遮擋既有遊戲主要操作，支援安全區與直橫向。
- 不改桌遊分數、玩法或攻擊效果素材；保留桌機快捷鍵。手機場景操作與鍵盤共用動作入口。
- 驗收包含雙玩家攻擊同步、Q／E 不同配裝、冷卻／連點、瞬移、四向、無目標／斷線、收合、抽屜／彈窗／輸入、換房、桌機／手機與動態關閉。

## 實作

候選版 3.11.0，分支 `codex/mobile-scene-controls-301`，基底 `0894cff2808b0fa840a20e01ab022c39b110e657`（包含 #304 邀請音效）。

- `MobileSceneControls.vue`／`mobile-scene-controls.scss`：≤1180px 或 `any-pointer: coarse` 提供預設收合的入口，UiPanel／UiButton 沿用共用 Stitch 外觀。兩種攻擊配裝顯示名稱；按鈕與下方冷卻欄各有固定槽位，避免冷卻文字讓操作位置改變。安全區、短橫向局部捲動、Esc／收合、輸入／dialog／popover／抽屜隱藏及卸載清理。
- `scene-controls.ts`：鍵盤和觸控共用 Q／E／R 鎖、獨立冷卻、伺服器攻擊時間同步；四向共用200ms節流、倒地停用。換房失效舊回應，隱藏時停止冷卻timer，恢復時計算剩餘時間，不重播動作。
- `LobbyBackdrop` 和 `RoomBackground`：重用既有大廳／房間 API 及 `LobbyAttackLayer`，包含休憩區。房間場景請求補十秒逾時及卸載abort；抽屜的inert仍傳給實際背景DOM。桌機保留原快捷鍵，觀戰不新增操作。
- 實際瀏覽器找到原有房間操作失敗：`useRoomStore.request` 無條件加入 `gameType`／`gameRevision`，而 `room-space` 伺服器拒絕這些額外欄位。針對跨遊戲共用的 `room-space` 省略這兩欄，保持遊戲指令的版本防護；未放寬伺服器白名單。回歸由真 store 產生 payload，交給實際 `createRoomSpace` 驗證移動、step、瞬移及護盾攻擊。
- 無新圖片／音檔／動畫播放器，沿用原壓縮、cache、動態偏好與並行預算。

## 驗證

- `npm run test:affected`：因共用元件等路徑保守回退全部246個後端測試檔，2094 pass，0 fail/cancel/skip（403175.618ms），`/tmp/bga-301-affected.log`。後續僅修前端傳輸與呈現，未更改後端；最終 `--list` 仍選全部246檔，`/tmp/bga-301-affected-final-plan.log`。
- 修正傳輸後前端全套232 pass，0 fail/cancel/skip（121104.115ms），`/tmp/bga-301-frontend-final.log`；之後冷卻文字移入固定槽，另以最終 build 的真瀏覽器驗收位置穩定。
- focused 12 pass（包含6項新控制生命週期／鎖／冷卻，以及含新傳輸回歸的房間切換測試），`/tmp/bga-301-focused.log`。
- 最終型別／Vite建置、UI、效能正式build預算及相對基底minor release check通過，`/tmp/bga-301-build-final.log`、`/tmp/bga-301-ui-final.log`、`/tmp/bga-301-perf-final.log`、`/tmp/bga-301-release-final.log`。格式以交付前最後一次紀錄為準。
- 瀏覽器固定最終build：大廳＋13款遊戲＋休憩區，兩個獨立登入玩家，390×844觸控 Q／E 遠端特效、冷卻、無事件穿透、移動／瞬移、收合／側欄皆通過；撲克另驗844×390深色、dialog及輸入焦點隱藏。矩陣 `work/issue-301/report.json`、`/tmp/bga-301-browser-final.log`，14種房間均有PASS；原附加情境返回數分鐘未活動的舊房間時座位已到期而逾時，後改用新房間的獨立focused驗收（不是產品修正），不把原整支script記為全綠。
- 最終build額外focused瀏覽器退出0：自訂Q=光線／E=能量彈且遠端效果一致；攔住真HTTP期間連點只送一次、pending／冷卻面板等高；撲克進行中場景操作前後version／phase／turn／pot／hand不變；桌機R成功且無手機操作列；背景檢視中點自己開選單並送出真角色動作；真fetch中斷後解鎖重試、伺服器NO_ATTACK_TARGET可讀；320×568深色／減少動態不溢出。`work/issue-301/report-focused.json`、`/tmp/bga-301-browser-focused.log`，兩份report的pageerror皆空。截圖包含各房間手機版、`poker-landscape-dark.png`、`poker-320-dark-retry.png`及1920×1080桌機。
- `npm run format`／`format:check`：1027檔，0失敗；交付紀錄追加後再執行最後一次格式與diff檢查。

工具與資料在ignore的 `work/issue-301/`，兩個獨立登入玩家、臨時SQLite、自建合成帳號，沒有操作正式資料。初期觸控截圖使 coarse 判定變動，已加入窄螢幕判定；初期房間請求400已由上述傳輸修正；另一批在建置更換dist期間因舊fixture引用已刪雜湊檔失敗，改為固定build重跑，這些失敗不作通過證據。

## 交付狀態

本機實作與代理瀏覽器驗收完成。2026-10-27 使用者明確要求「幫我pr」，授權本次PR #309；依AGENTS直接提PR流程進入兩輪審查及最終head CI。兩個獨立回合已對相同base 0894cff2／實作head 52280a72完成，未發現待修finding；詳細證據在PR的規格／品質審查留言。此後只更新授權與交付文件，產品與測試樹保持相同；最終head、CI、Ready與合併結果以PR為準，未部署。

實體 iPhone Safari／Android Chrome 尚未驗證；瀏覽器觸控模擬不得當成實機證據。此限制已列入PR，不將代理模擬寫成使用者實機驗收。
