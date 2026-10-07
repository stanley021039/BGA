# 雷霆 WebGL 立體骰子：研究與驗收進度

2026-10-07：候選 v1.13.0，產品程式完成，正式切換與 Linux 完整驗收待補。規格見 [RACE-DICE-WEBGL](specs/RACE-DICE-WEBGL.md)。本文件下方只記本次證據，不沿用其他特效的驗收數。

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
| Linux／正式 | 待固定 source、Linux完整、資料備份、零房間切換及公開驗收。 | 沒有完成前不宣稱上線。 |

原生測試圖片與原始log只在私有 work 保存；程式碼、規格與角色記憶不含帳密、cookie、token、本機偏好或完整HAR。正式資料檢查須使用本次新鮮備份，不能沿用討論區啟用前的空資料。

最終Windows：Node24.14.0，1408/1408，39596.7642ms；fail/cancel/skip/todo各0。程式打版1.13.0／schema16不變，Linux候選尚未驗，不先建立tag。

