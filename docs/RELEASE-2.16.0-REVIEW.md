# 2.16.0 本機交付自查（2026-10-16）

實作者／審查者：同一位 Codex，分兩輪自查，並非獨立人工審查。未發 PR、執行遠端 CI、推送、合併或部署。

固定範圍：base／merge-base `80ed8ec6bd16e43114fc6352e0b3dd79026355a2`，head `a2cae0f5923f6fee59a1f3bce1c1debf8affaa2b`，單一功能提交。後續只加入本驗收文件，程式及 tag 不移動。

## 第一輪：需求符合性

對照使用者最新決策及[播放器規格](specs/UNIFIED-MEDIA-PERSONAL-FRAMES.md)、[回合規格](specs/QUACKS-AUTO-ROUND-RISK-CUES.md)，逐一讀固定差異與已執行證據。

- 符合：播放器整合點播／清單、164px橫條持續播放、24個人風格套整窗，選項直接讀彈幕 catalogue；播放器、右上設定與形象設定共用儲存。核對26頁載入順序，Edge桌機／手機三入口及先選後開均通過。
- 符合：預設位置避開可見header，展開選單提升層級；原生手機可點設定且保留同一iframe。模板內容及可用控制對比至少4.5:1；22藥材書面至少7:1。
- 符合：公開影片可取得真實標題，失敗保留備名；真實oEmbed及隔離HTTP取得名稱，原生可控metadata驗目前項及清單。私人／不可取得影片仍不能保證真名。
- 符合：停手／爆炸不額外接結算聲；後續必要選擇及最終音效維持。白彈在實際7／8／9上限發光，下限／爆炸清除，減少動態停止動畫。
- 符合：全員購物確認後中央顯示下一回合約2秒，再由伺服器推進；不需房主在線，不產生舊between空頁。第九輪維持最終計分、本場結果及九筆紀錄，不開第十輪。殘留占卜／骰場景不遮提示及結果。
- 符合：2.15.2→2.16.0 minor、lock與CHANGELOG一致。舊測試站及遊玩資料保留。

結論：本次已檢查範圍符合上述要求，無未解重大規格問題。真YouTube連播、喇叭聽感、實機觸控未新增驗收，不能以播放器fixture代替。

## 第二輪：邏輯、安全與回歸

同一組base／head；讀quacks command／endRound／auto／view、scheduler、PartyRoom去重、Fx佇列、外觀及table-media生命週期、metadata HTTP呼叫端。

- 全員ready屏障保留；2000ms前不推輪，400ms scheduler到期只推一次。提示期間next／draw-fortune拒絕；requestId去重，換輪後舊roundId拒絕；舊輪ack不混入新輪。第九輪最終計分分支先於提示返回。
- 外觀僅localStorage，不送媒體控制，不改他人／彈幕偏好；切風格和最小化維持同一iframe。隱藏風格延後量色、未知值回預設、storage受限仍可選。
- metadata固定YouTube oEmbed、11字ID、redirect:error、32KB、2秒、32pending／256cache，失敗15秒TTL。查詢後auth、房間物件、踢人、席位、控制權及revision沿用既有重驗，沒有新增任意URL抓取或弱化權限。
- staged69檔無work／本機記憶／DB／私人runtime；常見私鑰及token樣式掃描0項，測試使用合成帳號。掃描不保證識別所有秘密；私人helper及資料未提交。

結論：本次已檢查範圍未發現未解重大邏輯、安全或資料問題。CI未執行，不宣稱遠端通過。

## 驗證與限制

實作階段：Windows Node完整 `node --test tests/*.test.js` 2328／2328，149.36秒；media／metadata／settings focused148／148，回合／音效／Fx／scheduler focused69／69。全套後僅將CSS文字token由未定義st-text修為既有st-ink；Edge明暗×1280／390／320六個呈現fixture及樣式歸屬複驗通過，未因此重跑整套。

Edge原生工具room-media-pot-polish、quacks-round-risk通過：真HTTP完整九輪、第2輪置中提示、第9輪桌機及390px重整顯示結果；三個外觀入口、24模板、清單捲動及最小化保留iframe。choice-media-fit既有回歸通過：選幣先於選藥、愚人草圖示、特效藥置中無內層卷軸、溢出盆連續更新及免費女巫。

固定head前修正：手機選單被媒體攔截、快速操作時舊骰遮住回合字樣；均以原生及回歸複驗。HTTP時間差及隨機占卜必要選擇由驗證工具正確處理，未把工具誤差稱為產品缺陷。

審查階段重驗：固定diff、26頁載入順序、metadata回應後權限及去重路徑、版本minor、樣式歸屬、diff格式與私有檔排除。沒有新增未解finding。

本機預覽：[3028](http://alchemy.localhost:3028/quacks/83B358)，API2.16.0，受影響JS資源HTTP200且與本機位元相同；3027及更早測試站保留。圖片及log在ignored work/qa、work/playtest，不附DB、登入資訊或私人偏好。

## 發布前整合 main 複查（候選2.16.1）

本節取代上方「尚未整合#133–135」的舊base／head及候選版號描述；歷史v2.16.0標記不移動，新2.16.1尚未建立tag，須依新規範等同head雙平台CI完成。

固定base／merge-base：cb890c969e2d208c3a5378c578f91bd36cd5ee28；固定head：1ab2b85bca12011bedf4596229eb4f5d124eae58。merge保留main的登入圖片、縮圖白名單、製作團隊、受影響選取、exact-head CI及輕量配額fixture；只解決版號／CHANGELOG及角色紀錄的追加衝突。程式自動合併區塊另讀，後續只追加本證據文件。

第一輪（規格）：核對完整分支相對新main差異、房間管理升降／踢人、100%布局、藥材與溢出盆、免費女巫、播放器整窗／三入口／橫條、兩秒換輪及九輪最終結果；沿用未受main改動影響的既有原生證據，整合後再跑room-media-pot-polish，桌機暗色及手機亮色、320窄版、24模板與全部三入口通過。登入頁相對新main僅追加共用appearance script，新圖及credits保留。版本minor對新main通過，未發現未解重大規格問題。

第二輪（風險）：重新讀合併的app資源白名單、metadata呼叫端、room-controls狀態還原與管理槽、quacks最後一輪／auto／receipt、scheduler及測試fixture；main的三種purpose仍跑九輪且舊round-intro等待保留。掃描完整PR差異常見token／私鑰樣式0項，私人work／記憶不在提交中；沒有放寬資料或管理權限，未發現未解重大問題。這是同一位實作者兩輪自查，不代表獨立人工審查。

本機實際node tools/test-affected.cjs --base origin/main因共用來源回退236／236檔，Windows Node24完整2347／2347，fail／cancel／skip 0，204899.0677ms；全套後僅升2.16.1版號／lock／CHANGELOG，另node --test tests/release.test.js 5／5及minor／樣式／diff檢查通過，未重跑相同整套。原生整合工具無pageerror，影響路徑可見且同iframe未重建。

目前未推送或建立PR，沒有此head的Linux／Windows CI。之後先請使用者確認建立Draft，不能將本機結果當作同head雙平台CI，亦不將舊候選標記移到新程式。沒有合併本功能分支或部署。
