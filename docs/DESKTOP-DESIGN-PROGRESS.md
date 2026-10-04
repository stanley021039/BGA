# BGA 桌機介面設計進度

日期：2026-10-04。依 [桌機設計規格](DESKTOP-DESIGN-SPEC.md) 分三階段執行。桌機優先、手機輔助；全程背景測試，完成後不建立MR。

## 三階段狀態

| 階段 | 狀態 | 已完成內容與下一步 |
| --- | --- | --- |
| 1 設計研究與討論 | 完成 | 三位agent比較多個官方設計系統、原始研究與實作範例；補充漸進揭露、狀態／錯誤、焦點／對比、局部動效與結果呈現。確定共同slot及token合約。 |
| 2 審查與spec | 完成 | 讀四款遊戲和共用UI；本次隔離Chrome背景實際載入7個狀態，1280×720留before畫面及DOM測量。spec按11理念×5遊戲分類，共55項。 |
| 3 實作與背景遊戲測試 | 完成 | 共用及四款遊戲實作完成。Windows／Linux各173/173；正式站四款背景主要流程通過，未push或建立MR。 |

## 規格執行狀態

「已驗證」指本批spec修改及下列檢查範圍，包含真實主要流程、受控顯示fixture與所列token對比；不表示每種隨機事件都已實玩，或整站符合WCAG。

| 理念 | 整體遊戲 | 送禮達人 | 你畫我猜 | 雷霆之路 | 同頻俱樂部 |
| --- | --- | --- | --- | --- | --- |
| L 桌機布局 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |
| T 字級 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |
| A 對齊 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |
| S 間距／點擊區 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |
| I 圖文／資訊量 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |
| V 圖示 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |
| C 共用位置／元件 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |
| P 漸進揭露 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |
| F 狀態／錯誤 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |
| K 焦點／對比 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |
| M 動效／結果 | 已驗證 | 已驗證 | 已驗證 | 已驗證 | 已驗證 |

## 已確認的問題

| 區域 | 本次證據 | 修正方向 |
| --- | --- | --- |
| 共用頁首／互動區 | header105px；角色六表情常駐；四款dock超出720px | compact header、角色選單按需、固定右側操作及互動區 |
| 八人送禮 | 禮物／朋友10px、recipient25.5px；stage底815、dock約1300px | 單panel自由切換、雙進度常駐、共享字級與局部名單scroll |
| 畫猜 | choosing缺明確分支可顯示完成／重玩；工具與猜題區過長 | 分階段狀態修正、保留canvas、工具與右側操作分工 |
| 雷霆 | 字9–12px、主操作30px、dock底858px | 道路左、dashboard右上、次要紀錄／車隊收合 |
| 同頻 | 選答案重建stage失焦、主操作／dock超出720px | 局部選取更新、static action slot、分組／明細分工 |

## 驗證紀錄

本次before檢查使用隔離本機資料庫與八個開發帳號，沒有更改正式帳密或使用使用者前景分頁。測試程序／資料均在已忽略的work目錄，密碼不提交。原始畫面：`work/desktop-before-{gift,giftDelivery,drawChoose,draw,majority,majorityAnswer,race}.jpg`，幾何與錯誤報告：`work/desktop-before-metrics.json`。畫猜choosing頁可能在截圖前逾時自動選題；選題狀態bug是code審查證據，稍後用新房立即驗證。

## 實作批次一

四款遊戲已加入靜態操作slot，共用foundation與SVG registry已建立，送禮自由panel切換與雙進度、同頻答案局部選取更新已寫入。畫猜／雷霆正在清理原縮字布局並接共用元件。新共用CSS／JS已註冊伺服器靜態資源白名單；隔離QA環境重啟後才會載入新檔案。

送禮／同頻既有針對性測試22項通過；自由切換保留draft的背景檢查已做。全套、整合後版面、焦點及正式站實玩尚未驗收，不能把個別測試當完成。共用房務按鈕將放進右側欄，避免固定浮層遮住輸入欄。

實作後的測試、正式部署、實際遊戲操作與限制會在此追加。本輪尚未宣稱完成，也未建立MR。

## 整合版面檢查

頁首已從105降到56px。第一輪整合畫面也顯示單純放大文字後，右側的玩家、角色選單、訊息與房務工具仍堆得過長。已要求修正為次要名單按需展開、去重回合提示、角色／離房／管理合併工具列，並減少遊戲標頭冗餘間隔。尚未達到720p驗收的項目持續實作，不以字級回退或裁切解決。

## 實作批次二與本機驗收

- Windows完整測試173/173通過（`work/desktop-full-tests.log`）；新增兩項針對畫猜選題分支及pending失敗保草稿的回歸測試。
- root背景Chrome實玩：送禮三人全部選禮／心願，逐一由三位收禮者確認，最後才出現六筆結果；畫猜兩輪作畫、錯答、猜中、揭曉、收藏及換輪完成；同頻三選一、撤回、填空分組／合併／重設／計分通過；雷霆真人移動五步與AI回合通過。報告`work/desktop-local-playtest.json`及`work/desktop-local-draw-playtest.json`。
- 畫猜錯答後立即猜對曾觸發既有700ms限速；測試改成間隔800ms再提交後完成兩輪。這是測試操作間隔修正，遊戲限速未改。
- 最新七種頁面1280×720均scrollHeight720且互動欄可见，header56。gift舞台底692、draw舞台底678、majority揭曉底635、race舞台底594（不同fixture阶段）。`work/desktop-after-metrics.json`。
- 慢請求顯示pending，503失敗保草稿、成功清除；emoji選單開啟／選取／Escape返焦，題庫dialog名称／Escape返焦通過。文字200%改為單欄，640×360等效重排及390×844無橫向溢出。`work/desktop-common-check.json`。640測試是布局重排，不冒稱瀏覽器實際zoom。
- 最後修正管理按鈕受舊bottom/right相對位移、同頻工具列漏套小字、賽車大字implicit column。正式站部署與實玩尚未完成，下面批次再記錄。

## 最終本機整合

七種1280×720頁面（`work/desktop-final-metrics.json`）全部頁面高720、正文與控制無小於14px的可見文字、主要button無高度低於40px或沉出視窗。四款1440×900、390×844與200%文字的12組矩陣無橫向溢出（`work/root-geometry-matrix.json`）。手機與大字允許垂直捲頁。

共用亮／暗tokens正文對比11.206／13.046、muted5.544／9.180，focus及必要icon7.416／9.970；pending圖示改沿用原文字顏色，亮綠底白spinner9.271。這只覆蓋所列配對與本批改動，不代表整站WCAG認證。

同頻新增題目改以瀏覽器實際開「預備題目」dialog、自己出題、填三選一／填空並送出，再走作答與計分，已通過。八人送禮結果8分數卡／56件禮物與同頻8組review的額外顯示fixture也通過（`work/desktop-gift-majority-eight-results-qa.json`）。正式版本與實玩批次待追加。

## 正式部署與背景實玩（完成）

桌機主體版本`7346c0f`已部署到shhuang.cc，後續返焦修正版`49a5dab`為最終正式程式。Windows／Linux完整測試各173/173。切換前SQLite線上備份`shared/backups/pre-draw-guess-20261004T110122Z.sqlite`，備份與切換後均schema v12、完整性ok、7帳號，網站與Tunnel active。封存SHA-256：`F23EB2CB0B6BCAC0083A14B5FB6F136A0F83505B55378449D8328E698E764B06`。14份受影響公開腳本／樣式與版本內容一致，登入200、匿名社交401、robots維持全站禁止抓取。

| 遊戲／範圍 | 正式站實際操作及結果 | 證據 |
| --- | --- | --- |
| 送禮達人 | 三帳號各選兩件禮物與四項心願，三位受禮者逐一確認，全部收完後才顯示六筆結果；送禮到達動畫可見。 | `work/desktop-public-gift-draw-majority-playtest.json`、`desktop-public-gift-delivery-1.jpg`、`desktop-public-gift-result.jpg` |
| 你畫我猜 | 兩帳號完成兩輪：選題、滑鼠作畫、錯答／正答、揭曉、確認收藏成功、換画者、結算。 | 同份實玩報告、`desktop-public-draw-drawing.jpg`、`desktop-public-draw-reveal-1.jpg` |
| 同頻俱樂部 | 開dialog實際出三選一／填空，鍵盤選取、交卷、撤回、重送、三組合併／還原／計分；重播／略過答案焦點成功。最終兩組、分數3/3/0。 | 同份實玩報告、`desktop-public-majority-reveal.jpg`、`desktop-public-majority-blank-result.jpg` |
| 雷霆之路 | 真人與兩支AI車隊實際操作11次移動，點車碰撞與保留結果。紀錄包含碰撞、射擊、受損、淘汰、危險；DOM觀察移動及slam/eliminated/damage/hazard演出。 | `work/desktop-public-race-playtest.json`、`desktop-public-race-event.jpg`、`desktop-public-race-playing.jpg` |

各輪報告pageerrors皆空、測試房最後離席後均消失。雷霆初次自動化點底層格子被車圖攔住，改依現有UI直接點車後成功；沒有修改遊戲玩法或偽造正式事件。射擊出現在實際事件紀錄，但同次動畫優先展示更高優先事件，因此不宣稱本次看到獨立shot演出。

本批完成11理念×5分類55項；手機與200%文字保留垂直捲頁，正常桌機主要操作及互動區維持可見，長列表局部捲動。三階段研究、spec、實作與文件更新均完成。所有瀏覽器測試使用背景headless隔離context，未切換使用者前景；測試帳密保存在忽略Git的本機交接文件。本輪沒有push、MR或PR。

## 額外共用相容性檢查

四款正式實玩已完成後，額外撲克共用UI smoke的文字／emoji及avatar維持正常，但發現從頁首收合題庫選單開dialog，Escape使選單同時關閉，原link已隱藏而無法返焦，焦點落body。已補共用dialog返焦到可見祖先summary入口，保留普通button原返焦；移除重複close listener的覆蓋。此項不改遊戲規則。

## 最終封版

`49a5dab`已部署，正式current=`releases/49a5dab`，Windows／Linux各173/173。切換前備份`shared/backups/pre-draw-guess-20261004T111538Z.sqlite`，備份及正式DB v12／完整性ok／7帳號，網站和Tunnel active。封存SHA-256：`D6BCC047E410F5E066077A5334515794F777CE7A9C3403FA1E3393C14D9E58DC`。14份公开資源再次比對一致。

正式背景撲克相容性smoke通過開局、文字／emoji彈幕、avatar不變，以及頁首題庫dialog的Escape／關閉button回到可見入口；最後真人離房後測試號404。`work/desktop-public-shared-smoke.json`。本機另驗helper有／無、兩種關閉方式共4情況及普通buttontrigger返焦，`work/agent-dialog-focus-check.json`。最終合併證據：`work/desktop-public-final-report.json`。四款主要流程在7346c0f已完成，49a5dab只改共用返焦，其他遊戲程式／樣式一致。

M-GIFT驗收文字對齊使用者指定的逐人確認流程：保留既有演出偏好、由目前受禮者確認推進，完整明細可回看。此批完成後未push或建立MR；測試帳號與後續接手資訊見本機忽略Git的`work/SESSION-HANDOFF-2026-10-04.md`。

## 使用者回報後的資訊可見性與浮層修正（2026-10-04，本機驗證完成）

前一批流程通過不代表所有展開狀態的幾何位置都正確，也不代表收合資訊符合使用者的遊玩需求。本次以 `7346c0f^` 舊版與 `a37bf95` 改版後程式及實際 renderer 比較，先評重要性／頻率／決策需求，再改配置；評分見 [資訊優先級](UI-INFORMATION-PRIORITY.md)。

| 範圍 | 發現與本次處理 | 狀態 |
| --- | --- | --- |
| 雷霆之路 | 車隊／剩車／全員骰子被双層收合；外層浮層又誤以整個操作欄為定位參照。恢復重要資訊常駐，插圖讓位，低頻指令才使用有邊界的浮層。 | 本機通過，四隊完整可見 |
| 你畫我猜 | 桌機玩家名單／分數／畫者狀態初始收合，恢復常駐；完整色盤檢查按鈕錨點及畫面邊界。 | 本機通過，八人完整可見 |
| 送禮達人／同頻俱樂部 | 名單、分配／心願、自己的答案與分數常駐；長 dialog 關閉控制固定於內容頂部。 | 本機通過，八／十二人無裁列 |
| 共用 UI／非遊戲頁 | 題庫導覽、帳號、角色表情、emoji、大廳表情共用按鈕定位及 viewport flip／shift；原生 popover top layer 避免祖先裁切與堆疊遮擋。 | 18頁520次檢查通過 |
| 資訊列字體 | 房號字體、字級／行高與旁邊回合標籤混用；統一系統字體及 lining／tabular 數字、baseline 對齊。撲克牌牌面字體保留。 | 本機通過，基線一致 |
| 連線訊息 | 持續顯示「已連線」沒有操作價值，隱藏健康狀態；斷線及重連失敗提示仍顯示。 | 本機通過 |

本批完整測試179/179、四款多帳號實玩、12組桌機／手機／文字200%重排通過。四隊賽車與八人畫猜1280×720的名單底部分別672／704px，音樂44px入口移進房務工具列。送禮八人正常頁高720；同頻十二人保留必要頁捲，不裁切重要資訊。完整浮層範圍、測試方法及限制見 [展開內容驗收](UI-POPOVER-AUDIT.md)。

截至本機驗證均使用背景 headless Chrome；使用者接著指定一次 Chrome 前景示範，正式更新後依此操作，其餘測試仍在背景。不建立 MR。

### 正式資訊可見性修正版

`1db9e1b` 上線，Windows／Linux179/179、19份公開資源一致、17頁272次展開檢查通過。備份 `shared/backups/pre-draw-guess-20261004T124514Z.sqlite`；DB v12／integrity ok／7帳號，網站及Tunnel active。封存SHA-256 `AF523AAE78113AE2CD935E6BB1723437CDE5AB07E79D0FFF3C1AF29523859A9B`。

四款正式多帳號背景實玩與撲克共用smoke通過，0頁面錯誤、測試房均清理。賽車實際觀察移動與危險／碰撞／淘汰／射擊／受損演出，報告 `work/desktop-public-playtest.json`。前景 Chrome 四隊示範完成整輪並進入第2輪，補抓到地形提示攔住相鄰路格，已修復提示click-through、長文捲動及定位後高度限制，並增加2項回歸；實際覆蓋相鄰格仍可連續移動、覆蓋車仍可選。詳見 [展開內容驗收](UI-POPOVER-AUDIT.md)。

### 浮層補修封版

最終程式 `dcf6ecb` 已部署，Windows／Linux181/181。備份 `shared/backups/pre-draw-guess-20261004T130454Z.sqlite`；DB v12／integrity ok／7帳號、網站及Tunnel active。封存SHA-256 `021E6C0B23D1317EA7CB02692606B7D72BE45DA2B9E1BFD879720A573032FAB5`。19份正式資源與本機一致，檢查改用HTTP讀取，沒有另開瀏覽器。

使用者最新偏好為同一Chrome分頁背景測試、不叫到最上層。依此完成正式修正版的提示覆蓋時連續移動、管理dialog關閉返焦、emoji展開位置／hit test／返焦；證據 `work/chrome-final-qa.json`。Chrome展示房保留，本機3104 QA服務關閉。未push、MR或PR；帳密及房間接手資訊仍只保存在Git忽略的本機交接文件。

### 2026-10-04 雷霆之路行動與地形圖例追加完成

正式最終程式 `cbfd5a9`（前序 `e778bad`／`dd1e453`／`0b42797`）已上線。新增指令不可用時禁用與原因、十種公開地形 hover／focus／點擊說明、車上射擊子彈、油漬／失控滑移旋轉、氮氣尾焰及短動作名稱。圖例保留完整名稱，亮框標記改為28×34px六角SVG；桌機插圖讓出空間給完整圖例與重要車隊資料。

| 驗收 | 正式背景證據 |
| --- | --- |
| 指令 | 教學與正式UI均看到無受損車／無6點時維修 disabled；唯一相符骰與移動骰交換及狀態失效由引擎交叉測試驗證。 |
| 射擊 | 同一Chrome教學實際移動後射擊，DOM取得 `race-vehicle-bullet`、座標136/169→180/169及中途transform；目標受損，射手上方顯示「射擊」。教學共用事件陣列造成漏動畫的問題已補快照與回歸。 |
| 氮氣 | 教學32秒後移動與正式四隊出車均看到尾焰；車庫尚未上路時沒有假定位，上路才開始。正式下一步transform48→92，67秒後仍保原動畫時間並扣點。 |
| 打滑／維修 | SVG節點與計時測試確認油漬、射擊推動的對手skid旋轉實際車身、修理名稱出現在受修車；沒有把這些單元場景冒稱本批Chrome實玩觸發。 |
| 1280×720四隊 | 最終頁高720px、車隊底687px，4隊每隊3車／4骰完整可見；完整地形名稱兩列108px，亮框圖示實際28×34px。 |
| 地形提示 | Chrome實際focus／點擊毒液及玻璃，玻璃字卡範圍489/382～809/484.8，`pointer-events:none`，Escape關閉。focus自動捲動會重新定位；滑鼠延遲與移入字卡以專用事件測試驗證。 |
| 回歸與資源 | Windows核心206/206，後續圖例／CSS補修相關16/16；正式Linux206/206。22份正式資源與本機一致。 |

備份 `shared/backups/pre-draw-guess-20261004T140150Z.sqlite`，DB v12／integrity ok／7帳號、服務與Tunnel active。封存SHA-256 `222840452B43DF976B9F61F5736679F9FF2A4BB770C295AC349E09670DD63BDC`。證據 `work/chrome-race-action-qa.json`、`race-release-assets.json`、`chrome-race-full-legend-1280.jpg`、`chrome-race-live-nitro-1280.jpg`、`chrome-race-shot-action.jpg`、`chrome-race-final-animation.jpg`。

Chrome仍為原分頁2019458507，背景DOM操作，沒有提高視窗。測試房最後離房清理；臨時1280×720 viewport已恢復1767×1196，保留 `/race?learn=1` 氮氣教學示範，可繼續點亮框。未push、MR或PR。

## 2026-10-04 全員擲骰dialog與一秒動畫

雷霆之路新增全員同步檢定：條件預告、由指定玩家按擲骰、一秒動畫、結果確認；碰撞保留特殊骰及大車一次重擲。每輪四骰／公路骰以同一dialog動畫揭曉，結果確認前不從常駐名單或選骰控制提前顯示。桌機四隊17骰完整可見，手機內捲並保留44px確認。完整規格、機制與定位驗收見 [擲骰流程](RACE-DICE-INTERACTION.md)。

來源70ec687已更新shhuang.cc，Windows與Linux均225/225，23份公開資源一致。原Chrome背景操作通過四隊結果、射擊條件／動畫／傷害及碰撞特殊骰，三個登入座位結果相同。暫時viewport已reset，Chrome留在可重擲的碰撞教學。部署前SQLite備份pre-draw-guess-20261004T144649Z.sqlite；服務active、v12 integrity ok、7人。兩個臨時房間已到期刪除。本批沒有MR或push。

## 2026-10-05 骰子辨識、角色尺寸與亮框圖例

| 設計要點 | 遊戲 | 修改 | 進度 |
| --- | --- | --- | --- |
| 圖示辨識、留白 | 雷霆之路 | 擲骰視窗與移動骰共用固定幾何 SVG，白色骰面、深色點數；骰面與外層卡片分離，保留點數輔助名稱及一秒動畫。 | 本機完成，四隊17骰的圖案點數與公開結果一致，1280×720視窗無內捲。 |
| 重要資訊常駐、角色表情 | 雷霆之路 | 車隊角色32×40改64×80；寬螢幕72×90。角色跨兩列，姓名、剩車、三車狀態、四骰維持直接顯示。 | 本機Chrome四隊12車16骰完整；1280×720頁高720、車隊底685px。 |
| 圖例風格一致 | 雷霆之路 | 「亮框可前往」使用與地形圖例相同的外框、圓角、底色及44px高度；保留28×34六角圖案與完整名稱。 | 本機完成，正式部署與背景驗收待完成。 |

上述三項均已完成正式驗收，來源66b2091已部署shhuang.cc。Windows／Linux完整226/226，23份公開資源一致。原Chrome背景四隊實際開始後17骰的SVG點數與公開輔助名稱全部一致；確認後12車16骰及三個實際角色圖片完整顯示。正式1280×720頁高720、名單底685px，角色64×80，移動骰48px按鈕內保留32px骰面及間隔。圖例外框均1px #677259、底色#253022、高44px。手機390×844車隊卡片不橫溢，碰撞dialog358×571、確認166×44可見。

證據：work/chrome-dice-artwork-prod.jpg、work/chrome-race-portrait-prod-1280.jpg及race-release-assets.json。備份pre-draw-guess-20261004T160337Z.sqlite，DB v12 integrity ok、7人，服務及tunnel active。封装SHA256 FABED6EF3F0DE32E8E4669148DF5B745230FE469E10C051D31E77D4664336489。臨時正式房5107E7清理後404，本機3104服務停止；Chrome尺寸已reset且保留第6章骰子教學，未置前。沒有push或MR。
