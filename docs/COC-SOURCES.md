# 《克蘇魯的呼喚》COC7／Pulp 來源與支援範圍

本文件描述新增遊戲的來源與實作邊界，不代表完整冒險已通過驗收。可玩狀態以當次驗收紀錄及站台的功能開關為準。

2026-10-31 新增核桃街與《毒湯》中央房間兩張原創生成場景圖，使用內建 image_gen，提示詞及檔名保存於 `assets/coc/SOURCES.json`。地圖是依本版場景關係生成的SVG示意，僅投影已知地點，不含原書地圖或插畫；路線不表示實際比例。插圖經成員與探索權限驗證後才傳送。

## 首篇冒險

- 原作：**In A Different Light**，Dean Engelhardt；本篇中文名稱為《異樣之光》。採 Cthulhu Reborn 2011 年 release 1.0b 版本，保留 1928 年春的阿卡姆、波士頓與原作周邊地理。
- [作者網站的作品入口](https://cthulhureborn.wordpress.com/downloads/downloads-rescued-scenarios/)、[原始 PDF](https://cthulhureborn.wordpress.com/wp-content/uploads/2011/04/in-a-different-light-release-1-0b.pdf)、[作者網站的授權說明](https://cthulhureborn.wordpress.com/about/)。來源查核日期：2026-10-28。
- 原始 PDF 共 34 頁，SHA-256：`FA3D9C361BEDA2E77942DAB5D1158E6ABC3A0EFC2CB2E3BECCF1D62286A1DB47`。
- 本專案自行撰寫中文敘述，將原先由主持人裁定的事件轉成可保存、可恢復的狀態流程，並把第六版能力值轉換到第七版尺度；英雄使用 Pulp 體力，NPC 不套用英雄體力加倍。
- 為使固定時程下的終幕與儀式起始限制能同時成立，本改編把倉庫會面由原作的晚上七點移至晚上十點，車輛事件為十點半。這是本改編的時程調整，不能冒稱原作原有安排。

原作改編的敘事資料及中文敘述依 **[CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/)** 標示來源、非商業及相同方式分享；此標示不改變既有程式、其他作者素材或商標的授權。未打包原書 PDF、原書插圖、地圖、字型、官方標誌或官方規則原文。

Call of Cthulhu、Pulp Cthulhu 與相關商標屬其權利人。作者的敘事改編許可不等於官方書籍、商標或軟體使用的全面授權；本遊戲沒有宣稱獲得官方背書。[Chaosium Fan Material Policy](https://www.chaosium.com/fan-material-policy/) 與 [Licensing Q&A](https://www.chaosium.com/fan-use-and-licensing-q-a/) 應與來源作者授權分別查核，不能用前者替代軟體或商業發布所需權利。

## 規則來源

規則數值採公開的一手規則事實，程式與中文介面另行撰寫。使用 [Chaosium／Roll20 的 Free Basic Rules](https://roll20.net/compendium/coc/Rules:Free%20Basic%20Rules?expansion=0) 中的建卡、檢定、戰鬥、理智、Pulp 傷勢及幸運規則；它不是可任意再散布官方書籍的許可。

| 項目 | 本版範圍 |
| --- | --- |
| 玩家 | 1–4 個真人席位；AI 僅主持，不補 AI 調查者 |
| 建卡 | 六原型、四種固定專長職業、五項天賦中選兩項；伺服器擲能力值並驗證點數來源 |
| 私人角色 | 原卡與團內副本獨立；結束後可另存合格倖存者的成長與消耗，不能替其重新配點 |
| 檢定 | 一般／困難／極難、大成功／大失敗、獎勵／懲罰骰、幸運調整、一次孤注一擲；對抗同等級比較能力值，仍同值則各 D100、低骰勝，骰相同時再次手動決勝 |
| 擲骰時機 | 非戰鬥 PC 檢定、每場次幸運恢復、結束角色成長及對抗平手決勝由玩家點擊；戰鬥與 NPC 骰自動產生；結果均在伺服器保存 |
| 戰鬥 | 宣告武器、敏捷先攻、閃避／反擊、近距離手槍射擊與多發懲罰、彈藥／裝填、實體觸肢與護甲、支援怪物的觸肢或吞沒攻擊 |
| 傷勢 | Pulp 體力、昏迷／瀕死／死亡、急救／醫學、自然恢復及明確選擇的幸運支出 |
| 理智與成長 | 手動 SAN／INT、暫時及不定性瘋狂記錄；主持人選擇恐懼症型發作；無幸運加成的成功技能才記成長 |
| 敘事與時間 | 主線基本線索不因一次檢定失敗封死；已發現資訊全隊共享；故事時間由行動推進，討論與暫停不推進 |
| 不包含 | 全職業／全專長／全天賦、靈能、怪異科學、完整追逐子系統、所有武器與所有怪物招式；不能把未提供的選項描述成已支援 |

具體來源：[Pulp 建卡](https://roll20.net/compendium/coc/Rules:Step%20Two%20%28Generate%20Characteristics%29?expansion=0)、[天賦](https://roll20.net/compendium/coc/Rules:Step%20Three%20%28Determine%20Pulp%20Talents%29?expansion=0)、[戰鬥](https://roll20.net/compendium/coc/Combat?expansion=0)、[理智](https://roll20.net/compendium/coc/Sanity%20%28SAN%29?expansion=0)、[Pulp 傷勢](https://roll20.net/compendium/coc/Wounds%20and%20Healing)、[幸運](https://marketplace.roll20.net/compendium/coc/Rules:Using%20Luck)。

對抗檢定的同等級、同能力值平手程序另核對 [Chaosium 官方對抗檢定規則](https://callofcthulhuwiki.chaosium.com/rules/opposed-skill-rolls.html)。

## AI、保存與隔離

目前隔離預覽以官方 Codex CLI 使用已正常登入 ChatGPT 帳號的 Codex 額度，與該帳號其他 Codex 工作共用。支援管理者在登入電腦手動啟動 SSH worker，或使用伺服器獨立 profile；網站不讀取或搬移 CLI 登入檔。已完成本機 worker 的真實模型實玩；詳見 [驗收紀錄](specs/COC-PULP-PREVIEW.md)及 [操作說明](COC-CLI-OPERATIONS.md)。這不代表公開代管資格已獲核准。

選用 API 連線時，OpenAI 使用官方 Responses API；Claude 使用官方 Messages API，依所選帳戶的 API 用量扣抵。符合資格的 ChatGPT Pro／Business 可先領取訂閱附贈的 API credits；具體條件及失去資格後的處理依 [官方說明](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)。房主只能使用本人金鑰或管理者配置的站方額度；CLI 失敗不會自動切至 API。

金鑰以 AES-256-GCM 加密，主密鑰保存在資料庫外的受保護執行目錄；瀏覽器與房間只取得設定狀態及末四碼。資料庫搬移不會憑空產生原主密鑰；缺少原保護金鑰時須重新輸入供應商金鑰，不能把密鑰放進網站發布包。

冒險狀態、操作回條與 AI 呼叫帳本獨立保存。重試敘事沿用原行動與骰值；已送到供應商卻未確認的請求仍可能計費，必須由房主明確重試。房間公開投影只包含已發現線索、玩家角色與已提交結果，不包含主持人模組、固定真相或未發現線索。

教學由玩家主動開啟，使用獨立記憶體資料庫與實際規則引擎，清楚標示為不連接 AI 的示範，不寫入角色庫、冒險存檔或 API 呼叫帳本。它不能替代真實 AI 主持驗收。


## 額外驗證劇本：《毒湯》

原作《毒入りスープ》，作者泥紳士。原發布位置為 [やろうず Wiki 的シナリオ置き場≪1≫](https://seesaawiki.jp/trpgyarouzu/d/%a5%b7%a5%ca%a5%ea%a5%aa%c3%d6%a4%ad%be%ec%a2%e31%a2%e4)，[作者連結的原稿](https://www.dropbox.com/s/ljfa6zzak1azrlp/%E6%AF%92%E5%85%A5%E3%82%8A%E3%82%B9%E3%83%BC%E3%83%97.txt?dl=0)。2026-10-29 讀取原稿，原始文字為 CP932；僅作本機研究，未把原稿、翻譯版全文、地圖或插畫納入來源包。

作者在原發布項目說明，這是免費公開的作品，標示出處、作者與劇透提醒後，可自由製作影片、小說等作品。本候選依該衍生創作說明，以自行撰寫的中文及互動規則製作供驗證的改編。網站遊戲不是條款單獨列舉的類型，這是對「等作品」適用範圍的解讀，並非取得對本網站的個別書面授權；目前只在隔離測試站驗證，不將它記為已獲商業發布許可。來源標示與劇透提醒須保留。

改編固定選擇：現代舞台，1–4 位真人；共用房間移動遵守全員同意。一小時為故事時間，通常移動兩分鐘、完整房間調查六分鐘；聊天、教學、暫停不計時。基本解謎資料不因檢定失敗消失，失敗可增加查找時間。原六版能力換至七版尺度；黑蓮毒 POT25 換為125，以已保存的對抗骰與玩家手動 CON 判定處理。夢中傷勢與期限後現實傷害分開，不能沿用另一篇冒險的死亡或恢復結算。NPC沒有全知能力，少女使用短句是非問題回應，神話真相僅保留在伺服器。

守衛採固定行為：護書者以鞭擊防衛，歸還書本可解除事件；物理武器不造成傷害，火焰或吞入有毒書本可影響它。禮拜室守衛使用尾纏與咬擊，普通子彈無效，其餘實體傷害扣除9點。危險分支、夢境後果與未驗證項目須以實際驗收紀錄為準，不能以程式存在宣稱已通過。
