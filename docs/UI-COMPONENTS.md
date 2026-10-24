# 共用 UI 元件與 token

2026-10-23 起全站只有一種外觀：Stitch，依 Figma 第三份「BGA｜03 Stitch 最終設計・共用元件」頁面「00｜共用元件」（最新共用規範 R6 node `2179:11730`；Stitch source `e7a7b9d5e7de4aac884b16f2ed44fb0b`；未被 R6 取代的 C07／C05 專用元件仍沿用）。Vue 頁面（`frontend/src/pages/`）只用本頁列出的元件與 `--stitch-*` token；`npm run ui:check` 在 CI 擋下新增的原始色碼、頁面原生控制項與舊 token。

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
| 狀態標籤、計數 | `UiBadge` | 頁面手畫徽章外框 |
| 短暫回饋 | `UiNotice`、相容 `StatusSlot` | 永久留著成功／錯誤提示 |
| 圖片／偏好選擇卡 | `UiChoiceCard`、`ImageChoiceGrid` | 頁面另寫選取框 |
| 頁首、區塊標題 | `UiHeading` | 逐頁黃條與分隔線 |
| 交錯底色清單 | `UiList`、`UiListRow` | 每列重畫一張卡 |

元件都在 `frontend/src/components/`。缺元件或缺變體時擴充這些元件並更新本頁，不在頁面另做一份。

`ImageChoiceGrid` 依可用容器寬度自動換欄，預設最小欄寬 8.5rem；宿主可用幾何變數 `--stitch-choice-min-inline` 調整（設定頁 7rem），不要另鎖桌機／手機欄數而壓窄選擇卡。圖片、名稱與選取狀態的槽位仍由共用元件控制。

字體由 `frontend/src/runtime/mount-page.ts` 單一匯入 `frontend/src/styles/noto-sans-tc.css`：108 個 Google Fonts 官方 Noto Sans TC 可變 WOFF2 Unicode 分片放在 `frontend/src/assets/fonts/noto-sans-tc/`，隨 Vite 雜湊打包並自託管，不向 Google 字體服務發出執行期請求。字重範圍 100–900，共用正文使用 400、標題／按鈕使用 700。這是含繁中與拉丁字元的官方網頁子集，不代表全 Unicode CJK 覆蓋；缺字沿既有 sans-serif 字體堆疊回退。

授權為 SIL Open Font License 1.1，完整來源檔為 `frontend/src/assets/fonts/noto-sans-tc/OFL.txt`；CSS 同時包含完整 `/*! … */` 授權原文，建置成品須保留著作權及授權，不只複製字檔。


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
- 規格（立體按鈕，Figma 03 C05／C07-R2，2026-10-23 使用者選定）：高 `--stitch-control-height`（44px）、2px `--stitch-frame` 深色邊、圓角 `--stitch-radius-button`（12px）、字 14px／700、內距 8／12px、圖示 `--stitch-icon-size`（20px）。次要按鈕底色 `--stitch-surface` 加 2px 硬陰影；主要按鈕 `--stitch-primary` 加 3px 硬陰影 `--stitch-shadow-button-primary`（按下時陰影消失）；危險按鈕淡紅底、紅字、深色框及 2px 硬影；ghost 無底無邊。icon-only 為 44×44 圓形（`--stitch-radius-pill`）。停用為 `--stitch-disabled-*` 灰底灰邊、無陰影；送出中維持原色並半透明。焦點 `--stitch-focus-ring`。
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
- 規格：label 與控制項間距 8px、14px／400；控制項文字 16px、高至少 44px、內距 8／16px、1px `--stitch-line` 邊、圓角 8px、白底；停用／唯讀為次要底色與灰字；錯誤為危險底色與邊；焦點 `--stitch-focus-ring`。

**下拉選單（dropdown）**：表單裡的選擇一律用 `UiField control="select"`（原生 select，保留鍵盤與讀屏行為，只統一外觀與箭頭）。需要圖片、搜尋或多欄的選擇器用按鈕開 `UiPopover` 或 `UiDialog`，列表項高 44px、內距 8／12px、間距 4px，選取用 `--stitch-selected-*`。

### UiCheckbox

```vue
<UiCheckbox v-model="shared" label="分享給會員（未勾選則私人）" />
<UiCheckbox :model-value="isOn" label="常用" @update:model-value="toggle" />
```

框 16px、與文字間距 8px、勾選色 `--stitch-frame`（深色框）、label 14px／400、整列至少 44px 高可點。

### UiFilePick

```vue
<UiFilePick label="上傳頭像" accept="image/png,image/webp" :current="avatarName" @change="upload" />
```

原生 file input 透明覆蓋整列，label 14px、檔名 16px；選檔鈕使用 44px／2px 深邊／12px 圓角與硬影。每次選檔先保留 `File` 與可見檔名，再清空原生 `input.value`，最後以 `change` 發出 `File | null`；成功或失敗後再次選同一檔案都能觸發事件。`clear()` 清除已選名稱及原生 input，不重發事件，供儲存成功或切換目標時同步顯示；`current` 改變也會自動清除舊的選檔名稱。保留 `input` expose 供既有選圖／拖放介面操作。

### UiTabs、UiPopover、UiIcon

```vue
<UiTabs v-model="tab" :items="tabs" label="收藏分類" panel-prefix="collection-panel" />
<UiPopover :id="id" ref="popover" title="自訂畫筆顏色" @closed="done">…</UiPopover>
<UiIcon name="save" />
```

`UiTabs` 有方向鍵／Home／End 與 `aria-controls`；外觀為底線式（Figma C07 收藏分頁）：列底 1px 線、分頁間距 24px、文字 14px，選取分頁 700 字重加 2px `--stitch-primary` 底線，高 44px。頁面只排分頁列的位置與欄數；計數使用 `UiBadge counter` 與獨立的 `ui-tab-count` class，避免沿用舊 `collection-count` 樣式。`UiPopover` 依按鈕位置在上方或下方開啟、限制在視窗內並在關閉時返焦。`UiIcon` 只接受登錄名稱（見 `UiIcon.vue`），24 viewBox、1.8 stroke、`currentColor`；新增圖示加到登錄表。

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
| 圓角 | `--stitch-radius-badge` 膠囊 | 徽章、小標籤 |
| | `--stitch-radius-control` 8 | 輸入、下拉 |
| | `--stitch-radius-button` 12 | 文字按鈕（立體） |
| | `--stitch-radius-panel` 12 | 一般面板 |
| | `--stitch-radius-dialog`／`-popover` 16 | 彈窗、浮動選單 |
| | `--stitch-radius-card` 16 | 立體卡（`UiPanel tone="raised"`） |
| | `--stitch-radius-pill` | 膠囊、圓形頭像、開關 |
| 邊框 | `--stitch-border`（1px line）、`--stitch-border-strong`（2px frame） | 一般／立體卡 |
| 陰影 | 預設無陰影；`--stitch-shadow-raised`（0 4px 0）、`-raised-sm`（0 2px 0）、`-overlay` | 立體卡、彈出層 |
| 焦點 | `--stitch-focus-ring`（3px）、`--stitch-focus-offset`（2px） | 所有可互動元素 |
| 控制項 | `--stitch-control-height` 44、`--stitch-control-padding-*` 8／12、`--stitch-field-padding-*` 8／16、`--stitch-checkbox-size` 16 | 按鈕、欄位 |
| 選單 | `--stitch-menu-padding` 8、`--stitch-menu-item-padding` 8／12、`--stitch-menu-gap` 4 | 下拉、Popover 列表 |
| 字級 | `--stitch-text-page` 28、`-section` 20、`-body` 16、`-hint` 14、`-data` 32；`--stitch-font-12…32`（含 28） | 頁標題、區塊標題、內文／label、輔助 |
| 字重 | `--stitch-weight-title` 700、`-button` 700、`-body` 400 | |
| 行高 | `--stitch-line-height-body` 1.5、`-heading` 1.25 | |
| 動態 | `--stitch-transition` 0.15s | hover／選取；`prefers-reduced-motion` 時關閉 |

## R6 五類共用模式

- `UiBadge`：`tone=primary|success|info|warning|danger|neutral|disabled`，深邊 2px、膠囊、14px／700；`counter` 保留 28px 計數槽。只表達狀態，不額外偽造可點語意。
- `UiNotice`：`message`、`tone`、`error`、`active`、`noticeKey`、`duration`（預設 4000ms）、`persistent`。狀態解除立刻隱藏；短暫訊息到時隱藏；保留外層寬高，內文過長可局部捲動。相同訊息再次發生時增加 `noticeKey`，重新開始計時。卸載會清除計時器。`StatusSlot` 轉交同一 API，使用 44px／14px 緊湊樣式；既有遊戲有明確較矮槽位時沿用該固定布局並允許內文捲動。
- 未確認的操作結果、必須重試的狀態、必要遊戲決策／指令及真正空狀態不能定時清除；依來源條件設定 `persistent`，並在狀態解除時清空 `message` 或關閉 `active`。不要將所有 error 一律永久顯示。
- `UiChoiceCard`：`label`、`selected`、`disabled`；淡色中性底、預設無邊，選取時同一底色、3px 深色外圈加 2px offset，以及可見的勾選文字。標記保留槽位，不改外框尺寸。`action` 表示立即操作，不附加持續選取語意；`unavailable` 表示只能預覽的鎖定內容。`#label`／`#selection` 可保留既有可讀內容，但不能隱藏必要資訊。`ImageChoiceGrid`、`FrameChoices`、`EntranceChoices`、`ArtworkPicker` 都沿用這個外觀。
- `UiHeading`：`level=1|2|3`，`kind=page|section`。page 為 28px 與細分隔線；section 為 20px 與黃色直條；允許自然換行，不能縮小字或截掉字。
- `UiList as=div|ul|ol`、`UiListRow as=div|li`：單一細邊面板、交錯底色；列內最小操作槽 44px，標題、內容和 `#actions` 對齊。長內容換行，不能為等高刪減資訊。

字級 roles 為頁首 28、區塊 20、正文 16、輔助 14、數據 32；控制按鈕與 label 保持 14，輸入內容 16。UiField 宣告 hint／error（可用空字串）或 reserve-message 時，固定保留桌機 21px、手機 42px 的槽位；完全沒有說明／錯誤的欄位不造空槽，初始值可能 undefined 的非同步驗證請明確傳 reserve-message；超長文字可鍵盤或觸控捲動。成功／等待的小字對比在元件化時修為至少 4.5:1。

## 版面規則

- 同列面板對齊上下緣；相鄰區塊的邊線、欄寬、列間距與框內留白一致，用 Grid／Flex 與語意間距 token，不逐頁零散位移。
- 動態區塊預留寬高；狀態文字、倒數、非同步載入、按鈕顯隱或捲軸不應造成反覆縮放與位移。
- 長內容在既定區域換行或局部捲動；窄螢幕可換列。不得裁切必要資訊或隱藏決策資訊。
- 卡片選擇區需要內部捲動時，使用 `grid-auto-rows: max-content` 與靠上排列，讓卡片保留內容高度；捲動邊緣為 3px 選取外圈加 2px offset 至少預留 5px，通常使用 `--stitch-space-8`（8px）。檢查四邊及 hover／focus，不能因裁切或平均分配剩餘列高而藏住外圈與內容。
- 混合標題、標籤、數字與按鈕的橫列用 `align-items: center`；控制項維持 44px 以上。
- 操作按鈕可 icon-only，但保留中文可讀名稱、鍵盤焦點與觸控可理解的說明，不能只有 hover 或原生 title。

## 防倒退檢查（`npm run ui:check`）

`tools/ui-check.cjs` 同時檢查每個檔案的數量基準、可信任 Git base 的新增行，以及違規所在的程式區塊。清理舊寫法不用更新基準，但刪除一筆舊違規不能換成一筆新的；把相同文字搬到新區塊也不能沿用舊額度。

| 規則 | 範圍 | 擋下 |
| --- | --- | --- |
| `hex` | `frontend/src` 的 `.vue`／`.scss`／`.css`（token 定義檔除外） | 原始 `#rgb`／`#rrggbb` 及帶 alpha 的色碼；CSS 色彩函式 `rgb`／`rgba`／`hsl`／`hsla`／`hwb`／`lab`／`lch`／`oklab`／`oklch`／`color` |
| `raw-control` | `frontend/src/pages/**/*.vue` | `<button>`、`<input>`、`<select>`、`<textarea>`（不分大小寫），以及 `component` 的靜態原生 `is`／`:is`／`v-bind:is` |
| `old-token` | `frontend/src` 的 `.vue`／`.scss`／`.css` | 淘汰的 `space()`／`font()`、`tokens.type()` 等函式，以及 `var(--play-*)`／`var(--ui-*)`（含空白、換行寫法） |
| `important` | `frontend/src` 的 `.vue`／`.scss`／`.css` | 新增的 `!important`（含 `!` 與 `important` 分行的寫法） |

掃描以完整字串匹配後回填起訖行號，不以逐行搜尋略過跨行語法；色彩函式包含完整括號及巢狀內容，跨行修改參數也算新增位置。Vue 的 `#add` 等 slot 簡寫不當成色碼，屬性內的比較式也不能截斷 slot 辨識。

色彩函式掃描整份 CSS／SCSS 及 Vue 的 `<style>`；Vue 的 script／template 另攔數字起始的固定色彩構造，以及 `color(display-p3 1 0 0)` 等色彩空間加數字常值。使用者選色的變數運算不直接視為原始固定色碼，相關動態樣式仍須審查。`component is="input"`、`:is="'input'"` 及對應 `v-bind:is` 常值都會被攔；真正動態的 `:is="kind"`／條件式無法由此靜態規則判定，審查時須確認不繞過共用控制項。

- **可信任來源**：本機預設比較已提交的 `HEAD` 與工作目錄；需要整個分支的證據時，明確設定 `UI_CHECK_BASE_SHA` 為實際基底提交。CI 指定 PR base SHA 或 push before SHA，手動執行則比較 `HEAD^`，並取得完整歷史。工具輸出解析後的 base SHA；base 無法解析或 CI 未指定 base 時失敗，不默認放行。
- **新增位置**：使用可信任 base 的 Git diff 新增行；匹配跨越的任一行是新增行就會失敗。新增檔與未追蹤檔全算新增，不能挪用其他檔案或同檔已清理的額度。
- **區塊身分**：即使 Git 把搬動的相同文字對齊為 unchanged，工具仍比對 selector、模板祖先與同名同層區塊的序號。搬到新 selector／模板區塊不能冒充原位置。script 區塊不作細部語法推斷，而以清理註解、正規化空白後的整塊內容比對；內容改變後其中的既有違規須清理或逐項給必要例外；無法可靠建立的其他脈絡也採保守比對。Git 路徑、diff 或工作目錄變更無法可靠核對時失敗。
- **schema 2 基準**：`.ui-baseline.json` 的規則、檔案路徑及計數都須有效，每筆額度必須是非負安全整數。工具與可信任 base 比較，拒絕手改增加額度；已有額度不是新增違規的預算。`hex` 的數字基準保留原始 hex 計數；新增涵蓋的色彩函式只比對可信任 base 中的既有位置、文字與脈絡，不轉成可交換的數字額度，也不提高 baseline。新增、搬移或修改函式內容都不能靠刪除另一個既有色碼抵銷。
- **只降不升**：`npm run ui:baseline` 即 `node tools/ui-check.cjs --update`，先通過相同檢查才把目前基準降低。清理後不更新也可繼續開發；不能用更新基準替代修正新增違規。
- **一次性遷移**：schema 1 使用 `node tools/ui-check.cjs --migrate` 遷移到 schema 2，只能執行於舊 schema。新增掃描範圍的既有額度受可信任已提交來源與原基準約束，不能從未提交的新程式放寬，也不是一般開發重建或提高 baseline 的入口。
- **衝突處理**：合併 `.ui-baseline.json` 衝突時保留兩邊較低的既有額度，再執行檢查；不能任取較高一邊掩蓋新增違規。

必要例外只能放在真正的 `//`、`/* … */` 或 `<!-- … -->` 註解，格式為 `ui-check-allow <已知規則>: <具體理由>`。理由不能空白或只有標點；未知規則及無效理由會使檢查失敗。JavaScript 字串或 HTML 屬性中的同名文字不產生豁免。

註解需落在該次匹配涵蓋的行內，或匹配起始行的前一行；跨行 `var()`／`!important` 按完整匹配範圍處理。例外會豁免範圍內的同一規則，應保持程式列及理由精確，不用一條籠統註解遮住無關問題。例如既有原生 UI 相容層可寫：

```scss
// ui-check-allow important: 此變數必須覆蓋既有 ui-primitives 的 important 形狀契約
--ui-button-radius: var(--stitch-radius-button) !important;
```

Stitch 匯出特效的 CSS 類名包含既有色碼字元時，僅在該選擇器前標註精確的 `hex` 例外以保留素材類名；實際色彩宣告仍必須使用 `--stitch-artwork-swatch-*` 固定色票。這些色票不隨明暗主題改色，避免改變已確認的特效美術；選擇器例外不得延伸到新的色彩宣告。

## 舊頁（`public/`）與 GameUI

`public/` 的舊頁仍使用 `public/shared/ui-primitives.css`、`ui-foundation.css` 與 `window.GameUI`（`icon`、`decorateButton`、`setBusy`、`setStatus`、`openDialog`、`bindPopover`）。這一層只維護、不擴充：新功能寫在 Vue 頁面。修改舊頁時沿用 [舊頁 GameUI 合約](UI-GAMEUI-LEGACY.md) 與 [共用對齊規格](specs/SHARED-UI-ALIGNMENT.md)。


### 房間收合與角色互動（#215，候選）

`RoomSidePanel` 以 `UiPanel tone="raised"` 呈現可滑動的面板；保留既有 grid 欄位，收合露出32px寬、與原面板同高的空白框邊，22px 視覺箭頭（保留44px透明點擊槽）貼齊視窗左右並位於面板垂直中央。面板與把手使用同一個 280ms 節奏，依減少動態／動畫偏好停用位移過渡；內容保留 DOM，收合時 inert 並隱藏資訊。

`ReactionPicker` 預設 `mode="all"` 保留既有角色／emoji 分頁；`mode="emoji"` 只載入並顯示 emoji，`mode="character" external-trigger` 由角色元素呼叫公開 `open(element)`，只顯示角色表情。郎中使用這兩個獨立入口，其他遊戲維持原預設。

`UiMoveMarker` 在宿主背景內以百分比 `point` 顯示目的地光點，採主色 token、pointer-events:none；動畫偏好關閉時保留靜態標記，由宿主清除。詳 [驗收紀錄](specs/ROOM-BACKGROUND-215.md)。

#215最新候選：郎中超寬背景延伸至可見視窗寬度，桌機原左右欄寬取平均保持遊戲尺寸並置中；專注全螢幕仍為單欄。RoomEffects以可見視窗25%–75%與頁首下緣作彈幕垂直安全帶，內側保留32px裝飾空間，依實際高度放置，空間不足略過但保留聊天原文。此輪新增外觀未完成瀏覽器驗收，見ROOM-BACKGROUND-215第三輪。

RoomSidePanel提示只由滑鼠停留或鍵盤可見焦點觸發，4秒自動隱藏，點擊／離開／失焦／Esc與狀態改變立即清除；不使用focus-within維持顯示，觸控不觸發黏住的hover。按鈕保留中文名稱與鍵盤焦點。

郎中已入座房間的超寬toolbar延伸至外層視窗；遊戲app保留原內容上限與置中，手機沿用既有換列，其他遊戲不套用。


## 十一款房間共用場景（2026-10-24）

`RoomSceneLayout` 統一背景、玩家側欄、聊天室、手機抽屜與 inert／焦點返回。一般遊戲經 `GameRoomPage` 使用；畫猜保留中央畫板版型，直接接同一元件。新遊戲依此契約繼承場景功能，不另複製快捷鍵或面板邏輯。股市頁本批不加入。

`has-room-space` 不套用舊 C00 整桌及側欄底板；收合時只留 32px 框邊，內容卡保留表面。畫猜的 display:contents 中央卡片必須各自高於互動背景，避免攔截作畫。

場景提供 Q/E、R 與四向穿越；輸入、組字、對話框、畫布及 inert 區域不觸發快捷鍵。活著角色不顯示血條或生命數字，倒地顯示共用墓碑。背景檢視有獨立退出入口及 Esc，沿用原本遊戲專注模式。


## 房間全螢幕與背景入口（#251）

`RoomFullscreenToggle` 供共用房間及你畫我猜使用。四角展開圖示進入原生全螢幕，只顯示中央遊戲區；保留右上四角縮回圖示與「退出全螢幕（Esc）」按鈕。遊戲宿主保持掛載，畫布及輸入不重建。原生 API 不可用時仍提供遊戲區佔滿視窗的 CSS 備援。原生退出、Esc 與按鈕退出均還原頁首及焦點；已有彈窗／浮動選單時先交給該層處理 Esc。

`SceneViewToggle` 的風景圖示是「背景：只顯示背景與角色」，沿用原本暫藏介面的行為，不要求原生全螢幕。房間內由 `RoomFullscreenToggle` 緊接在全螢幕右側渲染背景入口（全螢幕 ghost、背景 secondary 外框以示區別），站台頁首只在大廳顯示背景入口。手機收合的側欄抽屜把手維持在垂直中央，避免蓋住站台頁首。恢復介面按鈕及 Esc 可還原。兩個入口各自保留中文可讀名稱、44px 觸控區與鍵盤焦點；股市明燈沿用原控制。

`RoomSidePanel` 的收合箭頭在面板上方，與標題同列；只在標題旁預留控制空間，內容區不預留整條控制欄。收合後仍在同一頂部高度提供展開入口；手機抽屜、未讀數及原始收合狀態保留。
