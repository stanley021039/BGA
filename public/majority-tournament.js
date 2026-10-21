((w) => {
  'use strict';
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const title = (s) => (s.tournament.mode === 'music' ? '猜歌2選1' : '情境2選1');
  let preview = null,
    previewQuestion = null,
    lastScene = null,
    videoUnbind = null;
  function standings(s) {
    return (
      '<ol class="tournament-standings" aria-label="玩家積分排行">' +
      s.tournament.ranking
        .map(
          (p) =>
            '<li><b>' +
            p.rank +
            '</b><span>' +
            esc(p.name) +
            (p.id === s.me ? '（你）' : '') +
            '</span><strong>' +
            p.score +
            ' 分</strong></li>',
        )
        .join('') +
      '</ol>'
    );
  }
  function settings(s) {
    const t = s.tournament,
      count = t.themes.find((b) => b.id === s.options.theme)?.count || 0;
    return (
      '<section class="room-settings-panel" aria-label="房間設定"><div class="fields">' +
      CruelCards.modeSetting(s) +
      '<label>比賽主題<select id="tournamentTheme">' +
      t.themes
        .map(
          (b) =>
            '<option value="' +
            esc(b.id) +
            '" ' +
            (b.id === s.options.theme ? 'selected' : '') +
            '>' +
            esc(b.label) +
            ' · ' +
            b.count +
            ' 項</option>',
        )
        .join('') +
      '</select></label><label>淘汰賽規模<select id="tournamentSize">' +
      [8, 16, 32, 64, 128, 256]
        .map(
          (n) =>
            '<option value="' +
            n +
            '" ' +
            (t.size === n ? 'selected' : '') +
            ' ' +
            (count < n ? 'disabled' : '') +
            '>' +
            n +
            ' 強 · ' +
            (n - 1) +
            ' 場' +
            (count < n ? '（此主題不足）' : '') +
            '</option>',
        )
        .join('') +
      '</select></label></div><p id="roomSettingsFeedback" role="status"></p></section>'
    );
  }
  function art(entry, music) {
    return (
      '<div class="tournament-art ' +
      (music ? 'tournament-record' : '') +
      '"><img src="' +
      esc(entry.image) +
      '" width="400" height="300" alt="' +
      (music ? '音樂黑膠示意封面' : esc(entry.label) + '・主題情境插畫') +
      '"></div>'
    );
  }
  function voters(s, index, showGain = true) {
    const selected = Object.entries(s.answers || {}).filter(([, answer]) => answer === index);
    return (
      '<ul class="tournament-voters" aria-label="選擇 ' +
      String.fromCharCode(65 + index) +
      ' 的玩家">' +
      selected
        .map(([id]) => {
          const p = s.players.find((p) => p.id === id) || s.departed?.find((p) => p.id === id),
            name = p?.name || '已離席',
            gain = s.result?.gains?.[id] || 0;
          return (
            '<li' +
            (id === s.me ? ' class="is-me"' : '') +
            '><span class="tournament-voter-avatar" aria-hidden="true">' +
            (p?.avatar ? '<img src="' + esc(p.avatar) + '" alt="">' : esc(name.slice(0, 1))) +
            '</span><span>' +
            esc(name) +
            (id === s.me ? '（你）' : '') +
            '</span>' +
            (showGain ? '<strong>' + (gain ? '+1 分' : '未加分') + '</strong>' : '') +
            '</li>'
          );
        })
        .join('') +
      (selected.length ? '' : '<li class="tournament-no-votes">沒有人選這邊</li>') +
      '</ul>'
    );
  }
  function cards(s) {
    const reveal = s.phase === 'reveal',
      t = s.tournament,
      r = s.result?.tournament,
      total = reveal ? r.counts.reduce((a, b) => a + b, 0) : 0;
    return (
      '<div class="tournament-options">' +
      s.question.entries
        .map((entry, i) => {
          const votes = reveal ? r.counts[i] : null,
            advanced = reveal && r.advanced.id === entry.id,
            own = s.ownAnswer === i;
          return (
            '<article class="tournament-option ' +
            (advanced ? 'is-advanced ' : '') +
            (own ? 'is-own-choice' : '') +
            '">' +
            (reveal
              ? '<div class="tournament-card-content">'
              : '<button type="button" class="answer tournament-answer" data-choice="' +
                i +
                '" aria-pressed="' +
                own +
                '" ' +
                (s.ownAnswer !== null || !s.participantIds.includes(s.me) ? 'disabled' : '') +
                '>') +
            '<div class="tournament-option-head"><span class="tournament-letter">' +
            String.fromCharCode(65 + i) +
            '</span><span class="tournament-own-mark">' +
            (own ? '✓ 你的選擇' : '') +
            '</span></div>' +
            art(entry, t.mode === 'music') +
            '<strong class="tournament-entry-title">' +
            esc(entry.label) +
            '</strong><small class="tournament-detail">' +
            esc(entry.detail) +
            '</small>' +
            (reveal
              ? '<div class="tournament-votes"><strong>' +
                votes +
                ' 票 <small>' +
                ((votes / Math.max(total, 1)) * 100).toFixed(1) +
                '%</small></strong><span>' +
                (advanced ? (t.stage === 2 ? '冠軍' : '晉級') : '本輪止步') +
                '</span></div></div>'
              : '</button>') +
            (t.mode === 'music'
              ? '<button type="button" class="tournament-listen quiet" data-tournament-listen="' +
                i +
                '" aria-label="試聽 ' +
                esc(entry.label) +
                '">試聽這首歌</button>'
              : '') +
            (reveal ? voters(s, i) : '') +
            '</article>'
          );
        })
        .join('') +
      '</div>'
    );
  }
  function render(s) {
    if (!s.tournament) return null;
    const t = s.tournament;
    if (s.phase === 'waiting')
      return (
        '<div class="card tournament-card tournament-waiting"><div class="eyebrow">FREQUENCY CLUB · ' +
        t.size +
        ' 強淘汰賽</div><h1>' +
        title(s) +
        '</h1><p>3–12 人一起選邊，選到唯一多數每人 +1 分。最後選出全桌冠軍，也比一比誰最懂大家。</p>' +
        (s.host
          ? settings(s)
          : '<p>主題：' +
            esc(t.themes.find((b) => b.id === s.options.theme)?.label) +
            ' · ' +
            t.size +
            ' 強</p>') +
        '<div class="tournament-rules"><span>秘密投票</span><span>平票不加分・抽籤晉級</span><span>選項冠軍＋玩家排行</span></div><p class="small">各主題隨機抽出 ' +
        t.size +
        ' 個不同選項。' +
        (t.mode === 'music'
          ? '每首歌可自行點選 YouTube 試聽。'
          : '原創情境插畫由 Stitch 設計，同類情境共用主題插畫。') +
        '</p></div>'
      );
    if (['answering', 'reveal'].includes(s.phase))
      return (
        '<div class="card tournament-card"><div class="tournament-heading"><span class="eyebrow">' +
        title(s) +
        ' · ' +
        (t.stage === 2 ? '冠軍決選' : t.stage + ' 強') +
        '</span><span>第 ' +
        t.pair +
        ' / ' +
        t.stage / 2 +
        ' 組</span></div><h1>' +
        esc(s.question.prompt) +
        '</h1>' +
        cards(s) +
        (s.phase === 'answering'
          ? '<p class="tournament-note" role="status">' +
            (s.ownAnswer !== null
              ? '你的 ' + String.fromCharCode(65 + s.ownAnswer) + ' 已鎖定，等大家一起揭曉。'
              : '選好後鎖定答案，揭曉前看不到別人的選擇。') +
            '</p>'
          : '<p class="tournament-note" role="status">' +
            (s.result.tournament.tied
              ? '平票：本輪無人加分，抽籤由「' +
                esc(s.result.tournament.advanced.label) +
                '」晉級。'
              : '「' +
                esc(s.result.tournament.advanced.label) +
                '」獲勝，選到多數的玩家各 +1 分。') +
            (s.result.missingIds.length
              ? ' ' +
                s.result.missingIds.length +
                ' 人未交卷，不加分：' +
                s.result.missingIds
                  .map((id) => esc(s.players.find((p) => p.id === id)?.name || '已離席'))
                  .join('、') +
                '。'
              : '') +
            '</p>' +
            standings(s)) +
        '</div>'
      );
    if (s.phase === 'finished')
      return (
        '<div class="card tournament-card"><div class="eyebrow">' +
        title(s) +
        ' · 最終結果</div>' +
        (t.champion
          ? '<section class="tournament-champion" aria-label="全桌選項冠軍"><span>全桌票選第一名</span>' +
            art(t.champion, t.mode === 'music') +
            '<h1>' +
            esc(t.champion.label) +
            '</h1><p>' +
            esc(t.champion.detail) +
            '</p></section>'
          : '<h1>' + esc(s.winner?.reason || '本局提前結束') + '</h1>') +
        '<h2>玩家積分排行</h2>' +
        standings(s) +
        (t.entryRanking.length
          ? '<details class="tournament-entry-ranking"><summary>查看完整選項排行</summary><ol>' +
            t.entryRanking
              .map((e) => '<li><b>第 ' + e.rank + ' 名</b><span>' + esc(e.label) + '</span></li>')
              .join('') +
            '</ol><p class="small">同一輪止步並列；未交手的選項不另排高低。</p></details>'
          : '') +
        '</div>'
      );
    return null;
  }
  let audioUnbind = null;
  function closePreview() {
    videoUnbind?.();
    videoUnbind = null;
    const audio = preview?.querySelector('audio');
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audioUnbind?.();
    audioUnbind = null;
    preview?.remove();
    preview = null;
    previewQuestion = null;
  }
  function listen(s, index) {
    const e = s.question?.entries?.[index];
    if (s.tournament?.mode !== 'music' || !e || !/^[A-Za-z0-9_-]{11}$/.test(e.videoId)) return;
    closePreview();
    previewQuestion = s.question.id;
    preview = document.createElement('section');
    preview.className = 'tournament-preview';
    preview.setAttribute('aria-label', '個人試聽播放器');
    preview.innerHTML =
      '<div class="tournament-preview-head"><strong>' +
      esc(e.label) +
      '</strong><button type="button" aria-label="關閉試聽">關閉</button></div><iframe title="' +
      esc(e.label) +
      ' YouTube 試聽" src="https://www.youtube-nocookie.com/embed/' +
      e.videoId +
      '?autoplay=0&amp;enablejsapi=1&amp;origin=' +
      encodeURIComponent(location.origin) +
      '&amp;rel=0" allow="encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><a href="https://www.youtube.com/watch?v=' +
      e.videoId +
      '" target="_blank" rel="noopener">無法播放？在 YouTube 開啟</a>';
    if (e.audioUrl) {
      preview.querySelector('iframe')?.remove();
      preview.querySelector('a')?.remove();
      const audio = document.createElement('audio'),
        status = document.createElement('p');
      audio.controls = true;
      audio.preload = 'none';
      audio.setAttribute('aria-label', e.label + ' 音檔試聽');
      status.setAttribute('role', 'status');
      status.textContent = e.clipReviewed ? '' : '精華切點尚待逐首校正。';
      const url = new URL(e.audioUrl, location.origin);
      if (url.origin === location.origin && url.pathname === '/api/game-song-audio') {
        audio.src = url.href;
        audio.onerror = () => {
          status.textContent = '音檔讀取失敗，請關閉後重試；若已換題，請選擇新題目。';
        };
        preview.append(audio, status);
        audioUnbind = w.AudioSettings?.bindPreview?.(audio);
      } else status.textContent = '音檔來源不正確';
    }
    const fallback = preview.querySelector('iframe');
    if (fallback)
      videoUnbind = w.AudioSettings?.registerMusic?.({
        isPlaying: () => false,
        pause: () =>
          fallback.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            'https://www.youtube-nocookie.com',
          ),
        resume() {},
      });
    preview.querySelector('button').onclick = closePreview;
    document.body.append(preview);
    w.GameUI?.decorateButton(preview.querySelector('button'), 'close', {
      iconOnly: true,
      label: '關閉試聽',
    });
  }
  w.addEventListener('pagehide', closePreview);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) preview?.querySelector('audio')?.pause();
  });
  function enhance(s, stage) {
    if (
      previewQuestion &&
      (previewQuestion !== s.question?.id || !s.tournament || s.phase === 'finished')
    )
      closePreview();
    if (!s.tournament) return;
    const scene = s.phase + ':' + (s.question?.id || 'waiting');
    if (scene !== lastScene) {
      lastScene = scene;
      const main = document.querySelector('main.game-barrage-host');
      main?.scrollTo?.({ top: 0 });
      if (w.matchMedia?.('(max-width:1100px)').matches)
        main?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
    }
    const hero = document.querySelector('.room-waiting-template'),
      info = hero?.querySelector('.room-waiting-info');
    if (info && s.phase === 'waiting') {
      info.querySelector('h2').textContent = title(s);
      info.querySelector('p').textContent =
        s.tournament.size + ' 強淘汰賽・多數 +1 分・選出全桌冠軍';
    }
    for (const b of stage.querySelectorAll('[data-tournament-listen]')) {
      w.GameUI?.decorateButton(b, 'play', { label: '試聽這首歌' });
      b.onclick = () => listen(s, Number(b.dataset.tournamentListen));
    }
  }
  function readSettings(s) {
    const mode = document.querySelector('#majorityMode')?.value || s.options.mode || 'majority';
    if (!['music', 'scenario'].includes(mode)) return {};
    if (mode !== s.options.mode) return { bracketSize: 8 };
    const theme = document.querySelector('#tournamentTheme')?.value || s.options.theme;
    let size = Number(
        document.querySelector('#tournamentSize')?.value || s.options.bracketSize || 8,
      ),
      count = s.tournament.themes.find((t) => t.id === theme)?.count || 0;
    if (size > count) size = [256, 128, 64, 32, 16, 8].find((n) => n <= count) || 8;
    return { theme, bracketSize: size };
  }
  w.MajorityTournament = { renderVoters: voters, render, enhance, readSettings, closePreview };
})(window);
