# 介面美化與 WebGL 進度

日期：2026-10-07。狀態：**實作與驗收中，尚未確認本批正式發布**。規格：[UI-POLISH-WEBGL](specs/UI-POLISH-WEBGL.md)。本批使用 `feat/ui-polish-webgl`，起始 `38c1497`，獨立於已發 PR #46 的前一批；不把前一批 v1.9.0／1,144 項通過當成本批結果。

## 計畫與目前證據

| 工作 | 目前狀態 | 已確認來源／下一步 |
| --- | --- | --- |
| 研究收斂 | 已讀既有研究與角色規範 | 依 [美化評估](research/UI-POLISH-DES13-ASSESSMENT.md) 與 [WebGL 評估](research/WEBGL-ADOPTION-ASSESSMENT.md) 收斂共用表面與雷霆局部特效。此前研究沒有 WebGL 原型或加速量測。 |
| 現有程式盤點 | 有限 source 盤點 | `ui-foundation.css` 已有字級／間距與 light／dark tokens，遊戲 caller 邊界／陰影仍各自指定；`race-vehicle-effects.js` 已有 SVG／CSS、eventId 去重與減動態。這不是五款完整 native UI 稽核。 |
| 共用視覺 | 已實作，部分 native 通過 | 六份 CSS 共用表面／radius8／12／16／選取邊界／數字形式，保留布局、padding、重要字級與控制尺寸；後續補正 light／dark foreground、選禮accent及hover不蓋selected。畫猜寬高桌機八席幾何已比較；其他遊戲／390／200%仍待驗。 |
| WebGL 模組 | 已實作，契約與有限 native 通過 | `public/shared/game-fx-layer.js` 與 `tests/game-fx-layer.test.js`；renderer13項是fake GPU契約，已納入下方最終Windows全套；另有真Chrome nitro像素／idle／context loss與restore證據。未量測FPS或性能收益。 |
| 雷霆整合 | 已實作，部分 native 通過 | 公開 event 與 live gate 接入；原SVG／CSS與文字保留。真鍵盤movePath三步後到達server目標，兩次anchor跟視覺車位；道路連鎖／碰撞完整trace仍待驗。 |
| 回歸與原生驗收 | Windows全套通過，背景Chrome持續驗收 | Source／自動測試、有限真Chrome與正式站分開記錄。Linux／其他UI矩陣／正式待驗。 |
| 升版／交付 | 待主 agent 證據 | 本文件不建立tag、不操作服務、不代替發布與資料檢查。 |

## 實際討論與修訂

| 提案／問題 | 回應與收斂 | 狀態 |
| --- | --- | --- |
| 規格方：共用CSS cascade 可能破壞 hidden／selected／大字與既有compact控制；不能只按原始 token 判可讀性。 | 主 agent 限首批為表面／radius／elevation／選取／數字，主要 grid／padding／控制尺寸／重要字級保留，不強行全站換字體。 | 已收斂實作邊界；native 回歸待驗。 |
| 規格方：特效 canvas 不可攔 hover／鍵盤，動畫結束不能推進移動；不得承諾 GPU 自動加速。 | 主 agent 指定 pointer-events:none、原 SVG／CSS 始終保持、live gate 消費公開事件、跟隨視覺車位且不影響checkpoint。 | 契約已實作，有限原生loss／restore通過；完整回退矩陣仍待驗。 |
| 主 agent CSS review：新表面與原caller foreground可能錯配，選禮hover亦可能覆蓋selected。 | 視覺方補accent soft、選禮文字／badge與media／drawtools／racecar／qcard foreground，hover不覆蓋selected；原字級與幾何保持。 | Source已補正，靜態sRGB比值與native畫面分開驗。 |
| 既有研究：可先考慮 PixiJS 粒子原型。 | 本批主 agent 選原生 WebGL1 三類 point particles、無新依賴／貼圖；先驗功能／邊界，不將選型當作效能勝出。 | 有界首批工程選擇，未量測效能比較。 |

## 驗收紀錄

| 分類 | 方法／範圍 | 結果 |
| --- | --- | --- |
| Source／自動測試 | Windows完整回歸，含renderer13項與root新增integration3項；fx＋presentation focused | 主 agent回報完整 **1,160／1,160**、**37,979.0566ms**，fail／cancel／skip／todo均0；focused **56／56**。Linux與最終source／版本記錄待主agent補齊，不把focused再加進總數。 |
| 五款桌機資訊 | 畫猜八席，1794×1109同資料的新舊幾何比較 | 主區兩版均1194×921於(260,176)，名單兩版均220×921於(24,176)，8席可見且無水平溢出。其他遊戲／phase／720p仍待驗；首次landing／consent stale截圖排除，未作通過證據。 |
| 小螢幕／放大 | 390／320px、200%文字、自然流／局部scroll尾端 | 待驗：不能因縮字、裁切或收合重要資訊通過。 |
| 字體／對比／表面 | 視覺方以CSS原始sRGB作靜態計算；computed/native仍待驗 | control／panel light4.0862、dark4.7622；light title3.5195；三種light answer底色必要邊界最低3.0633；selected實底文字light9.1200／dark9.0198。這些是指定token配對，不是全站對比認證或截圖像素。 |
| 圖示／浮窗／媒體 | hover／focus／Esc／返焦／hidden／pending、表情到尾、設定、影片／清單resize | 待驗：層級／尺寸／sameiframe／零幾何POST。 |
| 畫猜途中防閃 | artist held／up／ACK／換輪，viewer逐點／結果、倒數 | 待驗：終點圖片不能代替途中觀察。 |
| 原生 GL／車位 | 真Chrome nitro、shader／particles像素、移動anchor與idle | GL linked／ready、error0，首次readPixels有124個非透明像素，buffer1166×535；結束後particles0／frameScheduled false。證據 `work/ui-polish-webgl-native-nitro-final.json`，早期小尺寸候選排除。movePath anchor兩次採樣x213→343，SVG尾焰仍1。背景節流採樣，不代表連續前景FPS或視覺密度；其他自然煙霧／火花及resize待驗。 |
| 回退／減動／生命週期 | 真 `WEBGL_lose_context` lost／restored；OS reduce media override | before／lost／restored均seen6／drawCalls6，無補播；lost available false／idle0／原SVG尾焰1／合法格3仍在，restore available true。證據 `work/ui-polish-webgl-context-cycle.json`。reduce下play false已觀察，manifest保存待完成；noGL／shader失敗由fakeGPU契約覆蓋，native disable／hidden／離頁完整矩陣待驗。 |
| 逐格與事件規則 | 鍵盤觸發原movePath三步 | 到達car.y4，seen1→4，anchor跟隨視覺位置；不能由兩次位置採樣推定全程平滑。道路事件先處理／碰撞／封包count全trace仍待驗。 |
| 共用範圍 smoke | 撲克與非遊戲入口 | 待驗：不宣稱完整玩法。 |
| 正式交付 | 受測來源／tag、備份／即時房間檢查／資料保全、公開版本與資源 | 待主 agent 提供正式證據後填寫。 |

## 限制與後續

本批不改畫猜 Canvas 2D、server同步、PNG或規則；不遷移整個賽道／文字／其他遊戲到GPU。192粒子是首批產品上限契約；已有有限真nitro／movePath／context回退，未量測壓力負載或性能收益。其他硬體、前景呈現FPS、實體手機／讀屏、全部phase與自然多輪須按實際驗收範圍列出，不能由context成功或全套單元測試推定。

原生驗收使用背景Chrome與FocusEmulation促進native paint，沒有將瀏覽器視窗帶到前景；這不等於真前景幀率測量。測試preview仍在進行，尚不能記為已清理；override／own tabs／preview的最終清理待主agent回報。

公開文件不收錄本機偏好、帳密、房碼、cookie、原 HAR 或正式環境私有設定。原始QA資料留核准位置；本文件只保存可複核的來源、範圍和摘要。
