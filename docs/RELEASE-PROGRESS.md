# 版本管理實作與驗收

2026-10-06後續正式 **v1.1.1**：相容修正雷霆多格逐格滑動及重繪接續，Windows／Linux各554/554、背景Chrome八格及一次POST驗收通過，詳 [移動進度](RACE-MULTI-MOVE-PROGRESS.md)。固定程式提交`2eb4104d3732325ac68d2981fadc09826b1c5f55`及本地annotated tag `v1.1.1`；正式站已切至`releases/2eb4104`，公开API及Chrome設定顯示1.1.1。7帳戶完整保留、schema13未變、15表副本逐列一致，服務及tunnel active。備份與完整驗收見同一移動文件；無新PR／push。

既有v1.1.0 tag保持原提交；1.1.0候選未單獨切換，直接由8fcda4d更新至1.1.1。相較正式基線的minor門檻與相較v1.1.0的patch門檻均通過。之前待處理的更新時機已由確認測試帳號／電腦玩家、正常離房及零房間切換解除；沒有中斷其他真人座位。下列v1.1.0紀錄保留作歷史，狀態以本節為準。

2026-10-06：候選 **v1.1.0**，從現有package基線1.0.0升minor。annotated tag `v1.1.0`指向受測程式提交 `238da0e22438ab3264107bf13115bc1c13906b5a`。正式站當前發布目錄仍為8fcda4d；尚未把候選當作上線。打版規則見 [規範](RELEASE-POLICY.md)，功能紀錄在根目錄CHANGELOG。

## 已完成

- `package.json.version`作單一來源；匿名只讀`GET /api/version`只回版號、no-store，不暴露其他資料。
- 共用右上角設定顯示版本，第一次開啟才請求，成功只讀一次，沒有新timer／poll；失敗下次展開可重試。
- `release:bump`支援minor／patch／major、摘要及日期，同步package／可選lock與CHANGELOG；不自行commit／tag／push。
- `release:check`檢查版本紀錄一致；搭配base及type可拒絕未升版／新功能只升patch。npm test前執行基本檢查。
- AGENTS新增必須打版的規則，規範涵蓋相容性、批次、不可覆寫tag、純文件及部署／DB版本分工。

## 驗收證據

Windows Node24.14.0全套 **548/548**，包含新增5項CLI／Git基準／HTTP回歸；失敗0、取消0、跳過0。證據在核准私有QA位置 `work/version-windows-tests.log`。

背景Chrome使用獨立localhost3197及合成帳號，不改正式帳戶／房间。正常1794×1010 viewport、不加覆寫；實際展開設定顯示「版本 v1.1.0」。面板320×617，底部703.5px；版本底部682.5px，在畫面內。重開設定的CDP被動觀察版號請求0，無截斷／待分頁事件。這不是FPS或所有手機尺寸的驗證。

模擬封鎖本機版號請求時顯示「版本暫時無法取得」，解除封鎖後重開設定恢復v1.1.0；阻擋已清除。沒有修改其他頁面或帳戶偏好。

Linux Node22.22.1完整 **548/548**，失敗／取消／跳過均0；發布包內無Git目錄，基本check及獨立Git基準fixture皆通過。副本schema13、15張既有表逐列一致、完整性ok、外鍵錯誤0；隔離3196啟動成功。證據 `work/version-linux-tests.log`。

已準備發布目錄 `releases/238da0e`；SHA-256為 `1c2f5b53d2e87e4c355565bcfcc5c9910b404416fa6e6ff0dc1e3897dce7a950`。切換前線上備份 `shared/backups/pre-party-238da0e-20261005T170101Z`（UTC），7帳戶、schema13，持久檔案另備份；SQLite與檔案不宣稱同一原子時間點。首次切換檢查发现一間兩人賽車局進行中，尚未重啟；正式API／畫面驗收等待切換完成。tag為本地，未push／未發新PR。後续純文件驗收更新不改已受測的版本標記。
