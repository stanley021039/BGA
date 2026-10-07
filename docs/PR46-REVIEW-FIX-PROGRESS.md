# PR46 審查修正進度

2026-10-07，針對 [Stanley 的審查](https://github.com/stanley021039/BGA/pull/46#issuecomment-6033480529)。原 head `38c1497`；目前已整合 main `72ed917`，保持原 PR Draft，完整驗收與正式交付尚未完成。

| 審查項目 | 修正方式 | 目前證據 |
| --- | --- | --- |
| 重建途中清除／撤銷留下舊畫作 | 分開 staging 的實際 surface 寫入序號與最後已提交序號。最新權威目標完成時，即使 worker 沒有新增 stroke 也提交尚未呈現的 surface；舊 generation 不能蓋回新圖。 | clear／undo 的 raster 回歸先重現失敗；classic、canonical、layered 與同步／合作入口均驗最後完整 RGBA，未開始的 append 取消及 settled no-op 不增加 copy。renderer 聚焦 45/45。 |
| 切回分頁不恢復音樂 | 記錄此次 visibility 自動暫停的 Audio／key／epoch，回到可見且最新 marker 已對上時恢復。 | 先重現 3 項失敗；新增 6 回歸，媒體 70/70。保留手動暫停、關聲音、拒播、共享暫停；停止、换曲及晚到 play promise 不復活舊 Audio，影片不自動重新加入。 |
| main 衝突 | 保留 MarketImageStore 初始化、圖片投稿／審核 body caps、schema16、pngjs／sharp、gallery 入口及共用 UI；保留角色 4 MiB caps 與 preserveImportedSessions。 | 四檔衝突已解；圖片、HTTP、備份還原與角色圖片聚焦 165/165，包含 cold15 副本升級及 full16 帶圖片還原。 |

聚焦測試是 VM／raster 與隔離 HTTP／檔案系統驗證；不冒稱真瀏覽器播放或所有中途畫面通過。原本 v1.9.0 的驗收保留為歷史，不代替本次整合後 source 的完整測試。

本 PR 候選為 v1.9.1；已發布 v1.10.0 的 UI／WebGL 維持另一分支，沒有加入 PR46。正式同步需保留目前已發布的功能，另固定整合來源、升版、備份與 schema16 預演後才切換。後續純文件提交不移動受測 tag，不提交帳密、cookie、房碼或私有設定。
