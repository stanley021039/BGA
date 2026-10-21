(() => {
  'use strict';
  const q = (s) => document.querySelector(s);
  let songs = [],
    busy = false,
    cancel = false,
    capabilities = { available: false },
    draft = null,
    controller = null,
    canCancelCurrent = true;
  const status = (t) => (q('#status').textContent = t);
  const controlIds = [
    'single',
    'batch',
    'category',
    'song',
    'intro',
    'highlight',
    'folder',
    'source-file',
    'full-upload',
    'restore-full',
    'pending-draft',
    'restore-draft',
    'intro-start',
    'highlight-start',
    'reclip',
    'publish',
    'discard',
    'reviewed',
  ];
  function enable() {
    for (const id of controlIds) q('#' + id).disabled = busy;
    q('#cancel').disabled = !busy || (!!controller && !canCancelCurrent);
    q('#full-upload').disabled = busy || !capabilities.available;
    q('#reclip').disabled = busy || !capabilities.available;
    q('#restore-full').disabled = busy || !capabilities.available;
    q('#discard').disabled = busy || !draft?.canDiscard;
    q('#publish').disabled = busy || !draft;
  }
  function stopPreviews() {
    for (const stage of ['intro', 'highlight']) {
      const audio = q('#' + stage + '-preview');
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }
  function showDraft(next) {
    stopPreviews();
    draft = next;
    q('#draft').hidden = !next;
    if (!next) {
      enable();
      return;
    }
    for (const stage of ['intro', 'highlight']) {
      q('#' + stage + '-start').value = next[stage + 'Start'];
      q('#' + stage + '-start').max = Math.max(0, next.duration - (stage === 'intro' ? 8 : 30));
      q('#' + stage + '-preview').src = next.preview[stage];
    }
    q('#reviewed').checked = next.reviewed;
    q('#draft-summary').textContent =
      '完整長度 ' +
      next.duration.toFixed(1) +
      ' 秒 · ' +
      (next.published ? '目前已套用' : '草稿，尚未套用');
    enable();
  }
  function selection() {
    const song = songs.find((s) => s.id === q('#song').value);
    q('#restore-full').hidden = !song?.fullSourceId;
    if (draft?.songId !== song?.id) showDraft(null);
  }
  function choices() {
    const selected = q('#song').value;
    q('#song').replaceChildren();
    for (const s of songs.filter((s) => !q('#category').value || s.bank === q('#category').value)) {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent =
        s.title +
        ' — ' +
        s.artist +
        (s.status === 'ready' ? '（已備妥）' : s.status === 'processing' ? '（缺少片段）' : '');
      q('#song').append(o);
    }
    if ([...q('#song').options].some((o) => o.value === selected)) q('#song').value = selected;
    selection();
  }
  async function json(url, options) {
    const r = await fetch(url, options),
      d = await r.json();
    if (!r.ok) throw Error(d.error || '操作失敗');
    return d;
  }
  async function load() {
    const d = await json('/api/admin/game-audio');
    songs = d.songs;
    const pending = d.pendingDrafts || [];
    q('#pending-drafts').hidden = !pending.length;
    q('#pending-draft').replaceChildren();
    for (const draft of pending) {
      const option = document.createElement('option');
      option.value = draft.id;
      option.textContent = draft.title + ' · ' + draft.duration.toFixed(1) + ' 秒';
      q('#pending-draft').append(option);
    }
    capabilities = d.fullAudio || { available: false };
    q('#converter-status').textContent = capabilities.available
      ? '可自動切片。處理期間可留在此頁等待，原遊戲音檔會保留至套用。'
      : '伺服器尚未設定FFmpeg，暫時只能上傳已切好的片段。';
    if (q('#category').options.length === 1)
      for (const b of d.banks) {
        const o = document.createElement('option');
        o.value = b.id;
        o.textContent = b.label;
        q('#category').append(o);
      }
    choices();
    enable();
  }
  q('#category').onchange = choices;
  q('#song').onchange = selection;
  async function upload(song, stage, file) {
    if (file.size > 2 * 1024 * 1024) throw Error('每個片段最多2MB');
    return json('/api/admin/game-audio/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/mpeg', 'X-Song-Id': song.id, 'X-Audio-Stage': stage },
      body: file,
    });
  }
  async function run(tasks) {
    if (busy) return;
    if (!tasks.length) {
      status('請先選擇歌曲音檔。');
      return;
    }
    busy = true;
    cancel = false;
    enable();
    q('#report').textContent = '';
    q('#progress').max = tasks.length;
    q('#progress').value = 0;
    let ok = 0,
      failed = 0;
    try {
      for (const [i, t] of tasks.entries()) {
        if (cancel) break;
        status(i + 1 + ' / ' + tasks.length + ' · ' + t.song.title);
        try {
          await upload(t.song, t.stage, t.file);
          ok++;
        } catch (e) {
          failed++;
          q('#report').textContent += t.file.name + '：' + e.message + '\n';
        }
        q('#progress').value = i + 1;
      }
      status((cancel ? '已停止。' : '完成。') + '成功 ' + ok + ' 個片段，失敗 ' + failed + ' 個。');
      await load();
    } catch (e) {
      status(e.message);
    } finally {
      busy = false;
      enable();
    }
  }
  q('#single').onclick = () => {
    const song = songs.find((s) => s.id === q('#song').value);
    if (song)
      run(
        ['intro', 'highlight'].flatMap((stage) =>
          q('#' + stage).files[0] ? [{ song, stage, file: q('#' + stage).files[0] }] : [],
        ),
      );
  };
  q('#batch').onclick = () => {
    const tasks = [];
    for (const file of q('#folder').files) {
      const m = /^([A-Za-z0-9_-]{11}(?:-\d+)?)\.(intro|highlight)\.mp3$/.exec(file.name);
      if (!m) continue;
      const song = songs.find(
        (s) => s.id === m[1] && (!q('#category').value || s.bank === q('#category').value),
      );
      if (song) tasks.push({ song, stage: m[2], file });
    }
    run(tasks);
  };
  async function fullTask(message, action, { cancellable = true } = {}) {
    if (busy) return;
    busy = true;
    canCancelCurrent = cancellable;
    controller = new AbortController();
    stopPreviews();
    enable();
    q('#cancel').textContent = '取消處理';
    q('#cancel').disabled = !cancellable;
    q('#progress').removeAttribute('value');
    status(message);
    try {
      await action(controller.signal);
    } catch (e) {
      if (draft) showDraft(draft);
      status(e.name === 'AbortError' ? '已取消處理；已套用的片段保留。' : e.message);
    } finally {
      busy = false;
      controller = null;
      q('#cancel').textContent = '停止後續上傳';
      q('#progress').max = 1;
      q('#progress').value = 1;
      enable();
    }
  }
  q('#full-upload').onclick = () => {
    const file = q('#source-file').files[0],
      song = songs.find((s) => s.id === q('#song').value);
    if (!file || !song) {
      status('請選擇歌曲與完整音檔。');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      status('完整音檔最多100MB。');
      return;
    }
    fullTask('完整音檔上傳與分析中…', async (signal) => {
      const next = await json('/api/admin/game-audio/full', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Song-Id': song.id },
        body: file,
        signal,
      });
      showDraft(next);
      await load();
      status('自動切片完成，請試聽或調整，再套用到遊戲。');
    });
  };
  q('#restore-full').onclick = () => {
    const song = songs.find((s) => s.id === q('#song').value);
    if (song?.fullSourceId)
      fullTask('載入完整音檔切點…', async (signal) => {
        showDraft(
          await json(
            '/api/admin/game-audio/draft?draftId=' + encodeURIComponent(song.fullSourceId),
            { signal },
          ),
        );
        status('已載入保存的切點，可試聽並重新剪輯。');
      });
  };
  q('#restore-draft').onclick = () => {
    const id = q('#pending-draft').value;
    if (id)
      fullTask('載入待套用草稿…', async (signal) => {
        const next = await json('/api/admin/game-audio/draft?draftId=' + encodeURIComponent(id), {
            signal,
          }),
          song = songs.find((s) => s.id === next.songId);
        if (song) {
          q('#category').value = song.bank;
          choices();
          q('#song').value = song.id;
          selection();
        }
        showDraft(next);
        status('已載入待套用草稿。');
      });
  };
  q('#reclip').onclick = () => {
    if (!draft) return;
    const introStart = Number(q('#intro-start').value),
      highlightStart = Number(q('#highlight-start').value);
    if (![introStart, highlightStart].every(Number.isFinite)) {
      status('請填寫有效起點。');
      return;
    }
    fullTask('正在依新起點切片…', async (signal) => {
      showDraft(
        await json('/api/admin/game-audio/reclip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId: draft.id, introStart, highlightStart }),
          signal,
        }),
      );
      status('新片段已準備好，請重新試聽後套用。');
    });
  };
  q('#publish').onclick = () => {
    if (!draft) return;
    fullTask(
      '正在套用片段…',
      async (signal) => {
        const result = await json('/api/admin/game-audio/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId: draft.id, reviewed: q('#reviewed').checked }),
          signal,
        });
        showDraft(result.draft);
        await load();
        status('片段已套用到遊戲，完整音檔已保存供重新切片。');
      },
      { cancellable: false },
    );
  };
  q('#discard').onclick = () => {
    if (!draft?.canDiscard) return;
    fullTask(
      '刪除草稿…',
      async (signal) => {
        await json('/api/admin/game-audio/discard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId: draft.id }),
          signal,
        });
        showDraft(null);
        await load();
        status('已刪除草稿與完整音檔，遊戲原片段保持不變。');
      },
      { cancellable: false },
    );
  };
  q('#cancel').onclick = () => {
    if (controller) controller.abort();
    else {
      cancel = true;
      status('目前片段完成後停止。');
    }
  };
  window.addEventListener('pagehide', () => {
    controller?.abort();
    stopPreviews();
  });
  load().catch((e) => status(e.message));
})();
