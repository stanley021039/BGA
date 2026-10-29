# #311 近期版本效能比較

2026-10-27，固定 Linux VM（2 vCPU）與 Windows／24 logical cores／RTX 3060 Ti client，Chrome 156.0.8078.48。五版各跑三輪；順序為 3.6→3.7→3.8→3.9→3.11.1、反序、再正序。每次啟動固定 commit 的獨立測試站，結束即關閉並清除合成帳號／暫存 DB；原共用測試站與正式站均未切換。

共同情境為 1920×1080、10 個獨立登入 context，冷載／同 profile 重載、10 秒閒置，以及兩波十人 Q／E 特效與移動。以下是大廳／共用特效負載的跨版本比較；各遊戲對局、觀戰及教學的專屬負載仍待另行量測。

15／15 輪有效，來源與編譯 manifest 前後一致；每輪十位玩家都實際發動特效，每個 client 都建立動畫 canvas。特效投遞率均 100%；非預期 HTTP 錯誤均 0。原始報告採用同一 harness／瀏覽器／CPU／GPU／Node 與情境參數，相容性檢查均通過。

## 延遲與資料傳遞量

數值為三輪中位數，括號為最小–最大。API 與同步延遲是各輪 p95 的中位數。冷載／重載為十人合計下載，包含載入與穩定等待期間的 API 輪詢，並非純靜態 bundle 大小；特效流量按實際時間及十人平均正規化。

| 版本 | API p95 ms | 同步 p95 ms | 特效 KiB／人／秒 | 冷載 MiB | 重載 MiB |
|---|---:|---:|---:|---:|---:|
| 3.6.0 | 32.1（28.2–33.5） | 63（59–200） | 16.9（16.8–17.8） | 30.30（29.84–30.69） | 1.38（1.08–1.44） |
| 3.7.0 | 30.8（28.7–35.6） | 285（100–321） | 17.6（16.9–17.9） | 30.98（29.60–31.46） | 1.40（1.01–1.55） |
| 3.8.0 | 30.9（29.7–37.2） | 73（58–330） | 17.5（16.9–17.9） | 31.73（30.15–32.07） | 1.57（1.14–1.66） |
| 3.9.0 | 32.8（32.6–33.9） | 65（64–209） | 17.5（17.0–17.9） | 31.49（30.20–31.93） | 1.55（1.15–1.58） |
| 3.11.1 | 32.0（28.5–32.1） | 241（59–254） | 17.2（16.6–17.6） | 31.12（30.58–31.96） | 1.48（1.24–1.62） |

同步 p95 的跨輪範圍較寬（所有版本合計 58–330ms），3.7.0／3.11.1 的中位數高於基準，但範圍仍有重疊。五個版本的 lobby store 都以 500ms 為正常輪詢間隔；推測動作相對輪詢的時間差是波動來源之一。此批沒有控制每次動作與輪詢的相位，三輪資料不足以把同步中位數差異判成穩定的版本退化。

## 特效階段資源

CPU 為各自主機整體百分比的三輪中位數；client 是同一 Chrome process tree 模擬十人的合計。記憶體／VRAM／GPU engine 為各輪採樣峰值的中位數，原始數值與範圍保留於 summary.json；不能當作單一玩家的硬體需求。

| 版本 | Client CPU % | Client private GiB | Client 3D engine % | Client VRAM MiB | Server CPU % | Server RSS MiB |
|---|---:|---:|---:|---:|---:|---:|
| 3.6.0 | 14.9 | 2.80 | 8 | 876 | 4.8 | 138.6 |
| 3.7.0 | 15.0 | 2.80 | 10 | 876 | 4.8 | 135.6 |
| 3.8.0 | 14.6 | 2.81 | 10 | 879 | 4.8 | 138.1 |
| 3.9.0 | 14.5 | 2.79 | 9 | 876 | 4.9 | 137.0 |
| 3.11.1 | 14.5 | 2.83 | 11 | 899 | 4.8 | 137.9 |

Server GPU 使用率及 GPU memory：VMware vmwgfx 未提供可讀 counter，所有版本均記 unavailable／null 及原因。Client WDDM engine／VRAM 按本次 Chrome PID 過濾；NVIDIA 整張卡指標另存原始 JSON，包含其他應用程式。資源約每兩秒採樣；RSS 加總可能重複計算共享頁面，private memory 與 VRAM 分開列示。

## 閒置階段

同樣採三輪中位數。

| 版本 | API p95 ms | KiB／人／秒 | Client CPU % | Client private GiB | Server CPU % | Server RSS MiB |
|---|---:|---:|---:|---:|---:|---:|
| 3.6.0 | 12.0（6.1–13.7） | 8.8 | 2.2 | 2.68 | 3.2 | 136.3 |
| 3.7.0 | 11.5（7.0–12.7） | 8.8 | 2.2 | 2.66 | 3.3 | 134.1 |
| 3.8.0 | 12.4（6.0–13.3） | 8.8 | 2.2 | 2.70 | 3.3 | 136.2 |
| 3.9.0 | 8.5（7.0–12.7） | 8.8 | 2.2 | 2.67 | 3.3 | 135.3 |
| 3.11.1 | 9.2（7.8–70.3） | 8.8 | 2.2 | 2.68 | 3.4 | 136.5 |

## 相鄰版本變化

依三輪中位數計算；CPU 為百分點。n=3 的量測呈現差異及波動範圍，未設定統計顯著性或絕對 SLA。

| 版本 | API p95 變化 | 特效流量變化 | Client CPU 變化 | Server CPU 變化 | API 範圍重疊 |
|---|---:|---:|---:|---:|---|
| 3.6.0 → 3.7.0 | -1.3 ms／-4.0% | +4.4% | +0.1 pp | +0.1 pp | 是 |
| 3.7.0 → 3.8.0 | +0.1 ms／+0.5% | -0.7% | -0.4 pp | -0.1 pp | 是 |
| 3.8.0 → 3.9.0 | +1.8 ms／+6.0% | +0.3% | -0.1 pp | +0.2 pp | 是 |
| 3.9.0 → 3.11.1 | -0.8 ms／-2.4% | -2.2% | +0.0 pp | -0.1 pp | 否 |

3.6.0 → 3.11.1：API p95 中位數 32.1 → 32.0ms；特效下載 16.9 → 17.2KiB／人／秒（+1.8%）；冷載十人合計 30.30 → 31.12MiB（+2.7%）。Client／server CPU 與記憶體維持相近範圍；本情境未觀察到持續累升的資源成本。同步延遲的波動與專屬遊戲負載仍按上述限制解讀。

## 共用圖表與原始資料位置

[Google 試算表：五版效能比較](https://docs.google.com/spreadsheets/d/1r5XVEMSVoY-4glURUqH9qAYbae7xhfx6SjKtMiSvzQI/edit) 已設為知道連結即可檢視，包含 8 張可編輯圖表、15 輪量測及中位數公式。匯入後已核對 90 個顯示數值；server GPU／VRAM 維持 n.a. 與原因。

下列 `work/` JSON／截圖連結指向測試機上的 ignored 本機證據，未納入 Git；GitHub 可直接閱讀本文件的彙總及上述共用試算表。此批固定版本比較截止 3.11.1，不包含其後 main 的圖片快取修改。

## 版本與證據

- 3.6.0，改動前基準，commit `b62a589b6e3e01cfa36086a8ad0f1cbccd793ccf`：[第 1 輪](../../work/benchmark/history-acceptance/b62a589b6e3e-1.json)／[截圖](../../work/benchmark/history-acceptance/b62a589b6e3e-1.png)、[第 2 輪](../../work/benchmark/history-acceptance/b62a589b6e3e-2.json)／[截圖](../../work/benchmark/history-acceptance/b62a589b6e3e-2.png)、[第 3 輪](../../work/benchmark/history-acceptance/b62a589b6e3e-3.json)／[截圖](../../work/benchmark/history-acceptance/b62a589b6e3e-3.png)
- 3.7.0，八人擴充（#300），commit `74a0193877107abbd1464bda26c2d51a4a643f5b`：[第 1 輪](../../work/benchmark/history-acceptance/74a019387710-1.json)／[截圖](../../work/benchmark/history-acceptance/74a019387710-1.png)、[第 2 輪](../../work/benchmark/history-acceptance/74a019387710-2.json)／[截圖](../../work/benchmark/history-acceptance/74a019387710-2.png)、[第 3 輪](../../work/benchmark/history-acceptance/74a019387710-3.json)／[截圖](../../work/benchmark/history-acceptance/74a019387710-3.png)
- 3.8.0，全遊戲觀戰擴充（#302），commit `464e5330423d646f6547c6700644c79d5c5c562f`：[第 1 輪](../../work/benchmark/history-acceptance/464e5330423d-1.json)／[截圖](../../work/benchmark/history-acceptance/464e5330423d-1.png)、[第 2 輪](../../work/benchmark/history-acceptance/464e5330423d-2.json)／[截圖](../../work/benchmark/history-acceptance/464e5330423d-2.png)、[第 3 輪](../../work/benchmark/history-acceptance/464e5330423d-3.json)／[截圖](../../work/benchmark/history-acceptance/464e5330423d-3.png)
- 3.9.0，互動／教學（#303），commit `5f0912cde62de7a14cf2486446a58778ee2b9ab1`：[第 1 輪](../../work/benchmark/history-acceptance/5f0912cde62d-1.json)／[截圖](../../work/benchmark/history-acceptance/5f0912cde62d-1.png)、[第 2 輪](../../work/benchmark/history-acceptance/5f0912cde62d-2.json)／[截圖](../../work/benchmark/history-acceptance/5f0912cde62d-2.png)、[第 3 輪](../../work/benchmark/history-acceptance/5f0912cde62d-3.json)／[截圖](../../work/benchmark/history-acceptance/5f0912cde62d-3.png)
- 3.11.1，後續面板、邀請音效、手機操作及設定頁整合，commit `f960b5146baf1808f3d5ff9a5663ac4ebabf60cc`：[第 1 輪](../../work/benchmark/history-acceptance/f960b5146baf-1.json)／[截圖](../../work/benchmark/history-acceptance/f960b5146baf-1.png)、[第 2 輪](../../work/benchmark/history-acceptance/f960b5146baf-2.json)／[截圖](../../work/benchmark/history-acceptance/f960b5146baf-2.png)、[第 3 輪](../../work/benchmark/history-acceptance/f960b5146baf-3.json)／[截圖](../../work/benchmark/history-acceptance/f960b5146baf-3.png)

[機器可讀彙總及每輪比較](../../work/benchmark/history-acceptance/summary.json)。Harness SHA-256：`a1b766f49d07e600d336acb42bd1b5f21f829041205535e16ea2fd00deb6c350`。

下載是 CDP encoded response bytes，上傳只計 body，未量測 TLS／TCP 封包總量或 WAN 延遲。後續同版本數據的變動仍可能受到背景系統負載影響；上述結果用於目前共同情境的比較，不將全版本差異直接歸因於某個新增功能。本批完成經 SSH 在測試站切換版本的實測，未執行完整測試套件、單機 perf:history CLI 或 GitHub workflow；未開 PR 或正式部署。
