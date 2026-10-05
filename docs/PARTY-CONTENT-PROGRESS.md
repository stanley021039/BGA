# 畫猜題庫與成人派對禮物

日期：2026-10-05。此批在 `feat/party-content-and-race-paths` 本地實作；不屬於先前的 YouTube PR #36，沒有發 PR 或部署。瀏覽器整合驗收由主 agent 接續，此文件中的 Node／HTTP 驗收不能當成真人試玩。

## 數量及可用入口

| 畫猜題材 | 原有 | 新增 | 合計 |
| --- | ---: | ---: | ---: |
| 食物飲料 | 13 | 112 | 125 |
| 動物生物 | 17 | 108 | 125 |
| 交通工具 | 15 | 85 | 100 |
| 生活物品 | 33 | 127 | 160 |
| 人物職業 | 8 | 82 | 90 |
| 自然奇幻 | 7 | 83 | 90 |
| 場所娛樂 | 15 | 95 | 110 |
| 運動音樂 | 12 | 88 | 100 |
| 迷因 Meme | 0 | 100 | 100 |
| **總計** | **120** | **880** | **1000** |

這裡把「約 1000 題」解讀為整份內建題庫合計。所有正式題目名稱都用繁體中文；常用英文迷因名和中文同義名稱作為答題別名，不另外灌成題目。NFKC、大小寫與空白正規化後，1000 題名稱與 ID 都唯一；每題 1–24 字、別名最多五個。新增內容逐題挑選，包含食物、生物、工具、場所及具體動作，不以換顏色／加數字／換主詞機械湊題數。

「迷因 Meme」可在建房、房主設定、獨立共編題庫和遊戲內題庫 dialog 勾選／投稿；舊 `topic` 及新 `topics` API 均支援。它是內建題材；好友投稿仍由獨立的「自定義」來源控制。新題庫頁可搜尋題目及別名、選題材、選內建／好友來源，每次顯示 60 筆，避免首次建立 1000 張 DOM 卡片。被全站禁用的題目仍由原 Store 排除。

迷因 100 題包括 50 個既有模板／動物反應形象，以及 50 個本站原創可畫的梗圖情境。原創情境在題庫頁清楚標「本站原創梗圖情境」，不是宣稱它們曾經在網路爆紅。例如「作業堆成山」「薪水長翅膀飛走」是本站情境；「女人吼貓」「火場淡定狗」有公開來源。此分類是否對不同朋友群容易猜，仍需真人遊玩校準，玩家可使用現有嚴格過半禁題投票。

| 送禮分类 | 原有 | 新增 | 合計 |
| --- | ---: | ---: | ---: |
| 日常 | 75 | 0 | 75 |
| 體驗 | 75 | 0 | 75 |
| 奇想 | 75 | 0 | 75 |
| 冒險 | 75 | 0 | 75 |
| 成人派對 | 0 | 50 | 50 |
| **總計** | **300** | **50** | **350** |

成人派對第一批採「曖昧惡搞、約會與夜生活」範圍，禮物名稱為原創，沒有露骨描述。沿用已隨專案提供的 Noto Emoji 圖片，不新增圖像下載或授權依賴。等待室的房主設定新增「加入成人派對禮物」checkbox，預設關閉；其他玩家可讀到開啟／關閉摘要。開啟只擴大抽題來源，送禮分數、四個順位、收禮確認順序和結算不變。

`includeAdult` 必須是 boolean，僅房主可在等待／完成階段設定。未提供時保留原設定。每轮同時過濾內建及好友投稿的成人分類，因此 100% 投稿也不會在未開啟時意外抽到成人禮物；投稿不足依原規則用一般內建補足。分類已出現在禮物題庫篩選及投稿下拉選單。

## 身分及資料相容

原 120 題 `builtin-easy/medium/hard-N` 的 ID、名稱、別名、難度及題材完整保留，已對照前一版本逐 byte 相同。新增題目使用 `builtin-TOPIC-DIFFICULTY-N`；各組只可尾端追加，不可重排或用新題覆寫舊列，避免既有禁題紀錄及收藏引用改指其他題。

原 300 件 `g1-01..g4-75` 的 ID、名稱、分類及圖片均保留；新成人禮物另用 `adult-01..adult-50`。既有收藏、歷史與帳戶資料沒有改寫。新增題材是既有文字欄位的新值，沒有資料庫 schema 升級；自訂題目／禮物仍沿用原本完整備份還原。房間選项由原遊戲快照保存 `includeAdult`，舊 snapshot 未有此欄位按 false 處理。

## 研究來源及取捨

查核日期均為 2026-10-05。研究用途為辨識模板與建立中文可畫描述，沒有匯入商業遊戲的整份題庫，也沒有下載梗圖當本站素材。各角色、照片與作品的原圖權利仍屬原作者；本功能只提供文字題目。

- [Know Your Meme：Doge](https://knowyourmeme.com/memes/doge)、[女人吼貓](https://knowyourmeme.com/memes/woman-yelling-at-a-cat)、[分心男友](https://knowyourmeme.com/memes/distracted-boyfriend)：查核角色及視覺結構，保留常用英語答題別名。
- [Gunshow 原作者的 On Fire](https://gunshowcomic.com/648) 與 [Dictionary.com 的 This is fine](https://www.dictionary.com/culture/memes/this-is-fine)：火場中坐著喝飲料的形象適合畫圖，中文版命名採場景描述，不搬漫畫或長篇台詞。
- [華視對「不可以色色」柴犬的報導](https://news.cts.com.tw/cts/entertain/202509/202509012508510.html) 及 [TWmeme 動物反應圖指南](https://tw-meme.com/guide/cat-dog-meme-collection)：補台灣常用名稱和社群反應情境；沒有把社群指南當成所有玩家熟悉程度的證據。
- [快樂快樂貓](https://knowyourmeme.com/memes/happy-happy-happy-cat)、[握拳亞瑟](https://knowyourmeme.com/memes/arthurs-fist)、[薩卡班甲魚](https://knowyourmeme.com/memes/sacabambaspis)、[忍痛哈洛德](https://knowyourmeme.com/memes/hide-the-pain-harold)、[Fry 拿錢](https://knowyourmeme.com/memes/shut-up-and-take-my-money)、[Change My Mind](https://knowyourmeme.com/memes/steven-crowders-change-my-mind-campus-sign)：補經典反應模板參考。這份名單不是 2026 熱度排行。

## 已完成驗收

Windows Node 24.14.0 focused **63/63**：

```text
node --test tests/draw-topics.test.js tests/draw-guess.test.js tests/draw-experience.test.js tests/draw-word-ban.test.js tests/gift.test.js tests/gift-motion.test.js
```

涵蓋 1000 題正規化唯一／字長／別名、原 120 題完整 SHA-256 相容、meme 抽題聯集及舊 topic API、答案私密、SQLite 投稿題材及舊 v9 升級、HTTP 題庫／建房／投稿、房主 UI 類別勾選、原禁題持久回歸、350 件圖片全部存在且 PNG 簽章有效、成人分類預設排除／房主權限／非法值原子拒絕／完成後重開／投稿過濾、成人禮物 SQLite 重開、HTTP 設定及 guest 摘要。`git diff --check` 無 whitespace 錯誤。

主 agent 已補正常尺寸背景Chrome整合：畫猜保存meme-only、題庫dialog篩選100題並實際開局得到三張meme；送禮預設未勾成人、房主開啟保存、guest只讀摘要及成人題庫50件。兩個登入身分／三席fixture，其他席位部分用HTTP控制，非真人樂趣評估。沒有逐題猜中或正式部署證據；完整數字與限制見 [整合進度](PARTY-UPGRADE-PROGRESS.md)。
