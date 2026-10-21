'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  { randomUUID } = require('node:crypto'),
  { spawn } = require('node:child_process');
const { HttpError } = require('../http/errors'),
  { CATALOG } = require('../games/musicquiz-library'),
  { duration, store } = require('./game-audio-uploads');
const { findIntroStart } = require('./intro-onset');
const MAX_FULL = 100 * 1024 * 1024,
  RATE = 4000,
  MAX_SECONDS = 1800;
const bad = (message, code = 'INVALID_AUDIO') => new HttpError(400, code, message);
function formatOf(bytes) {
  if (bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224))
    return 'mp3';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE')
    return 'wav';
  if (bytes.toString('ascii', 4, 8) === 'ftyp') return 'mov';
  if (bytes.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  if (bytes.toString('ascii', 0, 4) === 'fLaC') return 'flac';
  if (bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return 'matroska';
  throw bad('請上傳有效的MP3、M4A、WAV、OGG、FLAC或WebM音檔');
}
function suggest(pcm, channels = 1) {
  const count = pcm.length / 4,
    seconds = count / (RATE * channels);
  if (!Number.isInteger(count) || seconds < 30 || seconds > MAX_SECONDS)
    throw bad('完整音檔長度需為30秒至30分鐘', 'INVALID_DURATION');
  const energies = [];
  for (let i = 0; i < count; i += RATE * channels) {
    let sum = 0;
    const n = Math.min(RATE * channels, count - i);
    for (let j = 0; j < n; j++) {
      const v = pcm.readFloatLE((i + j) * 4);
      if (!Number.isFinite(v)) throw bad('音訊取樣不正確');
      sum += v * v;
    }
    energies.push(Math.sqrt(sum / n));
  }
  const peak = Math.max(...energies);
  if (peak < 0.00001) throw bad('音檔幾乎沒有可辨識的聲音');
  const onset = findIntroStart(pcm, { rate: RATE, channels });
  if (onset === null) throw bad('找不到持續有聲的前奏起點，請檢查來源或手動裁切');
  const introStart = Math.min(seconds - 8, onset),
    maxStart = Math.max(0, Math.floor(seconds - 30));
  const lower = Math.min(maxStart, Math.max(Math.ceil(introStart + 8), Math.floor(seconds * 0.15))),
    upper = Math.max(lower, Math.min(maxStart, Math.floor(seconds * 0.8)));
  let highlightStart = lower,
    best = -1;
  for (let start = lower; start <= upper; start++) {
    const window = energies.slice(start, start + 30),
      active = window.filter((e) => e > peak * 0.04).length / window.length,
      score = (window.reduce((a, e) => a + e, 0) / window.length) * active;
    if (score > best) {
      best = score;
      highlightStart = start;
    }
  }
  return { duration: seconds, introStart, highlightStart };
}
function execute(
  executable,
  args,
  { signal, maxOutput = 32 * 1024 * 1024, timeout = 120000 } = {},
) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(bad('已取消音檔處理', 'CONVERSION_CANCELLED'));
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let size = 0,
      chunks = [],
      failure = null;
    const stop = () => {
      failure = bad('已取消音檔處理', 'CONVERSION_CANCELLED');
      child.kill();
    };
    signal?.addEventListener('abort', stop, { once: true });
    const timer = setTimeout(() => {
      failure = new HttpError(408, 'CONVERSION_TIMEOUT', '音檔處理逾時，請改用較短音檔');
      child.kill();
    }, timeout);
    child.stdout.on('data', (b) => {
      size += b.length;
      if (size > maxOutput) {
        failure = bad('音檔超過可處理長度');
        child.kill();
      } else chunks.push(b);
    });
    child.stderr.resume();
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
    };
    child.on('error', (e) => {
      cleanup();
      reject(
        e.code === 'ENOENT'
          ? new HttpError(503, 'FFMPEG_UNAVAILABLE', '伺服器找不到FFmpeg，請設定FFMPEG_PATH')
          : bad('無法啟動音檔處理工具'),
      );
    });
    child.on('close', (code) => {
      cleanup();
      if (failure) return reject(failure);
      if (code !== 0) return reject(bad('音檔無法解碼，請確認檔案完整且未加密'));
      resolve(Buffer.concat(chunks));
    });
  });
}
class GameAudioFull {
  constructor(library, { ffmpegPath = 'ffmpeg', run } = {}) {
    this.library = library;
    this.root = path.join(library.directory, 'drafts');
    this.ffmpegPath = ffmpegPath;
    this.run = run || ((args, options) => execute(this.ffmpegPath, args, options));
    this.busy = false;
    this.toolCheck = null;
  }
  async available() {
    if (!this.toolCheck)
      this.toolCheck = this.run(['-version'], { maxOutput: 32768, timeout: 5000 }).then(
        () => true,
        () => false,
      );
    return this.toolCheck;
  }
  async locked(fn) {
    if (this.busy) throw new HttpError(429, 'CONVERTER_BUSY', '另有音檔處理中，請稍後再試');
    this.busy = true;
    try {
      if (!(await this.available()))
        throw new HttpError(
          503,
          'FFMPEG_UNAVAILABLE',
          '伺服器尚未設定FFmpeg，暫時只能上傳已切好的片段',
        );
      return await fn();
    } finally {
      this.busy = false;
    }
  }
  directory(id) {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw bad('草稿識別碼不正確');
    const dir = path.join(this.root, id);
    if (
      fs.existsSync(this.root) &&
      fs.realpathSync(this.root) !== path.join(fs.realpathSync(this.library.directory), 'drafts')
    )
      throw new HttpError(409, 'INVALID_DIRECTORY', '草稿目錄不可使用外部連結');
    if (
      fs.existsSync(dir) &&
      (fs.lstatSync(dir).isSymbolicLink() ||
        fs.realpathSync(dir) !== path.join(fs.realpathSync(this.root), id))
    )
      throw new HttpError(409, 'INVALID_DIRECTORY', '草稿目錄不可使用外部連結');
    return dir;
  }
  load(id, userId) {
    const dir = this.directory(id);
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(path.join(dir, 'draft.json'), 'utf8'));
    } catch {
      throw new HttpError(404, 'DRAFT_NOT_FOUND', '找不到音檔草稿');
    }
    if (
      !['intro', 'highlight'].every(
        (stage) =>
          Number.isFinite(meta[stage + 'Start']) &&
          meta[stage + 'Start'] >= 0 &&
          meta[stage + 'Start'] + (stage === 'intro' ? 8 : 30) <= meta.duration + 0.001,
      )
    )
      throw bad('草稿切點不正確');
    if (meta.ownerId !== userId && !meta.publishedAt)
      throw new HttpError(403, 'FORBIDDEN', '只能操作自己的未發布草稿');
    if (
      meta.id !== id ||
      !CATALOG.some((s) => s.id === meta.songId) ||
      !/^[a-f0-9-]{36}$/.test(meta.revision) ||
      !['mp3', 'wav', 'mov', 'ogg', 'flac', 'matroska'].includes(meta.format) ||
      !Number.isFinite(meta.duration) ||
      meta.duration < 30 ||
      meta.duration > MAX_SECONDS
    )
      throw bad('草稿資料不正確');
    return meta;
  }
  list(userId) {
    if (!fs.existsSync(this.root)) return [];
    const drafts = [];
    for (const id of fs.readdirSync(this.root)) {
      if (!/^[a-f0-9-]{36}$/.test(id)) continue;
      try {
        const meta = this.load(id, userId);
        if (meta.ownerId === userId && (!meta.publishedAt || meta.pending))
          drafts.push({
            ...this.view(meta),
            title: CATALOG.find((s) => s.id === meta.songId).title,
          });
      } catch {}
    }
    return drafts;
  }
  view(meta) {
    return {
      id: meta.id,
      songId: meta.songId,
      duration: meta.duration,
      introStart: meta.introStart,
      highlightStart: meta.highlightStart,
      published: !!meta.publishedAt && !meta.pending,
      canDiscard: !meta.publishedAt,
      reviewed: meta.reviewed === true,
      preview: Object.fromEntries(
        ['intro', 'highlight'].map((stage) => [
          stage,
          '/api/admin/game-audio/preview?draftId=' +
            meta.id +
            '&stage=' +
            stage +
            '&v=' +
            meta.revision,
        ]),
      ),
    };
  }
  save(meta) {
    const dir = this.directory(meta.id),
      tmp = path.join(dir, 'draft.' + randomUUID() + '.tmp');
    fs.writeFileSync(tmp, JSON.stringify(meta), { flag: 'wx' });
    try {
      fs.renameSync(tmp, path.join(dir, 'draft.json'));
    } finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  }
  input(meta) {
    const source = path.join(this.directory(meta.id), 'source.audio');
    if (fs.lstatSync(source).isSymbolicLink()) throw bad('音檔不可使用外部連結');
    return [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-max_alloc',
      '67108864',
      '-threads',
      '1',
      '-protocol_whitelist',
      'file,pipe',
      '-f',
      meta.format,
      '-i',
      source,
      '-map',
      '0:a:0',
      '-vn',
      '-sn',
      '-dn',
    ];
  }
  async clips(meta, signal) {
    const revision = randomUUID(),
      dir = this.directory(meta.id),
      files = [];
    try {
      for (const stage of ['intro', 'highlight']) {
        const seconds = stage === 'intro' ? 8 : 30,
          start = meta[stage + 'Start'],
          file = path.join(dir, stage + '.' + revision + '.mp3');
        files.push(file);
        await this.run(
          [
            ...this.input(meta),
            '-ss',
            String(start),
            '-t',
            String(seconds),
            '-map_metadata',
            '-1',
            '-codec:a',
            'libmp3lame',
            '-b:a',
            '128k',
            '-ar',
            '44100',
            '-threads',
            '1',
            '-y',
            file,
          ],
          { signal, maxOutput: 1024 },
        );
        const bytes = fs.readFileSync(file);
        if (
          bytes.length > 2 * 1024 * 1024 ||
          Math.abs(duration(bytes) - seconds) > 0.25 ||
          bytes.length < (seconds - 0.25) * 16000
        )
          throw bad('切片長度不完整，請調整起點', 'INVALID_DURATION');
      }
      return { ...meta, revision, pending: true, reviewed: false };
    } catch (e) {
      for (const file of files)
        try {
          fs.unlinkSync(file);
        } catch {}
      throw e;
    }
  }
  async upload(req, userId, signal) {
    return this.locked(async () => {
      const song = CATALOG.find((s) => s.id === req.headers['x-song-id']);
      if (!song) throw bad('請先選擇題庫歌曲', 'INVALID_SONG');
      if (Number(req.headers['content-length']) > MAX_FULL)
        throw new HttpError(413, 'AUDIO_TOO_LARGE', '完整音檔最多100MB');
      if (
        !/^audio\//.test(req.headers['content-type'] || '') &&
        req.headers['content-type'] !== 'application/octet-stream'
      )
        throw bad('請選擇音檔');
      fs.mkdirSync(this.root, { recursive: true });
      let pending = 0;
      for (const id of fs.readdirSync(this.root)) {
        if (!/^[a-f0-9-]{36}$/.test(id)) continue;
        try {
          const m = this.load(id, userId);
          if (m.ownerId === userId && !m.publishedAt) pending++;
        } catch {}
      }
      if (pending >= 5)
        throw new HttpError(409, 'DRAFT_LIMIT', '最多保留5份待套用草稿，請先套用或刪除');
      const id = randomUUID(),
        dir = this.directory(id);
      fs.mkdirSync(dir);
      let handle;
      try {
        handle = await fs.promises.open(path.join(dir, 'source.audio'), 'wx');
        let count = 0;
        for await (const b of req) {
          count += b.length;
          if (count > MAX_FULL) throw new HttpError(413, 'AUDIO_TOO_LARGE', '完整音檔最多100MB');
          await handle.writeFile(b);
        }
        await handle.close();
        handle = null;
        const head = Buffer.alloc(64),
          fd = fs.openSync(path.join(dir, 'source.audio'), 'r');
        try {
          fs.readSync(fd, head, 0, 64, 0);
        } finally {
          fs.closeSync(fd);
        }
        let meta = {
          id,
          ownerId: userId,
          songId: song.id,
          format: formatOf(head),
          createdAt: new Date().toISOString(),
        };
        const pcm = await this.run(
          [
            ...this.input(meta),
            '-t',
            String(MAX_SECONDS + 1),
            '-ac',
            '2',
            '-ar',
            String(RATE),
            '-f',
            'f32le',
            'pipe:1',
          ],
          { signal, maxOutput: (MAX_SECONDS + 1) * RATE * 8 + 4096 },
        );
        meta = { ...meta, ...suggest(pcm, 2) };
        meta = await this.clips(meta, signal);
        this.save(meta);
        return this.view(meta);
      } catch (e) {
        await handle?.close();
        const target = this.directory(id);
        if (path.dirname(target) === path.resolve(this.root))
          fs.rmSync(target, { recursive: true, force: true });
        throw e;
      }
    });
  }
  async reclip(data, userId, signal) {
    return this.locked(async () => {
      const previous = this.load(data.draftId, userId),
        next = { ...previous };
      for (const [stage, length] of [
        ['intro', 8],
        ['highlight', 30],
      ]) {
        const start = data[stage + 'Start'];
        if (
          typeof start !== 'number' ||
          !Number.isFinite(start) ||
          start < 0 ||
          start + length > previous.duration + 0.001
        )
          throw bad(
            '起點需介於0與' + Math.max(0, previous.duration - length).toFixed(1) + '秒',
            'INVALID_CUT',
          );
        next[stage + 'Start'] = start;
      }
      const meta = await this.clips(next, signal);
      this.save(meta);
      return this.view(meta);
    });
  }
  publish(data, userId) {
    if (this.busy) throw new HttpError(429, 'CONVERTER_BUSY', '音檔處理中，請稍後再套用');
    const meta = this.load(data.draftId, userId),
      dir = this.directory(meta.id),
      song = CATALOG.find((s) => s.id === meta.songId),
      bytes = {};
    for (const stage of ['intro', 'highlight']) {
      const file = path.join(dir, stage + '.' + meta.revision + '.mp3');
      if (fs.lstatSync(file).isSymbolicLink()) throw bad('片段不可使用連結');
      bytes[stage] = fs.readFileSync(file);
      const seconds = stage === 'intro' ? 8 : 30;
      if (
        bytes[stage].length > 2 * 1024 * 1024 ||
        bytes[stage].length < (seconds - 0.25) * 16000 ||
        Math.abs(duration(bytes[stage]) - seconds) > 0.25
      )
        throw bad('片段不完整');
    }
    const activeDir = path.join(this.library.directory, 'clips');
    if (
      fs.existsSync(activeDir) &&
      fs.realpathSync(activeDir) !== path.join(fs.realpathSync(this.library.directory), 'clips')
    )
      throw bad('片段目錄不可使用外部連結');
    const manifestFile = path.join(this.library.directory, 'manifest.json'),
      backups = new Map();
    for (const file of [
      manifestFile,
      ...['intro', 'highlight'].map((stage) =>
        path.join(activeDir, song.id + '.' + stage + '.mp3'),
      ),
      path.join(dir, 'draft.json'),
    ]) {
      if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())
        throw bad('音檔與清單不可使用連結');
      backups.set(file, fs.existsSync(file) ? fs.readFileSync(file) : null);
    }
    try {
      for (const stage of ['intro', 'highlight'])
        store(this.library, song.id, stage, bytes[stage], {
          sourceStart: meta[stage + 'Start'],
          reviewed: data.reviewed === true,
        });
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      manifest.songs[song.id].fullSourceId = meta.id;
      manifest.songs[song.id].clipReviewed = data.reviewed === true;
      const tmp = manifestFile + '.' + randomUUID() + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
      try {
        fs.renameSync(tmp, manifestFile);
      } finally {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      }
      meta.publishedAt = new Date().toISOString();
      meta.pending = false;
      meta.reviewed = data.reviewed === true;
      this.save(meta);
      this.library.cacheStamp = null;
      return { ok: true, draft: this.view(meta) };
    } catch (error) {
      for (const [file, previous] of backups) {
        try {
          if (previous === null) {
            if (fs.existsSync(file)) fs.unlinkSync(file);
          } else fs.writeFileSync(file, previous);
        } catch {
          console.error('Audio publish rollback could not restore an active file');
        }
      }
      this.library.cacheStamp = null;
      throw error;
    }
  }
  discard(data, userId) {
    if (this.busy) throw new HttpError(429, 'CONVERTER_BUSY', '音檔處理中');
    const meta = this.load(data.draftId, userId);
    if (meta.publishedAt) throw bad('已套用的完整音檔會保留供重新剪輯');
    const dir = this.directory(meta.id);
    if (path.dirname(dir) !== path.resolve(this.root)) throw bad('草稿目錄不正確');
    fs.rmSync(dir, { recursive: true, force: true });
    return { ok: true };
  }
  preview(req, res, params, userId) {
    const meta = this.load(params.get('draftId'), userId),
      stage = params.get('stage');
    if (!['intro', 'highlight'].includes(stage)) throw bad('片段類型不正確');
    const file = path.join(this.directory(meta.id), stage + '.' + meta.revision + '.mp3');
    if (fs.lstatSync(file).isSymbolicLink()) throw bad('片段不可使用連結');
    const bytes = fs.readFileSync(file);
    let start = 0,
      end = bytes.length - 1;
    if (req.headers.range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!m || !(m[1] || m[2])) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + bytes.length });
        return res.end();
      }
      if (m[1]) {
        start = Number(m[1]);
        end = m[2] ? Math.min(end, Number(m[2])) : end;
      } else {
        const suffix = Number(m[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) {
          res.writeHead(416);
          return res.end();
        }
        start = Math.max(0, bytes.length - suffix);
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start >= bytes.length ||
        end < start
      ) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + bytes.length });
        return res.end();
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + bytes.length);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', end - start + 1);
    res.end(req.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1));
  }
}
module.exports = { GameAudioFull, suggest, formatOf, execute, MAX_FULL };
