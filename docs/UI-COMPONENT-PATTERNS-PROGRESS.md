# 原生元件模式實作進度

2026-10-07最新：**patterns候選1.12.0 Windows完整與fresh有限原生驗收通過；Linux／固定source／tag／正式發布待root**。Windows Node24.14.0 **1,386／1,386，47,918.5986ms**，fail／cancel／skip／todo均0。新UI focused65／65、獨立canvas165／165與media118／118均通過，分組不加到完整總數；widgets72／notifications83是先前focused範圍。本文件不預填已發布。

使用者要求把 [五庫適合方向](research/THREADS-UI-COMPONENTS-ASSESSMENT.md) 嘗試實作，細項見 [規格](specs/UI-COMPONENT-PATTERNS.md)。目前正式仍v1.11.1；本批程式待root提交後固定release source，不以舊1,284／1,299或PR1,300當新結果，未把UI改動混入PR46。

PR46程式a2c5589／tag1.9.3、雙平台1,300與受控原型API證據保持；最新PR head f36b679為Ready仍未合併，最終回覆與scope見 [PR最新進度](PR46-REVIEW-FIX-PROGRESS.md)。本批沒有新PR或新正式patterns發布；更早暫停／cf64bfc階段是歷史。

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

| 提案／質疑 | 收斂 | 狀態 |
| --- | --- | --- |
| 主agent限定本批真實頁面與元件責任，避免僅做孤立demo。 | widgets接收藏庫／市場、notifications接五遊戲與既有成就差集、root接短粒子／routes／驗收。 | 分工已確認，實作與結果待驗。 |
| 規格方：manual tabs不能用箭頭誤發request；confirm流程須保busy與意圖。 | widgets方回覆manual mountTabs／field feedback不接管submit，兩個市場dialog沿用busy；收藏confirm不換成async示範，離music暫停preview。 | API契約已回覆，程式／原生仍待驗。 |
| 規格方：toast不能代替必要inline，成就不新增poll或初次baseline慶祝。 | notifications方回覆finitecaps、四款既有server id／title新earned差集與五款toast；draw不加achievement API，保inline／fallback。 | API契約已回覆，程式／原生仍待驗。 |
| root要求hidden保留可讀通知。 | notifications方採hidden暫停expiry、取消入場／celebrate、queued禁止補motion；pagehide全清理。 | 不把hidden時保留正文誤寫成補播粒子。 |
| 真invalid batch焦點最後跑到file。 | widgets方在shared invalid事件集中成一microtask，focus首invalid；validate focus:false／reset／destroy取消排程。 | 真Chrome首name焦點、name／file各自錯誤、valid title只清自身已驗。 |
| 新review發現20次Arrow／FIFO舊位置及baseline回覆排序漏new earned。 | 共用focus位置同步更新；tracker按request順序drain、8jobs／10s／保head與最新、不retry／poll。 | focused／Windows完整與fresh tracker真取得成就已驗；Linux／source／正式仍待，不把有限native當全矩陣完成。 |

## 驗收紀錄

| 範圍 | 結果 |
| --- | --- |
| widgets／tabs／forms／dialog／cards自動回歸 | focused **72／72，4855.2848ms**，fail／cancel／skip／todo0；shared9＋真GameUI／widgets／兩頁HTML/controllers整合9＋舊市場／收藏54。rapid Arrow位置共用修正已完成；本欄是focused，不是本批全套。 |
| notifications／new earned／celebrations回歸 | 最新 **83／83 focused**含中央tracker排序與有界jobs；初版63／63為先前scope，不能加總。request baseline／8jobs／10s timeout／cleanup／新earned source已完成，整合全套／追加原生待root。 |
| 真keyboard／hash／權限 | fresh收藏ArrowRight focus characters、selected avatars不變，hostAPI431→431；`work/ui-pattern-native-final-tabs.json`，1600×900最終桌機截圖root已檢視卡片status／金框。較早6→6／市場15→15與memberadmin隱藏是獨立矩陣。 |
| 真dialog／欄位 | 兩市場dialog Escape close、各回previewButton／approveFiltered；invalid batch首name、name／file兩錯誤、validtitle只清own。Tab到confirmSettlement，下一步到body／browser chrome邊界。不能據此宣稱fulltrap／reader通過。 |
| 桌機／390／字體模擬 | collection1280×720／390×844／1600×1080與membermarket1280／390，documentWidth≤viewport、44pxcontrols；review卡selected border／shadow、同120px高。controlled glyph double的tabs fit，但不是actual browser zoom／全project200%認證。長文／通知burst完整矩陣待驗。 |
| 收藏Audio離tab | 真native Play請求後paused false／readyState0；換tab後paused true。尚未解碼完成，不稱完整播放／喇叭可聽。 |
| 畫猜途中回歸 | 舊本批held／viewer／換輪receipts保持原限定scope，Windows完整與獨立canvas165通過；不冒稱fresh重新跑完整畫猜原生矩陣。 |
| Fresh真earned tracker／終了 | 第1手timeout無主動決策依原規則不給成就；第2手guest手動fold、第3手host手動fold，各first-hand／first-table。host known0→2／pending0，持久inline、visible2／timers2／celebrate2；91samples終了visible／queued／timers／celebrate0。`work/ui-pattern-native-final-tracker-earned.json`。 |
| Fresh GL shader probe | developer `GameUI.notify`探針暫wrap drawArrays並立即readPixels：1draw／104非透明、errors0，兩GL context預算、1500ms效果active0；wrapper已restore。`work/ui-pattern-native-final-gl-probe.json`。是shader probe而非server-earned GL／FPS，timer後透明像素不算可見bug；兩新增HTTP是既有guest `/api/state` polls，不說alltraffic0。 |
| 最終Windows／Linux整合 | Windows Node24.14.0完整 **1,386／1,386／47,918.5986ms**，all0；新UI65／canvas165／media118三focused／複查通過但不加總。Linux／固定commit／tag尚待root。 |
| 正式備份／預演／即時房間／公開資源／ACL／資料 | 待正式證據後記錄，不預填已發布。 |
| own tabs／overrides／preview／房間／session收尾 | 兩own tabs已close、focus／metrics cleared；isolated preview正常stop、exit0。正式驗收房／session等要部署後另核，不預填已清理。 |

## 接手與限制

目前原生摘要來自 `work/ui-pattern-native-widgets-checks.json`、`ui-pattern-native-responsive.json`、`ui-pattern-native-text-scale.json`、`ui-pattern-native-earned-final.json`與`ui-pattern-native-achievements.json`，collection桌機截圖主agent已檢視selected row正常。所有為有限fixture／背景Chrome證據，不抄入房號／帳密／cookie。

目前正式只讀重新盤點為schema16／22表、**9帳戶（8member／1admin）、market_images13**。這些新帳戶與已上傳圖片必須保留；不能沿用較早8帳戶／空圖片表的pin。私人builder以9重新唯讀audit12／12，保持全22表／帳戶／files／env保全門檻，備份／freshguard／公開驗收仍待部署實績。

本批不是五庫移植；Windows完整、中央source與fresh有限native已完成，Linux／固定release commit／tag與正式尚待root。沒有full modal trap／讀屏／真200%zoom／所有phase／喇叭或FPS結論；舊尺寸／form／Draw receipts不代表fresh全矩陣，developer shader probe不等server-earned像素實證。
