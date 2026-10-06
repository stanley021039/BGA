# 遊戲音效素材來源研究

查核：2026-10-06，音效師。這是官方頁面研究，未下載、試聽、登入、付費或採用素材；本輪不改程式。音色用途依頁面名稱／分類推論，尚未有聽感證據。事件與播放政策見 [遊戲音效計畫](../specs/GAME-SOUND-PLAN.md)，長期方法見 [音效師角色記憶](../agents/SOUND-DESIGNER.md)。

## 可取用來源與授權查核

下列7種來源都有官方取用入口及具體素材或license頁。可下載與可把原音檔放進公開repository要分開判定；「可進repository」欄是針對本專案原檔分發方式的設計判斷，仍須在逐檔採用時重核。

| 來源／已查官方頁 | 適合本遊戲（未試聽） | 授權、署名、改作與再散布 | 費用／取用流程 | 本專案採用判斷 |
| --- | --- | --- | --- | --- |
| **Kenney**：[Interface Sounds 1.0](https://kenney.nl/assets/interface-sounds)、[官方支援](https://kenney.nl/support) | 短確認、成功、輪次提示；可與現有兩個音檔統一音色。 | 具體包100檔，頁標CC0；可改作、商用與再散布，無強制署名。權利範圍以 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)及包內license核對。 | 單包免費／捐款自願。從官方包下載，核License.txt、版本與原檔，僅挑需要的聲音。 | **首選**。現有素材已來自同包；新檔仍要逐檔查來源，不能只沿用舊檔備忘。 |
| **OpenGameArt**：[SubspaceAudio—512 Sound Effects (8-bit style)](https://opengameart.org/content/512-sound-effects-8-bit-style) | 輕量成功、提示、推進／撞擊的復古候選；要確認不過於尖銳。 | 此項目作者SubspaceAudio，頁標CC0；免署名，可商用、改作／再散布。OpenGameArt其他素材有不同license，不能推成全站CC0。 | 頁提供免費20.6MB ZIP；採用後核archive的license與檔案對應。頁另連付費大包，不沿用本包結論。 | **首選備案**。與Kenney做單次音色比較，只挑短段，不整包載入。 |
| **Freesound**：[InspectorJ—Pop, High, A (H1).wav](https://freesound.org/people/InspectorJ/sounds/411642/)、[官方FAQ授權](https://freesound.org/help/faq/#licenses) | 約0.489秒pop；可評估猜中或卡片到達，勿把口技人聲當匿名無權利素材。 | 此檔**CC BY 4.0**，不是CC0；可商用、改作及再散布，須作者／來源／[license](https://creativecommons.org/licenses/by/4.0/)連結及改作說明，不附加阻止授權使用的限制。全站另有BY-NC與舊Sampling+。 | 此檔免費、下載需帳號。登入原頁，保存sound ID、作者與license；若不署名需另查作者付費授權，這輪未採購。 | **可署名備案**。不能只寫「來自Freesound」；先排除NC、授權不明及從電影／遊戲擷取的素材。 |
| **Mixkit**：[Game SFX](https://mixkit.co/free-sound-effects/game/)、[Sound Effects Free License](https://mixkit.co/license/modal/sfxFree/)、[官方取用說明](https://mixkit.co/free-sound-effects/) | 遊戲成功／失敗、短轉場；可從game分類縮小候選。 | SFX Free允許商用／非商用成品及改作，免強制署名；**禁止素材單獨、stock、tool／template及with source files再散布**，不得自稱作者或登記權利管理。不是CC0。 | 免費、不需註冊。每檔確認SFX Free，保留原頁與條款；只能規劃符合授權的完整成品分發。 | **暫不進公開repository**。不能因免費就把WAV隨source發布；先確認成品資源與source分發方式。 |
| **Sonniss**：[GameAudioGDC官方archive／2024包](https://sonniss.com/gameaudiogdc/)、[GDC Bundle EULA](https://sonniss.com/gdc-bundle-license/) | 寫實車輛、金屬、玻璃、撞擊等雷霆候選；小段裁切即可，非整套預載。 | 本日EULA **v2.0／2026-08-27**：可商用、改作、免署名；完成遊戲可分發、團隊內可共用。禁止以原／改音檔當音效素材再散布及AI訓練。新下載適用當日網頁版本，包內舊條款不能代替。 | GDC包免費，其他商品另付費。從官方年度包取檔，保留下載日、tracklist、供應者及當日EULA。 | **成品用途備案**。不把原音檔放公開asset庫／repository；大包成本與此輪少量提示音需求不合。 |
| **ZapSplat**：[Cartoon 4x metal taps or rattles, fast 1](https://www.zapsplat.com/music/cartoon-4x-metal-taps-or-rattles-fast-1/)、[Standard License](https://www.zapsplat.com/license-type/standard-license/)、[官方FAQ](https://www.zapsplat.com/faq/) | 卡通金屬碰撞／連鎖事件；頁顯示Standard，不依網站有CC0就換算此檔。 | Standard可嵌入遊戲、改作；免費Basic須署名ZapSplat，Premium下載可免署名。禁止原檔分享／素材再散布、獨立soundboard及AI訓練；少數CC素材另按其實際license。 | 需本人帳號；Basic免費MP3／下載限額，Premium付費有WAV。手動取用並保存下載時會員類型與授權，不能交接帳號。 | **暫不進公開repository**。可作成品候選，先核團隊／原檔分發及署名要求，免費MP3不等於最佳母帶。 |
| **Pixabay**：[DRAGON-STUDIO—Button Press](https://pixabay.com/sound-effects/film-special-effects-button-press-382713/)、[Content License摘要](https://pixabay.com/service/license-summary/)、[完整條款](https://pixabay.com/service/terms/) | 約1秒按鍵／確認聲；避免機械實錄破壞整體柔和音色。 | 此2025檔是**Content License**，非CC0；可免費商用、免署名、改作；禁止standalone再散布。仍須核第三方權利，完整條款也限制色情／猥褻／冒犯等使用脈絡。 | 免費MP3；從此作者原頁取用、留頁面／下載日／條款。舊於2019-01-09的CC0例外不能套到此檔。 | **場景與分發備案**。本遊戲有成人禮物選項，採用前另查適用場景；不把原檔作公開音效庫，也不擷取meme影音。 |

CC0的可改作／再散布範圍與其他權利例外由 [Creative Commons官方說明](https://creativecommons.org/publicdomain/zero/1.0/)核對；CC BY的署名及改作要求由 [CC BY 4.0官方說明](https://creativecommons.org/licenses/by/4.0/)核對。兩者均不保證上傳者確實擁有全部第三方權利；來源明顯是既有電影、遊戲、品牌聲音或名人片段時另查權利，不從「meme」標籤推定可用。

## 採用流程與記錄

本專案首輪先從已有Kenney音效與上述具體CC0包挑選，不需要為幾段提示音下載大型bundle或開訂閱。這是研究排序，尚未選定任何新增音檔。

1. 先固定事件、公開／私人收聽範圍、去重與長度目標，再找素材；為授權容易而改遊戲秘密資訊邊界不可接受。
2. 採用前重新打開單檔／套件原頁及當日完整license，核對作者、版本、上游來源與archive條款。付費或素材權利不明時，先整理具體候選及成本供決策；這輪沒有付款授權。
3. 記錄`sourceUrl`、作者、包名／sound ID、`licenseUrl`、license版本、查核／下載日期、原檔名及SHA-256、署名文字、改作步驟與成品hash、預定用途、`sourceRedistributionAllowed`與依據。公開manifest只放可公開資訊，不放帳號、付款或私有憑證。
4. 素材可再散布才放進repository；成品可用但source不可分發的來源，另確認資源封裝／提供模式，不靠改檔名、壓縮或轉檔規避限制。逐檔保留授權，不替整個asset資料夾加上虛假的統一CC0。
5. 經人工操作試聽後，裁頭尾、短淡入淡出、統一適度音量並檢查音色辨識；依需求挑相容格式及小型檔案。角色上傳用24kHz mono PCM16／10秒的現行契約，不代表系統事件聲也必須套此格式或播放10秒。
6. 整合仍走共用effects開關／音量及滿額政策；驗本人猜中、輪次、擲骰與checkpoint不重播，並驗mute、hidden、重連、失敗與八人密度。語意、授權與聽感分開記錄，未聽不寫「品質良好」。

## 研究限制與後續

本輪已讀上述官方頁；沒有取得zip內容、驗hash、查全部檔案或測實際下載流程，因此不宣稱各候選已可整合。網站條款與檔案授權會變動，採用時重新確認並保存那次證據；特別是Sonniss新EULA版本與ZapSplat會員條件不可沿用舊文章。

音效師下一輪負責少量短音選樣與逐檔manifest，程式方負責 [GAME-SOUND-PLAN](../specs/GAME-SOUND-PLAN.md)事件／排程，玩家方負責實際可辨識與噪音評估。這輪僅與主agent討論首批順序及密度，尚無玩家方聽感確認。

## 2026-10-06後續：首批素材採用與檔案驗證

使用者後續授權開始實作與驗證。**本節取代前文研究階段的「未下載／未選定素材」狀態**；上述7來源的比較保留為研究歷史。這次只採用Kenney的兩個確認聲及五個專案原創合成聲，沒有採用其他來源、付費或自動播放。

重新查 [Kenney Interface Sounds官方包](https://kenney.nl/assets/interface-sounds)與 [官方授權說明](https://kenney.nl/support)，並實際取得官方頁連出的`kenney_interface-sounds.zip`。下載包內`License.txt`標示Interface Sounds 1.0、Kenney、CC0；原包SHA-256為`f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232`。原包與解壓副本只在Git忽略的work，沒有放整包進發布資產。

| Cue／成品 | 採用範圍與改作 | 長度／WAV bytes |
| --- | --- | --- |
| [turn.wav](../../public/assets/game-sounds/turn.wav) | Kenney `Audio/confirmation_003.ogg`（原322.018ms）；裁成320ms、8kHz低通後轉24kHz。 | 320ms／15,404 |
| [correct.wav](../../public/assets/game-sounds/correct.wav) | Kenney `Audio/confirmation_001.ogg`（原289.841ms）；完整聲音以插值加速至220ms，音高也提高，並做低通／取樣率轉換。 | 220ms／10,604 |
| [dice-roll.wav](../../public/assets/game-sounds/dice-roll.wav) | **原創**：八次逐漸拉開間隔的輕碰撞／雜訊，seed `0xD1CE2026`，不按骰面改聲。 | 650ms／31,244 |
| [shot.wav](../../public/assets/game-sounds/shot.wav) | **原創**：短濾波氣流與下降音高，seed `0x51072026`，沒有真槍錄音。 | 280ms／13,484 |
| [slam.wav](../../public/assets/game-sounds/slam.wav) | **原創**：低頻衝擊、短金屬泛音及雜訊，seed `0x51A02026`。 | 350ms／16,844 |
| [nitro.wav](../../public/assets/game-sounds/nitro.wav) | **原創**：濾波雜訊隆起與上升引擎式音高，seed `0xA1702026`；單段、無loop。 | 500ms／24,044 |
| [skid.wav](../../public/assets/game-sounds/skid.wav) | **原創**：摩擦雜訊與下降中頻音高，seed `0x5C1D2026`；沒有輪胎錄音。 | 480ms／23,084 |

所有成品都是**24000Hz、mono、PCM16 WAV**；先處理DC，再做5ms淡入／24ms淡出及適度峰值縮放，首末sample為0。七檔總長2.8秒、總計**134,708 bytes**。兩個Kenney PCM母檔及包內 [LICENSE](../../public/assets/game-sounds/sources/KENNEY-INTERFACE-LICENSE.txt)保留在sources，讓生成器不依賴重新下載或特定OGG解碼器；這兩個母檔由python-soundfile 0.14.0／libsndfile 1.2.2解碼，hash列在manifest。原創五檔以xorshift32、正弦振盪器與包絡生成，**不標成Kenney或CC0**；manifest標`Project-original`，隨專案分發，沒有取用第三方錄音。

[manifest.json](../../public/assets/game-sounds/manifest.json)逐檔保存durationMs、bytes、SHA-256、作者、來源、授權、改作、峰值／RMS及生成器hash。含七檔、兩個母檔、license與manifest的asset資料夾目前共**201,280 bytes**。生成器 [build-game-sounds.cjs](../../scripts/build-game-sounds.cjs)只用Node內建模組，不播放音訊；`node scripts/build-game-sounds.cjs`重建，`node scripts/build-game-sounds.cjs --check`比較七檔及manifest並只讀驗證。WAV hash按原始bytes計算；生成器與license文字hash先正規化成UTF-8 LF，避免Windows／Linux換行差異改變manifest。

已做的內容檢查：重新生成後`--check`通過；另用Python `wave`獨立解析七檔header／sample數、核hash及峰值。實際峰值0.19998169–0.23999023（約−14至−12.4dBFS），RMS 0.01894238–0.07486735，clipped sample為0。已查看波形包絡：骰子為八段分離脈衝，shot／slam有短衰減，nitro／skid為一次隆起；頭尾歸零。這些是檔案及波形證據，**不是耳機／喇叭聽感驗收**；未播放聲音，不宣稱音色、辨識度或主觀響度合適。

後續由程式方接入共用播放入口及事件時序；音效師／玩家依當次授權安排聽感與多人密度驗收。若真人試聽需調音色／音量，修改生成器再重建與更新hash，不手改WAV而失去可重建性。本節不代表已部署或完整遊戲驗收完成。
