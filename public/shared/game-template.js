/* Shared hierarchy: objects -> compositions -> patterns -> page adapters.
   Native game nodes stay owned by their existing controllers. */
(() => {
  'use strict';
  if (!window.GameUI) return;
  const ui = window.GameUI;
  const mounted = new WeakSet();
  function element(tag, { className = '', text, attrs = {} } = {}) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }
  function button({ label, icon, primary = false, onClick } = {}) {
    const node = element('button', {
      text: label,
      attrs: { type: 'button' },
      className: 'tpl-button' + (primary ? ' tpl-button--primary' : ''),
    });
    if (icon) ui.decorateButton(node, icon, { iconOnly: true, label });
    if (onClick) node.addEventListener('click', onClick);
    return node;
  }
  function characterMarkup(player) {
    const image = element('img', {
      attrs: {
        src:
          player.avatar ||
          (player.bot
            ? '/assets/characters/sunny-neutral.png'
            : '/assets/characters/traveler-neutral.png'),
        alt: '',
      },
    });
    return image.outerHTML;
  }
  function panel({ title, content = [], actions = [] } = {}) {
    const root = element('section', { className: 'tpl-panel tpl-stack' });
    const header = element('header', { className: 'tpl-panel__header' }),
      body = element('div', { className: 'tpl-panel__body' }),
      footer = element('footer', { className: 'tpl-panel__footer' });
    header.append(element('h2', { text: title }));
    body.append(...content);
    footer.append(...actions);
    root.append(header, body, footer);
    return { root, header, body, footer };
  }
  function disclosure({ label, icon = 'settings', content = [], open = false } = {}) {
    const root = element('details', { className: 'tpl-disclosure' }),
      summary = element('summary'),
      body = element('div', { className: 'tpl-disclosure__content' });
    const glyph = element('span', { className: 'ui-symbol', attrs: { 'aria-hidden': 'true' } });
    glyph.innerHTML = ui.symbol(icon);
    summary.append(glyph, element('span', { text: label }));
    body.append(...content);
    root.append(summary, body);
    root.open = open;
    ui.bindPopover?.(root, body, { align: 'start' });
    return root;
  }
  function dialogPanel({ title, titleId, className = '', closeLabel = '關閉' } = {}) {
    const root = ui.createDialog({ title, titleId, className });
    const close = button({ label: closeLabel, icon: 'close', onClick: () => root.close() });
    const body = element('div', { className: 'tpl-dialog-body' });
    root.prepend(close);
    root.append(body);
    document.body.append(root);
    return {
      root,
      body,
      open: (trigger) => ui.openDialog(root, trigger),
      close: () => {
        if (root.open) root.close();
      },
    };
  }
  function frame(node, kind) {
    if (node) node.classList.add('tpl-' + kind);
    return node;
  }
  const gate = window.MotionPolicy?.createGate(),
    events = new Map();
  let context = '';
  function updateRoster(container, state) {
    if (!container || !state) return;
    const key = state.type + ':' + state.code + ':' + state.me;
    if (key !== context) {
      context = key;
      events.clear();
    }
    const live = gate?.update(state) ?? false,
      now = Number(state.serverNow) || Date.now(),
      recent = new Map();
    for (const event of [
      ...(state.expressions || []),
      ...(state.social || []).filter((e) => e.kind === 'expression'),
    ])
      if (now - event.at >= 0 && now - event.at < 5000) recent.set(event.playerId, event);
    for (const row of container.querySelectorAll('[data-player-id]')) {
      frame(row, 'player');
      row.dataset.self = String(row.dataset.playerId === state.me);
      const avatar = row.querySelector('.room-player-avatar,.ui-room-roster-avatar');
      if (!avatar) continue;
      frame(avatar, 'portrait');
      const reaction = recent.get(row.dataset.playerId);
      let bubble = avatar.querySelector('.tpl-reaction');
      if (!reaction) {
        bubble?.remove();
        continue;
      }
      if (!bubble) {
        bubble = element('span', { className: 'tpl-reaction' });
        avatar.append(bubble);
      }
      bubble.textContent = reaction.label || reaction.expression; // plain text, no remote HTML
      if (events.get(row.dataset.playerId) !== reaction.id) {
        events.set(row.dataset.playerId, reaction.id);
        if (live)
          window.MotionPolicy?.animate(
            avatar,
            [
              { transform: 'translateY(0)' },
              { transform: 'translateY(-5px)' },
              { transform: 'translateY(0)' },
            ],
            { duration: 280 },
          );
      }
    }
  }
  function grid(root, { roster, stage, chat } = {}) {
    frame(root, 'game-grid');
    frame(roster, 'roster');
    frame(stage, 'stage');
    frame(chat, 'chat');
    return root;
  }
  function mountLobby() {
    const root = document.querySelector('.club');
    if (!root) return;
    if (mounted.has(root)) return;
    mounted.add(root);
    frame(root, 'page');
    frame(root.querySelector('main'), 'lobby-grid');
    frame(root.querySelector('.lobby-section'), 'panel');
    frame(root.querySelector('.rooms-section'), 'panel');
    const heading = root.querySelector('.library-heading'),
      carousel = root.querySelector('.game-carousel-section');
    if (heading && carousel) carousel.prepend(heading);
    const rooms = root.querySelector('.rooms-section'),
      join = rooms?.querySelector('.room-code-panel');
    if (join) rooms.prepend(join);
    for (const card of root.querySelectorAll('.game-tile')) frame(card, 'game-card');
    const footer = root.querySelector('.carousel-footer'),
      deck = root.querySelector('[data-card-carousel]');
    if (footer && deck) {
      const summary = element('div', { className: 'tpl-game-summary' }),
        title = element('strong'),
        description = element('p');
      summary.append(title, description);
      footer.querySelector('.carousel-actions')?.before(summary);
      const update = (card) => {
        if (!card) return;
        title.textContent = card.querySelector('h2')?.childNodes[0]?.textContent.trim() || '';
        description.textContent = card.querySelector('.tile-body p')?.textContent.trim() || '';
      };
      deck.addEventListener('game-card-selected', (event) => update(event.detail.card));
      update(deck.querySelector('.selected'));
    }
    const top = root.querySelector('.lobby-top');
    if (top && !top.querySelector('[data-template-emotes]')) {
      const emotes = button({
        label: '選擇我的大廳表情',
        icon: 'emoji',
        onClick: () => {
          const self = root.querySelector('button.lobby-avatar');
          if (self) self.click();
          else window.GameUI?.notify?.('角色正在載入，請稍後再試');
        },
      });
      emotes.dataset.templateEmotes = '';
      let actions = top.querySelector('.lobby-social-actions');
      if (!actions) {
        actions = element('div', { className: 'lobby-social-actions' });
        actions.setAttribute('role', 'group');
        actions.setAttribute('aria-label', '大廳表情與彈幕');
        top.append(actions);
      }
      actions.append(emotes);
      const barrage = top.querySelector('[data-lobby-barrage]');
      if (barrage) actions.append(barrage);
    }
  }
  const waitingScenes = new WeakMap();
  function waitingScene(center, state, config) {
    if (!center || state?.phase !== 'waiting') return;
    const layout = center.closest('.ui-room-waiting-layout'),
      hero = center.querySelector('.room-waiting-template');
    if (!layout || !hero) return;
    layout.classList.add('st-waiting-scene');
    let scene = waitingScenes.get(layout);
    if (!scene) {
      scene = {};
      waitingScenes.set(layout, scene);
    }
    scene.config = config;
    scene.state = state;
    const make = (tag, cls = '', value) =>
      element(tag, { className: cls, ...(value === undefined ? {} : { text: value }) });
    const text = (n, value) => {
      if (n && n.textContent !== String(value)) n.textContent = String(value);
    };
    const action = (label, icon, callback, cls = '') => {
      const n = button({ label, icon, onClick: (event) => scene.config[callback]?.(event) });
      n.classList.add('st-button', ...cls.split(' ').filter(Boolean));
      if (icon) ui.decorateButton(n, icon, { label, iconOnly: false });
      return n;
    };
    let banner = center.querySelector('.st-waiting-banner');
    if (!banner) {
      banner = make('section', 'st-waiting-banner');
      banner.setAttribute('aria-label', '房間準備狀態');
      center.prepend(banner);
    }
    if (!banner.querySelector('.st-ready-copy')) {
      const mark = make('span', 'st-ready-mark'),
        copy = make('div', 'st-ready-copy');
      mark.setAttribute('aria-hidden', 'true');
      mark.innerHTML = ui.symbol('check');
      copy.append(make('strong'), make('small'));
      banner.replaceChildren(mark, copy, make('span', 'st-ready-badge'));
    }
    const enough = state.players.length >= 2;
    text(
      banner.querySelector('strong'),
      config.readiness ||
        (enough
          ? config.owner
            ? '人數達標，房主可隨時開始'
            : '朋友已就位，等待房主開始'
          : '入座成功，等朋友一起開桌'),
    );
    text(
      banner.querySelector('small'),
      '目前 ' +
        state.players.length +
        ' 人已入座' +
        (enough ? '，' + config.readyCopy : '，至少 2 人即可開始'),
    );
    text(banner.querySelector('.st-ready-badge'), enough ? 'READY' : 'WAITING');
    if (!hero.querySelector('.st-showcase-body')) {
      const header = make('div', 'st-showcase-header'),
        body = make('div', 'st-showcase-body');
      header.append(
        make('span', 'st-classic-tag', 'CLASSIC MODE'),
        make('span', 'st-waiting-limit'),
      );
      hero.prepend(header);
      body.append(
        hero.querySelector('.room-waiting-art'),
        hero.querySelector('.room-waiting-info'),
      );
      header.after(body);
      hero.append(make('div', 'st-waiting-facts'));
    }
    text(hero.querySelector('.st-waiting-limit'), config.limit);
    const art = hero.querySelector('.room-waiting-art img');
    if (art && art.getAttribute('src') !== config.art && !art.dataset.stAssetUnavailable) {
      art.onerror = () => {
        art.dataset.stAssetUnavailable = 'true';
        art.src = config.fallbackArt;
      };
      art.src = config.art;
    }
    const heading = hero.querySelector('.room-waiting-info h2'),
      key = config.title + '|' + config.english;
    if (heading.dataset.waitingTitle !== key) {
      heading.dataset.waitingTitle = key;
      heading.replaceChildren(
        make('span', '', config.title),
        make('small', 'st-game-english', config.english),
      );
    }
    text(hero.querySelector('.room-waiting-info>.kicker'), config.kicker);
    text(hero.querySelector('.room-waiting-info>p:not(.room-waiting-hint)'), config.description);
    const facts = hero.querySelector('.st-waiting-facts'),
      factKey = JSON.stringify(config.facts);
    if (facts.dataset.facts !== factKey) {
      facts.dataset.facts = factKey;
      facts.replaceChildren(
        ...config.facts.map(([label, value]) => {
          const n = make('div');
          n.append(make('strong', '', value), make('small', '', label));
          return n;
        }),
      );
    }
    const ready = center.querySelector('.st-ready-button');
    if (ready && ready.parentElement !== hero) hero.append(ready);
    const roster = layout.querySelector('.ui-room-roster'),
      list = roster?.querySelector('.ui-room-roster-list');
    if (roster && !roster.querySelector('.st-room-share')) {
      const share = make('div', 'st-room-share'),
        copy = make('div');
      copy.append(make('small', '', '快速邀請連結'), make('code'));
      share.append(copy, action('複製', null, 'onCopy'));
      roster.append(share);
    }
    const link = location.host + '/' + state.type + '/' + state.code,
      code = roster?.querySelector('.st-room-share code');
    text(code, link);
    if (code) code.title = location.origin + '/' + state.type + '/' + state.code;
    text(
      roster?.querySelector('.ui-room-roster-count'),
      state.players.length + ' 位已入座 · 最多 ' + config.capacity + ' 人',
    );
    if (list) {
      for (const row of list.querySelectorAll('[data-player-id]')) {
        const player = state.players.find((p) => p.id === row.dataset.playerId);
        if (!player) continue;
        const name = row.querySelector('.ui-room-roster-name'),
          label = player.id === config.hostId ? '房主' : player.bot ? '機器人' : '';
        let badge = name?.querySelector('.st-player-badge');
        if (label && name) {
          if (!badge) {
            badge = make('small', 'st-player-badge');
            name.append(badge);
          }
          text(badge, label);
        } else badge?.remove();
      }
      const bot = list.querySelector('[data-room-common-action=bot]');
      text(bot?.querySelector('.ui-room-roster-action-label'), '＋ 加入 AI 測試夥伴');
      const seats = Math.min(2, Math.max(0, config.capacity - state.players.length)),
        key = state.players.length + ':' + seats;
      if (
        list.dataset.stSeats !== key ||
        list.querySelectorAll('.st-empty-seat').length !== seats
      ) {
        list.dataset.stSeats = key;
        for (const old of list.querySelectorAll('.st-empty-seat')) old.remove();
        for (let i = 0; i < seats; i++) {
          const seat = make('article', 'st-empty-seat'),
            icon = make('span'),
            copy = make('div');
          seat.setAttribute(
            'aria-label',
            '第 ' + (state.players.length + i + 1) + ' 號座位，等待朋友入座',
          );
          icon.innerHTML = ui.symbol('users');
          copy.append(
            make('strong', '', '第 ' + (state.players.length + i + 1) + ' 號座位'),
            make('p', '', '等待好友入座…'),
          );
          seat.append(icon, copy, make('small', '', '空缺'));
          list.append(seat);
        }
      }
    }
    let rail = layout.querySelector('.st-waiting-status');
    if (!rail) {
      rail = make('section', 'st-waiting-status');
      rail.setAttribute('aria-label', '房間連線與操作');
      const main = make('div', 'st-status-main'),
        status = make('span', 'st-owner-status'),
        code = make('span'),
        actions = make('div', 'st-status-actions');
      status.append(make('span', 'st-connection-dot'), make('span', 'st-owner-copy'));
      code.append(make('span', '', '房間代號：'), make('code', 'st-status-code'));
      main.append(status, code);
      actions.append(
        action('房間閒聊與表情', 'chat', 'onChat'),
        action('遊玩說明', 'help', 'onHelp', 'st-waiting-help'),
        action('解散房間', 'leave', 'onDissolve', 'st-danger st-waiting-dissolve'),
        action('離開房間', 'leave', 'onLeave', 'st-waiting-leave'),
      );
      rail.append(main, actions);
      layout.append(rail);
    }
    text(rail.querySelector('.st-owner-copy'), config.owner ? '房主權限生效中' : '等待房主開始');
    text(rail.querySelector('.st-status-code'), state.code);
    const dissolve = rail.querySelector('.st-waiting-dissolve'),
      leave = rail.querySelector('.st-waiting-leave'),
      hideDissolve = !config.owner || !config.onDissolve,
      hideLeave = config.owner && !!config.onDissolve;
    if (dissolve.hidden !== hideDissolve) dissolve.hidden = hideDissolve;
    if (leave.hidden !== hideLeave) leave.hidden = hideLeave;
    const panel = layout.querySelector('.ui-room-controls'),
      headingSettings = panel?.querySelector('.ui-room-settings-heading');
    if (headingSettings) {
      let badge = headingSettings.querySelector('.st-settings-badge');
      if (!badge) {
        badge = make('small', 'st-settings-badge');
        headingSettings.append(badge);
      }
      text(badge, config.owner ? '房主專用' : '唯讀設定');
    }
    const row = panel?.querySelector('.ui-room-session-actions');
    if (row && !row.querySelector('.st-waiting-invite'))
      row.append(action('邀請朋友 ↗', 'share', 'onInvite', 'st-waiting-invite'));
    const manage = row?.querySelector('[data-room-action=manage]');
    if (
      manage &&
      (manage.classList.contains('ui-icon-button') ||
        manage.getAttribute('aria-label') !== '房間管理')
    ) {
      ui.decorateButton(manage, 'settings', { label: '房間管理', iconOnly: false });
      manage.setAttribute('aria-label', '房間管理');
      manage.title = '房間管理';
    }
    return { layout, hero, banner, roster, list, rail, panel, row, manage };
  }
  function refreshWaiting(layout) {
    const scene = waitingScenes.get(layout);
    if (scene) waitingScene(layout.querySelector('.tpl-waiting-center'), scene.state, scene.config);
  }
  function podium({ players, winners = [], correctCounts = {} }) {
    const root = element('div', { className: 'tpl-podium' }),
      top = element('ol', { className: 'stage-player-cards st-podium-cards' }),
      rest = element('ol', { className: 'st-ranking-list' });
    let rank = 0,
      previous = null;
    players.forEach((player, index) => {
      if (player.score !== previous) rank = index + 1;
      previous = player.score;
      const card = element('li', {
        className: index < 3 ? 'stage-player-card st-podium-cell' : 'st-ranking-row',
      });
      card.dataset.rank = rank;
      card.dataset.podium = index + 1;
      card.dataset.winner = String(winners.includes(player.id));
      if (winners.includes(player.id)) card.classList.add('stage-winner');
      const image = element('img', {
          className: 'stage-avatar',
          attrs: {
            src:
              player.avatar ||
              (player.bot
                ? '/assets/characters/sunny-neutral.png'
                : '/assets/characters/traveler-neutral.png'),
            alt: '',
          },
        }),
        name = element('b');
      name.innerHTML = ui.playerName(player.name);
      const score = element('strong', { text: player.score + ' 分' });
      card.append(image, name, score);
      if (index < 3) {
        const base = element('div', { className: 'st-podium-base' });
        base.append(
          element('span', {
            className: 'stage-card-rank',
            text: rank,
            attrs: { 'aria-label': '排名 ' + rank },
          }),
          element('span', {
            className: 'st-podium-medal',
            text: winners.includes(player.id)
              ? winners.length > 1
                ? '共同優勝'
                : 'CHAMPION'
              : index === 1
                ? 'SILVER'
                : 'BRONZE',
          }),
        );
        card.append(base);
        top.append(card);
      } else {
        card.prepend(element('span', { text: '#' + rank }));
        card.append(element('small', { text: '猜中 ' + (correctCounts[player.id] || 0) + ' 次' }));
        rest.append(card);
      }
    });
    root.append(top);
    if (players.length > 3) {
      root.append(element('h3', { text: '完整排名席次' }), rest);
    }
    return root.outerHTML;
  }
  ui.Template = {
    objects: { element, button, frame, characterMarkup },
    compositions: { panel, disclosure, dialogPanel, podium },
    patterns: { grid, updateRoster, waitingScene, refreshWaiting },
    pages: { mountLobby },
  };
  if (document.body.dataset.uiTemplate && document.body.dataset.gameKind !== 'draw') mountLobby();
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) gate?.dispose();
  });
})();
