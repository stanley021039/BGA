(() => {
  'use strict';
  const list = document.querySelector('#achievementList'),
    summary = document.querySelector('#achievementSummary'),
    gameFilter = document.querySelector('#achievementGameFilter'),
    statusFilter = document.querySelector('#achievementStatusFilter'),
    filterSummary = document.querySelector('#achievementFilterSummary'),
    retry = document.querySelector('#achievementRetry');
  const groups = [
    { key: 'draw', label: '你畫我猜', icon: 'edit' },
    { key: 'gift', label: '送禮達人', icon: 'gift' },
    { key: 'majority', label: '同頻俱樂部', icon: 'users' },
    { key: 'poker', label: '德州撲克', icon: 'cards' },
    { key: 'thunder', label: '雷霆之路', icon: 'car' },
    { key: 'quacks', label: '郎中闖江湖', icon: 'table' },
    { key: 'telephone', label: '傳情畫意', icon: 'edit' },
    { key: 'trpg', label: '霧港跑團', icon: 'book' },
    { key: 'minimal', label: '極簡畫家', icon: 'edit' },
    { key: 'market', label: '股市冥燈', icon: 'table' },
    { key: 'musicquiz', label: '猜歌挑戰', icon: 'sound' },
    { key: 'bluff', label: '瞎掰王', icon: 'users' },
    { key: 'all', label: '跨桌探索', icon: 'table' },
    { key: 'other', label: '其他成就', icon: 'book' },
  ];
  const icons = new Set([
    'edit',
    'gift',
    'users',
    'cards',
    'car',
    'table',
    'book',
    'check',
    'lock',
    'emoji',
    'frame',
    'save',
    'sound',
    'help',
  ]);
  const categories = new Map([
    ['intro', '入門'],
    ['fun', '趣味'],
    ['exploration', '探索'],
  ]);
  const dateFormat = new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeZone: 'Asia/Taipei',
  });
  let achievements = [],
    rewards = [],
    loading = false;
  const groupKey = (item) =>
    groups.some((group) => group.key === item.game && group.key !== 'other') ? item.game : 'other';
  function iconNode(name, className) {
    const node = document.createElement('span');
    node.className = className;
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = window.GameUI?.icon?.(name) || '';
    return node;
  }
  function createCard(item, group) {
    const card = document.createElement('article'),
      body = document.createElement('div'),
      title = document.createElement('h4'),
      description = document.createElement('p'),
      status = document.createElement('span'),
      metadata = document.createElement('div');
    const unlocked = !!item.unlockedAt,
      id = String(item.achievement_id || item.id);
    card.className = 'achievement-card';
    card.classList.toggle('unlocked', unlocked);
    card.dataset.achievementId = id;
    body.className = 'achievement-body';
    title.textContent = String(item.title || '未命名成就');
    description.textContent = String(item.description ?? '');
    status.className = 'achievement-status ui-sr-only';
    status.textContent = unlocked ? '已解鎖' : '尚未解鎖';
    body.append(title, description, status);
    if (unlocked) {
      const date = new Date(item.unlockedAt),
        time = document.createElement('time');
      time.className = 'achievement-date';
      if (Number.isFinite(date.getTime())) {
        time.dateTime = date.toISOString();
        time.textContent = '取得於 ' + dateFormat.format(date);
      } else time.textContent = '取得日期待確認';
      body.append(time);
    }
    metadata.className = 'achievement-metadata';
    if (categories.has(item.category)) {
      const category = document.createElement('span');
      category.textContent = categories.get(item.category);
      metadata.append(category);
    }
    body.append(metadata);
    if (item.progress) {
      const progress = document.createElement('p');
      progress.className = 'achievement-progress';
      progress.textContent =
        '有效完成 ' + item.progress.current + ' / ' + item.progress.target + ' 次';
      body.append(progress);
    }
    const reward = rewards.find((r) => r.achievementId === id);
    if (reward) body.append(rewardPanel(reward));
    if (item.status === 'paused') {
      const note = document.createElement('p');
      note.className = 'achievement-paused';
      note.textContent = '暫停新授予，已取得紀錄保留。';
      body.append(note);
    }
    const name = icons.has(item.icon_key) ? item.icon_key : group.icon;
    card.append(iconNode(name, 'achievement-mark'), body);
    return card;
  }

  function rewardPanel(reward) {
    const panel = document.createElement('section'),
      title = document.createElement('strong'),
      preview = document.createElement('span'),
      note = document.createElement('p'),
      actions = document.createElement('div');
    panel.className = 'achievement-reward';
    panel.setAttribute('aria-label', reward.label + '成就獎勵');
    title.textContent = '專屬獎勵 · ' + reward.label;
    preview.className = 'barrage-frame-preview';
    window.BarrageFrames?.decorate?.(
      preview,
      { kind: 'builtin', id: reward.frameId, version: 1 },
      '我的成就',
      '一起玩，留下這一桌的回憶。',
    );
    note.className = 'achievement-reward-status';
    note.textContent = reward.claimedAt
      ? '已領取 · 彈幕與播放器皆可使用'
      : reward.earned
        ? '成就已達成，可以領取獎勵'
        : '達成「' + reward.achievementTitle + '」可領取此專屬彈幕框';
    actions.className = 'achievement-reward-actions';
    const views = document.createElement('div'),
      chatView = document.createElement('div'),
      chatLabel = document.createElement('span'),
      playerView = document.createElement('div'),
      playerLabel = document.createElement('span'),
      playerPreview = document.createElement('span');
    views.className = 'achievement-reward-views';
    chatView.className = playerView.className = 'achievement-reward-view';
    chatLabel.className = playerLabel.className = 'achievement-preview-label';
    chatLabel.textContent = '彈幕框預覽';
    playerLabel.textContent = '播放器外觀預覽';
    playerPreview.className = 'barrage-frame-preview achievement-player-preview';
    window.BarrageFrames?.decorate?.(
      playerPreview,
      { kind: 'builtin', id: reward.frameId, version: 1 },
      '播放器',
      '歌曲播放外觀示意',
    );
    const deck = document.createElement('span');
    deck.className = 'achievement-player-deck';
    deck.setAttribute('aria-hidden', 'true');
    deck.append(iconNode('sound', 'achievement-player-symbol'));
    const track = document.createElement('span');
    track.className = 'achievement-player-track';
    deck.append(track, iconNode('play', 'achievement-player-symbol'));
    (playerPreview.querySelector('.barrage-frame-content') || playerPreview).append(deck);
    chatView.append(chatLabel, preview);
    playerView.append(playerLabel, playerPreview);
    views.append(chatView, playerView);
    panel.append(title, views, note, actions);
    const button = (label, run) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.onclick = run;
      actions.append(b);
      return b;
    };
    if (!reward.claimedAt) {
      const claim = button(reward.earned ? '領取獎勵' : '尚未達成', async () => {
        if (claim.disabled) return;
        claim.disabled = true;
        note.textContent = '正在領取…';
        try {
          const response = await fetch('/api/achievements/claim', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ frameId: reward.frameId }),
            }),
            data = await response.json();
          if (!response.ok) throw Error(data.error || '領取失敗');
          rewards = data.rewards;
          achievements = data.achievements;
          window.BarrageFrames?.acceptRewards?.(data);
          render();
        } catch (error) {
          note.setAttribute('role', 'alert');
          note.textContent = error.message;
          claim.disabled = false;
        }
      });
      claim.disabled = !reward.earned;
    } else {
      button('套用彈幕框', () => {
        window.BarrageFrames?.set?.({ selected: reward.frameId });
        note.textContent = '已套用彈幕框；播放器外觀保留你的選擇。';
      }).dataset.rewardBarrage = reward.frameId;
      button('套用播放器', () => {
        window.MediaAppearance?.set?.(reward.frameId);
        note.textContent = '已套用播放器；彈幕框保留你的選擇。';
      }).dataset.rewardPlayer = reward.frameId;
    }
    return panel;
  }

  function render() {
    const filtered = achievements.filter(
      (item) =>
        (gameFilter.value === '*' || groupKey(item) === gameFilter.value) &&
        (statusFilter.value === '*' || (statusFilter.value === 'unlocked') === !!item.unlockedAt),
    );
    list.replaceChildren();
    for (const group of groups) {
      const items = filtered.filter((item) => groupKey(item) === group.key);
      if (!items.length) continue;
      const section = document.createElement('section'),
        heading = document.createElement('h3'),
        name = document.createElement('span'),
        count = document.createElement('span'),
        cards = document.createElement('div');
      section.className = 'achievement-group';
      section.dataset.game = group.key;
      heading.className = 'achievement-group-heading';
      heading.id = 'achievement-group-' + group.key;
      section.setAttribute('aria-labelledby', heading.id);
      const total = achievements.filter((item) => groupKey(item) === group.key);
      name.textContent = group.label;
      count.className = 'achievement-group-count';
      count.textContent =
        '已收藏 ' + total.filter((item) => item.unlockedAt).length + ' / ' + total.length + ' 枚';
      heading.append(iconNode(group.icon, 'achievement-group-icon'), name, count);
      cards.className = 'achievement-list';
      for (const item of items) cards.append(createCard(item, group));
      section.append(heading, cards);
      list.append(section);
    }
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'achievement-empty';
      empty.textContent = achievements.length ? '此篩選沒有符合的成就。' : '目前沒有可收集的成就。';
      list.append(empty);
    }
    summary.textContent =
      '已收藏 ' +
      achievements.filter((item) => item.unlockedAt).length +
      ' / ' +
      achievements.length +
      ' 枚';
    filterSummary.textContent = '目前顯示 ' + filtered.length + ' 枚';
    syncApplied();
  }
  function syncApplied() {
    if (!window.BarrageFrames && !window.MediaAppearance) return;
    for (const button of list.querySelectorAll('[data-reward-barrage]')) {
      const applied = window.BarrageFrames?.get?.().selected === button.dataset.rewardBarrage;
      button.setAttribute('aria-pressed', String(applied));
      button.textContent = applied ? '彈幕框使用中' : '套用彈幕框';
    }
    for (const button of list.querySelectorAll('[data-reward-player]')) {
      const applied = window.MediaAppearance?.get?.() === button.dataset.rewardPlayer;
      button.setAttribute('aria-pressed', String(applied));
      button.textContent = applied ? '播放器使用中' : '套用播放器';
    }
  }
  function updateGameOptions() {
    const previous = gameFilter.value;
    gameFilter.replaceChildren();
    const option = document.createElement('option');
    option.value = '*';
    option.textContent = '全部遊戲與探索';
    gameFilter.append(option);
    for (const group of groups) {
      if (!achievements.some((item) => groupKey(item) === group.key)) continue;
      const option = document.createElement('option');
      option.value = group.key;
      option.textContent = group.label;
      gameFilter.append(option);
    }
    gameFilter.value = Array.from(gameFilter.options).some((option) => option.value === previous)
      ? previous
      : '*';
  }
  async function load() {
    if (loading) return;
    loading = true;
    gameFilter.disabled = true;
    statusFilter.disabled = true;
    retry.hidden = true;
    list.setAttribute('aria-busy', 'true');
    summary.textContent = '正在讀取收藏…';
    try {
      const response = await fetch('/api/achievements'),
        data = await response.json();
      if (!response.ok) throw Error(data?.error || '無法載入成就');
      if (!Array.isArray(data?.achievements)) throw Error('成就資料格式不正確，請重新載入。');
      rewards = Array.isArray(data.rewards) ? data.rewards : [];
      window.BarrageFrames?.acceptRewards?.(data);
      achievements = data.achievements.filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof (item.achievement_id || item.id) === 'string' &&
          (item.status === undefined ||
            item.status === 'enabled' ||
            (item.status === 'paused' && !!item.unlockedAt)),
      );
      updateGameOptions();
      render();
      gameFilter.disabled = false;
      statusFilter.disabled = false;
    } catch (error) {
      list.replaceChildren();
      const message = document.createElement('p');
      message.className = 'achievement-empty achievement-error';
      message.setAttribute('role', 'alert');
      message.textContent = error.message || '無法載入成就';
      list.append(message);
      summary.textContent = '收藏暫時無法載入。';
      filterSummary.textContent = '';
      retry.hidden = false;
    } finally {
      loading = false;
      list.setAttribute('aria-busy', 'false');
    }
  }
  gameFilter.addEventListener('change', render);
  statusFilter.addEventListener('change', render);
  retry.addEventListener('click', load);
  window.BarrageFrames?.subscribe?.(syncApplied);
  window.MediaAppearance?.subscribe?.(syncApplied);
  window.GameUI?.decorateButton?.(retry, 'refresh', { iconOnly: true, label: '重新載入成就' });
  load();
})();
