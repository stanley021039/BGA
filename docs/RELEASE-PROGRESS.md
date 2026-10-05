# 版本管理實作與驗收

2026-10-06：目前候選 **v1.1.0**，從現有package基線1.0.0升minor。正式站當前發布目錄仍為8fcda4d；尚未把候選當作上線。打版規則見 [規範](RELEASE-POLICY.md)，功能紀錄在根目錄CHANGELOG。

## 已完成

- `package.json.version`作單一來源；匿名只讀`GET /api/version`只回版號、no-store，不暴露其他資料。
- 共用右上角設定顯示版本，第一次開啟才請求，成功只讀一次，沒有新timer／poll；失敗下次展開可重試。
- `release:bump`支援minor／patch／major、摘要及日期，同步package／可選lock與CHANGELOG；不自行commit／tag／push。
- `release:check`檢查版本紀錄一致；搭配base及type可拒絕未升版／新功能只升patch。npm test前執行基本檢查。
- AGENTS新增必須打版的規則，規範涵蓋相容性、批次、不可覆寫tag、純文件及部署／DB版本分工。

## 驗收證據

Windows Node24.14.0全套 **548/548**，包含新增5項CLI／Git基準／HTTP回歸；失敗0、取消0、跳過0。證據在核准私有QA位置 `work/version-windows-tests.log`。

背景Chrome使用獨立localhost3197及合成帳號，不改正式帳戶／房间。正常1794×1010 viewport、不加覆寫；實際展開設定顯示「版本 v1.1.0」。面板320×617，底部703.5px；版本底部682.5px，在畫面內。重開設定的CDP被動觀察版號請求0，無截斷／待分頁事件。這不是FPS或所有手機尺寸的驗證。

Linux全套、tag與正式API／畫面驗收待部署流程完成後補充。純文件驗收更新不改已受測的版本標記。
