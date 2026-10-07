# 媒體圖示與視窗 UI 進度

日期：2026-10-07。正式v1.8.2已完成：受測來源與不可覆寫本地tag為49d0702fbaf0a8d2aefb18ea98c9237f1c6baa7b；Windows／Linux各1101/1101（37693.3375ms／189712.940156ms），零fail/cancel/skip/todo。2026-10-07T04:50:10Z零房間切換，PID110715→116191，current releases/49d0702，service／tunnel active。發布包SHA-256 340360940a95ac856771e26941d6bb4cc1339bb8429765d31a20b3791a15eb5b。備份與副本預演保留schema15與21表；8帳戶全欄位、20非session表既有rows/BLOB一致，integrity ok／FK0。公開版號、5份HTML與4份shared資源精確內容、MIME、no-store及三個自有member的room ACL通過，自己的驗收房刪除、session登出，session165→169。備份 pre-media-icon-window-fixes-49d0702-20261007T044854Z-2c42ba3d-b0fd-4521-b270-1f7ea050e8fd 是online SQLite備份＋分開檔案封存，非原子冷備份。最新追加修正候選v1.8.3另見 [控制與表情進度](MEDIA-EMOJI-POLISH-PROGRESS.md)。

## 八項需求對照

| 項目 | 實作與已驗界線 | 狀態 |
| --- | --- | --- |
| M1 icon-only／說明 | 共用registry、中文aria／title、本站custom controls圖示化；label／重要內容可見，rootfont200%按鈕88×88／icon48×48在內。 | 完成；最新完整回歸通過，native scope見進度 |
| M2 本站播放器圖示 | 本站共享／個人控制icon-only；原生Audio／YouTube controls與consent／恢復出口保留。 | 完成；最新完整回歸通過，native scope見進度 |
| M3 移除影片名稱 | 無mediaVideoName input，URL點播不送可編輯title；既有metadata／fallback名稱保留。 | 完成；最新完整回歸通過，native scope見進度 |
| M4 8方向resize | 四邊四角hit areas與cursor、pointer capture、Tab／Arrow／Shift／Home，210pxplayer／clamp沿用。 | 完成；最新完整回歸通過，native scope見進度 |
| M5 左handle右remove | row不draggable／無上下button，handle-only mouse／touch與Arrow復焦，完整revision意圖及降權取消。 | 完成；最新完整回歸通過，native scope見進度 |
| M6 單行ellipsis／hover跑馬 | GameUI.overflowText(text,{hoverOnly:true})與escaped fallback；只有overflow:hover跑馬，reduce／hidden不動。 | 完成；最新完整回歸通過，native scope見進度 |
| M7 寬點播／清單dialog | 音樂／影片entry与queue移至獨立較寬非modal窗，entry單行小gap；player下方唯一icon開清單，影片占主區、去360px高度cap、8向resize維持。 | 完成；非modal／mouse與Arrow／close復焦、row54px與gap4px／影片1377×575已驗 |
| M8 上傳作首個option | 音樂下拉第一項文字「上傳歌曲」，導航既有共用上傳頁，不留獨立上傳icon/link，不enqueue sentinel。 | 完成；首文字option／安全導航參數／reset，POST1→1；沒有實際上傳檔案 |

永久準則來自本輪直接使用者指令：操作盡量icon-only＋hover說明，也要可讀名稱及keyboard／touch理解，不能仅title。正文／label／結果及重要玩家資訊不隱藏；AGENTS／MEMORY／DESIGNER／README已保存。

## 中間實作攻防與可靠性

frontend做TableMedia／測試，root做共享GameUI registry／overflowText、整合與驗收，文件owner只六docs。排序handle凍結generation／instance／session／revision／完整IDs，queue／權限／close更新取消舊intent；row文字選取／remove不啟動drag。8個resize edges8px／corners20px透明hot area不覆播放器內區，沒有可見footer resize按鈕，keyboard替代保留。

實際回歸曾重現並修header多指／已有drag重入、close不release與同步lostcapture重入；cancel／lost回原位置不persist，正常release只save一次。再修背景dialog新開首rAF延後导致越viewport：render後同步layout一次。resize／queue非primary pointer不可開始。這些修正各有fail-before／pass-after的focused回歸；中間owner最後52項（含控制token取代固定44px回歸）為其source scope，最終reviewer／完整數字另列，不沿用前期46／49／50冒充最終。

## 中間b420134 Chrome證據與限制（不代表最新布局）

背景Chrome已驗八向mouse resize對邊固定、mouse／Arrow及emulatedTouch handle排序均實際ACK、一般member點播而無全桌／remove權。本站custom controls均icon-only及中文aria，影片名稱input已移除；原生Audio／YouTube controls保留，本輪沒有真YouTube playing證據（只幾何／縮圖）。實際長名hover transform -237.878px、row69.5px不變，離開靜止；390×844 raw CDP dialog374×620、bounds8..382、iframe337×220.2，最小縮放iframe235×210且same iframe、room-media POST4→4；root font200%樣本button88×88／icon48×48在內。這是模擬touch／viewport与文字放大，非實體手機／真人assistive technology或全站全UI驗收；fixture建5rooms不等5頁native遍測。

新開即layout、多指／取消／lostcapture由自動回歸確認；不能把emulatedTouch當實體手機。原生Audio／YT controls維持，本輪沒有真正YouTube playing觀測，不寫播放驗收完成。fixture包含5rooms，但沒有五頁UI逐頁native驗收；沒有全站button搬完。hover aria属性／模擬touch操作不等真人讀屏或完整touch說明驗收。

自己的host與guest兩tab已關、rootfont200%還原、raw viewport clear，tty隔離fixture收到stop正常退出；最後去敏截圖為ignored work/media-icon-window-final.png。沒有改使用者前景，不提交帳密／cookie／環境／原HAR或.local偏好。

200%文字最後補驗：舊queue首欄44px與88px把手重疊34px；已改共用控制尺寸token，新增CSS契約回歸。Chrome修後三列均為88px／155.188px／88px，把手與標題間距10px。這筆CSS後完整Windows為1095；reviewer116是CSS前結果，frontend最後focused52/52。第二個隔離fixture也正常stop，自己的補驗tab關閉、文字大小还原。

## 最新追加與驗收記錄

| 驗收 | 結果／scope |
| --- | --- |
| source／focused | b420134為已commit的中間候選，未tag；最新M7/M8 source／focused待freeze與重驗，不沿用舊116或52。 |
| Windows／Linux | 中間b420134 Windows1095／1095、37920.2003ms、全部0；中間同份Linux1095／1095、189665.89494ms亦過，均不替代最新source測試。最新完整數字待root。 |
| Chrome icon／name／queue | 本站controls icon-only／中文aria、hover跑馬／等高／離開靜止、mouse／Arrow／emulatedTouch handle均實際ACK。 |
| Chrome resize／viewport | 八向mouse對邊固定；390 rawCDP374×620界8..382、iframe337×220.2；min235×210 sameiframe／POST4→4，rootfont200%88pxbutton／48pxicon。 |
| 播放／ACL | 一般member可點播、無全桌／remove；Audio／YT native控件保留。YTplaying／真oEmbed／實體手機／讀屏未提供本批真驗證據。 |
| source／tag／正式／資料 | 最新M7/M8候選仍實作中；b420134只是中間commit，未tag／部署，正式仍v1.8.1。最新Linux／tag／正式證據待root。 |
| own清理 | 自己兩tabclose、rootfont／raw viewport還原、隔離fixture正常stop；最後截圖scope如上。 |

官方查核仍適用：title的keyboard／touch限制見 [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/title)；tooltip hover／focus／Escape設計參考見 [W3C APG（pattern仍work in progress）](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)。YouTube controls參數見 [官方文件](https://developers.google.com/youtube/player_parameters#controls)，本輪維持原生controls，不能把本站圖示化推論為YouTube播放成功。

M7/M8最新source、完整Windows／Linux與native驗收待root提供。這次只更新spec／進度兩文件，角色記憶及AGENTS保持前輪版本，待最終交付再對齊；不把中間commit／已通過的舊Linux當新版完成。

## 最新雙視窗驗收

- 獨立非modal清單最大寬840px、內容自然高度，兩筆時840×327；歌曲row54px、文字22.5px單行、margin0，row gap4px。已清除舊dialog li的12px上下margin，避免實際gap變28px。兩點播form在清單內，桌機並排；player只有一個圖示清單入口。
- 新清單mouse拖C到首筆及ArrowDown回第二筆，等待HTTP ACK後順序與焦點確認；member可加入音樂/影片、把手disabled、remove不存在，看到同一清單。reviewer另外重現capture後close／demotion／stale再late up，全為capture=false與POST0。
- 真實silent MP3 Audio readyState4、paused=false，開關清單同一audio且time29.77→49.32秒，focus回清單入口。本機測試聲音已還原；此實播發生於新DOM實作中，其後只補rowmargin／autoheight及回歸。
- 上傳首option文字與sentinel確認；用短暫window.open recorder選取後記到 /collection?section=music、_blank、noopener，選项reset為空，media POST1→1。Recorder已還原；本批沒有實際上傳歌曲或開外部上傳tab。
- 最新native NW擴窗至1407×1021.8、iframe1377×575；SE調整後iframe1317×525，同一iframe且media POST5→5。開清單放影片下方，仍同一iframe；影片縮圖已載入，但本批不宣稱YouTube SDK ready／影片正在播放。
- 200%文字：row98px、控制88px、title仍22.5px單行，左右各6px gap；390×844重排後player374×828 at8,8，playlist374×301 at8,535，iframe352×360.2、documentWidth375無水平溢出。背景resize經rAF重排後才記bounds，不把第一瞬間舊定位當通過。字體与raw viewport皆已還原。
- 最新Windows1101/1101与reviewer123/123結果在本段頂部；Linux/正式資料另待發布證據。截圖與去敏證據在ignored work，不提交原cookie／HAR。
