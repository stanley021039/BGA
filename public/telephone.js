(function () {
  'use strict';
  const $ = (s) => document.querySelector(s),
    code = location.pathname.match(/\/telephone\/([a-f0-9]{6})\/?$/i)?.[1].toUpperCase();
  let state,
    busy = false,
    disposed = false,
    reading = false,
    lifetime,
    timer,
    key = '',
    draftKey = '',
    strokes = [],
    active = null,
    pointer = null,
    renderer = null,
    failed = null,
    countdownBar = null,
    countdownTimer,
    clockOffset = 0,
    draftTimer = null,
    draftRunning = false,
    draftDirty = false,
    lastDraft = '',
    deadlineRead = '';
  const roomActions = window.RoomControls.bindActions({
    type: 'telephone',
    read: () => ({
      setup: ['waiting', 'finished'].includes(state?.phase),
      start: {
        step: 'start',
        label: state?.phase === 'finished' ? '再來一場' : '開始傳遞',
        enabled: !busy && !!state && state.players.filter((p) => !p.kicked).length >= 3,
      },
      bot: {
        enabled: !busy && !!state && state.players.length < 8 && state.botSupport?.canAdd !== false,
      },
    }),
    run: (action) => mutate(action, {}),
  });
  const el = (tag, text) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  function say(text) {
    $('#feedback').textContent = text;
  }
  function save() {
    if (!draftKey) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ strokes, text: $('#guess')?.value || '' }));
    } catch {
      say('草稿無法存入這個分頁，重新整理前請先送出。');
    }
    scheduleDraft();
  }
  function forget() {
    if (draftKey) sessionStorage.removeItem(draftKey);
    draftKey = '';
    clearTimeout(draftTimer);
    draftTimer = null;
    draftDirty = false;
    lastDraft = '';
  }
  async function api(route, data) {
    return RoomApi.request(route, data, {
      code,
      room: 'telephone',
      session: true,
      signal: lifetime.signal,
      onKicked: () => {
        RoomReconnect.forget(code);
        location.replace('/?game=telephone');
      },
    });
  }
  function beforeDeadline() {
    return state?.phase === 'passing' && Date.now() - clockOffset < state.deadline;
  }
  function scheduleDraft() {
    if (
      disposed ||
      !beforeDeadline() ||
      state.task?.submitted ||
      !draftKey?.endsWith(':' + state.stepId)
    )
      return;
    draftDirty = true;
    if (!draftTimer && !draftRunning)
      draftTimer = setTimeout(
        () => {
          draftTimer = null;
          void flushDraft();
        },
        Math.max(0, Math.min(1000, state.deadline - (Date.now() - clockOffset) - 250)),
      );
  }
  async function flushDraft() {
    if (
      draftRunning ||
      busy ||
      disposed ||
      !draftDirty ||
      !beforeDeadline() ||
      state.task?.submitted
    )
      return;
    const scope = lifetime,
      ownKey = draftKey,
      stepId = state.stepId,
      content =
        state.task.kind === 'drawing'
          ? { strokes: JSON.parse(JSON.stringify(strokes)) }
          : { text: $('#guess')?.value || '' },
      serialized = JSON.stringify(content);
    draftDirty = false;
    if (serialized === lastDraft) return;
    draftRunning = true;
    try {
      const next = await api('telephone/draft', {
        stepId,
        requestId: crypto.randomUUID(),
        ...content,
      });
      if (scope !== lifetime || disposed || draftKey !== ownKey) return;
      lastDraft = serialized;
      render(next);
    } catch (e) {
      if (scope !== lifetime || disposed || draftKey !== ownKey || e.name === 'AbortError') return;
      if (['PAGE_CLOSED', 'STALE_STEP', 'ALREADY_SUBMITTED', 'INVALID_PHASE'].includes(e.code))
        void refresh();
      else {
        say('草稿尚未同步，請保持連線或先按送出。');
        draftDirty = true;
      }
    } finally {
      draftRunning = false;
      if (draftDirty) scheduleDraft();
    }
  }
  function command(action, extra = {}) {
    return mutate('action', {
      action,
      stepId: state.stepId,
      requestId: crypto.randomUUID(),
      ...extra,
    });
  }
  async function mutate(route, data) {
    if (busy || disposed) return;
    const scope = lifetime;
    finishStroke();
    busy = true;
    failed = null;
    $('#retry').hidden = true;
    lock();
    say('');
    try {
      const next = await api(route, data);
      if (scope !== lifetime || disposed) return false;
      render(next);
      return true;
    } catch (e) {
      if (!disposed && e.name !== 'AbortError') {
        say(e.message + (e.status ? '' : '；結果尚未確認，可重試同一操作。'));
        if (!e.status) {
          failed = { route, data };
          $('#retry').hidden = false;
        }
      }
      return false;
    } finally {
      busy = false;
      if (!disposed) {
        lock();
        await refresh();
        if (draftDirty) scheduleDraft();
      }
    }
  }
  function btn(text, fn) {
    const b = el('button', text);
    b.type = 'button';
    b.onclick = fn;
    return b;
  }
  function lock() {
    roomActions.refresh();
    for (const n of $('#controls').querySelectorAll('button,input,select,textarea'))
      n.disabled = busy || (state?.phase === 'passing' && !beforeDeadline());
    $('#leave').disabled = busy;
    $('#retry').disabled = busy;
    const submit = $('#submit');
    if (submit)
      submit.disabled =
        busy ||
        !beforeDeadline() ||
        !!state.task?.submitted ||
        (state.task?.kind === 'drawing' ? !strokes.length : !$('#guess')?.value.trim());
    $('#drawing')?.setAttribute(
      'aria-disabled',
      String(busy || !beforeDeadline() || !!state.task?.submitted),
    );
  }
  function paint(canvas, items) {
    const r = StrokeCanvas.createRenderer(canvas, {
      atomicPresentation: true,
      maxPoints: 3000,
      maxStrokes: 100,
    });
    r.render(items);
    return r;
  }
  function finishStroke() {
    if (!active) return;
    active = null;
    pointer = null;
    renderer?.render(strokes);
    save();
    lock();
  }

  function makeCountdown(captionText) {
    const countdown = el('div');
    countdown.id = 'telephoneCountdown';
    countdown.className = 'draw-countdown';
    const caption = el('span', captionText);
    caption.className = 'draw-timer-caption';
    const time = el('b');
    time.id = 'telephoneTimer';
    time.className = 'draw-timer';
    time.setAttribute('role', 'timer');
    const track = el('div');
    track.id = 'telephoneTimerTrack';
    track.className = 'draw-timer-track ui-timebar ui-timebar-smooth';
    const progress = el('progress');
    progress.id = 'telephoneTimerProgress';
    progress.max = 1;
    progress.value = 1;
    progress.className = 'ui-sr-only';
    progress.setAttribute('aria-label', '本頁剩餘時間');
    const fill = el('span');
    fill.className = 'ui-timebar-fill';
    fill.setAttribute('aria-hidden', 'true');
    track.append(progress, fill);
    countdown.append(caption, time, track);
    countdownBar = window.CountdownBar?.create(fill, {
      reducedMotion: () => window.matchMedia('(prefers-reduced-motion:reduce)').matches,
    });
    return countdown;
  }
  function board(box, title, editable) {
    const countdown = makeCountdown(editable ? '作畫剩餘' : '猜詞剩餘');
    const canvas = el('canvas');
    canvas.id = editable ? 'drawing' : 'telephonePrevious';
    canvas.width = 512;
    canvas.height = 256;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      'aria-label',
      editable ? '本頁私人畫布；滑鼠、觸控或方向鍵加空白鍵作畫' : '上一位玩家的畫作',
    );
    const area = window.GameUI.createDrawingBoard({ title, canvas, countdown });
    area.classList.add('telephone-board');
    box.append(area);
    tick();
    return { area, canvas };
  }
  function tick() {
    const label = $('#telephoneTimer'),
      progress = $('#telephoneTimerProgress');
    if (!label || !progress) return;
    const timed = state?.phase === 'passing' && Number.isFinite(state.deadline);
    $('#telephoneCountdown').hidden = !timed;
    if (!timed) {
      countdownBar?.reset();
      return;
    }
    const remaining = Math.max(0, state.deadline - (Date.now() - clockOffset)),
      seconds = Math.ceil(remaining / 1000),
      urgent = seconds <= 10;
    label.textContent = seconds + ' 秒';
    label.className = 'draw-timer' + (urgent ? ' urgent' : '');
    $('#telephoneTimerTrack').className =
      'draw-timer-track ui-timebar ui-timebar-smooth' + (urgent ? ' urgent' : '');
    progress.value = Math.min(1, remaining / (state.options.seconds * 1000));
    progress.setAttribute('aria-valuetext', '剩餘 ' + seconds + ' 秒');
    countdownBar?.sync({
      key: state.stepId,
      deadline: state.deadline,
      duration: state.options.seconds * 1000,
      offset: clockOffset,
      visible: !document.hidden,
    });
    if (!remaining) {
      finishStroke();
      lock();
      if (deadlineRead !== state.stepId) {
        deadlineRead = state.stepId;
        void refresh();
      }
    }
  }
  function drawControls(box, saved) {
    const { area, canvas } = board(box, state.task.previous.text, true),
      tools = el('div');
    tools.className = 'tools';
    const row = el('div');
    row.className = 'tool-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', '繪畫工具');
    let mode = 'brush',
      filled = false,
      cursor = [256, 128];
    const buttons = [];
    const iconButton = (key, label, fn) => {
      const b = btn(label, fn);
      b.className = 'ui-icon-button';
      b.innerHTML = StrokeCanvas.iconMarkup(key);
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
      b.setAttribute('data-ui-hint', '');
      return b;
    };
    for (const [value, fill, label] of [
      ['brush', false, '畫筆'],
      ['erase', false, '橡皮擦'],
      ['line', false, '直線'],
      ['rect', false, '空心矩形'],
      ['ellipse', false, '空心橢圓'],
      ['rect', true, '實心矩形'],
      ['ellipse', true, '實心橢圓'],
      ['fill', false, '油漆桶：填滿連續區域'],
    ]) {
      const b = iconButton(value + (fill ? 'Filled' : ''), label, () => {
        finishStroke();
        mode = value;
        filled = fill;
        for (const item of buttons) item.setAttribute('aria-pressed', String(item === b));
      });
      b.setAttribute('data-tool', value);
      b.setAttribute('aria-pressed', String(value === 'brush'));
      buttons.push(b);
      row.append(b);
    }
    row.append(
      iconButton('undo', '復原上一筆', () => {
        finishStroke();
        strokes.pop();
        renderer.render(strokes);
        save();
        lock();
      }),
      iconButton('clear', '清空畫布', () => {
        if (!strokes.length || !confirm('清除這頁草稿？')) return;
        finishStroke();
        strokes = [];
        renderer.render(strokes);
        save();
        lock();
      }),
    );
    const colorRow = el('div');
    colorRow.className = 'color-row';
    const colorPick = el('label');
    colorPick.className = 'color-pick';
    const color = el('input');
    color.type = 'color';
    color.id = 'color';
    color.value = '#273942';
    color.setAttribute('aria-label', '選擇顏色');
    colorPick.append(color);
    const menu = el('details');
    menu.className = 'color-menu';
    menu.id = 'telephoneColorMenu';
    const summary = el('summary', '調色盤');
    const swatches = el('div');
    swatches.className = 'swatches';
    swatches.setAttribute('aria-label', '常用顏色');
    for (const value of [
      '#273942',
      '#ffffff',
      '#e45757',
      '#f3a844',
      '#f4d264',
      '#6bb879',
      '#5197ca',
      '#8058ad',
      '#d979a7',
      '#8b6348',
    ]) {
      const b = btn('', () => {
        color.value = value;
        menu.open = false;
        summary.focus();
      });
      b.style.background = value;
      b.setAttribute('aria-label', '選擇 ' + value);
      swatches.append(b);
    }
    menu.append(summary, swatches);
    const sizePick = el('label', '筆刷');
    sizePick.className = 'size-pick';
    const size = el('input');
    size.type = 'range';
    size.id = 'size';
    size.min = 1;
    size.max = 40;
    size.value = 6;
    size.setAttribute('aria-label', '筆刷寬度');
    const sizeValue = el('output', '6');
    size.oninput = () => (sizeValue.textContent = size.value);
    sizePick.append(size, sizeValue);
    colorRow.append(colorPick, menu, sizePick);
    tools.append(row, colorRow);
    area.append(tools);
    window.GameUI?.bindPopover?.(menu, swatches, { align: 'start' });
    strokes = Array.isArray(saved?.strokes) ? saved.strokes : [];
    try {
      renderer = paint(canvas, strokes);
    } catch {
      strokes = [];
      renderer = paint(canvas, strokes);
      say('草稿格式無法讀取，已建立空白畫布。');
    }
    const total = () => strokes.reduce((n, s) => n + s.points.length, 0),
      allowed = () => !busy && beforeDeadline() && !state.task.submitted;
    canvas.onpointerdown = (e) => {
      if (!allowed() || active || e.button !== 0) return;
      if (strokes.length >= 100 || total() >= 3000) {
        say('畫作已達本頁上限，請復原或送出。');
        return;
      }
      e.preventDefault();
      const p = StrokeCanvas.pointFrom(e, canvas, 512, 256);
      cursor = p;
      const stroke = {
        tool: mode,
        color: color.value,
        size: Number(size.value),
        points: [p],
        filled,
      };
      strokes.push(stroke);
      if (mode === 'fill') {
        renderer.render(strokes);
        save();
        lock();
        return;
      }
      active = stroke;
      pointer = e.pointerId;
      canvas.setPointerCapture(pointer);
      renderer.render(strokes);
      scheduleDraft();
      lock();
    };
    canvas.onpointermove = (e) => {
      if (!active || e.pointerId !== pointer) return;
      e.preventDefault();
      const p = StrokeCanvas.pointFrom(e, canvas, 512, 256),
        last = active.points.at(-1);
      if (p[0] === last[0] && p[1] === last[1]) return;
      if (['brush', 'erase'].includes(active.tool)) {
        if (total() >= 3000 || active.points.length >= 256) {
          finishStroke();
          return;
        }
        active.points.push(p);
      } else {
        if (active.points.length === 1 && total() >= 3000) {
          finishStroke();
          return;
        }
        active.points = [active.points[0], p];
      }
      cursor = p;
      renderer.render(strokes);
      scheduleDraft();
    };
    canvas.onpointerup =
      canvas.onpointercancel =
      canvas.onlostpointercapture =
        (e) => {
          if (e.pointerId === pointer) finishStroke();
        };
    canvas.onkeydown = (e) => {
      if (!allowed()) return;
      const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (moves[e.key]) {
        e.preventDefault();
        cursor = [
          Math.max(0, Math.min(511, cursor[0] + moves[e.key][0])),
          Math.max(0, Math.min(255, cursor[1] + moves[e.key][1])),
        ];
        say('畫布位置 ' + (cursor[0] + 1) + '，' + (cursor[1] + 1) + '；按空白鍵落筆。');
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (strokes.length >= 100 || total() >= 3000) return;
        strokes.push({
          tool: mode === 'fill' ? 'fill' : 'brush',
          color: color.value,
          size: Number(size.value),
          points: [cursor.slice()],
        });
        renderer.render(strokes);
        save();
        lock();
      }
    };
  }
  function showReview() {
    const pages = state.books.flatMap((book) =>
        book.pages.map((page, index) => ({ book, page, index })),
      ),
      review = state.review,
      box = $('#book');
    box.replaceChildren();
    $('#books').append(
      el('p', Math.max(0, (review?.index ?? -1) + 1) + '／' + (review?.total || 0) + ' 個片段'),
    );
    const current = pages[review?.index ?? -1];
    if (current) {
      const { book, page: p, index: i } = current;
      box.append(el('h3', book.ownerName + ' 的傳遞簿'));
      const card = el('article');
      card.className = 'page-card ui-content-card';
      card.append(el('h4', (i ? '第 ' + i + ' 頁' : '起始情境') + ' · ' + p.authorName));
      if (p.skipped)
        card.append(el('p', '本頁略過' + (p.timedOut ? ' · 時間到時沒有已同步的內容' : '')));
      else if (p.kind === 'text') card.append(el('p', p.text));
      else {
        const canvas = el('canvas');
        canvas.width = 512;
        canvas.height = 256;
        canvas.setAttribute('aria-label', p.authorName + ' 的畫作');
        card.append(canvas);
        paint(canvas, p.strokes);
      }
      box.append(card);
    } else box.append(el('p', '等待房主開始播放故事。'));
    if (review && review.index < review.total - 1) {
      if (state.host === state.me) {
        const next = btn(review.index < 0 ? '開始播放故事' : '播放下一頁', () =>
          command('reveal', { expectedIndex: review.index }),
        );
        next.id = 'telephoneReveal';
        window.GameUI?.decorateButton?.(next, review.index < 0 ? 'play' : 'next', {
          iconOnly: true,
          label: review.index < 0 ? '開始播放故事' : '播放下一頁',
        });
        $('#controls').append(next);
      } else box.append(el('p', '等待房主播放下一頁。'));
    } else if (review) box.append(el('p', '所有故事已播放完畢。'));
  }
  function render(next) {
    if (disposed || next.type !== 'telephone' || (state && next.version < state.version)) return;
    state = next;
    if (Number.isFinite(next.serverNow)) clockOffset = Date.now() - next.serverNow;
    if (window.RoomHost) window.RoomHost.update(next, render);
    else if (window.GameShell) window.GameShell.update(next);
    else window.RoomWaiting?.update(next);
    $('#game').hidden = false;
    $('#connection').textContent = '';
    $('#roomTag').textContent = '房號 ' + code;
    $('#leave').hidden = false;
    $('#phase').textContent =
      state.phase === 'passing'
        ? '第 ' +
          state.round +
          '／' +
          state.roundLimit +
          ' 頁 · ' +
          (state.task.kind === 'drawing' ? '畫圖' : '猜詞')
        : state.phase === 'finished'
          ? state.interrupted
            ? '傳遞中止，回看已送出的頁面'
            : '全部揭曉！'
          : '等待入座';
    $('#players').innerHTML = state.players
      .map((p) =>
        window.GameShell.playerRow(p, {
          me: state.me,
          status: p.offline ? '暫時離線' : p.ready ? '已送出' : '傳遞中',
          metrics: [],
        }),
      )
      .join('');
    $('#readiness').textContent =
      state.phase === 'passing'
        ? (state.players
            .filter((p) => !p.ready)
            .map((p) => p.name)
            .join('、') || '全員已送出') + '；時間到自動傳下一頁。'
        : '固定入座順序傳遞，不計個人分數。';
    const nextKey = JSON.stringify([
      state.phase,
      state.stepId,
      state.host,
      state.task?.submitted,
      state.options,
      state.players.length < 8,
      state.review?.index,
    ]);
    if (nextKey !== key) {
      key = nextKey;
      finishStroke();
      const previousDraft = draftKey;
      const nextDraft =
        state.phase === 'passing' && !state.task.submitted
          ? 'telephone:' + code + ':' + state.me + ':' + state.stepId
          : '';
      if (previousDraft && previousDraft !== nextDraft) forget();
      draftKey = nextDraft;
      strokes = [];
      renderer = null;
      countdownBar?.reset();
      countdownBar = null;
      $('#controls').replaceChildren();
      $('#previous').replaceChildren();
      $('#books').replaceChildren();
      $('#book').replaceChildren();
      const box = $('#controls');
      if (['waiting', 'finished'].includes(state.phase)) {
        if (state.host === state.me) {
          const label = el('label', '獨立情境題庫');
          label.htmlFor = 'sources';
          const sources = el('select');
          sources.id = 'sources';
          for (const [value, text] of [
            ['both', '生活＋奇想'],
            ['everyday', '生活情境'],
            ['silly', '奇想情境'],
          ]) {
            const o = el('option', text);
            o.value = value;
            sources.append(o);
          }
          sources.onchange = () =>
            mutate('settings', {
              sources: sources.value === 'both' ? ['everyday', 'silly'] : [sources.value],
            });
          sources.value = state.options.sources.length === 2 ? 'both' : state.options.sources[0];
          const group = el('div');
          group.className = 'ui-control-group';
          const field = el('div');
          field.className = 'ui-field';
          const row = el('div');
          row.className = 'ui-control-row ui-field-actions';
          row.append(sources);
          field.append(label, row);
          group.append(field);
          box.append(group);
        } else box.append(el('p', '等待房主開始。至少三人，可加入腳本夥伴試玩。'));
        if (state.phase === 'finished') showReview();
      } else {
        const p = state.task.previous;
        if (state.task.submitted && p.kind === 'text') $('#previous').append(el('h3', p.text));
        if (state.task.submitted) {
          const waiting = el('div');
          waiting.className = 'ui-drawing-board telephone-submitted';
          const head = el('div');
          head.className = 'board-head';
          head.append(el('h3', '本頁已送出'));
          waiting.append(head, makeCountdown('傳頁剩餘'));
          box.append(waiting, el('p', '這頁已送出，時間到自動傳下一頁；其他頁面仍保密。'));
        } else {
          let saved;
          try {
            saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
          } catch {
            say('草稿無法讀取。');
          }
          saved ||= state.task.draft;
          if (state.task.kind === 'drawing') drawControls(box, saved);
          else {
            const { canvas } = board(box, '只看這張圖，猜一句話', false);
            paint(canvas, p.strokes);
            if (p.skipped) box.append(el('p', '上一頁略過，可自由猜或略過。'));
            const label = el('label', '你覺得圖上是什麼？');
            label.htmlFor = 'guess';
            const input = el('input');
            input.id = 'guess';
            input.maxLength = 80;
            input.value = saved?.text || '';
            input.oninput = () => {
              save();
              lock();
            };
            box.append(label, input);
          }
          const warning = el('p', '送出後不能修改；時間到自動傳下一頁，並保留已同步的內容。');
          warning.id = 'submitWarning';
          const submit = btn('確認送出這一頁', () => {
            finishStroke();
            return command(
              'submit',
              state.task.kind === 'drawing' ? { strokes } : { text: $('#guess').value },
            );
          });
          submit.id = 'submit';
          submit.setAttribute('aria-describedby', 'submitWarning');
          warning.className = 'telephone-status';
          const actions = el('div');
          actions.className = 'telephone-actions';
          actions.append(
            submit,
            btn('略過這頁', () => {
              if (confirm('這頁會標記為略過，確定嗎？')) return command('skip');
            }),
          );
          box.append(warning, actions);
        }
      }
    }
    if (state.phase === 'passing') window.GameUI.frameDrawingTask($('#controls'));
    lock();
    tick();
  }
  async function refresh() {
    if (disposed || reading) return;
    const scope = lifetime;
    reading = true;
    try {
      const next = await api('state');
      if (scope === lifetime && !disposed) render(next);
    } catch (e) {
      if (scope === lifetime && !disposed && e.name !== 'AbortError')
        $('#connection').textContent =
          '連線中斷：' + e.message + '；時間到會保留已同步內容並傳頁。';
    } finally {
      reading = false;
    }
  }
  async function start() {
    disposed = false;
    const scope = (lifetime = new AbortController());
    try {
      await RoomReconnect.restore(code, 'telephone', '#connection', { signal: scope.signal });
      if (disposed || scope !== lifetime) return;
      await refresh();
      if (!disposed && scope === lifetime) {
        timer = setInterval(() => {
          if (!document.hidden) refresh();
        }, 2000);
        countdownTimer = setInterval(tick, 250);
      }
    } catch (e) {
      if (scope === lifetime && e.name !== 'AbortError') say(e.message);
    }
  }
  $('#retry').onclick = () => {
    if (failed) mutate(failed.route, failed.data);
  };
  $('#leave').onclick = async () => {
    if (
      busy ||
      !confirm(
        state.phase === 'passing'
          ? '離席會中止全桌傳遞並揭曉已送出的頁面，確定離開？'
          : '離開房間？',
      )
    )
      return;
    if (await mutate('leave', {})) {
      forget();
      RoomReconnect.forget(code);
      location.replace('/?game=telephone');
    }
  };
  if (!code) {
    $('#guide').open = true;
    $('#connection').textContent = '從大廳選擇傳情畫意，開房後就能玩。';
    return;
  }
  window.addEventListener('pagehide', () => {
    finishStroke();
    save();
    disposed = true;
    clearTimeout(draftTimer);
    draftTimer = null;
    clearInterval(timer);
    clearInterval(countdownTimer);
    countdownBar?.reset();
    lifetime?.abort();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      clearInterval(timer);
      clearInterval(countdownTimer);
      start();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) countdownBar?.reset();
    else {
      tick();
      refresh();
    }
  });
  start();
})();
