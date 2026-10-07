# 媒體圖示、視窗與待播清單 UI 規格

日期：2026-10-07。八項需求已於正式v1.8.2發布，受測來源／tag49d0702；雙平台1101/1101與資料保存等證據見 [進度](../MEDIA-ICON-WINDOW-UI-PROGRESS.md)。後續播放辨識、同列控制及表情修正為獨立v1.8.3候選，不改v1.8.2 tag。

## 永久設計準則

依本輪使用者直接指令，專案操作按鈕盡量icon-only，hover提供功能說明；同時有可讀中文名稱、keyboard focus及touch可理解的說明，不能只有hover。正文、欄位label、結果及重要玩家／遊戲狀態不得隱藏。準則寫入AGENTS／角色記憶，不讀取或轉貼`.local`偏好。

同功能同圖示、同說明，重用GameUI registry／decorateButton／共享提示及中性幾何槽；保留disabled／pending／hidden、事件及控制token尺寸。桌機優先，手機與放大文字仍能使用。本站播放器自製控制列icon化；原生Audio／YouTube controls與consent／恢復出口保留，本站自製操作列圖示化的scope依實際source及驗收記錄，不能宣稱重畫所有YouTube原生UI。

## 八項規格

| 項目 | 原狀／調整 | 實作界線與驗收 | 狀態 |
| --- | --- | --- | --- |
| M1 操作圖示／說明 | 多項媒體操作仍可見文字；本站共享及個人操作、加入／更新／移除與視窗工具用共享registry icon-only。 | hover說明與`aria-label`同中文語意，focus／touch有可取得名稱與提示。全桌與個人操作不能混淆；保留submit／listener、44px控制token、disabled／pending及可見label／內容。 | 完成；最新完整回歸通過，native scope見進度 |
| M2 本站播放器控制 | 共享播放／暫停／下一筆／停止與個人播放／對齊／聲音／退出採自製icon控制；不能另留第二套本站文字操作列。 | 保留host／manager ACL、一般席點播與個人音量／退出。YouTube native／fallback、consent及autoplay恢復策略保持；本站控制圖示完成与真播放證據分列，本輪真YTplaying未驗。 | 完成；最新完整回歸通過，native scope見進度 |
| M3 移除影片名稱input | 刪`mediaVideoName`及前端title讀值／清空流程，只填YouTube網址，沿用metadata／固定fallback名稱。 | URL label與錯誤提示保留；current／queue仍顯示名稱。server optional title相容處理不必因UI移除改wire／DB。 | 完成；最新完整回歸通過，native scope見進度 |
| M4 四邊四角resize | 原右下按鈕改8個edge／corner hit area，hover方向cursor、Pointer capture拖拉；不做8個常駐文字按鈕。 | N/S ns-resize、E/W ew-resize、NE/SW nesw-resize、NW/SE nwse-resize。N/W改top／left並保留對側，viewport clamp與210px播放器空間沿用。separators可Tab／Arrow／Home、名稱與尺寸可讀，不覆播放器內區／工具。 | 完成；最新完整回歸通過，native scope見進度 |
| M5 queue左handle／右remove | 最左drag handle、最右remove icon，取消上移／下移button。只有handle Pointer capture／touch能排序，row不draggable，文字選取／remove不誤觸drag。 | Arrow keyboard reorder與復焦原handle保留。意圖凍結generation／instance／session／revision／完整IDs；更新／降權／close取消或要求重拖，零舊排序POST。一般席不能排序／移除；名稱／點播人可見。 | 完成；最新完整回歸通過，native scope見進度 |
| M6 單行名稱／hover跑馬 | current／queue名稱及點播人單行ellipsis；只有overflow且hover才跑馬，短名靜止。用`GameUI.overflowText(text,{hoverOnly:true})`，缺helper時escaped單行fallback。 | DOM／可讀名稱保留全文，focus／touch可取得完整內容，hover結束靜態ellipsis。MotionPolicy／OS reduce／document.hidden禁止跑馬；重用量測／清理、不加每frame輪詢，不修改全站重要玩家資訊可見性。 | 完成；最新完整回歸通過，native scope見進度 |
| M7 獨立較寬點播／清單窗 | 清單、音樂與影片點播欄位移至獨立較寬的非modal dialog；entry單行、gap較小。播放器下方只留一個icon按鈕開啟點播／清單窗，影片占完整主區，移除360px高度cap。 | player四邊四角resize保留；移動／縮放／有足夠空間時開關清單不重mount播放器，不更改全桌或清空表單；清單遮住影片時只退出本機觀看，關清單不自動重載。較寬清單窗仍clamp viewport、保留label／keyboard／關閉復焦；queue權限及凍結意圖不變。 | 完成；新雙窗／fullwidth-height／sameiframe與零幾何POST已驗 |
| M8 下拉第一項上傳歌曲 | 移除獨立上傳icon／link，音樂下拉第一個文字option為「上傳歌曲」；選取時導航既有共用音樂上傳頁。 | option是導航sentinel，不是曲目：不得enqueue、不得送空／假trackId；真曲目選取與加入保持。文字option例外保留清楚用途，返回／重新開窗與reset selection待驗。 | 完成；首option、安全導航／reset、submit guard與refresh回歸通過 |

## 共用元件與補驗

`ui-components.js`承擔registry、decorateButton及共用overflow文字／說明；`ui-primitives.css`承擔槽、icon-only大小及中性margin／padding。caller只指定圖意與中文字義，不各自造SVG／tooltip。未知registry key不能靜默保留原文字卻宣稱icon完成；非互動符號、玩家表情與文字槽不當按鈕放大。

`title`對keyboard／touch可用性不足，不能單獨承擔可達說明或替代表單label。[MDN title](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/title)。自製tooltip參考hover／focus、Escape、不搶焦點與`aria-describedby`；W3C APG該pattern仍標work in progress，作設計參考而非單一合規證據。[W3C APG Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)。YouTube `controls=0`可隱藏原生控制列，本輪維持原生controls，不能把本站icon列完成推論為播放／autoplay／ACL全部成功。[官方參數](https://developers.google.com/youtube/player_parameters#controls)。

背景Chrome已驗八向mouse resize對邊固定、mouse／Arrow及emulatedTouch handle排序均實際ACK、一般member點播而無全桌／remove權。本站custom controls均icon-only及中文aria，影片名稱input已移除；原生Audio／YouTube controls保留，本輪沒有真YouTube playing證據（只幾何／縮圖）。實際長名hover transform -237.878px、row69.5px不變，離開靜止；390×844 raw CDP dialog374×620、bounds8..382、iframe337×220.2，最小縮放iframe235×210且same iframe、room-media POST4→4；root font200%樣本button88×88／icon48×48在內。這是模擬touch／viewport与文字放大，非實體手機／真人assistive technology或全站全UI驗收；fixture建5rooms不等5頁native遍測。

新開dialog render後同步layout一次，避免背景首rAF未執行時落到body底；多指primary guard、取消／lostcapture回起點不persist、close清capture與release同步lost的重入防護已回歸。

## 必保契約

| 契約 | 本輪界線 |
| --- | --- |
| 媒體／角色 | 一房一current／混合queue／anchor；有效席點播，host／manager控全桌／排序／移除。不改siteadmin或放寬server ACL。 |
| 個人幾何／播放 | consent、個人聲音／音量／退出及窗位置／大小只本機；move／resize不POST media、不重mount播放器或替別人seek。 |
| 舊資料／取消 | 保留GET有限重試與generation／instance／session／revision、late callback／ended guard、完整集合排序。close／換room／降權／pagehide取消意圖與capture。 |
| 重要內容 | URL／音量／曲庫label、目前媒體與點播人、權限／錯誤及玩家／遊戲資訊可見；icon偏好不作隱藏重要資料的理由。 |
| 發行 | 預計patch1.8.2是既有操作排版修正，無新DB／wire／玩法；scope擴大按最高影響重評。純文件不打tag，不把候選當正式。 |

## 驗收矩陣

| 類別 | 具體方法／必要證據 | 狀態 |
| --- | --- | --- |
| icon／提示 | 逐本站button hover／Tab／Enter或Space／touch、disabled／pending／hidden，可讀名稱、說明及提示位置不遮UI。 | icon-only/中文aria／focused及Chrome尺寸樣本已驗；physical touch説明/讀屏未真驗 |
| URL／metadata | 無影片名稱input，好／壞URL payload、metadata／fallback、可見名稱／錯誤／focus及XSS防護。 | no input／URL body回歸已驗；metadata或YouTube真播放不因此推定成功 |
| 真播放／ACL | Audio／YouTube、host／manager／member、consent／退出／被拒播恢復；native保留scope明列。 | 一般member ACL已驗／native控件保留；本輪YTplaying未驗，縮圖與幾何不是播放證據 |
| resize | 8方向逐拖、N/W與四角對側anchoring、Tab／Arrow／Shift／Home、取消／clamp／210px／local-only流量／iframe身份。 | 八方向mouse／对邊固定、390與sameiframe210floor、mediaPOST不增已驗；keyboard／cancel回歸已驗 |
| queue | handle pointer／touch／Arrow、文本選取／remove、升降權限、他席改queue與close；復焦及零舊intent POST。 | mouse／Arrow／emulatedTouch實際ACK及競態/取消回歸已驗；非實體手機 |
| 長名／motion | 短／長／惡意字串、hover前後、focus／touch、reduce／hidden／close；一行ellipsis、全文可達且不反覆量測。 | hover transform-237.878／row69.5不变／離開靜止已驗；reduce／hidden回歸已驗 |
| viewport／共用邊界 | 1280×720、390px、200%文字與五款共用入口；不重疊／水平溢出／遮住控制，不宣稱全站按鈕已改完。 | 390rawCDP与rootfont200%樣本已驗；fixture5rooms不等5頁native，全站buttons未全搬 |

本批source、Windows與Chrome已按下列scope完成，Linux／tag／正式仍待；source／focused／雙平台、原生／合成Chrome、正式與清理證據只按實際結果更新 [進度](../MEDIA-ICON-WINDOW-UI-PROGRESS.md)；未觀察仍未驗，不copy本機偏好、帳密或原HAR。

## 追加布局驗收（待驗）

M7須驗獨立較寬非modal dialog、单行entry／較小gap、player唯一清單icon、影片完整主區与去360px cap、8向resize／sameiframe／無新增mediaPOST、兩窗關閉／復焦／390與200%文字。M8須驗無獨立上傳icon/link、首個文字option精確「上傳歌曲」、導航既有上傳頁、sentinel零enqueue與真曲目仍正常。前述M1–M6在新布局重驗；中間Chrome幾何／hover與Windows1095不是最新source通過。
