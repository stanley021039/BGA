# 雷霆 WebGL 立體骰子：研究與驗收進度

2026-10-07：正式 v1.13.0 已發布，受測程式／本地 immutable tag 固定在 353d8b6f18f73dba550873ab1506fc33542c9f7d。規格見 [RACE-DICE-WEBGL](specs/RACE-DICE-WEBGL.md)。本文件下方只記本次證據，不沿用其他特效的驗收數。

| 項目 | 已完成內容 | 證據與邊界 |
| --- | --- | --- |
| 研究與角色討論 | MDN／Khronos 的 cube、textures、lighting、context lifecycle、效能邊界與 reduced motion；程式／美術／設計共同檢查。 | 原始來源與採用方式在 spec。沒有新增框架、套件、素材下載或外部動畫服務。 |
| 立體骰子 | 原創 WebGL shader、六面 cube、512×512 atlas，pips、方向箭頭、進入／原位短詞、射擊／火焰特殊面。 | 只在 result 傳入公開結果；rolling 僅用可能骰面。不能用動畫決定點數或規則。 |
| 對齊與可讀性 | offsetParent／局部捲動座標、真 draw 才替換 DOM、rolling 投影 fit 留 1px；結果維持原尺寸。 | 15 renderer tests 包含 21 姿态×8 頂點界線；清空時隱藏舊 canvas，避免窄視窗產生錯誤捲軸。 |
| 資源與回退 | 整頁與車旁特效共用兩個 context；骰子單一 canvas、最多32顆、750000pixels／DPR≤1.5；idle零 RAF。 | 首版150000pixels在958×443使DPR0.5945而模糊，已提高至750000。此限額不表示任何硬體 FPS 結論。 |
| 權限／時序 | 原一秒屏障、owner 擲骰／確認／重擲、音效去重保留；無新增伺服器事件。 | 回合骰維持既有自動開始流程；需玩家擲骰的特殊檢定保留按鈕。沒有更改玩法／機率／資料 schema。 |
| 三席真遊戲 | 隔離 server 三個會員：13回合骰、真碰撞 move→awaiting→手按 roll→result。 | 點數和特殊面結果與 server 一致；碰撞原位車／後左正確；原生 GPU readPixels 有2801個非透明像素，24角度／位置 samples。這不是 FPS 測試。 |
| 最終原生 fixture | Chrome 四隊17骰；17 actual covered anchors；結果17 drawCalls且零 RAF；450ms姿態畫面。 | 450ms姿態為隔離 fixture 暫停 RAF 的單姿態驗收，已還原；不能當成自然時間或真 server 全四席流程。 |
| 捲動／縮放 | 390×740真碰撞結果及390×500最終17骰；局部scroll170px後GPU中心與DOM中心誤差x=0/y=0，沒有橫向溢出。 | 短視窗保留必要局部scroll與可見footer；不是實體手機或200%文字／browserzoom驗收。 |
| GPU／動態政策 | 真 Chrome reduced media 回退；WEBGL_lose_context回退；context lost仍占原預算，第三個拒絕。 | fallback可見／canvas none／零RAF；context budget第二接受第三拒絕。最終改動只增加rolling fit；hidden亦有VM取消測試，原生換另一工具分頁仍hidden=false，故未把這次操作當hidden通過。 |
| Windows完整 | Node24.14.0完整通過，最終数量與時間見下方發行紀錄。 | 先前1407通過為增加rolling fit之前的中間結果，不當最終數。 |
| Linux／正式 | Node22.22.1完整1408／1408，213602.951906ms，fail/cancel/skip/todo各0；零房間切換後，公開7份資源精確source／no-store／MIME與三席API／Chrome通過。 | 最终source 353d8b6；正式13骰，result active13、drawCalls13、零RAF；不宣稱真正式四席17骰／所有特殊檢定或FPS。 |

原生測試圖片與原始log只在私有 work 保存；程式碼、規格與角色記憶不含帳密、cookie、token、本機偏好或完整HAR。正式資料檢查須使用本次新鮮備份，不能沿用討論區啟用前的空資料。

最終Windows：Node24.14.0，1408/1408，39596.7642ms；fail/cancel/skip/todo各0。程式打版1.13.0／schema16不變；兩平台均通過後建立immutable annotated tag，後續文件不移動tag。


## 發行與資料紀錄

- 程式／tag：353d8b6f18f73dba550873ab1506fc33542c9f7d；發布包SHA256：03041ca4af48fdfa937a8f53017376ffa0d1271e02fb0804cbc61b9426c003ef。沒有新增PR／push，不代表合併任何其他分支。
- 正式current：releases/353d8b6；零房間guard UTC 2026-10-07T15:03:42.830Z，PID147993→151238；service／tunnel active，local login／api/version與公開版號v1.13.0通過。
- 新鮮備份：/home/ccc/apps/afterhours/shared/backups/pre-dice-webgl-353d8b6-20261007T150314Z-5a349826-cc55-4442-908a-63328ad6284b。SQLite online backup與另時點檔案archive不是cold atomic snapshot。副本boot／schema預演／22表逐列與BLOB核對通過。
- 正式schema16、22schemas／21non-session表所有rows及BLOB、9帳戶allfields／13市場圖片保留；integrity ok、FK0。討論區1issue／1comment／3done submissions保留，正式私有環境檔byte hash不變，GitHub同步設定保持；沒有新送GitHub測試留言。
- sessions221→225是guard與三席測試登入；自有測試登入已logout且auth/me401，不宣稱session表不變。
- 公開三會員的round13骰：rolling不含result、crew dice在確認前遮罩、三席結果一致、非owner不能擲骰／確認；確認後12顆玩家骰才公開。own房已刪除且state404；等待／未完成測試對局的history保留，不去刪正式持久資料。
- 同一Chrome背景，原生正式頁經自有會員代理讀真正式HTML／JS與API，result active13／drawCalls13／零RAF；設定與畫猜等其他玩法沒有本次新增的逐項native驗收。
- 所有自有分頁、臨時螢幕／media overrides、GPU probe、3500–3503／3506隔離server、3511–3513正式代理都清理。證據圖為dice-webgl-production-proof.png與17骰450ms定格；圖片／原log／憑證只放私有work。

限制：沒有實體手機、200%文字／browserzoom、跨機／弱網、自然全局多輪、讀屏或FPS排行；原生hidden操作未造成document.hidden變true，因此hidden只記VM取消回歸。這些不能由完整test數或定格圖片代替。
