# 共用操作按鈕外框

2026-10-12，候選1.28.6。使用者要求按鈕也成為基本元件，保留橢圓外框；截圖中的離房確認／取消因未套用共用類別而呈原生方形。

ui-primitives.css 的操作按鈕契約同時涵蓋原生 button、submit/button input、既有 button/page-button/primary/secondary 與 ui-button/ui-icon-button。共用tokens定義999px橢圓radius、2px框線、基本內距及44px高度；框線和radius是共用不變項，以important避免晚載頁面樣式或bare button回退成方形／無框。配色與語意填色仍由主題／primary、secondary選擇。icon-only既有44px尺寸繼續，成為圓形外框。

遊戲／角色的內容選擇卡、禮物卡、選題卡及骰子／車輛圖卡沿用各自卡片幾何。hidden明確保留，原生音訊／影片播放器與瀏覽器原生confirm屬外部控件，不宣稱已重繪。離房HTML dialog的確認／取消明確使用ui-button＋primary/secondary，並透過GameUI registry加離房／取消圖示與可讀中文標籤。

實證：25HTML的真CSS與共用header／theme mount，在1440／390、亮暗共100布局，bare／explicit／link／disabled／pending操作框均999px／2px且至少44px；hidden不可見、內容卡例外不改、theme icon尺寸與caption裁切正常。十款隔離真等待房40布局／十次start與瞎掰自動設定通過。五款隔離實際HTML離房dialog20布局：confirm/cancel框線、無水平溢出、cancel／Escape不送leave且返焦、503失敗留原房、再次確認只送一次並返回大廳通過。畫猜持筆15採樣、ACK、觀看者墨跡、倒數、揭曉及換輪通過。

完整suite、CI、两轮審查、main與公開站結果見本批PR留言；跨瀏覽器、真觸控、所有phase、200%字體未由此矩陣驗證。
