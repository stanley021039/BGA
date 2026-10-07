# Freehand UI 素材取得、授權與選型評估

日期：2026-10-07。研究基線：repo HEAD a930752、正式v1.14.0。
本批範圍是Streamline Freehand SVG的官方取得、授權與本站選型；Pinterest／Dribbble／Awwwards風格研究由其他角色處理，不能把展示圖當可重用素材。
本角色沒有改程式／版本／tag／部署、安裝或購買套件，也沒有登入新帳號。依主agent後續授權，已新增11個官方原封SVG及來源manifest，然後凍結資產folder交由主agent改色。

## 可取得的官方來源

1. [Freehand families入口](https://www.streamlinehq.com/freehand-sets)是family導覽，不表示所有Freehand素材都免費。
2. [Freehand Duotone Free](https://www.streamlinehq.com/icons/freehand-duotone-free)：主agent背景Chrome實際讀到1000icons、24px grid、CC BY4.0。其單圖頁包括[Edit Pencil](https://www.streamlinehq.com/icons/download/edit-pencil--32156)、[Settings Cog](https://www.streamlinehq.com/icons/download/settings-cog--32156)、[Home](https://www.streamlinehq.com/icons/download/home--32156)。這些是app export入口，不是已固定的raw SVG URL；本角色web工具遇unsupported markdown及HTTP challenge，未繞過或登入。
3. 官方[webalys-hq/streamline-vectors](https://github.com/webalys-hq/streamline-vectors)：README自述Streamline設計團隊、連官方網站、明列CC BY4.0；freehand/duotone下可逐件讀raw SVG，無帳戶／付費依賴。不要把同名但無公開repo的github/streamlinehq誤當此鏡像。
4. 本批固定官方commit **52d750c9ce051e51cb181b7a78932120c48541d0**；GitHub tree API回覆truncated=false，下載使用commit URL而非浮動main。作者署名為Streamline團隊；沒有逐件個人作者證據，不把創辦人姓名填成每件作者。
5. [Iconify Freehand Color](https://icon-sets.iconify.design/streamline-freehand-color/)／[套件 metadata](https://www.npmjs.com/package/@iconify-json/streamline-freehand-color)是第三方再發布管道，author指回官方repo、CC BY4.0、24grid。可用作無登入查名／export fallback，不能稱為Streamline官方下載。本批直接取官方raw，沒有安裝Iconify/runtime或新增外部icon網路请求。

## 授權與付費邊界

| 來源／條款 | 已查到的要求 | 本批處理 |
| --- | --- | --- |
| 官方repo [README授權段](https://github.com/webalys-hq/streamline-vectors/blob/52d750c9ce051e51cb181b7a78932120c48541d0/README.md) | 明示CC BY4.0，可分享、改作及商用，要求Streamline署名與網站連結。repo沒有單獨LICENSE檔，grant在README。 | 保存原README授權段於assets/streamline-freehand/LICENSE.md，加CC完整legalcode連結；每SVG原desc來源保留。 |
| [CC BY4.0官方條款](https://creativecommons.org/licenses/by/4.0/) | 商用與修改允許；適當署名、授權連結、說明改動，不能暗示作者endorsement。 | manifest記publisher／source／fixedcommit／license／originalSha256／current sha256／modifications。改色屬改動，更新current SHA並保留原SHA。 |
| [Streamline現行Free License](https://help.streamlinehq.com/en/articles/5354376-streamline-free-license) | 免費產品需可讀署名＋streamlinehq.com連結；web可footer，空間有限可Credits/About。一般免費方案列每project50icons，真正Free Set才有SVG，Premium preview只低解析PNG。 | 本批11個，按50件範圍規劃；實際repo明示CC授權保留，不把所有free／premium混為同一許可。重要控制不為署名擠壓，可用共用可達Credits入口。 |
| Free但非open-source組 | 官方面說並非所有free組都是CC；自訂Free License對再發布成可選素材庫有限制。 | 本批限定已明示CC的repo SVG作成品UI，不加入studio／收藏庫給用户當獨立素材挑選下载。 |
| [Free帳戶可存取格式](https://help.streamlinehq.com/en/articles/5435840-which-assets-do-i-have-access-to)與[付費family](https://www.streamlinehq.com/lifetime) | Premium SVG／免署名或更大方案需依付費授權；某些preview有PNG不表示vector也免費。 | 沒有購買／升級，本批不需要付費。免費組缺圖用本站原創或現有registry，不當作整批阻擋。 |

CC BY4.0與Streamline一般Free License分開記錄；不因第三方package標「MIT」就替換SVG原授權，也不把所有Streamline family視為CC。
可讀署名建議：「Freehand icons by Streamline · CC BY4.0 · 部分配色已調整」，連Streamline及license，修改說明依實際有無調色更新。
上方是查到的授權條款與本批採用記錄，不宣稱重新授權其他未查素材。

## 本批已取得的11件

皆來自Streamline Freehand Duotone，作者Streamline團隊、CC BY4.0、viewBox0 0 24 24。
連結指官方固定commit的實際SVG，不需要登入或安裝；本地初始文件保留raw bytes，原desc含Streamline來源。

| 原始檔名／官方SVG | 本批推薦用途 | 選型界線 |
| --- | --- | --- |
| [edit-pencil.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/interface-essential/edit-pencil.svg) | 畫圖分類／創作入口 | 不取代所有Paint式畫具，以免同工具風格／辨識倒退。 |
| [color-palette.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/design/color-palette.svg) | 你畫我猜類別／大廳卡片 | 適合較大圖案，實际20/24px辨識須另驗。 |
| [conversation-chat.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/email-messages/conversation-chat.svg) | 同頻／聊天分類 | 小型送出／emoji操作仍用共用registry，不混多套。 |
| [business-management-team-up.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/work-office-companies/business-management-team-up.svg) | 好友／一起遊玩的輔助圖案 | 不替換真角色、玩家名單／狀態。 |
| [board-game-dice-pawn.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/music-video-entertainment/board-game-dice-pawn.svg) | 桌遊分類 | 不是權威骰面或雷霆特殊骰規則圖。 |
| [card-game-card-spade.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/music-video-entertainment/card-game-card-spade.svg) | 撲克分類 | 不改實際手牌／公開牌。 |
| [music-note-1.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/music-video-entertainment/music-note-1.svg) | 音樂類別圖案 | 播放／停止／seek等控制維持原GameUI辨識。 |
| [analytics-graph-stock.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/business/analytics-graph-stock.svg) | 股市冥燈分類 | 不替代數據、預測狀態或分數文字。 |
| [home.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/interface-essential/home.svg) | 大廳分類／入口圖案 | 小型返回按鈕是否更換由整合方按識別一致性驗。 |
| [time-clock-circle.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/interface-essential/time-clock-circle.svg) | 時間主題輔助圖案 | 不取代常駐數字倒數／timebar。 |
| [connect-flash.svg](https://raw.githubusercontent.com/webalys-hq/streamline-vectors/52d750c9ce051e51cb181b7a78932120c48541d0/freehand/duotone/interface-essential/connect-flash.svg) | 雷霆速度主題標記 | 不當新地形／車型；可讀遊戲名與room身份保留。 |

前10件原色#020202＋#0c6fff；connect-flash只有#020202。共用24viewBox不表示所有圖案都適合20px小操作。
免費duotone tree未找到合適car或gift-box，沒有用信用卡／紙箱硬冒充；主agent採本站原創simple giftbox時應獨立記「本站原創」，不能署成Streamline。
Settings等官方單圖頁存在不表示它必然在本批11件；Freehand line／duotone不同組不能混用ID或配色。

## 取得與交接證據

初始assets/streamline-freehand/含11SVG、manifest.json、LICENSE.md、ATTRIBUTION.md。
每SVG在寫入前經XML parser驗well-formed；禁止DTD/entity、script／foreignObject／style／event attributes及外部resource，保持原始bytes與upstreamdesc。
metadata記固定commit及每件原／current SHA256、來源URL、viewBox、原色、modified=false；沒有執行SVG內程式或增加runtime外部fetch。
資產folder已凍結交主agent；主agent後續可在相同路徑改副本配色，記modified／修改說明與新sha256，保留originalSha256。本研究表的原色／bytes敘述只指初始import，不宣稱接入後仍原封。

建議首批只用少量Duotone於大廳遊戲分類與較大輔助圖案，重要小操作沿GameUI registry／既有44px命中區／hover、focus及touch說明；不因freehand裝飾隱藏名單、角色或當前狀態。
如果改暖綠／琥珀配色，保持原兩層線條與實心圖形關係，用等比例縮放，不把手繪變化全面壓成同stroke造成圖意扭曲。

本次完成來源、取得與安全檢查；未做本站native接入／縮小辨識／對比／焦點／手機／hidden驗收，沒有新版本或上線結論。

