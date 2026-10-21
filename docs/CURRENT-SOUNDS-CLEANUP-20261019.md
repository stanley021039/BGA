# 現行音效與新框調整驗收

已刪除7個被取代網站音檔與靜態路由：correct.wav、incorrect.wav、quacks-potion.wav、quacks-potion-synth.wav、quacks-ingredient.wav、quacks-stop-user.wav、quacks-draw.wav。舊抽藥／喝藥事件別名仍可導向現行錄音，未改遊戲事件順序。移除舊錯誤音效產生器並更新建置產生器，避免重新產生舊檔。

試聽頁與ZIP僅含28個現行檔案；每個實際HTTP 200，7個舊路由404，ZIP CRC通過。

猜歌測試桌FE4636已直接登入、2 AI入座，127.0.0.1:3050。

12新成就框各自底色、右上外露主物件；桌面／390px預覽通過，兩端漸層文字最低對比7.51:1。

最終test:affected回退全套2486/2486通過，197.46秒，沒有失敗／略過／取消；詳work/current-sounds-colors-verified.log。
