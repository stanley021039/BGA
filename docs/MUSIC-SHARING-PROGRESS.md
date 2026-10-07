# 上傳歌曲供全桌選用

2026-10-07，正式 **v1.6.0**／`74372ed`，取代v1.5.8。使用者要求上傳歌曲後大家都可選擇播放。原歌庫列表與影音資源本來就供登入會員共用，房間選歌則被前端disabled及後端HOST_ONLY阻擋；本輪開放同房有效玩家選曲，保留個人音量及收聽偏好。

| 範圍 | 最終契約 |
| --- | --- |
| 上傳與歌庫 | MP3／M4A／OGG，上傳後所有登入會員可查列表及個人試聽；20MB／首、20首／人、全庫500首及檔案驗證保留。 |
| 房间選曲 | 五款遊戲同房有效座位可POST `room-music` 的select，包含他人上傳歌曲；立即從0開始全桌播放並沿既有SSE發布，其他房間不變。未登入、未入座、離房、被踢仍拒絕。 |
| 操作邊界 | 大家可選歌；非房主在歌曲暫停／结束時按「開始」，以select當前track重新播放。暫停、停止、跳轉、上一首／下一首、循環等原指令仍房主控制。刪歌僅上傳者或管理員。 |
| 個人體驗 | 右上角設定開關／音量只影響自己；選歌或開始為明確收聽手勢，個人關閉不送全桌pause。YouTube控制契約沿用既有規則。 |
| 清單更新 | 每次明確展開媒體面板讀一次共用歌庫，及既有重新整理按鈕；移除10秒展開快取等待，沒有新增歌庫輪詢。request序號及roomEpoch排除晚回覆覆蓋新清單／已離房介面。 |
| 持久化 | 音樂仍使用既有music_tracks＋持久音檔，schema15不變，沒有改媒體格式或DB migration。 |

## 驗證進度

後端6項及共用聲音前端16項，合計 **22/22** 通過。新後端跨五遊戲驗另一會員上傳→非房主選曲→三席track／playing／version一致、其他房間隔離、8類其他指令拒絕且version不變；未登入／非同房／離房／被踢及刪除權限保留，既有SSE／range仍通過。前端新增5項驗picker與pending、guest重播同曲、transport guard、每次展開取新清單、過時回覆及離房隔離。證據 `work/music-sharing-focused-tests.log`。

背景Chrome以隔離localhost3226三帳戶：alignment_guest在收藏庫真選檔上傳原創合成靜音MP3（4,170,000 bytes，瀏覽器讀260.625秒），alignment_peer以另一登入來源選同曲成功；實際Audio readyState4、mediaError=null，currentTime由0.0176前進至14.8557秒。同桌第三席可讀相同track／playing／version；個人關閉後Audio paused=true，全桌仍playing=true。房主API暫停後，非房主真UI按「開始」再次從0播放，版本1→2→3。沒有把無聲測試當成實體喇叭／主觀聽感驗證；實際瀏覽器檔案本輪測MP3，其他格式沿既有檢查。私人證據 `work/music-sharing-local-verification.json`。

Windows Node24.14.0全套 **896/896**（30522.5946ms，fail／cancel／skip0），證據 `work/music-sharing-windows-tests.log`。隔離測試最後Audio readyState4／paused=false／currentTime113.9456／mediaError=null；三席全桌version3一致，console error0。自己的兩個tab及local server已關閉，沒有提高Chrome視窗或改使用者正式站登入。Linux Node22.22.1乾淨Git archive全套 **896/896**（151029.066233ms，fail／cancel／skip0），證據 `work/music-sharing-linux-tests.log`。本輪沒有新增PR或push。

## 正式發布與公開驗收

受測程式及不可覆寫本地 annotated tag `v1.6.0` 為 `74372ed904d69e83502b614fbda7694ce760e5d4`；archive SHA-256 `27ff74ca1ac8e194d254b1144620f4cd2a1f78e83eb69893ce072c6277631607`。release:check基於v1.5.8驗minor通過；schema15不變，私人檔案、work及env未封存。

新鮮備份 `/home/ccc/apps/afterhours/shared/backups/pre-music-sharing-fixes-74372ed-20261006T202616Z-f8c63ab5-74a1-420d-82e4-8c49226079dd`：SQLite一致性線上備份，持久檔與env另備，非跨檔原子冷快照。副本隔離啟動前後21表schema／rows／BLOB一致，8帳戶全欄位保留。0房間切換至 `releases/74372ed`；核對80949後SIGTERM，既有服務重啟至83301，service／tunnel active。env／原資料路徑不變、integrity ok／FK0，外站匯入資料代未啟用。

公開v1.6.0及collection／music HTML與共用table-music JS共3份內容／MIME／no-store比對通過。Chrome以兩個僅loopback代理綁已存在的合成會員，不改真正shhuang.cc的使用者登入；請求及音樂串流使用公開正式站。初次fixture因驗收轉接漏允許reconnect而未進桌，等待後過期；修正轉接並確認原fixture404後只重建自己的等待桌，以測試presence維持，再執行以下完整驗收。這是私有QA輔助程式修正，没有改遊戲程式或重建tag。

| 正式驗收 | 實際證據 |
| --- | --- |
| 上傳與新清單 | 動畫測試2在收藏庫真file chooser＋POST上傳合成靜音MP3，4,170,000 bytes、260.625秒；先開空歌庫的動畫測試3收合／展開後即見新曲，非房主picker enabled。 |
| 非上傳者選播 | 動畫測試3真selectOption後立即播放；Audio readyState4、paused=false、currentTime0.0650、mediaError=null。三席track／playing／version1一致，角色旗標為房主true、另外兩席false。 |
| 兩位收聽 | 上傳者用自己的聲音設定開啟收聽，兩位Audio都readyState4／paused=false／error=null；一次讀值73.9038／73.8918秒。只代表這次觀察，不承諾持續逐幀同步。 |
| 權限 | 非房主pause403／HOST_ONLY，非上傳者刪除403；曲目／playing／version仍不變。 |
| 成果 | `work/music-sharing-public-verification.json`、`music-sharing-public-browser.json`及`music-sharing-public-final.jpg`；两tab console error0。 |

測試歌曲及自己的三席正常離房、三個session登出；原歌庫列表相同、rooms0。兩個proxy／測試presence／tab已關閉，臨時viewport及兩來源聲音偏好已還原。最後20非session表所有rows／BLOB與新鮮備份相同、21表schema與8帳戶全欄位保留；session因3次QA登入／登出146→149，不宣稱session逐列不變。證據 `work/music-sharing-final-data-check.json`，PID83301正常。沒有其他曲目／帳戶匯入或新PR；後續純驗收文件不移動受測tag。
