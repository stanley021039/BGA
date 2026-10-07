# PR43 亂序回覆與表情音效時間修正

日期：2026-10-07。對應 [Stanley 的新 P2](https://github.com/stanley021039/BGA/pull/43#issuecomment-6028638470)；原 PR 保持 [#43](https://github.com/stanley021039/BGA/pull/43)。先前跳台方向／固定客戶端時鐘偏差兩項已由 reviewer 複查確認；本次處理較新 social ACK 先到、舊 state 後到造成的時間倒退。

## 問題與修正

舊版每次直接用回應的 serverNow：t0 表情 state 延遲，t6 較新 ACK 先到，t7 才收到 t0 state，便將已過7秒的事件當成年齡0播放。更新間隔只有1秒，原斷線抑制不會攔住。

`ExpressionSounds.create()` 現在保存每個 context 的 serverAnchor／serverAnchorAt，以 `performance.now()` 的非負經過時間推進估計伺服器時間。只有超前目前投影的有效 serverNow 可前移錨點；舊、等值或缺少時間戳不能重設計時。poll gap 亦用本機單調經過時間，壁鐘快／慢或中途跳變不影響此路徑。reset／切換context清錨點；hidden／pagehide／長gap仍先建立靜默baseline並消費舊事件，seen上限256、音量／靜音、播放上限及最長10秒保留。

修改只含共用音效模組、其測試與patch版號；沒有改角色表情、伺服器協議、資料庫、輪詢頻率或畫猜作畫流程。

## 程式與驗收

| 分支／版本 | 固定受測程式與本地不可覆寫tag | Windows Node24.14.0 | Linux Node22.22.1 |
| --- | --- | --- | --- |
| 原PR範圍 v1.4.2 | `ca931b700d1a38fccb6433a430f2a32250f43183`／v1.4.2 | 815/815，47,503.8563ms | 815/815，144,839.199399ms |
| 保留後續正式功能 v1.7.2 | `6fcd55ca73e849f2f2df8d0b368676a34ddb581c`／v1.7.2 | 947/947，32,613.5944ms | 947/947，154,617.083803ms |

兩分支失敗／取消／跳過均0；patch版號檢查通過。後續文件提交不移動tag，不把原PR整個舊版覆蓋到正式版。Linux是固定Git archive與SHA256驗收，不是GitHub CI。

| 證據 | 實際結果 |
| --- | --- |
| fail-before | 主agent以固定原head `df8f431` 的音效／音量原碼與新29項測試建立ignored離線fixture，23pass／6fail；程式agent也先重現同樣結果。 |
| fail-after | 表情控制器29/29、相關6檔聚焦66/66。新增7項cover亂序、equal／older持續老化、±wall jump、缺clock後沿已知anchor、5秒／+1ms邊界、hidden／pagehide／reset／context，以及穩定wall legacy fallback。 |
| 獨立程式複核 | 另一agent唯讀真fixture29/29；有效serverNow＋performance主路徑未見額外缺口。legacy限制另記下方。 |
| 真Chrome單調clock | 候選同程式隔離頁使用真performance.now及setTimeout：較新ACK在6015.7ms，舊t0回應在7024.6ms；過期playExpression呼叫0、緊接fresh呼叫1。document.hidden=false。 |
| Chrome證據界線 | 使用播放替身，不是真音訊、喇叭、HTTP弱網或正式poker實玩。證據 `work/expression-clock-browser-result.json`／`expression-clock-browser-proof.png`；tab及3343隔離server已停止。 |

## 正式同步與資料

正式已升 **v1.7.2**，current `releases/6fcd55c`，PID88602→103459，service／tunnel active。固定封存SHA256 `6b48197f76baafb4db2a4491afd37e63a0147b83d7f6adcd6fe642257af3179a`，排除本機私人文件。

切換前使用SQLite線上一致性備份，檔案與設定另外備份；不是跨檔原子冷快照。備份識別 `pre-expression-clock-fixes-6fcd55c-20261007T012233Z-8ba0d23c-e92f-4505-bd13-d2444b978908`。副本升級／外部副作用關閉的隔離啟動前後，21張既有表schema／rows／BLOB一致、8帳戶全欄位保留。即時房間清單為0才切換；僅對核對過的舊服務PID發SIGTERM，沿用既有重啟與資料鎖，不回收鎖、不還原資料。

公開 `/api/version` 為v1.7.2／no-store；ExpressionSounds、AudioSettings、GameShell、RoomHost、poker app及lobby六份JS與固定Git來源、text/javascript MIME／no-store一致。既有合成會員登入、lobby serverNow、rooms0及登出已驗，未建立正式測試房間或改profile，未使用真正管理員登入。之後21schema與20非session表全部rows／BLOB仍同新鮮備份，8帳戶全欄位保留；sessions155→157為驗收登入／登出，沒有宣稱sessions逐列一致。schema15、integrity ok／FK0及正式設定／資料路徑保留，外站資料代未啟用。

## 未驗與相容界線

有serverAnchor後，即使單次回應缺serverNow仍沿推算時間；从未收到有效serverNow才採旧wall-age fallback。沒有performance的舊環境用Date差值fallback。這兩條legacy路徑僅承諾穩定wall clock相容：沒有server anchor的wall後退仍可造成舊事件誤判；沒有performance的wall前跳可能過度老化。這些是既有legacy限制，本次沒有宣稱全部環境wall-jump免疫。現行五款遊戲與大廳API都提供serverNow，現行Chrome提供performance。

沒有真人弱網、喇叭聽感、所有遊戲phase或GitHub CI實證；初始server時鐘尚無錨點時不能由serverNow單獨推算傳輸延遲。原 PR 更新／重新審查狀態以GitHub頁為準；本輪未合併。畫猜順暢度仍是獨立研究／spec，沒有在本修正實作。
