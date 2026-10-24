let SongTitleZh;
/* Chinese reference glosses, not claims of official translated titles. No player input leaves the site. */
(function (root) {
  'use strict';
  const titles = Object.freeze({
    ...Object.fromEntries(
      `
Shape of You|你的模樣
Perfect|完美
Thinking Out Loud|大聲說出心裡話
Blank Space|空白
Shake It Off|甩開煩惱
You Belong With Me|你應該和我在一起
Love Story|愛情故事
Hello|你好
Rolling in the Deep|墜入深淵
Someone Like You|像你一樣的人
Uptown Funk|放克上城
Just the Way You Are|你原本的樣子
The Lazy Song|懶人之歌
Locked Out of Heaven|被天堂拒於門外
See You Again|與你再相見
Counting Stars|數星星
Sugar|糖
Memories|回憶
Roar|咆哮
Dark Horse|黑馬
Chandelier|水晶吊燈
Cheap Thrills|廉價的快樂
Radioactive|放射性
Believer|信仰者
Thunder|雷鳴
Viva La Vida|生命萬歲
Yellow|黃色
The Scientist|科學家
Bohemian Rhapsody|波希米亞狂想曲
Never Gonna Give You Up|永遠不會放棄你
Billie Jean|比莉珍（人名音譯）
Thriller|顫慄
Smells Like Teen Spirit|聞起來像青春氣息
Sweet Child O Mine|我親愛的孩子
Take On Me|接受我
Let Her Go|讓她走
All of Me|我的一切
Stay With Me|陪在我身邊
Let It Go|隨它吧
Dance Monkey|跳舞的猴子
Bad Guy|壞傢伙
Blinding Lights|炫目光芒
Flowers|花朵
Stay|留下
Old Town Road|老城路
Astronaut in the Ocean|海洋裡的太空人
Savage Love|狂野的愛
Baby|寶貝
Sorry|對不起
Black or White|黑或白
Beat It|走開
Everybody|每個人
Toxic|有毒
Baby One More Time|寶貝，再一次
Oops!...I Did It Again|哎呀，我又犯了
Complicated|複雜
Girlfriend|女朋友
In the End|到最後
New Divide|新的分界
What I've Done|我所做的一切
Bring Me to Life|讓我重獲生命
Numb|麻木
Livin' on a Prayer|靠祈禱而活
It's My Life|這是我的人生
Don't Look Back in Anger|別帶著憤怒回首
New Rules|新規則
Wonderwall|奇蹟之牆
Levitating|飄浮
Don't Start Now|現在別開始
As It Was|一如從前
Wrecking Ball|破壞球
Party in the USA|美國派對
Anti-Hero|反英雄
Watermelon Sugar|西瓜糖
I Want It That Way|我就要這樣
Hotel California|加州旅館
Sweet Dreams (Are Made of This)|美夢由此而生
Wake Me Up|喚醒我
Hey Brother|嘿，兄弟
Wake Me Up When September Ends|九月結束時叫醒我
Boulevard of Broken Dreams|碎夢大道
Viva Forever|永遠萬歲
Wannabe|想成為
I Will Always Love You|我會永遠愛你
My Heart Will Go On|我心永恆
Take Me Home, Country Roads|鄉村路，帶我回家
Jolene|裘琳（人名音譯）
We Will Rock You|我們將震撼你
Lose Yourself|忘我
Wellerman|威勒曼（船歌名稱音譯）
MONTERO (Call Me By Your Name)|蒙特羅（以你的名字呼喚我）
Peaches|桃子
Unholy|不聖潔
abcdefu|字母髒話諧音歌名
Heat Waves|熱浪
Made You Look|讓你忍不住看
Beautiful Things|美好的事物
In the Stars|在繁星之中
Ghost Town|鬼城
Slow It Down|慢下來
blue|憂鬱
wildflower|野花
do you think you could love me|你覺得你能愛我嗎
Whataya Want from Me|你想要我怎樣
If I Had You|如果我擁有你
For Your Entertainment|供你娛樂
I'm with You|我與你同在
My Happy Ending|我的快樂結局
When You're Gone|當你離去
Sk8er Boi|滑板男孩
Apocalypse|末日
Nothing's Gonna Hurt You Baby|寶貝，沒有什麼能傷害你
K.|K（字母歌名）
Sweet|甜蜜
The Emptiness Machine|空虛機器
Heavy Is the Crown|王冠沉重
Two Faced|雙面人
Lost|迷失
Somewhere I Belong|我的歸屬之地
Faint|微弱
Innocence|純真
Espresso|濃縮咖啡
Too Sweet|太甜
Photograph|照片
Bad Habits|壞習慣
Set Fire to the Rain|點燃雨水
Nothing Breaks Like a Heart|沒有什麼比心更易碎
Easy On Me|對我寬容一點
Late Night Feelings|深夜情緒
Oh My God|我的天啊
When I Was Your Man|當我還是你的男人
Valerie|瓦萊麗（人名音譯）
24K Magic|二十四克拉魔力
We Dem Boyz|我們就是那些傢伙
Black and Yellow|黑與黃
Apologize|道歉
Roll Up|捲起
If I Lose Myself|如果我迷失自己
Payphone|公共電話
I Ain't Worried|我不擔心
Secrets|秘密
Girls Like You|像你這樣的女孩
Moves Like Jagger|像傑格一樣舞動
Firework|煙火
Last Friday Night|上個星期五晚上
Hot N Cold|忽冷忽熱
Unstoppable|勢不可擋
Elastic Heart|有韌性的心
Demons|心魔
Enemy|敵人
Fix You|治癒你
A Sky Full of Stars|繁星滿天
We Are the Champions|我們是冠軍
Somebody to Love|值得去愛的人
Cry for Help|呼救
Smooth Criminal|身手俐落的罪犯
She Wants to Dance with Me|她想和我跳舞
Young Wild & Free|年輕、狂野又自由
Together Forever|永遠在一起
Don't Stop Me Now|現在別阻止我
Whenever You Need Somebody|每當你需要有人陪伴
Come As You Are|以你原本的樣子前來
Heart-Shaped Box|心形盒子
Lithium|鋰
In Bloom|盛開
Welcome to the Jungle|歡迎來到叢林
Don't Cry|別哭
November Rain|十一月的雨
Paradise City|天堂之城
Holes|空洞
The Wrong Direction|錯誤的方向
Ordinary People|平凡人
Heart's on Fire|心在燃燒
Anywhere|任何地方
Love Me Now|現在就愛我
Tonight Best You Ever Had|今晚，最美好的體驗
I'm Not the Only One|我不是唯一的人
You & I Nobody in the World|你和我，世界上無人可比
Too Good at Goodbyes|太擅長告別
Dancing with a Stranger|與陌生人共舞
Into the Unknown|走向未知
For Good|永遠改變
Defying Gravity|挑戰地心引力
I Stand|我堅定站立
Fly Away|飛走
Never Seen the Rain|從未見過雨
Bad Child|壞孩子
Johnny Run Away|強尼逃走了
Lovely|美好
Ocean Eyes|海洋般的雙眼
Birds of a Feather|同類相聚
Starboy|巨星男孩
Happier Than Ever|比以往更快樂
Save Your Tears|省下你的眼淚
The Hills|山丘
Can't Feel My Face|感覺不到我的臉
Malibu|馬里布（地名音譯）
Thousand Miles|千里之外
The Climb|攀登
Without You|沒有你
Love Again|再次去愛
Panini|帕尼尼（三明治名稱）
Nights Like This|這樣的夜晚
Industry Baby|業界之子
That's What I Want|那就是我想要的
Gravity Glidin|隨重力滑行
Say So|就這麼說
Fallout|餘波
Love Yourself|愛你自己
Larger Than Life|超越平凡
As Long As You Love Me|只要你愛我
What Do You Mean|你是什麼意思
Circus|馬戲團
Show Me the Meaning of Being Lonely|讓我明白孤獨的意義
My Immortal|我永恆的愛
Womanizer|花花公子
Call Me When You're Sober|清醒後再打給我
Going Under|沉淪
Always|永遠
You Give Love a Bad Name|你玷污了愛情
Champagne Supernova|香檳超新星
Live Forever|永遠活著
Wanted Dead or Alive|生死通緝
Stop Crying Your Heart Out|別再哭得心碎
Physical|身體的
Houdini|胡迪尼（魔術師人名）
Sign of the Times|時代的徵兆
Adore You|愛慕你
Golden|金色的
Take It Easy|放輕鬆
Desperado|亡命之徒
New Kid in Town|鎮上的新來者
Lyin' Eyes|說謊的眼睛
Here Comes the Rain Again|雨又來了
Who's That Girl|那女孩是誰
There Must Be an Angel|一定有位天使
The Nights|那些夜晚
Would I Lie to You|我會對你說謊嗎
Waiting for Love|等待愛情
Levels|層次
American Idiot|美國白痴
Basket Case|精神崩潰的人
Say You'll Be There|說你會在那裡
Spice Up Your Life|為生活增添滋味
21 Guns|二十一響禮炮
I Wanna Dance with Somebody|我想與人共舞
2 Become 1|二合為一
I Have Nothing|我一無所有
Greatest Love of All|最偉大的愛
The Power of Love|愛的力量
How Will I Know|我怎麼會知道
I'm Alive|我活著
Because You Loved Me|因為你愛過我
Annie's Song|安妮之歌
It's All Coming Back to Me Now|如今一切回到我心中
Rocky Mountain High|洛磯山的高昂心情
9 to 5|朝九晚五
Leaving on a Jet Plane|乘噴射機離去
Sunshine on My Shoulders|肩上的陽光
Coat of Many Colors|彩色外衣
Mrs. Robinson|羅賓森太太
Islands in the Stream|溪流中的島嶼
The Boxer|拳擊手
Bridge Over Troubled Water|惡水上的大橋
Love the Way You Lie|愛你說謊的樣子
Scarborough Fair|史卡博羅市集
Without Me|沒有我
The Real Slim Shady|真正的瘦皮猴
Not Afraid|無所畏懼
Told You So|早就告訴你了
Heather on the Hill|山丘上的石楠花
Highland Girl|高地女孩
fmk|親密、結婚、殺掉（三選一遊戲縮寫）
Catch You When You Fall|在你跌倒時接住你
Pork Soda|豬肉汽水
The Other Side of Paradise|天堂的另一面
Youth|青春
Gooey|黏稠
All About That Bass|就是要那低音
Me Too|我也是
Dear Future Husband|親愛的未來老公
NO|不
Sorry I'm Here For Someone Else|抱歉，我是為別人而來
Never Close Our Eyes|永不閉上雙眼
my light|我的光
Taste|滋味
Feather|羽毛
Nonsense|胡言亂語
Please Please Please|拜託，拜託，拜託
Take Me to Church|帶我去教堂
Work Song|工作之歌
Someone New|新的對象
Cherry Wine|櫻桃酒
Light Up|點亮
Drift|漂流
Cloud 99|第九十九朵雲
Alive|活著
Kung Fu|功夫
Heavenly|如天堂般
kiddie pool|兒童戲水池
ALEX|亞歷克斯（人名音譯）
stay with me?|陪著我，好嗎？
everybody hates me|每個人都討厭我
Into the Sky|飛向天空
scaPEGoat|代罪羔羊
X.U.|X.U.（字母歌名，保留原名）
Binary Star|雙星
Tranquility|寧靜
PROVANT|補給（歌名參考解讀）
Roundabout|迂迴
Walk Like an Egyptian|像埃及人那樣走路
I Want You|我想要你
Last Train Home|回家的末班車
Modern Crusaders|現代十字軍
Freek'n You|為你著迷
Distant Dreamer|遙遠的夢想家
LOST IN PARADISE|迷失天堂
Re:make|重製
Mighty Long Fall|漫長的墜落
Heartache|心痛
Stand Out Fit In|出眾與融入
Renegades|叛逆者
Taking Off|起飛
Make It Out Alive|活著逃出去
Running Up That Hill|跑上那座山丘
End of Beginning|開始的終點
Before My Body Is Dry|在我身體乾涸之前
Legends Never Die|傳奇永不消逝
GODS|眾神
Phoenix|鳳凰
I Really Want to Stay at Your House|我真的很想待在你家
`
        .trim()
        .split('\n')
        .map((line) => line.split('|')),
    ),
    'Ave Mujica': '阿維穆吉卡（專有歌名音譯）',
    'Georgette Me, Georgette You': 'Georgette Me, Georgette You（造詞歌名，保留原文）',
    AIZO: '愛與恨',
    BOOMBAYAH: '嘣吧呀（擬聲歌名）',
    Dingga: '叮嘎（擬聲歌名）',
    LOCO: '瘋狂',
    MEMORIA: '記憶',
    GLORIA: '榮耀',
    katharsis: '淨化',
    Nagisa: '海岸',
    LilaS: '丁香',
    'DDU-DU DDU-DU': '嘟嘟嘟嘟（擬聲歌名）',
    'DALLA DALLA': '與眾不同',
    'Haru Haru': '一天一天',
    Decalcomanie: '印花（轉印畫）',
    'RINGA LINGA': '鈴嘎鈴嘎（擬聲歌名）',
    LATATA: '啦嗒嗒（擬聲歌名）',
    Chacarron: '查卡龍（擬聲歌名）',
    アイドル: '偶像',
    ドラマツルギー: '戲劇性',
    ピースサイン: '和平手勢',
    シルエット: '剪影',
    うっせぇわ: '吵死了',
    ブルーバード: '青鳥',
    私は最強: '我是最強',
    ただ君に晴れ: '只為你放晴',
    怪獣の花唄: '怪獸的花之歌',
    オトノケ: '聲音之怪',
    青のすみか: '青之棲所',
    ライラック: '紫丁香',
    裸の勇者: '赤裸的勇者',
    ミックスナッツ: '綜合堅果',
    イエスタデイ: '昨日',
    カタオモイ: '單戀',
    マリーゴールド: '金盞花',
    アルクアラウンド: '環繞而行',
    チェリー: '櫻桃',
    カメレオン: '變色龍',
    高嶺の花子さん: '高嶺之花的花子小姐',
    クリスマスソング: '聖誕之歌',
    ドライフラワー: '乾燥花',
    ベテルギウス: '參宿四',
    きらり: '閃耀',
    '言って。': '說吧。',
    花に亡霊: '花上的亡靈',
    だから僕は音楽を辞めた: '所以我放棄了音樂',
    ロビンソン: '魯賓遜',
    空も飛べるはず: '應該也能飛向天空',
    君はロックを聴かない: '你不聽搖滾',
    青と夏: '青與夏',
    インフェルノ: '地獄之火',
    'サムライハート (Some Like It Hot!!)': '武士之心',
    ヒロイン: '女主角',
    ハッピーエンド: '圓滿結局',
    瞬き: '眨眼',
    オールドファッション: '老派',
    ノーダウト: '毫無疑問',
    '115万キロのフィルム': '一百一十五萬公里的底片',
    アポトーシス: '細胞凋亡',
    ホワイトノイズ: '白噪音',
    黒のバースデイ: '黑色生日',
    '神さま、バカ': '神明啊，笨蛋',
    白い恋人達: '白色戀人們',
    波乗りジョニー: '衝浪強尼',
    明日晴れるかな: '明天會放晴嗎',
    祭りのあと: '祭典之後',
    真夜中のダンディー: '午夜的紳士',
    明日へのマーチ: '邁向明日的進行曲',
    かくれんぼ: '捉迷藏',
    ピーターパン: '彼得潘',
    シャッター: '快門',
    レオ: '里歐',
    ビリミリオン: '比利米利恩（擬造語歌名）',
    カーテンコール: '謝幕',
    蝶々結び: '蝴蝶結',
    花の唄: '花之歌',
    シリウス: '天狼星',
    ラピスラズリ: '青金石',
    ミカヅキ: '新月',
    それは小さな光のような: '那如同小小的光芒',
    月と花束: '月亮與花束',
    航海の唄: '航海之歌',
    花の塔: '花之塔',
    フラレガイガール: '被甩女孩',
    蝶の飛ぶ水槽: '蝴蝶飛舞的水槽',
    踊り子: '舞者',
    '心做し [LIVE]': '心理作用（現場版）',
    ひび割れた世界: '龜裂的世界',
    かけてあげる: '讓我為你……（依語境表達）',
    もしも僕らがGAMEの主役で: '假如我們是遊戲的主角',
    のびしろ: '成長空間',
    よふかしのうた: '徹夜之歌',
    お気に召すまま: '隨你喜歡',
    ナンセンス文学: '無意義文學',
    ないものねだり: '奢求未擁有的事物',
    フルドライブ: '全速驅動',
    バトンロード: '接力之路',
    ダイバー: '潛水者',
    スパークル: '火花',
    なんでもないや: '沒什麼大不了',
    愛にできることはまだあるかい: '愛還能做些什麼',
    '花は桜 君は美し': '花是櫻花，你是美麗的',
    ありがとう: '謝謝',
    気まぐれロマンティック: '善變的浪漫',
    聖者の行進: '聖者的行進',
    恋風邪にのせて: '乘著戀愛的感冒',
    悪魔の踊り方: '惡魔的舞蹈方式',
    ミュージック: '音樂',
    僕のこと: '關於我',
    人間みたいね: '像人類一樣呢',
    ダンスホール: '舞廳',
    夜の踊り子: '夜之舞者',
    アイデンティティ: '自我認同',
    裸の心: '赤裸的心',
    ハルノヒ: '春日',
    愛を伝えたいだとか: '想傳達愛意之類的',
    美しい鰭: '美麗的鰭',
    カルマ: '業',
    アカシア: '金合歡',
    死ぬのがいいわ: '寧願死去',
    まつり: '祭典',
    満ちてゆく: '逐漸充盈',
    ユートピア: '烏托邦',
    'でもね、たまには': '不過呢，偶爾也',
    サクラキミワタシ: '櫻花、你與我',
    イマジネーション: '想像力',
    現状ディストラクション: '破壞現狀',
    サクラミツツキ: '櫻滿月',
    オレンジ: '橙色',
    命に嫌われている: '被生命所厭惡',
    エミリーと15の約束: '與艾蜜莉的十五個約定',
    世界一幸せなひとりぼっち: '世界上最幸福的孤獨一人',
    เข้ากันดี: '十分合拍',
    ทุกอย่าง: '一切',
    คู่กัน: '天生一對',
    ใกล้: '靠近',
    รอยยิ้ม: '微笑',
    เพลงนั้นยังอยู่: '那首歌依然在',
    คำตอบ: '答案',
    คนนี้: '就是這個人',
    ひゅるりらぱっぱ: '咻嚕哩啦啪啪（擬聲歌名）',
    ホログラム: '全息影像',
    ゴールデンタイムラバー: '黃金時光戀人',
    レイン: '雨',
    つないだ手: '牽著的手',
    瞬間センチメンタル: '瞬間的感傷',
    ホタルノヒカリ: '螢火之光',
    遥か彼方: '遙遠彼方',
    'バクチ・ダンサー': '賭徒舞者',
    光るなら: '若能綻放光芒',
    キラメキ: '閃耀',
    七色シンフォニー: '七色交響曲',
    'おはよう。': '早安。',
    ตกลงฉันคิดไปเองใช่ไหม: '所以都是我自作多情嗎',
    'ยังคู่กัน (Still Together)': '依然相伴',
    คั่นกู: '只因我們天生一對',
    泥中に咲く: '於泥濘中綻放',
    '僕は...': '我……',
    小さな恋のうた: '小小戀歌',
    'ジョジョ その血の記憶～end of THE WORLD～': 'JOJO 那血脈的記憶～世界的終結～',
    'ジョジョ～その血の運命～': 'JOJO～那血脈的命運～',
    裏切り者のレクイエム: '背叛者的安魂曲',
    よあけのうた: '黎明之歌',
    サザンカ: '山茶花',
    スターライトパレード: '星光遊行',
    眠り姫: '睡美人',
    光へ: '向著光',
    徒花ネクロマンシー: '徒花死靈術',
    大河よ共に泣いてくれ: '大河啊，請與我一同哭泣',
    '夢を手に、戻れる場所もない日々を': '手握夢想，度過無處可歸的日子',
    ヨミガエレ: '甦醒吧',
    輝いて: '閃耀吧',
    '目覚めRETURNER (Electric Returner Type R)': '覺醒的歸來者（電音版本）',
    'オトノナルホウヘ→': '朝著聲音的方向→',
    青い栞: '藍色書籤',
    'secret base ～君がくれたもの～ (10 years after ver.)':
      '秘密基地～你給我的東西～（十年後版本）',
    '青のすみか (Acoustic ver.)': '青之棲所（不插電版本）',
    '夜に駆ける [THE HOME TAKE]': '向夜晚奔去（居家現場版本）',
    打上花火: '升空煙火',
    残響散歌: '殘響散歌',
    心予報: '心情預報',
    廻廻奇譚: '迴迴奇譚',
    踊: '舞',
    不可幸力: '不可抗的幸福之力（雙關歌名）',
    白日: '白日',
    一途: '一心一意',
    逆夢: '相反的夢',
    新宝島: '新寶島',
    感電: '觸電',
    天体観測: '天體觀測',
    晩餐歌: '晚餐之歌',
    大不正解: '大錯特錯',
    怪盗: '怪盜',
    壱雫空: '一滴之空',
    '春日影 (MyGO!!!!! ver.)': '春日影（MyGO!!!!!版本）',
    詩超絆: '詩超絆（以詩歌超越羈絆）',
    迷星叫: '迷星叫（迷途之星的吶喊）',
    迷路日々: '迷路的日子',
    碧天伴走: '碧藍天空下並肩奔跑',
    音一会: '一期一會的聲音',
    純恋歌: '純戀歌',
    黄金魂: '黃金魂',
    曖歌: '曖昧之歌',
    恋時雨: '戀愛時雨',
    炎天夏: '烈日之夏',
    堕天: '墮天',
    春泥棒: '偷走春天的人',
    楓: '楓',
    一輪花: '一朵花',
    声: '聲音',
    地獄恋文: '地獄情書',
    嘘: '謊言',
    燈: '燈',
    完全感覚Dreamer: '完全感覺夢想家',
    佐賀事変: '佐賀事變',
    'See Tình': '看見愛情',
    'Kẻ Cắp Gặp Bà Già': '小偷遇見老奶奶',
    'Để Mị nói cho mà nghe': '讓我說給你聽',
    'Gieo Quẻ': '求籤',
    'Bo Xì Bo': '不跟你玩了',
    Despacito: '慢慢來',
    'No Me Doy por Vencido': '我不認輸',
    'Aquí Estoy Yo': '我就在這裡',
    'Échame la Culpa': '怪我吧',
    'Date La Vuelta': '轉過身來',
    'Dame Tu Cosita': '給我你的小東西',
    'El Gato Volador': '飛翔的貓',
    'El Huevo': '雞蛋',
    'El Cubo de Leche': '一桶牛奶',
    'Laxed (Siren Beat)': '放鬆（警笛節奏）',
    群青: '群青',
    怪物: '怪物',
    紅蓮華: '紅蓮華',
    炎: '炎',
    新時代: '新時代',
    唱: '唱',
    勇者: '勇者',
    祝福: '祝福',
    前前前世: '前前前世',
    逆光: '逆光',
    水平線: '水平線',
    花束: '花束',
    宿命: '宿命',
    影色舞: '影色舞',
    睡蓮花: '睡蓮花',
    流星: '流星',
    平行線: '平行線',
    水星: '水星',
    正解: '正解',
    光: '光',
    花: '花',
    虹: '虹',
  });
  function hint(title, language) {
    if (['en', 'zh', 'tw', 'yue', 'viral'].includes(language)) return undefined;
    const zh = titles[title];
    return zh && zh !== title ? '中文參考譯名：' + zh : undefined;
  }
  function decorate(node, title, language) {
    const zh = hint(title, language);
    if (!zh) return node;
    node.dataset.uiHint = '';
    node.title = zh;
    node.setAttribute('aria-label', title + '；' + zh);
    if (!['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName)) node.tabIndex = 0;
    return node;
  }
  const api = { titles, hint, decorate };

  SongTitleZh = api;
})(typeof window === 'object' ? window : globalThis);

export default SongTitleZh;
