# Freehand 圖示與紙卡介面

2026-10-08最新決策：使用者要求先撤回手繪外觀，正式v1.15.1／c1e59d4已恢復導入前大廳與四房標題；不回退功能。狀態與證據見 [還原進度](../UI-STYLE-ROLLBACK-PROGRESS.md)。下方為歷史已發布方案，不再當作目前應套用的風格規則；素材來源／授權仍保留。

研究日期2026-10-07；2026-10-08（Asia/Taipei）正式已發布 **v1.14.2／8ae5c4f9bd2a9cf62156bb3b80eb49c5a473a4b9**。基線v1.14.0；v1.14.1未部署候選的Linux行尾失敗與修正見進度，tag均不移動。研究來源見 [資產評估](../research/FREEHAND-UI-ASSETS-ASSESSMENT.md)、[視覺參考](../research/FREEHAND-UI-VISUAL-REFERENCES.md)。下表是契約，實際通過／未驗scope以進度為準，不視為全原生矩陣完成。

| 分類 | 頁面／遊戲 | 修改與實作 | 保留與驗收 |
| --- | --- | --- | --- |
| 同系列圖案 | 整體大廳／六款入口 | 官方Freehand Duotone固定commit，11件本地SVG＋一件本站原創禮盒；manifest原始／修改SHA、作者、license與改色記錄。替換遊戲入口大幅字元插圖，24/48/72槽由共用CSS定義。 | 遊戲名、人數、selected／aria-pressed與可讀按鈕仍可見；24px小操作registry維持既有辨識契約。無script、外部resource、任意SVG路徑。 |
| 紙卡／色彩 | 整體大廳 | body明確opt-in，暖紙白／炭墨／forest／mustard，少量邊線與陰影；六卡桌機3欄、中2欄、小1欄。舞台保草綠與人物。 | 不把其他頁整體變色；明確focus、hover不蓋selected、input/menu對比、必要gap及44px操作。 |
| 排版／重要內容 | 四遊戲 | 房間標題旁同系列小badge；雷霆flash、畫猜pencil、同頻chat、送禮originalbox。roomTag／roomTitle仍獨立，可更新文字不清掉badge。 | 不挪玩家／車隊／骰子／畫布／工具／倒數條／聊天室；不重新顯示大幅waiting裝飾。桌機／390窄屏標題與控件不重疊。 |
| 授權／reuse | 整體遊戲 | /credits可讀作者backlink、CCBY4、修改説明；home頁尾與四房設定內入口。11官方SVG fixed route，安全CSP、正確SVG MIME／no-store。 | 不把Pinterest／Dribbble圖片直接搬用、不購買素材；來源頁keyboard可達。固定route與對原bytes、非法路徑404測試。 |
| 動態／負擔 | 整體遊戲 | 既有短入場／hover規則，無常駐新loop、無外部runtime／API／字型／texture；SVG與CSS局部加入。 | reduced下hover／短入場保靜態，無動畫掌管規則；不宣稱FPS提升。 |

實際受測source、Windows/Linux／原生／正式站與資料保留範圍集中於 [進度](../FREEHAND-UI-PROGRESS.md)，不能由其他版本測試推定。
