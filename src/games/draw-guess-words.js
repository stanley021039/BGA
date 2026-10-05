// The original 120 IDs must remain stable for votes, collections and history.
const additions=require('./draw-guess-additions');
const groups={
 easy:'蘋果|香蕉|西瓜|草莓|鳳梨|麵包|蛋糕|冰淇淋|珍珠奶茶|披薩|漢堡|便當|雨傘|帽子|眼鏡|鞋子|手錶|牙刷|杯子|椅子|桌子|床|枕頭|書包|鉛筆|剪刀|手機|電腦|電視|相機|腳踏車|汽車|公車|火車|飛機|船|貓|狗|兔子|魚',
 medium:'長頸鹿|大象|企鵝|章魚|蝴蝶|蜜蜂|烏龜|恐龍|機器人|太空人|消防員|醫生|廚師|郵差|魔術師|農夫|生日蛋糕|聖誕樹|摩天輪|溜滑梯|盪鞦韆|電梯|紅綠燈|斑馬線|望遠鏡|顯微鏡|指南針|地球儀|熱氣球|潛水艇|火山|瀑布|彩虹|閃電|雪人|沙堡|帳篷|釣魚竿|吉他|鋼琴',
 hard:'變色龍|刺蝟|水母|獨角獸|龍|海盜船|太空船|直升機|挖土機|救護車|消防車|垃圾車|烤麵包機|洗衣機|吸塵器|吹風機|咖啡機|販賣機|旋轉木馬|雲霄飛車|摩天大樓|燈塔|風車|城堡|金字塔|迷宮|滑雪板|衝浪板|保齡球|羽毛球|棒球手套|籃球框|口琴|小提琴|麥克風|錄音機|鬧鐘|沙漏|寶箱|鑰匙'
};
const aliases={
 腳踏車:['自行車','單車'],汽車:['轎車'],公車:['巴士'],火車:['列車'],手機:['行動電話'],電腦:['計算機'],相機:['照相機'],
 珍珠奶茶:['波霸奶茶'],冰淇淋:['冰激凌'],長頸鹿:['麒麟鹿'],企鵝:['企鵝鳥'],章魚:['八爪魚'],消防員:['救火員'],
 紅綠燈:['交通號誌'],熱氣球:['氣球'],雪人:['雪娃娃'],帳篷:['營帳'],變色龍:['避役'],龍:['巨龍'],
 挖土機:['挖掘機'],洗衣機:['洗衣服機'],吸塵器:['掃地機'],雲霄飛車:['過山車'],摩天大樓:['高樓大廈'],
 滑雪板:['雪板'],衝浪板:['浪板'],羽毛球:['羽球'],麥克風:['話筒']
};
const labels={easy:'簡單',medium:'一般',hard:'挑戰'};
const TOPICS=[
 {id:'food',label:'食物飲料'},
 {id:'animals',label:'動物生物'},
 {id:'transport',label:'交通工具'},
 {id:'objects',label:'生活物品'},
 {id:'people',label:'人物職業'},
 {id:'nature',label:'自然奇幻'},
 {id:'places',label:'場所娛樂'},
 {id:'activities',label:'運動音樂'},
 {id:'meme',label:'迷因 Meme'}
];
const topicLabels=Object.fromEntries([...TOPICS,{id:'misc',label:'綜合'}].map(topic=>[topic.id,topic.label]));
const topicWords={
 food:'蘋果|香蕉|西瓜|草莓|鳳梨|麵包|蛋糕|冰淇淋|珍珠奶茶|披薩|漢堡|便當|生日蛋糕',
 animals:'貓|狗|兔子|魚|長頸鹿|大象|企鵝|章魚|蝴蝶|蜜蜂|烏龜|恐龍|變色龍|刺蝟|水母|獨角獸|龍',
 transport:'腳踏車|汽車|公車|火車|飛機|船|熱氣球|潛水艇|海盜船|太空船|直升機|挖土機|救護車|消防車|垃圾車',
 objects:'雨傘|帽子|眼鏡|鞋子|手錶|牙刷|杯子|椅子|桌子|床|枕頭|書包|鉛筆|剪刀|手機|電腦|電視|相機|望遠鏡|顯微鏡|指南針|地球儀|釣魚竿|烤麵包機|洗衣機|吸塵器|吹風機|咖啡機|販賣機|鬧鐘|沙漏|寶箱|鑰匙',
 people:'機器人|太空人|消防員|醫生|廚師|郵差|魔術師|農夫',
 nature:'聖誕樹|火山|瀑布|彩虹|閃電|雪人|風車',
 places:'摩天輪|溜滑梯|盪鞦韆|電梯|紅綠燈|斑馬線|沙堡|帳篷|旋轉木馬|雲霄飛車|摩天大樓|燈塔|城堡|金字塔|迷宮',
 activities:'吉他|鋼琴|滑雪板|衝浪板|保齡球|羽毛球|棒球手套|籃球框|口琴|小提琴|麥克風|錄音機'
};
const topicByTitle=new Map();
for(const [topic,titles] of Object.entries(topicWords))for(const title of titles.split('|')){
 if(topicByTitle.has(title))throw Error('題材重複分類：'+title);
 topicByTitle.set(title,topic);
}
const legacyWords=Object.entries(groups).flatMap(([difficulty,words])=>words.split('|').map((title,index)=>({
 id:`builtin-${difficulty}-${index+1}`,title,aliases:aliases[title]||[],difficulty,category:labels[difficulty],topic:topicByTitle.get(title),topicLabel:topicLabels[topicByTitle.get(title)],custom:false
})));
if(legacyWords.some(word=>!word.topic)||topicByTitle.size!==legacyWords.length)throw Error('原有題目題材分類不完整');
const WORDS=[...legacyWords,...TOPICS.flatMap(({id:topic})=>Object.entries(additions[topic]||{}).flatMap(([difficulty,titles])=>titles.split('|').map((title,index)=>({
 id:`builtin-${topic}-${difficulty}-${index+1}`,title,aliases:additions.memeAliases[title]||[],difficulty,category:labels[difficulty],topic,topicLabel:topicLabels[topic],custom:false,
 ...(topic==='meme'?{memeKind:difficulty==='medium'?'template':'original'}:{})
}))))];
const titleKey=title=>title.normalize('NFKC').toLocaleLowerCase('zh-Hant').trim().replace(/\s+/gu,' ');
if(new Set(WORDS.map(word=>word.id)).size!==WORDS.length||new Set(WORDS.map(word=>titleKey(word.title))).size!==WORDS.length)throw Error('內建題目重複');
if(WORDS.some(word=>!word.topic||!word.title||[...word.title].length>24||!labels[word.difficulty]))throw Error('內建題目格式不正確');
module.exports={WORDS,labels,TOPICS,topicLabels};
