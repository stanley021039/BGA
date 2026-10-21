(() => {
  const stage = document.querySelector('#lobbyStage'),
    layer = document.querySelector('#lobbyVisitors');
  if (!stage || !layer) return;
  const status = document.querySelector('#lobbyStatus'),
    count = document.querySelector('#lobbyCount');
  const marker = document.querySelector('#lobbyDestination');
  const menu = document.querySelector('#lobbyEmoteMenu'),
    choices = document.querySelector('#lobbyEmoteChoices');
  const visitors = new Map();
  const expressionSounds = window.ExpressionSounds?.create();
  const seenBarrages = new Set();
  let barragePrimed = false;
  const barrageLayer = document.createElement('div');
  barrageLayer.className = 'lobby-barrage-layer';
  barrageLayer.setAttribute('aria-live', 'off');
  document.body.append(barrageLayer);
  const barrageDialog = document.createElement('dialog');
  barrageDialog.className = 'lobby-barrage-dialog';
  barrageDialog.setAttribute('aria-labelledby', 'lobbyBarrageTitle');
  barrageDialog.innerHTML =
    '<header><h2 id="lobbyBarrageTitle">大廳彈幕</h2><button type="button" data-close aria-label="關閉大廳彈幕">關閉</button></header><form><label for="lobbyBarrageText">想和大家說什麼？</label><input id="lobbyBarrageText" maxlength="160" required autocomplete="off"><div class="lobby-barrage-actions"><button type="button" data-frame>選擇彈幕框</button><button type="submit">發送</button></div><p role="status"></p></form>';
  document.body.append(barrageDialog);
  const barrageTrigger = document.createElement('button');
  barrageTrigger.type = 'button';
  barrageTrigger.textContent = '發送大廳彈幕';
  barrageTrigger.dataset.lobbyBarrage = '';
  window.GameUI?.decorateButton(barrageTrigger, 'chat', { iconOnly: true, label: '發送大廳彈幕' });
  document.querySelector('.lobby-top')?.append(barrageTrigger);
  const closeBarrage = barrageDialog.querySelector('[data-close]');
  window.GameUI?.decorateButton(closeBarrage, 'close', { iconOnly: true, label: '關閉大廳彈幕' });
  closeBarrage.onclick = () => barrageDialog.close();
  barrageTrigger.onclick = () => {
    if (window.GameUI) window.GameUI.openDialog(barrageDialog, barrageTrigger);
    else barrageDialog.showModal();
  };
  barrageDialog.querySelector('[data-frame]').onclick = (event) =>
    window.BarrageFrames?.openPicker(event.currentTarget);
  let pendingBarrage = null,
    sendingBarrage = false;
  barrageDialog.querySelector('form').onsubmit = async (event) => {
    event.preventDefault();
    if (sendingBarrage) return;
    const input = barrageDialog.querySelector('input'),
      feedback = barrageDialog.querySelector('[role=status]'),
      submit = barrageDialog.querySelector('[type=submit]'),
      message = input.value.trim(),
      builtinFrameId = window.BarrageFrames?.get().selected || 'default';
    if (!message) return;
    if (
      !pendingBarrage ||
      pendingBarrage.message !== message ||
      pendingBarrage.builtinFrameId !== builtinFrameId
    )
      pendingBarrage = { message, builtinFrameId, requestId: crypto.randomUUID() };
    sendingBarrage = true;
    submit.disabled = true;
    feedback.textContent = '傳送中…';
    try {
      const response = await fetch('/api/lobby/barrage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingBarrage),
        }),
        data = await response.json();
      if (!response.ok) throw Error(data.error || '傳送失敗');
      render(data);
      input.value = '';
      pendingBarrage = null;
      feedback.textContent = '已發送';
      barrageDialog.close();
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      sendingBarrage = false;
      submit.disabled = false;
    }
  };
  function renderBarrages(data) {
    const events = Array.isArray(data.barrages) ? data.barrages : [];
    if (!barragePrimed) {
      events.forEach((e) => seenBarrages.add(e.id));
      barragePrimed = true;
      return;
    }
    for (const event of events) {
      if (seenBarrages.has(event.id)) continue;
      seenBarrages.add(event.id);
      if (seenBarrages.size > 256) seenBarrages.delete(seenBarrages.values().next().value);
      if (document.hidden || window.MotionPolicy?.get?.().barrages === false) continue;
      const bubble = document.createElement('div');
      bubble.className = 'game-barrage game-barrage-framed lobby-barrage';
      if (window.BarrageFrames)
        window.BarrageFrames.decorate(
          bubble,
          event.frame,
          event.name,
          [...event.message].slice(0, 40).join('') + ([...event.message].length > 40 ? '…' : ''),
        );
      else bubble.textContent = event.name + '：' + event.message;
      if (window.BarrageFrames?.place(barrageLayer, bubble)) {
        bubble.addEventListener('animationend', () => bubble.remove(), { once: true });
        setTimeout(() => bubble.remove(), 8000);
      }
    }
  }

  let inFlight = false,
    ready = false,
    queuedTarget = null,
    destination = null,
    emotesLoaded = false,
    positionReset = true;
  let selfAvatar = null,
    emotePopover = null;
  function closeMenu() {
    menu.hidden = true;
    selfAvatar?.setAttribute('aria-expanded', 'false');
  }
  function bindSelfAvatar(node) {
    if (selfAvatar === node) return;
    closeMenu();
    emotePopover?.destroy();
    selfAvatar = node;
    if (!node) {
      emotePopover = null;
      return;
    }
    node.setAttribute('aria-haspopup', 'dialog');
    node.setAttribute('aria-controls', 'lobbyEmoteMenu');
    node.setAttribute('aria-expanded', 'false');
    emotePopover = window.UIPopover?.bind(node, menu, { align: 'end', onClose: closeMenu });
    node.addEventListener('click', () => {
      if (!ready) return;
      if (!menu.hidden) {
        closeMenu();
        return;
      }
      menu.hidden = false;
      node.setAttribute('aria-expanded', 'true');
      emotePopover?.sync();
      loadEmotes();
    });
  }
  function render(data) {
    if (!data || !Array.isArray(data.visitors)) throw Error('大廳資料格式不正確');
    window.RoomPings?.update({
      code: '__LOBBY__',
      type: 'lobby',
      me: data.selfId,
      players: data.visitors,
      serverNow: data.serverNow,
      pingContext: data.pingContext,
    });
    expressionSounds?.update({
      contextId: typeof data.selfId === 'string' ? `lobby:${data.selfId}` : '',
      serverNow: data.serverNow,
      events: data.visitors
        .filter((visitor) => visitor.emote)
        .map((visitor) => ({
          id: visitor.emote.id || `${visitor.id}:${visitor.emote.at}`,
          at: visitor.emote.at,
          sound: visitor.emote.sound,
        })),
    });
    renderBarrages(data);
    const resetPositions = positionReset;
    positionReset = false;
    const active = new Set();
    for (const visitor of data.visitors) {
      if (
        typeof visitor.id !== 'string' ||
        !Number.isFinite(visitor.x) ||
        !Number.isFinite(visitor.y)
      )
        continue;
      active.add(visitor.id);
      let node = visitors.get(visitor.id);
      const isNew = !node;
      if (!node) {
        node = document.createElement(visitor.id === data.selfId ? 'button' : 'div');
        node.className = 'lobby-avatar';
        node.dataset.playerId = visitor.id;
        if (visitor.id === data.selfId) node.type = 'button';
        const bubble = document.createElement('div');
        bubble.className = 'lobby-speech';
        bubble.hidden = true;
        const image = document.createElement('img');
        image.alt = '';
        image.draggable = false;
        const label = document.createElement('span');
        node.append(bubble, image, label);
        layer.append(node);
        visitors.set(visitor.id, node);
      }
      if (isNew || resetPositions) {
        node.classList.add('is-placing');
        node.style.left = visitor.x + '%';
        node.style.top = visitor.y + '%';
        void node.offsetWidth;
      }
      if (isNew || resetPositions || node.dataset.moveId !== String(visitor.moveId)) {
        // Even a short move should remain visible after network and polling delay.
        const duration = visitor.moveId === 0 ? 0 : Math.max(350, Number(visitor.remainingMs) || 0);
        node.style.setProperty('--lobby-move-duration', duration + 'ms');
        node.classList.remove('is-placing');
        node.style.left = (visitor.moving ? visitor.targetX : visitor.x) + '%';
        node.style.top = (visitor.moving ? visitor.targetY : visitor.y) + '%';
        node.dataset.moveId = String(visitor.moveId);
      }
      node.style.zIndex = String(Math.round(visitor.y));
      node.classList.toggle('is-self', visitor.id === data.selfId);
      if (visitor.id === data.selfId) {
        bindSelfAvatar(node);
        node.setAttribute('aria-label', visitor.name + '（你），選擇表情');
      }
      node.classList.toggle('is-moving', !!visitor.moving);
      node.classList.toggle('facing-left', visitor.facing === 'left');
      const image = node.querySelector('img'),
        source = visitor.emote?.image || visitor.image;
      if (image.getAttribute('src') !== source) image.src = source;
      const bubble = node.querySelector('.lobby-speech');
      bubble.hidden = !visitor.emote;
      if (visitor.emote) {
        bubble.textContent = visitor.emote.label;
        // Keep the complete caption inside the stage, including edge seats.
        const half = bubble.offsetWidth / 2,
          center = (layer.clientWidth * visitor.x) / 100;
        const safeCenter = Math.max(half + 8, Math.min(layer.clientWidth - half - 8, center));
        bubble.style.left = node.offsetWidth / 2 - half + safeCenter - center + 'px';
        if (node.dataset.emoteAt !== String(visitor.emote.at)) {
          node.dataset.emoteAt = String(visitor.emote.at);
          node.classList.remove('is-emoting');
          void node.offsetWidth;
          node.classList.add('is-emoting');
        }
      } else {
        node.classList.remove('is-emoting');
        delete node.dataset.emoteAt;
      }
      node.querySelector('span').textContent =
        visitor.name + (visitor.id === data.selfId ? '（你）' : '');
      if (
        visitor.id === data.selfId &&
        destination &&
        Math.hypot(visitor.x - destination.x, visitor.y - destination.y) < 1
      ) {
        destination = null;
        marker.hidden = true;
      }
    }
    for (const [id, node] of visitors)
      if (!active.has(id)) {
        if (node === selfAvatar) bindSelfAvatar(null);
        node.remove();
        visitors.delete(id);
      }
    emotePopover?.position();
    count.textContent = `${active.size} 位在大廳`;
    status.textContent = '';
    ready = true;
  }
  async function sync(target) {
    if (document.visibilityState === 'hidden') return;
    if (inFlight) {
      if (target) queuedTarget = target;
      return;
    }
    inFlight = true;
    try {
      const response = await fetch(
        target ? '/api/lobby/move' : '/api/lobby',
        target
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(target),
            }
          : {},
      );
      if (!response.ok)
        throw Error(response.status === 401 ? '登入已失效，請重新登入' : '大廳暫時無法連線');
      render(await response.json());
    } catch (error) {
      status.textContent = error.message;
      ready = false;
      expressionSounds?.reset();
      window.RoomPings?.disconnect();
    } finally {
      inFlight = false;
      if (queuedTarget) {
        const next = queuedTarget;
        queuedTarget = null;
        sync(next);
      }
    }
  }
  async function loadEmotes() {
    if (emotesLoaded) return;
    choices.textContent = '載入中…';
    try {
      const response = await fetch('/api/lobby/emotes');
      if (!response.ok) throw Error('無法載入表情');
      const { emotes } = await response.json();
      choices.replaceChildren();
      if (!emotes.length) {
        const empty = document.createElement('p');
        empty.textContent = '這個角色尚無表情，可到「我的角色」新增。';
        choices.append(empty);
      }
      for (const emote of emotes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'lobby-emote-choice';
        button.setAttribute('aria-label', emote.label);
        const image = document.createElement('img');
        image.src = emote.image;
        image.alt = '';
        const label = document.createElement('span');
        label.textContent = emote.label;
        button.append(image, label);
        button.addEventListener('click', () => useEmote(emote.expression));
        choices.append(button);
      }
      emotesLoaded = true;
    } catch (error) {
      choices.textContent = error.message;
    }
  }
  async function useEmote(expression) {
    try {
      const response = await fetch('/api/lobby/emote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || '無法使用表情');
      render(data);
      closeMenu();
      selfAvatar?.focus({ preventScroll: true });
    } catch (error) {
      status.textContent = error.message;
      expressionSounds?.reset();
    }
  }
  stage.addEventListener('click', (event) => {
    if (!ready || event.target.closest('.lobby-avatar.is-self')) return;
    const rect = stage.getBoundingClientRect();
    const target = {
      x: Math.max(15, Math.min(85, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(32, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100)),
    };
    destination = target;
    marker.style.left = target.x + '%';
    marker.style.top = target.y + '%';
    marker.hidden = false;
    closeMenu();
    stage.focus();
    sync(target);
  });
  document.addEventListener('click', (event) => {
    if (!emotePopover && !menu.contains(event.target) && !selfAvatar?.contains(event.target))
      closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (!emotePopover && event.key === 'Escape') {
      closeMenu();
      selfAvatar?.focus({ preventScroll: true });
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      positionReset = true;
      sync();
    } else {
      closeMenu();
      expressionSounds?.reset();
    }
  });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) expressionSounds?.reset();
    else expressionSounds?.destroy();
  });
  sync();
  setInterval(() => sync(), 500);
})();
