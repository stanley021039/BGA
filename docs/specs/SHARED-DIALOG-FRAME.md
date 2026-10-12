# 共用 dialog frame 候選

2026-10-12：使用者要求dialog包含header／content／footer，footer按鈕靠右下。候選提供GameUI.frameDialog(existingDialog)與GameUI.createDialog({title,titleId,className,content,actions})；content、actions採DOM nodes，不接受未信任HTML字串。frameDialog只搬移直接子標題與action row，保留原dialog、節點與事件handler，重複呼叫不重建。

共用ui-dialog-layout採header、可捲動content、footer三列。footer靠右、12px gap且可換行，原生showModal／Escape、focus return、pending禁止關閉及離房錯誤流程保持。已套統一RoomControls及GameShell舊fallback離房確認；複雜表單與iframe dialog未自動遷移，不宣稱全站dialog已改完。

本文件最初記錄隔離測試站的實作驗收；最終完整測試、審查與發布狀態見本批驗收紀錄。


## 全站 dialog 統一（本輪補充）

GameUI 會為現有與之後動態加入的原生 dialog 套用同一個 header / content / footer 結構，openDialog 也同步確認模板。影片接受視窗的接受與拒絕按鈕位於 footer 右下角，隱私政策留在 content。

範圍涵蓋房間管理、踢人與被踢通知、遊戲規則、建立房間、題庫、畫作結果、彈幕選擇、股市確認與圖片預覽、角色未儲存提示、擲骰及媒體視窗。內容中的選項、播放控制與局部操作保留在相關內容旁；關閉及視窗確認操作放入 footer。原有節點、ID 與事件保留，明確表單 dialog 操作透過 form 屬性維持提交關聯。媒體視窗沿用原有尺寸、拖曳與縮放功能。

目前僅做桌機與手機基本預覽並更新隔離測試站，未執行 PR 前完整 checklist。


2026-10-13：本批開始完整驗收與固定提交審查，取代先前僅針對性驗證的交付狀態；實作範圍與未驗限制保留。最新測試／審查／CI 結果見 [本批驗收](../ROOM-UI-TIMED-PASSING-PROGRESS.md) 與 PR。
