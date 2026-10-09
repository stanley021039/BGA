'use strict';
// Original situation prompts: independent from draw-guess votes, custom words and IDs.
const groups={
 everyday:['貓咪偷吃生日蛋糕','雨天騎腳踏車上班','公車上睡著的乘客','狗狗叼走拖鞋','廚師把鍋子當帽子','在月亮上野餐','企鵝排隊買冰淇淋','消防員救下樹上的貓','戴墨鏡的雪人','在海邊放風箏','機器人種一朵花','太空人煮珍珠奶茶','兔子搬家','大象撐小雨傘','鴨子指揮交通','恐龍刷牙','海盜找到空寶箱','郵差騎蝸牛送信','熊貓搭熱氣球','魚在浴缸釣魚'],
 silly:['香蕉參加選美','吐司穿鞋跑步','章魚同時打八通電話','仙人掌想要擁抱','鬧鐘放假睡過頭','月亮吃掉一片披薩','吸塵器追著幽靈跑','雨傘怕淋雨','雪人泡溫泉','冰箱偷偷跳舞','獨角獸塞車','吉他在唱卡拉 OK','青蛙教恐龍跳舞','魔術師變出一隻自己','風車吹頭髮','拖鞋搭飛機','機器人在充電站約會','貓咪開壽司店','雲朵打噴嚏','小熊把星星當餅乾']
};
const SOURCES=Object.freeze([{id:'everyday',label:'生活情境'},{id:'silly',label:'奇想情境'}]);
const PROMPTS=Object.freeze(Object.entries(groups).flatMap(([source,texts])=>texts.map((text,i)=>Object.freeze({id:`telephone-${source}-${i+1}`,source,text}))));
module.exports={SOURCES,PROMPTS};
