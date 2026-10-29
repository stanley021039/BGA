'use strict';
// Narrative adaptation only: CC BY-NC-SA 3.0. See docs/COC-SOURCES.md.
// Keeper-only data. Never import this module into the browser or serialize it.
const META = Object.freeze({
  id: 'different-light-pulp-1',
  title: '異樣之光',
  originalTitle: 'In A Different Light',
  author: 'Dean Engelhardt',
  era: '1928 年春',
  place: '阿卡姆、波士頓及周邊',
  source: 'https://cthulhureborn.wordpress.com/downloads/downloads-rescued-scenarios/',
  license: 'CC BY-NC-SA 3.0',
  note: '依原作主線改編為 COC7／Pulp；使用自行撰寫的中文敘述，不含原書插畫或官方規則原文。',
});
const TRUTH = Object.freeze({
  instigator: 'Nyarlathotep',
  merchantIdentityDiscoverable: false,
  cause:
    'Duncan 從一位早已離開市集的商人獲得燈具技術；粉末實為沉睡者分泌的微生物，能使松果體感官覺醒。Duncan 起初追求學術名聲，後來得知危害而想摧毀燈具，並非主謀。',
  threat:
    '核桃街十二盞燈使居民成為侍從的獵物。Eye Bone Hill 的沉睡者需要最後一份食物，以及 Xoth 的光，才能永久甦醒。',
  victory:
    '在最後供食前停止全部燈具並阻止 Duncan 爆破，或在甦醒時剝奪其感官至少九十分鐘，或迫使其退回洞中。猜測真相不會改變這些事實。',
  geography:
    '沿用原作的虛構地理：Crawford’s Rise 位於阿卡姆西方約七英里，Sudbury 在其西方約兩英里。',
});
const CLUES = {
  farr: {
    title: '失明者的異常',
    text: 'Michael Farr 雖然雙眼重傷，仍準確朝人的位置轉頭。警員說他昨夜發生異常，今早在醫院轉送阿卡姆療養院途中逃離，現在已被警員重新帶回。',
  },
  address: {
    title: '核桃街的住處',
    text: '報紙與警方的公開消息將事件指向核桃街 Simpson 公寓五號房。',
  },
  notebook: {
    title: 'Farr 的觀測紀錄',
    text: '筆記描述新路燈妨礙觀星，隨後出現幾何異象與可怕的黃紅色天體。望遠鏡本身沒有異常。',
  },
  caruso: {
    title: '送奶工的遭遇',
    text: 'Georgio Caruso 曾在核桃街看到透明、可穿過物體的形影；離開燈光後，異象便消失。他住在 South French Hill Street。',
  },
  lamps: {
    title: '十二盞新路燈',
    text: '核桃街最近換裝十二盞新式路燈；夜間光線略帶綠色與珍珠般光澤，周圍幾乎看不到動物。',
  },
  council: {
    title: '市政照明計畫',
    text: '市工程師 Basil Endicott 根據 Hamlin Hayes 博士的建議，採用據稱更省電的新燈具。Hayes 任教於密斯卡托尼克大學。',
  },
  duncan: {
    title: '設計者的姓名',
    text: '新燈具的設計者是波士頓大學的 Graham Duncan 教授；Hayes 是在一次學術演講中聽到他的成果。',
  },
  coating: {
    title: '論文遺漏的關鍵',
    text: '燈泡內壁的特殊塗層才是異常效率的關鍵；論文詳細談到結構，卻含糊帶過塗層成分。',
  },
  homeAddress: {
    title: '教授的住址',
    text: 'Duncan 已被要求休假，搬走了實驗材料。同事提供他的住址；他近來擔心研究被竊取。',
  },
  diary: {
    title: 'Duncan 的研究日記',
    text: 'Duncan 在校園附近市集買到奇特檯燈，跟商人到阿卡姆附近山洞取得粉末，之後製作十二盞路燈。日記後期開始記錄異象與猜疑，描述路線的一頁被撕去。',
  },
  secondSight: {
    title: '超出五感的筆記',
    text: '藏在書架中的筆記指出：強光下出現的透明生物與黑影並非隨機幻覺，而是一種能重複觀測的感知。',
  },
  map: {
    title: '藏起來的路線圖',
    text: '筆記黏合的頁面中藏著日記缺頁，標出 Sudbury、廢村 Crawford’s Rise，以及附近的 Eye Bone Hill。',
  },
  merchant: {
    title: '五十年前的燈商',
    text: '書商 Shepley Herber 記得那名燈商與五十年前到過 Crawford’s Rise 的人極其相似。燈商早已離開，沒有人知道如何追查。',
  },
  disappearance: {
    title: '1880 年的失蹤案',
    text: 'Crawford’s Rise 的居民曾在 1880 年春天全部失蹤。當時也有奇異燈籠、個性轉變與夜間失蹤的傳聞。',
  },
  jed: {
    title: '老 Jed 的見聞',
    text: 'Jed Ashcroft 的弟弟曾看到村民打碎燈籠、在公地點起綠色篝火，Edgar Jamison 帶領眾人吟唱。弟弟帶回的最後描述是「山吞掉了他們」。',
  },
  jamison: {
    title: 'Jamison 的調查筆記',
    text: '廢村屋中的筆記保留了當地失蹤事件、燈籠與一段剝奪感官的儀式。作者打算讓居民停止使用燈籠。',
  },
  chant: {
    title: '剝奪感官的儀式',
    text: '完整儀式需要持續吟唱一小時，由一位施法者主導，可由其他已學會者協助。只能在夜間十一點以後開始，須接近目標，且會消耗魔力與理智。',
  },
  powder: {
    title: '發光粉末的分析',
    text: '粉末是未知微生物而非礦物，受到光照後釋出超出所吸收的能量。一般加熱或化學處理無法使它失效。',
  },
  sleeping: {
    title: '山洞深處的存在',
    text: '發光洞壁包圍著無法以普通視覺看清的柱林、階梯與巨物；覺醒的感官能看到它，以及附近盤旋的侍從。',
  },
  duncanAlly: {
    title: '署名 Lucifer 的便條',
    text: '來信者承認燈光造成危害，希望停止核桃街的災難，並暗示有一個讓山崩落的計畫。他答應再聯絡。',
  },
  appointment: {
    title: '市政倉庫之約',
    text: 'Duncan 來電約今晚十點在市政工程倉庫外見面。他說那東西即將吃飽，但很快又因猜疑而掛斷電話。',
  },
  brokenLamp: {
    title: '破燈與彈殼',
    text: '新一輪事件後，一盞路燈被子彈打碎。有人見到穿深色長外套的人避著燈光行動。',
  },
  physiology: {
    title: '受害者的共同點',
    text: '受害者身上缺少的部位都與松果體有關。無法以一般野獸攻擊解釋。',
  },
};
const SCENES = {
  home: {
    name: '阿卡姆 · 調查者的住處',
    description:
      '春日星期天早上，街巷傳來急促腳步與警哨。一位眼睛受傷的男子闖進院落；警員正追趕而來。',
  },
  walnut: {
    name: '阿卡姆 · 核桃街',
    description:
      'Simpson 公寓與民宅排列在街旁。十二根新路燈是這條舊街最顯眼的公共建設，居民對近日的怪事各有說法。',
  },
  sanitarium: {
    name: '阿卡姆療養院',
    description: '院方要求訪客說明調查理由，並提醒談話須顧及病人的狀況。',
  },
  records: {
    name: '阿卡姆 · 公開紀錄與大學圖書館',
    description: '報紙、市政會議紀錄與地方志可供查閱；更完整的民俗資料保存在大學館藏。',
  },
  hayes: {
    name: '密斯卡托尼克大學 · Hayes 的辦公室',
    description: 'Hayes 的行程忙碌，但對新照明技術很有興趣。他願意在預約時間會面。',
  },
  boston: {
    name: '波士頓大學 · 工程系',
    description:
      '系辦不願在電話裡透露 Duncan 的情況。親自說明來意後，同事與研究生可以提供更多背景。',
  },
  house: {
    name: '波士頓 · Duncan 的住處',
    description: '兩層住宅大門緊閉，鄰居會留意可疑的破壞行為。屋內沒有近日有人居住的跡象。',
  },
  bazaar: {
    name: '波士頓 · 大學附近市集',
    description: '原先販售特殊燈具的攤位早已撤走。附近仍有熟悉往事的書商。',
  },
  sudbury: {
    name: 'Sudbury · 雜貨店與養蜂場',
    description:
      '當地老人還記得 Crawford’s Rise 的失蹤傳聞。養蜂人 Jed Ashcroft 的記憶來自親身經歷。',
  },
  rise: {
    name: 'Crawford’s Rise · 廢村',
    description:
      '廢棄房屋與荒草圍著公地。較大的宅邸曾屬於研究當地民俗的 Edgar Jamison。Eye Bone Hill 坐落在西北方。',
  },
  cave: {
    name: 'Eye Bone Hill · 山洞',
    description:
      '北坡岩石間露出洞口。約二十英尺長的通道通往大洞窟；照明落在洞壁上，便浮現奇異光澤。',
  },
  warehouse: {
    name: '阿卡姆 · 市政工程倉庫',
    description: '灰色倉庫臨街，門前的車道狹窄。這裡是 Duncan 約定的會面地點。',
  },
  hill: {
    name: 'Eye Bone Hill · 月下山坡',
    description:
      '月光灑在洞口與不穩的岩坡上。Duncan 的行動，以及山洞裡的動靜，將決定接下來的局面。',
  },
};
const A = (id, label, scene, minutes, extra = {}) => ({ id, label, scene, minutes, ...extra });
const ACTIONS = [
  A('examine-farr', '觀察男子並向警員詢問', 'home', 10, {
    clues: ['farr', 'address'],
    sanity: ['0', '1d2'],
    mundane: true,
  }),
  A('search-farr', '拜訪公寓並檢查 Farr 的觀測用品', 'walnut', 30, {
    clues: ['notebook', 'lamps', 'caruso'],
  }),
  A('talk-caruso', '訪問送奶工與附近居民', 'walnut', 30, {
    clues: ['caruso'],
    before: 2 * 1440 + 120,
  }),
  A('study-lamps', '查看路燈與照明範圍', 'walnut', 10, { clues: ['lamps'] }),
  A('isolate-lamps', '與市政單位合作停用並封存全部路燈', 'walnut', 180, {
    requires: ['lamps'],
    effect: 'stopLamps',
    party: true,
    confirm: true,
    risk: '需要三小時，並向市政單位說明危害；路燈將停止使用並封存。',
  }),
  A('break-lamps', '自行打碎全部新路燈', 'walnut', 60, {
    requires: ['lamps'],
    effect: 'breakLamps',
    party: true,
    confirm: true,
    risk: '會破壞十二盞公共路燈，可能引來警方；需要一小時。粉末仍可能發光，碎片須遮光收存。',
  }),
  A('visit-farr', '說明調查理由並探視 Farr', 'sanitarium', 60, {
    clues: ['farr', 'address'],
    check: {
      skill: 'psychoanalysis',
      difficulty: 'regular',
      detail: 'Farr 提到他看到了一顆有觸鬚的星，並以為自己發現了它。',
      failure: 'Farr 的情緒無法穩定；院方請你稍後再來。主要事件與住址仍可查到。',
    },
  }),
  A('public-records', '調查照明計畫與地方新聞', 'records', 60, { clues: ['council', 'lamps'] }),
  A('local-history', '查閱 Crawford’s Rise 的地圖與民俗', 'records', 180, {
    requiresAny: ['map', 'merchant'],
    clues: ['disappearance', 'chant'],
    effect: 'findBook',
    confirm: true,
    risk: '查閱約需三小時；取得儀式資料仍須另外學習。',
  }),
  A('meet-hayes', '預約並詢問照明技術來源', 'hayes', 60, {
    clues: ['duncan'],
    check: {
      skill: 'electrical',
      difficulty: 'extreme',
      detailClues: ['coating'],
      failure: '你掌握設計者身分，但尚未理解特殊塗層的原理。',
    },
  }),
  A('meet-colleagues', '說明來意，訪問 Duncan 的同事', 'boston', 60, {
    clues: ['homeAddress'],
    check: {
      skill: 'psychology',
      difficulty: 'regular',
      detail: '同事透露 Duncan 變得多疑；他的研究生 Langford 也失去實驗材料。',
      failure: '同事仍願意提供住址，但對休假原因保留細節。',
    },
  }),
  A('enter-house', '尋求合法協助後檢查住宅', 'house', 120, {
    requires: ['homeAddress'],
    clues: ['diary'],
    effect: 'houseAccess',
    confirm: true,
    risk: '取得屋主或適當機關協助並檢查住宅，約需兩小時；不會由 AI 自行破門。',
  }),
  A('pick-house', '嘗試開鎖進入住宅', 'house', 15, {
    requires: ['homeAddress'],
    check: { skill: 'locksmith', difficulty: 'hard' },
    effect: 'houseAccess',
    confirm: true,
    risk: '未經許可進入住宅可能引來警方；開鎖失敗會耗時，強行再試可能造成鎖具損壞。',
  }),
  A('search-study', '徹底檢查書房、書架與日記', 'house', 60, {
    flag: 'houseAccess',
    clues: ['diary', 'secondSight', 'map'],
    check: {
      skill: 'spot',
      difficulty: 'regular',
      detail: '你很快找出假書與黏合頁面的夾層。',
      failure: '你逐頁檢查，最後仍找到夾層，但多花了一小時。',
      extraMinutes: 60,
    },
  }),
  A('analyze-powder', '採樣並請實驗室分析粉末', 'house', 240, {
    flag: 'houseAccess',
    clues: ['powder'],
    confirm: true,
    risk: '分析約需四小時；不會製作或公開這項危險技術。',
  }),
  A('question-bookseller', '訪問市集書商，追查舊攤商', 'bazaar', 60, {
    requires: ['diary'],
    clues: ['merchant', 'disappearance'],
  }),
  A('question-jed', '聽老 Jed 說明村莊的往事', 'sudbury', 60, { clues: ['jed', 'disappearance'] }),
  A('search-jamison', '檢查 Jamison 宅邸與村中公地', 'rise', 180, {
    clues: ['jamison', 'chant', 'map'],
    effect: 'findNotes',
    confirm: true,
    risk: '閱讀與整理筆記約需三小時；完整學習儀式另外計時。',
  }),
  A('learn-chant', '研讀完整儀式', 'rise', 0, {
    flag: 'findNotes',
    effect: 'learnChant',
    confirm: true,
    risk: '學習約需 40−INT÷5 小時；會消耗故事中的時間，檢定失敗可繼續研究。',
  }),
  A('learn-book', '在圖書館研讀儀式', 'records', 0, {
    flag: 'findBook',
    effect: 'learnBook',
    confirm: true,
    risk: '學習約需 40−INT÷5 小時；原典較難，檢定失敗可繼續研究。',
  }),
  A('explore-cave', '謹慎探查洞壁與柱林外緣', 'cave', 30, {
    clues: ['sleeping'],
    effect: 'caveExposure',
    confirm: true,
    risk: '照明會使洞壁發光，進一步接近可能引來危險；你可隨時提出撤退。',
  }),
  A('approach-dais', '穿越柱林接近洞窟中央', 'cave', 10, {
    requires: ['sleeping'],
    effect: 'guardedDais',
    confirm: true,
    risk: '你已知道柱林附近可能有危險生物；深入後可能立即發生戰鬥。',
  }),
  A('wait-duncan', '在倉庫外等待約定會面', 'warehouse', 30, {
    requires: ['appointment'],
    effect: 'truck',
    confirm: true,
    risk: '會等待至約定時間；倉庫門前有狹窄車道，最好留出通行空間。',
  }),
  A('follow-truck', '駕車或依路線追往 Eye Bone Hill', 'warehouse', 60, {
    flag: 'truckSeen',
    effect: 'followTruck',
    moveTo: 'hill',
    confirm: true,
    risk: '危險駕駛會增加受傷風險；以地圖正常趕路也能前往，約需一小時。',
  }),
  A('stop-duncan', '設法使 Duncan 停止爆破', 'hill', 0.1, {
    effect: 'stopDuncanResult',
    check: { skill: 'persuade', difficulty: 'hard' },
    noPush: true,
    party: true,
    confirm: true,
    risk: '在安全距離說明證據並試著說服 Duncan；失敗可能使他匆忙引爆，造成山坡崩塌。',
  }),
  A('rescue-duncan', '在崩塌岩石中尋找並救出 Duncan', 'hill', 1, {
    flag: 'landslide',
    effect: 'rescueDuncan',
    confirm: true,
    risk: '救援需要六個人次的回合，期間可能遭到侍從攻擊。',
  }),
  A('ritual', '帶領已學會儀式的同伴吟唱', 'hill', 0, {
    requires: ['chant'],
    effect: 'ritual',
    party: true,
    unanimous: true,
    confirm: true,
    risk: '全隊確認後，施法者消耗 12 魔力、每名協助吟唱者 5 魔力；成功會損失 1d4＋1d8 理智。需夜間十一點後開始、一小時施法，並維持至少九十分鐘。',
  }),
  A('attack-sleeper', '嘗試以武器迫退巨物', 'hill', 0, {
    effect: 'attackSleeper',
    party: true,
    confirm: true,
    risk: '巨物對普通武器具有極強抵抗力，受到傷害後侍從會護衛並立即交戰。這是極其危險的選擇。',
  }),
  A('watch-awakening', '留在安全距離觀察山洞動靜', 'hill', 10, {
    effect: 'watchAwakening',
    confirm: true,
    risk: '留在山坡會繼續受到洞窟光線影響；直接目睹異常可能損失理智。',
  }),
  A('retreat', '撤離山坡，優先保全同伴', 'hill', 30, {
    effect: 'retreat',
    party: true,
    confirm: true,
    risk: '全隊撤離；若未阻止威脅，故事可能以未能遏止災難結束。',
  }),
];
function available(state) {
  const known = new Set(state.clues || []);
  let actions = ACTIONS.filter(
    (a) =>
      a.scene === state.scene &&
      (!a.requires || a.requires.every((id) => known.has(id))) &&
      (!a.requiresAny || a.requiresAny.some((id) => known.has(id))) &&
      (!a.flag || state.flags[a.flag]) &&
      (!a.before || state.minutes < a.before),
  ).map((a) => ({ ...a }));
  actions = actions.filter(
    (a) =>
      !(a.id === 'examine-farr' && known.has('farr')) &&
      !(['enter-house', 'pick-house'].includes(a.id) && state.flags.houseAccess) &&
      !(['isolate-lamps', 'break-lamps'].includes(a.id) && state.flags.lampsStopped) &&
      !(
        a.id === 'stop-duncan' &&
        (!state.flags.duncanPresent || state.flags.duncanStopped || state.flags.landslide)
      ) &&
      !(
        a.id === 'rescue-duncan' &&
        (state.flags.duncanSaved || state.flags.lastMealAt !== undefined)
      ) &&
      !(a.id === 'attack-sleeper' && !state.flags.awakeAt),
  );
  if (Object.values(state.heroes || {}).some((h) => h.knowsChant))
    actions.push(
      A('teach-chant', '請已學會的同伴傳授儀式', state.scene, 0, {
        effect: 'teachChant',
        confirm: true,
        risk: '需要 30−學生 INT÷5 分鐘，再由學生擲 INT；不會自動取得能力。',
      }),
    );
  if (state.flags.ritual?.boundAt !== undefined) {
    const r = state.flags.ritual,
      h = state.heroes[r.caster],
      target = h.attributes.POW + r.helpers.length * 25;
    const remaining = Math.max(0, (state.flags.awakeAt || 0) + 180 - state.minutes),
      duration = Math.min(60, remaining);
    return duration > 0
      ? [
          A('sustain-ritual', '保持吟唱 ' + duration + ' 分鐘', state.scene, duration, {
            effect: duration < 60 ? 'wait' : 'ritualSustain',
            actorOnly: r.caster,
            ...(duration >= 60
              ? { check: { skill: 'POW', difficulty: 'regular', targetOverride: target } }
              : {}),
            noPush: true,
            confirm: true,
            risk: '吟唱期間全隊留在原處；每小時巨物可以嘗試掙脫。',
          }),
          A('cancel-ritual', '停止吟唱', state.scene, 0, {
            effect: 'cancelRitual',
            actorOnly: r.caster,
            confirm: true,
            risk: '儀式立即中斷；已耗魔力與理智不退回，已維持的時間留在記錄中。',
          }),
        ]
      : [];
  }
  actions.push(
    A('wait-ten', '謹慎等待十分鐘', state.scene, 10, {
      effect: 'wait',
      party: true,
      confirm: true,
      risk: '故事時間前進十分鐘，其他人物與威脅會繼續行動。',
    }),
  );
  if (state.flags.awakeAt) {
    const ritual = actions.find((a) => a.id === 'ritual');
    if (ritual) {
      const remaining = Math.max(0, state.flags.awakeAt + 180 - state.minutes);
      const possible = Math.max(0, remaining - 60);
      ritual.risk +=
        ' 距永久甦醒約 ' +
        remaining.toFixed(1) +
        ' 分鐘；本次施法完成後最多剩 ' +
        possible.toFixed(1) +
        ' 分鐘可維持。已累計剝奪感官 ' +
        (state.flags.perceptionDenied || 0).toFixed(1) +
        ' 分鐘。' +
        (possible + (state.flags.perceptionDenied || 0) < 90
          ? '目前時間不足以單靠這次儀式達到九十分鐘。'
          : '');
    }
  }
  actions.push(
    A('wait-hour', '謹慎等待一小時', state.scene, 60, {
      effect: 'wait',
      party: true,
      confirm: true,
      risk: '故事時間前進一小時，其他人物與威脅也會繼續行動。',
    }),
  );
  if (!['cave', 'hill'].includes(state.scene))
    actions.push(
      A(
        'rest-night',
        '在安全住處休息至翌日早上',
        state.scene,
        1440 - (state.minutes % 1440) + 480,
        {
          effect: 'wait',
          party: true,
          confirm: true,
          risk: '全隊休息到次日早上八點；其他人物與威脅會繼續行動。',
        },
      ),
    );
  return actions;
}
function sceneFor(state) {
  const scene = { id: state.scene, ...SCENES[state.scene] };
  if (state.scene === 'home' && state.clues.includes('farr'))
    scene.description =
      '這是你們在阿卡姆的住處。Farr 已由警員帶走，住處恢復平靜，可整理線索與安排下一步。';
  else if (state.scene === 'house' && state.flags.houseAccess)
    scene.description =
      '你們已進入 Duncan 的住宅，可檢查書房與研究資料；屋內沒有近日有人居住的跡象。';
  else if (state.scene === 'hayes' && state.clues.includes('duncan'))
    scene.description =
      'Hayes 已說明新燈具的設計者是 Duncan 教授。你們仍在他的辦公室，可整理訪談內容。';
  else if (state.scene === 'boston' && state.clues.includes('homeAddress'))
    scene.description = 'Duncan 的同事已提供他的住址。你們仍在工程系，可整理訪談所得資料與下一步。';
  return scene;
}
function destinations(state) {
  const known = new Set(state.clues || []),
    ids = ['home'];
  if (known.has('address')) ids.push('walnut', 'sanitarium', 'records');
  if (known.has('council')) ids.push('hayes');
  if (known.has('duncan')) ids.push('boston');
  if (known.has('homeAddress')) ids.push('house');
  if (known.has('diary')) ids.push('bazaar');
  if (known.has('map') || known.has('merchant')) ids.push('sudbury', 'rise', 'cave');
  if (known.has('appointment')) ids.push('warehouse');
  if (state.flags.truckSeen || known.has('map')) ids.push('hill');
  return [...new Set(ids)]
    .filter((id) => id !== state.scene)
    .map((id) => ({
      id,
      name: SCENES[id].name,
      minutes:
        ['boston', 'house', 'bazaar'].includes(id) !==
        ['boston', 'house', 'bazaar'].includes(state.scene)
          ? 120
          : 30,
    }));
}
module.exports = { META, TRUTH, CLUES, SCENES, ACTIONS, available, destinations, sceneFor };
