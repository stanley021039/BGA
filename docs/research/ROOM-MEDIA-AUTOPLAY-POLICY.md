# 共用媒體：Google播放政策查核

2026-10-07，供[整合規格](../specs/UNIFIED-ROOM-MEDIA.md)實作。以下是官方文件與設計對應，不是所有装置的實測播放保證。

| 官方已確認 | 本站處理 |
| --- | --- |
| Chrome可聽autoplay取決於origin互動／desktop engagement等條件，頂層可授權cross-origin iframe；play Promise可能NotAllowedError。[Chrome官方](https://developer.chrome.com/blog/autoplay/) | 入房先接受或拒絕影片；明確操作提供gesture，但不承諾後續所有影片永久解鎖。音樂play拒絕顯示本機啟用，音量／mute仍是個人端。 |
| IFrame API的onAutoplayBlocked沒有data，playVideo等scripted playback會被policy擋；原生player可操作。onError101／150為禁止嵌入，153是缺Referer／client identity。[YouTube API](https://developers.google.com/youtube/iframe_api_reference) | 拒絕不建立iframe／載入Google API。接受後保留allow autoplay、origin／referrer識別、blocked提示與原生控制；錯誤明示可改片或在YouTube觀看，不繞過限制。 |
| 可見embedded viewport至少200×200，官方建議16:9至少480×270。[YouTube尺寸](https://developers.google.com/youtube/iframe_api_reference#Requirements) | 沿用≥210px餘量，視窗拖移／縮放／字級放大clamp；空間不足停止個人影片並提示放大。不以隱藏YouTube iframe做純音樂player。 |
| 播放介面不可遮蔽標準YouTube控制／branding，需維持使用者可操作與可見。[Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) | 自訂共享控制放在原生player外，音樂／影片共用queue及timeline，但不蓋住player、不拆YouTube音軌、不代理／下載影片。 |

影片名稱可由點播人填寫，或後端對驗證後的ID使用固定YouTube oEmbed metadata來源；只取名稱，bounded cache／timeout／size cap，沒有APIkey或進度上報。metadata查詢失败仍可排隊，fallback不代表影片可嵌入。網頁擷取工具本輪未成功读取oEmbed示範URL，不能把它當實測成功；metadata機制需mock回歸及實際環境驗證。

入房提示是個人播放意願，與Google服務條款或瀏覽器系統權限不同；不會修改瀏覽器autoplay政策、不安裝擴充或改flags。若目前沒有影片，只保存本房的選擇；實際player建立後仍監聽blocked/error並提供fallback。拒絕不停止別人的播放，共用進度命令只由房主／房間管理者送出。
