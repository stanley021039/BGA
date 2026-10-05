# 畫猜回看、等待狀態與共用動效

後續更新：2026-10-05 U28 的揭曉過半禁題已實作於 `2cf8a44`，同一 PR #34 接續；Windows／Linux 各431項及背景 Chrome 驗收見 [禁題進度](DRAW-WORD-BAN-PROGRESS.md)。下文402項保留為原批次的歷史證據。

日期：2026-10-05。狀態：程式 `93d7a84` 已完成本地與隔離 Linux 驗收，未部署。本批以 `3233ed4` 為基線；先前移轉功能已送 [PR #31](https://github.com/stanley021039/BGA/pull/31)，新工作位於 `feat/draw-review-motion`。使用者明確要求接續新動效、共用動畫規則、畫猜等待／離線提示及跨輪回看／收藏，並追加已猜中角色卡的圖示或高亮。

依據：[玩家試玩 PL-01／PL-02](research/PLAYER-PLAYTEST-ASSESSMENT.md)、[動效與素材方案](specs/ANIMATION-ASSET-PLAN.md)。桌機優先，重要名單、角色、比分維持可見；背景 Chrome 操作，不提高視窗。

已送審 [PR #34](https://github.com/stanley021039/BGA/pull/34)，base 為 `feat/server-data-transfer`；請先依序處理 #30／#31，再調整本批 base。未合併或部署。

## 實作與驗收表

| 分類 | 遊戲 | 內容與驗收條件 | 進度 |
| --- | --- | --- | --- |
| 資訊保存 | 你畫我猜 | 每次公開揭曉建立獨立 result ID、局別、作者、答案、得分與畫布快照；最近八輪有界保存，換輪／重連／新局不混用。未揭曉題目及候選不外洩。 | 已實作；HTTP／引擎測試通過 |
| 閱讀與收藏 | 你畫我猜 | 常駐回看入口，dialog 讀舊輪時當前遊戲繼續；收藏綁選定快照，失敗可重試，回覆延遲或重送不錯存／重複新增。關 dialog 正確返焦。 | 已實作；跨兩輪 Chrome 收藏及 PNG 比對通過 |
| 等待原因 | 你畫我猜 | 名單同時顯示角色、猜題進度及離線；已完成 X/Y、剩餘玩家與本人重連異常直接可見。保留現有 15 秒規則，不顯示常駐「已連線」。 | 已實作；3／8 席與受控失聯通過 |
| 完成辨識 | 你畫我猜 | 已猜中卡增加共用 SVG 勾選小章、淺綠底及邊框；保留狀態文字，換輪清除，未參與者不誤標。 | 已實作；Chrome 同時顯示已猜中與離線、VM 換輪清除通過 |
| 共用動畫規則 | 整體遊戲 | 新確認事件只播一次，首次／重連／隱藏回來不補播；去重有界、取消／cleanup，系統減少動態及使用者偏好適用。必要文字與結果保留。 | 已接五款遊戲；lifecycle／減動／雷霆字卡回歸通過 |
| 彈幕 | 整體遊戲 | 文字與 emoji 共享四軌密度，提供個人顯示／隱藏控制；不改角色表情，不讓歷史快照補播彈幕。 | Chrome 四軌／開關／靜態及模型時鐘測試通過 |
| 事件回饋 | 送禮達人 | 新收禮事件出現時一次入場；renderer 重建不重播；收禮者確認仍決定下一位，全部收完才顯示總分。 | 已實作；實際確認收到兩張 700ms WAAPI，重建／結算回歸通過 |
| 事件回饋 | 你畫我猜 | 保留猜中／階段提示，收藏成功只在 server ACK 後呈現短回饋，減動仍可讀；動畫不阻塞筆畫、猜題與期限。 | ACK／延遲／減動／SSE 與 BFCache 恢復測試通過 |

## 邊界

本批不增加勝場統計、成就規則、YouTube、正式資料遷移或自動部署。公開回看是目前房間內的有限快照；已收藏作品使用既有私人圖庫，房間刪除不刪已收藏作品。

## 回看與收藏契約

- 揭曉才建立 `resultId/gameRunId/canvasEpoch`，答案、作者姓名、當輪得分／累計分數與筆畫一同凍結。`recentResults` 只傳最近八輪的 metadata；畫布另由 `GET /api/draw/result?code&resultId` 讀取，避免每次輪詢帶八份畫布。快照不進每筆遊戲歷史 serialization。
- 八輪上限跨同一房間的新對局保留，最舊輪淘汰；房間結束生命週期或服務重啟即失去尚未收藏的快照。回看者必須仍有正常座位，踢出者無權限。作者 avatar 是當時 URL；`/characters/<id>` 的圖像可能隨個人外觀改變，不能當永久圖像封存。
- `POST /api/draw/result/save` 帶選定 `resultId` 與由獨立 canvas 產生的 PNG。伺服器依結果命名，同帳戶重送回原作品 ID；舊收藏若已刪，須明確重新收藏。結果淘汰後回 404，不改存新輪。每輪收藏紀錄最多 256 人，每個帳戶仍受既有頻率與 100 件作品上限控制。
- 沿用原圖庫的圖片上傳信任模型：伺服器驗圖片格式、權限與結果身分，沒有重繪比對 PNG 像素。私人作品不自動公開；dialog 閱讀不暫停其他玩家。

## 動效契約

`MotionPolicy` 集中個人 `enabled/barrages` 偏好、系統減少動態、visibility、動畫清理與有界事件去重。新收到的伺服器事件可以播放；首次載入、重連、切回分頁與長間隔恢復先建立基準。動畫結束不能觸發規則結算。

文字與 emoji 共用四軌，滿軌直接略過，不排隊在下一階段補播；動態移動八秒，減少動態時靜態顯示五秒，關閉彈幕則立即清除。角色表情沿用原有設定。送禮入場、畫猜收藏成功與既有同頻／雷霆／撲克動效接共用設定；必要答案、得分、骰面及道路事件文字仍可讀。

## 驗收紀錄

| 層次 | 證據與結果 |
| --- | --- |
| 完整自動測試 | Windows Node 24.14.0、隔離 Linux Node 22.22.1 各 `npm test` **402/402**，零失敗／跳過。打包 469 個程式／測試檔，兩端來源 SHA 驗證一致；未打包 work、DB 或認證資料。 |
| 後端權限與成本 | 10 項新公開結果測試涵蓋秘密、early finish、跨局、復座當輪得分、八輪淘汰、晚到／並發重送、100 件額度、刪除後明確重收、late join／kicked、PNG／body／origin／rate。八份最大工作量快照共 240,000 點，JSON 3,118,598 B；同場景 state 15,646 B、room serialization 16,671 B，沒有八份筆畫進輪詢／歷史。這是序列化大小，非 V8 heap 量測。 |
| 前端協議 | 畫猜五套 51 項：固定畫作 PNG、選擇逆序回覆、換房 pending、跨輪 ACK、明確重收、SSE 重連、BFCache 恢復、已猜中勾選與離線、未參與者。共用測試另驗 gate/seen/animation 上限、四軌溢出不排隊、減動靜態五秒、cleanup、送禮同 version social poll 與重建不重播。 |
| Chrome 等待與恢復 | 原 Chrome 背景，本機合成帳戶。第 1 輪一席透過 UI 猜中，等待區顯示 1/2 及剩餘姓名；暫停另一席心跳後顯示「尚未猜中 · 暫時離線」。官方 CDP 模擬此分頁離線，看到本人的重連提示，草稿保留；恢復後異常提示隱藏，未恢復全頁已連線標籤。 |
| Chrome 跨輪收藏 | 揭曉剩約 2 秒開說明，背後換至第 2 輪；關閉後可回看第 1 輪。第 3 輪收藏第 1 輪，預覽 PNG 與圖庫檔 SHA256 相同；reload 後重試，作品數仍為 1。新對局標成「先前對局」，答案／畫者／當輪分數仍正確。Esc 返回回看入口。 |
| Chrome 動效與彈幕 | 收禮 2/3 由本席按確認，下一位兩張卡有 duration 700 的 WAAPI；未用牆鐘推論實際 GPU 幀率。密度驗收三席每兩秒送六則，最多四軌（12/30/48/66%）且使用 `game-barrage-travel`；關閉立即為 0。UI 關閉動畫及 CDP 模擬 OS reduce，彈幕呈靜態且保留文字。模擬及偏好已還原。 |
| Chrome 版面 | 1280×720／3 席：頁高 720，猜者畫布 850×423，名單 y634–705；回看及設定浮層都在視窗內。8 席同尺寸頁高 789，需要約 69px 垂直捲動，保留畫布與14px文字。1767×1252 八席完整可見。390×844 回看 dialog x19–356、y34–810，無水平溢出，關閉按鈕44px；手機允許垂直捲動。 |

主要 UI 由一個 Chrome 席位操作，其他席位、選題及部分幾何輪廓由 HTTP API 準備；第二輪另以 Chrome 方向鍵／空白鍵實際作畫。這不是八台真人設備或真人滿意度調查。BFCache 的兩個回歸在 VM／真 raster 測試驗證，未聲稱 Chrome 命中 BFCache 實測；沒有完成各款新一輪真人弱網遊戲或重做跨設備彈幕效能結論。

過程修正：原得分者離席再復座不再把舊累計算入當輪分；未揭曉而提前結束不洩露答案；BFCache 不永久停用 gate 或留空白揭曉畫；舊猜測 ACK 不覆蓋新輪草稿／提示；late join 在結束時標本輪未參與。

私人證據位於 ignored `work/`：`draw-review-motion-tests-{windows,linux}.log`、`draw-review-motion-source-manifest.json`、`draw-waiting-offline.png`、`draw-review-full.png`、`draw-collection-proof.json`、`draw-guessed-card.png`、`gift-confirm-animations.json`、`gift-static-barrage.png`。帳密只在私有 fixture／交接，公開文件不附短期房碼。

收尾：Chrome 另確認最後收禮者接受後才出現全桌總分及完整禮物明細。3192 合成測試服務與心跳已停止，Linux source-only 臨時目錄再次驗 SHA 後清除；保留私有帳戶 fixture／證據及原有管理者 UI 3170。未更動正式房間或使用者原 Chrome 分頁。

採用前重新核對 [MDN Animation.cancel](https://developer.mozilla.org/en-US/docs/Web/API/Animation/cancel)、[Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)、[prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) 及 [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)。本批重用既有美術與共用 SVG，沒有新下載／購買素材或圖片模型輸出，也不宣稱全站 WCAG 合規。
