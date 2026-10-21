'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors'),
  { CATALOG, BANKS } = require('../games/musicquiz-library');
const MAX = 2 * 1024 * 1024;
function duration(bytes) {
  let i = 0,
    total = 0,
    frames = 0;
  if (bytes.toString('ascii', 0, 3) === 'ID3') {
    if (bytes.length < 10 || bytes.subarray(6, 10).some((x) => x > 127))
      throw new HttpError(400, 'INVALID_AUDIO', 'MP3標籤損壞');
    i = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
  }
  while (i + 4 <= bytes.length) {
    if (bytes.length - i === 128 && bytes.toString('ascii', i, i + 3) === 'TAG') {
      i += 128;
      break;
    }
    const h = bytes.readUInt32BE(i),
      version = (h >>> 19) & 3,
      layer = (h >>> 17) & 3,
      rateIndex = (h >>> 10) & 3,
      bitIndex = (h >>> 12) & 15;
    if (
      h >>> 21 !== 2047 ||
      version === 1 ||
      layer !== 1 ||
      rateIndex === 3 ||
      bitIndex === 0 ||
      bitIndex === 15
    )
      throw new HttpError(400, 'INVALID_AUDIO', '需要完整有效的MP3片段');
    const rate = [44100, 48000, 32000][rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4),
      kbps = (
        version === 3
          ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
          : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
      )[bitIndex],
      length = Math.floor(((version === 3 ? 144000 : 72000) * kbps) / rate) + ((h >>> 9) & 1);
    if (i + length > bytes.length) throw new HttpError(400, 'INVALID_AUDIO', 'MP3片段不完整');
    total += (version === 3 ? 1152 : 576) / rate;
    i += length;
    frames++;
  }
  if (!frames || i !== bytes.length)
    throw new HttpError(400, 'INVALID_AUDIO', '需要完整有效的MP3片段');
  return total;
}
function read(directory) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''),
    );
  } catch (e) {
    if (e.code === 'ENOENT') return { schemaVersion: 1, songs: {} };
    throw new HttpError(409, 'MANIFEST_INVALID', '現有音檔清單損壞，請先修復後再上傳');
  }
}
function store(library, id, stage, bytes, cut = {}) {
  const song = CATALOG.find((s) => s.id === id);
  if (!song || !['intro', 'highlight'].includes(stage))
    throw new HttpError(400, 'INVALID_SONG', '請選擇題庫歌曲與前奏／精華');
  if (!bytes.length || bytes.length > MAX)
    throw new HttpError(413, 'AUDIO_TOO_LARGE', '每個片段最多2MB');
  const expected = stage === 'intro' ? 8 : 30,
    seconds = duration(bytes);
  if (Math.abs(seconds - expected) > 0.25)
    throw new HttpError(
      400,
      'INVALID_DURATION',
      '請上傳' + expected + '秒的MP3片段，目前約' + seconds.toFixed(2) + '秒',
    );
  if (bytes.length < (expected - 0.25) * 16000)
    throw new HttpError(400, 'INVALID_BITRATE', '請使用至少128kbps的MP3片段');
  const dir = library.directory;
  fs.mkdirSync(dir, { recursive: true });
  const clipsDir = path.join(dir, 'clips');
  fs.mkdirSync(clipsDir, { recursive: true });
  if (fs.realpathSync(clipsDir) !== path.join(fs.realpathSync(dir), 'clips'))
    throw new HttpError(409, 'INVALID_DIRECTORY', '音檔目錄不可使用外部連結');
  const manifest = read(dir);
  if (
    !manifest ||
    !manifest.songs ||
    typeof manifest.songs !== 'object' ||
    Array.isArray(manifest.songs)
  )
    throw new HttpError(409, 'MANIFEST_INVALID', '音檔清單格式不正確');
  const relative = 'clips/' + song.id + '.' + stage + '.mp3',
    file = path.join(dir, relative),
    tmp = file + '.' + randomUUID() + '.tmp';
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())
    throw new HttpError(409, 'INVALID_DIRECTORY', '音檔不可使用連結');
  const previous = manifest.songs[song.id],
    clips = {
      ...(previous?.clips || {}),
      [stage]: {
        file: relative,
        bytes: bytes.length,
        start: stage === 'intro' ? song.introStart : song.highlightStart,
        seconds: expected,
        sourceStart: cut.sourceStart ?? (stage === 'intro' ? song.introStart : song.highlightStart),
        reviewed: cut.reviewed === true,
      },
    };
  const ready = ['intro', 'highlight'].every((s) => {
    const c = clips[s];
    return (
      (c &&
        c.seconds === (s === 'intro' ? 8 : 30) &&
        c.file === 'clips/' + song.id + '.' + s + '.mp3' &&
        fs.existsSync(path.join(dir, c.file))) ||
      s === stage
    );
  });
  fs.writeFileSync(tmp, bytes, { flag: 'wx' });
  try {
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
  manifest.songs[song.id] = {
    id: song.id,
    videoId: song.videoId,
    title: song.title,
    artist: song.artist,
    bank: song.bank,
    source: song.source,
    status: ready ? 'ready' : 'processing',
    clipReviewed: false,
    clips,
    updatedAt: new Date().toISOString(),
  };
  manifest.updatedAt = new Date().toISOString();
  const temp = path.join(dir, 'manifest.' + randomUUID() + '.tmp');
  fs.writeFileSync(temp, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  try {
    fs.renameSync(temp, path.join(dir, 'manifest.json'));
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
  library.cacheStamp = null;
  return { ok: true, id: song.id, stage, status: manifest.songs[song.id].status };
}
async function handleGameAudioUpload(
  req,
  res,
  { auth, gameAudio, fullAudio, url, expectedOrigin },
) {
  const user = auth.requireUser(req);
  if (user.role !== 'admin')
    throw new HttpError(403, 'ADMIN_REQUIRED', '只有管理者可以上傳遊戲音檔');
  let origin;
  try {
    origin = req.headers.origin ? new URL(req.headers.origin).origin : null;
  } catch {
    throw new HttpError(403, 'CROSS_ORIGIN', '不允許跨站請求');
  }
  if (
    (origin && origin !== expectedOrigin) ||
    (req.headers['sec-fetch-site'] &&
      !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))
  )
    throw new HttpError(403, 'CROSS_ORIGIN', '不允許跨站請求');
  if (
    url.pathname.startsWith('/api/admin/game-audio/') &&
    url.pathname !== '/api/admin/game-audio/upload'
  ) {
    if (!fullAudio) throw new HttpError(503, 'CONVERTER_UNAVAILABLE', '完整音檔處理尚未設定');
    const route = url.pathname.slice('/api/admin/game-audio/'.length),
      send = (value) => res.end(JSON.stringify(value));
    if (route === 'draft' && req.method === 'GET')
      return send(fullAudio.view(fullAudio.load(url.searchParams.get('draftId'), user.id)));
    if (route === 'preview' && ['GET', 'HEAD'].includes(req.method))
      return fullAudio.preview(req, res, url.searchParams, user.id);
    const controller = new AbortController(),
      cancel = () => {
        if (!res.writableEnded) controller.abort();
      };
    res.on('close', cancel);
    try {
      if (route === 'full' && req.method === 'POST')
        return send(await fullAudio.upload(req, user.id, controller.signal));
      if (['reclip', 'publish', 'discard'].includes(route) && req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json'))
          throw new HttpError(400, 'INVALID_REQUEST', '需要JSON');
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 8192) throw new HttpError(413, 'REQUEST_TOO_LARGE', '請求過大');
          chunks.push(chunk);
        }
        let data;
        try {
          data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          throw new HttpError(400, 'INVALID_REQUEST', 'JSON格式不正確');
        }
        if (!data || typeof data !== 'object' || Array.isArray(data))
          throw new HttpError(400, 'INVALID_REQUEST', '請求格式不正確');
        return send(
          route === 'reclip'
            ? await fullAudio.reclip(data, user.id, controller.signal)
            : route === 'publish'
              ? fullAudio.publish(data, user.id)
              : fullAudio.discard(data, user.id),
        );
      }
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
    } finally {
      res.off('close', cancel);
    }
  }
  if (url.pathname === '/api/admin/game-audio' && req.method === 'GET') {
    const songs = read(gameAudio.directory).songs;
    res.end(
      JSON.stringify({
        pendingDrafts: fullAudio ? fullAudio.list(user.id) : [],
        fullAudio: {
          available: fullAudio ? await fullAudio.available() : false,
          busy: fullAudio?.busy || false,
          maxBytes: 100 * 1024 * 1024,
        },
        banks: BANKS.filter((b) => b.id !== 'custom'),
        songs: CATALOG.map((s) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          bank: s.bank,
          status: songs[s.id]?.status || 'missing',
          fullSourceId: songs[s.id]?.fullSourceId || null,
        })),
      }),
    );
    return;
  }
  if (url.pathname !== '/api/admin/game-audio/upload' || req.method !== 'POST')
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
  if (
    !['audio/mpeg', 'application/octet-stream'].includes(req.headers['content-type']?.split(';')[0])
  )
    throw new HttpError(400, 'INVALID_AUDIO', '請選擇MP3片段');
  if (Number(req.headers['content-length']) > MAX)
    throw new HttpError(413, 'AUDIO_TOO_LARGE', '每個片段最多2MB');
  let count = 0;
  const chunks = [];
  for await (const c of req) {
    count += c.length;
    if (count > MAX) throw new HttpError(413, 'AUDIO_TOO_LARGE', '每個片段最多2MB');
    chunks.push(c);
  }
  res.end(
    JSON.stringify(
      store(
        gameAudio,
        req.headers['x-song-id'],
        req.headers['x-audio-stage'],
        Buffer.concat(chunks),
      ),
    ),
  );
}
module.exports = { handleGameAudioUpload, store, duration };
