# 雷霆之路：WebGL 立體骰子規格

日期：2026-10-07。狀態：已實作並正式v1.13.0；逐scope驗收及限制見 [進度](../RACE-DICE-WEBGL-PROGRESS.md)，不把全部矩陣視為所有原生場景都通過。
研究時讀到 package v1.12.0、HEAD 552b41c；這是讀取時點，不能當成新功能受測或發布版本。
本文件由設計／程式研究角色撰寫；實際完成項目及限制以 [進度](../RACE-DICE-WEBGL-PROGRESS.md) 為準。

## 目的與範圍

依本次使用者要求，雷霆全員同步擲骰 dialog 以原生 WebGL 呈現立體翻滾，保留既有約一秒觀賞與逐人權限流程。
骰面立體感用正面、側面、明暗及適度旋轉建立；不靠整窗晃動、長演出或強閃光。
沒有新 framework／physics engine／外部素材下載；不更改伺服器亂數、六面分布、碰撞／射擊／地形規則、DB schema 或任何逐幀網路事件。
既有 GameFxLayer 車旁粒子和骰子共用可選 renderer 的全頁兩 context 預算；不把每顆骰子建立成独立 canvas/context。

## 已確認的既有程式事實

以下是研究起始讀取，實作可能改動行號；不能據此宣稱 WebGL 功能已驗。

| 程式位置 | 已確認事實 | 必须保留 |
| --- | --- | --- |
| src/games/thunder.js:7–9、36–40 | dice.faces 是可能面，重複項代表原六面配比；result.faces 才是權威結果。 | renderer 不產生遊戲亂數、不改成 Set 等概率。 |
| src/games/thunder.js:79–80 | round 最多四隊各四顆＋共同公路骰＝17 顆；首輪最低者先手規則由 server 決定。 | 共同公路骰單獨分組、各隊名字與分數／先手結果保留 DOM。 |
| src/games/thunder.js:37、171 | participants.car 是車 ID；同隊兩車可出現相同玩家 ID，碰撞有兩顆特殊骰。 | 名稱不顯示 UUID；車卡以車 ID 唯一、骰歸隊仍使用 participant ID。 |
| public/shared/race-dice-dialog.js:39–40、58–60、88–102 | cycleKey 為 id＋startedAt；首次觀察 rolling 本機至少遮結果約1000ms，參考 readyAt/serverNow；只有完整 result 才公開。 | 提早抵達的 result 仍受原 mask 約束；同次 polling 不重播，reroll 新 startedAt 才新 cycle。 |
| public/shared/race-dice-dialog.js:53–56、70–84 | DOM figure aria-label、caption、condition、result、status 和 owner action 原已存在。 | GL canvas aria-hidden、pointer-events:none、不進 Tab；DOM 承擔可讀語意／按鈕／錯誤。 |
| public/shared/race-dice-dialog.js:106–115 | owner 才可 roll/reroll/accept；reset/destroy 清 timer；hidden／policy 減動。 | 不能由動畫完成呼叫 acceptDice，不能繞過 owner 或取消 server 流程。 |
| public/shared/game-fx-layer.js:4–7、145 | 本批程式協調新增 acquireContext/releaseContext，MAX_CONTEXTS=2。 | 所有本頁可選 WebGL renderer 用同一 lease；這不是浏览器／iframe的總 context 保證。 |

## 骰面與美術辨識

一般骰採暖白面、森林綠或深色點數、清晰邊線；隊色放卡片邊界或適量邊緣，不能用不同颜色代替點數。
每顆骰的可讀名稱／結果中文维持 DOM 16px；必要次要文字14px；原主要控制44px。
主結果面應正向可讀，側面用來提供立體線索，不在極窄側面放唯一必要資訊。
過長名稱放 caption/condition，不一路縮小字塞進貼圖；特殊骰面用短詞或圖案搭配中文，避免截掉半字／箭頭語意不明。

| 骰種／faces 原值 | 立體骰面表示 | DOM 保留與易讀驗收 |
| --- | --- | --- |
| 移動骰 [1,2,3,4,5,6] | 1–6 pips，可保留點數辨識。 | 「骰子 N，X 點」；一般 d6 不加一面一指令對照，nitro 1–3 與 drift 3–5 条件重叠，不能誤畫成互斥玩法。 |
| 公路 [1,1,1,2,2,3] | pips，保留六個面索引。 | 「共同公路骰」及加速點數；不能混入某隊四顆骰。 |
| 特技 [1,2,2,3,3,4] | pips＋原名稱。 | 跳台／暈頭距離按原 condition 說明，不能畫成1–6普通骰。 |
| 射擊／陷阱 ['SM','M','L','L','L','SML'] | 短車型字母或小車型圖案；SML須三種皆能辨。 | condition 明列「包含自身／目標車型」，SML亦命中；同一面在shot與pit的結果意義不同，不一律染成功綠色。 |
| 受推車 ['進入車','進入車','原位車','原位車','原位車','原位車'] | 可採「進入／原位」短詞＋車圖。 | 保留完整「受推車骰」與兩車身份；不是兩玩家各擲d6比大小。大車主最多一次重擲兩顆由 server 授權。 |
| 方向 ['前左','前方','前右','後左','後方','後右'] | 清楚箭頭＋短方向詞。 | DOM完整方向、賽道前方基準不變；UV、旋轉落姿不能把文字鏡像或把箭頭反向。 |
| 火焰 [1,1,2,2,'out','eliminate'] | pips／熄滅短圖案／淘汰短圖案。 | 明列加速、熄滅或淘汰，保留試玩配比說明，不替換成一般1–6。 |
| 未知／等待 | ? 或既有未知呈現。 | 「尚未擲骰／擲骰中／等待伺服器結果」，不從 renderer 的最後假面讀出勝負。 |

圖案自製或沿用現有可辨識形狀，UI工具圖示仍由 GameUI registry 管理；不下載新圖／字型或添加需新授權的素材。
「命令圖案」在本批指特殊骰的玩法符號；一般 d6 與指令可用條件的對照不是本批範圍。此點已與主 agent 確認。

## 時序與權威邊界

1. awaiting：顯示未知與完整條件，owner 原操作可用；不得用先行旋轉假裝已擲。
2. rolling：同 cycle 依本機 elapsedMs/durationMs 演約1000ms立體翻滾。只有可能 faces 可傳 renderer，result 尚被 mask 時不能傳 value／文字。
3. 觀賞時間已到而 server 尚無完整結果：停止／退回未知等待，不把最後裝飾面定為結果，不自動 accept。
4. result：先由原 dialog 更新 DOM 權威值，再呈現相符立體主面；結果仍待 owner 確認。不能有一次錯面閃現、動畫補算或「先看出最終面」。
5. 新 reroll 的 startedAt 變化才新 cycle；同 cycle SSE/poll/改名／在線狀態只更新現有呈現，不重置旋轉時間、聲音或focus。
6. 重新入場／慢網首次僅收到 result 沿用原 dialog 規則；既有 deferred movement 情境也沿用原mask，不新增強制一秒重播。
7. hidden、減動或 MotionPolicy 停用清GL動畫、還原原骰面；回來不補播舊 motion，mask／owner／結果狀態仍由 dialog 決定。

「一秒」是配置與本機觀賞條件，不是所有席同一顯示幀／60FPS證明；網路結果缺席時不承諾一秒即可繼續。

## Renderer 與 dialog 協商契約

2026-10-07 dialog owner pr46_canvas_fix 回覆以下介面，renderer owner visual_webgl_spec 核對實作。
此表是跨角色契約；renderer owner已回覆候選source的限額如下，native畫面仍待驗，不把source存在寫成發布完成。

| 介面／責任 | 契約 |
| --- | --- |
| 建立 | RaceDiceWebGL.create(body,{policy,onActivity})，每 dialog 一個透明 canvas／共用 context lease；支援未載入模組時直接用舊骰面。 |
| 呈現 | show({key,stage,dice,elapsedMs,durationMs})；dice.anchor 對應原 span.face，faces保留原值與重複面；僅 result stage 传 value。 |
| 清理 | clear / destroy / getState；clear停frame／清畫面／還原 fallback，destroy釋放GPU資源／listener／observer／lease。 |
| 替換 | 真正 draw 成功才 onActivity(active:true) 遮住原SVG/文字骰面；不是create成功或rAF已排程就遮。空畫面／失敗／loss即復原。 |
| 位置 | 對齊稳定的骰槽，不能量正在 CSS tumble transform 的face而追錯位置；active時停止舊face動畫，DOM文字不藏。 |
| 捲动／尺寸 | canvas在native dialog top layer內；body局部scroll時座標與clipping一致，不蓋header／footer／按鈕。resize/scroll合併單次更新，不每frame读取全部DOM幾何。 |
| 結果 idle | 靜態結果最多必要繪製／resize更新，無永久rAF；聲音仍沿用原onRolling，不因重畫再播。 |
| 額度 | 全頁 optional WebGL contexts≤2，dice17顆共用一個；第三個安全fallback，不踢其他已用層。 |
| 候選硬限 | renderer最多32顆輸入；本遊戲server仍最多17。Atlas512×512、64個64px圖格／最多64 distinct labels、UV內縮4px、CLAMP_TO_EDGE＋LINEAR、不生成mipmap。DPR≤1.5、backbuffer≤750000pixels；這些是限額，不是效能／可讀性通過證據。 |

## 原生 WebGL 實作方式與資源邊界

以靜態立方體 mesh／面UV／旋轉及投影轉換（matrix或等價shader運算）、輕量面明暗和atlas实现真正3D。
六面cube可用24面顶点＋36indices（12triangles）；這是MDN示範的做法，工程可採等價頂點布局，不需加矩陣或physics framework。[MDN cube](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Creating_3D_objects_using_WebGL)

原創pips／短詞／圖案由本機Canvas 2D生成有界atlas後上傳texture；同cycle/layout不每frame重建或texImage2D。
UV须有cell padding／內縮，正背面的文字方向一致；重複值可以共用貼圖，但六面的列表索引與权重不可合併。
WebGL1的NPOT貼圖需CLAMP_TO_EDGE及LINEAR/NEAREST；若使用mipmap必須滿足尺寸與面間padding條件，不能生成會把相鄰圖格混色的mip chain。[MDN textures](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL)

初始化查一次能力／MAX_TEXTURE_SIZE並保守限制atlas、backbuffer面積與DPR；不每frame getParameter/getError/readPixels。
共用mesh／buffers、適量光照；不加即時陰影圖／全屏blur或高亮閃爍。資源上限屬工程選擇，須在progress列實際值與超限結果；不能用桌機能力推定手機相同。[MDN best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

context建立、shader/link、texture/buffer配置、capacity任一步失敗皆不throw到遊戲render，立即停止遮舊面。
context lost須取消frame、清activity、還原DOM；若要允許restore，lost handler preventDefault，restored重建全部GPU資源，只服務下一個合法cycle，不回播舊旋轉。
候選renderer保留lost context的預算reservation，避免browser restore時超出optional兩slot；destroy／失敗先清GPU資源並在可用時loseContext，再歸還lease。這是本頁managed optional renderers的預算，不承諾瀏覽器所有分頁／iframe／2Dcontext總數。
destroy删除program/buffer/texture且歸還lease；不可殘留close後frame或observer。
此恢復契約依Khronos規範，不是宣稱瀏覽器一定會restore。[WebGL規範](https://registry.khronos.org/webgl/specs/latest/1.0/)

## 官方研究與證據範圍

查核日期2026-10-07；只採MDN/Khronos原始文件，未下載教學圖像／套件，未開示範browser。

| 官方來源 | 查到的做法／限制 | 本案採用方式（設計推論） |
| --- | --- | --- |
| [MDN WebGL cube](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Creating_3D_objects_using_WebGL) | 面頂點／indices及旋轉matrix可構成立體cube。 | 複用cube幾何，逐骰pose；旋轉不裁決遊戲結果。 |
| [MDN textures](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL) | 面UV、texture upload、WebGL1 NPOT及跨域限制。 | 本機生成atlas，無外部圖片／CORS依賴；逐面文字方向與貼圖邊界需驗。 |
| [MDN lighting](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Lighting_in_WebGL) | 光照需在shader自行計算，可用ambient＋directional。 | 輕量明暗保立體，前面圖案仍高對比。 |
| [MDN best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) | GPU資源／draw batch／DPR要有界，阻塞查詢及頻繁upload有成本。 | atlas與backbuffer限額、init能力查詢、idle停frame；尚無效能收益實測。 |
| [MDN contextlost](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event)＋[Khronos WebGL](https://registry.khronos.org/webgl/specs/latest/1.0/) | context可能丢失，restore後原GPU資源失效。 | loss即fallback、restore重建；不影響DOM權威結果。 |
| [Khronos WEBGL_lose_context](https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/) | 可模擬lost/restored以驗證生命週期。 | 背景Chrome可做真失效測試，缺extension要記限制。 |
| [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion) | reduce表示減少／替代非必要動態。 | 零旋轉／零GL frame，以既有未知與靜態結果保完整流程。 |

本次研究只確認可行做法，不是性能benchmark、硬體GPU證明、所有平台可讀性或全站無障礙證明。

## 必要驗收矩陣

全部初始狀態為待驗，主 agent 在progress填實際source／VM／native／正式站證據；每類不可互相代替。

| ID | 情境 | 必須成立 | 證據方式 |
| --- | --- | --- | --- |
| D01 | round四隊17骰、1280×720／1440×900 | 一個canvas／最多一個dice context，分隊和共同公路分組正確；condition、result、owner操作可見。 | native幾何／截图＋context lease計數。 |
| D02 | collision／shot／pit／fire／direction／jump／blast | 特殊面中文及圖案可辨、同隊兩車身份不丢；shot/pit意義與重複面权重不變。 | 全face mapping單元＋native結果截圖。 |
| D03 | result在本機1秒前抵達、result晚抵達／永不抵達 | mask前DOM／canvas都不能露實際結果；晚到仍等待、不猜值／不自動accept。 | 真dialog VM＋兩席native時序採樣。 |
| D04 | samecycle poll／SSE、reroll、初次result、deferred結果 | 同cycle不重播／聲音不重複，新startedAt可新播；原deferred契約不變。 | 時鐘控制單元＋nativecycle與操作。 |
| D05 | owner／另一席／同隊兩車 | 只有owner可操作、重擲次数及accept仍server判定。 | server回歸＋兩席dialog操作。 |
| D06 | reduced-motion、個人動畫off，途中切換 | 停frame／restore原面／不補動畫，未知与結果及操作完整。 | media/policy VM＋native設定／畫面。 |
| D07 | hidden/show、pagehide/BFCache、close/reset/destroy、新房 | 無舊frame／timer／observer／lease漏；回來不補舊roll或遮新結果。 | lifecycle單元＋native切換。 |
| D08 | getContext=null、shader/link/texture錯誤、模組缺席、第三context | 不throw、不空白、不遮原面；owner操作及dialog流程仍可完成。 | 故障注入＋實際WebGL停用。 |
| D09 | 真WEBGL_lose_context／restore | lost即fallback；restore重建資源且不重播，context數不超2。 | Khronos extension native試驗；不支持須標未驗。 |
| D10 | idle結果、repeat open/close、连续check／多次reroll | idle無永久rAF／新增API；重複查核不無界累積texture或listener。 | renderer counters／frame與網路記錄。 |
| D11 | 390×844／320窄屏、矮窗、200%文字／瀏覽器縮放、DPR1/2 | 不橫溢；局部scroll不讓cube蓋footer，front圖案／中文可讀，原44px操作可達。 | native幾何／elementFromPoint／截图；字級與zoom分開記。 |
| D12 | 半途resize／body scroll、舊CSS tumble並存 | canvas與穩定骰槽對齊、無雙動畫／錯位，scroll clipping正確。 | native途中採樣。 |
| D13 | 車旁FX與骰子同时／連續使用 | 共用2context預算，不奪走既有層；粒子／dialog互不覆蓋狀態。 | 整合單元＋native真draw。 |
| D14 | 格式／文字／權威結果回歸 | 無額外serverframe、無玩法變更、無結果先洩、無8px式縮字。 | 原suite＋source/API比對＋實際文字驗收。 |

發布前須記完整版本／source、兩平台測試、native真draw與fallback、資料保留及正式站有限範圍。
本文件不授權改動其他遊戲、正式帳戶、部署或PR；新功能的發行仍由主 agent 依本輪授權處理。

## 跨角色討論紀錄

- 設計方提出：17骰共用canvas、主面清晰、短符號＋DOM中文；保留六面重複分布與server-only value。
- dialog owner確認：create/show/clear/destroy/getState；只有result傳value，真draw後遮原面，fallback還原，原condition/aria/caption不移除。
- 設計方指出：原CSS tumble會污染anchor rect；body scroll可能令canvas蓋住header/footer。交整合owner按稳定槽與clip驗收，未把source查核當native通過。
- 主 agent確認：pips＋特殊短圖案，不加一般d6 command對照；長文字不能縮成不可辨字，native稍後驗。
- renderer owner確認候選atlas／UV／限額、lost保留reservation、destroy/fail先lose再release；特殊短詞進入／原位、前方／後方箭頭已納入，原DOM保完整中文。
- 唯讀review指出逐frame getError同步成本及offsetParent/body scroll座標問題；候選source已改每new job一次error查核，owner回報scroll回歸。原生時序／位置仍待主agent驗。
- 另一待驗是翻滾cube頂點可能越出正面槽、碰到caption；此為幾何推論，不能當成已看到的遮擋。17骰途中截图須檢查，必要時限制rolling尺度／art clip，結果主面及文字不縮。


最後實作：rolling 每姿態依八頂點投影限制在骰面內並保留1px，避免遮住caption；result維持原尺寸。context clear／awaiting／loss隱藏canvas，不讓舊尺寸造成窄dialog捲軸。原生及兩平台／發布狀態只以進度文件為準。
