# Gartic Phone 網路錄製方法與待驗證對照

查核日期：2026-10-05。角色：玩家研究／程式協作。範圍：Chrome DevTools 的 Network UI、HAR 與 WebSocket 訊息；尚未分析 Gartic Phone 的實際協議。

| 記錄欄位 | 現況 |
| --- | --- |
| 工作目錄／基線 | `BGA-pr30-review`；`fix/pr30-resource-limits`；查核時 HEAD `1b8c85dda17bb50ac86cc96193d11f54ec020c5e`。這是本機基線，不是正式部署證據。 |
| 結論類型 | 官方外部資料與官方程式事實；採樣方式是研究建議；Gartic 傳輸行為待驗證。 |
| 實測狀態 | **待錄製，尚未取得 Gartic HAR 或 WebSocket 訊息證據。** |
| 操作條件 | 使用者最新允許安裝官方擴充或改用其他瀏覽器，背景測試偏好仍有效。已確認 Chrome 擴充連線，並在隱藏的內建瀏覽器開啟 Gartic 首頁；兩者目前都未暴露網路錄製能力。已請使用者啟用官方 Developer mode，待其回覆與工具能力實際出現後再录製。 |
| 已有觀察邊界 | 前輪曾在原 Chrome 背景單席觀察 Masterpiece 填色、復原與相簿；那是介面觀察，不能據此宣稱知道傳輸頻率、命令格式、上傳內容或 server 實作。見 [PR #30 修正驗收](../PR30-RESOURCE-LIMITS.md)。 |
| 後續 owner／驗收 | 主 agent 在操作條件具備後錄製；研究／程式角色以實際檔案確認 coverage、訊息欄位與操作對應，再填入本文件的結果表。 |
| 舊結論替代 | 「背景工具當時沒有取得 HAR」仍成立；若曾將此解讀成「Chrome HAR 一定不包含 WebSocket 訊息」，應由下列官方 exporter 證據取代。未取得檔案前仍不能宣稱 Gartic 封包研究完成。 |

## 官方已查核內容

Chrome DevTools 的目前官方 exporter 會把 WebSocket 訊息寫入 HAR entry 的 Chrome 擴充欄位 `_webSocketMessages`，每則含 `type`、`time`、`opcode`、`data`。這是 Chrome 擴充，不是標準 HTTP request／response body；其他 HAR 讀取器可能忽略它。查核的是官方 `main` 原碼，錄製時仍須記錄實際 Chrome 版本，檢查匯出檔案是否含該欄位。[官方 HAR exporter](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/har/Log.ts#L157-L164)

官方文件描述 Network → WebSocket → Messages 表格顯示最近 100 則；目前底層 `frames()` 回傳陣列，新增訊息只追加，exporter 遍歷這個陣列。因此不能把 UI 的 100 則顯示範圍當作 HAR 的固定上限，也不能據此保證任意長期錄製永不遺失。[Messages 官方說明](https://developer.chrome.com/docs/devtools/network/reference/#frames)、[訊息保存原碼](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/NetworkRequest.ts#L1551-L1580)

HAR 候選請求會沿用 Network 篩選。握手已收到回應的 WebSocket 即使尚未關閉，也可納入匯出；未完成握手、未被記錄或被篩掉的連線不能假定已保存。[Network 匯出篩選](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/panels/network/NetworkLogView.ts#L1906-L1912)

Sanitized HAR 會去除指定的 Cookie／Set-Cookie／Authorization 標頭。**目前 exporter 仍保存 WebSocket `data`，不能把 sanitized 解讀為訊息內容已匿名化。** 同一原碼對 `_eventSourceMessages` 則會在 sanitized 模式省略 `data`；BGA 的 SSE payload 比較需要另核對 EventStream 或私有原始證據。原始 HAR、訊息、房碼與可能的身份／認證資料只存 Git 忽略的 `work/`，公開文件只放去敏摘要。[去敏及串流匯出原碼](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/har/Log.ts#L129-L181)

DevTools 協議的 WebSocketFrame 表示完整邏輯訊息，不是單一碎片或完整網路封包。文字內容是 UTF-8；非文字 payload 以 Base64 表示。計算 binary payload bytes 應使用解碼後長度，不能直接使用 Base64 字串長度，也不能把訊息大小當作包含 TLS、壓縮與協議 overhead 的線上傳輸量。[官方協議定義](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json)

## Codex 背景錄製的能力前提

2026-10-05 使用者追加允許使用其他瀏覽器或安裝官方擴充。Chrome 的現有擴充已連線；內建瀏覽器可用 `visible: false` 開啟 Gartic 首頁，沒有提高 Chrome。當時列出的 browser capabilities 是 `visibility`／`viewport`，tab capabilities 是 `pageAssets`／`webmcp`，未提供 CDP、Network 或 HAR API，因此尚未建立測試房間或錄製封包。

OpenAI 官方文件提供 Settings → Browser → Developer mode → **Enable full CDP access**，可用於 Chrome 或內建瀏覽器的網路檢查；使用網站的完整 CDP 前仍有明確授權步驟。已向使用者說明這個設定，等待啟用或回報選項不存在。能力未列出不等於能確定開關關閉，也可能受版本或管理政策影響；不能把文件中有功能寫成目前工具已可使用。[官方 Browser 說明](https://learn.chatgpt.com/docs/browser#developer-mode)、[官方擴充說明](https://learn.chatgpt.com/docs/chrome-extension)

接手時先確認使用者最新回覆，再透過官方工具重新列出 capabilities 並讀取實際 API 文件。若具備錄製能力，從新連線建立前開始記錄，依下列採樣表遊玩、保存私有檔案並核對 payload；不要靠任意腳本、其他連線方式或修改應用設定繞過未開放的權限。尚未取得 HAR 的狀態維持不變。

## 透過 Chrome UI 錄製與匯出

以下是官方方法整理，**目前尚未在本輪執行**；實際 UI 名稱以已安裝 Chrome 為準。

1. 在允許的 Chrome 分頁按 Windows **F12** 或 **Ctrl+Shift+I**，切換至 Network。也可使用 Chrome 選單的開發人員工具入口。[開啟 DevTools](https://developer.chrome.com/docs/devtools/open/)、[開啟 Network](https://developer.chrome.com/docs/devtools/network/overview#open)
2. 在建立測試連線前開啟 DevTools，確認 Network 正在錄製，勾選 **Preserve log**；開始前清除舊紀錄。DevTools 開啟前的請求不會補錄。若需 reload 才重新建立連線，先確認房間流程允許，避免中斷正在進行的操作。
3. 執行短而可辨識的操作，記下每次操作時間與畫面狀態；等待對應網路活動完成。需要跨頁保存時保持 Preserve log。查看 WebSocket 時選 WS、點連線、開 Messages；串流事件用 EventStream。
4. 準備匯出時選 **All**，清除文字／時間等篩選，確認完成送圖的 Fetch/XHR 與相關連線沒有被排除。只選 WS 匯出可能漏掉 HTTP 上傳。
5. 點 Network 的 **Export HAR (sanitized)**，或使用請求表右鍵的 HAR 儲存選項。將檔案保存到私有 `work/`；先檢查訊息與 payload 再產生公開摘要。
6. 若任務確實需要原始認證資訊或 sanitized 省略的串流 payload，官方提供 Settings → Preferences → Network 的敏感 HAR 選項；本次比較預設使用 sanitized，是否追加原始私有錄製應由實際所缺證據決定。不要為了看 WS 訊息就假定必須匯出敏感標頭。

步驟 2–6 來源：[Chrome Network reference：錄製／保留](https://developer.chrome.com/docs/devtools/network/reference/#record)、[匯出 HAR](https://developer.chrome.com/docs/devtools/network/reference/#save-as-har)。匯出成功本身不證明 payload 或所需 WebSocket 訊息完整，必須讀取檔案確認。

## 建議採樣與對照欄位

以下是研究方案，不是 Gartic 已觀測到的行為。先做短時間空閒基線，再以正常操作分別錄製畫筆、填色、復原與完成送圖；不做正式站高頻壓力測試。每個步驟留少量間隔，區分 heartbeat 與操作訊息。只有工具確實支援且操作已授權時，才加入另一個受控席觀察接收；單席 Masterpiece 的結果不能推廣成其他多人模式。

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

## 實測結果預留

本表保持待錄製；之後必須以實際證據替代狀態，不追加推測數字。

| 樣本 | 狀態／預期操作 | 實際訊息與結果 | 私有證據／coverage |
| --- | --- | --- | --- |
| G0 | 待錄製：空閒基線與連線建立 | 未觀察 | 未取得 HAR。 |
| G1 | 待錄製：普通畫筆 | 未觀察 | 未取得 HAR。 |
| G2 | 待錄製：全區及封閉區域填色 | 未觀察 | 未取得 HAR。 |
| G3 | 待錄製：復原上一步 | 未觀察 | 未取得 HAR。 |
| G4 | 待錄製：完成送圖／進入相簿 | 未觀察 | 未取得 HAR。 |
| B0 | 待另記錄：BGA 同等操作的傳輸對照 | 既有 renderer／兩席一致性驗收見 PR 文件；那不是本次 HAR 對照 | 不把既有 UI／API 測試當成本次新錄製。 |

後續每份證據至少記錄：操作者、實際日期／版本／模式、捕獲開始與結束、對應 action time、HAR 文件是否存在及其 SHA-256、`_webSocketMessages` 數量／方向／opcode、是否有 HTTP 完成上傳、payload 缺失、去敏方式與結論限制。可復現的行為先寫觀察，協議含義推論另外標示；未驗項目保持待驗證。

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

2026-10-05：首次建立官方方法與待驗證欄位；未操作瀏覽器、未錄製 Gartic 流量、未修改遊戲協議或正式服務。後續錄製者在本節追加日期、證據與替代結論，不把本輪研究狀態覆寫成沒有來源的「完成」。
