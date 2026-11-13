# 三天登入進度條（#405）

2026-11-13 使用者要求史詩十連抽券也顯示累積三天進度，與七天傳說單抽券一致。

LoginRewards三天區塊沿用login-reward-progress的grid／間距／主色進度條，value與文字都以Math.min(visits,3)封頂，max為3；新增「史詩十連抽券登入進度」可及性名稱。沿現有顯示條件、領券狀態與抽卡機使用流程，沒有改登入計數或領獎規則。

51842隔離站的123實際累積兩天，已打開登入獎勵確認2／3及黃色約三分之二、value=2/max=3；既有七天仍為2／7。已領取今日每日獎勵的狀態保留，沒有為驗收增加登入天數。證據work/login-three-progress/proof.png；未另實測滿三天帳號。

本次追加於#403紫藍箭柄完整回歸執行期間；根目錄測試檔及伺服器程式未再變動。affected-selection重新確認選取同一286檔，沿用該輪完整執行，新增UI後重新跑前端347項、型別／Vite及UI檢查；最終結果見交付紀錄，不把單純--list當成執行通過。

尚未PR／CI／合併／部署。

2026-11-13 本輪最終：完整affected同一286檔2451過／0敗／1缺ffmpeg略（622秒），紀錄work/missile-violet/root.log；新增三天進度UI後前端347、型別／Vite／格式／UI／素材效能／minor release／diff check通過，記錄work/login-three-progress。紫藍箭柄與進度條均已更新51842；未PR／CI／合併／部署。
