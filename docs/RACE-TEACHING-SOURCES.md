# race 教學來源一致性

## 權威來源與衍生範圍

`public/race.html` 的 `<script data-teaching-table>` 目前仍是內嵌程式。
本切片只加 check-only 防線，不改 HTML、runtime 載入、遊戲規則或教學 UI；
沒有產生器，也不宣稱整份教學已單一來源。來源變更時仍須人工同步內嵌副本，
再執行本檢查。產生器及手寫 controller 抽取保留給後續獨立切片。

| 區段 | 權威來源 | 現有包裝 |
| --- | --- | --- |
| `TutorialEngine` IIFE 內原始碼 | `src/games/thunder.js` 全檔，含註解與 exports | `learn=1` guard；本地 `module.exports`；`require` 對應 `window.RacePaths` 或教學用 randomInt／遞增 UUID；最後回傳 exports |
| `LessonScenarios` IIFE 內原始碼 | `src/games/tutorial.js` 全檔，含 Node 分支及 browser UI 分支 | 本地 `module.exports`；`require` 回傳 TutorialEngine；最後回傳 exports |
| 後續 `(()=>{`、`const $=s=>document.querySelector(s);`、`const exitHref=` 開頭的教學殼 | `public/race.html` 手寫 | 章節、顯示、timer 與正式 race controller 連接，不在兩份來源的一致性保證內 |

`tools/check-race-teaching.cjs` 明列這些完整 wrapper 字串與殼邊界。
唯一允許的正規化是 CRLF → LF，以支援 Windows checkout；不 trim、
不重排、不刪註解、不改 exports、不忽略空白或任意程式 token。
兩份來源和 wrapper 合成的預期前綴，必須和 HTML 內殼之前的整段字元完全相同。
缺少或重複的 script／殼邊界，以及提早出現的 `</script>` 都會失敗。

不改動 HTML bytes，故保留既有 script／HTML escaping 與載入順序。
未來若引入產生器，仍需另驗 HTML script 終止標籤、字串 escaping 與真瀏覽器流程；
此工具是來源漂移防線，不能代替 XSS 審查、瀏覽器載入或教學行為測試。

## 執行

- `node tools/check-race-teaching.cjs`：只讀三份檔案；一致回傳 0，否則非 0
- `node --test tests/race-teaching-source.test.js`：真實來源、逐一 token 變更、wrapper／export／註解／空白變更、邊界與 CRLF 回歸
- `node --test tests/thunder.test.js tests/tutorial.test.js tests/race-*.test.js`：引擎、scenario 與 race 回歸
- `npm test`：既有 `tests/*.test.js` 自動包含此防線，不新增依賴或改 CI

檢查失敗時，比對診斷中的內嵌行號、兩份權威來源與 wrapper；
修正來源及其對應副本，不應放寬 matcher 或跳過測試來取得通過。

本次為測試／維持相同行為的開發整理，依 `RELEASE-POLICY.md` 保持 1.23.0。
回退僅需 revert 此工具、測試與文件，不涉及 schema、資料或部署。
