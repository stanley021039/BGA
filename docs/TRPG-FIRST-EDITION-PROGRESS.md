# #59 免 token 跑團初版驗收

最新狀態（2026-10-09）：使用者明確授權合併第一版，PR #84 已合併 main，merge `6785f3512c0b421fb75ee23bb8138a9cff4e1309`。最新 head 50c3aba 的 CI run 37914872521，Linux／Windows Node22 均 success。本筆取代下方本批「Draft／未合併／CI pending」現況，原證據保留為歷史；真人／觸控等待驗項目沒有改成通過，未部署或建立 tag，#59 仍開啟供後續 AI 工作。

日期：2026-10-09。需求來自 #59「跑團遊戲」，使用者明確選擇「先做免 token 可玩初版」。候選 v1.24.0，schema 19 不變；尚未合併、部署或操作正式資料。

## 實作與玩法

詳見 [初版設計](specs/TRPG-FIRST-EDITION.md)。大廳新增霧港跑團；1–6 人、六幕原創故事、三種專長，輪替領隊及每席協助／整備。伺服器擲骰，選擇前公開代價，失敗仍推進、不淘汰；跨幕手記與既有歷史回看保留檢定和描述。使用規則主持，沒有 AI API、token、模型裁決或付費設定。腳本夥伴僅供試玩，不是 AI KP。

依 PLAYER rubric P1–P8、DESIGNER 與 MEMORY-PROTOCOL 自查；是同一實作者切換視角，沒有其他 agent 投票或真人評分。領隊整備放棄專長，以免永遠免費回復；最多兩人付專注協助，其餘不扣；各人提交前只公開準備狀態。完整設計取捨與重玩限制在 spec。

## 實作階段證據

- Windows 原生 Node 22.23.3／npm 10.9.9，隔離 worktree，基線 `bef199bbc7129e41fb870df0e9debd0670a899f1`。
- `npm ci` 成功。`npm test` 最終 **1,932/1,932**，fail／skip／cancel 0，exit 0；108,162 ms。新增引擎 12、HTTP 2、client 2 項，覆蓋六幕轮替、勝負、私密草稿、越權、容量、重複指令、舊場景、離線交棒、骰子異常、歷史、重連、輪詢與未送出修改。
- 首輪全套 1,927/1,930，三個既有測試因新增頁面／首頁遊戲數常數失敗；修正期望數值，保留原斷言，最終全套通過。沒有刪除或跳過測試。
- focused 引擎／HTTP／client／資源／主題／彈幕共 **29/29**。`node --check` app、引擎、client；`npm run release:check -- --base bef199b --type minor` 與 `git diff --check` 通過。
- 本地原始日誌位於 checkout 外：`issue59-trpg-full-test.log`（首輪）、`issue59-trpg-full-test-final.log`（最終）、`issue59-trpg-focused.log`。未將日誌或測試帳密提交。

## 瀏覽器操作證據

隔離 fixture、合成帳號、外部連接關閉、loopback-only；沒有正式資料。內建瀏覽器實際 1280×720 深色模式：登入→大廳新卡→建房→腳本補席→開始→完整六幕。观察到領隊輪替、成功／部分成功／失敗、協助扣點與整備回復、補給消耗、每幕手記保留；本次結局線索 5、危機 3、補給 0。第三幕 reload 恢復原席位／原場景；已準備後修改選擇，檢定 disabled，重新提交後恢復；第五幕以 Enter 提交。完成後歷史列表標「已結束」，26 個狀態的最後一步可看到六幕公式與玩家描述。

console error 0；桌機 DOM scrollWidth 1265 ≤ viewport 1280，未見横向溢出。候選結局截圖保存在 checkout 外 `issue59-trpg-preview.png`。這是工具操作，不等於真人玩得好玩。手機 viewport override 未生效，不認列手機／觸控／旋轉；未驗全讀屏、200% 縮放、六真人桌或長期平衡。沒有直接改既有畫猜 renderer。

## 待驗與範圍限制

只有一篇六幕短篇，尚無自由場景、AI KP、角色戰役持久化或成就。場景 UUID／requestId 去重只在本次房間執行期；伺服器重啟會結束記憶體房間，歷史不是續局恢復。真正的多人樂趣、等待時間、角色平衡與重玩性待真人試玩；手機、觸控與完整可及性待驗。歷史的通用操作名稱仍沿用既有標籤，主要故事與公式已可回看。

保留 Draft 供檢視上述驗收缺口；不能由本文件推定已上線。固定 commit 的兩回合自查與遠端 CI 結果會另附交付紀錄。

## 固定差異自查（同一實作者，兩個回合）

兩回合均 base／merge-base `bef199bbc7129e41fb870df0e9debd0670a899f1`、head `89ad7b961c2bd8b3e1885697852af1c742230f56`，範圍 `bef199b..89ad7b9`。直接讀新增引擎／client／測試與 app、scheduler、membership、history、hub、共用重連差異及呼叫端；不是外部 reviewer 意見。測試是上節實作階段證據，審查階段沒有宣稱重跑全套。

第一回合（規格）：免 token、原創六幕、1–6 人、輪替領隊、公開代價／骰子、每人參與、失敗推進、重連與歷史，對照 spec 與新增 engine／HTTP／client 測試符合；版本／CHANGELOG minor 符合。手機／觸控、全讀屏／200%、真人桌與主觀樂趣為待驗，不能標完整 UI 驗收通過。歷史通用操作標籤與只有一篇故事是明列限制。結論：可供初版試玩／檢視，保持 Draft，未達完整驗收。

第二回合（品質／風險）：檢查 `src/games/trpg.js:53` 輸入／身分／requestId、`:94` 驗證→RNG→成本順序、`:118` 離席轉移與舊場景失效、`:131` view 白名單；`src/ai/index.js:29` 腳本只用 public view；`public/trpg.js:18` busy／dirty 鎖、`:24` 草稿保留與新鮮度、`:64`–`:70` abort／pagehide／BFCache；history 轉義與去秘密及六幕有界容量。checked diff／新檔只含合成测试資料，未新增外部依賴或提交秘密。完整全套涵蓋既有 route／資源／主题回歸；沒有新 migration。結論：本次已檢查範圍未發現未解重大問題，不能保證沒有 bug；跨程序去重／續局、真人大桌、完整可及性不在已驗證範圍。

實作時修正的主要反例：領隊免費整備支配選擇（放棄專長＋engine 回歸）、已準備後未送出修改仍可檢定（dirty 鎖＋client 回歸＋真瀏覽器複驗）、新增頁面／卡數與共用資源斷言不一致（保留斷言改期望數＋全套複驗）。這些已包含在固定 head，不冒稱外部審查 findings。

交付：Draft PR #84，https://github.com/stanley021039/BGA/pull/84 。本節為文件增量，程式／測試與固定受測 head 相同；後續 CI 以 PR 最新 head 的 GitHub Actions 為準，未完成不算通過。隔離 server 已用 fixture dispose 關閉，loopback 5935 不再監聽，驗收分頁已關閉。沒有建立發行 tag／合併／部署，#59 保留開啟。
