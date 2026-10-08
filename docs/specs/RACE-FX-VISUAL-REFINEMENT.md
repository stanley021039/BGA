# 雷霆骰子與氮氣尾焰：外觀精修規格

日期：2026-10-07。研究、實作與有限原生驗收完成，正式已發布 **v1.14.0／b4ebb15243c607055e7425f35974f171f35c3365**。
基線：v1.13.0／353d8b6；不可覆寫tag固定受測程式。下方owner候選回報與初始待驗是歷史，最終逐項範圍以進度文件為準，未宣稱整張驗收矩陣全部通過。
本批使用者指出骰子外觀不理想，要求查別人製作的骰子，並希望氮氣恢復原火焰風格、以WebGL呈現。
本文件不是前版發布紀錄；本批實際證據留 [進度](../RACE-FX-VISUAL-REFINEMENT-PROGRESS.md)。

## 查核方式與結論邊界

本角色實際開啟下列作者／專案官方文章、demo頁、README、LICENSE、package manifest與指定source。
另看主 agent背景Chrome保存的Codrops真demo截图 work/dice-ref-codrops.png：兩顆灰白圓角骰、黑色凹點與局部投影。
這張圖只作外觀參考，不是本站新候選畫面、動態／GPU性能證據，亦不作遊戲素材搬入。
未安裝／打包外部套件，沒有下載外部圖像／音檔／模型，未量gzip或執行第三方physics benchmark。

## 骰子參考與取捨

| Primary來源／查到的形式 | 外觀與可採部分 | 授權／資產 | 預定結果／特殊骰面／成本 | 本批取捨 |
| --- | --- | --- | --- | --- |
| [Codrops教學](https://tympanus.net/codrops/2023/01/25/crafting-a-dice-roller-with-three-js-and-cannon-es/)＋[uuuulala repo](https://github.com/uuuulala/Threejs-rolling-dice-tutorial)＋[真demo入口](https://tympanus.net/Tutorials/DiceRoller/) | 圓角實體、凹點黑芯、柔光／接觸陰影；geometry與physics可分開。 | [repo MIT](https://raw.githubusercontent.com/uuuulala/Threejs-rolling-dice-tutorial/master/LICENSE)，若複製實質code保留notice。作者做程序geometry，不需下載骰子模型。 | demo依Three.js＋cannon-es物理讀落面；不是server權威adapter。照搬高細分挖孔和physics會增加mesh、模組及生命週期成本。 | 首選外觀模式，採本站原生WebGL實作圓角／柔光，不整包安裝、不中途讀physics勝負。 |
| [3d-dice/dice-box](https://github.com/3d-dice/dice-box)＋[Smooth Pip](https://fantasticdice.games/docs/themes/smoothPip) | 多面骰／theme系統，圓滑pips版本可作另一現成美術參考。 | [code MIT](https://raw.githubusercontent.com/3d-dice/dice-box/main/LICENSE)；[官方theme說明](https://fantasticdice.games/docs/themes)明列dice-box／dice-themes模型与紋理CC0。採單件仍記來源／版本／檔案。 | 讀到manifest1.1.4與Babylon core/loaders/materials5.57.1，README列AmmoJS／worker／offscreenCanvas與附帶assets。已讀[Methods](https://fantasticdice.games/docs/usage/methods)未列預定結果參數，不能推論絕對不支援；自定theme需另外整合特殊面。 | 可作未來完整骰盤／theme候選；目前只參考外觀。引入引擎、physics worker與模型資料對17個固定UI骰槽過重。 |
| [dice-box-threejs](https://github.com/3d-dice/dice-box-threejs) | 可配置材質／顏色／桌面與陰影，整套物理骰盤。 | [code MIT](https://raw.githubusercontent.com/3d-dice/dice-box-threejs/main/LICENSE)；其public貼圖／聲音未逐件查清，不能沿用另一repo的CC0承諾。 | [manifest0.0.12](https://raw.githubusercontent.com/3d-dice/dice-box-threejs/main/package.json)依Three0.143＋cannon-es0.20。README明列6d6@4,4,…預定結果；[DiceFactory](https://github.com/3d-dice/dice-box-threejs/blob/main/src/DiceFactory.js)可生成文字／圖片face，但不是本站六面重複配比和mask的即插即用API。 | 若未來確實要骰子互撞／桌面自由落點，再做adapter；本批保留原renderer的一秒時序、17槽、server結果，不採physics庫。 |

成本比較依查到的依賴／assets與架構；沒有本站bundle或runtime測量，不提供猜測gzip數字。
Codrops文章的歷史套件KB說明不能當成目前發行版打包大小。
dice-box-threejs有預定结果能力，也不表示可在本站mask前把server result傳physics renderer；本站仍只在result stage提供實值。

## 火焰／particle參考與授權界線

| Primary來源 | 查到的形態與成本 | 授權／資產查核 | 本批取捨 |
| --- | --- | --- | --- |
| [yomotsu/VolumetricFire](https://github.com/yomotsu/VolumetricFire)＋[官方demo入口](https://yomotsu.github.io/VolumetricFire/examples/example1.html) | 體積火焰mesh；[source](https://github.com/yomotsu/VolumetricFire/blob/master/VolumetricFire.js)使用fireProfile/noise兩貼圖、分層幾何與Three.js；不是小point系統。 | README明列port自Alfred Fuller demo；LICENSE讀取404，README/header未見明確授權。只作研究，不複製code／nzw.png／firetex.png。先前訊息中的MIT初判已更正。 | 火舌整體與寬根尖尾可作觀念參考；此volume技術與資產不是本批選擇。 |
| [SmokeGL](https://github.com/SqrtPapere/SmokeGL) | candle火焰／煙霧粒子，以PNG alpha＋shader／Three.js作連續系統；含相機方向排序。 | [code MIT](https://raw.githubusercontent.com/SqrtPapere/SmokeGL/master/LICENSE)已讀；images／audio／obj原始來源未逐件確認，未採其素材。 | 只參考生命週期／色彩層次；大量柔點會偏回使用者不喜歡的點光尾氣，不能只增加粒子數。 |
| [Three.js官方 fire/smoke particles](https://threejs.org/examples/webgpu_particles.html)＋[source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html) | WebGPU／TSL、smoke貼圖與instancing；可看fire／smoke分層，不是本站WebGL1的drop-in shader。 | [Three code MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE)；示範smoke.png未逐件追來源，不採其圖像。 | 本批不加Three/WebGPU依賴；參考明亮火芯與煙色分離即可。 |
| 本站原SVG／CSS尾焰 | public/shared/race-vehicle-effects.js的outer／inner兩path，race.css的短幅scaleX／opacity摆動。 | 既有本站圖形／shader；本批新實作由owner表示自行撰寫，不搬上述外部code或資產。 | 以此原火焰形為直接目標，WebGL改為連續外焰＋亮芯，煙／火花維持原獨立事件。 |

repo軟體LICENSE、theme資產CC0与網站截图是不同來源範圍。沒有已核對的外部資產被納入此候選，也不把搜尋頁的license標籤當成整包素材授權。

## 本批可實作的視覺契約

| 元件 | 採用方式 | 需保留的遊玩體驗 |
| --- | --- | --- |
| 骰體 | 暖象牙白、圓角約全邊長7–10%作調整起點；移除每個atlas面的粗方框，使用平面＋平滑角normal、適量specular。 | 看得出實體，不像貼著六張方形卡；深色pips／特殊短字高對比，不能以反光蓋點數。 |
| 骰點與特殊面 | pips可用原創凹圈／輕微rim明暗；方向箭頭、進入／原位、SM/M/L/SML、熄滅／淘汰仍用原圖意與DOM中文。 | 不變成普通d6、不改六面配比；SML與pit意義仍由condition解釋，普通d6不新增互斥commandmapping。 |
| 投影／動作 | 單薄柔接觸陰影、適量翻滾後小幅settle；按elapsed time採原一秒觀賞，dynamic fit維持槽內。 | 不追physics sleep、不延長等待；只有server結果揭曉後固定正面，结果文字与owner確認仍DOM。 |
| 氮氣形態 | 車尾連續尖舌、橙紅外焰、暖黃亮芯、小soft halo；根部較寬、尾端收束，輪廓自然平滑擺動。 | 主要辨識是火焰，不是零散圓形光點／大煙團；不蓋住車型、損傷標记、事件文字或骰子。 |
| 尾焰位置 | 原車身局部車尾(-20,0)经carrier.getScreenCTM轉換，方向跟車體局部反X；跟隨既有moving wrapper及道路平移。 | 不用server終點跳位、viewport固定左側或錯誤velocity推論；滑移／反向移動不把火焰裝到車頭。 |
| 取消與回退 | 真draw後才替換同類旧裝飾；off/reduce/hidden/loss/失效/新房/anchor不見即清，不補舊焰。 | 原SVG仍是fallback，不能同時兩焰叠加或清GL後仍藏舊焰；不影響規則、聲音和操作。 |
| 效能與網路 | 原生WebGL／有界geometry、同context/buffer；非active無持續rAF，不新增每frame API或物理事件。 | 共用optional2context預算，不因flame建立第三context；沒有性能測量前不宣稱更快。 |

## 與兩個owner的實際收斂

2026-10-07 renderer owner visual_webgl_spec回報候選定案：original圆角cube，每面GRID8×8、角區密排，radius0.18（edge2的9%）；486 cube vertices／768 cube triangles＋4 shadow vertices。無粗方框、深凹圈pips、smooth normal／specular，single quad柔影alpha約19%。動作1.5X／2Y圈ease-out，末18%微settle；geometry依job cache，不逐frame重建。caps仍32骰／750000pixels／DPR1.5／optional2contexts，server仍17骰。這是owner source回報，native觀感待主agent驗，不是教學code照抄或Three/cannon安裝。

flame owner pr46_canvas_fix回報：沿同GameFxLayer context/program/buffer增加flame coords，每emitter固定6vertices／2triangles作batch，無texture／遠端asset；同command一個emitter，以carrier CTM追尾部。active move有效record／anchor存在才持續；hidden/reduce/loss/reset不補播。
設計方已質疑第三context與舊焰叠加，owner採同context解决；新shader之外觀與完整生命周期仍待native。

## 本批必要驗收

所有項目初始待驗；前版v1.13測試、作者demo或本角色的source研究不能代替此表。

| ID | 情境 | 本批必驗 |
| --- | --- | --- |
| V01 | 一般／特殊骰静態結果、17骰1280×720、390窄屏／大字 | 圓角／凹點／光影可辨，pips与中文字不被反光／陰影吃掉；caption及owner操作不變。 |
| V02 | rolling中間多角度、1秒前後／早到與晚到result | 動態fit含rounded corners與shadow仍不越槽；mask無洩值、samecycle不重播、result與server一致。 |
| V03 | nitro普通逐格／玻璃滑移／jump／道路pan | 尾焰始終接車尾、尖尾方向正確、連續可辨、不跳server終點或停在viewport。 |
| V04 | nitro結束／下一階段／下一車／clear/失anchor | emitter即停止；無舊焰ghost、重複同command emitter或粒子／SVG雙焰。 |
| V05 | reduced／off／hidden／pagehide／loss／第三context | 有靜態或旧SVG回退、无補播；shared budget與lease不漏，不以動畫決定accept/規則。 |
| V06 | idle與反覆開關／resize／dialog body scroll | 無永久frame／buffer或job cache無界累積；canvas未active不占舊大尺寸／造成捲軸。 |
| V07 | 網路／特殊faces／聲音／回歸 | 無新增frame API、原物理／server分布／owner／sound事件未改。 |
| V08 | 初版與新版同尺寸實際畫面 | root保存本站before/after與本批native材料；圖片只證當次外觀，不宣稱所有硬體更快或使用者已滿意。 |

最終source／兩平台測試、native及正式站scope由主 agent補進度；不在此預先寫通過或發布。

