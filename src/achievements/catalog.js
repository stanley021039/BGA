const rows=[
 ['gift-first-gift','gift','第一份心意','完成一輪送禮與喜好標記，並等到該輪正式揭曉。','gift.completed-participation','gift','intro'],
 ['majority-first-vote','majority','第一次舉牌','提交至少一題答案，並等到該題正式揭曉；不需要猜中多數。','majority.completed-answer','users','intro'],
 ['poker-first-hand','poker','第一手牌','完成一手牌局，且本人作過至少一次合法決策；不必跟到攤牌或獲勝。','poker.completed-human-decision','cards','intro'],
 ['thunder-first-drive','thunder','公路初航','完成至少一個有本人操作的回合，並等到比賽正常結束。','thunder.completed-human-turn','car','intro'],
 ['all-first-table','all','第一桌','在任一遊戲首次完成有本人操作的正式遊玩單位。','all.first-effective-unit','table','exploration'],
 ['draw-first-round','draw','畫猜初登場','完成一次正常揭曉的畫猜輪次，並有本人合法作畫或猜測。','draw.completed-participation','edit','intro'],
 ['draw-soul-artist','draw','靈魂畫手，有人懂','本人合法作畫的輪次正常揭曉，且至少一位其他玩家合法猜中。','draw.artist-understood','edit','fun'],
 ['draw-first-correct','draw','字幕組準時上班','合法猜中題目，並等到該輪正常揭曉。','draw.completed-correct-guess','check','fun'],
 ['gift-coincidental-twins','gift','心意撞車','正式完成收禮確認的輪次中，收到至少兩份相同禮物。','gift.received-twin-gifts','gift','fun'],
 ['gift-wishlist-echo','gift','願望清單有回音','正式完成收禮確認的輪次中，收到符合自己正向心願的禮物。','gift.positive-wish','check','fun'],
 ['majority-one-channel','majority','同頻不用 Wi-Fi','至少三位有效參與者正常完成作答，且所有答案在同一組。','majority.all-same','users','fun'],
 ['majority-tied-signals','majority','訊號撞成平手','正常揭曉時至少兩組並列最多人，且每組至少兩人；本人有有效答案。','majority.tied-largest','users','fun'],
 ['all-two-tables','all','跨桌搬零食','以有效操作完成兩種不同遊戲的正式遊玩單位。','all.two-game-types','table','exploration'],
];
const definitions=Object.freeze(rows.map(([id,game,title,description,condition_key,icon_key,category])=>Object.freeze({id,achievement_id:id,game,title,description,rule_version:1,condition_key,icon_key,visibility:'private',status:'enabled',category})));
module.exports={definitions};
