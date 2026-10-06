# 舊版原始資料匯入相容性

2026-10-07最新正式v1.5.5／`18d21ae`／PID73168、schema15／8帳戶；畫猜倒數可見度已修正，仍未啟用外站匯入，原來源ZIP／shadow及待選取代／合併範圍不變。後續不得用下方v1.5.3或v1.5.2的code／PID做guard；需重新盤點，完整新證據見 [倒數發布](DRAW-TIMER-VISIBILITY-PROGRESS.md)。

2026-10-07最新現況：正式共用UI修正v1.5.3／`0609c01`／PID68975、schema15／8帳戶；沒有啟用外站匯入，來源ZIP、shadow及待選取代／合併範圍不變。下一次匯入須以最新程式、房間、帳戶與設定重新盤點；下方v1.5.2及更早現況為歷史，詳 [最新正式證據](SHARED-UI-ALIGNMENT-PROGRESS.md)。

2026-10-07最新正式為v1.5.2／`7939090`／PID66841，PR43兩項審查修正已同步，原schema15／8帳戶保留，沒有啟用外站匯入。以下v1.5.1及更早盤點為歷史；後續遷移须重新盤點。來源ZIP、shadow與待選取代／合併範圍不變，證據見 [最新正式同步](PR43-PRODUCTION-FIX-PROGRESS.md)。

2026-10-07現況更新：畫猜排版與聊天室修正已隨v1.5.1／`d4e3b4a`上線，現站為schema15／8帳戶；這次只升級現有資料，没有啟用外站資料代。原來源3帳戶與49logs的匯入預演、ZIP／金鑰與shadow目錄仍保留，取代或合併仍待選擇。後續匯入先重查正式code／PID／設定與帳戶；不要使用下方歷史v1.3.0／7帳戶盤點當成當前現況，亦不要為匯入把已修正版面倒退到v1.5.0。最新正式證據見 [畫猜修正](DRAW-DESKTOP-LAYOUT-PROGRESS.md)。

2026-10-06，候選v1.5.0，受測程式及本地annotated tag固定於 `723fbe4eebb4cacf9170d8e2706fdc258a7e4fcf`。本地分支 `fix/legacy-community-import`，未push／PR，不改已發PR #43的受測程式／tag。匯入工具新增嚴格舊版community頭像與GitHub對應檔保存，並可明確保留啟動時已有的session logs；詳細契約見 [操作指南](SERVER-DATA-TRANSFER.md)。

來源原始ZIP唯讀安全檢查：81 entries、77個持久檔及80行checksum一致；schema12、14表、integrity ok／FK0，3帳戶、1作品、2音樂、5留言板issue，49歷史logs／16對局meta（11完成、5中斷，無playing）。33個無meta session首列均符合保留判準，最大95bytes；5 PNG及GitHub對應附件完整。來源只宣稱複製期間排除寫入，沒有独立驗證其自動重啟設定；校驗與引用一致不等於整體原子快照證明。

正式站目前v1.3.0／schema14、7帳戶及7作品；已做線上SQLite一致性備份，不把它當作完整冷備份。完整替換或兩站合併的範圍仍待使用者回覆；未停止、重啟或替換正式資料。來源ZIP保留，副本／私有報告／帳戶資料及金鑰僅在ignored work；不把原資料或機密放進Git。

聚焦測試：舊附件移轉／管理UI **97/97**、歷史保留與設定傳遞 **35/35**。Windows Node24.14.0完整 **834/834**（52399.9127ms）、Linux Node22.22.1完整 **834/834**（149522.989511ms），失敗／取消／跳過0；minor版號檢查通過。新程式封存SHA-256 `97ccb2321e21f849e86b330571435cb68aa0eff72eebf414b82094eb0fa9bdb9`，只含Git來源，沒有本機資料或偏好。

實際來源分別在本機及正式主機的隔離資料代完成export→verify→dry-run→apply→first boot→close；只發布新shadow目錄，沒有改正式設定或流量。兩端升schema15、3帳戶／1作品／2音樂／49logs／16對局meta／5PNG／5GitHub對應項皆保留；啟動前後全部外部資料檔digest不變，users全欄位與既有BLOB digest不變。來源3sessions／7invites／2password resets只在還原副本撤銷，外部副作用false；沒有原密碼，未冒稱逐帳戶實際登入已驗。private證據 `work/import-local-preflight.json`、`work/import-remote-preflight.json`、雙平台logs及raw ZIP稽核報告不提交Git。

來源與現站有一個同名但UUID不同的帳戶；完整取代或合併仍待使用者選擇，未切換正式資料。原始ZIP保留且已有雜湊驗證，金鑰另保存在核准私有位置。下一步需收到範圍選擇後做正式完整冷備份，再套用已驗證資料代與相容程式。
