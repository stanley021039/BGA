# #80 傳情畫意初版進度

2026-10-09。base `6785f3512c0b421fb75ee23bb8138a9cff4e1309`（#84 跑團初版已按使用者授權合併）。branch `codex/issue80-telephone-v1`，候選 v1.25.0，schema 19 不變。#80 尚未合併／部署，獨立遊戲規則版號尚未實作。

## 已完成

獨立 TelephoneRoom、3–8 人同步畫猜、途中只看上一頁、固定傳遞映射、全員送出後房主換頁、略過、正常／中止揭曉、同分頁私人草稿恢复。大廳新卡、登入回跳、既有席位重連、腳本夥伴與歷史回看整合。生活／奇想各 20 個原創情境，獨立 ID、設定與資料檔，未改畫猜舊詞／禁題票／renderer。

每頁限 100 筆／3,000 點，每筆 256 點；brush／erase、顏色／筆寬、復原與清除。畫布 512×256；本機活動筆逐段繪製，放開與復原使用共用原子 canonical 呈現。歷史新增可選 historyState 邊界，Telephone 只保存本次 pageCommits 與起始 headers；前端去重重建，不每次重寫全場畫作。進行中歷史沿用既有禁止公開政策。

## 測試

Windows 原生 Node 22.23.3／npm 10.9.9，隔離合成資料、外部連接關閉。`npm ci` 成功。新增 **19 項**（engine 13、HTTP／最大容量 2、client／歷史重建 4）：涵蓋所有人數、隱藏草稿、同內容重送／內容衝突、舊頁／重開、越權與未全員準備、畫作格式／座標／限額／複製、題庫／RNG 原子性、離席中止、腳本公開資訊、auth／重連／頁面、最大八人八頁與 64 page commits、草稿 poll／reload、失敗離席、lost reply、pagehide／BFCache、新 run 歷史重置。

首輪新引擎 focused 14/15，腳本測試未推進既有延遲時鐘，修正 fixture 的 now 後 15/15。client 最初兩反例中，舊 lifetime 晚回應覆蓋 BFCache 畫面已修並有回歸；另一項 fake select 沒有原生預設選項，明確初始化 brush，4/4 通過。

首轮 `npm test` **1,949/1,951**，兩個既有 app-runtime／app HTTP 測試 `fetch failed`；根因未確定，不能直接稱 bad port。原失敗日誌保留。單獨 `node --test tests/app-runtime.test.js tests/app.test.js` **13/13**；重跑完整 **1,951/1,951**，fail／skip／cancel 0，exit 0，166,463 ms。全套後僅刪除每頁冗餘 native submit confirm、加入就地不可修改提示，再驗受影響 client **4/4**；最新 PR CI 將覆蓋交付 head。日誌在 checkout 外 `issue80-full.log`、`issue80-full-final.log`、`issue80-network-recheck.log`，未公開測試帳密或原始資料。

## 瀏覽器證據與限制

內建瀏覽器，隔離 loopback fixture／合成帳號／1280×720 深色模式。第一桌三席（兩腳本）驗大廳建房、設定奇想、實际三筆作畫與 reload 草稿、第一輪傳頁只收到圖、猜詞 reload 恢復。native confirm 的工具操作逾時，頁面輪詢停止後桌子按既有 90 秒規則清理；新分頁看到 closedRoom，歷史標「中斷存檔」，不把這桌當完局。送出按鈕已有明確確認語意，改為就地提示加直接送出，減少每頁打斷。

第二桌四席（三腳本）實際完成畫→猜→畫→猜：第一頁四筆鍋子，第三頁兩筆／復原最後一筆，觀察放開仍保留圖、新頁合法空白且沒舊草稿殘留；兩次猜詞以 Enter 送出。全員準備後手動傳頁，終局四本各含起始題及四頁，可切換傳遞簿，22 狀態歷史最後一步重建全四本。recovery tab console error 0、DOM scrollWidth 1265 ≤ viewport 1280。截圖在 checkout 外 `issue80-telephone-preview.png`。

這是工具操作與腳本試玩，不是四真人評測、模型理解或 FPS 量測。手機／真觸控／旋轉／200%／完整讀屏、雙真人接手途中對照、弱網大量草稿與自然長筆等待驗。繪畫本身需要指標操作；草稿不跨裝置、無長期戰役或斷線 host 代傳，歷史通用操作標籤仍沿用舊文字。使用者的規則版本建議尚未授權實作。

玩法方法、題庫取捨及來源見 [spec](specs/TELEPHONE-FIRST-EDITION.md)。不把此文件當正式上線證據；保持 Draft 供審查，#80 保留開啟。
