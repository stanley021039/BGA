# 媒體圖示與視窗 UI 進度

日期：2026-10-07。六項source已完成並凍結，候選patchv1.8.2發行前；Windows完整1095／1095、37920.2003ms，reviewer八檔focused116／116、2361.1404ms，各fail/cancel/skip/todo0。Linux／受測commit-tag／正式部署待root，正式仍v1.8.1；不沿用舊1076當新结果。 六項與永久設計準則見 [spec](specs/MEDIA-ICON-WINDOW-UI.md)。本輪僅媒體／必要共享元件，沒有將全站操作button全搬完，未引用本機偏好。

## 六項需求對照

| 項目 | 實作與已驗界線 | 狀態 |
| --- | --- | --- |
| M1 icon-only／說明 | 共用registry、中文aria／title、本站custom controls圖示化；label／重要內容可見，rootfont200%按鈕88×88／icon48×48在內。 | source完成／發行前；實體touch說明與讀屏未真驗 |
| M2 本站播放器圖示 | 本站共享／個人控制icon-only；原生Audio／YouTube controls與consent／恢復出口保留。 | source完成；本輪YT真正playing未驗，幾何／縮圖不能替代 |
| M3 移除影片名稱 | 無mediaVideoName input，URL點播不送可編輯title；既有metadata／fallback名稱保留。 | DOM／payload回歸與Chrome無input已驗 |
| M4 8方向resize | 四邊四角hit areas與cursor、pointer capture、Tab／Arrow／Shift／Home，210pxplayer／clamp沿用。 | Chrome八方向mouse對邊固定、最小iframe及local-only已驗；keyboard／cancel回歸已驗 |
| M5 左handle右remove | row不draggable／無上下button，handle-only mouse／touch與Arrow復焦，完整revision意圖及降權取消。 | mouse／Arrow／emulatedTouch實際ACK確認，stale／cancel／lost／close回歸已驗 |
| M6 單行ellipsis／hover跑馬 | GameUI.overflowText(text,{hoverOnly:true})與escaped fallback；只有overflow:hover跑馬，reduce／hidden不動。 | Chrome transform -237.878px／row69.5px不變／離開靜止，motion回歸已驗 |

永久準則來自本輪直接使用者指令：操作盡量icon-only＋hover說明，也要可讀名稱及keyboard／touch理解，不能仅title。正文／label／結果及重要玩家資訊不隱藏；AGENTS／MEMORY／DESIGNER／README已保存。

## 實作攻防與可靠性

frontend做TableMedia／測試，root做共享GameUI registry／overflowText、整合與驗收，文件owner只六docs。排序handle凍結generation／instance／session／revision／完整IDs，queue／權限／close更新取消舊intent；row文字選取／remove不啟動drag。8個resize edges8px／corners20px透明hot area不覆播放器內區，沒有可見footer resize按鈕，keyboard替代保留。

實際回歸曾重現並修header多指／已有drag重入、close不release與同步lostcapture重入；cancel／lost回原位置不persist，正常release只save一次。再修背景dialog新開首rAF延後导致越viewport：render後同步layout一次。resize／queue非primary pointer不可開始。這些修正各有fail-before／pass-after的focused回歸；owner最後51項為其source scope，最終reviewer／完整數字另列，不沿用前期46／49／50冒充最終。

## 背景Chrome證據與限制

背景Chrome已驗八向mouse resize對邊固定、mouse／Arrow及emulatedTouch handle排序均實際ACK、一般member點播而無全桌／remove權。本站custom controls均icon-only及中文aria，影片名稱input已移除；原生Audio／YouTube controls保留，本輪沒有真YouTube playing證據（只幾何／縮圖）。實際長名hover transform -237.878px、row69.5px不變，離開靜止；390×844 raw CDP dialog374×620、bounds8..382、iframe337×220.2，最小縮放iframe235×210且same iframe、room-media POST4→4；root font200%樣本button88×88／icon48×48在內。這是模擬touch／viewport与文字放大，非實體手機／真人assistive technology或全站全UI驗收；fixture建5rooms不等5頁native遍測。

新開即layout、多指／取消／lostcapture由自動回歸確認；不能把emulatedTouch當實體手機。原生Audio／YT controls維持，本輪沒有真正YouTube playing觀測，不寫播放驗收完成。fixture包含5rooms，但沒有五頁UI逐頁native驗收；沒有全站button搬完。hover aria属性／模擬touch操作不等真人讀屏或完整touch說明驗收。

自己的host與guest兩tab已關、rootfont200%還原、raw viewport clear，tty隔離fixture收到stop正常退出；最後去敏截圖為ignored work/media-icon-window-final.png。沒有改使用者前景，不提交帳密／cookie／環境／原HAR或.local偏好。

200%文字最後補驗：舊queue首欄44px與88px把手重疊34px；已改共用控制尺寸token，新增CSS契約回歸。Chrome修後三列均為88px／155.188px／88px，把手與標題間距10px。這筆CSS後完整Windows為1095；reviewer116是CSS前結果，frontend最後focused52/52。第二個隔離fixture也正常stop，自己的補驗tab關閉、文字大小还原。

## 驗收記錄

| 驗收 | 結果／scope |
| --- | --- |
| source／focused | source frozen；reviewer八檔116／116、2361.1404ms，各fail/cancel/skip/todo0；具體gesture/layout/motion/ACL回歸如上。 |
| Windows／Linux | Windows最終1095／1095、37920.2003ms，各fail/cancel/skip/todo0；Linux待root，不由Windows推論通過。 |
| Chrome icon／name／queue | 本站controls icon-only／中文aria、hover跑馬／等高／離開靜止、mouse／Arrow／emulatedTouch handle均實際ACK。 |
| Chrome resize／viewport | 八向mouse對邊固定；390 rawCDP374×620界8..382、iframe337×220.2；min235×210 sameiframe／POST4→4，rootfont200%88pxbutton／48pxicon。 |
| 播放／ACL | 一般member可點播、無全桌／remove；Audio／YT native控件保留。YTplaying／真oEmbed／實體手機／讀屏未提供本批真驗證據。 |
| source／tag／正式／資料 | 發行前：正式仍v1.8.1，候選1.8.2；commit／tag／Linux／部署／備份資料待root後續證據，不預填。 |
| own清理 | 自己兩tabclose、rootfont／raw viewport還原、隔離fixture正常stop；最後截圖scope如上。 |

官方查核仍適用：title的keyboard／touch限制見 [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/title)；tooltip hover／focus／Escape設計參考見 [W3C APG（pattern仍work in progress）](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)。YouTube controls參數見 [官方文件](https://developers.google.com/youtube/player_parameters#controls)，本輪維持原生controls，不能把本站圖示化推論為YouTube播放成功。
