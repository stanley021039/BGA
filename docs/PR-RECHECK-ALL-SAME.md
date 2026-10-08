# PR53／57再次檢查：混合AI同組成就

2026-10-08，回應 [新P2評論](https://github.com/stanley021039/BGA/pull/53#issuecomment-6056484950)。先前參與成就與Carousel修正保留。

## 修正與重現

原allSame以含AI的group.count比較只有真人的active.size，混合回合即使所有答案同組仍為false。現在同組完整性改核對全部實際作答席位（真人及AI）的完整且不重複分組、答案存在與count；授獎門檻仍是至少3位合格真人、映射完整，成就參與者只含真人。

只改majority引擎、回歸測試與CHANGELOG；沒有修改規則分組API、計分、權限、schema或歷史收據。新增引擎＋SQLite案例：全真人同組、3真人＋AI同組、AI不同答案、人類不同答案、2真人＋AI同組。另真HTTP／AI排程填空題，官方merge／score後groups=[4]、participantCount=3、allSame=true，三位真人各取得majority-one-channel。

對修改前allSame函式使用隔離Node模組載入覆寫重現：54項中52過、2失敗，恰為混合同組HTTP與引擎／SQLite案例；未回退工作樹或正式程式。修正後相同54項全部通過。

## 最新完整測試

- PR53固定受測head `070d2bfa4eee33b24ab234b752d9298a9c4b4a56`，base `7149cea8b6fc451f5f88b7c8dc1b1e520a4e7d87`：Linux完整 1725/1725，0fail/cancel/skip。
- PR57固定受測head `a16694950b3ac9935b45be3ca2ac292620e96706`，相依base `070d2bfa4eee33b24ab234b752d9298a9c4b4a56`：Linux完整 1742/1742，0fail/cancel/skip。
- TMPDIR使用磁碟暫存；兩分支完整測試各執行一次，不把舊source結果當新head。此文件後續提交只補證據。
- 兩邊release check與diff check通過。main仍7149cea；修改後PR57已整合PR53，沒有丟失原Carousel、dark mode、賽道內距或空位修正。

## 分開審查

第一回合：對上述固定base/head核對最新P2及前兩評論，需求三真人門檻和全部答案同組同時成立；真人缺映射fail-closed與AI不授予保持。只修改本評論相關判定，沿用53／57，不合併main／不部署。

第二回合：對本次前head bf545ae／509d3f1的追加差異核對：group席位集合／count／重複防護一致，晚加入及缺答不誤授，store仍要求rules_completed及eligible。完整suite包括mapping拒絕、receipt冪等、schema分支、API、AI排程、Carousel選擇、hidden座位與亮暗狀態回歸全部通過。未見本輪未解阻擋問題。

本輪沒有重新宣稱全玩法瀏覽器、讀屏或FPS驗收；HTTP與引擎證據不代替這些項目。正式仍v1.18/schema17，本批候選v1.19/schema19未部署，舊interrupted收據不回寫。
