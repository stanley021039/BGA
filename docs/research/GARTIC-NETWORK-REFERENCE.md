# Gartic Phone 網路錄製與 BGA 對照

2026-10-07新增對照：最新产品基線v1.7.1／`3d82e3f`，Chrome官方Masterpiece持筆24則＋放開後1則累積向量更新，本站隔離雙席25點持筆0POST、放開才送，另量人工回覆延遲佇列。完整新樣本／HAR缺漏／像素待查見 [最新順暢度研究](GARTIC-BGA-DRAWING-COMPARISON.md)，改善提案見 [spec](../specs/DRAWING-SMOOTHNESS.md)。下方2026-10-05是不同基線／條件的歷史，不能當作目前效能或正式站部署證據；本輪未改產品。

查核日期：2026-10-05。角色：主 agent 實玩與核對、玩家研究 agent 匯出與分析。已透過官方 CDP 在隱藏的內建瀏覽器實玩單席 Masterpiece（傑作），取得 WebSocket 訊息並離線匯出 HAR。本文件區分實際觀察、官方方法及未測項目。

| 記錄欄位 | 現況 |
| --- | --- |
| 工作目錄／基線 | 私有錄製在 `BGA-draw-guess/work/`；BGA 程式對照為 PR #30 的 `3b19720`，本地整合為 `e71989e`。不是正式部署證據。 |
| 環境 | 隱藏內建瀏覽器、1280 × 720、單席匿名 Masterpiece。request User-Agent 回報 Chrome **154.0.0.0**；未取得獨立 Browser.getVersion 結果。 |
| 實測狀態 | **已錄製、匯出並分析。** 來源是官方 tab CDP `Network` 事件；HAR 由私有 Node 工具轉換，並非點 Chrome DevTools 的 Export HAR。 |
| 操作條件 | 使用者明確要求用 Computer Use 開啟完整 CDP；設定 UI 已開啟，重建工具連線後 capability 出現。遊戲全程在隱藏分頁，結束後返回首頁、停錄並關閉測試分頁。 |
| 有效範圍 | 穩定游標起點 **05:42:35.175 UTC**，結束 **05:47:08.878 UTC**，24 個採樣批次均無 `truncated`。早期載入／進房有 6 個標為 `truncated` 的批次，該段覆蓋不可靠，不能宣稱整段完整。 |
| 舊結論替代 | 本次證據取代「尚未取得 HAR／等待設定」的現況；前輪 Chrome 單席操作仍只屬 UI 觀察。多人接收、重連及 server 內部策略仍未驗證。 |

## 官方已查核內容

Chrome DevTools 的目前官方 exporter 會把 WebSocket 訊息寫入 HAR entry 的 Chrome 擴充欄位 `_webSocketMessages`，每則含 `type`、`time`、`opcode`、`data`。這是 Chrome 擴充，不是標準 HTTP request／response body；其他 HAR 讀取器可能忽略它。查核的是官方 `main` 原碼，錄製時仍須記錄實際 Chrome 版本，檢查匯出檔案是否含該欄位。[官方 HAR exporter](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/har/Log.ts#L157-L164)

官方文件描述 Network → WebSocket → Messages 表格顯示最近 100 則；目前底層 `frames()` 回傳陣列，新增訊息只追加，exporter 遍歷這個陣列。因此不能把 UI 的 100 則顯示範圍當作 HAR 的固定上限，也不能據此保證任意長期錄製永不遺失。[Messages 官方說明](https://developer.chrome.com/docs/devtools/network/reference/#frames)、[訊息保存原碼](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/NetworkRequest.ts#L1551-L1580)

HAR 候選請求會沿用 Network 篩選。握手已收到回應的 WebSocket 即使尚未關閉，也可納入匯出；未完成握手、未被記錄或被篩掉的連線不能假定已保存。[Network 匯出篩選](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/panels/network/NetworkLogView.ts#L1906-L1912)

Sanitized HAR 會去除指定的 Cookie／Set-Cookie／Authorization 標頭。**目前 exporter 仍保存 WebSocket `data`，不能把 sanitized 解讀為訊息內容已匿名化。** 同一原碼對 `_eventSourceMessages` 則會在 sanitized 模式省略 `data`；BGA 的 SSE payload 比較需要另核對 EventStream 或私有原始證據。原始 HAR、訊息、房碼與可能的身份／認證資料只存 Git 忽略的 `work/`，公開文件只放去敏摘要。[去敏及串流匯出原碼](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/har/Log.ts#L129-L181)

DevTools 協議的 WebSocketFrame 表示完整邏輯訊息，不是單一碎片或完整網路封包。文字內容是 UTF-8；非文字 payload 以 Base64 表示。計算 binary payload bytes 應使用解碼後長度，不能直接使用 Base64 字串長度，也不能把訊息大小當作包含 TLS、壓縮與協議 overhead 的線上傳輸量。[官方協議定義](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json)

## 本次背景錄製方式

2026-10-05 初次能力檢查只有 `visibility`／`viewport` 與 `pageAssets`／`webmcp`。使用者接著明確要求直接開啟設定；透過 Windows Computer Use 在 Codex 的 Settings → Browser → Developer mode 啟用 **Enable full CDP access**。重設 CUA 工作階段並重新連線後，官方 tab `cdp` capability 出現且 `Network.enable` 成功。Chrome 原有擴充已連線，本次不需重新安裝。[官方 Browser 說明](https://learn.chatgpt.com/docs/browser#developer-mode)、[官方擴充說明](https://learn.chatgpt.com/docs/chrome-extension)

正常 UI 建立自己的匿名房間與作畫，不改遊戲內部狀態。每次操作記錄 wall time，讀取 `Network.*` 事件、保存 cursor 並處理分頁。早期跨 cell 採樣重用了舊游標；穩定階段改用單一可變物件保存游標。分析以 source＋sequence 去重並依 sequence 排序，時鐘採同 source 的 monotonic／wall anchor 對齊，不能把工具回傳時間當封包發送時間。

原始 6,943 個事件去除 814 個重複後為 6,129 個，sequence 衝突為 0。轉換保存 1,162 個請求／連線觀察：1,035 個放入 `log.entries`，缺少必要資料的 127 個保留在 `_partialEntries`。WebSocket 為 1 條，保留 31 則送出、26 則收到的 `_webSocketMessages`。沒有另外擷取 HTTP response body；沒有做 Chrome HAR 匯入 UI 驗收。這是可檢查的捕獲紀錄，不是完整頁面重播包。

匯出器 10/10 合成測試通過；實際 HAR 的 1,035 entries 依 [HAR 原作者的 Viewer schema](https://github.com/janodvarko/harviewer/blob/master/webapp/scripts/preview/harSchema.js)、必要 timing 及 57 則 WS 格式檢查，錯誤為 0。未取得的 bytes 仍為 `-1`；採用 Chrome 官方無 ResourceTiming 的相容表示時，`send=0` 明標為佔位，原始未知值留在 `_observedTimings`，不可用來宣稱實際發送耗時為零。WS 的 GET method 採 [官方 NetworkManager 的握手慣例](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/NetworkManager.ts)，HTTP/1.1 由捕獲的握手文字取得。

## 透過 Chrome UI 錄製與匯出

以下保留官方 Chrome UI 方法，供日後錄製使用；**本輪使用上節的官方 CDP，而未執行此匯出 UI**。實際 UI 名稱以已安裝 Chrome 為準。

1. 在允許的 Chrome 分頁按 Windows **F12** 或 **Ctrl+Shift+I**，切換至 Network。也可使用 Chrome 選單的開發人員工具入口。[開啟 DevTools](https://developer.chrome.com/docs/devtools/open/)、[開啟 Network](https://developer.chrome.com/docs/devtools/network/overview#open)
2. 在建立測試連線前開啟 DevTools，確認 Network 正在錄製，勾選 **Preserve log**；開始前清除舊紀錄。DevTools 開啟前的請求不會補錄。若需 reload 才重新建立連線，先確認房間流程允許，避免中斷正在進行的操作。
3. 執行短而可辨識的操作，記下每次操作時間與畫面狀態；等待對應網路活動完成。需要跨頁保存時保持 Preserve log。查看 WebSocket 時選 WS、點連線、開 Messages；串流事件用 EventStream。
4. 準備匯出時選 **All**，清除文字／時間等篩選，確認完成送圖的 Fetch/XHR 與相關連線沒有被排除。只選 WS 匯出可能漏掉 HTTP 上傳。
5. 點 Network 的 **Export HAR (sanitized)**，或使用請求表右鍵的 HAR 儲存選項。將檔案保存到私有 `work/`；先檢查訊息與 payload 再產生公開摘要。
6. 若任務確實需要原始認證資訊或 sanitized 省略的串流 payload，官方提供 Settings → Preferences → Network 的敏感 HAR 選項；未來 Chrome UI 採樣預設使用 sanitized，是否追加原始私有錄製應由實際所缺證據決定。本次 CDP 原始 HAR 未去敏。不要為了看 WS 訊息就假定必須匯出敏感標頭。

步驟 2–6 來源：[Chrome Network reference：錄製／保留](https://developer.chrome.com/docs/devtools/network/reference/#record)、[匯出 HAR](https://developer.chrome.com/docs/devtools/network/reference/#save-as-har)。匯出成功本身不證明 payload 或所需 WebSocket 訊息完整，必須讀取檔案確認。

## 採樣與對照欄位

本次按正常操作分別錄製畫筆、填色、復原及完成送圖，步驟間保留可辨識的時間窗；未做第三方正式站壓力測試。下列欄位是重現與後續比較規格，實際結果另列於下一節；單席 Masterpiece 不能推廣成其他多人模式。

| 對照欄位 | 如何記錄／用途 |
| --- | --- |
| 日期、Chrome 版本、遊戲模式、席數、role、畫布尺寸 | 確認樣本環境與是否能與 BGA 比較；版本／模式不得省略。 |
| 操作名稱、相對時間、顏色、座標、動作前後畫面 | 使用可重現的畫筆、全區填色、封閉區域填色、復原、完成送圖，對齊行為與流量。 |
| Transport、連線識別、URL 路徑、method、handshake status | 判斷承載行為的是 WebSocket、HTTP、串流或未出現網路活動；身份參數去敏。 |
| WS 發送／接收方向、時間、opcode、payload bytes、訊息數、間隔 | 計算操作後訊息量；文字算 UTF-8 bytes，binary 先解 Base64；扣除已辨識的空閒流量。 |
| Payload 的 event 名稱、版本／序號、stroke／batch／request ID、ACK | 只列實際存在且可確認的欄位；找命令、批次及確認關係，不憑名字猜含義。 |
| Payload 是少量命令、座標批次、完整歷史、圖片或不透明 binary | 需要實際內容或解碼證據才能分類。無法辨識時標未知，不能把「很大」直接叫完整畫布。 |
| HTTP Content-Type、request body bytes、response status／body、timing | 比較完成送圖是否有獨立上傳，以及是否成功；不要只數 WS 事件。 |
| 圖片 MIME、編碼、寬高與內容 digest（若存在） | 檢查是否為完整畫作及前後差異；公開文件保存摘要，不貼原始私人作品。 |
| 重連／reload 後的資料與畫面（另案，若執行） | 判斷初次恢复形式；與連續作畫分開評估，不由 undo 推論恢復協議。 |
| Coverage、missing payload、篩選與背景節流 | 說明是否從連線建立前錄起、是否包含 WS 擴充欄位、是否只單席，以及未取得的證據。 |

核心問題是「每次填色／復原實際傳了什麼、何時傳、對方收到什麼、完成時是否另送圖片」。若某次操作後沒有相關訊息，只能記錄該模式與觀察期間沒有匹配事件；不能直接斷言所有模式都是本地完成後一次送圖。

HAR 可支持瀏覽器側的傳輸觀察，不能單獨證明 Gartic server 如何存圖、合併筆畫、限制資源或重繪畫布。BGA 的 CPU／canvas 工作仍用自己的 renderer metrics 與畫面一致性測試判斷，不能拿 HAR bytes 推導填色演算法複雜度。

## 實測結果

以下 bytes 是 UTF-8 WebSocket **邏輯訊息內容**，包含 Engine.IO／Socket.IO 文字封套，排除可辨識的 1-byte ping／pong；不是 TLS、壓縮、frame overhead 或實際線上流量。操作窗到下一個 action 為止，大小是這一次樣本，不能當成平均傳送率。

| 樣本 | 正常 UI 操作 | 實際訊息與結果 | 證據邊界 |
| --- | --- | --- | --- |
| G0 | 穩定游標起點至畫筆的 25.69 秒空閒觀察窗 | 0 則遊戲操作訊息；1 次 ping／pong。 | 顯式 idle 採樣約 3 秒，其餘是操作前的等待；早期握手捕獲不能補足所有載入缺漏。 |
| G1 | 畫一條黑色筆畫 | 2 則，57＋100 bytes，`{t,d,v}` 含顏色／座標向量。第二則包含第一則向量前綴及更多座標。 | 是目前筆畫的更新；不能宣稱每則只傳全新的點。 |
| G2 | 畫黑色外框矩形，再填藍色 | 外框 1 則 66 bytes；封閉區填色 1 則 64 bytes。 | 填色為短命令／向量；畫面確認只有框內變藍。 |
| G2 | 清回空白後，填滿全畫布 | 1 則 61 bytes，短命令／向量。 | 本次沒有每次填色附上全部筆畫歷史。 |
| G3 | 復原區域填色、逐步復原外框／筆畫、復原全畫布填色 | 每次 1 則 27 bytes，`v` 為 scalar；全畫布填色 redo 1 則 61 bytes，向量與原 fill 相同。 | 沒有由 undo 推論重連還原方式。 |
| G4 | 按 Done，再進入相簿 | Done 1 則 13 bytes，完成狀態為 boolean；相簿收到的畫作 `data` 為 1 個繪圖命令，與最後保留的 fill 向量相同。 | 已觀察訊息中不是圖片 payload。完成／相簿窗的遊戲相關 HTTP 為 GET／HEAD，未見 POST；未抓 response body，不能擴大為所有模式或 server 儲存方式。 |
| B0 | BGA 同等操作的比較 | 程式檢查確認已用 POST stroke＋SSE stroke 增量；既有 renderer／兩席一致性見 PR 文件。 | **未另錄 BGA HAR**；不能比較兩者實際延遲或頻寬。 |

文字封套的判讀對照 [Socket.IO protocol](https://github.com/socketio/socket.io-protocol) 與 [Engine.IO protocol](https://github.com/socketio/engine.io-protocol)；未替 Gartic 的數字事件 ID 或 `t`／`d`／`v` 杜撰完整規格。單席沒有另一位玩家的接收證據，未測重連、未量 CPU，也不能由 HAR 推斷 server 的填色演算法、快照或資料保留策略。

## 對 BGA 修正的意義

本次命令與座標內容支持以操作更新畫作的方向。BGA 在 `src/app.js` 的 `draw/stroke` 已只 publish 新 stroke；`public/draw.js` 接到連續版本時追加，缺版再取 `draw/canvas` 快照。因此 PR #30 的重點是 **收到增量後不重播全部歷史**、恢復分批處理，以及對身份／歷史／昂貴填色設定上限。不能把這份 HAR 當成 BGA 必須換 WebSocket 的證據，也不能拿小 payload 宣稱填色沒有 CPU 成本。既有量測與限制見 [PR 修正驗收](../PR30-RESOURCE-LIMITS.md)。

## 私有證據與重現

原始事件、HAR、圖像與轉換器均在 `BGA-draw-guess/work/`，不加入 Git。HAR **未去敏**，不能直接公開；此文件只保存去敏的結構、數量與結論。

| 私有檔案 | 用途 |
| --- | --- |
| `gartic-cdp-capture-2026-10-05.json` | 原始事件、action 時間及批次 coverage。 |
| `gartic-cdp-capture-2026-10-05.har` | 官方 CDP 事件的離線 HAR 匯出，包含 WS 擴充與 partial observations。 |
| `gartic-cdp-capture-2026-10-05-summary.json`、`gartic-cdp-analysis-2026-10-05.json`、`gartic-cdp-validation-2026-10-05.json` | 整體 coverage、操作窗、訊息結構、格式驗證與檔案雜湊。 |
| `cdp-network-to-har.cjs`、`cdp-network-to-har.test.cjs`、`gartic-cdp-analysis.cjs`、`validate-cdp-har.cjs` | 私有離線匯出／分析工具及合成回歸測試。 |
| `codex-cdp-enabled.png`、`gartic-har-region-fill.png`、`gartic-har-album.png` | 設定已開啟、區域填色、完成相簿的畫面證據。 |

從專案根目錄重現匯出：

```sh
node work/cdp-network-to-har.cjs work/gartic-cdp-capture-2026-10-05.json work/gartic-cdp-capture-2026-10-05.har work/gartic-cdp-capture-2026-10-05-summary.json
node --test work/cdp-network-to-har.test.cjs
```

SHA-256：原始 JSON `b51db57831d9c2d95ed3fd2adedac7226950f37f9388f8b81024652ac3a2e97f`；HAR `15bc95375b8073368d670fb251c0edbddb7c179f45610c1441fe7aaca34e2a20`。主 agent 已重新核對這兩個檔案雜湊並重跑 10 項匯出器測試。

## 來源與更新紀錄

外部來源包括 Chrome 官方文件、ChromeDevTools 官方程式／協議及 OpenAI 官方瀏覽器文件，查核日 **2026-10-05**。原碼連結使用 `main`／`master`，不是保證未來不變的 release snapshot；下一次實際採用或 Chrome 版本變動時重查。

| 來源 | 查核用途 |
| --- | --- |
| [Open Chrome DevTools](https://developer.chrome.com/docs/devtools/open/) | Windows UI 入口與快捷鍵。 |
| [Network overview](https://developer.chrome.com/docs/devtools/network/overview) | 開啟 Network、錄製前提。 |
| [Network reference](https://developer.chrome.com/docs/devtools/network/reference/) | Preserve log、Messages／EventStream、篩選與 HAR 匯出。 |
| [HAR Log.ts](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/har/Log.ts) | WS 擴充欄位、指定標頭去敏與 SSE payload 限制。 |
| [NetworkRequest.ts](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/NetworkRequest.ts) | 訊息方向、保存陣列、時間與 payload 來源。 |
| [NetworkLogView.ts](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/panels/network/NetworkLogView.ts) | 匯出篩選與尚未關閉 WS 的納入條件。 |
| [DevTools browser protocol](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json) | 完整邏輯訊息、文字／Base64 的含義。 |

2026-10-05 初版只整理官方方法，當時未錄製。後續依使用者明確指示開啟 CDP，完成本文件列出的背景單席實錄；原始缺漏保留並標明穩定採樣窗，取代先前待錄製狀態。沒有修改第三方遊戲、BGA 正式服務或正式資料。
