# 原生元件模式實作進度

2026-10-07最新：**原生元件模式已正式發布shhuang.cc v1.12.0，公開資源／權限／資料驗收完成**。受測程式 `83ffcabfcedf4be9b0bfd9d8c8ca9069c6f27c67`，本地annotated tag `v1.12.0`固定該程式，後續文件不移動tag。Windows Node24.14.0 **1,386／1,386，47,918.5986ms**、Linux Node22.22.1 **1,386／1,386，230,914.357751ms**，fail／cancel／skip／todo均0、無preload；focused65／canvas165／media118不加總。

Frozen source archive SHA-256 `c36ee184ad47b912f37ff16ff346bc718802484c59bcf5e6c9e4970f3c02343e`，已排除私有檔並驗Linux／依賴lock／materialize。fresh guard `2026-10-07T13:51:46.748Z` rooms0／reset null、自有inventory session已登出；正式PID141961→147429，服務／tunnel active、env／data paths保持。下方較早pending狀態由本段取代。

使用者要求把 [五庫適合方向](research/THREADS-UI-COMPONENTS-ASSESSMENT.md) 嘗試實作，細項見 [規格](specs/UI-COMPONENT-PATTERNS.md)。本批codefreeze／本機與正式QA收尾完成，不以舊1,284／1,299或PR1,300當新結果，UI改動不屬PR46，沒有新UI PR。

PR46已由外部於 **2026-10-07T13:44:38Z**合併，head f36b679／merge `1ea916ad651c4b8cad0babfdceed154348a20156`；root僅fetch／核對，三份media程式／測試與a2c5589及本批83ffcab一致，無需改runtime。PR1.9.3雙平台1,300與本批1.12雙平台1,386是不同範圍；新UI不算PR內容，見 [PR最新進度](PR46-REVIEW-FIX-PROGRESS.md)。未另發UI PR，正式patterns已包含於v1.12.0。

## 目前範圍

| 模式／參考 | 原生落點 | 狀態與下一個證據 |
| --- | --- | --- |
| Magic UI有限通知 | 共用notifications＋五遊戲toast／四款既有new earned | 已實作／focused83；3visible／12queue／256seen／3–12s expiry，原inline／fallback保留；中央tracker按request順序baseline／差集，最多8jobs／10s timeout，不新增poll。畫猜不加成就query。 |
| Aceternity tabs／card | 收藏庫／市場manual tabs、卡片選取 | focused與fresh收藏卡使用中status／均一金框已驗；ArrowRight focus characters、selected avatars不變，hostAPI431→431；其餘較早尺寸／鍵盤矩陣保持原scope。 |
| shadcn group／dialog | 命名按鈕群組與市場兩個native confirm | 真Escape關閉／返焦兩dialog與review card選取已看；收藏window.confirm保留。尚未證明完整modal trap。 |
| React Aria互動 | tabs、modal focus、field aria-invalid／describedby | 原生invalid batch發現focus跑到最後無效欄位，已共用修正並驗首name焦點／兩欄錯誤／只清自己的描述。無讀屏認證。 |
| React Bits效果概念 | 原雷霆局部WebGL＋新earned通知旁短慶祝 | fresh真撲克有效手動fold取得成就、inline與2通知／慶祝後終了0。另developer notify probe即時readPixels104非透明只驗shader，不冒充server-earned GL畫面或FPS；其他較早scope保持。 |

沒有安裝React／Next.js／OGL或複製外部元件／shader。原研究license摘要保持，不因本站原創實作改成已取得所有庫授權。

## 實際討論

| 提案／質疑 | 收斂 | 當時狀態（歷史） |
| --- | --- | --- |
| 主agent限定本批真實頁面與元件責任，避免僅做孤立demo。 | widgets接收藏庫／市場、notifications接五遊戲與既有成就差集、root接短粒子／routes／驗收。 | 當時確認分工；後續實作／驗收已完成，見下方實績。 |
| 規格方：manual tabs不能用箭頭誤發request；confirm流程須保busy與意圖。 | widgets方回覆manual mountTabs／field feedback不接管submit，兩個市場dialog沿用busy；收藏confirm不換成async示範，離music暫停preview。 | 當時待驗；後續source／有限native與正式結果見下方。 |
| 規格方：toast不能代替必要inline，成就不新增poll或初次baseline慶祝。 | notifications方回覆finitecaps、四款既有server id／title新earned差集與五款toast；draw不加achievement API，保inline／fallback。 | 當時待驗；後續source／有限native與正式結果見下方。 |
| root要求hidden保留可讀通知。 | notifications方採hidden暫停expiry、取消入場／celebrate、queued禁止補motion；pagehide全清理。 | 不把hidden時保留正文誤寫成補播粒子。 |
| 真invalid batch焦點最後跑到file。 | widgets方在shared invalid事件集中成一microtask，focus首invalid；validate focus:false／reset／destroy取消排程。 | 真Chrome首name焦點、name／file各自錯誤、valid title只清自身已驗。 |
| 新review發現20次Arrow／FIFO舊位置及baseline回覆排序漏new earned。 | 共用focus位置同步更新；tracker按request順序drain、8jobs／10s／保head與最新、不retry／poll。 | 已納入固定83ffcab／雙平台完整與正式交付；finite native不當全矩陣認證。 |

## 驗收紀錄

| 範圍 | 結果 |
| --- | --- |
| widgets／tabs／forms／dialog／cards自動回歸 | focused **72／72，4855.2848ms**，fail／cancel／skip／todo0；shared9＋真GameUI／widgets／兩頁HTML/controllers整合9＋舊市場／收藏54。rapid Arrow位置共用修正已完成；本欄是focused，不是本批全套。 |
| notifications／new earned／celebrations回歸 | 最新 **83／83 focused**含中央tracker排序與有界jobs；初版63／63為先前scope，不能加總。request baseline／8jobs／10s timeout／cleanup／new earned已納入雙平台完整；finite native與未測矩陣分開記。 |
| 真keyboard／hash／權限 | fresh收藏ArrowRight focus characters、selected avatars不變，hostAPI431→431；`work/ui-pattern-native-final-tabs.json`，1600×900最終桌機截圖root已檢視卡片status／金框。較早6→6／市場15→15與memberadmin隱藏是獨立矩陣。 |
| 真dialog／欄位 | 兩市場dialog Escape close、各回previewButton／approveFiltered；invalid batch首name、name／file兩錯誤、validtitle只清own。Tab到confirmSettlement，下一步到body／browser chrome邊界。不能據此宣稱fulltrap／reader通過。 |
| 桌機／390／字體模擬 | collection1280×720／390×844／1600×1080與membermarket1280／390，documentWidth≤viewport、44pxcontrols；review卡selected border／shadow、同120px高。controlled glyph double的tabs fit，但不是actual browser zoom／全project200%認證。長文／通知burst完整矩陣待驗。 |
| 收藏Audio離tab | 真native Play請求後paused false／readyState0；換tab後paused true。尚未解碼完成，不稱完整播放／喇叭可聽。 |
| 畫猜途中回歸 | 舊本批held／viewer／換輪receipts保持原限定scope，Windows完整與獨立canvas165通過；不冒稱fresh重新跑完整畫猜原生矩陣。 |
| Fresh真earned tracker／終了 | 第1手timeout無主動決策依原規則不給成就；第2手guest手動fold、第3手host手動fold，各first-hand／first-table。host known0→2／pending0，持久inline、visible2／timers2／celebrate2；91samples終了visible／queued／timers／celebrate0。`work/ui-pattern-native-final-tracker-earned.json`。 |
| Fresh GL shader probe | developer `GameUI.notify`探針暫wrap drawArrays並立即readPixels：1draw／104非透明、errors0，兩GL context預算、1500ms效果active0；wrapper已restore。`work/ui-pattern-native-final-gl-probe.json`。是shader probe而非server-earned GL／FPS，timer後透明像素不算可見bug；兩新增HTTP是既有guest `/api/state` polls，不說alltraffic0。 |
| 最終Windows／Linux整合 | 固定83ffcab／tag1.12：Windows **1,386／1,386／47,918.5986ms**，Linux **1,386／1,386／230,914.357751ms**，all0／無preload；新UI65／canvas165／media118不加總。 |
| 正式備份／預演／即時房間／公開資源／ACL／資料 | 已完成，詳下方正式驗收；副本／啟動保持schema16／22表及9帳戶allfields。 |
| own tabs／overrides／preview／房間／session收尾 | 本機／正式own tabs與metrics／focus override已清、preview正常stop exit0；正式兩own房已刪／sessions登出，QA history保留，其他使用者未改。 |

## 接手與限制

目前原生摘要來自 `work/ui-pattern-native-widgets-checks.json`、`ui-pattern-native-responsive.json`、`ui-pattern-native-text-scale.json`、`ui-pattern-native-earned-final.json`與`ui-pattern-native-achievements.json`，collection桌機截圖主agent已檢視selected row正常。所有為有限fixture／背景Chrome證據，不抄入房號／帳密／cookie。

## 正式發布／公開／資料

| 驗收 | 最終實績 |
| --- | --- |
| 備份／隔離boot | 識別 `pre-ui-component-patterns-83ffcab-20261007T134933Z`，onlineSQLiteBackup true／fileArchiveAtomic false。same schema16／22表allrows與9帳戶全fields、clone boot與import generation inactive；線上DB及另時點files不是atomic cold snapshot。 |
| 公開媒體 | **38assets**全部精確frozen83／no-store／content types；3own members enqueue、普通transport403、promote roommanager seek12／skip、demotion403、site roles不變。沒有載Google metadata，影片有title但不是正式真YT播放證據。 |
| 公開畫猜 | **37assets**精確frozen83／no-store，真SSE pointTimes[0,40,130]及ACK／SSE各約123ms、canonical points、duplicate id不double quota、nonartist **HTTP400**（只有當輪畫者）、undo／clear不退額度。單次HTTP／SSE時間不當自然FPS。 |
| 最後資料 | live1.12／PID147429、schema16／22table schemas、**market_images13**、**21個non-session表**rows／BLOB全等backup、**9users allfields**，integrity ok／FK0，env／data paths保持。sessions210→217為允許的登入／session變動，不說全sessionrows不變。 |
| 正式readonly Chrome | collection沿既有usercookie，只讀無login／logout／profile／設定修改。settings顯示v1.12、close返焦；actual CDP查GameUI為object、mountTabs／bindForm／bindDialog皆function；ArrowRight focus「角色10位」、selected「頭像11張」／URL /collection不變。先前Playwright DOMscope false診斷排除，非產品缺功能。 |
| 範圍／收尾 | 兩own房刪、驗證sessions logout、QA history保留、no profiles／artworks write；正式兩own Chrome tabs已close／metrics清，無使用者前景變更。截圖仍含先前settings panel，不當closed-state同步證據；local clean collection截圖可展示。 |

正式新帳戶與13張圖片完整保留；這次用9帳戶fresh pin，不沿用歷史8帳戶／空圖表。PR46外部合併後，body已同步正式1.12實績、[closed PR follow-up](https://github.com/stanley021039/BGA/pull/46#issuecomment-6039588219)已發；不推merged分支或把本批UI列為PR內容。

本批不是五庫移植，固定source／tag、雙平台完整、fresh有限native與正式／資料驗收已完成。仍無full modal trap／讀屏／真200%zoom／所有phase／喇叭或FPS結論；舊尺寸／form／Draw receipts保限定scope，developer shader probe不等server-earned像素實證。公開API／title／ACL不冒稱真YT播放或所有裝置驗證。
