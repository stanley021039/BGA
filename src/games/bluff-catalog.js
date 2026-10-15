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
sources.extra22=["Academy of American Poets：Clerihew","https://poets.org/glossary/Clerihew"];
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
const notes=[["幻日常出現在太陽左右，名稱中的「幻」指額外光斑，並沒有另一顆太陽。","可說：天空裡冰晶像小稜鏡，把部分陽光彎向眼睛，所以太陽旁像多了一個亮點。","關鍵是冰晶折射，不是海市蜃樓的整幅影像。"],["海洋雪是許多微小碎屑一起下沉的現象；在深海，看起來像雪花一直往下飄。","可說：上層海洋掉下食物碎屑，深海生物就靠這場不冷的雪得到養分。","雪指外觀，並非低溫形成的水結晶。"],["牠保留幼體的外鰓與水生外形，卻可以性成熟，稱為幼態延續。","可說：別的蠑螈通常變態後外形改變，牠卻像保持小時候的樣子長大生小孩。","不是永遠不長大，而是成體仍保留幼體特徵。"],["發光是生物的化學作用，某些生物也會與能發光的微生物共生。","可說：身體像帶著化學小燈，亮光可能吸引獵物，也可能嚇退敵人。","生物發光會產生光，與只反射外來光不同。"],["桶狀休眠是一種面對乾燥的生存狀態；身體縮小、活動與代謝大幅減少。","可說：像把身體按成省電模式，缺水時先撐住，重新有水才恢復活動。","不代表水熊蟲在任何極端條件下都不會死亡。"],["觀察者的影子投在前方霧幕上，缺乏距離線索時，可能看起來像巨大人影。","可說：太陽在你後面，前方霧氣當銀幕，巨人其實是你自己的影子。","不是山裡真有巨人，也不是旁人的投影才會出現。"],["多見於山脈下風處；它顯示氣流中有山岳波，但沒有雲時山岳波仍可能存在。依形成高度，可分成卷積雲、高積雲或層積雲的莢狀型。","可說：空氣像波浪，雲在波浪的固定位置形成，所以外觀常像飛碟。","像飛碟的形狀不等於飛行物，也不是所有雲都沿風快速移動。"],["這是辨認圖樣時，把原本沒有特定意義的形狀解讀為熟悉事物的現象。","可說：插座像人臉、雲像動物，不是那些東西真的有臉，是大腦在辨認形狀。","看到相似圖樣，不代表那個圖樣具有真實含義。"],["名稱來自牠的外形與顏色；牠靠絲狀構造收集海洋雪等碎屑，而不是吸血。","可說：名字像吸血鬼，實際工作比較像在深海收集飄下來的食物殘渣。","不要因名稱就把牠說成專門吸血的掠食者。"],["兩個較大天體共同作用，使小物體在某些位置能保持相對配置；共有五處。","可說：在地球與太陽附近，有幾個適合太空器維持相對位置的特殊區域。","不是所有點都自然穩定；太空器仍可能需要調整軌道。"],["它屬於極區平流層雲的一種，在低角度陽光照射下，常呈現珍珠般虹彩。","可說：高空的冰晶雲像珠母貝，傍晚仍被照亮，就出現帶彩色的光澤。","虹彩來自光學效果，不是雲本身染了顏色。"],["這種雲位於很高的中氣層；地面已暗，高處冰晶仍可能受到太陽照射。","可說：你站的地方天黑了，但雲比你高得多，還照得到陽光，所以看來在發亮。","不是雲自己生物發光，也不是一般低空雲的燈光反射。"],["細小水滴造成繞射，使太陽或月亮附近形成較貼近光源的彩色光環。","可說：雲中的小水滴讓光向旁邊散開，不同顏色分布成環。","與較大的冰晶折射暈不同；此處「華」也稱光冠。"],["雲縫讓陽光形成亮束，空氣中的粒子散射光線，使我們看見光束的路徑。","可說：像窗簾縫射進房間的光，只是天空把雲當窗簾，粒子把光路顯出來。","看起來從一點向外張開，主要是透視；光束大致平行。"],["它出現在反太陽方向，觀察者看向雲霧時，可在自己影子周圍看見彩環。","可說：太陽在身後，霧在前方，自己影子外出現一圈彩色邊框。","不要與太陽或月亮周圍的光冠混為同一現象。"],["一具鯨魚屍體可以讓深海的不同生物在不同階段取食，形成持續一段時間的生態系。","可說：對深海來說，掉下來一頭鯨魚像送來巨大的食物補給。","不是鯨魚平常往下游，而是屍體沉到海底的生態現象。"],["某些微生物利用化學物質的反應取得能量，進而製造有機物。","可說：植物多半靠陽光，熱泉附近的微生物卻可以靠化學反應供能。","不等於不需原料；只是能量來源不是陽光。"],["這個詞描述海洋及沿海生態系儲存的碳，常談到海草床、鹽沼及紅樹林。","可說：海邊濕地不只是有生物，植物和底泥也能長期存放碳。","藍是海洋的稱呼，不表示碳的顏色是藍色。"],["鱟的外觀像有硬殼的蟹，分類上卻屬於螯肢動物，與蜘蛛、蠍子更接近。","可說：看起來像蟹不代表是蟹，牠的分類關係更靠近蜘蛛那一群。","不要依外形或英文名字的 crab 就判定牠是螃蟹。"],["海參是棘皮動物，身體通常細長柔軟；許多種類會攝取沉積物中的有機碎屑。","可說：名字像食材中的蔬菜，其實是海星、海膽的親戚。","不是海中的植物，也不是一條沒有殼的蠕蟲。"],["雲下雖有降水落下，但水滴或冰晶在接觸地面前已消失，留下可見條紋。","可說：天空明明像在下雨，地面卻沒淋到，因為雨在半空先蒸發了。","不是雲的鬚，也不代表降水必定到達地面。"],["部分雲滴先形成冰晶並下落，周圍過冷水滴逐漸蒸發，造成雲層中的缺口。","可說：雲不是被飛碟撞穿，而是其中一塊先結冰、落下，留下洞。","成因是雲中水與冰的變化，不是實體把雲打破。"],["不同氣層的移動速度不同，邊界可能出現波動，使雲形像向前捲的浪尖。","可說：兩層風像不同速度的水流，把交界處捲成一排海浪。","不是海浪升到天空，而是風切造成的雲形。"],["這片北大西洋海域的界線由洋流環繞而成，海上有大量漂浮馬尾藻。","可說：一般想像海的邊界有陸地，它卻像被洋流圈出來的海中區域。","沒有陸地圍住不代表完全沒有邊界。"],["海水冷暖與鹽度改變密度，較重的海水會下沉，與其他水體形成大尺度流動。","可說：海洋裡有一條立體輸送帶，水的密度差讓表層和深層互相連接。","不是單靠風推動的表面洋流，也不是每處海水速度都相同。"],["小天體太靠近大天體時，面向與背向它的引力差可能超過自身維持完整的能力。","可說：同一顆衛星的近端與遠端被拉得不同，靠太近就可能被扯散。","不是所有物體跨過一條線就立即消失，強度等條件也有影響。"],["磁星是中子星的一類，以極強磁場聞名；不要把它理解為一塊巨大的普通磁鐵。","可說：恆星演化後留下非常緊密的天體，而磁星的磁場尤其強。","它與磁力發電裝置無關，也不是一般行星。"],["活躍星系中心的噴流朝向我們時，輻射特別突出，也常有明顯亮度變化。","可說：同樣一束光，如果幾乎直朝眼睛打來，看起來會比側看更亮。","它指星系核心及其噴流的觀測類型，不是一顆普通閃爍星星。"],["這是假想白矮星長時間冷卻的終點；宇宙目前的年齡還不夠讓這種殘骸形成。","可說：像一顆要等極漫長歲月才能冷下來的恆星殘骸，目前只是理論終點。","不是黑洞，也不要宣稱天文學家已觀測到成熟黑矮星。"],["白矮星若質量超過約 1.4 倍太陽質量，原本支撐它的狀態難以維持。","可說：這是白矮星承受重量的理論上限，並非所有星球共用的尺寸上限。","談的是質量，不是直徑或溫度。"],["訊息藏在各行的開頭；單看每一行是詩句，把開頭依序取出才讀出另一層意思。","示意：三行開頭依次寫「我、愛、你」，其餘內容仍可各自成為完整句子。","重點是開頭連成訊息，並非任何藏了意思的詩都叫藏頭詩。"],["材料來自其他作品的詩句，作者透過重新排列與組合形成新的詩意。","可說：像把不同歌曲的一句句歌詞重新接成一首作品，但這裡談的是詩。","這是拼接既有句子的形式，與完全重新寫出相似風格不同。"],["用短小、帶比喻的複合說法指稱一個事物，常見於古北歐及古英語詩歌。","示意：不用一般物品名，而說「海上的道路」，讓讀者聯想某種事物。","它是一種詩歌表達手法，不是替每個詞取普通綽號就足夠。"],["把相同字詞放在多個句子或詩行的起頭，藉反覆建立節奏與強調。","示意：「我們記得雨，我們記得路，我們記得那一天。」三句都有相同開頭。","重複必須在開頭，與行尾反覆或單純押韻不同。"],["作者先選定一個母音字母，寫作時只使用含這個母音而不含其他母音的詞。","可說：如果選 a，就得在有限的詞裡想辦法完成文章，像字母版限制挑戰。","限制的是母音字母，不是整篇只能有一個字或一種聲音。"],["作者刻意避開某個字母，所有會用到它的詞都要替換，仍設法保留可讀性。","可說：如果不能用 e，常見英文詞會突然不能寫，只好換詞繞路。","是事先設計的寫作限制，不是印刷漏字。"],["各行或各節按字母表順序開頭，字母次序本身成為作品結構。","示意：英文第一行以 A 開頭、下一行以 B 開頭，再依次走下去。","它要求按序排列，不只是隨便把每行第一字藏成名字。"],["這種幽默四行詩以人物為主題，兩兩押韻，常把人物生平寫得滑稽。","可說：用四行像小傳記般寫一個人，節奏可以歪歪的，AABB 韻比較重要。","不是四行就算；人物主題、幽默與押韻也是辨認線索。"],["詩節互相勾連：上一節的第二與第四行，到下一節成為第一與第三行。","示意：第一節寫 A、B、C、D，下一節接成 B、E、D、F。","重複的是整行的指定位置，不只是每節用同一韻腳。"],["句子的文法或意思跨過詩行末，讓讀者讀到下一行才完成理解。","示意：上一行寫「我把未說出的」，下一行才接「話藏進雨裡」。","換行本身不一定就是跨行，要看句法是否仍在延續。"],["先指定一部字典，把原文名詞替換成該字典中往後數第七個名詞。","可說：保留原句骨架，卻讓名詞集體走七步，結果會出現意外的畫面。","不是替換每第七個字，也不是隨機挑七個詞。"],["以狹小紙張的想像為限制，只選筆畫不往上下突出太多的字母來寫。","可說：像把字母排進低矮格子，遇到往上或往下伸的字就得換詞。","談的是字母的形狀，不是內容只能寫囚犯生活。"],["每一行是一個詞，第一行一個字母、第二行兩個，逐行增加，形成雪球般的擴張。","示意：以英文選一、二、三個字母的詞逐行排下；例子重點在長度而非意思。","不是每行多一個詞；這個基本版本增加的是詞的字母數。"],["六個行末詞依固定順序在六節中輪换，最後另有三行收束再次容納這些詞。","可說：不是靠每節換新韻腳，而是讓同六個尾詞不斷換位置。","六個六行節之外還有三行收尾，不能只說總共三十六行。"],["十九行包含五個三行節和最後一個四行節，兩個指定疊句按規則重現。","可說：有兩句像歌曲副歌般輪流回來，最後在結尾一起出現。","不是任意十九行的詩，固定疊句與詩節安排才是特色。"],["點開看似有別種內容的連結，卻被帶到指定流行歌曲影片，是一種誘餌轉向笑話。","可說：朋友說是重要消息，打開卻出現 Rick Astley 的那首歌，你就被瑞克搖了。","不是任何搞錯連結都叫 Rickroll；它有特定的歌曲與惡作劇脈絡。"],["柴犬的表情搭配彩色英文碎語，常用刻意不合文法的說法模擬狗的內心。","可說：照片裡的狗像在想事情，字則用 such、much、wow 之類的怪句子呈現。","迷因名稱和後來沿用名稱的加密貨幣，不是同一個東西。"],["像素貓拖著彩虹飛行，動畫搭配反覆的喵叫旋律，靠持續循環形成魔性效果。","可說：一隻點心身體的貓一直在彩虹上飛，畫面與聲音都像停不下來。","Nyan 是與日語貓叫有關的名稱，不是動物品種。"],["畫面把危機與平靜放在一起：狗所在的房間著火，牠却仍表現一切正常。","可說：工作已經亂成一團，但你仍坐著喝飲料說沒事，這就是它常被用的情境。","它通常是在反諷，並非真的相信火災安全。"],["把貓照片配上刻意寫壞的英文，形成像貓本人在發言的搞笑圖。","可說：貓本來只是站著，配上不合文法的台詞，就變成一張角色笑話。","不是所有貓圖都是 LOLcats，文字與擬人化語氣很重要。"],["把 stocks 故意拼成 stonks，通常配誇張股市畫面，拿荒唐的理財決策開玩笑。","可說：明明做了很糟的選擇，卻擺出自己是投資天才的樣子。","是反諷迷因，不是任何投資策略或專業術語。"],["黑白笑臉常代表惡作劇者得逞的表情，與網路戲弄、誘騙的情境相連。","可說：別人被整到了，整人的那方笑得非常得意，就會用這張臉。","不能因為它在笑，就把它說成表示善意或普通喜悅。"],["圖庫模特兒的笑容被解讀成壓抑尷尬或不快，因此常用來描述只能苦笑的時刻。","可說：表面在微笑，心裡卻很想哭，像被迫說『我很好』。","它是網友對影像的詮釋，不等於能從照片判定模特兒的心理狀態。"],["多格大腦逐漸變大、發亮，搭配越來越離奇的主張，常用來反諷自以為高明。","可說：最普通的方法配小腦，最荒謬的方法配發光大腦，故意顛倒智慧高低。","畫面越亮不表示作者真的同意那個想法。"],["短片中的動物突然回頭，配上戲劇性音樂，就像發現重大秘密的電影反應。","可說：只是動物回頭一眼，加了緊張配樂就變成『你剛剛說什麼』。","名字寫 Chipmunk，但片中動物是草原犬鼠。"],["原四格漫畫的角色位置被抽象化，辨認者靠排列而非原畫看出是哪一篇。","可說：只剩幾條直線，只要位置與四格結構對上，大家還會問『這是 Loss 嗎』。","不能把任何四格漫畫都當成 Loss，特定構圖才是辨認重點。"],["先用誘人的訊息讓人點連結，再轉到有輪子的鴨子圖片，是較早的網路誘餌笑話。","可說：以為要看驚人消息，結果看到怪鴨子，重點在預期被故意打斷。","是 Rickroll 類型的前身，不是鴨子翻滾的動作名稱。"],["舊遊戲開場的不自然英文翻譯被網友反覆改圖與引用，變成辨識度很高的口號。","可說：一句翻得很怪的反派宣言，被拿去配各種不同畫面與情境。","它不是標準英文教學範例，而是因不自然翻譯出名。"],["把貓彷彿在彈琴的影像接在出糗片段後，像用音樂宣布表演結束。","可說：有人失敗了，畫面切到貓彈琴，彷彿主持人在說『請下台』。","影片的表演效果不代表貓真的具備人類的鍵盤演奏能力。"],["固定模板代表固定個性，文字描述情境，讓同一張圖可以不斷被改寫。","可說：像替某種尷尬或得意的人物配固定演員，每次換台詞就變成新笑話。","名字雖叫動物建議，模板可以是人，而且內容未必有建議。"]];
// Keep all data here so historical replay captures the complete catalog.
const imported=[
  {
    "title": "梧桐樹條約",
    "level": 2,
    "category": "歷史",
    "answer": "1792 年紐約一群證券經紀人訂立的協議，與紐約證券交易所的起源有關。",
    "explanation": {
      "detail": "1792 年紐約一群證券經紀人訂立的協議，與紐約證券交易所的起源有關。 英文是 Buttonwood Agreement，名稱與當時華爾街一帶的梧桐樹有關。",
      "example": "可說：不是兩國簽和平條約，而是一群經紀人約定怎麼做證券交易。",
      "clarification": "它是交易所早期歷史，不是現行投資規則或生態保育條約。"
    },
    "source": {
      "title": "NYSE：交易所歷史",
      "url": "https://www.nyse.com/history-of-nyse",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk61"
  },
  {
    "title": "伊頓混亂",
    "level": 1,
    "category": "飲食",
    "answer": "由水果、蛋白霜脆餅與鮮奶油混合的英式甜點，英文為 Eton mess。",
    "explanation": {
      "detail": "由水果、蛋白霜脆餅與鮮奶油混合的英式甜點，英文為 Eton mess。 常見版本用草莓，材料混在一起有凌亂外观，因此名稱很容易讓人猜成事件。",
      "example": "可說：像把草莓、奶油與蛋白脆餅拌成一碗，mess 指看起來亂，不是學校發生暴動。",
      "clarification": "不同版本可用其他水果；不要把它說成革命或戰爭。"
    },
    "source": {
      "title": "百科：伊頓混亂",
      "url": "https://zh.wikipedia.org/wiki/伊頓混亂",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk62"
  },
  {
    "title": "斯特魯普效應",
    "level": 2,
    "category": "心理",
    "answer": "當文字意思與字體顏色不一致時，說出字體顏色通常會受到文字閱讀的干擾。",
    "explanation": {
      "detail": "當文字意思與字體顏色不一致時，說出字體顏色通常會受到文字閱讀的干擾。 熟練閱讀容易自動發生，卻與這次要辨認顏色的工作競爭，使反應變慢或出錯。",
      "example": "示意：用藍色寫「紅」，要求回答藍色，嘴巴卻可能先想說紅。",
      "clarification": "不是人口統計效應，也不是所有反應變慢都叫 Stroop 效應。"
    },
    "source": {
      "title": "華盛頓大學：Stroop Effect",
      "url": "https://faculty.washington.edu/chudler/words.html",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk63"
  },
  {
    "title": "西施舌",
    "level": 1,
    "category": "動物",
    "answer": "一種海產貝類的俗名，臺灣常用來稱雙線紫蛤。",
    "explanation": {
      "detail": "一種海產貝類的俗名，臺灣常用來稱雙線紫蛤。 名字像人的身體部位，但此題指生活在淺海沙泥底的雙殼類；地區俗名可能對應不同貝類。",
      "example": "可說：它有兩片殼，是餐桌上的海鮮，不是美女本人伸舌的動作。",
      "clarification": "俗名並非全地區只對應同一物種，勿以名稱直接固定全球學名。"
    },
    "source": {
      "title": "農業部：西施舌",
      "url": "https://kmweb.moa.gov.tw/theme_data.php?id=81&theme=fisheasy",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk64"
  },
  {
    "title": "卡美洛",
    "level": 2,
    "category": "傳說",
    "answer": "亞瑟王傳說中的宮廷或城堡所在地，英文是 Camelot。",
    "explanation": {
      "detail": "亞瑟王傳說中的宮廷或城堡所在地，英文是 Camelot。 它與亞瑟王及圓桌騎士故事連結；文本對位置與描述不盡相同。",
      "example": "可說：像亞瑟王與騎士們聚集的傳說中心，不是某種奶油甜點。",
      "clarification": "這是傳說中的地點，不能把它的確切位置當成已證實歷史。"
    },
    "source": {
      "title": "百科：Camelot",
      "url": "https://en.wikipedia.org/wiki/Camelot",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk65"
  },
  {
    "title": "卡瓦帝之舞",
    "level": 3,
    "category": "民俗",
    "answer": "泰米爾印度教傳統中，信徒扛著 kavadi 進行的還願或奉獻舞蹈。",
    "explanation": {
      "detail": "泰米爾印度教傳統中，信徒扛著 kavadi 進行的還願或奉獻舞蹈。 它與對穆魯甘神的信仰及大寶森節等儀式相關，背負物有不同形式。",
      "example": "可說：背著裝飾負擔邊行進邊舞，不只是在舞台上跳娛樂舞。",
      "clarification": "名稱涵蓋宗教奉獻，不表示所有印度舞蹈或參與者儀式都相同。"
    },
    "source": {
      "title": "新加坡文物局：A Journey of Devotion",
      "url": "https://www.roots.gov.sg/stories-landing/stories/A-Journey-of-Devotion",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk66"
  },
  {
    "title": "黑老虎",
    "level": 2,
    "category": "植物",
    "answer": "此題指五味子科南五味子屬的藤本植物 Kadsura coccinea，也有布福娜等俗名。",
    "explanation": {
      "detail": "此題指五味子科南五味子屬的藤本植物 Kadsura coccinea，也有布福娜等俗名。 名稱像猛獸，實際上是可形成聚合果的植物，與南五味子類群相關。",
      "example": "可說：這隻老虎不用獵食，它是一種藤，會長出由许多小果聚成的果實。",
      "clarification": "本題限定植物名稱；不是毛色黑的虎，也不以題庫作食用辨識。"
    },
    "source": {
      "title": "深圳植物志：黑老虎",
      "url": "https://www.iplant.cn/fsz/info/Kadsura%20coccinea",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk67"
  },
  {
    "title": "波士頓動力",
    "level": 1,
    "category": "科技",
    "answer": "一家以移動機器人技術聞名的公司，英文是 Boston Dynamics。",
    "explanation": {
      "detail": "一家以移動機器人技術聞名的公司，英文是 Boston Dynamics。 代表性產品包括四足機器人 Spot；重點在機器人移動、平衡與實際應用。",
      "example": "可說：網路上會跑跳的機器狗背後那家公司，不是波士頓城的電力公司。",
      "clarification": "公司名稱不是某種物理定律，也不是只做舞蹈影片。"
    },
    "source": {
      "title": "Boston Dynamics：About Us",
      "url": "https://bostondynamics.com/about/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk68"
  },
  {
    "title": "奧菲斯蛋",
    "level": 3,
    "category": "神話",
    "answer": "古希臘俄耳甫斯傳統中的宇宙蛋，與原初神法涅斯的誕生故事相關。",
    "explanation": {
      "detail": "古希臘俄耳甫斯傳統中的宇宙蛋，與原初神法涅斯的誕生故事相關。 常見象徵圖像是蛇纏绕著蛋，蛋代表宇宙生成的神話意象。",
      "example": "可說：不是餐廳菜單的蛋，而是創世故事裡能孵出原初神的宇宙蛋。",
      "clarification": "這是宗教神話，不是天文學證實宇宙真的由蛋孵出。"
    },
    "source": {
      "title": "百科：俄耳甫斯蛋",
      "url": "https://zh.wikipedia.org/wiki/俄耳甫斯蛋",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk69"
  },
  {
    "title": "波士文法案",
    "level": 3,
    "category": "體育",
    "answer": "此題指博斯曼判決：1995 年歐洲法院涉及足球員跨國轉會與勞工自由移動的案件。",
    "explanation": {
      "detail": "此題指博斯曼判決：1995 年歐洲法院涉及足球員跨國轉會與勞工自由移動的案件。 球員合約到期後在適用條件下轉往另一歐盟國家的球會，原有轉會費限制被判違反自由移動。",
      "example": "可說：足球員約滿換隊，不應仍被原球會某些轉會費規則綁住。",
      "clarification": "它是法院判決，非名為波士文的新稅法；不等於所有轉會都免費。"
    },
    "source": {
      "title": "歐盟法院：C-415/93 Bosman",
      "url": "https://curia.europa.eu/juris/showPdf.jsf?docid=99481&doclang=EN",
      "checkedAt": "2026-10-12"
    },
    "aliases": [
      "博斯曼法案",
      "博斯曼判決"
    ],
    "id": "bk70"
  },
  {
    "title": "水晶之夜",
    "level": 2,
    "category": "歷史",
    "answer": "1938 年 11 月納粹德國及其控制地區發生的大規模反猶太暴力事件。",
    "explanation": {
      "detail": "1938 年 11 月納粹德國及其控制地區發生的大規模反猶太暴力事件。 猶太人的商店、會堂與住宅遭破壞，名稱與散落的玻璃碎片有關。",
      "example": "可說：名字聽起來像漂亮晚會，其實是迫害猶太人的暴力事件。",
      "clarification": "不是水晶藝術活動或調酒；「水晶」名稱不應掩蓋事件的暴力與受害者。"
    },
    "source": {
      "title": "美國大屠殺紀念館：Kristallnacht",
      "url": "https://encyclopedia.ushmm.org/content/en/article/kristallnacht",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk71"
  },
  {
    "title": "綠閃光",
    "level": 2,
    "category": "氣象",
    "answer": "日落或日出附近，太陽邊緣短暫出現綠色亮光的大氣光學現象。",
    "explanation": {
      "detail": "日落或日出附近，太陽邊緣短暫出現綠色亮光的大氣光學現象。 大氣折射將光分開，合適的地平線與觀察条件下，綠色部分可能短暫特別明顯。",
      "example": "可說：太陽落下前最後一小瞬間，頂邊像閃過綠光。",
      "clarification": "不是太陽變成綠色，也不是每次日落都一定出現。"
    },
    "source": {
      "title": "NOAA：Coast Pilot 大氣光學",
      "url": "https://nauticalcharts.noaa.gov/publications/coast-pilot/files/cp8/CPB8_WEB.pdf",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk72"
  },
  {
    "title": "摩爾定律",
    "level": 1,
    "category": "科技",
    "answer": "積體電路上的電晶體數量約每兩年倍增的產業觀察。",
    "explanation": {
      "detail": "積體電路上的電晶體數量約每兩年倍增的產業觀察。 Gordon Moore 最早在 1965 年提出每年倍增的預測，後來調整為約兩年；描述的是晶片演進趨勢。",
      "example": "可說：同一塊晶片能放進越來越多電晶體，但不是保證電腦速度每兩年都剛好翻倍。",
      "clarification": "不是不可違反的物理定律，電晶體數量也不等於單一效能指標。"
    },
    "source": {
      "title": "Intel：Moore’s Law",
      "url": "https://www.intel.com/content/www/us/en/newsroom/resources/moores-law.htm",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk73"
  },
  {
    "title": "羽.泉",
    "level": 1,
    "category": "音樂",
    "answer": "由陳羽凡與胡海泉組成的中國流行音樂組合，常寫作羽泉。",
    "explanation": {
      "detail": "由陳羽凡與胡海泉組成的中國流行音樂組合，常寫作羽泉。 名稱取自兩位成員名字，1990 年代末開始以組合形式推出作品。",
      "example": "可說：名字像泉水景點，其實是兩位歌手合作的組合名稱。",
      "clarification": "此題指音樂組合，不是羽毛與泉水的自然景觀。"
    },
    "source": {
      "title": "百科：羽泉",
      "url": "https://zh.wikipedia.org/wiki/羽泉",
      "checkedAt": "2026-10-12"
    },
    "aliases": [
      "羽泉"
    ],
    "id": "bk74"
  },
  {
    "title": "松鼠鱖魚",
    "level": 1,
    "category": "飲食",
    "answer": "把魚身切花刀、炸至酥脆後配甜酸醬汁的蘇州名菜。",
    "explanation": {
      "detail": "把魚身切花刀、炸至酥脆後配甜酸醬汁的蘇州名菜。 典型做法將魚肉炸出翹起的形狀，名稱借用松鼠的外觀或意象。",
      "example": "可說：盤子裡是魚，花刀與油炸让外型像松鼠，不是把松鼠和魚一起料理。",
      "clarification": "名稱不表示料理含松鼠肉，也不是兩個物種的共生。"
    },
    "source": {
      "title": "Wikipedia：松鼠鳜鱼",
      "url": "https://zh.wikipedia.org/wiki/松鼠鳜鱼",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk75"
  },
  {
    "title": "樓外樓",
    "level": 1,
    "category": "飲食",
    "answer": "杭州西湖畔的知名餐館名稱，以杭幫菜相關歷史聞名。",
    "explanation": {
      "detail": "杭州西湖畔的知名餐館名稱，以杭幫菜相關歷史聞名。 名稱看似小說中的神秘建築，本題卻指真實餐館；要與同名作品區分。",
      "example": "可說：不是氣候異常讓樓長在樓外，而是西湖邊的一家老餐館。",
      "clarification": "題目限定杭州餐館，不涵蓋所有叫樓外樓的商家。"
    },
    "source": {
      "title": "杭州市檔案館：老字號",
      "url": "https://www.hzarchives.org.cn/info/6880",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk76"
  },
  {
    "title": "幻椅式",
    "level": 2,
    "category": "運動",
    "answer": "瑜伽中屈膝、臀部向後下移，像坐在不存在的椅子上的站姿。",
    "explanation": {
      "detail": "瑜伽中屈膝、臀部向後下移，像坐在不存在的椅子上的站姿。 梵文名稱 Utkatasana，英文常稱 Chair Pose；可搭配上舉手臂。",
      "example": "可說：人還站著，卻擺出要坐椅子的姿勢，椅子是想像出來的。",
      "clarification": "不是一定要真的坐椅子；此題是姿勢辨識，不是個人動作處方。"
    },
    "source": {
      "title": "Yoga Journal：Chair Pose",
      "url": "https://www.yogajournal.com/poses/chair-pose/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk77"
  },
  {
    "title": "抽象速度",
    "level": 3,
    "category": "藝術",
    "answer": "此題指未來派畫家賈科莫・巴拉以線條、色塊表現速度的繪畫主題。",
    "explanation": {
      "detail": "此題指未來派畫家賈科莫・巴拉以線條、色塊表現速度的繪畫主題。 相關作品包括《抽象速度＋聲音》，將運動感轉化成抽象構圖，而非畫出清楚的車子輪廓。",
      "example": "可說：不用把車完整畫出來，改用重複線條和方向表現它快速經過的感覺。",
      "clarification": "題庫指作品及藝術概念，不是速度的物理公式。"
    },
    "source": {
      "title": "Guggenheim：Giacomo Balla",
      "url": "https://www.guggenheim.org/artwork/artist/Giacomo-Balla",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk78"
  },
  {
    "title": "腺毛馬藍",
    "level": 3,
    "category": "植物",
    "answer": "爵床科馬藍屬的植物，學名 Strobilanthes forrestii。",
    "explanation": {
      "detail": "爵床科馬藍屬的植物，學名 Strobilanthes forrestii。 植物資料記錄其花萼及相關部位具有腺狀毛；馬藍與菊科的馬蘭名稱相似但不是同一植物。",
      "example": "可說：是植物名，「腺毛」描述植物表面的小毛，不是人體內臟。",
      "clarification": "原清單寫腺毛馬蘭，這裡依植物資料更正為馬藍。"
    },
    "source": {
      "title": "中國醫藥大學：腺毛馬藍標本",
      "url": "https://cmuscmr.cmu.edu.tw/node/153",
      "checkedAt": "2026-10-12"
    },
    "aliases": [
      "腺毛馬蘭"
    ],
    "id": "bk79"
  },
  {
    "title": "灰姑娘效應",
    "level": 3,
    "category": "心理",
    "answer": "演化心理學中，討論繼親家庭與親生家庭中兒童受虐風險差異的研究概念。",
    "explanation": {
      "detail": "演化心理學中，討論繼親家庭與親生家庭中兒童受虐風險差異的研究概念。 名稱借用灰姑娘故事；研究讨论的是群體資料與可能解釋，也存在方法與推論上的討論。",
      "example": "可說：它研究親屬關係與照顧風險的統計關聯，不能直接拿來判定某位繼父母。",
      "clarification": "不是每個繼親都會虐待兒童，也不應把收養與繼親關係混成一類。"
    },
    "source": {
      "title": "百科：Cinderella effect",
      "url": "https://en.wikipedia.org/wiki/Cinderella_effect",
      "checkedAt": "2026-10-12"
    },
    "aliases": [
      "灰姑娘理論"
    ],
    "id": "bk80"
  },
  {
    "title": "天邊一朵雲",
    "level": 2,
    "category": "影視",
    "answer": "蔡明亮執導、2005 年推出的臺灣電影，英文片名 The Wayward Cloud。",
    "explanation": {
      "detail": "蔡明亮執導、2005 年推出的臺灣電影，英文片名 The Wayward Cloud。 李康生與陳湘琪出演，作品包含歌舞與強烈的成人題材，延續導演對都市生活及身體的關注。",
      "example": "可說：題名像風景詩，這裡指蔡明亮的一部電影，不是新的雲種。",
      "clarification": "不與同名文字或真正天上的雲混用；題庫不提供影片中的露骨細節。"
    },
    "source": {
      "title": "百科：天邊一朵雲",
      "url": "https://zh.wikipedia.org/wiki/天邊一朵雲",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk81"
  },
  {
    "title": "薪能",
    "level": 3,
    "category": "表演",
    "answer": "日本在夜間點燃篝火演出的能樂形式，日文為薪能。",
    "explanation": {
      "detail": "日本在夜間點燃篝火演出的能樂形式，日文為薪能。 薪指燃燒的木柴；火光和戶外空間是演出氣氛的重要部分。",
      "example": "可說：不是薪水帶來的能力，而是在火把或篝火旁欣賞能樂。",
      "clarification": "不是所有能樂都叫薪能，也不是能源政策的名詞。"
    },
    "source": {
      "title": "百科：薪能",
      "url": "https://zh.wikipedia.org/wiki/薪能",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk82"
  },
  {
    "title": "髒剋",
    "level": 2,
    "category": "設計",
    "answer": "英文 Trongs，一種套在手指上操作、讓手不直接碰油膩食物的小夾具。",
    "explanation": {
      "detail": "英文 Trongs，一種套在手指上操作、讓手不直接碰油膩食物的小夾具。 通常以三點的造型讓手指控制夹持，可抓食物而减少手沾到油污。",
      "example": "可說：像在手指上裝小爪子，吃雞翅時用工具抓，不必满手油。",
      "clarification": "是餐具設計，不是洗潔劑，也不代表食物一定比較衛生。"
    },
    "source": {
      "title": "百科：髒剋",
      "url": "https://zh.wikipedia.org/wiki/髒剋",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk83"
  },
  {
    "title": "心意把",
    "level": 3,
    "category": "武術",
    "answer": "與少林武術傳承相關的一種技法或拳術訓練名稱。",
    "explanation": {
      "detail": "與少林武術傳承相關的一種技法或拳術訓練名稱。 此題的把指技法，名稱並非手術器具；不同傳承對套路與用法的說明可能不同。",
      "example": "可說：是武術裡練心意與動作配合的技法，不是抓住心臟的醫療操作。",
      "clarification": "它屬武術傳承名稱，不能單憑字面解成心理學定律。"
    },
    "source": {
      "title": "百科：心意把",
      "url": "https://zh.wikipedia.org/wiki/心意把",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk84"
  },
  {
    "title": "安藤百福",
    "level": 1,
    "category": "人物",
    "answer": "日清食品創辦人，研發雞湯拉麵與杯麵的即食麵先驅。",
    "explanation": {
      "detail": "日清食品創辦人，研發雞湯拉麵與杯麵的即食麵先驅。 1958 年推出 Chicken Ramen，之後在 1971 年推出 Cup Noodles，讓麵條能以方便保存、快速沖泡的形式販售。",
      "example": "可說：不是某種料理，而是讓泡麵成為商品的重要發明者。",
      "clarification": "不要把發明即食麵說成發明所有麵條。"
    },
    "source": {
      "title": "日清食品：Our Founder",
      "url": "https://www.nissin.com/en_jp/about/founder/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk85"
  },
  {
    "title": "抓大放小",
    "level": 3,
    "category": "歷史",
    "answer": "中國國有企業改革中，集中處理大型企業、放寬小型企業經營與所有權安排的政策思路。",
    "explanation": {
      "detail": "中國國有企業改革中，集中處理大型企業、放寬小型企業經營與所有權安排的政策思路。 這裡的大小指企業規模，抓與放指管理與改革方式；小型企業可能採取改制、出售等多種安排。",
      "example": "可說：像把資源集中在大企業，小企業則放開讓它們用不同方式經營。",
      "clarification": "不是抓住大人物、放走小偷的司法原則。"
    },
    "source": {
      "title": "Wikipedia：Grasping the large, letting go of the small",
      "url": "https://en.wikipedia.org/wiki/Grasping_the_large,_letting_go_of_the_small",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk86"
  },
  {
    "title": "油鬼仔",
    "level": 2,
    "category": "傳說",
    "answer": "馬來民間傳說中全身塗油、難以抓住的怪人，稱 Orang Minyak。",
    "explanation": {
      "detail": "馬來民間傳說中全身塗油、難以抓住的怪人，稱 Orang Minyak。 故事常描述牠夜間活動、傷害人並藉油滑的身體逃走，不同版本對牠是妖怪或施術的人有不同說法。",
      "example": "可說：這是一種把全身黑油、滑溜溜抓不住的怪人寫進故事的地方傳說。",
      "clarification": "傳說的能力不等於真實存在；不要當作犯罪事件的證據。"
    },
    "source": {
      "title": "Wikipedia：Orang Minyak",
      "url": "https://en.wikipedia.org/wiki/Orang_Minyak",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk87"
  },
  {
    "title": "鍵盤小妹",
    "level": 1,
    "category": "迷因",
    "answer": "網路發文時扮演或自稱小妹的說話方式，常帶反串與玩笑意味。",
    "explanation": {
      "detail": "網路發文時扮演或自稱小妹的說話方式，常帶反串與玩笑意味。 PTT 等社群中，自稱小妹不一定表示發文者真的是女性；重點是用鍵盤營造身分或語氣。",
      "example": "可說：一個人開頭說小妹我有個問題，可能只是套用網路上的角色說法。",
      "clarification": "不能憑這個自稱推定真實性別或年齡。"
    },
    "source": {
      "title": "PTT：鄉民自稱小女子還是小妹",
      "url": "https://www.ptt.cc/bbs/WomenTalk/M.1581243031.A.04F.html",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk88"
  },
  {
    "title": "普隆德拉",
    "level": 1,
    "category": "遊戲",
    "answer": "《RO 仙境傳說》中盧恩米德加茲王國的首都，英文名 Prontera。",
    "explanation": {
      "detail": "《RO 仙境傳說》中盧恩米德加茲王國的首都，英文名 Prontera。 這是遊戲世界中的主要城市，有王城等場景；玩家常以它作為交易、聚集或出發的地點。",
      "example": "可說：名字像真實國家，其實是 RO 裡大家熟悉的大城市。",
      "clarification": "是虛構地名，不是現實的歐洲首都。"
    },
    "source": {
      "title": "RO 官方：普隆德拉地下監獄",
      "url": "https://ro.gnjoy.com.tw/event/20170623_EP16.1update/update.html?sid=NBB6b6",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk89"
  },
  {
    "title": "毒鵝膏",
    "level": 3,
    "category": "生物",
    "answer": "又稱死亡帽的劇毒菇類 Amanita phalloides。",
    "explanation": {
      "detail": "又稱死亡帽的劇毒菇類 Amanita phalloides。 它屬於鵝膏菌屬，誤食可能造成嚴重器官損傷；題目辨認的是菇的名稱與危險性，不是辨菇食用教學。",
      "example": "可說：名字像鵝的部位，實際上是一種危險的蘑菇。",
      "clarification": "不能靠這段描述判定野生菇是否可食。"
    },
    "source": {
      "title": "Wikipedia：Amanita phalloides",
      "url": "https://en.wikipedia.org/wiki/Amanita_phalloides",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk90"
  },
  {
    "title": "法老之蛇",
    "level": 2,
    "category": "化學",
    "answer": "受熱反應後產物膨脹、像蛇從小團物質裡長出來的化學展示。",
    "explanation": {
      "detail": "受熱反應後產物膨脹、像蛇從小團物質裡長出來的化學展示。 名稱來自黑色或灰色柱狀物彎曲伸展的外觀。歷史上的汞化合物版本有毒，與較常見的糖類黑蛇展示不能完全混同。",
      "example": "可說：原本一小團，反應後冒出長長的彎曲固體，看起來像一條蛇。",
      "clarification": "不是生物，也不要把題目當成在家製作的配方。"
    },
    "source": {
      "title": "Wikipedia：Black snake firework",
      "url": "https://en.wikipedia.org/wiki/Black_snake_(firework)",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk91"
  },
  {
    "title": "香蕉戰爭",
    "level": 2,
    "category": "歷史",
    "answer": "1898 至 1934 年間美國在中美洲與加勒比海一帶的一系列軍事干預。",
    "explanation": {
      "detail": "1898 至 1934 年間美國在中美洲與加勒比海一帶的一系列軍事干預。 名稱與當地香蕉等農產品產業及美國利益有關，涵蓋多國、多次占領和衝突，而非一場單一戰役。",
      "example": "可說：香蕉是名稱的線索，真正內容是美國在那個區域長期介入的歷史。",
      "clarification": "不是拿香蕉當武器，也不是只有 1898 年發生一次。"
    },
    "source": {
      "title": "Wikipedia：Banana Wars",
      "url": "https://en.wikipedia.org/wiki/Banana_Wars",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk92"
  },
  {
    "title": "豐乳肥臀",
    "level": 2,
    "category": "文學",
    "answer": "莫言創作的長篇小說，以母親與家族的經歷呈現近代中國的動盪。",
    "explanation": {
      "detail": "莫言創作的長篇小說，以母親與家族的經歷呈現近代中國的動盪。 書名是小說名稱，內容涉及家庭、生存、戰爭與歷史變遷；不是一本介紹人體外形的工具書。",
      "example": "可說：看書名可能以為談身材，其實是一部以家族故事串連歷史的小說。",
      "clarification": "作者是莫言，不要只依書名推測作品主題。"
    },
    "source": {
      "title": "諾貝爾獎：莫言作品資料",
      "url": "https://www.nobelprize.org/prizes/literature/2012/8320-biobibliografisk-notis-2012/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk93"
  },
  {
    "title": "魔鬼蛋",
    "level": 1,
    "category": "飲食",
    "answer": "把水煮蛋切半，取出蛋黃調味後填回蛋白的料理，英文稱 deviled eggs。",
    "explanation": {
      "detail": "把水煮蛋切半，取出蛋黃調味後填回蛋白的料理，英文稱 deviled eggs。 蛋黃餡常與美乃滋、芥末等拌合，呈現小份量前菜的形式；調味會隨食譜不同。",
      "example": "可說：像把水煮蛋改裝成一個裝著調味蛋黃的小杯子。",
      "clarification": "不是加了毒物的蛋，也不需要真的有魔鬼圖案。"
    },
    "source": {
      "title": "Wikipedia：Deviled egg",
      "url": "https://en.wikipedia.org/wiki/Deviled_egg",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk94"
  },
  {
    "title": "天使抽稅",
    "level": 2,
    "category": "飲食",
    "answer": "酒液在木桶熟成時逐漸蒸發、損失的部分，常稱天使的分享。",
    "explanation": {
      "detail": "酒液在木桶熟成時逐漸蒸發、損失的部分，常稱天使的分享。 木桶不是完全隔絕空氣，長期熟成會有水分與酒精逸散；比例受氣候、桶材及環境影響。",
      "example": "可說：酒放在桶裡慢慢變少，好像天使每年偷偷拿走一點。",
      "clarification": "是蒸發的比喻，不是政府徵稅；損失率也不固定。"
    },
    "source": {
      "title": "Wikipedia：Angels share",
      "url": "https://en.wikipedia.org/wiki/Angels%27_share",
      "checkedAt": "2026-10-12"
    },
    "aliases": [
      "天使稅"
    ],
    "id": "bk95"
  },
  {
    "title": "大人買",
    "level": 2,
    "category": "文化",
    "answer": "源自日語大人買い，指用成人購買力把喜歡的物品一次大量或整套買下。",
    "explanation": {
      "detail": "源自日語大人買い，指用成人購買力把喜歡的物品一次大量或整套買下。 常見於玩具、零食附贈品、漫畫等原本可能逐件購買的商品，把小時候只能買一點的願望一次實現。",
      "example": "可說：以前一次買一包，長大後乾脆整盒、整套帶走。",
      "clarification": "不是專指成人用品，也不只是任何普通購物。"
    },
    "source": {
      "title": "Wikipedia：大人買い",
      "url": "https://ja.wikipedia.org/wiki/大人買い",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk96"
  },
  {
    "title": "收皮",
    "level": 2,
    "category": "語言",
    "answer": "粵語中帶粗魯語氣、叫人閉嘴或走開的說法。",
    "explanation": {
      "detail": "粵語中帶粗魯語氣、叫人閉嘴或走開的說法。 要依語境判斷強度，常出現在不耐煩、斥責或熟人互嗆的情境；遊戲只需解釋語意。",
      "example": "可說：有人煩到你，這個詞大致是在說別再講了、走開啦。",
      "clarification": "不是收集皮革，也不宜當成禮貌的普通招呼。"
    },
    "source": {
      "title": "維基詞典：收皮",
      "url": "https://zh.wiktionary.org/wiki/收皮",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk97"
  },
  {
    "title": "拉撒路反射",
    "level": 3,
    "category": "醫學",
    "answer": "腦死者可能出現由脊髓迴路引起的複雜肢體反射，例如手臂抬起。",
    "explanation": {
      "detail": "腦死者可能出現由脊髓迴路引起的複雜肢體反射，例如手臂抬起。 這類動作不表示意識恢復；名稱取自拉撒路，但此處指反射現象，不是復活故事。",
      "example": "可說：看到身體動了，不一定表示人醒來，某些反射不需要大腦參與。",
      "clarification": "與心肺復甦停止後自發循環恢復的拉撒路現象是不同概念。"
    },
    "source": {
      "title": "PubMed：Complex spinal reflexes during confirmation of brain death",
      "url": "https://pubmed.ncbi.nlm.nih.gov/12911459/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [
      "拉撒路現象",
      "拉薩路現象"
    ],
    "id": "bk98"
  },
  {
    "title": "小豆洗",
    "level": 3,
    "category": "傳說",
    "answer": "日本民間傳說中在河邊等水域發出洗豆子聲音的妖怪，稱 Azukiarai。",
    "explanation": {
      "detail": "日本民間傳說中在河邊等水域發出洗豆子聲音的妖怪，稱 Azukiarai。 形象與故事版本不一，辨認重點是聲音、洗小豆的動作及水邊場景；有時只聽見聲音、看不見身影。",
      "example": "可說：晚上河邊好像有人沙沙洗紅豆，故事便把它說成妖怪在作業。",
      "clarification": "不是一種現實洗豆機器，也不是有可靠證據的生物。"
    },
    "source": {
      "title": "Wikipedia：Azukiarai",
      "url": "https://en.wikipedia.org/wiki/Azukiarai",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk99"
  },
  {
    "title": "槲葉環",
    "level": 3,
    "category": "歷史",
    "answer": "古羅馬以橡樹葉編成、授予拯救羅馬公民者的公民冠。",
    "explanation": {
      "detail": "古羅馬以橡樹葉編成、授予拯救羅馬公民者的公民冠。 拉丁名 corona civica，屬於軍事榮譽；葉子冠冕代表救人的功績，不能只理解成裝飾。",
      "example": "可說：不是用金做的王冠，而是救下同胞後得到的橡葉榮譽冠。",
      "clarification": "不等於奧運的橄欖冠，也不是所有皇帝日常配飾的泛稱。"
    },
    "source": {
      "title": "Wikipedia：Civic Crown",
      "url": "https://en.wikipedia.org/wiki/Civic_Crown",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk100"
  },
  {
    "title": "7±2（神奇數字七）",
    "level": 2,
    "category": "心理",
    "answer": "米勒 1956 年論文提出，某些短期記憶作業的容量約為七個資訊組塊、上下差兩個。",
    "explanation": {
      "detail": "米勒 1956 年論文提出，某些短期記憶作業的容量約為七個資訊組塊、上下差兩個。 組塊可以把多個項目打包成有意義的一組；研究談特定任務的概括，不是每個人大腦永遠固定有七格。",
      "example": "可說：一串數字難背，但分成熟悉的年份，便可能成為比較少的幾組。",
      "clarification": "不是七個字母的絕對上限，也不適用所有記憶種類。"
    },
    "source": {
      "title": "Miller：The Magical Number Seven",
      "url": "https://psychclassics.yorku.ca/Miller/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [
      "7正負2",
      "7+-2"
    ],
    "id": "bk101"
  },
  {
    "title": "自律期",
    "level": 3,
    "category": "心理",
    "answer": "皮亞傑道德發展理論中，逐漸理解規則可由人們協商、並考慮意圖與公平的階段。",
    "explanation": {
      "detail": "皮亞傑道德發展理論中，逐漸理解規則可由人們協商、並考慮意圖與公平的階段。 相對於把成人規則視為不可改變的他律，道德自律更重視相互尊重與共同同意。",
      "example": "可說：孩子理解遊戲規則不是天生寫死，只要大家同意，就可以公平地改。",
      "clarification": "不是只要滿某個固定歲數就必然自律，也不是指生理週期。"
    },
    "source": {
      "title": "University of Iowa：Piaget on autonomy",
      "url": "https://www2.education.uiowa.edu/html/iae/iae-z-op-devries-1-5.pdf",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk102"
  },
  {
    "title": "黑洞餐廳",
    "level": 2,
    "category": "飲食",
    "answer": "讓客人在黑暗中用餐、主要靠味覺、嗅覺與觸覺體驗食物的餐飲形式。",
    "explanation": {
      "detail": "讓客人在黑暗中用餐、主要靠味覺、嗅覺與觸覺體驗食物的餐飲形式。 有些餐廳由視障服務人員引導；看不到菜色時，食材與口感的辨認方式會和平常不同。",
      "example": "可說：你看不見盤子裡是什麼，要靠味道與觸感猜，像餐桌上的感官實驗。",
      "clarification": "不是天文黑洞，也不表示所有這類餐廳的服務規則都相同。"
    },
    "source": {
      "title": "Dans le Noir：巴黎黑暗用餐體驗",
      "url": "https://paris.danslenoir.com/en_GB/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk103"
  },
  {
    "title": "泡泡聊天",
    "level": 1,
    "category": "文化",
    "answer": "DearU bubble 提供藝人訊息與粉絲回覆的訂閱服務，介面營造私人聊天感。",
    "explanation": {
      "detail": "DearU bubble 提供藝人訊息與粉絲回覆的訂閱服務，介面營造私人聊天感。 粉絲在自己的聊天室接收藝人發送的內容並能回覆；看似私訊的呈現方式不代表每則訊息只傳給單一粉絲。",
      "example": "可說：像手機裡有藝人的聊天視窗，收到他的近況並可以留言。",
      "clarification": "不要把聊天介面當成保證獨享的一對一對話。"
    },
    "source": {
      "title": "DearU：bubble",
      "url": "https://www.dear-u.co/pages/business_bubble.php",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk104"
  },
  {
    "title": "鷹架論",
    "level": 2,
    "category": "教育",
    "answer": "學習時提供適量暫時協助，等學習者能力提升後逐漸撤去支持的教學概念。",
    "explanation": {
      "detail": "學習時提供適量暫時協助，等學習者能力提升後逐漸撤去支持的教學概念。 老師可以示範、提示或拆解任務，並依學生目前能力調整幫忙的程度；名稱比喻施工用的鷹架。",
      "example": "可說：先陪孩子一步一步做，熟悉後少給提示，最後讓他自己完成。",
      "clarification": "不是替學生永遠完成全部工作，也不只是建築工程理論。"
    },
    "source": {
      "title": "Wikipedia：Instructional scaffolding",
      "url": "https://en.wikipedia.org/wiki/Instructional_scaffolding",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk105"
  },
  {
    "title": "利他能",
    "level": 3,
    "category": "醫學",
    "answer": "Ritalin 的中文商品名，其成分 methylphenidate 是中樞神經刺激藥。",
    "explanation": {
      "detail": "Ritalin 的中文商品名，其成分 methylphenidate 是中樞神經刺激藥。 這類處方藥用於特定診斷，例如注意力不足過動症；作用分類是刺激劑，不是一般鎮靜藥。",
      "example": "可說：名字像利他的能力，實際是一種藥品品牌，主要線索是注意力相關治療。",
      "clarification": "題目只是介紹名稱，不能據此自行服用或調整藥物。"
    },
    "source": {
      "title": "MedlinePlus：Methylphenidate",
      "url": "https://medlineplus.gov/druginfo/meds/a682188.html",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk106"
  },
  {
    "title": "螞蟻農夫",
    "level": 1,
    "category": "動物",
    "answer": "會培養真菌作為食物的螞蟻，切葉蟻是著名例子。",
    "explanation": {
      "detail": "會培養真菌作為食物的螞蟻，切葉蟻是著名例子。 牠們把植物材料帶回巢內，用來培養菌園；背葉片的行為不是單純把葉子當沙拉直接吃。",
      "example": "可說：像農夫把材料搬進溫室養菇，螞蟻也會在巢裡種自己的食物。",
      "clarification": "這是對行為的比喻，不是螞蟻拿鋤頭種稻米。"
    },
    "source": {
      "title": "Wikipedia：Leafcutter ant",
      "url": "https://en.wikipedia.org/wiki/Leafcutter_ant",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk107"
  },
  {
    "title": "拿了錢就跑",
    "level": 2,
    "category": "藝術",
    "answer": "藝術家 Jens Haaning 在 2021 年交出空白畫布、保留博物館借款的作品 Take the Money and Run。",
    "explanation": {
      "detail": "藝術家 Jens Haaning 在 2021 年交出空白畫布、保留博物館借款的作品 Take the Money and Run。 原本委託涉及以現金呈現收入差異，他改以空白作品回應，讓藝術、勞動與報酬的爭議成為作品脈絡。",
      "example": "可說：博物館期待作品裡有鈔票，收到的卻是空畫布，名稱也直白地呼應這件事。",
      "clarification": "不是女藝術家事件，也不等於任何偷錢都自動成為藝術。"
    },
    "source": {
      "title": "Kunsten：Take the Money and Run",
      "url": "https://www.kunsten.dk/de/node/233",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk108"
  },
  {
    "title": "垃圾桶決策",
    "level": 3,
    "category": "管理",
    "answer": "把組織決策看成問題、方案、參與者與選擇時機偶然匯合的模型。",
    "explanation": {
      "detail": "把組織決策看成問題、方案、參與者與選擇時機偶然匯合的模型。 Cohen、March 與 Olsen 在 1972 年提出，特別適用於目標含糊、參與流動、方法不明確的組織情境。",
      "example": "可說：可能先有想推的方案，等某個會議、某群人與一個問題湊在一起，方案才被採用。",
      "clarification": "不是把不喜歡的意見直接丟垃圾桶，也不是所有決策都毫無理由。"
    },
    "source": {
      "title": "Wikipedia：Garbage can model",
      "url": "https://en.wikipedia.org/wiki/Garbage_can_model",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk109"
  },
  {
    "title": "地球三明治",
    "level": 1,
    "category": "迷因",
    "answer": "在地球相對的兩個對蹠點同時放麵包，把整顆地球當成夾心的玩笑挑戰。",
    "explanation": {
      "detail": "在地球相對的兩個對蹠點同時放麵包，把整顆地球當成夾心的玩笑挑戰。 Ze Frank 曾號召這種網路活動；兩片麵包要在地球的正對面，才符合把地球夾起來的想像。",
      "example": "可說：一片在這頭，另一片在地球另一面，中間的超大餡料就是整顆地球。",
      "clarification": "不是把兩片麵包隨便放在不同國家，就一定是對蹠點。"
    },
    "source": {
      "title": "Wikipedia：Antipodes",
      "url": "https://en.wikipedia.org/wiki/Antipodes",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk110"
  },
  {
    "title": "紅心皇后理論",
    "level": 3,
    "category": "生物",
    "answer": "生物需持續演化，才可能在其他物種也不斷變化的環境中維持相對適應的假說。",
    "explanation": {
      "detail": "生物需持續演化，才可能在其他物種也不斷變化的環境中維持相對適應的假說。 名稱呼應《鏡中奇遇》中不停奔跑才能留在原地的情境，常用來談捕食者與獵物、宿主與寄生者的共同演化。",
      "example": "可說：獵物更會逃，掠食者也得更會追；一方進步，不表示從此永遠安全。",
      "clarification": "是演化假說，不是說每個生物都必須每天變種。"
    },
    "source": {
      "title": "Wikipedia：Red Queen hypothesis",
      "url": "https://en.wikipedia.org/wiki/Red_Queen_hypothesis",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk111"
  },
  {
    "title": "軍刀症候群",
    "level": 3,
    "category": "醫學",
    "answer": "一種先天肺部血管異常，部分右肺靜脈回流路徑異常，影像可呈軍刀般曲線。",
    "explanation": {
      "detail": "一種先天肺部血管異常，部分右肺靜脈回流路徑異常，影像可呈軍刀般曲線。 Scimitar 指彎刀；名稱來自胸部影像中的靜脈外形，並可能伴隨右肺發育不全等變化。",
      "example": "可說：醫師看到一條彎曲血管影像像軍刀，因此用刀的形狀來命名。",
      "clarification": "不是肺裡長了一把刀，也不是把整個肺說成刀形。"
    },
    "source": {
      "title": "NCBI MeSH：Scimitar Syndrome",
      "url": "https://www.ncbi.nlm.nih.gov/mesh/68012587",
      "checkedAt": "2026-10-12"
    },
    "aliases": [
      "軍刀綜合症"
    ],
    "id": "bk112"
  },
  {
    "title": "窗戶逛街",
    "level": 1,
    "category": "語言",
    "answer": "英文 window shopping 的趣味直譯，指瀏覽商店與櫥窗但沒有實際購買。",
    "explanation": {
      "detail": "英文 window shopping 的趣味直譯，指瀏覽商店與櫥窗但沒有實際購買。 重點是看看商品、享受逛街過程，可以只是觀察和比較，不一定要走進店內付款。",
      "example": "可說：走過一排店，看看衣服和價格，最後一件都沒買。",
      "clarification": "不是買窗戶，也不是人在自家窗邊移動。"
    },
    "source": {
      "title": "Wikipedia：Window shopping",
      "url": "https://en.wikipedia.org/wiki/Window_shopping",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk113"
  },
  {
    "title": "巴斯卡三角形",
    "level": 2,
    "category": "數學",
    "answer": "邊緣為 1、內部每個數等於上一排相鄰兩數相加的三角排列。",
    "explanation": {
      "detail": "邊緣為 1、內部每個數等於上一排相鄰兩數相加的三角排列。 它包含二項式係數；從 1 開始，後續可出現 1、2、1 與 1、3、3、1 等排列。",
      "example": "可說：像每格接住上面左右兩格的總和，一層層排成三角。",
      "clarification": "基本規則是相加，不是兩個數相乘。"
    },
    "source": {
      "title": "Wikipedia：Pascal triangle",
      "url": "https://en.wikipedia.org/wiki/Pascal%27s_triangle",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk114"
  },
  {
    "title": "舌尖效應",
    "level": 2,
    "category": "心理",
    "answer": "確信知道某個詞、卻一時想不起來，並可能記得部分讀音或線索的提取現象。",
    "explanation": {
      "detail": "確信知道某個詞、卻一時想不起來，並可能記得部分讀音或線索的提取現象。 英文 tip-of-the-tongue，常見於想不起人名或特定字詞時；感覺答案快要說出來，卻卡住了。",
      "example": "可說：明明認得那位演員，也知道名字像三個字，就是怎樣都講不出來。",
      "clarification": "不是舌頭的生理觸覺，也不表示所有失憶都屬於這種現象。"
    },
    "source": {
      "title": "Wikipedia：Tip of the tongue",
      "url": "https://en.wikipedia.org/wiki/Tip_of_the_tongue",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk115"
  },
  {
    "title": "一滴血原則",
    "level": 3,
    "category": "歷史",
    "answer": "美國歷史上的種族分類觀念，將有任何非洲血統者歸入黑人類別。",
    "explanation": {
      "detail": "美國歷史上的種族分類觀念，將有任何非洲血統者歸入黑人類別。 這套觀念與種族歧視及隔離制度相關，把血統當作社會分類依據，而非科學上的人類分類方法。",
      "example": "可說：即使祖先只有部分非洲血統，當時的歧視制度仍可能據此替人分類。",
      "clarification": "是歷史上的歧視觀念，不是現代生物學定律。"
    },
    "source": {
      "title": "Wikipedia：One-drop rule",
      "url": "https://en.wikipedia.org/wiki/One-drop_rule",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk116"
  },
  {
    "title": "老祖母原則",
    "level": 2,
    "category": "心理",
    "answer": "以較偏好的活動作為完成較不偏好活動後的獎勵，又稱普雷馬克原則。",
    "explanation": {
      "detail": "以較偏好的活動作為完成較不偏好活動後的獎勵，又稱普雷馬克原則。 重點在行為的相對偏好程度；常以先做需要完成的事，再做喜歡的事來說明。",
      "example": "可說：先整理好玩具，之後就能去玩最喜歡的遊戲。",
      "clarification": "不是凡是祖母說的話都正確，也不只適用於食物獎勵。"
    },
    "source": {
      "title": "Wikipedia：Premack principle",
      "url": "https://en.wikipedia.org/wiki/Premack_principle",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk117"
  },
  {
    "title": "鉤吻",
    "level": 3,
    "category": "植物",
    "answer": "學名 Gelsemium elegans 的有毒藤本植物，亦有斷腸草等俗名。",
    "explanation": {
      "detail": "學名 Gelsemium elegans 的有毒藤本植物，亦有斷腸草等俗名。 名稱指一種植物，其毒性使誤食具有危險；俗名並不代表能憑外形或這段說明安全辨識。",
      "example": "可說：名字像武術招式，其實是一種要避免誤食的植物。",
      "clarification": "不同地區斷腸草俗名可能指不同植物，不能據此食用或配藥。"
    },
    "source": {
      "title": "中國植物志：鉤吻",
      "url": "https://www.iplant.cn/info/钩吻?t=r",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk118"
  },
  {
    "title": "空氣花",
    "level": 2,
    "category": "植物",
    "answer": "通常指鐵蘭屬 Tillandsia 的空氣鳳梨，常能附生在其他物體上。",
    "explanation": {
      "detail": "通常指鐵蘭屬 Tillandsia 的空氣鳳梨，常能附生在其他物體上。 部分種類的葉片有吸收水分的鱗毛，根主要用來固定；不種在一般土壤裡，仍需要水分與合適環境。",
      "example": "可說：看起來能掛在木頭或架子上生長，但不是完全不用喝水。",
      "clarification": "不是只靠空氣就永遠不需水與養分，也不是花朵漂浮。"
    },
    "source": {
      "title": "Wikipedia：Tillandsia",
      "url": "https://en.wikipedia.org/wiki/Tillandsia",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk119"
  },
  {
    "title": "生命之星",
    "level": 2,
    "category": "標誌",
    "answer": "緊急醫療救護常用的藍色六角星標誌，中間有單蛇纏杖。",
    "explanation": {
      "detail": "緊急醫療救護常用的藍色六角星標誌，中間有單蛇纏杖。 六個角常連結救護流程的不同階段；中心是阿斯克勒庇俄斯之杖的意象，用於醫療相關識別。",
      "example": "可說：救護車上常見那顆六個尖角、裡面有蛇與杖的星星。",
      "clarification": "不是五角星，也不要與雙蛇有翅膀的商神杖混同。"
    },
    "source": {
      "title": "Wikipedia：Star of Life",
      "url": "https://en.wikipedia.org/wiki/Star_of_Life",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk120"
  },
  {
    "title": "鴿子與豌豆",
    "level": 3,
    "category": "藝術",
    "answer": "畢卡索 1911 年的畫作 Le Pigeon aux petits pois，曾在 2010 年巴黎現代藝術博物館失竊。",
    "explanation": {
      "detail": "畢卡索 1911 年的畫作 Le Pigeon aux petits pois，曾在 2010 年巴黎現代藝術博物館失竊。 它屬於畢卡索的立體派創作脈絡；題名指鴿子與豌豆，不是菜單，也不是作品失竊後狀態的最新通報。",
      "example": "可說：聽起來像一道料理，其實是一幅有著名失竊事件的畫。",
      "clarification": "不要把畫作題名當成真實食譜，也不據此判斷現在是否已尋回。"
    },
    "source": {
      "title": "Wikipedia：Le pigeon aux petits pois",
      "url": "https://en.wikipedia.org/wiki/Le_pigeon_aux_petits_pois",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk121"
  },
  {
    "title": "伐爾沙瓦動作",
    "level": 3,
    "category": "醫學",
    "answer": "對抗關閉氣道的用力呼氣動作，會改變胸腔壓力並影響心血管反應。",
    "explanation": {
      "detail": "對抗關閉氣道的用力呼氣動作，會改變胸腔壓力並影響心血管反應。 英文 Valsalva manoeuvre，名稱來自醫學家 Valsalva；臨床可用於特定檢查，反應依方式與個人狀況不同。",
      "example": "可說：重點是出力但空氣不易出去，胸腔裡的壓力會改變。",
      "clarification": "不是保證能預防運動傷害的技巧；這段是名詞解釋，不是操作教學。"
    },
    "source": {
      "title": "PubMed：The Valsalva manoeuvre physiology and clinical examples",
      "url": "https://pubmed.ncbi.nlm.nih.gov/26662857/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk122"
  },
  {
    "title": "糖蜜災難",
    "level": 2,
    "category": "歷史",
    "answer": "1919 年波士頓儲存糖蜜的大型槽體破裂，糖蜜湧入街區造成傷亡的事件。",
    "explanation": {
      "detail": "1919 年波士頓儲存糖蜜的大型槽體破裂，糖蜜湧入街區造成傷亡的事件。 糖蜜是製糖相關的黏稠液體；大量液體瞬間釋放，會形成猛烈流動與破壞，不只是把地面弄黏。",
      "example": "可說：像洪水一樣湧來的居然不是水，而是一大槽糖蜜。",
      "clarification": "不是糖果中毒事件，也不是用糖蜜製造炸彈。"
    },
    "source": {
      "title": "Wikipedia：Great Molasses Flood",
      "url": "https://en.wikipedia.org/wiki/Great_Molasses_Flood",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk123"
  },
  {
    "title": "狐狸叫",
    "level": 3,
    "category": "地理",
    "answer": "香港西貢一帶的地名，與狐狸真的發出叫聲是不同層次的意思。",
    "explanation": {
      "detail": "香港西貢一帶的地名，與狐狸真的發出叫聲是不同層次的意思。 地方名稱的由來有不同說法；可辨認的正解是這是一個地名，不宜把某個傳說當成唯一已證實的起源。",
      "example": "可說：問題問狐狸叫，答案可能不是動物聲音，而是香港某個地方。",
      "clarification": "地名的故事與歷史證據要分開，不保證名稱代表當地有狐狸。"
    },
    "source": {
      "title": "港專：分析地名來歷",
      "url": "https://www.hkct.edu.hk/tc/abouthkct/media-centre/press-release/column-20220720",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk124"
  },
  {
    "title": "恆河猴實驗",
    "level": 2,
    "category": "心理",
    "answer": "哈洛以幼猴與代理母親研究依附，發現幼猴偏愛提供柔軟接觸的布母親。",
    "explanation": {
      "detail": "哈洛以幼猴與代理母親研究依附，發現幼猴偏愛提供柔軟接觸的布母親。 經典比較中，鐵絲代理母親雖提供奶，布代理母親的接觸安慰仍受到偏好，凸顯依附並不只由餵食解釋。",
      "example": "可說：有奶喝的與抱起來舒服的不是同一個，幼猴仍常去抱柔軟的那個。",
      "clarification": "不要反過來說幼猴最依戀會攻擊牠的鐵絲母親。"
    },
    "source": {
      "title": "Harlow：The Nature of Love",
      "url": "https://psychclassics.yorku.ca/Harlow/love.htm",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk125"
  },
  {
    "title": "帕夫洛夫的狗",
    "level": 1,
    "category": "心理",
    "answer": "以狗的唾液反應說明古典制約：原本中性的訊號與食物配對後也能引出反應。",
    "explanation": {
      "detail": "以狗的唾液反應說明古典制約：原本中性的訊號與食物配對後也能引出反應。 食物本來會引發唾液，當聲音等訊號反覆與食物相連結，動物便可能對訊號形成條件反射。",
      "example": "可說：原本只有看到食物才流口水，之後聽到提示聲就開始期待食物。",
      "clarification": "不是狗聽得懂完整的人類命令；實驗也不只限於鐘聲。"
    },
    "source": {
      "title": "Wikipedia：Classical conditioning",
      "url": "https://en.wikipedia.org/wiki/Classical_conditioning",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk126"
  },
  {
    "title": "蝌蝌啃蠟",
    "level": 2,
    "category": "語言",
    "answer": "流傳於可口可樂中文命名故事的趣味音譯，正式採用與改名的傳說有史實爭議。",
    "explanation": {
      "detail": "流傳於可口可樂中文命名故事的趣味音譯，正式採用與改名的傳說有史實爭議。 中文字模仿 Coca-Cola 的聲音，卻讓人聯想到蝌蚪吃蠟，因此常被用作不佳品牌翻譯的例子。",
      "example": "可說：同樣要模仿英文發音，字選得不好，就會讓飲料名字聽起來像蝌蚪吃蠟。",
      "clarification": "可以解釋這個流傳的譯名，但不要把征名獎金、銷量或正式舊名的傳說當成已證實歷史。"
    },
    "source": {
      "title": "Wikipedia：可口可樂",
      "url": "https://zh.wikipedia.org/wiki/可口可樂",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk127"
  },
  {
    "title": "間間觀音",
    "level": 3,
    "category": "民俗",
    "answer": "日本愛知縣小牧市龍音寺的觀音信仰，以安產、授乳等祈願聞名。",
    "explanation": {
      "detail": "日本愛知縣小牧市龍音寺的觀音信仰，以安產、授乳等祈願聞名。 日文寫作間々観音，廟內的乳房意象與相關祈願使它廣受注意；此處介紹的是宗教與民俗。",
      "example": "可說：外觀線索很特別，但它是觀音寺院，大家去為生產與哺乳相關心願祈福。",
      "clarification": "不是神道神社，也不能把祈願故事當成醫療效果證據。"
    },
    "source": {
      "title": "愛知縣官方觀光：間々観音",
      "url": "https://aichinow.pref.aichi.jp/spots/detail/2233",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk128"
  },
  {
    "title": "鴨蛋教",
    "level": 3,
    "category": "文化",
    "answer": "一貫道在臺灣曾被使用的帶貶抑意味舊稱。",
    "explanation": {
      "detail": "一貫道在臺灣曾被使用的帶貶抑意味舊稱。 這是歷史社會對宗教的稱呼與誤解脈絡，不是一個獨立的鴨蛋崇拜教派；今日介紹時應區分正式名稱與舊稱。",
      "example": "可說：名字很像把蛋拿來拜，其實是在舊時語境中稱呼一貫道。",
      "clarification": "不要用這個詞證明信徒崇拜鴨蛋，也不要把舊稱當成正式教名。"
    },
    "source": {
      "title": "安東道場：道場沿革",
      "url": "https://www.an-dong.com/history/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk129"
  },
  {
    "title": "廁所女神",
    "level": 2,
    "category": "音樂",
    "answer": "日本歌手植村花菜的歌曲《トイレの神様》，以祖母與童年回憶為重要內容。",
    "explanation": {
      "detail": "日本歌手植村花菜的歌曲《トイレの神様》，以祖母與童年回憶為重要內容。 歌曲把打掃廁所的教誨與親情連在一起；名稱雖像神祇名，這題主要辨認的是歌曲及其敘事主題。",
      "example": "可說：不是先去查神話，而是想到一首用祖母回憶談親情的日文歌。",
      "clarification": "介紹作品即可，不需要背歌詞，也不要當成真實神靈存在的證據。"
    },
    "source": {
      "title": "Wikipedia：Toilet no Kamisama",
      "url": "https://en.wikipedia.org/wiki/Toilet_no_Kamisama",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk130"
  },
  {
    "title": "亞東六眼幽靈",
    "level": 3,
    "category": "動物",
    "answer": "一種在中國記錄的幽靈蛛科蜘蛛，現行學名 Belisana yadongensis。",
    "explanation": {
      "detail": "一種在中國記錄的幽靈蛛科蜘蛛，現行學名 Belisana yadongensis。 原描述以 Spermophora yadongensis 發表，後來轉入 Belisana；亞東與名稱的地方背景有關，幽靈則來自蜘蛛分類名稱。",
      "example": "可說：聽起來像鬼故事，其實是有學名的小蜘蛛。",
      "clarification": "不是六隻眼睛的幽靈；新舊屬名不同不等於兩種題目。"
    },
    "source": {
      "title": "World Spider Catalog：Belisana yadongensis",
      "url": "https://wsc.nmbe.ch/spec-data/32498",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk131"
  },
  {
    "title": "飛特族",
    "level": 2,
    "category": "文化",
    "answer": "日語 freeter 的中文譯稱，指以打工或非典型雇用為主要工作型態的一群人。",
    "explanation": {
      "detail": "日語 freeter 的中文譯稱，指以打工或非典型雇用為主要工作型態的一群人。 這個詞有日本勞動與青年就業背景，可涉及主動選擇或環境限制，不能把所有人的動機都說成一樣。",
      "example": "可說：不是普通公司全職員工，而是靠兼職或短期工作維持生活的工作型態。",
      "clarification": "不等於所有飛特族都富裕、都靠父母或都拒絕工作。"
    },
    "source": {
      "title": "Wikipedia：Freeter",
      "url": "https://en.wikipedia.org/wiki/Freeter",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk132"
  },
  {
    "title": "貝佛里奇的五大巨人",
    "level": 3,
    "category": "歷史",
    "answer": "1942 年貝佛里奇報告指出的五大社會問題：貧困、疾病、無知、惡劣居住環境與失業。",
    "explanation": {
      "detail": "1942 年貝佛里奇報告指出的五大社會問題：貧困、疾病、無知、惡劣居住環境與失業。 這些問題被比喻為需要擊敗的巨人，與英國戰後福利制度規劃的歷史相關。",
      "example": "可說：政府要面對的怪獸不是神話生物，而是生活裡五種大問題。",
      "clarification": "原文 idleness 在此有就業問題脈絡，不宜簡化成個人的懶惰。"
    },
    "source": {
      "title": "Wikipedia：Beveridge Report",
      "url": "https://en.wikipedia.org/wiki/Beveridge_Report",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk133"
  },
  {
    "title": "老鼠樂園",
    "level": 3,
    "category": "心理",
    "answer": "Rat Park 是比較不同飼養環境下大鼠選擇含嗎啡飲水行為的研究。",
    "explanation": {
      "detail": "Rat Park 是比較不同飼養環境下大鼠選擇含嗎啡飲水行為的研究。 研究以較豐富、有社交的環境與孤立笼養相比，探討環境與藥物使用行為的關系；後續研究與解讀並非毫無爭議。",
      "example": "可說：讓老鼠有同伴和活動空間，再看牠對含藥飲水的選擇是否改變。",
      "clarification": "不能直接推論所有人的成癮都只由環境決定。"
    },
    "source": {
      "title": "Wikipedia：Rat Park",
      "url": "https://en.wikipedia.org/wiki/Rat_Park",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk134"
  },
  {
    "title": "囚牛",
    "level": 3,
    "category": "傳說",
    "answer": "中國龍生九子傳說中，常被描述為喜愛音樂的一子。",
    "explanation": {
      "detail": "中國龍生九子傳說中，常被描述為喜愛音樂的一子。 傳統器物與故事會把它與琴等樂器裝饰連結；不同文獻的九子名單不完全一致。",
      "example": "可說：名字像被關住的牛，其實是龍的孩子，辨認線索是喜歡音樂。",
      "clarification": "是傳說形象，不是動物學物種，也不是所有九子名單都完全相同。"
    },
    "source": {
      "title": "Wikipedia：囚牛",
      "url": "https://zh.wikipedia.org/wiki/囚牛",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk135"
  },
  {
    "title": "伏尼契手稿",
    "level": 3,
    "category": "歷史",
    "answer": "耶魯大學收藏的一部插圖手稿，以難以辨識的書寫系統和未充分解讀的內容聞名。",
    "explanation": {
      "detail": "耶魯大學收藏的一部插圖手稿，以難以辨識的書寫系統和未充分解讀的內容聞名。 頁面有植物、天文等樣貌的插圖，但不能只憑圖像斷定真實內容；名稱來自曾拥有它的書商 Voynich。",
      "example": "可說：一本看似有植物與星圖的古書，文字卻一直很難讀懂。",
      "clarification": "不要把某個未獲共識的破解說法寫成已確定正解。"
    },
    "source": {
      "title": "Yale Beinecke：Voynich Manuscript",
      "url": "https://beinecke.library.yale.edu/collections/highlights/voynich-manuscript",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk136"
  },
  {
    "title": "鐵處女",
    "level": 2,
    "category": "歷史",
    "answer": "被描述為內有尖刺、可關入人體的刑具，但中世紀實際使用的說法缺乏可靠證據。",
    "explanation": {
      "detail": "被描述為內有尖刺、可關入人體的刑具，但中世紀實際使用的說法缺乏可靠證據。 許多知名展示品或故事與較晚的製作、展示和傳說有關；題目應同時辨認外形與歷史可信度。",
      "example": "可說：像帶尖刺的人形櫃子，但博物館展示不代表中世紀真的普遍用過。",
      "clarification": "不要把流行恐怖形象當成已證實的中世紀刑罰史。"
    },
    "source": {
      "title": "Wikipedia：Iron maiden",
      "url": "https://en.wikipedia.org/wiki/Iron_maiden",
      "checkedAt": "2026-10-12"
    },
    "aliases": [
      "鐵處女像"
    ],
    "id": "bk137"
  },
  {
    "title": "青藍冰水",
    "level": 2,
    "category": "文學",
    "answer": "概括《荀子・勸學》中青出於藍、冰寒於水的比喻，常用來談學習帶來的提升。",
    "explanation": {
      "detail": "概括《荀子・勸學》中青出於藍、冰寒於水的比喻，常用來談學習帶來的提升。 藍草取得的青色可比原植物更深，水结成的冰比水冷；後來青出於藍常比喻學生勝過老師。",
      "example": "可說：材料來自原本的東西，經過轉變卻更進一步，像學生學成後超越老師。",
      "clarification": "不是四種顏色的排列，也不是說學習不需要老師。"
    },
    "source": {
      "title": "教育部：青出於藍",
      "url": "https://dict.revised.moe.edu.tw/dictView.jsp?ID=102041&la=0&powerMode=0",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk138"
  },
  {
    "title": "國土鍊成陣",
    "level": 2,
    "category": "動漫",
    "answer": "《鋼之鍊金術師》中的虛構設定，把國家範圍構成巨大鍊成陣。",
    "explanation": {
      "detail": "《鋼之鍊金術師》中的虛構設定，把國家範圍構成巨大鍊成陣。 故事將城市、事件與國土形狀連結成鍊金術計畫；題目辨認的是作品世界的超自然設定。",
      "example": "可說：普通鍊成陣像畫在地上的圓，這個設定則把整個國家變成那個圓的一部分。",
      "clarification": "不是現實科學、地理工程或可操作的鍊金術方法。"
    },
    "source": {
      "title": "Wikipedia：鋼之鍊金術師",
      "url": "https://zh.wikipedia.org/wiki/鋼之鍊金術師",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk139"
  },
  {
    "title": "切香腸戰術",
    "level": 2,
    "category": "政治",
    "answer": "把目標分成很小的一步步推進，讓對方難以針對每一步強烈反抗的策略比喻。",
    "explanation": {
      "detail": "把目標分成很小的一步步推進，讓對方難以針對每一步強烈反抗的策略比喻。 每一片看來都很薄，累積卻可能造成很大的改變；常用於政治、組織或談判的情境。",
      "example": "可說：每次只拿走一點，看似不值得大吵，最後整條卻都被拿走了。",
      "clarification": "不是烹飪刀法，也不代表所有漸進式改變都屬於這種策略。"
    },
    "source": {
      "title": "Wikipedia：Salami slicing tactics",
      "url": "https://en.wikipedia.org/wiki/Salami_tactics",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk140"
  },
  {
    "title": "美女拳法",
    "level": 2,
    "category": "文學",
    "answer": "金庸《神鵰俠侶》中古墓派的虛構拳法，招式以美女形象或典故命名。",
    "explanation": {
      "detail": "金庸《神鵰俠侶》中古墓派的虛構拳法，招式以美女形象或典故命名。 辨認重點是武俠小說、古墓派與招式意象，不是現實中專為漂亮人物設計的健身拳法。",
      "example": "可說：招式像借用古代美女的姿態，成為小說裡的一套武功。",
      "clarification": "屬於小說設定，不能當成已證實的古代武術傳承。"
    },
    "source": {
      "title": "Wikipedia：金庸筆下武功列表",
      "url": "https://zh.wikipedia.org/wiki/美女拳法",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk141"
  },
  {
    "title": "萊姆病",
    "level": 2,
    "category": "醫學",
    "answer": "由特定蜱叮咬傳播、與 Borrelia 細菌有關的感染疾病。",
    "explanation": {
      "detail": "由特定蜱叮咬傳播、與 Borrelia 細菌有關的感染疾病。 名稱來自美國 Lyme 地名，而非萊姆水果；感染表現與進展可能不同，題目辨認重點是細菌與媒介。",
      "example": "可說：名字像水果，實際是被特定蜱傳播的細菌感染。",
      "clarification": "不是吃萊姆引起的病，也不能用單一症狀自行確診。"
    },
    "source": {
      "title": "CDC：How Lyme Disease Spreads",
      "url": "https://www.cdc.gov/lyme/causes/index.html",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk142"
  },
  {
    "title": "蘑菇管理",
    "level": 3,
    "category": "管理",
    "answer": "把員工放在資訊黑暗中、缺乏透明溝通的管理方式比喻。",
    "explanation": {
      "detail": "把員工放在資訊黑暗中、缺乏透明溝通的管理方式比喻。 名稱借用蘑菇生長在暗處的形象，指資訊被控制、員工不明白組織方向或自己處境。",
      "example": "可說：只被叫去做事，卻一直不知道決定背後的原因和公司的計畫。",
      "clarification": "不只是新進員工跑腿，也不是種蘑菇的農業技巧。"
    },
    "source": {
      "title": "Wikipedia：蘑菇管理",
      "url": "https://zh.wikipedia.org/wiki/蘑菇管理",
      "checkedAt": "2026-10-12"
    },
    "aliases": [
      "蘑菇管理定律"
    ],
    "id": "bk143"
  },
  {
    "title": "屁股眨眼",
    "level": 3,
    "category": "運動",
    "answer": "butt wink 的趣味譯稱，指深蹲較深位置出現的骨盆後傾動作。",
    "explanation": {
      "detail": "butt wink 的趣味譯稱，指深蹲較深位置出現的骨盆後傾動作。 從側面可能看見骨盆往內收、下背姿勢跟著改變；這是動作現象的名稱，不能只憑它判定受傷。",
      "example": "可說：蹲到低處時，屁股像突然捲進去一下，所以用了眨眼這個比喻。",
      "clarification": "不是臀部肌肉真的有眼睛，也不是一出現就一定造成傷害。"
    },
    "source": {
      "title": "International Journal of Sports Physical Therapy：Back Squat movement quality",
      "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11534159/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk144"
  },
  {
    "title": "番茄大戰",
    "level": 1,
    "category": "文化",
    "answer": "西班牙 Buñol 的 La Tomatina 節慶，以參加者互丟番茄聞名。",
    "explanation": {
      "detail": "西班牙 Buñol 的 La Tomatina 節慶，以參加者互丟番茄聞名。 這是節慶活動，不是真正軍事戰爭；街道成為番茄投擲的場地，活動有組织與規範。",
      "example": "可說：大家把番茄當作節慶的道具，互相丟得整條街紅通通。",
      "clarification": "不是番茄價格戰，也不是凡是丟食物就叫 La Tomatina。"
    },
    "source": {
      "title": "Wikipedia：La Tomatina",
      "url": "https://en.wikipedia.org/wiki/La_Tomatina",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk145"
  },
  {
    "title": "無聊小鎮",
    "level": 2,
    "category": "地理",
    "answer": "美國奧勒岡州 Boring 地名的玩笑翻譯，名稱與 William H. Boring 有關。",
    "explanation": {
      "detail": "美國奧勒岡州 Boring 地名的玩笑翻譯，名稱與 William H. Boring 有關。 英文 boring 同時有無聊的意思，使這個地名很適合與其他趣味地名做活動或聯名。",
      "example": "可說：小鎮真的叫 Boring，但不能直接推論當地生活一定很無聊。",
      "clarification": "是名字造成的雙關，不是政府因居民太無聊而正式命名。"
    },
    "source": {
      "title": "Wikipedia：Boring Oregon",
      "url": "https://en.wikipedia.org/wiki/Boring,_Oregon",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk146"
  },
  {
    "title": "床山",
    "level": 3,
    "category": "職業",
    "answer": "日本相撲界為力士整理傳統髮髻的專業人員，日語稱 tokoyama。",
    "explanation": {
      "detail": "日本相撲界為力士整理傳統髮髻的專業人員，日語稱 tokoyama。 工作與相撲的髮型、儀式和日常準備相關；名稱指職務，不是力士在比賽中使用的山。",
      "example": "可說：力士出場前那個整齊的髮髻，需要專門的人替他整理。",
      "clarification": "不是摔角招式，也不據此宣稱只有床山能碰力士頭髮。"
    },
    "source": {
      "title": "日本相撲協會：床山一覧",
      "url": "https://sumo.or.jp/IrohaKyokaiMember/tokoyama/",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk147"
  },
  {
    "title": "聰明漢斯",
    "level": 2,
    "category": "心理",
    "answer": "曾被認為會算數的馬，實際表現主要依賴觀察人類無意識給出的線索。",
    "explanation": {
      "detail": "曾被認為會算數的馬，實際表現主要依賴觀察人類無意識給出的線索。 研究者發現牠可能根據提問者或旁觀者的細微姿勢與表情決定何時停止敲蹄，形成聰明漢斯效應。",
      "example": "可說：人以為牠算出答案，其實人自己在快到答案時，無意中給了提示。",
      "clarification": "不是證明馬完全不能學習，而是這次算數表現的解釋不同。"
    },
    "source": {
      "title": "Wikipedia：Clever Hans",
      "url": "https://en.wikipedia.org/wiki/Clever_Hans",
      "checkedAt": "2026-10-12"
    },
    "aliases": [],
    "id": "bk148"
  }
];
const octoberAddition=[
  {
    "id": "bk149",
    "title": "湧升流（Upwelling）",
    "level": 1,
    "category": "海洋",
    "answer": "較深處的海水上升到表層的現象。",
    "aliases": [],
    "explanation": {
      "detail": "較深處的海水上升到表層的現象。 當風把表層海水推開，下方較冷、富含營養鹽的水可上來補位，因此常形成生產力高的海域。",
      "example": "像把表面那層水移走，底下的水往上補。",
      "clarification": "不是海水被加熱煮滾。"
    },
    "source": {
      "title": "NOAA：Upwelling",
      "url": "https://oceanservice.noaa.gov/facts/upwelling.html",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk150",
    "title": "下降流（Downwelling）",
    "level": 2,
    "category": "海洋",
    "answer": "表層海水往較深處下沉的現象。",
    "aliases": [],
    "explanation": {
      "detail": "表層海水往較深處下沉的現象。 例如風把表層水推向岸邊，水堆積後向下沉；方向與湧升流相反。",
      "example": "像把水推到牆邊，上面擠不下就往下走。",
      "clarification": "不是所有往外海流的水都叫下降流。"
    },
    "source": {
      "title": "NOAA：Upwelling",
      "url": "https://oceanservice.noaa.gov/facts/upwelling.html",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk151",
    "title": "副振盪（Seiche）",
    "level": 3,
    "category": "海洋",
    "answer": "封閉或半封閉水域中，水面來回擺動的駐波。",
    "aliases": [],
    "explanation": {
      "detail": "封閉或半封閉水域中，水面來回擺動的駐波。 湖泊、海灣甚至杯中的水都能出現類似晃動；風與氣壓改變可使大型水域持續振盪。",
      "example": "像浴缸裡的水被推到一端，又來回晃。",
      "clarification": "不是每天固定由天體引潮力形成的潮汐。"
    },
    "source": {
      "title": "NOAA：Seiche",
      "url": "https://oceanservice.noaa.gov/facts/seiche.html",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk152",
    "title": "大洋環流（Gyre）",
    "level": 2,
    "category": "海洋",
    "answer": "由多股持續洋流構成的大尺度旋轉海流系統。",
    "aliases": [],
    "explanation": {
      "detail": "由多股持續洋流構成的大尺度旋轉海流系統。 主要副熱帶環流有五個；漂浮垃圾可能在部分區域聚集，但環流本身指水流系統。",
      "example": "像海洋裡非常寬廣的循環輸送帶。",
      "clarification": "不是一個會把船吸下去的小漩渦。"
    },
    "source": {
      "title": "NOAA：Gyre",
      "url": "https://oceanservice.noaa.gov/facts/gyre.html",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk153",
    "title": "氣象海嘯（Meteotsunami）",
    "level": 3,
    "category": "氣象",
    "answer": "由氣壓擾動等快速天氣變化驅動、向外傳播的海嘯型波浪。",
    "aliases": [],
    "explanation": {
      "detail": "由氣壓擾動等快速天氣變化驅動、向外傳播的海嘯型波浪。 它可與快速移動的風暴系統有關，接近淺水陸棚或海灣時可能放大。",
      "example": "不是地震推水，而是移動的天氣擾動激起長波。",
      "clarification": "與封閉水域來回擺盪的副振盪不同。"
    },
    "source": {
      "title": "NOAA：Meteotsunami",
      "url": "https://oceanservice.noaa.gov/facts/meteotsunami.html",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk154",
    "title": "異常巨浪（Rogue wave）",
    "level": 2,
    "category": "海洋",
    "answer": "相較周圍海浪特別高大且常難以預期的單次巨浪。",
    "aliases": [],
    "explanation": {
      "detail": "相較周圍海浪特別高大且常難以預期的單次巨浪。 不同波浪的能量疊加或海流對波浪的集中作用，都可能促成異常大浪。",
      "example": "周圍本來只有一般浪，突然冒出一道巨大的水牆。",
      "clarification": "不必先有海底地震，也不等於海嘯。"
    },
    "source": {
      "title": "NOAA：Rogue waves",
      "url": "https://oceanservice.noaa.gov/facts/roguewaves.html",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk155",
    "title": "河口灣（Estuary）",
    "level": 1,
    "category": "海洋",
    "answer": "河流與海洋交會、常有淡水和海水混合的沿岸水域。",
    "aliases": [],
    "explanation": {
      "detail": "河流與海洋交會、常有淡水和海水混合的沿岸水域。 適應半鹹水的生物可在此棲息；部分大型湖泊沿岸也有功能相似的淡水河口生態系。",
      "example": "像河水與海水會合的育幼場。",
      "clarification": "不能把所有河口灣都說成完全一樣的鹽度。"
    },
    "source": {
      "title": "NOAA：Estuary",
      "url": "https://oceanservice.noaa.gov/facts/estuary.html",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk156",
    "title": "同步潮汐鎖定",
    "level": 2,
    "category": "天文",
    "answer": "天體自轉一圈的時間與繞另一個天體公轉一圈相同的狀態。",
    "aliases": [],
    "explanation": {
      "detail": "天體自轉一圈的時間與繞另一個天體公轉一圈相同的狀態。 月球因此大致以同一面朝向地球；潮汐作用造成的能量耗散可讓自轉逐步同步。",
      "example": "像繞著舞伴轉圈，身體也轉，臉始終朝向對方。",
      "clarification": "不是月球完全沒有自轉。"
    },
    "source": {
      "title": "NASA：Tidal locking",
      "url": "https://science.nasa.gov/moon/tidal-locking/",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk157",
    "title": "太陽的差異自轉",
    "level": 2,
    "category": "天文",
    "answer": "太陽不同緯度區域以不同速度自轉的現象。",
    "aliases": [],
    "explanation": {
      "detail": "太陽不同緯度區域以不同速度自轉的現象。 太陽不是固體球殼，赤道一帶自轉比兩極快。",
      "example": "不像硬球整顆同步轉，而是不同位置各有速度。",
      "clarification": "不是整顆太陽突然改變公轉方向。"
    },
    "source": {
      "title": "NASA：Sun facts",
      "url": "https://science.nasa.gov/sun/facts/",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk158",
    "title": "光球（Photosphere）",
    "level": 1,
    "category": "天文",
    "answer": "太陽主要可見光從中向外發出的那一層。",
    "aliases": [],
    "explanation": {
      "detail": "太陽主要可見光從中向外發出的那一層。 日常所說太陽的表面通常指光球；它屬於太陽大氣的一部分，並不是可站立的固體外殼。",
      "example": "我們看見的亮亮圓盤，大致就是這一層。",
      "clarification": "不是地球大氣裡反射太陽光的雲層。"
    },
    "source": {
      "title": "NASA：Sun facts",
      "url": "https://science.nasa.gov/sun/facts/",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk159",
    "title": "日冕洞（Coronal hole）",
    "level": 3,
    "category": "天文",
    "answer": "日冕中密度較低、在紫外線影像裡顯得較暗的區域。",
    "aliases": [],
    "explanation": {
      "detail": "日冕中密度較低、在紫外線影像裡顯得較暗的區域。 該處的磁力線可延伸到行星際空間，讓太陽物質以高速太陽風形式向外流出。",
      "example": "像太陽外層大氣裡比較稀薄的出口。",
      "clarification": "不是太陽表面真的破了一個通往內部的洞。"
    },
    "source": {
      "title": "NASA：Sun facts",
      "url": "https://science.nasa.gov/sun/facts/",
      "checkedAt": "2026-10-15"
    }
  },
  {
    "id": "bk160",
    "title": "太陽針狀體（Spicule）",
    "level": 3,
    "category": "天文",
    "answer": "太陽表面附近短暫向上噴出的細長電漿流。",
    "aliases": [],
    "explanation": {
      "detail": "太陽表面附近短暫向上噴出的細長電漿流。 它們像草叢般大量出現，物質快速升起後又消退，是太陽大氣中的動態構造。",
      "example": "像太陽邊緣不斷冒出的細細噴泉。",
      "clarification": "不是扎在太陽上的固體針。"
    },
    "source": {
      "title": "NASA：Sun facts",
      "url": "https://science.nasa.gov/sun/facts/",
      "checkedAt": "2026-10-15"
    }
  }
];
const QUESTIONS=Object.freeze([
 ...rows.map(([id,title,level,category,answer,key],index)=>Object.freeze({id,title,level,category,answer,aliases:Object.freeze(id==="bk13"?["光冠"]:[]),explanation:Object.freeze({detail:answer+" "+notes[index][0],example:notes[index][1],clarification:notes[index][2]}),source:Object.freeze({title:sources[key][0],url:sources[key][1],checkedAt:"2026-10-09"})})),
 ...imported.map(q=>Object.freeze({...q,aliases:Object.freeze(q.aliases),explanation:Object.freeze(q.explanation),source:Object.freeze(q.source)})),
 ...octoberAddition.map(q=>Object.freeze({...q,aliases:Object.freeze(q.aliases),explanation:Object.freeze(q.explanation),source:Object.freeze(q.source)}))
]);
module.exports={QUESTIONS};
