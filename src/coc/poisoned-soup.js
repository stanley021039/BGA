'use strict';
// Independently written Chinese adaptation of 泥紳士's publicly released scenario.
// Source/derivative-use statement: docs/COC-SOURCES.md. No original text or art bundled.
const rules = require('./rules');
const combat = require('./soup-combat');
const { clone, uid, fail } = require('./util');
const META = Object.freeze({
  id: 'poisoned-soup-pulp-1',
  title: '毒湯',
  originalTitle: '毒入りスープ',
  author: '泥紳士',
  era: '現代（驗證改編）',
  place: '未知的密室',
  source: 'https://seesaawiki.jp/trpgyarouzu/',
  license: '依原發布頁衍生創作說明製作的驗證改編；原作著作權歸泥紳士。',
  note: '劇透提醒：密室、血液、死亡與神話恐怖。以自行撰寫的中文敘事及 COC7／Pulp 判定改編；一小時為故事時間，討論與暫停不計時。',
});
const TRUTH = Object.freeze({
  dream: 'Chaugnar Faugn 以夢境試探調查者；原本的湯沒有毒。',
  poison: '黑書表面的液體與中央燈泡內的瓶子都是黑蓮毒；銀器可以辨認。',
  escape: '六十分鐘前有人喝完已加毒的湯且毒性結算完畢，整隊醒來；少女也可成為飲用者。',
  girl: '少女不會說話，並非知道所有答案。她對危險會恐懼，但服從能做到的要求。',
  book: '拿走書本會驚動守門的無形之物；歸還書本即可使它退去。',
  guardian: '禮拜室的守衛吃到一名活人後退去；神祇並不需要被殺死才能逃離。',
  conversion: '七版數值尺度；POT25換為125。中毒者手動擲CON對抗已保存毒性骰。',
});
const SCENES = {
  soup: {
    name: '中央 · 湯與四扇門',
    description:
      '你們在陌生的方形房間醒來，身穿白色長袍。桌上放著一碗暗紅色熱湯，椅子上有紙張，四面各有一扇門。隨身裝備都不在這裡。',
  },
  kitchen: {
    name: '北側 · 調理室',
    description: '推門後是一間明亮、整潔的廚房。料理台、銀色餐具與一只蓋著的大鍋都在眼前。',
  },
  library: {
    name: '西側 · 書物庫',
    description: '四角的書架擺滿不同種類的書，桌上的蠟燭照亮紙頁。這扇木門沒有上鎖。',
  },
  servant: {
    name: '東側 · 鐵門後的房間',
    description: '鏽蝕的門上有鎖。裡面一片黑暗，暫時沒有傳出聲音。',
  },
  chapel: {
    name: '南側 · 禮拜室門前',
    description: '厚重鐵門上有一扇小窗，門後偶爾傳來沉重的摩擦聲與呼吸聲。',
  },
};
const CLUES = {
  instructions: {
    title: '紙條與平面圖',
    text: '紙上要求你們在一小時內喝下有毒的湯，否則會有人來接走你們。地圖標示北方廚房、西方書庫、東方下僕房與南方禮拜室。',
  },
  blood: { title: '湯的成分', text: '紙背與檢查結果指向同一件事：碗中的暗紅液體來自人類的血。' },
  book: {
    title: '黑書中的提示',
    text: '書中說明：必須喝下合適的湯；廚房有備用湯，東側有人帶著有用的東西。書不能帶出書庫，蠟燭可以。南側守衛在吃到活物後會離開。最後一行提醒讀者做好面對死亡的準備。',
  },
  coating: {
    title: '黑書上的液體',
    text: '書皮沾著帶甜味的黑色液體。接觸完整皮膚尚無異狀，入口或接觸傷口可能非常危險。',
  },
  stock: {
    title: '缺少的調味料',
    text: '廚房的字條表示，重要的調味料已經用完。料理台旁仍有銀色餐具與蓋著的大鍋可供查看。',
  },
  silver: {
    title: '銀器的反應',
    text: '銀器能用來比較液體；你們這次實際看到的反應已記在調查手記中。',
  },
  girl: {
    title: '沉默的少女',
    text: '一名穿白袍的蒼白少女跟著你們。她持有小口徑手槍，用點頭或搖頭回答，無法說話；面對危險命令時會顯出恐懼。',
  },
  servantNote: {
    title: '東側的紙張',
    text: '紙張將少女稱為服從命令的下僕。房內另有一具沒有頭部的遺體；少女搖頭表示不是她造成的。',
  },
  guardian: {
    title: '禮拜室的守衛',
    text: '小窗後有一隻巨大的蛇形異物，背上生著一片翅膀，正在房內徘徊。',
  },
  poisonPlaces: {
    title: '調味料的位置',
    text: '神像附近的紙條把「調味料」指向中央微弱的光源，以及沾黑的知識。',
  },
  dream: {
    title: '石板的記載',
    text: '石板記錄了 Chaugnar Faugn，並指出你們目前所在的地方是祂塑造的夢。',
  },
  vial: {
    title: '燈泡中的小瓶',
    text: '燈泡裡藏著一小瓶黑液。取出後中央失去照明，需要借助其他光源。',
  },
};
const A = (id, label, scene, minutes, extra = {}) => ({
  id: 'soup-' + id,
  label,
  scene,
  minutes,
  effect: 'soup:' + id,
  ...extra,
});
const ACTIONS = [
  A('notes', '查看紙張與平面圖', 'soup', 1, { clues: ['instructions'] }),
  A('back', '翻看紙張背面', 'soup', 1, { clues: ['blood'], sanity: ['0', '1d4'] }),
  A('examine', '檢查湯的外觀與成分', 'soup', 2, {
    clues: ['blood'],
    check: {
      skill: 'medicine',
      difficulty: 'regular',
      failure: '仍能從紙張與液體特徵確認基本線索，尚無法判定是否有毒。',
    },
    sanity: ['0', '1d4'],
  }),
  A('light', '取下燈泡並檢查內部', 'soup', 3, {
    confirm: true,
    risk: '中央的燈可能損壞而失去照明；請先安排其他光源。',
    clues: ['vial'],
  }),
  A('mix', '將取得的黑液加入湯中', 'soup', 1, {
    confirm: true,
    party: true,
    risk: '會改變整碗湯的成分，黑液一旦加入便無法取回。尚不會替任何人飲用。',
  }),
  A('taste', '自行喝下目前這碗湯', 'soup', 0.1, {
    confirm: true,
    risk: '由你本人決定飲用；湯可能造成理智損失、中毒或死亡，飲用後不能撤回。',
    noPush: true,
  }),
  A('girlDrink', '請少女喝下目前這碗湯', 'soup', 0.1, {
    confirm: true,
    party: true,
    risk: '少女會害怕但仍服從。這可能使她中毒或死亡，是不可撤回的共同決定。',
  }),
  A('refillSelf', '用自己的血補充空碗', 'soup', 2, {
    confirm: true,
    risk: '由你本人承擔固定 3 點體力損失；不能改由同伴付出。',
  }),
  A('supply', '查看餐具與料理台', 'kitchen', 6, { clues: ['stock'] }),
  A('pot', '打開大鍋並查看備用湯', 'kitchen', 1, {
    confirm: true,
    risk: '鍋蓋下可能有令人不適的內容。',
    sanity: ['1', '1d6'],
  }),
  A('refillPot', '從鍋中補充一碗湯', 'kitchen', 1, {
    confirm: true,
    risk: '你們已見過鍋中的內容；取出的液體會保留在容器裡。',
  }),
  A('utensils', '帶走銀色餐具與廚刀', 'kitchen', 1),
  A('browse', '查找與這間密室有關的書', 'library', 6, {
    clues: ['book', 'coating'],
    check: {
      skill: 'library',
      difficulty: 'regular',
      extraMinutes: 2,
      failure: '多翻了幾排書，最後仍找到記載這些房間的黑書。',
    },
  }),
  A('sample', '只採集黑書表面的液體', 'library', 1, {
    confirm: true,
    risk: '只帶走液體，書留在原處。不要讓液體接觸嘴或傷口。',
  }),
  A('bookTake', '把黑書帶出書物庫', 'library', 1, {
    confirm: true,
    risk: '書中的警告說不能將書帶出；這可能引來守衛。',
  }),
  A('candle', '帶走桌上的蠟燭', 'library', 1),
  A('openGirl', '嘗試推開鏽蝕的鐵門', 'servant', 2, {
    confirm: true,
    risk: '門鎖已鏽蝕，可用力量嘗試推開；後面沒有照明。',
    check: {
      skill: 'STR',
      difficulty: 'regular',
      opposedTarget: 25,
      failure: '鏽鎖沒有被推開，可換個方法或再次嘗試。',
    },
  }),
  A('lockGirl', '嘗試開啟鐵門的鎖', 'servant', 2, {
    check: { skill: 'locksmith', difficulty: 'regular' },
  }),
  A('roomGirl', '調查少女原本的房間', 'servant', 4, {
    clues: ['servantNote'],
    sanity: ['1', '1d4+1'],
  }),
  A('peek', '從小窗查看禮拜室', 'chapel', 1, { clues: ['guardian'], sanity: ['0', '1d10'] }),
  A('enterChapel', '全隊進入禮拜室', 'chapel', 1, {
    confirm: true,
    party: true,
    unanimous: true,
    risk: '門後可能有危險；若守衛仍在，進入會立刻遭到攻擊。',
  }),
  A('sendGirl', '讓少女先進入禮拜室', 'chapel', 1, {
    confirm: true,
    party: true,
    risk: '若守衛仍在，少女極可能死亡。她會顯出恐懼，仍可能服從。',
  }),
  A('tablet', '調查神像、石板與附近紙張', 'chapel', 5, {
    clues: ['dream', 'poisonPlaces'],
    sanity: ['1d3', '1d6+1'],
  }),
];
const seen = (s, clue) => s.clues.includes(clue);
function available(s) {
  if (s.flags.timeout) {
    return timeoutSeats(s)
      .filter((id) => !s.flags.timeoutDone?.includes(id))
      .map((id) =>
        A('heart', '抵抗夢中的心臟壓迫', s.scene, 0, {
          actorOnly: id,
          check: { skill: 'CON', difficulty: 'regular' },
          noPush: true,
        }),
      );
  }
  const f = s.flags;
  const actions = ACTIONS.filter((a) => a.scene === s.scene)
    .filter((a) => {
      const id = a.id.slice(5);
      if (
        ['notes', 'back', 'examine', 'browse', 'supply', 'roomGirl', 'peek', 'tablet'].includes(id)
      ) {
        const clues = a.clues || [];
        if (clues.length && clues.every((id) => seen(s, id))) return false;
      }
      if (id === 'light') return !f.vial;
      if (id === 'mix') return f.poison && !f.mixed && !f.empty;
      if (['taste', 'girlDrink'].includes(id))
        return !f.empty && (id !== 'girlDrink' || f.girlAlive);
      if (id === 'refillSelf') return f.empty;
      if (id === 'refillPot') return f.potOpened && f.empty;
      if (id === 'utensils') return !f.utensils;
      if (['sample', 'bookTake'].includes(id))
        return seen(s, 'book') && (id !== 'sample' || !f.poison);
      if (id === 'candle') return !f.candle && s.minutes < 40;
      if (['openGirl', 'lockGirl'].includes(id)) return !f.girlOpened;
      if (id === 'roomGirl') return f.girlOpened;
      if (id === 'sendGirl') return f.girlAlive && !f.guardGone;
      if (id === 'tablet') return f.guardGone;
      return true;
    })
    .map(clone);
  if (f.girlAlive) {
    actions.push(A('talkGirl', '以簡短問題詢問少女', s.scene, 1));
    if (!f.gunTaken) actions.push(A('gun', '請少女交出手槍', s.scene, 1));
  }
  if (f.utensils && (f.poison || f.mixed))
    actions.push(A('silver', '用銀器比較液體與湯', s.scene, 1, { clues: ['silver'] }));
  actions.push(
    A('wait', '等待五分鐘並觀察變化', s.scene, 5, {
      confirm: true,
      party: true,
      risk: '故事時間會前進五分鐘，湯也會繼續冷卻。',
    }),
  );
  return actions;
}
function destinations(s) {
  if (!seen(s, 'instructions') || s.flags.timeout) return [];
  return Object.entries(SCENES)
    .filter(([id]) => id !== s.scene && (s.scene === 'soup' || id === 'soup'))
    .map(([id, item]) => ({ id, name: item.name, minutes: 2 }));
}
function sceneFor(s) {
  const base = SCENES[s.scene];
  let description = base.description;
  if (s.flags.started && s.scene === 'soup' && s.sessionActions > 0)
    description = '中央房間四面各有一扇門，桌上的碗與紙張仍在原處。';
  if (s.scene === 'servant' && s.flags.girlOpened)
    description = '鏽蝕的鐵門已打開，可查看少女原先待著的暗室。';
  const remaining = Math.max(0, 60 - s.minutes);
  description += ' 距紙上期限尚有 ' + remaining.toFixed(1).replace(/\.0$/, '') + ' 分鐘故事時間。';
  return { id: s.scene, name: base.name, description };
}
function start(store, s) {
  s.flags = { started: true, girlAlive: false, empty: false, originalHeroes: clone(s.heroes) };
  for (const h of Object.values(s.heroes)) {
    h.equipment = [];
    h.ammunition = { loaded: 0, reserve: 0 };
  }
}
function sanity(s, room, loss, reason) {
  for (const p of room.activePlayers())
    if (!['dead', 'retired'].includes(s.heroes[p.id]?.condition))
      s.sanityQueue.push({ id: uid(), actor: p.id, loss, status: 'awaitingRoll', reason });
}
function check(s, actor, id, label, descriptor) {
  s.check = {
    id: uid(),
    actor,
    action: {
      id: 'soup-' + id,
      effect: 'soup:' + id,
      label,
      minutes: 0,
      check: descriptor,
      noPush: true,
    },
    status: 'awaitingRoll',
    pushed: false,
  };
}
function opposedWin(s, fallback) {
  if (s.lastOpposedWin !== undefined) return s.lastOpposedWin;
  const own = s.lastCheckRoll,
    other = s.lastOpposition;
  return own && other
    ? own.level > other.level || (own.level === other.level && own.target > other.target)
    : fallback;
}
function effect(store, room, s, seat, a, pass, facts) {
  const f = s.flags,
    h = s.heroes[seat],
    id = a.effect.slice(5);
  if (id === 'light') {
    f.vial = true;
    f.poison = true;
    f.dark = true;
    facts.push('燈泡損壞，小瓶已取出，中央失去原有照明。');
  } else if (id === 'mix') {
    f.mixed = true;
    facts.push('黑色液體已加入整碗湯，不能再分離。');
  } else if (id === 'taste' || id === 'girlDrink') {
    if (f.empty) fail('COC_SOUP_EMPTY', '碗已經空了');
    if (id === 'girlDrink' && !f.girlAlive) fail('COC_SOUP_GIRL', '少女目前不在隊伍中');
    f.empty = true;
    if (id === 'taste' && !seen(s, 'blood')) {
      f.pendingDrink = { seat, poisoned: !!f.mixed };
      check(s, seat, 'identifyTaste', '辨認入口液體的性質', {
        skill: 'INT',
        difficulty: 'regular',
      });
      facts.push('液體已入口。請先擲 INT，確認你是否認出它的成分；這不是重新決定要不要飲用。');
      return;
    }
    if (id === 'taste')
      s.sanityQueue.push({
        id: uid(),
        actor: seat,
        loss: ['1', '1d6'],
        status: 'awaitingRoll',
        reason: '喝下暗紅色的湯',
      });
    if (!f.mixed) {
      facts.push('液體已被喝完，但周圍沒有發生變化。');
      return;
    }
    f.drinker = id === 'taste' ? seat : 'girl';
    f.voluntaryDrinker = id === 'taste' ? seat : null;
    if (id === 'girlDrink') {
      const own = rules.percentile(30, 0, store.rng),
        poison = rules.percentile(125, 0, store.rng);
      const survives =
        own.level > poison.level || (own.level === poison.level && own.target > poison.target);
      f.girlAlive = survives;
      f.girlDied = !survives;
      store.log(s, 'roll', '少女的毒性對抗已由伺服器保存。', { own, poison });
      if (!survives) sanity(s, room, ['0', '1d3'], '少女因毒湯失去生命');
      f.readyToEscape = true;
      return;
    }
    check(s, seat, 'poisonResult', '抵抗已喝下的毒性', { skill: 'CON', difficulty: 'regular' });
    s.check.action.opposition = rules.percentile(125, 0, store.rng);
    facts.push('毒性開始發作。請飲用者擲 CON；這次對抗不可孤注一擲。');
  } else if (id === 'identifyTaste') {
    const drink = f.pendingDrink;
    if (!drink || drink.seat !== seat) fail('COC_STALE', '這次飲用判定已結束');
    if (pass) store.discover(s, ['blood'], facts);
    s.sanityQueue.push({
      id: uid(),
      actor: seat,
      loss: pass ? ['1d3', '1d8'] : ['1', '1d3'],
      status: 'awaitingRoll',
      reason: '喝下暗紅色的湯',
    });
    if (drink.poisoned) {
      f.drinker = seat;
      f.voluntaryDrinker = seat;
      check(s, seat, 'poisonResult', '抵抗已喝下的毒性', { skill: 'CON', difficulty: 'regular' });
      s.check.action.opposition = rules.percentile(125, 0, store.rng);
      facts.push('毒性開始發作，請以 CON 對抗。已入口的湯與原先付出的時間不會重算。');
    } else facts.push('整碗已喝完，周圍卻沒有出現變化。');
    delete f.pendingDrink;
  } else if (id === 'poisonResult') {
    const won = opposedWin(s, pass);
    f.dreamDeaths ??= [];
    if (!won) {
      h.hp = 0;
      h.condition = 'unconscious';
      f.dreamDeaths.push(seat);
    } else {
      h.hp = Math.ceil(h.hp / 2);
      h.attributes.CON = Math.floor(h.attributes.CON / 2);
      s.sanityQueue.push({
        id: uid(),
        actor: seat,
        loss: ['0', '1'],
        status: 'awaitingRoll',
        reason: '毒性引起的幻覺',
      });
    }
    f.readyToEscape = true;
  } else if (id === 'refillSelf') {
    if (h.hp <= 3) fail('COC_SOUP_BLOOD', '目前體力不足以安全提供這份血，請尋找其他來源');
    h.hp -= 3;
    f.empty = false;
    f.mixed = false;
    facts.push(h.name + ' 付出 3 點體力補充了空碗。');
  } else if (id === 'pot') {
    f.potOpened = true;
    facts.push('鍋中堆放著人類遺骸，底部的暗紅液體能補充碗中的湯。');
  } else if (id === 'refillPot') {
    f.empty = false;
    f.mixed = false;
    facts.push('碗中重新裝有暗紅色液體，尚未加入其他東西。');
  } else if (id === 'utensils') {
    f.utensils = true;
    h.equipment = [...new Set([...h.equipment, 'knife'])];
    facts.push('取得銀色餐具與一把廚刀。');
  } else if (id === 'sample') {
    f.poison = true;
    facts.push('少量黑液留在容器裡，黑書仍放回原位。');
  } else if (id === 'bookTake') {
    f.bookHolder = seat;
    f.slimeActive = true;
    store.combat.start(room, s, { kind: 'soup-slime', actor: seat });
    facts.push('帶著書跨出門時，門的輪廓開始融化，黑色的無形之物攔住你們。');
  } else if (id === 'candle') {
    f.candle = true;
    h.equipment.push('candleFire');
    facts.push('蠟燭可攜帶，目前仍能照明。');
  } else if (['openGirl', 'lockGirl'].includes(id)) {
    if (id === 'openGirl' ? opposedWin(s, pass) : pass) {
      f.girlOpened = true;
      f.girlAlive = true;
      store.discover(s, ['girl'], facts);
      facts.push('少女走近後安靜地跟著你們，以點頭和搖頭回應。');
    }
  } else if (id === 'talkGirl')
    facts.push(
      '她無法開口，只能回應具體的是非問題。她搖頭表示不知道你們為何會來，也無法直接帶你們離開。',
    );
  else if (id === 'gun') {
    if (f.gunTaken) fail('COC_SOUP_GUN', '她已經交出唯一的手槍');
    f.gunTaken = true;
    h.equipment.push('pistol22');
    h.ammunition = { loaded: 6, reserve: 0 };
    facts.push('她將小口徑自動手槍交給你，彈匣還有六發。');
  } else if (id === 'enterChapel') {
    if (!f.guardGone) store.combat.start(room, s, { kind: 'soup-guardian', actor: seat });
    else facts.push('守衛已退去，你們可以接近神像與石板。');
  } else if (id === 'sendGirl') {
    f.girlAlive = false;
    f.girlDied = true;
    f.guardGone = true;
    sanity(s, room, ['0', '1d3'], '少女被禮拜室的守衛吞沒');
    facts.push('少女進門後遭守衛襲擊。聲音停止後，守衛也離開了房間。');
  } else if (id === 'tablet') {
    h.skills.mythos = Math.min(99, (h.skills.mythos || 0) + 6);
    facts.push('你讀懂了石板，獲得 6 點克蘇魯神話。');
  } else if (id === 'silver')
    facts.push(
      f.mixed ? '銀器接觸碗中的湯後變黑。' : '銀器接觸採來的黑液後變黑；原本的湯沒有這種反應。',
    );
  else if (id === 'heart') {
    if (!pass) {
      h.hp = 0;
      h.condition = 'dead';
      finishTimeout(store, s, seat);
    } else
      check(s, seat, 'heartSecond', '再次抵抗夢中的心臟壓迫', {
        skill: 'CON',
        difficulty: 'regular',
      });
  } else if (id === 'heartSecond') {
    if (!pass) h.hp = Math.max(0, h.hp - rules.dice('1d6', store.rng).total);
    h.condition = h.san <= 0 ? 'retired' : h.hp > 0 ? 'healthy' : 'unconscious';
    finishTimeout(store, s, seat);
  } else if (
    !['notes', 'back', 'examine', 'supply', 'browse', 'roomGirl', 'peek', 'wait'].includes(id)
  )
    fail('COC_EFFECT_UNAVAILABLE', '此劇本行動尚無法執行');
}
function settle(store, room, s) {
  if (s.flags.readyToEscape && !s.sanityQueue.length && !s.check && !s.result)
    store.finish(s, 'soup-escaped');
}
function advance(store, s) {
  if (s.flags.candle && s.minutes >= 45 && !s.flags.candleOut) {
    s.flags.candleOut = true;
    store.log(s, 'scene', '蠟燭已經燃盡。');
    for (const h of Object.values(s.heroes))
      h.equipment = h.equipment.filter((id) => id !== 'candleFire');
  }
  if (s.minutes < 60 || s.flags.timeout || s.result) return;
  s.flags.timeout = true;
  s.flags.timeoutDone = [];
  s.flags.timeoutParticipants = s.presentSeats || Object.keys(s.heroes);
  store.log(
    s,
    'scene',
    '湯已冷透。門後的存在動了起來，夢境裡的壓迫感直抵你們的心臟。期限已過，原先的逃離條件不再有效。',
  );
  for (const actor of s.flags.timeoutParticipants) {
    const h = s.heroes[actor];
    if (['dead', 'retired'].includes(h.condition)) {
      s.flags.timeoutDone.push(actor);
      continue;
    }
    s.sanityQueue.push({
      id: uid(),
      actor,
      loss: ['1d4', '2d6+1'],
      status: 'awaitingRoll',
      reason: '期限後甦醒的神祇',
    });
  }
  if (s.flags.timeoutDone.length === timeoutSeats(s).length) store.finish(s, 'soup-timeout');
}
function timeoutSeats(s) {
  return s.flags.timeoutParticipants || s.presentSeats || Object.keys(s.heroes);
}
function interrupted(s, action) {
  return !!s.flags.timeout && !['soup:heart', 'soup:heartSecond'].includes(action.effect);
}
function finishTimeout(store, s, seat) {
  s.flags.timeoutDone = [...new Set([...s.flags.timeoutDone, seat])];
  if (timeoutSeats(s).every((id) => s.flags.timeoutDone.includes(id)))
    store.finish(s, 'soup-timeout');
}
function beforeFinish(store, s, ending) {
  if (!ending.startsWith('soup-')) return;
  for (const [seat, h] of Object.entries(s.heroes)) {
    const original = s.flags.originalHeroes[seat];
    h.equipment = clone(original.equipment);
    h.ammunition = clone(original.ammunition);
    if (ending === 'soup-escaped') {
      h.hp = original.hp;
      h.attributes.CON = original.attributes.CON;
      if (h.condition !== 'retired') h.condition = original.condition;
    }
  }
}
function reward(store, s, seat, ending) {
  if (ending === 'soup-timeout')
    return timeoutSeats(s).includes(seat) ? -rules.dice('1d6', store.rng).total : 0;
  if (ending !== 'soup-escaped') return 0;
  return (
    rules.dice('1d10', store.rng).total +
    (s.flags.girlDied ? 0 : rules.dice('1d6', store.rng).total) -
    (s.flags.dreamDeaths?.includes(seat) ? rules.dice('1d10', store.rng).total : 0) +
    (s.flags.voluntaryDrinker === seat ? 5 : 0)
  );
}
module.exports = {
  combat,
  META,
  TRUTH,
  SCENES,
  CLUES,
  ACTIONS,
  available,
  destinations,
  sceneFor,
  start,
  effect,
  advance,
  interrupted,
  reactiveAction: (s, seat, id) =>
    !!s.flags.timeout &&
    timeoutSeats(s).includes(seat) &&
    id === 'soup-heart' &&
    !s.flags.timeoutDone.includes(seat),
  settle,
  beforeFinish,
  reward,
  initial: { scene: 'soup', minutes: 0 },
  deferReplacement: true,
  resumeUnavailable: (s) =>
    !!s.flags.timeout && timeoutSeats(s).some((id) => !s.flags.timeoutDone.includes(id)),
  endings: {
    'soup-escaped':
      '毒湯被喝下後，夢中的房間消失。你們在原本入睡的地方醒來，夢中傷勢不再存在；理智、知識與記憶仍留在身上。',
    'soup-timeout':
      '你們在神祇的壓迫下結束惡夢；期限後造成的傷害與死亡留到了現實，沒有獲得脫離夢境的理智獎勵。',
  },
};
