# 共用 UI 元件與 token

2026-10-23 起全站只有一種外觀：Stitch，依 Figma 第三份「BGA｜03 Stitch 最終設計・共用元件」頁面「00｜共用元件」（C07 基礎元件 node `1919:18254`、C07 共用元件區 `1117:2`、C05 主要按鈕 `1189:659`）。Vue 頁面（`frontend/src/pages/`）只用本頁列出的元件與 `--stitch-*` token；`npm run ui:check` 在 CI 擋下新增的原始色碼、頁面原生控制項與舊 token。

## 快速對照

| 需要 | 用 | 不要 |
| --- | --- | --- |
| 按鈕、圖示按鈕 | `UiButton` | `<button>`、`.ui-button` 手寫 class |
| 看起來像按鈕的連結 | `UiLink` | `<a class="button">` |
| 彈窗、確認 | `UiDialog`、`ConfirmDialog` | 自製 `<dialog>`、`GameUI.openDialog` |
| 框線區塊、卡片 | `UiPanel` | `border: 1px solid var(--stitch-line)` 再寫一次 |
| 文字輸入、下拉選單、多行 | `UiField` | `<label><input>`、`<select>`、`<textarea>` |
| 勾選 | `UiCheckbox` | `<input type="checkbox">` |
| 上傳檔案 | `UiFilePick` | `<input type="file">` |
| 分頁 | `UiTabs` | 自製 `role="tab"` |
| 按鈕旁的選單、面板 | `UiPopover` | 自製浮動 `<div>` |
| 圖示 | `UiIcon` | 內嵌 SVG、emoji 當圖示 |

元件都在 `frontend/src/components/`。缺元件或缺變體時擴充這些元件並更新本頁，不在頁面另做一份。

## 元件

### UiButton

```vue
<UiButton variant="primary" icon="check" label="儲存設定" :pending="saving" type="submit" />
<UiButton icon="close" icon-only label="關閉題庫" />
<UiButton variant="danger" icon="leave" label="離開房間" @click="leave" />
```

- `variant`：`primary`（一個區塊最多一個主要操作）、`secondary`（預設）、`ghost`（行內低強調）、`danger`（刪除、離開等破壞性操作）、`success`、`contrast`。選取狀態用 `aria-pressed`／`aria-selected`，自動換成選取色。
- `label` 是可及名稱；`caption` 可給較短的可見文字；`icon-only` 時 `label` 會成為 tooltip 與 aria-label，手機可用 `caption` 顯示文字。
- `pending` 會停用按鈕並標 `aria-busy`；不要另外再管理同一顆按鈕的 disabled。
- 規格（立體按鈕，Figma 03 C05／C07-R2，2026-10-23 使用者選定）：高 `--stitch-control-height`（44px）、2px `--stitch-frame` 深色邊、圓角 `--stitch-radius-button`（12px）、字 14px／700、內距 8／12px、圖示 20px。次要按鈕底色 `--stitch-surface-subtle`；主要按鈕 `--stitch-primary` 加硬陰影 `--stitch-shadow-raised-sm`（按下時陰影消失）；危險按鈕紅底紅邊；ghost 無底無邊。icon-only 為 44×44 圓形（`--stitch-radius-pill`）。停用為 `--stitch-disabled-*` 灰底灰邊、無陰影；送出中維持原色並半透明。焦點 `--stitch-focus-ring`。
- 頁面只能決定按鈕尺寸與位置；圓角、邊框寬度與顏色在 `controls.scss` 鎖定，頁面的 `--ui-button-radius` 等覆寫對共用按鈕無效。唯一的換色入口是 `--stitch-button-bg`／`-color`／`-border-color`，只給使用者可選的播放器外觀主題使用。
- 面板、輸入欄維持細邊（1px `--stitch-line`），立體只用在按鈕與 `UiPanel tone="raised"` 的重點卡片。

### UiLink

```vue
<UiLink href="/collection" icon="book" label="前往收藏庫" />
```

與 `UiButton` 同外觀與 `variant`，用於換頁。內文中的一般文字連結直接用 `<a>`，顏色 `--stitch-link`。

### UiDialog／ConfirmDialog

```vue
<UiDialog ref="dialog" title="邀請朋友" compact @closed="reset">…</UiDialog>
<ConfirmDialog ref="confirm" />  <!-- await confirm.value.ask('確定刪除？') -->
```

原生 `showModal()`，Escape 與關閉鈕返焦觸發元素；`dismissible=false` 時不可關閉（例如送出中）。`compact` 為 28rem 寬。外觀（2026-10-23 選定，同 C07-R2 加入房間）：白底、2px 深色邊、圓角 16px、硬陰影 `--stitch-shadow-raised`、內距 16px、標題 20px／700；底部按鈕列間距 `--stitch-gap-controls`。`UiPopover` 浮動選單同一套立體外觀。

### UiPanel

```vue
<UiPanel title="我的暱稱" note="1–16 字">…</UiPanel>
<UiPanel title="房間標記" description="挑選五個常用標記…" density="compact">
  <template #actions><UiButton label="全部恢復預設" @click="reset" /></template>
  …
</UiPanel>
<UiPanel tone="raised" as="article">…</UiPanel>
```

- `title` 自動成為 `aria-labelledby`；`description` 在標題下、`note` 在標題右側；`#actions` 放標題列右側的按鈕或連結。
- `tone`：`surface`（預設白底）、`subtle`（次要底色）、`selected`（選取）、`raised`（Stitch 立體卡：2px 深色邊、圓角 16px、硬陰影）。
- `density`：`regular`（預設，內距 24px、內部間距 20px）用於頁面主要內容；`compact`（內距 16px、間距 12px）只用於側欄、遊戲中資訊欄等密集區。面板之間 `--stitch-gap-section`（24px）。
- 頁面只給 class 排版（grid 區域、最小高度）；框線、底色、圓角、內距不要再寫。

### UiField

```vue
<UiField v-model="nickname" label="顯示暱稱" maxlength="32" required />
<UiField v-model="source" control="select" label="來源" :options="[{ value: 'all', label: '全部' }]" />
<UiField v-model="expression" control="select" label="預設表情"><option …>…</option></UiField>
<UiField v-model="note" control="textarea" label="說明" hint="最多 200 字" :error="noteError" />
<UiField v-model.number="count" type="number" label="回合數" />
```

- `control`：`input`（預設，`type` 照原生）、`select`（下拉選單）、`textarea`。下拉選項可用 `options` 或預設 slot 放 `<option>`／`<optgroup>`。
- `class`／`style` 給外層 label；其他屬性（`id`、`name`、`disabled`、`aria-*`、`maxlength`…）給控制項。`hint` 與 `error` 會自動接到 `aria-describedby`，`error` 時標 `aria-invalid`。
- 唯讀顯示用 `:model-value="…" readonly`，不要用 `:value`。
- 規格：label 與控制項間距 8px、14px／400；控制項高至少 44px、內距 12／16px、1px `--stitch-line` 邊、圓角 8px、白底；停用／唯讀為次要底色與灰字；錯誤為危險底色與邊；焦點 `--stitch-focus-ring`。

**下拉選單（dropdown）**：表單裡的選擇一律用 `UiField control="select"`（原生 select，保留鍵盤與讀屏行為，只統一外觀與箭頭）。需要圖片、搜尋或多欄的選擇器用按鈕開 `UiPopover` 或 `UiDialog`，列表項高 44px、內距 8／12px、間距 4px，選取用 `--stitch-selected-*`。

### UiCheckbox

```vue
<UiCheckbox v-model="shared" label="分享給會員（未勾選則私人）" />
<UiCheckbox :model-value="isOn" label="常用" @update:model-value="toggle" />
```

框 16px、與文字間距 8px、勾選色 `--stitch-primary`、整列至少 44px 高可點。

### UiFilePick

```vue
<UiFilePick label="上傳頭像" accept="image/png,image/webp" :current="avatarName" @change="upload" />
```

原生 file input 透明覆蓋整列，顯示目前使用中的檔名；外觀同 `UiField`。

### UiTabs、UiPopover、UiIcon

```vue
<UiTabs v-model="tab" :items="tabs" label="收藏分類" panel-prefix="collection-panel" />
<UiPopover :id="id" ref="popover" title="自訂畫筆顏色" @closed="done">…</UiPopover>
<UiIcon name="save" />
```

`UiTabs` 有方向鍵／Home／End 與 `aria-controls`；外觀為底線式（Figma C07 收藏分頁）：列底 1px 線、分頁間距 24px、文字 14px，選取分頁 700 字重加 2px `--stitch-primary` 底線，高 44px。頁面只排分頁列的位置與欄數。`UiPopover` 依按鈕位置在上方或下方開啟、限制在視窗內並在關閉時返焦。`UiIcon` 只接受登錄名稱（見 `UiIcon.vue`），24 viewBox、1.8 stroke、`currentColor`；新增圖示加到登錄表。

## Token（`frontend/src/styles/stitch-tokens.scss`）

只用 CSS 變數；不寫 hex、不用 SCSS `tokens.space()`／`space()`／`font()`、`--play-*`、`--ui-*`。深色模式由同名變數切換，元件不需另寫。

| 類別 | Token | 值／用途 |
| --- | --- | --- |
| 顏色 | `--stitch-base`、`-surface`、`-surface-subtle`、`-surface-hover` | 頁面底、卡片、次要底、hover |
| | `--stitch-ink`、`-muted`、`-link`、`-focus` | 主要字、次要字、連結、焦點 |
| | `--stitch-line`、`-frame` | 細邊線、深色框（按鈕、立體卡） |
| | `--stitch-primary`、`-primary-hover`、`-primary-active`、`-on-primary` | 主要按鈕與強調 |
| | `--stitch-selected-bg`、`-selected-ink`、`-selected-muted` | 選取狀態 |
| | `--stitch-success-*`、`--stitch-danger-*`、`--stitch-contrast*` | 成功、危險、反白（各有 `-bg`／`-ink`／`-line`／`-hover`） |
| | `--stitch-disabled-bg`、`-line`、`-ink` | 停用的按鈕 |
| 間距 | `--stitch-space-2/4/8/12/16/20/24/32/40/48` | 0.125–3rem |
| 語意間距 | `--stitch-gap-label` 8 | label 與欄位、圖示與文字 |
| | `--stitch-gap-inline` 8 | 同一列緊密的小元素（徽章、標籤） |
| | `--stitch-gap-controls` 16 | 同一列的按鈕／欄位 |
| | `--stitch-gap-fields` 20 | 表單欄位之間 |
| | `--stitch-gap-panel` 20 | 面板內各區塊 |
| | `--stitch-gap-section` 24 | 面板與面板之間 |
| | `--stitch-page-gutter` 32／`-mobile` 16 | 頁面左右留白 |
| 圓角 | `--stitch-radius-badge` 4 | 徽章、小標籤 |
| | `--stitch-radius-control` 8 | 輸入、下拉 |
| | `--stitch-radius-button` 12 | 文字按鈕（立體） |
| | `--stitch-radius-panel` 12 | 面板、彈窗、選單 |
| | `--stitch-radius-card` 16 | 立體卡（`UiPanel tone="raised"`） |
| | `--stitch-radius-pill` | 膠囊、圓形頭像、開關 |
| 邊框 | `--stitch-border`（1px line）、`--stitch-border-strong`（2px frame） | 一般／立體卡 |
| 陰影 | 預設無陰影；`--stitch-shadow-raised`（0 4px 0）、`-raised-sm`（0 2px 0）、`-overlay` | 立體卡、彈出層 |
| 焦點 | `--stitch-focus-ring`（3px）、`--stitch-focus-offset`（2px） | 所有可互動元素 |
| 控制項 | `--stitch-control-height` 44、`--stitch-control-padding-*` 8／12、`--stitch-field-padding-*` 12／16、`--stitch-checkbox-size` 16 | 按鈕、欄位 |
| 選單 | `--stitch-menu-padding` 8、`--stitch-menu-item-padding` 8／12、`--stitch-menu-gap` 4 | 下拉、Popover 列表 |
| 字級 | `--stitch-text-page` 24、`-section` 18、`-body` 14、`-hint` 12；`--stitch-font-12…32` | 頁標題、區塊標題、內文／label、輔助 |
| 字重 | `--stitch-weight-title` 700、`-button` 700、`-body` 400 | |
| 行高 | `--stitch-line-height-body` 1.5、`-heading` 1.25 | |
| 動態 | `--stitch-transition` 0.15s | hover／選取；`prefers-reduced-motion` 時關閉 |

## 版面規則

- 同列面板對齊上下緣；相鄰區塊的邊線、欄寬、列間距與框內留白一致，用 Grid／Flex 與語意間距 token，不逐頁零散位移。
- 動態區塊預留寬高；狀態文字、倒數、非同步載入、按鈕顯隱或捲軸不應造成反覆縮放與位移。
- 長內容在既定區域換行或局部捲動；窄螢幕可換列。不得裁切必要資訊或隱藏決策資訊。
- 混合標題、標籤、數字與按鈕的橫列用 `align-items: center`；控制項維持 44px 以上。
- 操作按鈕可 icon-only，但保留中文可讀名稱、鍵盤焦點與觸控可理解的說明，不能只有 hover 或原生 title。

## 防倒退檢查（`npm run ui:check`）

`tools/ui-check.cjs` 以 `.ui-baseline.json` 記錄每個檔案現有的舊寫法數量，CI 失敗條件：

| 規則 | 範圍 | 擋下 |
| --- | --- | --- |
| `hex` | `frontend/src` 的 `.vue`／`.scss`／`.css`（token 定義檔除外） | 原始 `#rgb`／`#rrggbb` 色碼 |
| `raw-control` | `frontend/src/pages/**/*.vue` | `<button>`、`<input>`、`<select>`、`<textarea>` |
| `old-token` | `frontend/src` 的 `.vue`／`.scss` | `tokens.space()` 等 SCSS 函式、`var(--play-*)`、`var(--ui-*)` |

- 只擋增加：某檔案的數量超過基準就失敗；清掉舊寫法不會失敗（2026-10-23 決定，減少平行 PR 衝突）。方便時執行 `npm run ui:baseline` 把基準降到目前數量並提交。
- 基準只能由 `npm run ui:baseline` 降低，不得手改調高；PR 審查時 `.ui-baseline.json` 的差異只能是減少。
- 真的需要例外（例如第三方品牌色、遊戲牌面語意色），在該行或上一行寫 `ui-check-allow <規則>: <理由>`。
- 合併 main 遇到 `.ui-baseline.json` 衝突：任取一邊，再執行 `npm run ui:baseline`。

## 舊頁（`public/`）與 GameUI

`public/` 的舊頁仍使用 `public/shared/ui-primitives.css`、`ui-foundation.css` 與 `window.GameUI`（`icon`、`decorateButton`、`setBusy`、`setStatus`、`openDialog`、`bindPopover`）。這一層只維護、不擴充：新功能寫在 Vue 頁面。修改舊頁時沿用 [舊頁 GameUI 合約](UI-GAMEUI-LEGACY.md) 與 [共用對齊規格](specs/SHARED-UI-ALIGNMENT.md)。
