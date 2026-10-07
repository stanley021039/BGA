# 介面美化與 WebGL 進度

2026-10-07：第一批已完成並發布至 **shhuang.cc v1.10.0**。受測程式 `52e96b762a10c257e7b3b625a207b44b76cc8b9a`，本地 annotated tag `v1.10.0` 固定該程式；後續文件提交不移動 tag。本批使用 `feat/ui-polish-webgl`，沒有新 push／PR，既有 PR #46 不改。

規格見 [UI-POLISH-WEBGL](specs/UI-POLISH-WEBGL.md)，依據 [美化研究](research/UI-POLISH-DES13-ASSESSMENT.md)、[WebGL 評估](research/WEBGL-ADOPTION-ASSESSMENT.md) 與 [Threads 元件評估](research/THREADS-UI-COMPONENTS-ASSESSMENT.md)。採既有共用 CSS 和原創 WebGL shader，沒有安裝或複製研究框架／元件庫；沒有量測 WebGL 加速或前景 FPS。

## 完成範圍與實際討論

| 工作／問題 | 採用與實作 | 邊界 |
| --- | --- | --- |
| 共用視覺 | 六份 CSS 統一背景／卡片／浮窗、8／12／16px radius、邊界／陰影、選取與 lining／tabular 數字。 | 保留 grid／padding／重要字級與操作尺寸，不用大插圖或收合取代玩家／車隊／骰子／角色。 |
| caller foreground／hover | review 後補 media／drawtools／racecar／qcard foreground、選禮 accent soft／badge；hover 不蓋 selected。 | 靜態 sRGB 與原生畫面分開驗，不當全站對比認證。 |
| 雷霆 WebGL | 原生 WebGL1 point shader，nitro／smoke／sparks；lazy、有界、同 host 重用、idle 無 rAF。 | SVG 賽道與文字／車／骰、鍵盤／hover保留；不改畫猜 renderer、規則、DB或每幀封包。 |
| 同類裝飾替換 | 使用者允許更好新效果取代舊效果；`onActivity({active,kinds})` 只在成功畫出非零粒子後發布kind，僅遮同類舊SVG裝飾。 | queue／ready／空幀保留舊效果；idle／loss／reduce／clear即恢復，label／bullet／trail／車身spin保持。 |
| 替換修正 | 原opacity被舊keyframes覆蓋，在真Chrome重現後改`visibility:hidden`。 | 最終active hidden／idle visible通過；原opacity候選不算通過。 |
| 位移與回退 | 公開eventId／live gate與視覺車位anchor，clear／hidden／reduce／destroy取消舊事件。 | 不靠粒子結束推進checkpoint，不從server終點直接跳位置，不補播舊事件。 |
| Threads五庫 | 核對官方元件／依賴／授權，借鑑分組選取、dialog／tooltip、短通知和局部粒子模式。 | 只作模式參考，沒有安裝五庫、複製素材或測它們的FPS。 |

預設192粒子／6效果／DPR1.5／150萬pixels；硬上限256／8／2／200萬pixels，單事件最多48粒子、120–1800ms，seen256，全頁至多2 contexts。固定Float32 particle buffer，不新增atlas／貼圖或逐幀請求。

## 最終自動測試

| 環境／範圍 | 結果 | 說明 |
| --- | --- | --- |
| Windows全套 | **1,165／1,165**，**38,014.8579ms** | fail／cancel／skip／todo均0，`work/ui-polish-webgl-windows-final-tests.log`。 |
| Linux Node22.22.1全套 | **1,165／1,165**，**199,059.14362ms** | fail／cancel／skip／todo均0，來源與最終tag一致。 |
| 新增契約 | renderer17＋vehicle integration4，共21項 | 已含完整總數；fake GPU契約不等原生呈現。 |
| 最後focused | **32／32** | 不加到完整總數。 |

先前1,160／1,164，以及visibility修正前1,165／38,020.4268ms皆為中間候選，上表取代它們。

## 背景 Chrome 驗收

| 類別 | 實際結果 | 限制與證據 |
| --- | --- | --- |
| 真WebGL像素 | 最終nitro linked／ready、error0，readPixels124非透明像素，buffer1166×535；idle particles0／frame false。 | `work/ui-polish-webgl-native-nitro-final.json`；早期346px候選排除。背景採樣不代表前景FPS或密度。 |
| 替換舊裝飾 | 最終8次active採樣mode nitro、舊尾焰visibility hidden；idle mode空、舊尾焰visible／frame false。 | `work/ui-polish-webgl-replacement-visible-native.json`；drawCalls18／seen4是該段計數，非FPS。 |
| 最終loss probe | 原生失context後activeKinds空、舊尾焰visible、frame false。 | `work/ui-polish-webgl-final-loss.json`；同次restore因過早要求而逾時，已reload清理，不能列該次完整restore通過。 |
| 獨立restore cycle | 更早真lose／restore：before／lost／restored seen6／drawCalls6相同；lost available false／idle0，SVG尾焰1／合法格3仍在；restore available true。 | `work/ui-polish-webgl-context-cycle.json`；不與上列拼成同次完全通過。新activity替換失效復原另由最終probe與契約驗。 |
| 視覺移動 | 真鍵盤原movePath三步後car.y4、seen1→4；兩anchor採樣x213→343跟視覺車位。 | 兩位置不證明全程FPS；完整道路連鎖與碰撞trace列後續。 |
| 畫猜途中 | 第二輪真持筆6move：artist23樣本ink37→2126／whiteAfterInk0；viewer23樣本含7 partial，最後pending0／scheduled false；雙席version9／13points全timed、backing512×256。 | `work/ui-polish-draw-held-artist.json`／`ui-polish-draw-held-viewer.json`；途中與終點分開，不只比PNG。 |
| 畫猜畫面／換輪 | 已檢視active截圖有線、4秒時間條、8玩家與下方chat對齊；晚一筆同SHA是下輪choosing白baseline。 | `work/ui-polish-draw-active-proof.png`／`ui-polish-draw-pixels.json`；不稱有墨終點SHA一致。 |
| 新舊幾何 | 畫猜1794×1109主區兩版1194×921於(260,176)，roster220×921於(24,176)，8席可見、無橫溢。 | 排除首次landing／consent stale截圖，不由等待畫面代表全部phase。 |
| 四遊戲矩陣 | 畫猜8席、送禮3人、同頻3人、雷霆3佔席＋1空槽；桌機／390×844／200%採樣無橫溢。giftselected紫底#f0e8f5、綠正文／紫inset可辨。 | `work/ui-polish-ui-matrix.json`14筆含重複／恢復採樣；synthetic gift dark不是產品theme。finished隱藏`#drawCanvas`幾何不當作畫比例失敗。 |
| 720p／浮窗 | race主區下緣718、4槽／majority3人、均無橫溢；drawemoji(887.78,379)至(1243,712)、scroll447／client331，settings在screen內。 | `work/ui-polish-webgl-extra-ui.json`；只記實際情境，不宣稱所有按鈕／phase。 |
| 媒體幾何 | video870×440→resize850×440同iframe；清單840×242；本輪proxy `/api/room-media` POST0。 | 同一extra-ui／local log；清單遮影片會本地退出，關閉後可重新加入，屬原可見政策。零媒體POST不是完整新舊traffic benchmark。 |
| 靜態對比 | control／panel light4.0862／dark4.7622，light title3.5195，light answer邊界最低3.0633，selected文字light9.1200／dark9.0198。 | CSS原始sRGB配對計算，非螢幕像素或全站對比認證。 |
| reduce／收尾 | media reduce override下play false；四own背景tab已清FocusEmulation／viewport／mediaoverride並關閉，最後TTYpreview正常stop／exit0、測試ports無listen。 | 首次nonTTYpreview是確認ownPID後停止，非正常stop。沒有提高Chrome視窗；FocusEmulation促paint不等前景幀率。 |

## 正式發布與資料保存

2026-10-07T08:35:32Z即時房間0的guard後，由v1.9.0切至v1.10.0，服務／tunnel active。SQLite線上備份、另時點檔案archive與隔離login／schema預演完成；不是atomic cold snapshot。

| 檢查 | 結果 |
| --- | --- |
| 受測發布包 | SHA-256 `34efada9a3f246ba9c15916261483691cd7a9aa0a93d203ae70706d13ec26bf4`；來源固定 `52e96b7`，備份 receipt 與隔離副本啟動／登入均通過。 |
| 服務與路徑 | 版本／source一致，schema15／21表，integrity ok／FK0；8users全fields、data paths／env保持，import generation未啟用。 |
| 公開畫猜 | 18assets no-store且精確等於受測來源；3own會員驗SSE點時間、ACK／snapshot、dedupe、quota、undo／clear額度不退、nonartist拒絕。 |
| 公開媒體 | 19assets精確來源；一般席enqueue／全桌控制拒絕，manager promote／seek／skip／demote即時ACL，site roles不變。HTTP不當原生Audio／YouTube實播。 |
| own QA | 兩房已刪、sessions登出，profiles／artwork未寫，QA history保留。 |
| 最後資料 | 20 non-session tables allrows／BLOB未變，8users全fields保持；sessions184→191為驗證登入／登出成長，不說session表不變。 |

證據：`work/ui-polish-webgl-postcheck-result.json`、`ui-polish-webgl-public-smoke.json`、`ui-polish-webgl-public-media-smoke.json`、`ui-polish-webgl-final-data-check-result.json`。公開文件不收錄私有主機路徑、房號、帳密、cookie、本機偏好或原HAR。

## 後續與限制

本批已交付共用表面與雷霆局部WebGL；下一批再比較自然smoke／sparks、完整道路事件／碰撞trace、同trace前景效能。沒有全部buttons／phase、全部硬體、實體手機／讀屏、自然多輪或GPU加速結論。整張賽道／角色、畫猜renderer、文字／emoji與其他遊戲仍用原技術；WebGL成功不證明傳輸或DB成本下降。

未涵蓋矩陣是後續驗收方法，不把擴展研究當成本批尚未交付，也不把全部玩法寫成已測。舊v1.9.0與「WebGL未實作」保留為歷史，本文件取代其目前版本／實作狀態。
