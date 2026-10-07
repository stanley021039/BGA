# 畫猜防閃爍、逐點播放與平滑倒數進度

日期：2026-10-07。本輪依使用者回報「畫者畫布閃爍」及新要求「接收端按真正點時間逐步呈現，可有少量延遲」，並追加「時間條平滑下降」，正在實作／待整體驗收；尚無本輪正式發布證據。候選版號已定minor v1.9.0；source／最終完整1132／Linux及部署仍待root，不能沿用v1.8.1的1076或舊native結果。本輪規範見 [作畫spec最新段落](specs/DRAWING-SMOOTHNESS.md)，先前結果仍在 [順暢度歷史進度](DRAWING-SMOOTHNESS-PROGRESS.md)。

## 已確認原因與修正方向

root與renderer owner已確認一條可重現閃白路徑：visible被clear或copyBase後，還沒把完整suffix／canonical畫完就yield；ACK讓local mutable切回classic時，重建也可能先把visible清白。owner固定64筆brush history＋1活動tail的案例，原visible ink853，ACK轉Infinity後、尚未yield就變ink0。這是已確認程式／控制案例，不把所有裝置的閃爍都歸因同一原因，更不歸咎使用者電腦。

修正採画猜opt-in `atomicPresentation:true`：長駐opaque staging保留caller原creation options（含省略的contextAttributes），以canonical renderer完成完整job，再一次copy呈現到visible；合作式yield期間visible維持上一份完整畫作，不能先清／copy一半。取消／舊epoch／reset只允許目前job commit，持續新revision不能造成長筆永久不更新。其他default renderer不因這個選項改畫法。

## 規範與待驗收表

| 項目 | 已定契約 | 狀態／證據界線 |
| --- | --- | --- |
| A1 原子呈現 | staging內合作式重建，完整job且identity／epoch有效才整幅commit；ACK／draft settle／classic切換不暴露白底或部分舊圖。 | 已實作候選；owner最終41／41及4 controlled native已驗，實際持筆／整體／部署待root。 |
| A2 cache與取消 | staging／opaque base／checkpoints合計512×256≤8MiB；default16预算為14 checkpoints＋base＋stage，maxCheckpoints2可0checkpoint。whenIdle涵蓋完整呈現，取消不得晚commit。 | cache／visible回歸已含owner scope；跨epoch／long-held starvation與native待root。 |
| T1 捕捉真時間 | brush／erase可選`pointTimes`，前端以同stroke相對時間生成，coalesced／up與相鄰整數去重同步保留點／時間，carry anchor沿原相對時間。 | 前端／root實作中；不用網路收包時間假造每點等間隔，參數與真native待驗。 |
| T2 server資料 | optional僅brush／erase；與points同長，每項safe integer ms 0..120000，chunk內非遞減，可相等。null／empty／sparse、shape／fill帶times拒絕。 | backend新7項、合計30／30通過並freeze；非總體時序／native結果。 |
| T3 continuity界線 | server不增加跨chunk timing ledger、不強制首項0或anchor時值；同stroke基準／anchor continuity由前端生成與receiver有界排程維持，不直接相減不同client的performance.now原點。 | 新stroke buffer60ms、同stroke連chunk保相對差值；gap cap300ms／單batch展開cap700ms／總lead900ms，極端backlog canonical；待真雙席／jitter。 |
| T4 viewer live呈現 | spectator即時SSE brush／erase才按pointTimes以client rAF逐點呈現；canonical接受／version立即更新。artist看本機preview，ACK不重播。 | root實作候選／真CDP觀察25partial frames；buffer60/gap300/batch700/lead900與極端canonical有界，不保完整停頓錄影、低延遲或60fps。 |
| T5 baseline障壁 | snapshot／首次載入／reconnect／gap、reveal／undo／clear／fill及非brush操作立即回完整canonical baseline，取消尚未播完的尾巴。 | 待跨輪／fill依賴／undo與晚callback驗收；基線不能排舊動畫。 |
| T6 wire與保存 | 用原draw/stroke批次與SSE，不增加server timer、逐frame／逐點broadcast。immutable batchId/body包含times；ACK/SSE/live及公開result snapshot保留timing，永久收藏仍PNG、DB/schema不變。 | backend clone／payload驗證已scoped通過；保存／PNG與原額度完整回歸待root。 |
| C 平滑倒數 | 共用CountdownBar用WAAPI linear scaleX連續下降，native progress／秒數保server deadline；不每frame JS／新增poll，epoch／phase／newdeadline重設，hidden/pagehide cancel、show-BFCache baseline。 | 原生animationseek已觀察linear單調，背景自然動畫曾約1.5s drift；新增currentTime vs wall drift≥100ms才補serverdeadline／1test，最新1132及native待root。 |
| R 每輪後檢查 | 每輪reveal、換下一畫者與新canvasEpoch後都檢查有無閃白／殘影／舊尾巴／草稿／rAF/timer殘留，不能只首輪或最後終點。 | 使用者長期要求已記；本輪實際round矩陣／證據待填。 |

timing驗證在既有duplicate ID check之後、rate／quota／version mutation之前，duplicate只ID去重的原語意不變。points與times分別clone；錯誤不能消耗畫作額度或偷偷提高30,000點上限。這是展現節奏metadata，不可信作score、deadline、畫者權限或伺服器時間。

## 真Chrome與回歸矩陣（待root證據）

| 場景 | 必記證據 | 狀態 |
| --- | --- | --- |
| artist多筆／ACK mode切換 | 固定非空history／tail，每次yield前後可見畫布只能是完整前圖或完整新圖；ACK前後無非預期ink0，up末點不漏。 | 待native／自動回歸scope核對 |
| 合作式cold replay／fill | 最多48fill及多brush、取消／reset／新job；合法clear可白，其他控制案例不能因render中途露白。cache≤8MiB／whenIdle與PNG完成。 | 待完整／native |
| 長持筆／高頻revision | held持續增加資料仍能有界更新visible，不因每幀取消staging而餓死；send與preview各自有界。 | 待native starvation |
| 雙席真點時間 | 同epoch不同間隔trace＋跨64點批，viewer逐步frame／時間間隔與最後完整points；artist不重播ACK。 | 待native，合成与真人工具輸入分列 |
| 20／200／400ms／jitter／lostACK | 點時間與receipt等待分開；重試ID/body/times不變、SSE與ACK兩次序、無額外frame網路、queue／delay有界。 | 待scoped／native |
| legacy／非法timing | 無pointTimes相容即時；null／sparse／負值／非整數／>120000／錯長／逆序／fill-shape拒且version／quota不變。 | backend30／30回報已通過；整合待root |
| 基線操作打斷回放 | reconnect／snapshot／gap／undo／clear／fill／line／shape／reveal立即完整canonical；舊frame不能重畫已刪筆。 | 待回歸／native |
| C 倒數連續呈現 | 固定server deadline量中間transform／剩餘比例与秒數；同deadline不重啟，epoch／phase／新deadline重設、hidden/pagehide取消、BFCache/serverbaseline及fallback，不新增frame timer/poll。 | 待root unit／native |
| 每輪reveal→下一輪 | 每輪保存round／epoch／version、非空圖／公開result、草稿與playback queue／rAF/timer清理；新輪合法空圖與閃爍分開。 | 待多輪實測 |
| hidden／減動／離席 | 畫作完整可見，不因停装飾動畫而不畫；hidden往返／leave清callback。減動fallback與追趕策略按最终source記錄。 | 待策略／回歸／native |

5項真正yield visible regression修前1pass／4fail，第一候選四renderer檔40／40；creation intent修正後最終41／41，是特定source scope；backend30／30也是其範圍。已有下段單輪原生trace、Animation seek與1131前版Windows結果，最終stalled correction source1132／Linux／tag／正式仍待，不预填完成。舊classic/native AA差仍按原控制條件比較，不以mask相同或換context hint隱藏新增差異。

## renderer原生控制案例與creation options

第一atomic候選native在filled-erase差3515 RGB／max92、filled-long-history差24260／max93，dense／ACK0，不能以scoped40通過掩蓋。owner發現staging用getContextAttributes報告defaults重建，將省略willReadFrequently變成明示false；修正只傳caller原options.contextAttributes。固定Chromium source的kUndefined分支含readback後DisableAcceleration條件，支持省略／false語意差的機制線索，不證明当前Chrome唯一CPU/GPU因果。[固定Chromium source](https://chromium.googlesource.com/chromium/src/+/fe487bfab3b23b7a107987b0a2f7b65222ae7ae0/third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc)。

最終ignored work/draw-timed-atomic-native-final.json的dense-static／filled-erase／filled-long-history／dense-ACK-settlement四例，與legacy及fresh均RGBA0／max0；allLegacyExact／allHeld／allBounded true、cache≤8MiB。兩fill例3／4次yield觀察皆changedWhilePending0，dense兩例觀察0（同步完成），不能說四例都有中途frame採樣。這是controlled native renderer，不替代真持筆、receiver時序或每輪；180calls工具trace timeout且accepted0不作成功證據，root另驗有效短持筆。

CountdownBar用Element.animate建立Animation並由caller取消／重設，合成路徑与平滑度待native。[MDN animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate)。

## 新增真輸入／倒數與Windows證據（最終1132／Linux／部署待）

候選minor v1.9.0。root背景Chrome真CDP25move heldstroke：artist56採樣frames／26次ink增長、whiteAfterInk0；26batches、51含anchors點。viewer62frames，其中25partial frames的fullpoints與shown不同、drain empty，確認該trace有逐步呈現，不是整筆瞬間一次顯示。去敏ignored work/draw-timed-native-artist.json／viewer.json。這是一個工具原生事件trace／背景engine節流，不是60fps、人體採樣率、所有輪或使用者另一台電腦改善證據。

倒數ignored work/draw-timed-countdown-native.json：在native progress固定0.608575時，對Animation.currentTime手動seek elapsed0／8／16／32／64／120／200ms，scale約0.621396→0.619730單調／linear，之後seek還原。這證明該控制動畫在秒數／原生value兩次更新間可連續變化，不是自然60fps或動畫與每次progress取樣毫秒完全一致。原始背景自然動畫另觀察約1.5秒drift，root新增currentTime相對wall elapsed漂移達100ms才補serverdeadline，保留原生權威value／文字，不增加逐frame JS或額外poll；新增1test，最終source1132／原生校正尚待。

第一次Windows1131總1129pass／2fail是既有fixture把functional #timerFill算入decorative動畫；明確排除它後第二次1131／1131、37700.4126ms，fail/cancel/skip/todo0。root新增stalled correction1test後最新1132正在重跑；這兩次舊source數字不替代最新全套／Linux。沒有本輪tag／部署完成證據。

## 交付狀態

| 項目 | 結果 |
| --- | --- |
| source／focused | renderer41／backend30及controlled native4已驗；root新增timing5、CountdownBar原2與stalled校正1回歸，最終整合待1132。 |
| Windows／Linux完整 | Win第一次1131是1129pass／2fixture fail，functional timer列入decorative animation count；fixture排除#timerFill後1131／1131、37700.4126ms、0fail/cancel/skip/todo。其後新增漂移校正1test，最終1132／Linux待驗，不把1131當最終source。 |
| 真Chrome／每輪檢查 | controlled renderer4及單輪真CDP25move／timer animationseek已驗（scope如下）；每輪完整matrix／最終stalled校正native與清理仍待root，不宣稱60fps或別台PC改善。 |
| 版號／tag／正式／資料／清理 | 候選minor1.9.0；最終1132／Linux／source-tag／正式資料與清理待root，新功能尚未宣稱正式發布。 |

只記本輪使用者直接要求與已確認契約；私人偏好、帳密、房號、raw HAR不提交。歷史「無PR」是當次事實，不能抄成新一輪永續偏好或發布授權。
