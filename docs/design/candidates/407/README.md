# 八款靜態大廳背景候選稿

Stitch 專案：[Party Game Stage Picker](https://stitch.google.com/projects/16226792553515652128)。八款原生 SVG 是設計稿，尚未加入正式背景獎池；Figma 依使用者先前指示延後匯入。

開啟 `index.html` 可比較八景，點圖查看完整 SVG。原始匯出 HTML 留於本機 `work/stitch-407`；`sources.json` 記錄畫布 ID、原稿與各 SVG 的 SHA256。

1. 櫻花樹
2. 夜色湖面
3. 總統府（台北總統府建築插畫）
4. 火星表面
5. 電影院
6. 浴室＋浴缸
7. 溫泉
8. 戰場

火星使用 R2 畫布 `cfa85176101c41fc8ab9fa44b889db18`，依使用者修正加入深藍紫黑宇宙天空與有坑緣、內壁及坑底的撞擊坑。其他七景保留 R1 畫布 `5cc615a290b045dabe1e9336bf0ae12c` 的實際匯出內容。每張 1600×900、4–11 KiB，無外部圖片、文字、人物、SVG 動畫或腳本。藝廊使用本機 SVG 與 CSS，無外部字型、CDN 或計時器。

## 同批產品修改

3.32.1 以 main `6c3abfdc9f883c0ae02e3a4e8afd7212000f85a8` 為基線。使用者已確認：主大廳與所有遊戲房間全部固定靜態。

- `LobbyBackgroundArt` 移除 stepped animations、閒置計時器、活動／可見性監聽及動態偏好依賴，保留 SVG 漸層 ID 隔離。
- 移除背景動態開關與 store 的動態偏好 API；舊 localStorage 動態設定不再生效。保留個人顯示偏好、伺服器共用選圖及冷卻時間。
- 背景預覽共用同一靜態元件。所有遊戲沿用共用 `RoomBackground` 的靜態底圖；未將角色、招式或遊戲地圖的必要互動改為靜態。
- 更新 UI 與特效效能契約，後續新增背景也必須遵守靜態限制。

## 驗證與限制

- `test:affected --base 6c3abfd…` 因共用元件回退全部 286 檔：2451 通過、0 失敗、1 缺少 ffmpeg 略過，620 秒。
- 前端全部 347 項通過；型別與 Vite build 通過。
- 移除 CSS `!important` 後，受影響 11 項重新通過；UI check、format check、release patch check、素材效能預算通過。未提高任何預算。
- 原生瀏覽器登入隔離試玩站，主大廳極光背景 22 個節點的 computed animationName 全為 none；設定沒有背景動態開關，角色仍顯示正常。
- 真實建立雷霆之路等待室：共用房間背景 animationName 為 none，無背景影片或 SVG 動畫節點。其他遊戲依共用入口與來源檢查，未逐一實玩每種遊戲。
- 八張匯出 SVG 已檢查沒有 script、外部 image、foreignObject、animate、事件屬性或動畫樣式；藝廊八張全部載入，無水平溢出。火星 R2 與整組接觸表已目視檢查。

未 PR、未啟動 CI、未合併或部署；八款新背景仍待使用者設計驗收。
