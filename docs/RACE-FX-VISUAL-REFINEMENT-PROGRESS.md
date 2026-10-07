# 雷霆骰子與尾焰外觀精修：進度

日期：2026-10-07。正式已發布 **v1.14.0／b4ebb15243c607055e7425f35974f171f35c3365**，不可覆寫tag固定受測程式。此筆取代原候選待驗狀態；v1.13.0／353d8b6是比較基線。下方研究角色與主agent的初始待驗／中間回報是歷史，最新結果集中於下面「最終發布與驗收」。沒有新PR、push或合併。
規格與primary來源比較見 [RACE-FX-VISUAL-REFINEMENT](specs/RACE-FX-VISUAL-REFINEMENT.md)。

## 最終發布與驗收

| scope | 本批最終結果與限制 |
| --- | --- |
| source／範圍 | b4ebb15243c607055e7425f35974f171f35c3365／v1.14.0。race-dice-webgl.js及test、game-fx-layer.js／race-vehicle-effects.js及tests；原生圓角骰子與連續暖色火焰，自製geometry／shader，不裝外部physics／Three／Babylon或採第三方assets。 |
| 完整Windows | Node24.14.0，npm test **1413/1413**／37952.7495ms，fail/cancel/skip/todo各0；work/fx-refine-windows-full.log。 |
| 完整Linux | Node22.22.1，同immutable source，npm test **1413/1413**／212407.209842ms，fail/cancel/skip/todo各0；work/fx-refine-linux-run.log。owner focused141／37exclusive等不加到full總數；release:check minor、syntax與git diff --check通過。 |
| V01／V02骰子 | 下方17骰／普通與特殊面／390窄屏／真三席13骰證據成立。17是module fixture，非四席完整遊戲。shadow與cube各一draw，getFxState.drawCalls只計cube，17cube等34實際GPU draw。 |
| V03氮氣 | 私有道路／位置fixture後真UI begin／move；772非透明像素全部warm(R>B)、GLerror0；真3步／23個GPUsamples最大CTM尾部誤差0.000006086187476960302px、1emitter／6vertices／seen1。沒有正式狀態注入；未做native玻璃／jump／oil-skid／road-pan。 |
| V04停止 | 真UI再走2格至y6、phase bonus；effects／flames／renderedFlames／queued／particles0、SVGflames0、零RAF。未逐一人工觸發所有clear／换車／失anchor組合。 |
| V05生命周期 | 真reduced事件完成後骰子DOM回退／零RAF，尾焰reduce=true/effects0/flameNodes0/零RAF；真WEBGL_lose_context兩者回退／零RAF，尾焰原SVG visible。lost lease持有時第二context可用、第三context-budget拒絕。media event前stale樣本排除；native hidden／pagehide未觸發，以回歸測試為準。 |
| V06／V07清理與網路 | GPU prototype探針還原、臨時layers／hosts destroy、media／viewport overrides清除、預覽程序停止。原生idle已驗零RAF；新shader無逐frame API，server／分布／owner／聲音規則未改。不推論網路性能或全遊戲實玩。 |
| V08外觀 | 保留v1.13正式圖、Codrops作者參考、本批骰子／flame真截圖。before/after不是嚴格同viewport比較；圖片不表示使用者已滿意、所有硬體或FPS提升。 |

source archive SHA256：66d5e516238ddf6c4a7088a851ad7c23477ec706a1721c25baaafae760185516。正式release /home/ccc/apps/afterhours/releases/b4ebb15；UTC2026-10-07T15:29:41.496Z零房間guard後啟用，PID151238→154553，afterhours／tunnel active，local login/version通過。備份：/home/ccc/apps/afterhours/shared/backups/pre-fx-refine-b4ebb15-20261007T152900Z-e8e9b5a1-f855-4c13-94fb-db5039f41558。SQLite線上備份與另時點files archive不是atomic cold snapshot；schema預演16→16，私有env、active data paths保留，import generation inactive。既有GitHub討論同步設定未改，本批無Issue／comment寫入。

正式三會員只用自然骰子及合法begin／move操作，沒有注入正式位置。9份資源逐byte對immutable source、no-store與MIME通過；13骰rolling遮罩、三席同result、非owner roll／confirm400、確認後12player dice通過。原生Chrome結果13anchors、958×443／424394pixels、零RAF、GLerror0，DOM對上server [3,6,2,5,2,3,2,2,6,4,6,6,1]。正式玩家2真骰值[2,3,2,2]啟用nitro／停車場入場，再由Chrome真UI移到道路格；觀察者仍1flame／6vertices／seen1，car moveSeq3／x1,y1／remaining2、GLerror0。使用本機私有authenticated preview代理連正式API，並非本機fixture，不把代理URL當公開站網址。

UTC2026-10-07T15:35:00.225Z smoke結束，own房最後成員離開後404、三個own sessions登出／auth me401；代理與own Chrome tabs關閉，不影響使用者前景。最終資料核對：schema16、22table schemas、**21non-session表rows及BLOB一致**、9帳戶allfields與13market images保留、integrity ok／FK0；sessions225→232為本批驗證登入變化（含已清理的前次代理路徑錯誤重試），不宣稱sessions不變。

私有正式證據：work/fx-refine-production-dice.png、fx-refine-production-flame.png、fx-refine-public-dice-native.json、fx-refine-public-flame-native.json、fx-refine-public-smoke.json、fx-refine-final-data-check-result.json。隔離生命周期receipt：fx-refine-flame-lifecycle.json。帳密／cookies不進公開文件或Git。後續native缺口：200%／讀屏、hidden／pagehide、玻璃／jump／oil-skid／road-pan、同尺寸before/after與FPS／跨硬體；完整tests不表示這些全已完成。

## 本角色已完成的研究（初始回報歷史）

- 讀AGENTS與ART／ANIMATION／DESIGNER、目前骰子與FX source；查Codrops/uuuulala、dice-box、dice-box-threejs、官方theme／method／license與fire/particle作品。
- 查看主 agent保存的Codrops真demo截图，只記圆角／凹點／局部投影外觀；不是本站candidate截图或動畫／性能驗收。
- 核對軟體MIT、dice-box/theme model+texture CC0與未逐件確認的其他資產邊界；未安裝套件／下載模型、貼圖、音檔或複製第三方code。
- 與renderer owner確認原生圆角geometry／無面框／光影、原一秒authoritymask；與flame owner確認同context、連續尖尾外焰／亮芯與CTM車尾anchor。
- 僅新增本批兩文件，不覆寫角色長記憶、其他spec、版本或程式；沒有執行測試／browser/server/deploy。

## 候選狀態（不代替原生證據）

| owner／scope | 回報／取捨 | 本文件限制 |
| --- | --- | --- |
| visual_webgl_spec：骰子 | original GRID8圓角、edge2/radius.18、486cubevertices/768triangles、4shadowvertices；去方框、柔光／凹圈、19%softshadow；caps32/750k/DPR1.5／shared2slot不變。 | owner候選source回報；16項VM屬ownerfocused結果，不與後續suite重複總計。新shader native未在本角色驗。 |
| pr46_canvas_fix：氮氣 | 同GameFxLayer context/program/buffer，每emitter6vertices／2triangles、無texture；雙層連續火焰／小halo、CTM追車尾，同command一個emitter。 | owner方案回報；focused與native待主agent補。 |
| thirdparty庫 | 參考Codrops外觀；不裝Three／cannon／Babylon／Ammo，未採外部assets。 | 未量bundle/gzip或第三方physics性能；不能以README的highperformance字樣作本站證據。 |

研究更正：yomotsu/VolumetricFire初步訊息曾猜MIT；primary LICENSE404、README/header無明確授權，因此未採code／texture。SmokeGL codeMIT不等所有PNG／OBJ／audio已逐件授權確認。dice-box的theme CC0不能跨套用到dice-box-threejs public資產。

## 主 agent續填的本批證據

| scope | 待填結果與必要限制 |
| --- | --- |
| 候選source／版本／範圍 | 最終SHA、版本、實際檔案及limits；只記本批，勿總計跨重跑suite。 |
| focused／完整Win/Linux | 測試指令、Node／數量／失敗／取消／跳過及受測source；owner回報與本人執行分清。 |
| dice native | 同尺寸before/after、一般／特殊面／17骰途中／resultmask／caption、短屏／390／大字／scroll。 |
| flame native | 真active nitro的形／亮芯／尖尾、逐格／pan anchor與停止；drawactivity控制與自然事件分清。 |
| lifecycle／idle／network | reduce/off/hidden/loss/budget／第三context／destroy、frame與新request差異；未觸發的原生case明列。 |
| 正式站／資料 | 備份／預演、資料保留、版本／resources／services與有限操作scope；未發布前保持pending。 |

## 主 agent本批實測

2026-10-07隔離Chrome：原生四隊17骰结果active anchors17、427268backing pixels、GPU getError0、結果零RAF；這17骰是module fixture，不是四席完整遊戲。新rounded cube与凹圈可見，普通1–6以及碰撞「進入車／前方」短面／DOM中文可讀。shadow與cube各一draw，getFxState.drawCalls仍只計cube，不能把17當成GPU總draw數。

390×500局部scroll170px，canvas357×268、可見covered anchors4，body clientWidth/scrollWidth同357、頁面無橫向溢出。真prefers-reduced-motion後canvas none／全部17個DOM面visible／零RAF；真WEBGL_lose_context後reason=context-lost、canvas none／DOM回退／零RAF。此回合沒有用native隱藏事件，hidden以回歸測試為準。

真隔離server三個會員由Chrome按開始／確認：13骰自然rolling與result，DOM labels逐一對上server [5,2,4,4,2,2,2,5,1,4,3,6,2]，確認前crew dice為0，结果零RAF。只有道路與位置fixture可供後續nitro準備；沒有對正式房間注入測試位置。

私有圖片：dice-ref-codrops.png（作者外觀參考）、dice-webgl-production-proof.png（v1.13歷史）、fx-refine-17-result.png、fx-refine-special-result.png、fx-refine-mobile.png、fx-refine-round.png；原生receipt為fx-refine-dice-native.json。圖片僅證當次外觀／布局，沒有使用者已滿意或FPS／跨硬體结論。待驗：最終source完整Win/Linux、氮氣真指令／移動／停止與正式資源／資料核對。

2026-10-07氮氣實作凍結：GameFxLayer新增同program／context的6vertex火舌，固定buffer11floats／vertex；nitro只有live callback才可continuous，record discard以stop(id)取消，不再每個move事件重建burst。車尾CTM(-20,0)及反X／scale與原SVG對齊，暖色core／outer與soft halo無外部texture。其他smoke／sparks及成就共用同renderer，網路與server規則不改。

root在隔離三席由真UI選移動骰4／nitro骰1／確認出發：實際GL三角尾焰、772非透明像素全部warm(R>B)、getError0；GL成功後旧SVG visibility hidden。接著真UI選三格目標，server實際moveSeq3、y1→4、remaining5→2；23個原生GPU座標samples的CTM尾部誤差最大0.0000060862px、仍effects1／flames1／6vertices／seen1。這是隔離道路fixture的真動作，不能當自然所有道路事件或FPS測量。暫時prototype GPU探針已還原。火焰圖片fx-refine-flame.png與fx-refine-flame-moved.png、原測量fx-refine-flame-moving.json只放私有work。

Windows Node24.14.0完整npm test：1413/1413、37952.7495ms，fail/cancel/skip/todo各0。owner focused141不是另加到full數。待固定受測提交、Linux完整suite、nitro停止與其他原生生命周期及正式部署。

