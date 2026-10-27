# #311 測試站效能基準

2026-10-27，測試站 v3.11.1，commit `f960b5146baf1808f3d5ff9a5663ac4ebabf60cc`。三輪相同情境，十個獨立登入 Chrome context（1920×1080）同時在線，動態開啟，兩波十人攻擊與移動。Chrome 156.0.8078.48；client 為 Windows／24 logical cores／RTX 3060 Ti，server 為 Linux VM／2 vCPU。

三輪有效性：true／true／true。特效事件投遞率：100%／100%／100%。

| 指標 | 閒置 | 同時使用特效 |
|---|---:|---:|
| API p95（各輪範圍） | 7.0–8.9 ms | 34.6–46.1 ms |
| 量測期間十人總下載（各輪範圍） | 0.85–0.86 MiB | 1.05–1.10 MiB |
| Chrome CPU 整機百分比（各輪平均範圍） | 1.9–2.0% | 13.4–15.1% |
| Chrome private memory 峰值（各輪範圍） | 2.63–2.66 GiB | 2.75–2.79 GiB |
| Chrome 3D engine 峰值（各輪範圍） | 0–0% | 10–13% |
| Chrome dedicated GPU memory 峰值（各輪範圍） | 563–788 MiB | 858–867 MiB |
| Server CPU 整機百分比（各輪平均範圍） | 1.9–2.4% | 3.1–3.5% |
| Server RSS 峰值（各輪範圍） | 200.5–211.1 MiB | 202.1–211.6 MiB |

攻擊開始到觀察者收到事件的 p95：103–489 ms；中位數 338 ms。API p95 中位數 44.7 ms。十人合計成功攻擊 20／20／20 次。HTTP 總拒絕 0／0／0 次，其中玩法正常拒絕 0／0／0 次；非預期 HTTP 錯誤 0／0／0 次。

Server GPU 使用率／GPU memory：**無法取得**。VMware `vmwgfx` 未提供相關 counter；JSON 保留 null、available=false 與原因。Client GPU 數字來自 WDDM 依本次 Chrome PID 過濾，另有 NVIDIA 整張卡原始採樣，後者包含其他應用程式。

這是目前已整合版本的測試站基準，尚未完成近期各版本的逐版比較；也不代表所有遊戲對局、觀戰及教學負載均已測量。下載計 CDP encoded response bytes、上傳只計 body；CPU 以該程序／Chrome process tree 計算並除以各自主機 logical cores。資源峰值為每兩秒採樣所得。十人共用一部 client 的 CPU／RAM／GPU 成本，不能當作單一玩家的硬體需求。

原共用測試站第三輪遇到另一批修改重新建置、既有程序引用已移除的資源檔，該輪無效，不納入上表。以上三輪改用相同 VM、固定版本的獨立測試站，沒有重啟或切換原共用測試站；已核對每輪來源與 frontend manifest 指紋相同。dirtyProduct=true 僅來自本批 package 開發工具／scripts 變更，src／public／frontend 產品來源與基準相同。每輪測試帳號及 session 均清除。

已實際執行 benchmark、四項報告邏輯回歸、格式／語法／版號檢查；未執行完整測試套件、歷史版本完整批次或 GitHub workflow。

Harness SHA-256：`a1b766f49d07e600d336acb42bd1b5f21f829041205535e16ea2fd00deb6c350`。三份原始報告及截圖與本文件同目錄：

- [第 1 輪 JSON](../../work/benchmark/acceptance/frozen-run1.json)／[截圖](../../work/benchmark/acceptance/frozen-run1.png)
- [第 2 輪 JSON](../../work/benchmark/acceptance/frozen-run2.json)／[截圖](../../work/benchmark/acceptance/frozen-run2.png)
- [第 3 輪 JSON](../../work/benchmark/acceptance/frozen-run3.json)／[截圖](../../work/benchmark/acceptance/frozen-run3.png)
