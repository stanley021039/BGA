# UI 基礎元件合約

依 [桌機設計規格](DESKTOP-DESIGN-SPEC.md) 實作；不新增 UI framework。遊戲 `body` 設 `data-game-kind="gift|draw|race|majority|poker"`，最後載入 `/shared/ui-foundation.css`，在 game-shell 前載入 `/shared/ui-components.js`。非遊戲頁不套桌機樣式，舊呼叫端使用 `window.GameUI?.method()` 安全 fallback。

## Tokens

| Token | 用途／預設 |
| --- | --- |
| `--ui-text-small/body/section/page/stat` | 14／16／20／28／32px 对應 rem；次要／正文操作／區塊／頁題／主要數據 |
| `--ui-space-1` … `--ui-space-7` | 4／8／12／16／24／32／48px 對應 rem |
| `--ui-control-height` | 常規控制最低 2.75rem（44px） |
| `--ui-icon-size` | 1.5rem（24px）；角色／emoji／禮物／車輛屬內容素材 |
| `--ui-font-family` | system-ui、Noto Sans TC、Microsoft JhengHei、sans-serif |
| `--ui-text/muted/surface/border/accent/focus/error/success` | 語意色，room-light 為亮主題；音樂／host dialog 各有自身顏色 |
| `--ui-sidebar-height` | 遊戲按舞台頂點定義可用桌機高度；只名單／低頻區域局部捲動 |

16／14px 是 BGA 專案決策，WCAG 沒有固定最小 px。正常桌機 header min-height56、auto height、可換行 nav。GameUI 偵測 root font >20px 加 `ui-large-text`，解除固定側欄高度並重排单欄，以支援只有文字放大、viewport 尚未變動。

## GameUI API

```js
GameUI.icon('save');
GameUI.decorateButton(button, 'save', { label: '收藏' });
GameUI.decorateButton(button, 'close', { iconOnly: true, label: '關閉題庫' });
GameUI.setBusy(button, true);
GameUI.setBusy(button, false);
GameUI.setStatus(status, '傳送失敗，請重試', { kind: 'error' });
GameUI.openDialog(dialog, trigger);
```

`decorateButton` 適用簡單 button／link／summary，會置換子節點，不用在內含表單或複雜事件子節點的容器。保留按鈕本身 listener；SVG aria-hidden，icon-only 有 aria-label／title，短 label 應包含於可及名稱。Registry：emoji、close、send、leave、settings、book、save、check、lock、next、replay、sound、muted、play、pause、help、users、chevron、undo、refresh。全部 24 viewBox／1.8 stroke／round／currentColor；未知名稱回空字串。StrokeCanvas 畫具及演算法維持原樣。

`setBusy` 保留 caption 與尺寸、保存並恢復原 disabled；pending 子節點只 opacity0，保留 accessible name。進入 pending 前保存 computed 文字顏色為 `--ui-spinner-color`，spinner 沿用按鈕原可讀文字色，結束時移除此 property；沒有 computed style 時才 fallback 到 ui-accent。亮主題綠底按鈕的白色 spinner 對比約9.271:1。遊戲自行管理 request／防重複，避免兩套管理同一 button disabled。清除成功 draft 由 caller 決定；失敗保留。

`setStatus` 有固定最少一行、role=status／polite／atomic，相同文字不重寫；kind 为 info／success／error。文字＋標記表達狀態，不只靠顏色。正文验收4.5:1，必要圖示／焦點／選中提示3:1。每秒倒數、彈幕動畫不反覆播報。`openDialog` 補標題名稱、保存 trigger，採原生 showModal 與 close 返焦，不自製 focus trap。若 trigger 位於已收合的 details 中，返焦至可見的祖先 summary；巢狀 details 逐層尋找。題庫 dialog 由 GameUI 單獨負責返焦，未載入 helper 時才使用 shell fallback，避免兩個 close listener 互相覆蓋。

## Action slot 與 InteractionDock

各遊戲提供常駐 `.game-action-slot[data-game-action-slot]` 於右 sidebar 上方，renderer 只更新其內容；button 可以 form 屬性提交原舞台表單。GameShell 不搬 runtime button，不把 dock 掛進玩家 details。共用 ID：`shared-barrage`、`shared-error`、`shared-emote-toggle`、`shared-emoji-picker`、`shared-expressions`。

順序為主操作、常駐紀錄、文字＋emoji、固定 status、角色／離房／管理／音樂 row；重要玩家卡另在全寬舞台下方呈現。utility 控制常規44高、布局內單列，音樂入口44×44，不能固定覆蓋玩家分數；窄螢幕／文字放大可換行捲頁，不能裁切或覆蓋 submit。角色仍 kind:expression，emoji 仍 kind:emoji；focus／loading 改善不修改規則或 API 語意。

## 本批進度與證據（2026-10-04）

- 共用 foundation／helper／slot／PlayerRow／dialog／pending 已實作。語法檢查與 room-components／app／emoji-barrage targeted 共5 tests通過。
- 隔離背景 headless 已實際檢查 pending、失敗保 draft、成功清除、emoji第一項焦點及選取／Escape返焦、題庫名稱／Escape返焦、6角色選項14px。記錄 `work/desktop-common-check.json`。
- `work/agent-common-geometry.json`：1280×720 header56、input44/16px、status21/14px、utility44；200%文字 input88/32px、单欄；640×360等效重排可用；三者無橫向溢出。
- 各遊戲完整流程、正式站實玩與整合測試见 [設計進度](DESKTOP-DESIGN-PROGRESS.md)。此批檢查不代表整站WCAG合格。
- 題庫返焦回歸：頁首「遊戲題庫」details 開啟 `/gifts` 後，選單因 focusout 收合；Escape 與關閉按鈕皆應回到可見 summary，而不是嘗試聚焦隱藏連結。背景驗證記錄 `work/agent-dialog-focus-check.json`。

背景測試使用隔離開發 cookies／資料庫，無正式帳密，不影響使用者前景。work證據被Git忽略。

## 按鈕旁的偶爾使用選單

全頁在其他 UI scripts 前載入 `/shared/popovers.js`。重要遊玩資訊保持 inline；只有完整色盤、選用指令、角色／emoji 選擇與導覽等按需內容使用此 helper。

```js
GameUI.bindPopover(details, panel, { align: 'start', width: 360 });
UIPopover.bindDetails(details, panel, { align: 'end' });
UIPopover.bind(button, panel, { align: 'end', onClose: closeMenu });
```

`bindDetails` 以 details.open 同步；`bind` 預設以 panel.hidden 同步，caller 的 `onClose` 必須更新原本 open／hidden／aria-expanded。預設 placement=bottom、gap=8、padding=8，空間不足時 flip／shift／限制內部捲動；width 可為 px number 或 `trigger`。`inlineBelow` 可讓窄畫面保留文內 details，需由遊戲 CSS 定義 inline 狀態。可用原生 popover 時保留原 DOM 及 CSS 繼承，進入 top layer；不用把節點搬到 body。觸發元件 resize／隱藏、捲頁及動態 panel resize 會更新位置。

持續「已連線」不顯示，失敗／重試文字才顯示。頁首／牌桌房號使用系統字體及 lining／tabular 數字；牌面有語意的字體不受此規則覆寫。

`UIPopover.bindOverlay(panel, container)` 用於賽車／撲克結束演出，以舞台與 viewport 交集置中；交集過小則置中於 viewport，長內容內捲、確認控制保留。保留 translate 的進場動畫。動態 renderer 移除節點時清理 observers／frames，避免重複 binding。原生 dialog 開啟時共用 Escape handler 不攔截，dialog 的關閉及返焦優先。

賽道地形 tooltip 是純閱讀提示，`pointer-events:none`，不能攔截相鄰路格或車輛。pointerdown只收提示，原click正常處理；長內容在提示矩形範圍內支援wheel與PageUp／PageDown，Escape關閉。定位後以viewport剩餘高度限制內容，仍維持8px邊界。

雷霆擲骰使用 `/shared/race-dice-dialog.js` 的 `RaceDiceDialog.mount({onAction})`，以 `show(state)` 同步公開 `diceCheck`；`reset()`／`destroy()`清理動畫與返焦。dialog常駐顯示判定條件及參與車隊，只有owner能擲骰／確認，碰撞結果依server的rerollAllowed提供一次重擲。CSS與style只載入一次，原生top layer限制視窗內高度；四隊桌機精簡重複說明以完整顯示17顆骰與結果，窄屏局部捲動且操作44px。首次rolling遮蔽至少1000ms、同check輪詢保留焦點與起始時間，減少動態保留等待但不旋轉。此dialog屬必要遊戲步驟，Esc不能跳過；確認後遊戲儀表板接回焦點。詳見 [擲骰流程與驗收](RACE-DICE-INTERACTION.md)。

數字骰圖案共用 `RaceDiceDialog.faceMarkup(value)`，僅接受整數1–6，輸出不依賴字型的 SVG 白色骰面與深色點數。父元件負責提供完整點數／已用狀態的輔助名稱；SVG本身 aria-hidden。檢定骰面56px，移動選擇的48px按鈕內留7px邊距、骰面32px；外層卡片與骰面用不同底色，避免邊框黏在一起。角色圖案保持原表情來源，車隊跨兩列顯示64×80或寬螢幕72×90，其他重要資料常駐。

混合標題、標籤、數字與按鈕的橫列使用 `align-items:center`，包含共用 `game-toolbar`、雷霆標題與狀態組、畫猜統計／聊天標頭、同頻答案標頭。每個標籤／數值組也置中，保留各字級的正常行高；窄畫面允許換行，按每一行對齊。長提示保持可讀與完整，控制維持44px以上，不以隱藏重要資訊換取同一行排列。
