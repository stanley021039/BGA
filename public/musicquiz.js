(() => {
  'use strict';
  window.MusicQuizClient = true;
  const $ = (s) => document.querySelector(s),
    code = location.pathname.match(/\/musicquiz\/([a-f0-9]{6})/i)?.[1]?.toUpperCase();
  window.SharedChat?.mountIn($('#mqChat'), { inline: true });
  let youtubeUnbind = null;
  let countdownTimer;
  let dirtySettings = false;
  let state,
    scope,
    timer,
    busy = false,
    reading = false,
    disposed = false,
    renderKey = '',
    playKey = '',
    retry = null,
    frame = null,
    player = null,
    unlocked = false,
    previewUnbind = null,
    positionTimer = null,
    playAttempt = 0,
    audio = null,
    audioUnbind = null;
  const el = (tag, value, cls) => {
    const n = document.createElement(tag);
    if (value !== undefined) n.textContent = value;
    if (cls) n.className = cls;
    return n;
  };
  const button = (label, fn, icon) => {
    const n = el('button', label);
    n.type = 'button';
    n.onclick = fn;
    if (icon) window.GameUI?.decorateButton(n, icon, { label });
    return n;
  };
  const brand = window.RoomChrome?.header({ subtitle: '猜歌挑戰', icon: 'music' });
  if (brand && $('#roomTag')) brand.after($('#roomTag'));
  const actions = RoomControls.bindActions({
    type: 'musicquiz',
    read: () => ({
      host: $('#mqSessionActions'),
      setup: ['waiting', 'finished'].includes(state?.phase),
      start: {
        step: 'start',
        label: state?.phase === 'finished' ? '再來一場' : '開始猜歌',
        enabled:
          !dirtySettings && !busy && !!state && state.availableCount >= state.players.length + 2,
      },
      bot: { enabled: !busy && !!state && state.players.length < 8 },
    }),
    run: (route) => mutate(route, {}),
  });
  const say = (message) => {
    $('#feedback').textContent = message;
  };
  $('#mqInvite').onclick = () => {
    if (window.RoomInvites?.ready) window.RoomInvites.open($('#mqInvite'));
    else say('邀請功能載入中，請稍後再試。');
  };
  $('#mqCopyRoom').onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      say('已複製房間連結，可傳給朋友登入入座。');
    } catch {
      say('房號 ' + code + '；朋友可從大廳輸入房號加入。');
    }
  };
  window.GameUI?.decorateButton($('#mqInvite'), 'invite', { label: '邀請玩家' });
  window.GameUI?.decorateButton($('#mqCopyRoom'), 'share', {
    iconOnly: true,
    label: '複製房間連結',
  });
  async function request(route, payload) {
    return RoomApi.request(route, payload, {
      code,
      room: 'musicquiz',
      session: true,
      signal: scope.signal,
      onKicked: () => {
        RoomReconnect.forget(code);
        location.replace('/?game=musicquiz');
      },
    });
  }
  function lock() {
    actions.refresh();
    for (const n of document.querySelectorAll(
      '#controls button,#controls input,#controls select,#controls textarea',
    )) {
      if (n.closest('[data-room-common]')) continue;
      n.disabled = busy || n.dataset.blocked === 'true';
    }
    $('#leave').disabled = busy;
    $('#retry').disabled = busy;
  }
  async function mutate(route, payload) {
    if (busy || disposed) return false;
    busy = true;
    retry = null;
    say('');
    $('#retry').hidden = true;
    lock();
    const lifetime = scope;
    try {
      const next = await request(route, payload);
      if (scope !== lifetime || disposed) return false;
      render(next);
      return true;
    } catch (e) {
      if (!disposed && e.name !== 'AbortError') {
        say(e.message);
        if (!e.status) {
          retry = { route, payload };
          $('#retry').hidden = false;
        }
      }
      return false;
    } finally {
      busy = false;
      if (!disposed) {
        lock();
        refresh();
      }
    }
  }
  const command = (action, extra = {}) =>
    mutate('action', { action, roundId: state.roundId, requestId: crypto.randomUUID(), ...extra });
  function field(label, id, type = 'text') {
    const l = el('label', label),
      input = el('input');
    input.id = id;
    input.type = type;
    input.maxLength = 80;
    l.htmlFor = id;
    return { l, input };
  }
  function cover(song) {
    const n = el('article', undefined, 'mq-cover'),
      disc = el('div', undefined, 'mq-vinyl');
    disc.setAttribute('aria-hidden', 'true');
    disc.append(el('span', '♪'));
    n.append(
      disc,
      el('small', song ? 'TUNE TIMELINE · ORIGINAL SLEEVE' : 'MYSTERY VINYL'),
      el('h2', song ? song.title : '下一首，你聽過嗎？'),
      el('p', song ? song.artist : '前奏猜歌・年代對決'),
    );
    if (song) n.append(el('strong', String(song.year), 'mq-year'));
    return n;
  }
  function settings(box) {
    const owner = state.host === state.me;
    box.append(
      el('h2', '挑選本局題庫'),
      el('p', '以熟悉的熱門歌為主；可混搭語言、曲風或加入自己的歌單。'),
    );
    const banks = el('div', undefined, 'mq-banks');
    for (const b of state.banks) {
      const label = el('label', undefined, 'mq-bank'),
        input = el('input');
      input.type = 'checkbox';
      input.name = 'bank';
      input.value = b.id;
      input.checked = state.settings.banks.includes(b.id);
      input.dataset.blocked = String(!owner);
      label.append(input, el('strong', b.label), el('span', b.count + ' 首'));
      banks.append(label);
    }
    box.append(banks);
    const genres = el('details'),
      sum = el('summary', '曲風篩選（未勾選代表全部）'),
      choices = el('div', undefined, 'mq-genres');
    genres.append(sum, choices);
    for (const g of [...state.genres, '自選']) {
      const label = el('label'),
        input = el('input');
      input.type = 'checkbox';
      input.name = 'genre';
      input.value = g;
      input.checked = state.settings.genres.includes(g);
      input.dataset.blocked = String(!owner);
      label.append(input, document.createTextNode(g));
      choices.append(label);
    }
    box.append(genres);
    const target = field('獲勝目標：年代卡張數', 'mqTarget', 'number');
    target.input.min = 3;
    target.input.max = 10;
    target.input.value = state.settings.target;
    target.input.dataset.blocked = String(!owner);
    const obscure = el('label'),
      check = el('input');
    check.type = 'checkbox';
    check.id = 'mqObscure';
    check.checked = state.settings.obscure;
    check.dataset.blocked = String(!owner);
    obscure.append(check, document.createTextNode('混入冷門挑戰（最多約10%，預設關閉）'));
    box.append(target.l, target.input, obscure);
    const custom = el('details'),
      heading = el('summary', '加入自己的題庫'),
      format = el(
        'p',
        '每行：歌名 | 藝人 | 首發年 | YouTube網址或ID | 前奏起點秒 | 精華起點秒。最多200首；只用真人創作歌曲。',
      ),
      input = el('textarea');
    input.id = 'mqCustom';
    input.rows = 5;
    input.setAttribute('aria-label', '自選歌曲題庫');
    input.placeholder = '晴天 | 周杰倫 | 2003 | DYptgVvkVLQ | 0 | 60';
    input.value = state.customSongs
      .map((s) =>
        [s.title, s.artist, s.year, s.videoId, s.introStart, s.highlightStart].join(' | '),
      )
      .join('\n');
    input.dataset.blocked = String(!owner);
    custom.append(heading, format, input);
    box.append(custom);
    if (owner)
      box.append(
        button(
          '儲存本局題庫',
          async () => {
            try {
              const songs = input.value.trim()
                ? input.value
                    .trim()
                    .split(/\r?\n/)
                    .filter((x) => x.trim())
                    .map((line) => {
                      const a = line.split('|').map((x) => x.trim());
                      let id = a[3] || '';
                      if (/^https:\/\//.test(id)) {
                        const u = new URL(id);
                        if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
                        else if (['youtube.com', 'www.youtube.com'].includes(u.hostname))
                          id = u.searchParams.get('v') || u.pathname.split('/').pop();
                      }
                      return {
                        title: a[0],
                        artist: a[1],
                        year: Number(a[2]),
                        videoId: id,
                        introStart: Number(a[4] || 0),
                        highlightStart: Number(a[5] || 60),
                        aiGenerated: false,
                      };
                    })
                : [];
              const saved = await command('configure', {
                banks: [...box.querySelectorAll('[name=bank]:checked')].map((n) => n.value),
                genres: [...box.querySelectorAll('[name=genre]:checked')].map((n) => n.value),
                target: Number(target.input.value),
                obscure: check.checked,
                customSongs: songs,
              });
              if (saved) {
                dirtySettings = false;
                say('題庫已儲存');
                lock();
              }
            } catch (e) {
              say(e.message);
            }
          },
          'save',
        ),
      );
    box.append(
      el(
        'p',
        '目前可抽 ' +
          state.availableCount +
          ' 首 · 聽8秒前奏，30秒內10選1作答；精華30秒，60秒放牌；插歌15秒。',
      ),
    );
  }
  function musicCard(song, owner) {
    const c = el('article', undefined, 'mq-timeline-card barrage-frame-preview');
    window.SongTitleZh?.decorate(c, song.title, song.language);
    if (window.BarrageFrames) {
      BarrageFrames.decorate(c, owner.musicCardFrame, '', '');
      const content = c.querySelector('.barrage-frame-content');
      content.replaceChildren(
        el('strong', String(song.year)),
        el('span', song.title),
        el('small', song.artist),
      );
    } else
      c.append(el('strong', String(song.year)), el('span', song.title), el('small', song.artist));
    return c;
  }
  function collection() {
    const host = $('#mqCollection');
    if (!host) return;
    host.replaceChildren(el('h2', '大家的音樂卡'));
    const own = state.players.find((p) => p.id === state.me);
    if (window.BarrageFrames && own) {
      const label = el('label', '我的音樂卡外觀'),
        select = el('select');
      select.setAttribute('aria-label', '我的音樂卡外觀');
      for (const o of BarrageFrames.options) {
        const option = el('option', o.label + (BarrageFrames.canUse(o.id) ? '' : '（未解鎖）'));
        option.value = o.id;
        option.disabled = !BarrageFrames.canUse(o.id);
        select.append(option);
      }
      select.value = own.musicCardFrame?.id || 'default';
      select.onchange = () => command('card-frame', { frameId: select.value });
      label.append(select);
      host.append(label);
    }
    for (const p of state.players) {
      const details = el('details'),
        list = el('div', undefined, 'mq-timeline');
      details.open = p.id === state.me;
      details.append(el('summary', p.name + ' · ' + p.timeline.length + ' 張'));
      for (const song of p.timeline) list.append(musicCard(song, p));
      details.append(list);
      host.append(details);
    }
  }
  function timeline(box, interactive) {
    const dj = state.players.find((p) => p.id === state.djId);
    if (!dj) return;
    box.append(el('h3', dj.name + ' 的年代時間軸'));
    const list = el('div', undefined, 'mq-timeline');
    list.setAttribute('aria-label', '依年份排序的歌曲');
    for (let i = 0; i <= dj.timeline.length; i++) {
      if (interactive) {
        const slot = i,
          isChallenge = state.phase === 'challenge',
          taken = slot === state.placement || Object.values(state.challenges).includes(slot);
        const b = button(
          (isChallenge ? '插歌' : '放在這裡') +
            ' ' +
            (i === 0 ? '最前' : i === dj.timeline.length ? '最後' : '中間'),
          () => command(isChallenge ? 'challenge' : 'place', { slot }),
          'add',
        );
        b.className = 'mq-slot';
        b.dataset.blocked = String(
          isChallenge &&
            (taken ||
              state.mine.tokens < 1 ||
              Object.hasOwn(state.challenges, state.me) ||
              state.passed.includes(state.me)),
        );
        list.append(b);
      } else if (state.placement === i) list.append(el('span', 'DJ 放置點', 'mq-placement'));
      if (i < dj.timeline.length) {
        list.append(musicCard(dj.timeline[i], dj));
      }
    }
    box.append(list);
  }
  function drawControls() {
    const box = $('#controls');
    box.replaceChildren();
    const me = state.me === state.djId;
    if (['waiting', 'finished'].includes(state.phase)) {
      if (state.phase === 'finished') {
        box.append(
          el('h2', state.interrupted ? '本場中止' : '本場結果'),
          el(
            'p',
            state.winner
              ? '年代冠軍：' + state.winner.names.join('、') + ' · ' + state.winner.score + ' 張'
              : '',
          ),
        );
        const best = Math.max(...state.players.map((p) => p.bonus));
        box.append(
          el(
            'p',
            '前奏達人：' +
              state.players
                .filter((p) => p.bonus === best)
                .map((p) => p.name)
                .join('、') +
              ' · ' +
              best +
              ' 分',
          ),
        );
      }
      settings(box);
    } else if (state.phase === 'pick') {
      box.append(
        el('h2', me ? '準備好，開始這首？' : '等待本輪 DJ 開始'),
        el('p', '聽歌前可花3枚歌王標記，直接買一張年代卡。'),
      );
      if (me) box.append(button('全員開始聽前奏', () => command('listen'), 'play'));
      if (state.mine.tokens >= 3) box.append(button('買歌 · 3枚', () => command('buy'), 'add'));
    } else if (state.phase === 'intro') {
      box.append(
        el('h2', '第1階段 · 前奏10選1'),
        el('p', '從10個歌名選出正確答案：答對 +1 前奏分及1枚歌王標記（最多5）；不影響年代勝負。'),
      );
      if (!state.submitted) {
        const choices = el('div', undefined, 'mq-answer-choices');
        choices.setAttribute('role', 'group');
        choices.setAttribute('aria-label', '本輪10個歌名選項');
        for (const choice of state.introChoices) {
          const b = button(choice.title, () => command('guess', { choiceId: choice.id }));
          window.SongTitleZh?.decorate(b, choice.title, choice.language);
          b.classList.add('mq-answer-choice');
          choices.append(b);
        }
        box.append(
          choices,
          button('略過前奏', () => command('guess', { pass: true }), 'next'),
        );
      } else
        box.append(
          el('p', '已選：' + (state.myAnswer?.text || '略過') + '。答案已鎖定，等待大家作答。'),
        );
    } else if (state.phase === 'timeline') {
      box.append(
        el('h2', '第2階段 · 精華與年代排序'),
        el('p', me ? '把這首歌放在你的年代時間軸。' : '由 DJ 排列年代，稍後可花標記插歌。'),
      );
      timeline(box, me);
    } else if (state.phase === 'challenge') {
      box.append(
        el('h2', '歌王插歌 · 15秒'),
        el(
          'p',
          me
            ? '其他玩家正在選擇是否插歌。'
            : '花1枚標記選另一位置；DJ 排錯且你排對，即可搶走卡片。',
        ),
      );
      timeline(box, !me);
      if (!me && !Object.hasOwn(state.challenges, state.me) && !state.passed.includes(state.me))
        box.append(button('這次不插歌', () => command('pass'), 'check'));
    } else if (state.phase === 'reveal') {
      const r = state.results.at(-1);
      box.append(el('h2', r.receiverName ? r.receiverName + '取得年代卡' : '本輪沒有玩家取得卡片'));
      for (const a of r.answers)
        box.append(
          el(
            'p',
            a.name +
              '：前奏 +' +
              a.bonus +
              ' 分' +
              (a.tokenEarned ? ' · 歌王標記 +1（最多5）' : ''),
          ),
        );
      if (state.host === state.me || me)
        box.append(button('下一首', () => command('next'), 'next'));
    }
    if (me && ['pick', 'intro', 'timeline'].includes(state.phase)) {
      const skip = button('切歌 · 1枚', () => command('skip'), 'next');
      skip.dataset.blocked = String(state.mine.tokens < 1);
      box.append(skip);
    }
  }
  function clearPlayback() {
    youtubeUnbind?.();
    youtubeUnbind = null;
    playAttempt++;
    clearInterval(positionTimer);
    positionTimer = null;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.remove();
      audio = null;
    }
    audioUnbind?.();
    audioUnbind = null;
    const old = player;
    player = null;
    try {
      old?.destroy?.();
    } catch {}
    frame?.remove();
    frame = null;
    // A failed or delayed API callback must never leave a second frame behind.
    for (const n of $('#mqPlayback').querySelectorAll('iframe,[data-mq-mount]')) n.remove();
  }
  function playbackFailure(code) {
    if (code === 101 || code === 150)
      return '這部影片不允許在網站內播放。重試通常無法解除限制，請由 DJ 切歌，並回報這首歌的來源。';
    if (code === 153)
      return 'YouTube 未收到播放器的網站來源識別。請重新整理後重試，或用一般瀏覽器開啟本站。';
    if (code === 100) return '這部影片已移除、設為私人或無法取得，請由 DJ 切歌。';
    return (
      'YouTube 播放失敗' +
      (Number.isInteger(code) ? '（錯誤 ' + code + '）' : '') +
      '，請重試；若仍無法播放，請由 DJ 切歌。'
    );
  }
  function updatePlayback() {
    const media = state.playback,
      key = media
        ? state.roundId + ':' + media.stage + ':' + media.provider + ':' + (media.url || '')
        : '';
    if (key === playKey) return;
    playKey = key;
    clearPlayback();
    $('#mqPlayback').replaceChildren();
    if (!media) return;
    if (media.provider === 'audio') {
      const status = el('p', '', 'mq-playback-status');
      status.setAttribute('role', 'status');
      const play = button(
        unlocked ? '播放本輪片段' : '啟用本桌猜歌音樂',
        async () => {
          if (play.disabled) return;
          clearPlayback();
          const attempt = playAttempt;
          unlocked = true;
          AudioSettings?.set?.('music', { enabled: true }, { gesture: true });
          play.disabled = true;
          status.textContent = '正在載入音檔…';
          const current = () => key === playKey && attempt === playAttempt && !disposed;
          const clip = el('audio');
          audio = clip;
          clip.controls = true;
          clip.preload = 'none';
          clip.setAttribute('aria-label', '本輪猜歌音樂');
          const fail = (message) => {
            if (!current()) return;
            clearPlayback();
            status.textContent = message;
            play.textContent = '重試播放本輪片段';
            play.disabled = false;
          };
          clip.onerror = () => fail('音檔讀取失敗，請重試；若已換題，請重新整理。');
          clip.onplaying = () => {
            if (current()) {
              status.textContent = '';
              play.disabled = false;
            }
          };
          clip.onended = () => {
            if (current()) play.disabled = false;
          };
          const url = new URL(media.url, location.origin);
          if (url.origin !== location.origin || url.pathname !== '/api/game-song-audio') {
            fail('音檔來源不正確');
            return;
          }
          clip.src = url.href;
          $('#mqPlayback').append(clip);
          audioUnbind = AudioSettings?.bindPreview?.(clip);
          try {
            await clip.play();
          } catch (e) {
            if (current()) {
              status.textContent =
                e.name === 'NotAllowedError'
                  ? '瀏覽器需要你按下音檔播放器的播放鍵。'
                  : '音檔暫時無法播放，請重試。';
              play.disabled = false;
            }
          }
        },
        'play',
      );
      $('#mqPlayback').append(
        play,
        status,
        el(
          'p',
          media.clipReviewed ? '本輪使用音檔片段。' : '本輪使用音檔片段；精華切點尚待逐首校正。',
          'mq-playback-note',
        ),
      );
      if (unlocked && AudioSettings?.get?.().music.enabled !== false) play.click();
      return;
    }
    const status = el('p', '', 'mq-playback-status');
    status.setAttribute('role', 'status');
    const play = button(
      unlocked ? '播放本輪片段' : '啟用本桌猜歌音樂',
      async () => {
        if (play.disabled) return;
        clearPlayback();
        const attempt = playAttempt;
        unlocked = true;
        AudioSettings?.set?.('music', { enabled: true }, { gesture: true });
        play.disabled = true;
        status.textContent = '正在載入 YouTube…';
        const current = () => key === playKey && attempt === playAttempt && !disposed;
        const fail = (message) => {
          if (!current()) return;
          clearPlayback();
          status.textContent = message;
          play.textContent = '重試播放本輪片段';
          play.disabled = false;
        };
        try {
          if (!window.YT?.Player)
            await new Promise((resolve, reject) => {
              const previous = window.onYouTubeIframeAPIReady;
              window.onYouTubeIframeAPIReady = () => {
                previous?.();
                resolve();
              };
              if (!document.querySelector('script[data-mq-youtube]')) {
                const s = el('script');
                s.src = 'https://www.youtube.com/iframe_api';
                s.referrerPolicy = 'strict-origin-when-cross-origin';
                s.dataset.mqYoutube = '';
                s.onerror = () => {
                  s.remove();
                  reject(Error('無法載入 YouTube 播放器，請檢查連線後重試'));
                };
                document.head.append(s);
              }
              setTimeout(() => {
                if (!window.YT?.Player) {
                  document.querySelector('script[data-mq-youtube]')?.remove();
                  reject(Error('播放器載入逾時，請重試'));
                }
              }, 12000);
            });
          if (!current()) return;
          const url = new URL('https://www.youtube-nocookie.com/embed/' + media.videoId);
          for (const [name, value] of Object.entries({
            enablejsapi: 1,
            origin: location.origin,
            playsinline: 1,
            start: media.start,
            end: media.start + media.seconds,
            autoplay: AudioSettings?.isMusicSuspended?.() ? 0 : 1,
            rel: 0,
          }))
            url.searchParams.set(name, String(value));
          frame = el('iframe');
          frame.id = 'mqYoutube';
          frame.dataset.mqMount = '';
          frame.title = '本輪猜歌音樂';
          frame.width = '480';
          frame.height = '270';
          // Override the site's same-origin policy for this YouTube frame only.
          frame.referrerPolicy = 'strict-origin-when-cross-origin';
          frame.allow = 'autoplay; encrypted-media; picture-in-picture';
          frame.src = url.href;
          $('#mqPlayback').append(frame);
          player = new YT.Player(frame, {
            events: {
              onReady: (event) => {
                if (!current()) {
                  event.target.destroy();
                  return;
                }
                youtubeUnbind = AudioSettings?.registerMusic?.({
                  isPlaying: () => event.target.getPlayerState?.() === 1,
                  pause: () => event.target.pauseVideo(),
                  resume: () => {
                    if (current()) event.target.playVideo();
                  },
                });
                status.textContent = '';
                event.target.setVolume(
                  Math.round((AudioSettings?.get?.().music.volume ?? 0.5) * 100),
                );
                if (AudioSettings?.isMusicSuspended?.()) youtubeUnbind?.requestResume?.();
                else event.target.playVideo();
              },
              onStateChange: (event) => {
                if (current() && event.data === 1 && AudioSettings?.isMusicSuspended?.()) {
                  youtubeUnbind?.requestResume?.();
                  event.target.pauseVideo();
                }
              },
              onAutoplayBlocked: () => {
                if (current()) {
                  status.textContent = '瀏覽器需要你按下播放，請重試或按播放器的播放鍵。';
                  play.disabled = false;
                }
              },
              onError: (event) =>
                fail(playbackFailure(event.data) + '（YouTube 錯誤 ' + event.data + '）'),
            },
          });
          positionTimer = setInterval(() => {
            if (!current()) return;
            try {
              if (player?.getCurrentTime?.() >= media.start + media.seconds) player.pauseVideo();
            } catch {}
          }, 200);
        } catch (e) {
          fail(e.message);
        }
      },
      'play',
    );
    $('#mqPlayback').append(
      play,
      status,
      el(
        'p',
        'YouTube 內嵌播放可能顯示影片名稱；請只聽聲音、不看第三方資訊。片段位置可由自選題庫調整。',
        'mq-playback-note',
      ),
    );
    if (unlocked) play.click();
  }
  const resultSounds = window.GameResultSounds?.create();
  function render(next) {
    if (disposed || next.type !== 'musicquiz' || (state && next.version < state.version)) return;
    resultSounds?.update(next);
    state = next;
    RoomHost.update(next, render);
    $('#game').hidden = false;
    $('#leave').hidden = false;
    $('#roomTag').textContent = '房號 ' + code;
    $('#connection').textContent = '';
    $('#phase').textContent =
      {
        waiting: '等待開桌',
        pick: '前奏準備',
        intro: '前奏加分',
        timeline: '年代排序',
        challenge: '歌王插歌',
        reveal: '本輪揭曉',
        finished: '本場結果',
      }[state.phase] + (state.phase === 'waiting' ? '' : ' · 第' + state.round + '首');
    $('#mqRoomActions').hidden = !['waiting', 'finished'].includes(state.phase);
    $('#mqRoomHint').textContent =
      state.players.length +
      '/8 人 · ' +
      (state.me === state.host ? '房主可開始遊戲' : '等待房主開始');
    const roster = state.players
      .map((p) =>
        GameShell.playerRow(p, {
          me: state.me,
          status:
            state.phase === 'waiting'
              ? p.id === state.host
                ? '房主'
                : '已入座'
              : p.id === state.djId
                ? '本輪 DJ'
                : state.readyIds.includes(p.id)
                  ? '已作答'
                  : '',
          metrics: [
            { value: '年代卡 ' + p.timeline.length + '/' + state.settings.target, label: '年代卡' },
            { value: '標記 ' + p.tokens, label: '標記' },
            { value: '前奏分 ' + p.bonus, label: '前奏分' },
          ],
        }),
      )
      .join('');
    if ($('#players').innerHTML !== roster) $('#players').innerHTML = roster;
    const key = JSON.stringify([
      state.phase,
      state.roundId,
      state.submitted,
      state.host,
      state.djId,
      state.placement,
      state.challenges,
      state.passed,
      state.settings,
      state.availableCount,
      state.players.map((p) => [p.tokens, p.timeline.length, p.musicCardFrame]),
    ]);
    if (key !== renderKey) {
      renderKey = key;
      const focus = document.activeElement?.id;
      drawControls();
      collection();
      if (focus) document.getElementById(focus)?.focus({ preventScroll: true });
    }
    const coverKey = state.roundId + ':' + (state.song?.id || 'hidden');
    if ($('#mqCover').dataset.key !== coverKey) {
      $('#mqCover').dataset.key = coverKey;
      $('#mqCover').replaceChildren(cover(state.song));
    }
    $('#results').closest('section').hidden = !state.results.length;
    const resultKey = JSON.stringify([state.results.length, state.phase]);
    if ($('#results').dataset.key !== resultKey) {
      $('#results').dataset.key = resultKey;
      $('#results').replaceChildren(
        ...state.results.map((r) =>
          el(
            'p',
            r.round +
              '. ' +
              r.year +
              ' · ' +
              r.title +
              ' — ' +
              r.artist +
              ' · ' +
              (r.receiverName || '棄牌'),
          ),
        ),
      );
    }
    updatePlayback();
    lock();
    for (const n of $('#mqCover').querySelectorAll('h1,h2,h3,strong'))
      if (n.textContent === state.song?.title)
        window.SongTitleZh?.decorate(n, state.song.title, state.song.language);
  }
  async function refresh() {
    if (disposed || reading || busy) return;
    reading = true;
    const lifetime = scope;
    try {
      const next = await request('state');
      if (lifetime === scope && !disposed) render(next);
    } catch (e) {
      if (!disposed && e.name !== 'AbortError') $('#connection').textContent = e.message;
    } finally {
      reading = false;
    }
  }
  async function start() {
    disposed = false;
    scope = new AbortController();
    try {
      const lifetime = scope;
      await RoomReconnect.restore(code, 'musicquiz', '#connection', { signal: scope.signal });
      if (disposed || scope !== lifetime) return;
      await window.BarrageFrames?.refreshRewards?.();
      await refresh();
      if (!disposed && scope === lifetime) timer = setInterval(refresh, 1000);
    } catch (e) {
      say(e.message);
    }
  }
  $('#retry').onclick = () => retry && mutate(retry.route, retry.payload);
  $('#leave').onclick = async () => {
    if (busy || !confirm('離席會中止進行中的場次，確定離開？')) return;
    if (await mutate('leave', {})) {
      RoomReconnect.forget(code);
      location.replace('/?game=musicquiz');
    }
  };
  countdownTimer = setInterval(() => {
    if (state?.deadline)
      $('#deadline').textContent =
        '剩 ' + Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) + ' 秒';
    else $('#deadline').textContent = '';
  }, 250);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      player?.pauseVideo?.();
      audio?.pause();
    } else refresh();
  });
  window.addEventListener('pagehide', () => {
    disposed = true;
    scope?.abort();
    clearInterval(timer);
    clearInterval(countdownTimer);
    clearPlayback();
    playKey = '';
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      clearInterval(timer);
      clearInterval(countdownTimer);
      countdownTimer = setInterval(() => {
        if (state?.deadline)
          $('#deadline').textContent =
            '剩 ' + Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) + ' 秒';
        else $('#deadline').textContent = '';
      }, 250);
      start();
    }
  });
  document.addEventListener('input', (event) => {
    if (
      ['waiting', 'finished'].includes(state?.phase) &&
      event.target.closest('#controls') &&
      !event.target.closest('[data-room-common]')
    ) {
      dirtySettings = true;
      say('題庫設定尚未儲存');
      actions.refresh();
    }
  });
  AudioSettings?.subscribe?.((s) => {
    try {
      player?.setVolume?.(Math.round(s.music.volume * 100));
      if (s.music.enabled) player?.unMute?.();
      else player?.mute?.();
    } catch {}
  });
  if (!code) {
    $('#guide').hidden = false;
    $('#guide').open = true;
    $('#connection').textContent = '從大廳建立房間後開始。';
    return;
  }
  start();
})();
