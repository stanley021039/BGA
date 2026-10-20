// Original six pure lesson scenarios; browser-controller branch intentionally excluded.
import { TutorialEngine } from './lesson-engine.js';
const { ThunderRoom, neighbor, SHOT_DIE } = TutorialEngine;
const missions = [
  {
    title: '看地形，繞過岩壁',
    goal: '用輕型車的 3 點移動，停在旗幟格。車輛必須存活。',
    why: '直走會撞上岩壁；上方泥地多花 1 點。觀察亮框，找出點數足夠的繞行路線。',
    hint: '選輕型車與 3 點骰。往畫面下方繞：前右 → 正前方 → 前左。',
    flag: { x: 2, y: 3 },
    dice: [3, 1, 2, 6],
  },
  {
    title: '公路能多跑多遠？',
    goal: '用 2 點移動，全程走公路，再使用 +2 公路骰，停在旗幟格。',
    why: '公路骰在原本移動結束後才選用。只要途中離開公路，就失去這次加速資格。',
    hint: '沿車輛同一條車道直走兩格，接受公路加速，再直走兩格。',
    flag: { x: 2, y: 5 },
    dice: [2, 1, 4, 6],
  },
  {
    title: '前面堵車，撞得開嗎？',
    goal: '用重型車撞上前方的輕型車，完成碰撞裁決。',
    why: '撞車會立刻失去剩餘移動。大車有一次重擲機會，但不是一定把小車撞走。',
    hint: '选重型車、3 點骰，直走進入敵車所在格；看清骰面，再決定保留或重擲。',
    dice: [3, 1, 2, 6],
  },
  {
    title: '先走到射界，再開火',
    goal: '把輕型車移到敵方重型車後方，完成一次命中。',
    why: '射界是前方相鄰三格，不是畫面上所有車。移動的位置決定你能射誰。',
    hint: '選 1 點骰，正前方移動一格，再點紅框重型車。此關是第二輪，示範射擊固定為 L。',
    dice: [1, 3, 2, 6],
  },
  {
    title: '救回失能隊友',
    goal: '用 6 點指令骰修復有兩個損傷的重型車，再完成輕型車的移動。',
    why: '不能直接選失能車移動；先讓另一輛可用車行動，利用它的指令步驟維修隊友。',
    hint: '選輕型車、2 點移動骰，再選「維修」與另一顆 6 點骰。確認後觀察重型車少一個損傷，再走兩格。',
    dice: [2, 6, 1, 3],
  },
  {
    title: '把指令用在需要的時候',
    goal: '用 3 點移動骰加上 2 點氮氣指令，在荒地上停到五格外的旗幟。',
    why: '荒地不給公路加速。氮氣在移動前增加點數，但會用掉本輪唯一一次指令。',
    hint: '選輕型車、3 點移動骰；選氮氣與另一顆 2 點骰，再直走五格。',
    flag: { x: 2, y: 6 },
    dice: [3, 2, 1, 6],
  },
];
function createScenario(index) {
  let seed = 1701;
  const rng = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  const r = new ThunderRoom('LESSON', '新手練習', rng),
    p = r.add('你的車隊'),
    q = r.add('對手');
  r.start();
  for (const t of r.tiles)
    for (const row of t.cells)
      for (const cell of row) {
        cell.kind = 'O';
        delete cell.hazard;
      }
  for (const c of r.cars) {
    c.dead = true;
    c.damage = [];
    c.pendingDamage = 0;
    c.moved = false;
    c.coasts = 0;
    c.burning = false;
  }
  const own = r.cars.filter((c) => c.owner === p.id),
    enemy = r.cars.filter((c) => c.owner === q.id);
  const car = index === 2 ? own[2] : own[0],
    target = index === 2 ? enemy[0] : enemy[2],
    ally = own[2];
  Object.assign(car, { dead: false, x: 2, y: 1 });
  Object.assign(target, { dead: false, x: 2, y: index === 2 ? 2 : index === 3 ? 3 : 7 });
  r.clearDice();
  r.turn = 0;
  r.first = 0;
  r.round = index === 3 ? 2 : 1;
  r.phase = 'assign';
  r.active = null;
  r.queue = [];
  r.pending = null;
  r.finishAt = null;
  r.winner = null;
  r.log = [];
  r.events = [];
  r.damageDeck = Array(20).fill('dent');
  r.roadDie = 2;
  for (const player of r.players) {
    player.out = false;
    player.turns = 0;
    player.commandUsed = false;
    player.chopper = null;
  }
  p.dice = missions[index].dice.map((value) => ({ value, used: false }));
  if (index === 0) {
    r.terrain(2, 2).kind = 'X';
    r.terrain(1, 1).kind = 'M';
    r.terrain(1, 2).kind = 'M';
  }
  if (index === 1) for (let y = 1; y <= 6; y++) r.terrain(2, y).kind = 'R';
  if (index === 4) Object.assign(ally, { dead: false, x: 4, y: 2, damage: ['dent', 'dent'] });
  if (index === 2) {
    const rolls = [5, 1, 5, 2];
    let at = 0;
    r.rng = (n) => rolls[at++ % rolls.length] % n;
  }
  if (index === 3) {
    const originalRoll = r.roll.bind(r);
    r.roll = (faces) => (faces === SHOT_DIE ? 'L' : originalRoll(faces));
  }
  return { r, p, q, car, target, ally, index, bonus: false, command: '', result: null };
}
function outcome(s) {
  const { r, car, target, ally, index } = s,
    flag = missions[index].flag,
    atFlag = flag && car.x === flag.x && car.y === flag.y;
  if (car.dead)
    return { ok: false, text: '車撞上障礙或離開道路，已淘汰。看看最後落點，重試這一關。' };
  if (r.pending || r.diceCheck) return null;
  const ended = s.p.turns > 0 || r.phase === 'finished';
  if (index === 2 && r.events.some((e) => e.kind === 'slam'))
    return {
      ok: true,
      text: '碰撞已結算。即使原本有 3 點，撞車後也不會繼續正常移動；較大車的優勢是能選擇重擲。',
    };
  if (index === 3 && target.damage.length)
    return {
      ok: true,
      text: '你先駛入射界，再擲出 L 命中重型車。傷害已顯示在敵車上；第一輪則不能射擊。',
    };
  if (ended) {
    const ok =
      index === 0
        ? atFlag && s.moveValue === 3 && s.command === ''
        : index === 1
          ? atFlag && s.bonus && s.moveValue === 2
          : index === 4
            ? ally.damage.length === 1
            : index === 5
              ? atFlag && s.command === 'nitro' && s.moveValue === 3 && s.commandValue === 2
              : false;
    return {
      ok,
      text: ok
        ? [
            '你避開岩壁，使用 3 點繞行到旗幟。不同地形確實改變可走的路線。',
            '公路加速幫你用 2 點骰走了 4 格。若途中離開公路，就拿不到這次獎勵。',
            '',
            '',
            '重型車從兩個損傷變成一個，恢復可用；輕型車也完成了本回合。',
            '3 點移動 + 2 點氮氣，足夠抵達五格外。你也用掉了本輪的指令機會。',
          ][index]
        : '回合已結束，但尚未達成目標。比較車輛落點、花掉的點數和目標，再重試一次。',
    };
  }
  return null;
}
function act(s, action, data = {}) {
  s.r.act(s.r.actor(), action, data);
  if (action === 'bonus' && data.use) s.bonus = true;
  if (action === 'begin') {
    s.command = data.command || '';
    s.moveValue = s.p.dice[data.die].value;
    s.commandValue = s.p.dice[data.commandDie]?.value;
  }
  s.result = outcome(s);
  return s.result;
}

export const LessonScenarios = { missions, createScenario, outcome, act };
