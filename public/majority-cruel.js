((w) => {
  const e = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const name = (s, id) => s.players.find((p) => p.id === id)?.name || '已離席';
  function picture(q, i) {
    return q.images?.[i]
      ? '<img class="cruel-option-art" src="' +
          e(q.images[i]) +
          '" alt="' +
          e(q.options[i]) +
          '" width="420" height="270">'
      : '';
  }
  function modeSetting(s) {
    return (
      '<label>這局玩法<select id="majorityMode">' +
      [
        ['majority', '一般同頻'],
        ['cruel', '殘酷2選1・圖片題'],
        ['music', '猜歌2選1・淘汰賽'],
        ['scenario', '情境2選1・淘汰賽'],
      ]
        .map(
          ([id, label]) =>
            '<option value="' +
            id +
            '" ' +
            ((s.options.mode || 'majority') === id ? 'selected' : '') +
            '>' +
            label +
            '</option>',
        )
        .join('') +
      '</select></label>'
    );
  }
  function teamBoard(s) {
    return (
      '<div class="cruel-teams">' +
      (s.cruel.teams || [])
        .map(
          (t, i) =>
            '<section class="cruel-team" style="--team-color:' +
            ['#b16b89', '#588a9d', '#698d74', '#b48c55'][i % 4] +
            '"><h3>' +
            e(t.name) +
            ' <b>' +
            t.score +
            '</b></h3><div>' +
            t.members.map((id) => '<span>' + e(name(s, id)) + '</span>').join('<span>＋</span>') +
            '</div>' +
            (s.host && s.phase === 'waiting' && t.members.length === 2
              ? '<label>搭檔<select data-pair-player="' +
                e(t.members[0]) +
                '">' +
                s.players
                  .filter((p) => p.id !== t.members[0])
                  .map(
                    (p) =>
                      '<option value="' +
                      p.id +
                      '" ' +
                      (p.id === t.members[1] ? 'selected' : '') +
                      '>' +
                      e(p.name) +
                      '</option>',
                  )
                  .join('') +
                '</select></label>'
              : '') +
            '</section>',
        )
        .join('') +
      '</div>'
    );
  }
  function cards(q, s, answering) {
    return (
      '<div class="cruel-options">' +
      q.options
        .map((o, i) =>
          answering
            ? '<button type="button" class="answer cruel-answer" data-choice="' +
              i +
              '" ' +
              (s.ownAnswer !== null || !s.participantIds.includes(s.me) ? 'disabled' : '') +
              '><span>' +
              String.fromCharCode(65 + i) +
              '</span>' +
              picture(q, i) +
              '<strong>' +
              e(o) +
              '</strong></button>'
            : '<section class="cruel-reveal-option">' +
              picture(q, i) +
              '<h2>' +
              String.fromCharCode(65 + i) +
              ' · ' +
              e(o) +
              '</h2><p class="cruel-vote-count">' +
              Object.values(s.answers || {}).filter((a) => a === i).length +
              ' 票' +
              (s.ownAnswer === i ? ' · ✓ 你的選擇' : '') +
              '</p>' +
              w.MajorityTournament.renderVoters(s, i, false) +
              '</section>',
        )
        .join('') +
      '</div>'
    );
  }
  function render(s) {
    const c = s.cruel;
    if (!c) return null;
    if (s.phase === 'waiting')
      return (
        '<div class="card cruel-card"><div class="eyebrow">WOULD YOU RATHER</div><h1>殘酷2選1</h1><p class="sub">' +
        (c.rules === 'teams' ? '4／6／8 人・兩人一隊・十題' : '1–12 人・十題・個人選邊') +
        '</p>' +
        (s.host
          ? '<section class="room-settings-panel"><div class="fields">' +
            modeSetting(s) +
            '<label>計分玩法<select id="cruelRules"><option value="teams" ' +
            (c.rules === 'teams' ? 'selected' : '') +
            '>雙人組隊</option><option value="individual" ' +
            (c.rules === 'individual' ? 'selected' : '') +
            '>個人玩法（可獨自玩）</option></select></label>' +
            (c.rules === 'individual'
              ? '<label>多人時得分方式<select id="cruelScoring"><option value="majority" ' +
                (c.scoring === 'majority' ? 'selected' : '') +
                '>多數得分</option><option value="minority" ' +
                (c.scoring === 'minority' ? 'selected' : '') +
                '>少數得分</option></select></label>'
              : '') +
            '</div><p id="roomSettingsFeedback" role="status"></p></section>'
          : '') +
        teamBoard(s) +
        '<p>' +
        (c.rules === 'teams' ? '隊友同答，隊伍得 1 分。' : '多人平票不加分；獨自遊玩只記錄選擇。') +
        ' 每人整局可換題一次。</p><div class="cruel-bank-cover">144 張原創雙圖題<br>日常・感情・成人觀念・道德・尷尬・黑色幽默</div></div>'
      );
    if (s.phase === 'answering')
      return (
        '<div class="card cruel-card"><div class="eyebrow">殘酷2選1 · ' +
        s.round +
        ' / 10</div><h1>' +
        e(s.question.prompt) +
        '</h1>' +
        cards(s.question, s, true) +
        (s.ownAnswer !== null
          ? '<p role="status">你的 ' +
            String.fromCharCode(65 + s.ownAnswer) +
            ' 已鎖定，等大家一起揭曉。</p>'
          : '') +
        teamBoard(s) +
        '</div>'
      );
    if (s.phase === 'reveal')
      return (
        '<div class="card cruel-card"><div class="eyebrow">' +
        (c.solo ? '你的選擇' : '一起揭曉') +
        '</div><h1>' +
        e(s.question.prompt) +
        '</h1>' +
        cards(s.question, s, false) +
        teamBoard(s) +
        (c.rules === 'teams'
          ? '<div class="cruel-round-gains">' +
            c.teams
              .map(
                (t) =>
                  '<span>' + e(t.name) + ' <b>+' + (s.result.teamGains[t.id] || 0) + '</b></span>',
              )
              .join('') +
            '</div>'
          : c.solo
            ? '<p>沒有標準答案，這就是你的偏好。</p>'
            : '<div class="cruel-round-gains">' +
              s.players
                .filter((p) => s.participantIds.includes(p.id))
                .map(
                  (p) =>
                    '<span>' + e(p.name) + ' <b>+' + (s.result.gains[p.id] || 0) + '</b></span>',
                )
                .join('') +
              '</div>') +
        '</div>'
      );
    if (s.phase === 'finished')
      return (
        '<div class="card cruel-card"><h1>' +
        (s.winner?.reason
          ? e(s.winner.reason)
          : (s.winner?.ids || []).map((id) => e(name(s, id))).join('、') + '・同頻勝出') +
        '</h1>' +
        teamBoard(s) +
        '<div class="cruel-recap">' +
        c.recap
          .map(
            (r, i) =>
              '<article><h3>' +
              (i + 1) +
              '. ' +
              e(r.question.prompt) +
              '</h3><div class="cruel-options">' +
              r.question.options
                .map(
                  (o, n) =>
                    '<div>' +
                    picture(r.question, n) +
                    '<span>' +
                    e(o) +
                    '</span>' +
                    (r.answers[s.me] === n ? '<b>你的選擇</b>' : '') +
                    '</div>',
                )
                .join('') +
              '</div></article>',
          )
          .join('') +
        '</div></div>'
      );
    return null;
  }
  function enhance(s, stage) {
    const hero = document.querySelector('.room-waiting-template'),
      info = hero?.querySelector('.room-waiting-info');
    if (info) {
      const title = info.querySelector('h2'),
        copy = info.querySelector('p');
      hero._originalTitle ??= title.textContent;
      hero._originalCopy ??= copy.textContent;
      title.textContent = s.cruel ? '殘酷2選1' : hero._originalTitle;
      copy.textContent = s.cruel
        ? s.cruel.rules === 'teams'
          ? '兩人一隊・十題默契賽・隊友同答得1分'
          : '個人十題・可獨自玩・多數或少數得分'
        : hero._originalCopy;
      let extra = info.querySelector('.cruel-waiting-content');
      if (s.cruel && s.phase === 'waiting') {
        if (!extra) {
          extra = document.createElement('div');
          extra.className = 'cruel-waiting-content';
          info.append(extra);
        }
        extra.innerHTML = teamBoard(s);
      } else extra?.remove();
    }
    for (const b of stage.querySelectorAll('[data-question]')) {
      const q = s.candidates.find((q) => q.id === b.dataset.question);
      if (q?.images) {
        const row = document.createElement('div');
        row.className = 'cruel-mini-pair';
        row.innerHTML = q.images.map((_, i) => picture(q, i)).join('');
        b.prepend(row);
      }
    }
    if (s.question?.images && !s.cruel && !s.tournament)
      for (const b of stage.querySelectorAll('[data-choice]'))
        b.insertAdjacentHTML('beforeend', picture(s.question, Number(b.dataset.choice)));
  }
  w.CruelCards = { render, enhance, modeSetting, picture };
})(window);
