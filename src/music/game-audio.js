'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const { HttpError } = require('../http/errors');
class GameAudioLibrary {
  constructor(directory) {
    this.directory = path.resolve(directory);
    this.cacheStamp = null;
    this.manifest = null;
  }
  read() {
    try {
      const file = path.join(this.directory, 'manifest.json'),
        stat = fs.statSync(file),
        stamp = stat.mtimeMs + ':' + stat.size;
      if (stamp !== this.cacheStamp) {
        this.manifest = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
        this.cacheStamp = stamp;
      }
      return this.manifest?.songs || {};
    } catch {
      return {};
    }
  }
  clip(videoId, stage, start) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !['intro', 'highlight'].includes(stage))
      return null;
    const entries = this.read(),
      song = Object.values(entries).find(
        (s) =>
          s && s.videoId === videoId && s.status === 'ready' && s.clips?.[stage]?.start === start,
      ),
      clip = song?.clips?.[stage];
    if (
      !clip ||
      clip.start !== start ||
      clip.seconds !== (stage === 'intro' ? 8 : 30) ||
      ![videoId, song.id]
        .filter((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{11}(?:-\d+)?$/.test(id))
        .some((id) => clip.file === 'clips/' + id + '.' + stage + '.mp3')
    )
      return null;
    try {
      const base = path.join(fs.realpathSync(this.directory), 'clips');
      if (fs.realpathSync(base) !== base) return null;
      const file = path.join(this.directory, clip.file),
        real = fs.realpathSync(file);
      if (path.dirname(real) !== base || fs.lstatSync(file).isSymbolicLink()) return null;
      const stat = fs.statSync(real);
      if (
        !stat.isFile() ||
        stat.size < (clip.seconds - 0.25) * 16000 ||
        stat.size > 2 * 1024 * 1024
      )
        return null;
      return {
        file: real,
        bytes: stat.size,
        seconds: clip.seconds,
        reviewed: clip.reviewed === true,
        revision: Math.floor(stat.mtimeMs) + '-' + stat.size,
      };
    } catch {
      return null;
    }
  }
  context(room, view, entryIndex) {
    if (room.type === 'musicquiz') {
      const media = view.playback;
      if (
        !media ||
        !room.current ||
        !['intro', 'timeline', 'challenge', 'reveal', 'finished'].includes(room.phase)
      )
        return null;
      const stage = room.phase === 'intro' ? 'intro' : 'highlight',
        start = stage === 'intro' ? room.current.introStart : room.current.highlightStart;
      const clip = this.clip(room.current.videoId, stage, start);
      return clip && { ...clip, roundId: room.roundId, stage };
    }
    if (
      room.type === 'majority' &&
      room.options?.mode === 'music' &&
      ['answering', 'reveal'].includes(room.phase) &&
      Number.isInteger(entryIndex) &&
      entryIndex >= 0 &&
      entryIndex < 2
    ) {
      const entry = room.question?.entries?.[entryIndex];
      if (!entry) return null;
      const song = require('../games/musicquiz-library').CATALOG.find((s) => s.id === entry.id);
      if (!song) return null;
      const clip = this.clip(song.videoId, 'highlight', song.highlightStart);
      return clip && { ...clip, roundId: room.question.id, stage: 'highlight', entry: entryIndex };
    }
    return null;
  }
  decorate(room, view) {
    const url = (c) =>
      '/api/game-song-audio?' +
      new URLSearchParams({
        code: room.code,
        roundId: c.roundId,
        stage: c.stage,
        ...(c.entry !== undefined ? { entry: String(c.entry) } : {}),
        v: c.revision,
      });
    if (room.type === 'musicquiz') {
      const c = this.context(room, view);
      return c
        ? {
            ...view,
            playback: {
              provider: 'audio',
              url: url(c),
              stage: c.stage,
              start: 0,
              seconds: c.seconds,
              clipReviewed: c.reviewed,
            },
          }
        : view;
    }
    if (room.type === 'majority' && view.question?.entries && room.options?.mode === 'music')
      return {
        ...view,
        question: {
          ...view.question,
          entries: view.question.entries.map((e, i) => {
            const c = this.context(room, view, i);
            return c
              ? { ...e, audioUrl: url(c), audioSeconds: c.seconds, clipReviewed: c.reviewed }
              : e;
          }),
        },
      };
    return view;
  }
  serve(req, res, room, view, params) {
    if (!['GET', 'HEAD'].includes(req.method))
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
    const raw = params.get('entry'),
      entry = raw !== null && /^[01]$/.test(raw) ? Number(raw) : undefined;
    const c = this.context(room, view, entry);
    if (!c || params.get('roundId') !== c.roundId || params.get('stage') !== c.stage)
      throw new HttpError(404, 'AUDIO_NOT_AVAILABLE', '本輪音檔尚未準備好或題目已更新');
    const fd = fs.openSync(c.file, 'r'),
      stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size !== c.bytes) {
      fs.closeSync(fd);
      throw new HttpError(404, 'AUDIO_NOT_AVAILABLE', '音檔正在更新，請重試');
    }
    let start = 0,
      end = c.bytes - 1;
    const range = req.headers.range;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', 'inline; filename="game-clip.mp3"');
    if (range !== undefined) {
      const m = typeof range === 'string' && /^bytes=(\d*)-(\d*)$/.exec(range);
      let good = !!m && !!(m[1] || m[2]);
      if (good) {
        if (m[1]) {
          start = Number(m[1]);
          end = m[2] ? Number(m[2]) : end;
        } else {
          const suffix = Number(m[2]);
          good = suffix > 0;
          start = Math.max(0, c.bytes - suffix);
        }
        good =
          good &&
          Number.isSafeInteger(start) &&
          Number.isSafeInteger(end) &&
          start >= 0 &&
          start < c.bytes &&
          end >= start;
        end = Math.min(end, c.bytes - 1);
      }
      if (!good) {
        fs.closeSync(fd);
        res.statusCode = 416;
        res.setHeader('Content-Range', 'bytes */' + c.bytes);
        return res.end();
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + c.bytes);
    }
    res.setHeader('Content-Length', end - start + 1);
    if (req.method === 'HEAD') {
      fs.closeSync(fd);
      return res.end();
    }
    const stream = fs.createReadStream(c.file, { fd, autoClose: true, start, end });
    res.on('close', () => stream.destroy());
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}
module.exports = { GameAudioLibrary };
