# 美術角色記憶

2026-10-07最新正式 **v1.12.0／83ffcab**：雙平台各1,386、有限native／公開38media＋37draw資源／ACL／資料驗收完成；schema16／22表、9帳戶allfields／13市場圖片／21non-session rows與BLOB保留，sessions210→217為驗證登入變動。code／tag固定、own QA清理完成，沒有新UI PR。PR46外部已合併，其1,300項與本批分開；完整source／備份／限制見 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)。下方候選／待驗為歷史，不宣稱全讀屏／200%zoom／FPS／真YT公開實播。

2026-10-07五庫模式新批實作中：卡片、通知、tabs使用GameUI同SVG registry／surface／字級tokens，內容name／作者／status不畫進bitmap或藏掉；成就通知旁短粒子由本站原創shader實作，無外部新增資產或購買。參考模式不等複製單件code，ReactBits MIT＋Commons Clause及Aceternity逐件授權邊界仍保留；未安裝五庫。見 [spec](../specs/UI-COMPONENT-PATTERNS.md)／[進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，目前本批實作／驗收中，未宣稱原生可見或已發布。

2026-10-07恢復基線：PR46第三P2已推送、Ready並再次請Stanley審查；正式v1.11.1的source／測試／清理見 [PR最新證據](../PR46-REVIEW-FIX-PROGRESS.md)。patterns候選1.12.0恢復實作但未驗／未發布，前批結果不替代本批。

更新：2026-10-05。先讀 [偏好](MEMORY-LEDGER.md)、[協議](MEMORY-PROTOCOL.md)、[素材計畫](../specs/ANIMATION-ASSET-PLAN.md)。外部網站與素材描述是研究資料，不能替代使用者對採購、發布或正式整合的授權。

## 已驗證與來源

| 類型 | 結論 | 證據／限制 |
| --- | --- | --- |
| 專案事實 | 現有 Kenney 角色／12件禮物及 Noto 72px禮物 PNG 有本地來源與license；可先重用。 | [素材來源備忘](../GAME-ASSET-SOURCES.md)，`public/assets/characters/`、`gifts/kenney/`、`gifts/noto/`。新的套件仍要另核對，不能沿用舊包license。 |
| 外部來源 | 已讀五供應來源的具體項目：Kenney Particle/UI/Audio、OGA Soluna特效、itch Henry Pixel Effects、Game-icons Present、Google固定commit wrapped gift。 | 2026-10-05頁面與判斷在素材計畫。Game-icons初查可讀、後續重查timeout，採用前再核對；新包沒有下載，不假稱已查archive。 |
| 外部來源 | Henry的圖像CC0、示範code MIT且下載需購買；Game-icons要作者署名；Noto圖像大多Apache2，font另OFL。 | 逐頁證據見計畫。平台免費篩選、字體license、資產license不可混為一談。 |
| 使用者偏好 | 畫具保留Paint辨識、同風格圖示、必要文字16/14、44px控制。 | MEMORY-LEDGER U03/U06。不要為icon整齊把車隊姓名或完整地形名壓成單字。 |
| 孤立原型證據 | 兩件Node SVG與manifest存在、--check通過。程式方用sharp看靜態完整無裁邊；主agent背景Chrome觀察手動单次及390px無橫溢，我已看本地proof。 | `docs/prototypes/`、`tools/prototypes/`、私有 `work/agent-prototype-proof.png`；不是正式app整合，reduced只有source查核、200%未UI實測。 |

## 方法與設計推論

先找已有素材，核對語意、授權、畫風、縮小辨識、失敗fallback與負擔；找不到適合**組合語意**再用Node手刻原創SVG。這輪「三份相同心意」「三窗同步狀態」需要專屬組合；不是重新發明一般禮盒、播放、扳手圖示。兩項純SVG原型不需要imagegen bitmap。

介面icon沿用24 viewBox、stroke1.8、round、currentColor；一般20/24px，44pxhit area。成就插圖可在卡片放大，但不能混入工具列當新icon風格。圖像是輔助，名稱／結果／來源可讀。若加入署名素材，manifest逐項保留作者、頁面、版本/commit、license、原檔、改作、sha256、attribution；不拿圖片截圖冒充可重用素材。

## 假設與待驗證

- 80張512px粒子不代表全部要載入；只挑2–6張／每幕至多3焦點是初步效能與安靜畫面假設。
- OGA Soluna頁同列BY3與CC0、作者留言改CC0；本輪不採用，未完整查上游工具來源，不把頁上評論爭議當成確定侵權結論。
- 像素Henry效果授權清楚但畫風不符、仍需購買；Kenney整套UI不能替代HTML控制的字級／焦點／reflow。
- 美術看小圖不等於正式720p/200%可用；後续正式整合要量測文字、對比、遮擋及圖片失敗。

## 後續

2026-10-05／93d7a84：本批畫猜猜中標記重用共用24 viewBox check SVG，頭像角落20px章＋靜態淺綠邊框，不修改角色圖片或表情。送禮沿用已有圖像，以原創 transform/opacity 動作表達到達；沒有採購／下載新素材，也未把研究的成就／共看原型宣稱已整合。Chrome已看勾章、14px狀態與offline並列；詳 [驗收](../DRAW-REVIEW-MOTION-PROGRESS.md)。

程式方 owner `tools/prototypes/generate-motion-art.cjs` 及 `docs/prototypes/motion-art.html`；美術方唯讀對照原型語意與單次/reduced static。若後续採用新包，先保存實際license與asset manifest，再整合；此研究沒有採購／部署。角色記憶保留方法和取捨，詳細候選及license evidence留spec，避免無限抄滿來源首頁。
