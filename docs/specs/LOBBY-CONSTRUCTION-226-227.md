# 大廳共用施工圖 #226／#227

2026-10-24 使用者要求大廳 CEO 與運動員改用 Stitch 共用施工圖。沿用兩張原票及原分支，Figma 依使用者先前指示暫緩。本筆僅取代兩款大廳卡面，遊戲內原版素材、試玩功能及其他遊戲保留。

## 來源與交付

Stitch 專案 [Board Game Under Construction Graphic](https://stitch.withgoogle.com/projects/4026995668562359011)，畫面 `Under Construction Board Game Illustration`。實際產出800×500 SVG，畫布把編碼當成文字；從可見輸出解碼取得原稿後在Edge渲染檢視，沒有把文字預覽當成完成插圖。原稿保存於 `docs/design/sources/lobby-construction-stitch.svg`，SHA256 `c3773d65b53c3f8f088e548bb812b9a0451bcb1e86d0125ce570d1e6630288b8`。安全帽、路障、交通錐、卡牌、骰子及「施工中」都是Stitch原稿，沒有另行重畫；無外部媒體、腳本或動畫。

Edge渲染後以WebP品質85壓縮，執行期只匯入 `frontend/src/assets/lobby/construction-{400,800}.webp`：

| 尺寸 | bytes | SHA256 |
| --- | ---: | --- |
| 400×250 | 8106 | f7ab613498b9a5f12a4718b143c2014709276c25aaf52ed38c294952583747c0 |
| 800×500 | 18688 | 0c90ae839e82c1a36b02f45d4ee3b5cd2c888d2a8c768be7b4fbf99e3f0589e4 |

共26794bytes，遠低於每張256KiB上限。共用srcset、lazy／async、Vite hash URL；不預載原稿、不新增timer。兩款catalog使用construction，移除大廳的運動員hero匯入。

## 驗證與界線

真Edge：1920×1080／390×844／320×844、深淺色各選取兩款，共12組，圖片成功解碼、同一URL、alt施工中、方向鍵／選取正常，沒有橫向溢出或JS錯誤。已實際看桌機及兩種手機截圖。390px DPR1／2冷暖載4組：冷載transferSize8406／18988bytes，暖載0bytes；400／800圖選取正確，回應一年immutable，沒有用304冒充immutable命中。證據在本機ignored `work/second-wind-227/construction-{results,cache-results}.json`及PNG。

前端125/125、型別／正式build、相對main的UI檢查、build效能與release check通過；完整test:affected因核心／未知路徑回退258檔，2373/2373通過（754449.608ms，無失敗／取消／略過），證據在construction-affected.log。格式及format:check通過。未驗實體手機；目前2.44.0人工驗收候選，未PR／CI／合併／部署。
