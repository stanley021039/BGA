# #304 第一輪：規格符合性審查

2026-10-27，Codex 自行直接閱讀差異、呼叫端與測試；與第二輪分開進行。

- Base／merge-base：`a5222069f12221fba14125c63949b2fcef640121`。
- 受審 head：`88045bb3af0324c41fa2ce54809ce90374bb1ce0`。
- 範圍：上述 base..head 三個提交；依 [通知契約](../specs/INVITATION-SOUND-304.md) 與 Issue #304 四項驗收條件，未擴充跨分頁領播。

## 逐項結論

1. 符合：新邀請採納成功快照後播放既有短音，同批合併一聲。`invitations.ts` 的世代檢查先於 `sound.observe`；`invitation-sound.ts` 沿用效果音偏好。真 API 新邀請及原生 Audio playing 已於實作階段驗證。
2. 符合：邀請仍顯示且接受／婉拒可操作。`InvitationInbox.vue` 保持四個直接 grid 子節點，提示在介紹區內，使用既有 StatusSlot／UiButton；實際接受產生席位、婉拒移除，桌機／手機深淺色四組控制項均可操作且在視窗內。
3. 符合：同一邀請以 ID 去重，輪詢、排序、移除再出現、重整與開關對話框不重播；本分頁按帳號保存最多 256 筆。儲存失敗降級為文件內去重，並未宣稱儲存受限時仍能跨重載記憶。
4. 符合：真 NotAllowedError 後有可讀入口提示及明確啟用按鈕；點擊下原生播放成功。失敗不阻止處理邀請，也沒有自動重試或打開對話框。

邊界符合：靜音、零音量、hidden、聲道飽和不排隊；切背景、pagehide、換帳號與卸載停止。沿用全站四聲道，通知不占桌遊兩聲道。候選 minor 3.10.0 與 CHANGELOG 一致，整合 main 的 3.9.1 桌機面板設定未遺失。

## 證據與限制

實作階段 Windows Node 24.22.1：完整 affected 保守回退 246 檔，2093 通過／0 失敗／1 缺 ffmpeg 略過；前端 225、音效及邀請 focused 21、新服務／store 5 通過；型別、正式建置與效能預算通過。命令、隔離 Edge 證據及未驗限制詳 [交付紀錄](../INVITATION-SOUND-304-PROGRESS.md)。受測產品提交 `f72bde03c89e548470fec048aabeb27b818f7ef1` 至受審 head 的 src／frontend／tests／tools／package／lock 差異為空，後者僅補記文件。

本輪另讀實作與測試並複核 base 指定的 UI ratchet、minor release check、git diff --check；未重跑內容相同的完整套件。使用者「可以pr了」視為接受本機交付並要求發布準備，不聲稱使用者親自逐項測試。沒有實體喇叭聽感、實體手機觸控或完整 OS／BFCache 實機結論；Linux CI 尚未啟動。

本次已檢查範圍未發現問題，無待修 finding。本報告及第二輪紀錄只增加文件；發布前比較最終候選與上述 head，產品樹相同才保留結論，最終 SHA 在 PR 描述記錄。新 Draft PR 尚須本次具體確認；未轉 Ready、合併或部署。
