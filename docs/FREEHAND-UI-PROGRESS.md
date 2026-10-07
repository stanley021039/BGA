# Freehand UI 進度

2026-10-07，候選v1.14.1／尚未固定source。基線正式v1.14.0／b4ebb15。研究／實作進行中，未以作者作品或前版測試宣稱本批完成。

root背景Chrome實際讀Streamline Freehand family／Duotone Free，頁明列1000、24px／CCBY4；看Awwwards Gionatan Nese '26與作者真網站（白底、中央散列小作品卡、兩側題字／大量留白）。作者例僅借圖文對比，不採大留白／無限滚动／作品資產進多人操作界面。Pinterest web403，Chrome可讀搜尋則依實際後續記錄，不混同web工具或agent觀察。

asset owner components_design從官方repo固定52d750c9ce051e51cb181b7a78932120c48541d0取11件duotone SVG，原封bytes／SHA／24viewBox與無scripts／外部resource已查。root在freeze後改色並保originalSHA／modifiedSHA與修改說明。其他研究與跨角色取捨見 [spec](specs/FREEHAND-UI.md)、[資產評估](research/FREEHAND-UI-ASSETS-ASSESSMENT.md)、[視覺參考](research/FREEHAND-UI-VISUAL-REFERENCES.md)。

待補：固定source、回歸測試、desktop/390／controls／popovers／重要遊戲資訊原生確認、正式部署與資料保留／清理。測試帳密、cookies和私人偏好不進此文件。

## 候選實測（發布仍待驗）

Windows Node24.14.0，最終程式npm test：1415/1415、38125.6623ms，fail/cancel/skip/todo各0；先前改鉛筆圖案前37743.9415ms的同數suite是歷史，不重複總計。release:check從v1.14.0按patch通過，syntax／git diff --check通過；focused10為局部，不加到full總數。原始來源11件SVG／modified SHA與無active/remote content，以及12白名單SVG的MIME／CSP／精確bytes／非法路徑404與credits登入保護有真HTTP測試。

root背景Chrome：1280×900三欄、1024×768兩欄、390×844單欄；六張圖全部載入，72px、正文16px，390 client/body寬375無橫向溢出。create/join52px、refresh/settings/emote44px，390設定層320×665、x8/y129/bottom794、炭墨rgb41,54,47對紙白rgb255,253,247，creditlink44px；account menu與credits頁可讀／設定版號1.14.1。真reduced media時hovertransition0s。

四款三席等待房1280×900與390×844均載入32px badge／24px SVG、無橫向溢出，玩家／車隊文字仍可見；1280三個player卡及race四slot（3車隊＋等待slot）保留，gift/majority/draw/race roster底部分別883/737/505/680，沒有重新隱藏重要內容。gift起初locator被影片詢問modal擋住，是未完成樣本，dismiss後再驗；非UI遮蓋bug。work/freehand-room-native.json與freehand-room-mobile-native.json、四款截圖為私有證據。此scope為waiting／標題插圖，不宣稱全玩法或重新驗完整畫布流程。

初次畫猜卡選取經DOM snapshot顯示aria-pressed與建立你畫我猜按鈕一致；最後一筆剛click即讀的早期樣本仍thunder，未把它當完成，正式驗收會再等可見狀態確認。鉛筆比三圓color-palette更容易辨認，最終已改home/draw badge為edit-pencil。截圖work/freehand-home-cards.png、freehand-mobile-settings.png；圖片不等使用者滿意、真200%／讀屏／FPS結論。研究／preview own tabs已關閉、device/media overrides清除、isolated app/proxies停止。
