# 雷霆之路研究與實作

查閱日期 2026-09-13。主規則已下載並讀取全文，圖解已檢視。遊戲內來源與差異列於 `/rules`，此檔保留開發對應。

官方主規則：https://restorationgames.com/wp-content/uploads/2023/12/Thunder-Road-Vendetta-Base-Game-Rulebook.pdf

pp.4–5 起始骰及三路板；p.6 車型損傷；p.7 危險和地形；p.8 指令；p.9 移動／公路加速／碰撞重擲；p.10 射擊骰；p.11 輪替與終點；p.12 損傷。

官方主遊戲／圖片：https://restorationgames.com/shop/thunder-road-vendetta-base/

中文套組：https://www.zeczec.com/projects/ThunderRoadVendetta

擴充種類：https://restorationgames.com/shop/maximum-chrome/

Extra Ammo：https://restorationgames.com/wp-content/uploads/2023/08/MaximumChromeRulebook-8-pages.pdf

Carnival：https://restorationgames.com/wp-content/uploads/2024/11/TRV-CoC-Rulebook.pdf

TTS 官方舊試玩：https://steamcommunity.com/sharedfiles/filedetails/?id=2730625211 （已移除狀態，並非完整零售資產庫。）

骰面配比另查：https://gatheringgames.co.uk/products/thunder-road-vendetta

## 素材來源

- `public/assets/thunder-components.png`: https://restorationgames.com/wp-content/uploads/2023/08/TRV-PDP-Gallery-2.png
- `public/assets/thunder-box.png`: https://restorationgames.com/wp-content/uploads/2023/08/TRV-PDP-Gallery-1.png
- 圖像來源為官方產品頁，未宣稱取得再授權。完整繁中卡圖未找到可驗證的公開素材包。
- 車輛 SVG、指令與棋盤皆自行繪製的功能性圖形。

## 非原版一致處

自製 5 組雙面賽道；hazard/damage 配比未確定，採 /rules 列明測試配比；先占傷害槽再處理效果的極端連鎖時序差異；超時 90 秒代操作；不含擴充。

## 2026-09-13 校正與擴充試玩更新（取代上方舊實作差異敘述）

以使用者兩份 PDF 校正，細節與缺件見[缺少的素材](MISSING-MATERIALS.md)。
傷害現在使用 pendingDamage 保留槽位容量，效果結束才填入 damage 與判定失能；容量保護仍是數位約定。
已修正暈眩遇到新揭露泥地的消耗，以及連鎖位移的過期碰撞事件。
惡魔賽道由房主在等待畫面選擇：5 組自製双面道路，新增五種地形、六種危險、燃燒與起火傷害。
試玩 fire die = [1,1,2,2,out,eliminate]，未核實實體配比；追加危險 glass/ramp/fire/pit 各4、quake/worm各3，追加起火傷害2。未實作21張持續效果卡，不加入其損傷標記。
PDF圖片仍只在 reference-assets，未套入 public。功能圖形仍為自繪。
