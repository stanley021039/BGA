'use strict';
// Researched 2026-10-09. Facts paraphrased; no commercial cards or images.
const sources={
 optics:['Met Office：大氣光學','https://weather.metoffice.gov.uk/learn-about/weather/optical-effects'],
 clouds:['Met Office：特殊雲形','https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/clouds/unusual-cloud-formations'],
 faces:['NASA：Pareidolia','https://www.nasa.gov/image-article/pareidolia-seeing-shapes-cosmos/'],
 axolotl:['Natural History Museum：Axolotls','https://www.nhm.ac.uk/discover/axolotls-amphibians-that-never-grow-up.html'],
 bears:['Natural History Museum：極端環境生命','https://www.nhm.ac.uk/discover/life-in-earths-most-extreme-environments.html'],
 lagrange:['NASA：Lagrange Points','https://science.nasa.gov/solar-system/resources/faq/what-are-lagrange-points/'],
 snow:['NOAA：Marine snow','https://oceanservice.noaa.gov/facts/marinesnow.html'],
 light:['NOAA：Bioluminescence','https://oceanservice.noaa.gov/facts/biolum.html'],
 squid:['NOAA：Vampire squid','https://oceanservice.noaa.gov/facts/vampire-squid-fish.html'],
 glory:['WMO：Glory','https://cloudatlas.wmo.int/glory.html']
};
const rows=[
 ['bk01','幻日（Parhelion）',1,'氣象','陽光經過空中的六角冰晶折射，讓太陽旁出現明亮光斑。','optics'],
 ['bk02','海洋雪（Marine snow）',1,'海洋','上層海水的生物殘骸等碎屑往深海下沉，供應深海生物食物，並不是冰雪。','snow'],
 ['bk03','墨西哥鈍口螈（Axolotl）',1,'動物','一種能在保留幼體外形與外鰓時繁殖的蠑螈，通常不經一般蠑螈的變態過程。','axolotl'],
 ['bk04','生物發光（Bioluminescence）',1,'生物','生物透過體內或排出物中的化學反應產生光，可用於溝通、捕食或防禦。','light'],
 ['bk05','水熊蟲的桶狀休眠（Tun）',1,'動物','水熊蟲缺水時可縮成桶狀，大幅降低代謝；再有水時能恢復活動。','bears'],
 ['bk06','布羅肯幽靈（Brocken spectre）',2,'氣象','陽光從觀察者後方照射，把影子投在前方雲霧上，造成巨大人影的視覺效果。','optics'],
 ['bk07','莢狀雲（Lenticular cloud）',2,'氣象','氣流越過山地形成波動，潮濕空氣在上升處凝結，形成像透鏡或飛碟的雲。','clouds'],
 ['bk08','帕雷多利亞（Pareidolia）',2,'心理','人會把模糊或不規則的圖案看成熟悉的形象，例如在雲或天文影像中看見臉。','faces'],
 ['bk09','吸血烏賊（Vampire squid）',2,'動物','深海頭足類，不吸血；會用細長絲狀構造收集海洋雪作為食物。','squid'],
 ['bk10','拉格朗日點（Lagrange point）',2,'天文','兩個大天體系統中的特殊位置，小物體可與它們維持相對位置；共有五個點。','lagrange'],
 ['bk11','珠母雲（Nacreous cloud）',3,'氣象','極區平流層的冰晶雲，在日出前或日落後反射光線，呈現珍珠般彩色光澤。','clouds'],
 ['bk12','夜光雲（Noctilucent cloud）',3,'氣象','中氣層的高空冰晶雲，在地面已進入暮光時仍受陽光照射，因此顯得明亮。','clouds'],
 ['bk13','華（Corona）',3,'氣象','光在雲中小水滴附近發生繞射，形成太陽或月亮周圍的彩色光環。','optics'],
 ['bk14','曙暮光線（Crepuscular rays）',3,'氣象','陽光穿過雲縫，被空氣中粒子散射而形成光束；看似聚合，其實光束近乎平行。','optics'],
 ['bk15','寶光（Glory）',3,'氣象','觀察者在雲霧上自己影子的周圍，看見一圈或多圈彩色光環。','glory']
];
sources.extra0=["NOAA：鯨落","https://oceanservice.noaa.gov/facts/whale-fall.html"];
sources.extra1=["NOAA Ocean Exploration：化學合成","https://oceanexplorer.noaa.gov/ocean-fact/photochemo/"];
sources.extra2=["NOAA：藍碳","https://oceanservice.noaa.gov/facts/bluecarbon.html"];
sources.extra3=["NOAA：鱟的分類","https://oceanservice.noaa.gov/facts/horseshoe-crab.html"];
sources.extra4=["NOAA：海參","https://oceanservice.noaa.gov/facts/seacuke.html"];
sources.extra5=["Met Office：特殊雲形","https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/clouds/unusual-cloud-formations"];
sources.extra6=["Met Office：穿洞雲","https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/clouds/unusual-cloud-formations/fallstreak-hole"];
sources.extra7=["Met Office：Kelvin–Helmholtz 雲","https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/clouds/unusual-cloud-formations/kelvin-helmholtz"];
sources.extra8=["NOAA：馬尾藻海","https://oceanservice.noaa.gov/facts/sargassosea.html"];
sources.extra9=["NOAA：溫鹽環流","https://oceanservice.noaa.gov/education/tutorial_currents/05conveyor1.html"];
sources.extra10=["NASA：宇宙詞彙 Roche limit","https://science.nasa.gov/universe/glossary/"];
sources.extra11=["NASA：宇宙詞彙 Magnetar","https://science.nasa.gov/universe/glossary/"];
sources.extra12=["NASA：宇宙詞彙 Blazar","https://science.nasa.gov/universe/glossary/"];
sources.extra13=["NASA：宇宙詞彙 Black dwarf","https://science.nasa.gov/universe/glossary/"];
sources.extra14=["NASA：宇宙詞彙 Chandrasekhar limit","https://science.nasa.gov/universe/glossary/"];
sources.extra15=["Academy of American Poets：Acrostic","https://poets.org/glossary/acrostic"];
sources.extra16=["Academy of American Poets：Cento","https://poets.org/glossary/cento"];
sources.extra17=["Poetry Foundation：Kenning","https://www.poetryfoundation.org/education/glossary/kenning"];
sources.extra18=["Academy of American Poets：Anaphora","https://poets.org/glossary/anaphora"];
sources.extra19=["Oulipo：Monovocalisme","https://www.oulipo.net/fr/contraintes/monovocalisme"];
sources.extra20=["Oulipo：Lipogramme","https://www.oulipo.net/fr/contraintes/lipogramme"];
sources.extra21=["Academy of American Poets：Abecedarian","https://poets.org/glossary/abecedarian"];
sources.extra22=["Poetry Archive：詩形詞彙","https://poetryarchive.org/glossary/cento/"];
sources.extra23=["Poetry Archive：Pantoum","https://poetryarchive.org/glossary/pantoum/"];
sources.extra24=["Academy of American Poets：Enjambment","https://poets.org/glossary/enjambment"];
sources.extra25=["Oulipo：S+7","https://www.oulipo.net/fr/contraintes/s7"];
sources.extra26=["Oulipo：Contrainte du prisonnier","https://www.oulipo.net/fr/contraintes/contrainte-du-prisonnier"];
sources.extra27=["Oulipo：Boule de neige","https://oulipo.net/fr/contraintes/boule-de-neige"];
sources.extra28=["Academy of American Poets：Sestina","https://poets.org/glossary/sestina"];
sources.extra29=["Academy of American Poets：Villanelle","https://poets.org/glossary/villanelle"];
sources.extra30=["Know Your Meme：Rickroll","https://knowyourmeme.com/memes/rickroll"];
sources.extra31=["Know Your Meme：Doge","https://knowyourmeme.com/memes/doge"];
sources.extra32=["Know Your Meme：Nyan Cat","https://knowyourmeme.com/sensitive/memes/nyan-cat"];
sources.extra33=["Know Your Meme：This Is Fine","https://knowyourmeme.com/memes/this-is-fine"];
sources.extra34=["Know Your Meme：LOLcats","https://knowyourmeme.com/memes/lolcats"];
sources.extra35=["Know Your Meme：Stonks","https://knowyourmeme.com/memes/stonks"];
sources.extra36=["Know Your Meme：Trollface","https://knowyourmeme.com/memes/trollface"];
sources.extra37=["Know Your Meme：Hide the Pain Harold","https://knowyourmeme.com/memes/hide-the-pain-harold"];
sources.extra38=["Know Your Meme：Galaxy Brain","https://knowyourmeme.com/memes/galaxy-brain"];
sources.extra39=["Know Your Meme：Dramatic Chipmunk","https://knowyourmeme.com/memes/dramatic-chipmunk"];
sources.extra40=["Know Your Meme：Loss","https://knowyourmeme.com/memes/loss"];
sources.extra41=["Know Your Meme：Duckroll","https://knowyourmeme.com/memes/duckroll"];
sources.extra42=["Know Your Meme：All Your Base","https://knowyourmeme.com/memes/all-your-base-are-belong-to-us"];
sources.extra43=["Know Your Meme：Keyboard Cat","https://knowyourmeme.com/memes/keyboard-cat"];
sources.extra44=["Know Your Meme：Advice Animals","https://knowyourmeme.com/memes/advice-animals"];
rows.push(
 ["bk16","鯨落（Whale fall）",1,"海洋","鯨魚屍體沉到海床後，提供食物與養分，支撐一群深海生物。","extra0"],
 ["bk17","化學合成（Chemosynthesis）",1,"生物","某些微生物用化學反應的能量製造有機物，不需陽光；深海熱泉食物網靠它供能。","extra1"],
 ["bk18","藍碳（Blue carbon）",1,"海洋","海洋與沿海生態系捕捉及儲存的碳，例如紅樹林、鹽沼與海草床中的碳。","extra2"],
 ["bk19","鱟（Horseshoe crab）",1,"動物","名字雖叫馬蹄蟹，分類卻不是螃蟹，與蜘蛛和蠍子較接近。","extra3"],
 ["bk20","海參（Sea cucumber）",1,"動物","不是蔬菜，而是與海星、海膽同屬棘皮動物的海洋動物，會處理海床碎屑。","extra4"],
 ["bk21","雨幡（Virga）",2,"氣象","雲底垂下的降水條紋，雨滴或冰晶在到達地面前已蒸發或昇華。","extra5"],
 ["bk22","穿洞雲（Fallstreak hole）",2,"氣象","雲層中部分過冷水滴結成冰晶並落下，周圍水滴蒸發，留下像被打穿的缺口。","extra6"],
 ["bk23","開爾文－亥姆霍茲雲（Kelvin–Helmholtz cloud）",2,"氣象","不同高度氣流速度有差異，形成像海浪捲起的雲朵波峰。","extra7"],
 ["bk24","馬尾藻海（Sargasso Sea）",2,"海洋","北大西洋的一片海域，以環繞它的洋流作邊界，而不是由陸地圈出邊界。","extra8"],
 ["bk25","溫鹽環流（Thermohaline circulation）",2,"海洋","溫度和鹽度造成海水密度差，驅動深層海水流動，形成大尺度海洋循環。","extra9"],
 ["bk26","洛希極限（Roche limit）",3,"天文","衛星靠近大天體時，可能被潮汐力拉散的距離界線。","extra10"],
 ["bk27","磁星（Magnetar）",3,"天文","磁場異常強大的中子星。","extra11"],
 ["bk28","耀變體（Blazar）",3,"天文","活躍星系核心的一類，其噴流幾乎朝向觀察者，因此顯得特別明亮且變化劇烈。","extra12"],
 ["bk29","黑矮星（Black dwarf）",3,"天文","白矮星完全冷卻後的假想殘骸；所需時間超過宇宙目前年齡，尚不存在這種成熟殘骸。","extra13"],
 ["bk30","錢德拉塞卡極限（Chandrasekhar limit）",3,"天文","白矮星能維持穩定的理論質量上限，約為太陽質量的 1.4 倍。","extra14"],
 ["bk31","藏頭詩（Acrostic）",1,"文學","把每行開頭的字母或文字依序連起來，可以讀出另一个詞、名字或訊息。","extra15"],
 ["bk32","拼貼詩（Cento）",1,"文學","把其他詩作的句子拼接成一首新詩，像用不同布片縫成作品。","extra16"],
 ["bk33","隱喻複合語（Kenning）",1,"文學","以有比喻意味的複合詞替代一般名詞，古北歐與古英語詩歌常用。","extra17"],
 ["bk34","首語重複（Anaphora）",1,"文學","在接連的句子或詩行開頭重複同一個詞語，用來形成節奏或強調。","extra18"],
 ["bk35","單母音寫作（Monovocalisme）",1,"文學","一種限制寫作：整篇只允許使用某一種母音字母，其餘母音不用。","extra19"],
 ["bk36","缺字母寫作（Lipogramme）",2,"文學","寫作時刻意不使用某個或某些字母，含有那些字母的詞也不能出現。","extra20"],
 ["bk37","字母順序詩（Abecedarian）",2,"文學","依字母表順序安排各行或各節的開頭，讓字母順序成為詩的結構。","extra21"],
 ["bk38","克萊里休詩（Clerihew）",2,"文學","四行幽默詩，第一行以人物名字開頭，押 AABB 韻，節奏常故意不規則。","extra22"],
 ["bk39","潘圖姆詩（Pantoum）",2,"文學","由四行詩節組成，上一節第二、第四行成為下一節第一、第三行。","extra23"],
 ["bk40","跨行（Enjambment）",2,"文學","一個句子或片語不在詩行末結束，而是接著延伸到下一行。","extra24"],
 ["bk41","S+7 寫作法",3,"文學","把原文每個名詞，換成指定字典中它後面的第七個名詞，製造意外的新文本。","extra25"],
 ["bk42","囚犯限制寫作（Contrainte du prisonnier）",3,"文學","模擬紙張很小的囚犯，只用沒有向上或向下伸出筆畫的字母寫訊息。","extra26"],
 ["bk43","雪球詩（Boule de neige）",3,"文學","第一行用一個一字母的詞，第二行用一個二字母的詞，逐行增加詞的字母數。","extra27"],
 ["bk44","六節詩（Sestina）",3,"文學","六個六行詩節輪換重複同一組六個行末詞，最後以三行收尾。","extra28"],
 ["bk45","維拉內爾詩（Villanelle）",3,"文學","十九行固定詩形，由五個三行節與一個四行節組成，兩個疊句交替重現。","extra29"],
 ["bk46","瑞克搖（Rickroll）",1,"迷因","把看似另有內容的連結，換成 Rick Astley 的 Never Gonna Give You Up 音樂影片，讓點擊者受騙。","extra30"],
 ["bk47","Doge",1,"迷因","以柴犬照片搭配彩色、故意不合文法的英文短句流傳的迷因，知名原型是 Kabosu。","extra31"],
 ["bk48","Nyan Cat",1,"迷因","身體像 Pop-Tart 烤餡餅、拖著彩虹飛行的像素貓動畫，常配上不斷重複的日語喵叫歌曲。","extra32"],
 ["bk49","This Is Fine",1,"迷因","狗坐在著火的房間卻表現平靜的漫畫迷因，用來表達身陷混亂仍假裝沒事。","extra33"],
 ["bk50","LOLcats",1,"迷因","把貓照片加上搞笑文字，常刻意拼錯字或使用不合文法的英文，像貓在說話。","extra34"],
 ["bk51","Stonks",2,"迷因","故意拼錯 stocks 的迷因字，常搭配 Meme Man 和股市圖，嘲諷看似聰明的糟糕金錢決策。","extra35"],
 ["bk52","Trollface",2,"迷因","一張誇張咧嘴笑的黑白畫臉，用來表示成功惡作劇、戲弄或挑釁別人的得意。","extra36"],
 ["bk53","Hide the Pain Harold",2,"迷因","源自一位老年圖庫模特兒的笑容，看起來像壓著痛苦或尷尬，成為苦笑迷因。","extra37"],
 ["bk54","宇宙大腦（Galaxy Brain）",2,"迷因","用逐漸發光、變大的大腦圖片搭配不同想法，常反諷越來越荒謬的觀點被當成高智慧。","extra38"],
 ["bk55","Dramatic Chipmunk",2,"迷因","配上戲劇音樂突然回頭的動物短片；片中其實是草原犬鼠，不是花栗鼠。","extra39"],
 ["bk56","Loss",3,"迷因","把 Ctrl+Alt+Del 的一篇四格漫畫構圖，簡化成線條或其他物件，讓人辨認隱藏的四格排列。","extra40"],
 ["bk57","Duckroll",3,"迷因","用誘人的連結騙人點開裝了輪子的鴨子圖片，是 Rickroll 出現前的誘餌轉向笑話。","extra41"],
 ["bk58","All Your Base Are Belong to Us",3,"迷因","出自遊戲 Zero Wing 開場的一句不自然英文翻譯，後來被大量改圖和影片沿用。","extra42"],
 ["bk59","Keyboard Cat",3,"迷因","以貓像在彈鍵盤的影片接在失誤片段後面，彷彿用演奏把出糗的人請下台。","extra43"],
 ["bk60","Advice Animals",3,"迷因","一類用固定動物或人物圖像配文字、代表特定性格或情境的迷因模板，不一定真的提供建議。","extra44"]
);
const QUESTIONS=Object.freeze(rows.map(([id,title,level,category,answer,key])=>Object.freeze({id,title,level,category,answer,source:Object.freeze({title:sources[key][0],url:sources[key][1],checkedAt:'2026-10-09'})})));
module.exports={QUESTIONS};
