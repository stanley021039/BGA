# 共用導覽操作按鈕

2026-10-12，候選修正。截圖的導覽及題庫連結有框與無框混用，quiet樣式也把左右留白清為0。

共用site-header掛載時將site-links的a／summary及game-toolbar nav的a／button套ui-button＋ui-navigation-button。框線、橢圓外框與44px基本高度沿用ui-primitives；文字距框線上下8px、左右16px，頁面quiet不再覆蓋；icon-only操作仍保留自己的圖示尺寸。普通段落連結、房號標籤、品牌名稱、内容選擇卡不套用。

導覽及工具列按鈕間12px，子選單8px。1180px以下導覽可換列，帳號操作依頁面既有header布局重排，避免新增外框後擠壓手機。保留原生a的連結／另開分頁及summary展開、hidden、可讀名稱與focus。

初次修改在獨立worktree處理。使用者其後授權在主對話結束後整合；已更新到最新main基準4a9d629、候選1.30.2。正式服務不在本次整合操作範圍。實際驗收證據另記，不把候選規格當成上線。

本輪實證：Chromium真共用header掛載與八頁CSS，在1440／390、亮暗共32組通過2px外框、999px半徑、8px／16px內距、44px高度、無水平溢出；原生summary鍵盤展開與hidden契約通過。10項focused測試、patch release check及diff check通過。首次版面驗收時未執行完整suite；其後完整Linux2,052通過，Windows CI首次遇暱稱測試計時競態。PR最新證據為準；未部署、未驗實體觸控與跨瀏覽器。

Windows CI首次失敗已在隔離複本加1200ms延遲重現：雷霆開局骰點一秒揭曉更新deadline，與改名無關。暱稱測試只mock Date固定時鐘，原deadline／版本／歷史與播放斷言保留，沒有修改遊戲邏輯；最終完整suite及CI以PR紀錄為準。
