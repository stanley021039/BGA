# Freehand UI 進度

2026-10-08（Asia/Taipei），正式已發布 **v1.14.2／8ae5c4f9bd2a9cf62156bb3b80eb49c5a473a4b9**。tag固定受測程式；基線v1.14.0／b4ebb15。v1.14.1固定tag為歷史未部署候選，下方中間待驗／失敗記錄保留，最新結果集中在末段。沒有新PR、push或合併。

root背景Chrome實際讀Streamline Freehand family／Duotone Free，頁明列1000、24px／CCBY4；看Awwwards Gionatan Nese '26與作者真網站（白底、中央散列小作品卡、兩側題字／大量留白）。作者例僅借圖文對比，不採大留白／無限滚动／作品資產進多人操作界面。Pinterest web403，Chrome可讀搜尋則依實際後續記錄，不混同web工具或agent觀察。

asset owner components_design從官方repo固定52d750c9ce051e51cb181b7a78932120c48541d0取11件duotone SVG，原封bytes／SHA／24viewBox與無scripts／外部resource已查。root在freeze後改色並保originalSHA／modifiedSHA與修改說明。其他研究與跨角色取捨見 [spec](specs/FREEHAND-UI.md)、[資產評估](research/FREEHAND-UI-ASSETS-ASSESSMENT.md)、[視覺參考](research/FREEHAND-UI-VISUAL-REFERENCES.md)。

待補：固定source、回歸測試、desktop/390／controls／popovers／重要遊戲資訊原生確認、正式部署與資料保留／清理。測試帳密、cookies和私人偏好不進此文件。

## 候選實測（發布仍待驗）

Windows Node24.14.0，最終程式npm test：1415/1415、38125.6623ms，fail/cancel/skip/todo各0；先前改鉛筆圖案前37743.9415ms的同數suite是歷史，不重複總計。release:check從v1.14.0按patch通過，syntax／git diff --check通過；focused10為局部，不加到full總數。原始來源11件SVG／modified SHA與無active/remote content，以及12白名單SVG的MIME／CSP／精確bytes／非法路徑404與credits登入保護有真HTTP測試。

root背景Chrome：1280×900三欄、1024×768兩欄、390×844單欄；六張圖全部載入，72px、正文16px，390 client/body寬375無橫向溢出。create/join52px、refresh/settings/emote44px，390設定層320×665、x8/y129/bottom794、炭墨rgb41,54,47對紙白rgb255,253,247，creditlink44px；account menu與credits頁可讀／設定版號1.14.1。真reduced media時hovertransition0s。

四款三席等待房1280×900與390×844均載入32px badge／24px SVG、無橫向溢出，玩家／車隊文字仍可見；1280三個player卡及race四slot（3車隊＋等待slot）保留，gift/majority/draw/race roster底部分別883/737/505/680，沒有重新隱藏重要內容。gift起初locator被影片詢問modal擋住，是未完成樣本，dismiss後再驗；非UI遮蓋bug。work/freehand-room-native.json與freehand-room-mobile-native.json、四款截圖為私有證據。此scope為waiting／標題插圖，不宣稱全玩法或重新驗完整畫布流程。

初次畫猜卡選取經DOM snapshot顯示aria-pressed與建立你畫我猜按鈕一致；最後一筆剛click即讀的早期樣本仍thunder，未把它當完成，正式驗收會再等可見狀態確認。鉛筆比三圓color-palette更容易辨認，最終已改home/draw badge為edit-pencil。截圖work/freehand-home-cards.png、freehand-mobile-settings.png；圖片不等使用者滿意、真200%／讀屏／FPS結論。研究／preview own tabs已關閉、device/media overrides清除、isolated app/proxies停止。

## 跨平台封存修正

v1.14.1／482a1df的Linux完整1415項中1414通過、1失敗（212017.197949ms）：edit-pencil实际4443bytes，manifest4437；不是可忽略的UI樣本。root核原工作檔與Git blob均4437／SHA一致，但Windows core.autocrlf影響git archive匯出為CRLF（多6行尾bytes）。該tag保留未部署，Linux失敗不記pass。

最終候選1.14.2加.gitattributes限制兩個curated SVG目錄text eol=lf，發布封存另以core.autocrlf=false生成canonical archive；來源與原始SHA保持。真controlled checkout-index在core.autocrlf=true／core.eol=crlf下匯出12SVG，與原工作bytes完全相同、LF-only；不是整份Windows fresh clone驗收。Windows Node24.14.0最終npm test 1415/1415、38102.9192ms、fail/cancel/skip/todo各0。Linux最終source待重驗，不能沿用1.14.1的失敗suite。

## 最終發布／驗收（取代上方候選狀態）

| scope | 最終證據／實際限制 |
| --- | --- |
| 固定source | 8ae5c4f9bd2a9cf62156bb3b80eb49c5a473a4b9／v1.14.2；archive SHA256 c55a725ab4a43b16a392c0cced6e8f44300453b968df9ade20db624cd61b7e19。SVG由.gitattributes＋canonical export保持LF，實際Linux edit-pencil4437bytes／SHA aa547368bb73a3e410386c060a232fd4b6adc8dff2d91518189bde7703664dc8與manifest一致。 |
| 最終完整兩平台 | Windows Node24.14.0 **1415/1415／38102.9192ms**；Linux Node22.22.1同immutable source **1415/1415／212279.585135ms**，各fail/cancel/skip/todo0。私有logs freehand-final-windows-full.log、freehand-final-linux-run.log。前次suite／focused不重複計總數。 |
| 來源與取捨 | 本地11官方Freehand SVG＋1原創禮盒，炭墨／暖赭改色與原始SHA分開；SVG aggregate80574bytes、CSS12403bytes為未壓縮檔案數字，不是gzip或性能優勢。homepage用5官方＋1原創圖示，四room標題marker同系統；小操作registry不變。 |
| 原生scope | 上方1280／1024／390，44px／52px操作、settings／account配色、credits與reduced、四種三席waiting roster／32badge／24art是真隔離server證據。正式native另驗home1280，六圖loaded／72px、三欄／無橫溢；真點draw卡後DOM選中draw／建立你畫我猜一致。早期click立即取樣未用為pass。 |
| 公開HTTP | 正式22份HTML／CSS／JS／SVG逐byte對canonical source、no-store／MIME通過；12SVG restrictive CSP，非法SVG404／未登入credits302。三會員合法建立／加入四種waiting房，API players3。不是全玩法／全按鈕矩陣。 |
| 公開原生限制 | 初始read-only代理禁止入座POST，第二membership代理的room原生入座未完成；試驗超時後房間已404。未把join landing當正式waiting roster成功，也未由此宣稱產品join bug。正式native成果只計home，四房完整畫面以隔離證據為準；沒有注入正式位置／狀態。 |

發布前備份：/home/ccc/apps/afterhours/shared/backups/pre-freehand-final-8ae5c4f-20261007T160431Z-f6ccd5cb-1ed0-44d3-8e12-48000c47432f；SQLite online backup與另時點files archive不是atomic cold snapshot。候選materialize／隔離boot／schema預演16→16、22existing tables／9帳戶全fields保留。最初prepare在materialize前被缺release檔擋住，未切正式；materialize後重新prepare通過，沒有忽略錯誤。

UTC2026-10-07T16:05:07.649Z零房間guard後切release /home/ccc/apps/afterhours/releases/8ae5c4f，PID154553→160751；afterhours／tunnel active、local login／version與postcheck通過。私有production env與active data paths保留，import generation inactive，既有GitHub討論同步設定未改、本批無GitHub issue/comment寫入。

清理：public smoke總流程因房間已過期，leave200預期遇404而exit1，不能記整支script pass。後續獨立驗四個own rooms state404／列表無own房；native bridge與verification登入logout後auth me401。主smoke退出遺留的3個新own session，依備份session keys差集、固定三test usernames及嚴格6筆新session範圍，僅補寫revoked_at；原232筆sessions全fields保留、新6筆全revoked、其他帳戶不動。沒有刪session rows／帳戶／其他房間。所有own tabs、media/device overrides、isolated／public proxies已清理，測試未操作前景視窗。

最終資料核對：schema16／22schemas／**21non-session表rows與BLOB一致**、9users allfields／13market images保留、integrity ok／FK0；sessions232→238是本批6次驗證登入，都已撤銷，不說sessions完全不變。

私有證據：freehand-production-home.png、freehand-public-home-native.json、freehand-public-cleanup-verification.json、freehand-final-final-data-check-result.json，以及前述isolated四房／mobile／settings材料。正式截圖使用localhost私有authenticated proxy連實際shhuang.cc API／assets，不是local fixture；敏感cookies／password只留核准私有位置，未進Git或公開文件。尚未做真200%／讀屏、八席長名、全部playing階段、全功能操作／FPS與實體手機，下一輪按scope補，不以全套tests推定。
