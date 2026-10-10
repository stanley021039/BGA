# 主頁新遊戲卡片圖片（2026-10-10）

使用者指定主頁輪播卡片的上方區域必須有圖片。已補瞎掰王、猜歌挑戰、極簡畫家、傳情畫意、霧港跑團五款原創 SVG；沿用現有紙卡插圖的深色輪廓、粉彩背景與幾何線條。檔案位於 public/assets/playful/game-{bluff,musicquiz,minimal,telephone,trpg}.svg。不是實體桌遊封面，沒有下載第三方素材或使用附件截圖的像素。

四張原本 tile-art／tile-copy 卡片改用共用 tile-image／tile-body，霧港跑團替換鐘符號；保留遊戲文字、選取狀態、輪播順序與建房功能。全部 11 張主頁卡片都有圖片；装飾性圖片 alt 空字串、draggable false，由遊戲文字提供可讀名稱。伺服器只增加這五個精確 SVG 路徑，沿用 sandbox CSP，不放寬其他 SVG 路徑。

驗證：圖片路由、HTTP exact bytes／CSP／不可執行內容／未知路徑404，以及輪播與返回房間相關 6/6 通過（3746ms，ignored work/new-game-art-tests.log）。Chromium 11 張 img 均 complete 且 naturalWidth>0；1266px 桌機亮色確認瞎掰王及霧港跑團圖片、上下款切換；390×844 深色瞎掰王無橫向溢出，內容寬與 clientWidth 均376px。驗後還原外觀跟隨系統及預設 viewport。截圖 work/bluff-preview/game-card-art.png、game-card-art-mobile.png。未驗實體觸控、Safari、所有卡片逐張深色快照。

本機 port3000 預覽已更新。更新前大廳0房間；停止舊測試服務後殘留鎖，確認鎖皆為已死亡的自有 PID 才清理五個鎖檔並恢復原測試資料。沒有重建帳戶或删除對局資料。仍屬 feat/bluff-king 未發行批次1.28.0，未提交／推送／發PR／部署。
