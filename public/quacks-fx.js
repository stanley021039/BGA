/* Original summon and rolling-die scenes; server results remain authoritative. */
(function (root) {
  'use strict';
  const labels = ['1 分', '1 分', '2 分', '1 顆紅寶石', '水滴前進 1 格', '南瓜 1'];
  const node = (tag, text) => {
    const el = root.document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function die(face, size = 78, tones = null) {
    const el = node('div');
    el.className = 'quacks-die';
    el.style.setProperty('--die-size', size + 'px');
    el.style.setProperty('--die-glow', tones?.[0] || '#315db1');
    el.style.setProperty('--die-body', tones?.[1] || '#152c69');
    el.style.setProperty('--die-deep', tones?.[2] || '#08162f');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', labels[face]);
    const symbol = node('div');
    symbol.className = 'die-symbol';
    if (face === 3)
      symbol.append(root.QuacksArt.resource('ruby', { size: size * 0.62, decorative: true }));
    else if (face === 4) {
      symbol.append(root.QuacksArt.resource('droplet', { size: size * 0.62, decorative: true }));
    } else if (face === 5)
      symbol.append(
        root.QuacksArt.token(
          { color: 'orange', value: 1 },
          { size: size * 0.65, decorative: true },
        ),
      );
    else {
      symbol.classList.add('die-points');
      symbol.append(node('strong', face === 2 ? '2' : '1'), node('small', '分'));
    }
    el.append(symbol);
    return el;
  }
  function create(host) {
    let context = null,
      queue = [],
      active = null,
      initialized = false;
    const seen = new Set();
    const allowed = () =>
      root.MotionPolicy
        ? root.MotionPolicy.allowsMotion()
        : !root.document.hidden && !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    function clear() {
      if (active) clearTimeout(active.timer);
      active = null;
      queue = [];
      host.replaceChildren();
      host.hidden = true;
    }
    function next() {
      if (active || !queue.length || !allowed()) return;
      const event = queue.shift();
      if (Date.now() - event.at > 5000) {
        next();
        return;
      }
      const scene = node('section');
      scene.className = 'quacks-fx-scene ' + event.kind;
      scene.setAttribute('aria-label', event.kind === 'card' ? '占卜抽卡動畫' : '獎勵骰動畫');
      const glow = node('div');
      glow.className = 'summon-glow';
      scene.append(glow);
      if (event.kind === 'card') {
        const rune = node('div', '✦  ✧  ✦  ✧  ✦  ✧');
        rune.className = 'summon-rune';
        const gate = node('div');
        gate.className = 'summon-gate';
        const card = node('div');
        card.className = 'summon-card';
        const back = node('div');
        back.className = 'summon-back';
        const front = node('div');
        front.className = 'summon-front';
        front.dataset.timing = event.fortune.timing || 'round';
        const edition = node('small', '郎中藥典 · 占卜'),
          seal = node('div'),
          timing = node('span', event.fortune.timing === 'immediate' ? '立即生效' : '本回合生效'),
          effect = node('div'),
          byline = node('small', event.name + '抽出的占卜牌');
        edition.className = 'fortune-edition';
        seal.className = 'fortune-seal';
        seal.setAttribute('aria-hidden', 'true');
        timing.className = 'fortune-timing';
        effect.className = 'fortune-effect';
        effect.append(node('p', event.fortune.text));
        byline.className = 'fortune-byline';
        front.append(edition, seal, timing, node('h3', event.fortune.name), effect, byline);
        card.append(back, front);
        scene.append(rune, gate, card);
      } else {
        const cup = node('div');
        cup.className = 'dice-arena';
        const cube = die(event.face, 110, event.tones);
        cube.classList.add('rolling');
        cup.append(cube);
        scene.append(
          node('h3', event.name + '擲骰'),
          cup,
          node('strong', labels[event.face]),
          node('p', event.source + ' · 第 ' + event.round + ' 回合'),
        );
      }
      const skip = node('button', '跳過動畫');
      skip.type = 'button';
      root.GameUI?.decorateButton(skip, 'close');
      skip.className += ' fx-skip';
      skip.onclick = clear;
      scene.append(skip);
      host.hidden = false;
      host.replaceChildren(scene);
      active = {
        event,
        timer: setTimeout(
          () => {
            active = null;
            host.replaceChildren();
            host.hidden = true;
            next();
          },
          event.kind === 'card' ? 3600 : 1800,
        ),
      };
    }
    function update(state, live) {
      const nextContext = state.code + ':' + state.roundId;
      if (context !== nextContext) {
        clear();
        seen.clear();
        context = nextContext;
        initialized = false;
      }
      const events = [
        ...(state.fortuneRevealId
          ? [
              {
                id: state.fortuneRevealId,
                kind: 'card',
                fortune: state.fortune,
                name: state.players.find((p) => p.id === state.roundStarterId)?.name || '起始玩家',
                at: state.fortuneDrawnAt || state.serverNow,
              },
            ]
          : []),
        ...(state.rollEvents || []).map((e) => ({
          ...e,
          kind: 'dice',
          tones:
            state.potColors?.[
              e.potColor || state.recipes?.find((p) => p.id === e.playerId)?.potColor
            ]?.liquid,
        })),
      ];
      const presenting = state.phase !== 'round-intro' && state.phase !== 'finished';
      if (!live || !allowed() || !presenting) clear();
      for (const event of events) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        if (initialized && live && allowed() && presenting) queue.push(event);
      }
      initialized = true;
      if (queue.length > 20) queue = queue.slice(-20);
      next();
    }
    const unsubscribe = root.MotionPolicy?.subscribe(() => {
      if (!allowed()) clear();
    });
    const hidden = () => {
      if (root.document.hidden) clear();
    };
    root.document.addEventListener('visibilitychange', hidden);
    return {
      update,
      clear,
      destroy() {
        clear();
        unsubscribe?.();
        root.document.removeEventListener('visibilitychange', hidden);
      },
      size: () => seen.size,
    };
  }

  /* All viewers receive the same authoritative explosion IDs; current pot selection is irrelevant. */

  /* Private draw IDs include extra draws but never disclose another player's bag. */
  function createAudio(sounds, { onExplosion = () => {}, onClear = () => {} } = {}) {
    let context = null,
      initialized = false,
      timer = null,
      queue = [],
      generation = 0,
      lastSettlement = null,
      drawActive = false;
    const seen = new Set();
    const clear = () => {
      generation++;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      queue = [];
      drawActive = false;
      onClear();
    };
    const muted = () => {
      const p = root.AudioSettings?.get?.().effects;
      return p && (!p.enabled || !p.volume);
    };
    const next = () => {
      timer = null;
      while (queue.length) {
        const e = queue.shift();
        if (Date.now() - e.at > 5000 || (!e.explosions && muted())) continue;
        if (!e.explosions && sounds?.hasCapacity?.() === false) {
          queue.unshift(e);
          timer = setTimeout(next, 50);
          return;
        }
        const token = generation,
          isDraw = !e.cue;
        let ended = false;
        const done = () => {
          if (ended || token !== generation) return;
          ended = true;
          if (isDraw) drawActive = false;
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(next, 25);
        };
        const play = () => {
          if (token !== generation || root.document.hidden) return;
          if (e.explosions) onExplosion(e.explosions);
          if (isDraw) drawActive = true;
          const clip = sounds?.play(e.cue || 'ingredient-draw', e.key, {
            live: true,
            epoch: e.epoch,
            onStop: done,
          });
          if (!clip) done();
          else if (!ended)
            timer = setTimeout(
              done,
              e.explosions ? 3000 : e.cue === 'quacks-stop' ? 5500 : isDraw ? 5000 : 2200,
            );
        };
        // Leave a short beat after the last draw finishes, even when audio is muted or refused.
        if (e.explosions) timer = setTimeout(play, 180);
        else play();
        break;
      }
    };
    function update(state, live) {
      const key = state.code + ':' + state.roundId;
      if (key !== context) {
        clear();
        seen.clear();
        context = key;
        initialized = false;
        lastSettlement = null;
      }
      if (!live || root.document.hidden) clear();
      const eligible = initialized && live && !root.document.hidden,
        epoch = sounds?.epoch?.();
      let stoppedNow = false;
      const card = state.fortuneRevealId;
      if (card && !seen.has('card:' + card)) {
        seen.add('card:' + card);
        if (eligible) sounds?.play('card-draw', 'quacks:card:' + card);
      }
      for (const e of state.mine?.potionEvents || []) {
        const id = 'potion:' + e.id;
        if (seen.has(id)) continue;
        seen.add(id);
        if (eligible)
          queue.push({ cue: 'potion-drink', key: 'quacks:' + id, at: e.at ?? Date.now(), epoch });
      }
      for (const e of state.mine?.stopEvents || []) {
        const id = 'stop:' + e.id;
        if (seen.has(id)) continue;
        seen.add(id);
        if (eligible) {
          stoppedNow = true;
          queue.push({ cue: 'quacks-stop', key: 'quacks:' + id, at: e.at ?? Date.now(), epoch });
        }
      }
      // Draw -> pause -> explosion. No extra settlement cue after stopping or bursting. Same-snapshot settlement never cuts the draw short.
      // New clients hear an accepted choice immediately, even while peers are deciding.
      // Older servers still use resolved draws. Never consume both streams.
      const draws = Array.isArray(state.mine?.drawDecisionEvents)
        ? state.mine.drawDecisionEvents
        : state.mine?.drawEvents || [];
      for (const e of draws) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        if (eligible && e.decision === true && !drawActive && !queue.some((x) => !x.cue))
          queue.push({ key: 'quacks:draw:' + e.id, at: e.at ?? Date.now(), epoch });
      }
      const explosions = [];
      for (const p of state.recipes || []) {
        const id = 'burst:' + p.explosionId;
        if (!p.explosionId || seen.has(id)) continue;
        seen.add(id);
        if (eligible) explosions.push({ id: p.explosionId, playerId: p.id, name: p.name });
      }
      if (explosions.length)
        queue.push({
          cue: 'quacks-explosion',
          key: 'quacks:burst:' + explosions.map((e) => e.id).join(':'),
          explosions,
          at: Date.now(),
          epoch,
        });
      const stage =
        state.phase === 'settlement' && state.stage !== 'witches'
          ? state.stage
          : state.phase === 'finished' && !state.interrupted
            ? 'finished'
            : null;
      const entering = stage && stage !== lastSettlement;
      lastSettlement = stage;
      if (eligible && entering && !stoppedNow && !explosions.length)
        queue.push({
          cue: 'quacks-settlement',
          key: 'quacks:settle:' + key + ':' + state.version + ':' + stage,
          at: Date.now(),
          epoch,
        });
      while (seen.size > 128) seen.delete(seen.values().next().value);
      queue = queue.slice(-20);
      initialized = true;
      if (queue.length && timer === null) next();
    }
    const hide = () => {
      if (root.document.hidden) clear();
    };
    root.document.addEventListener('visibilitychange', hide);
    // Discard pending sounds on mute, but keep the independent public explosion presentation.
    const unsubscribe = root.AudioSettings?.subscribe?.(() => {
      if (muted()) queue = queue.filter((e) => e.explosions);
    });
    return {
      update,
      clear,
      destroy() {
        clear();
        seen.clear();
        unsubscribe?.();
        root.document.removeEventListener('visibilitychange', hide);
      },
    };
  }

  function createExplosion(host) {
    let context = null,
      initialized = false,
      active = [],
      timer = null;
    const seen = new Set();
    const clear = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      active = [];
      host.replaceChildren();
      host.hidden = true;
    };
    function show(events) {
      active.push(...events);
      if (timer !== null) clearTimeout(timer);
      const scene = node('section');
      scene.className = 'quacks-explosion-scene';
      scene.dataset.motion = root.MotionPolicy?.allowsMotion() === false ? 'still' : 'moving';
      scene.setAttribute('role', 'status');
      scene.setAttribute('aria-live', 'polite');
      const portrait = node('div');
      portrait.className = 'explosion-portrait';
      const img = node('img');
      img.src = '/assets/quacks/explosion-reference-v1.webp';
      img.alt = '爆鍋後哭哭的表情';
      img.width = 1592;
      img.height = 988;
      portrait.append(img);
      const caption = node('div');
      caption.className = 'explosion-caption';
      caption.append(node('strong', active.map((e) => e.name).join('、')), node('h3', '爆鍋了 QQ'));
      const close = node('button', '關閉爆鍋提示');
      close.type = 'button';
      root.GameUI?.decorateButton(close, 'close', { iconOnly: true });
      close.className += ' explosion-close';
      close.onclick = clear;
      scene.append(portrait, caption, close);
      host.replaceChildren(scene);
      host.hidden = false;
      timer = setTimeout(clear, 2800);
    }
    function update(state, live) {
      const next = state.code + ':' + state.roundId;
      if (next !== context) {
        clear();
        seen.clear();
        initialized = false;
        context = next;
      }
      if (!live || root.document.hidden) clear();
      const fresh = [];
      for (const p of state.recipes || []) {
        if (!p.explosionId || seen.has(p.explosionId)) continue;
        seen.add(p.explosionId);
        if (initialized && live && !root.document.hidden)
          fresh.push({ id: p.explosionId, name: p.name });
      }
      initialized = true;
      if (fresh.length) show(fresh);
    }
    const hidden = () => {
      if (root.document.hidden) clear();
    };
    root.document.addEventListener('visibilitychange', hidden);
    const unsubscribe = root.MotionPolicy?.subscribe(() => {
      if (root.document.hidden) clear();
      else if (host.children[0])
        host.children[0].dataset.motion = root.MotionPolicy.allowsMotion() ? 'moving' : 'still';
    });
    return {
      update,
      clear,
      show,
      size: () => seen.size,
      destroy() {
        clear();
        unsubscribe?.();
        root.document.removeEventListener('visibilitychange', hidden);
      },
    };
  }

  function createScoreboard(host, legendHost = root.document.querySelector('#scoreLegend')) {
    const svg = root.QuacksArt.scoreBoard(),
      pieces = new Map(),
      scores = new Map();
    host.replaceChildren(svg);
    return {
      update(state, live) {
        const legend = legendHost,
          list = [];
        const round = Number(state.round) || 0;
        for (const lantern of svg.querySelectorAll('[data-round]')) {
          const current = Number(lantern.getAttribute('data-round')) === round;
          lantern.classList.toggle('current-round', current);
          lantern.setAttribute(
            'aria-label',
            '第 ' + lantern.getAttribute('data-round') + ' 回合' + (current ? '，目前回合' : ''),
          );
          if (current) lantern.setAttribute('aria-current', 'step');
          else lantern.removeAttribute('aria-current');
        }
        const flame = svg.querySelector('.round-flame');
        flame.setAttribute('visibility', round ? 'visible' : 'hidden');
        if (round)
          flame.setAttribute(
            'transform',
            'translate(' + (137 + (round - 1) * 69) + ' ' + (110 + ((round - 1) % 2) * 53) + ')',
          );
        svg.querySelector('.score-round-label').textContent = round
          ? '目前第 ' + round + ' / 9 回合'
          : '等待開局';
        for (let index = 0; index < state.recipes.length; index++) {
          const p = state.recipes[index],
            color = state.potColors?.[p.potColor]?.liquid[0] || '#aed395';
          let piece = pieces.get(p.id);
          if (!piece) {
            piece = root.QuacksArt.pawn(color);
            pieces.set(p.id, piece);
            svg.append(piece);
          }
          piece.setAttribute('aria-label', p.name + ' ' + p.score + ' 分');
          let caption = piece.querySelector('title');
          if (!caption) {
            caption = root.document.createElementNS('http://www.w3.org/2000/svg', 'title');
            piece.append(caption);
          }
          caption.textContent = p.name + ' · ' + p.score + ' 分';
          for (const part of piece.querySelectorAll('path'))
            if (part.getAttribute('fill') && part.getAttribute('fill') !== 'none')
              part.setAttribute('fill', color);
          const offset = (index - 2) * 5,
            point = (n) => {
              const q = root.QuacksArt.scorePoint(n);
              return { x: q.x + offset, y: Math.max(50, q.y - (index % 2) * 6) };
            },
            target = point(p.score),
            previous = scores.get(p.id);
          if (previous !== p.score) {
            piece.getAnimations?.().forEach((a) => a.cancel());
            piece.style.transform = 'translate(' + target.x + 'px,' + target.y + 'px)';
            if (
              previous !== undefined &&
              live &&
              p.score > previous &&
              root.MotionPolicy?.allowsMotion()
            ) {
              const steps = Math.min(50, p.score - previous),
                frames = Array.from({ length: steps + 1 }, (_, i) => {
                  const q = point(i === 0 ? previous : p.score - steps + i);
                  return { transform: 'translate(' + q.x + 'px,' + q.y + 'px)' };
                });
              root.MotionPolicy.animate(piece, frames, {
                duration: Math.min(1600, 250 + steps * 65),
                easing: 'linear',
              });
            }
          }
          scores.set(p.id, p.score);
          const item = node(
            'span',
            p.name + ' · ' + p.score + ' 分' + (p.score > 50 ? '（超過50分）' : ''),
          );
          item.style.setProperty('--pawn-color', color);
          list.push(item);
        }
        for (const [id, piece] of pieces)
          if (!state.recipes.some((p) => p.id === id)) {
            piece.remove();
            pieces.delete(id);
            scores.delete(id);
          }
        legend.replaceChildren(...list);
      },
    };
  }

  root.QuacksFx = { create, createAudio, createExplosion, createScoreboard, die, labels };
})(window);
