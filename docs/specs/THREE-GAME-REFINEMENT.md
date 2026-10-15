# 三款遊戲音效、提示與題庫更新

日期：2026-10-15（台灣）；候選 2.7.0。既有分支 feat/majority-cruel-two，以已整合的 main 931b602 為基準。本文件描述本機實作；未發布本批 PR 或部署。

## 郎中闖江湖

- 使用者提供的「不抽了.mp3」「結算.mp3」轉為 24kHz、單聲道 PCM16；分別 1765ms／660ms，峰值目標 0.35，10ms 淡入、30ms 淡出。原始錄音保留本機；轉換程式、來源及輸出 SHA256 見 tools/convert-quacks-stop-settlement.cjs 與 quacks-manifest.json。
- 專用 quacks-stop／quacks-settlement 經共用音效偏好播放。停止事件只在伺服器接受玩家主動停止時記錄，僅本人可見，請求重試不重複；爆炸、抽空藥袋、自動停止不產生語音。初載、重連、背景頁面不補播。
- 結算沿用每個階段／本人有效確認的既有事件去重，換成新錄音；其他遊戲通用 settlement 保留。
- 黑／綠／紫結算提示保留本輪結果，移除再次重述藥材書規則的第二段；原藥材書效果仍可在藥材查看。
- 提示框先重設座標再量測，優先放在可用的上方／下方，依可見視窗夾住邊界。移除購物按鈕多餘預設圖示，使藥材與價格不互擠。

## 瞎掰王

反應按鈕與全桌反應文字統一為「好了啦」，保留既有音效、冷卻與去重。老實人的秘密角色卡只有一段詳細解釋，移除重複短答案、「可以怎麼說」與「別搞混了」；資料與揭曉查證來源保留。

新增 bk149–bk160，148→160 題，原有 ID 及順序保留。新題為湧升流、下降流、副振盪、大洋環流、氣象海嘯、異常巨浪、河口灣、同步潮汐鎖定、太陽差異自轉、光球、日冕洞、太陽針狀體。每題有短答案、詳細解釋、口述例子、易混淆提醒及查核日期。

官方查核來源：
[湧升／下降流](https://oceanservice.noaa.gov/facts/upwelling.html)、
[副振盪](https://oceanservice.noaa.gov/facts/seiche.html)、
[環流](https://oceanservice.noaa.gov/facts/gyre.html)、
[氣象海嘯](https://oceanservice.noaa.gov/facts/meteotsunami.html)、
[異常巨浪](https://oceanservice.noaa.gov/facts/roguewaves.html)、
[河口灣](https://oceanservice.noaa.gov/facts/estuary.html)、
[潮汐鎖定](https://science.nasa.gov/moon/tidal-locking/)、
[太陽](https://science.nasa.gov/sun/facts/)。

## 同頻俱樂部

殘酷2選1 由60→96張原創雙圖題；每題兩張本專案 SVG，共192圖。六主題各16題：生活、感情、成人、倫理、尷尬、獵奇。新增繪製椅子場景。沿用雙人組隊、個人、單人十題回顧規則，不改計分。

以使用者提供照片中的題型作原創改寫，例如博愛座、網路與朋友、炫富／抱怨貼文、外表／口才、暗戀告白、前任與朋友、成人關係、性產業管理、娛樂大麻制度、犯罪與責任、學校競爭、生活便利。沒有把商業卡牌照片直接製成遊戲素材；插圖與新文字皆由本專案製作。這些是玩家偏好兩難題，不提供法律或醫療結論。

## 驗證

- tools/qa/three-game-refinement.cjs：隔離資料與真 Edge；1440／390px 檢查購物第一／中間／最後提示框四邊、價格邊界、三色提示無第二段、停止及結算原生 playing 各一次、重整無補播、老實人僅一段解釋與「好了啦」按鈕。沒有頁面錯誤。證據 work/qa/three-game-refinement/evidence.json。
- tools/qa/majority-cruel.cjs：96張題庫下，真 Edge 多人組隊、個人、單人、普通模式與換題回歸通過，沒有頁面錯誤。
- 新增伺服器主動停止事件隱私／重試／爆炸排除、媒體波形校驗和及新檔 HTTP 精確位元組測試。
- 自動化無法代表使用者喇叭主觀聽感或真實觸控裝置驗收。

## 本機預覽

3012 為獨立測試站，使用既有測試資料的一致快照；不重啟舊站。房號及程序資訊只保存在 ignored work/playtest/refinement-runtime.json，不將測試登入或 session 放入文件。

## 最終驗證與審閱

固定資產後完整測試 **2,228／2,228** 通過，失敗／取消／略過／todo皆0，150811ms；紀錄 work/playtest/three-games-fixed-assets-tests.log。最後購物與音效 focused34／34；release check minor（base931b602）及diff check通過。新預覽 /api/version 回2.7.0，十份核心資源與本機位元組完全一致。

本次兩款介面 QA 使用隔離伺服器上的真實靜態資源與原生音訊播放，房間快照由真實引擎產生並攔截測試 state／reconnect；不宣稱以該 fixture 完成多人傳輸驗收。殘酷流程 QA 另走實際HTTP多人／單人房間。喇叭主觀聽感、真觸控及Linux仍未驗。

先前測試 three-games-full-tests.log 有一項仍期待舊反應文字，已修正相應測試；three-games-final-full-tests.log 的兩項 ASSET_VERSION_MISMATCH 是測試期間仍修改資產所致，不能算通過。停止資產變更後重跑上列完整結果；沒有修改資料移轉驗證或繞過資產指紋。

審閱第一輪核對所有指定音效、顯示精簡、提示位置與兩個題庫增量；第二輪核對停止事件權限／請求去重／爆炸排除、媒體白名單與波形、既有題目ID／順序、圖像本機路徑及手機價格邊界。未發現未解重大問題。交付前 origin/main 仍為931b602，沒有覆蓋他人更新。
