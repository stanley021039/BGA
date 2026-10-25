'use strict';
const { createHash } = require('node:crypto');

// Pushes each seated player's own room view when it changes, so everyone at a
// table sees a move at the same moment instead of on their next poll.
//
// Changes are announced with notify(room): the app calls it after every room
// request and every timed or bot transition. A slow sweep also re-checks every
// watched room, which catches changes no caller announced (presence, expiring
// emoji). A view is only sent when it differs from the last one that player
// received, ignoring the server clock.
//
// An open stream counts as the player being present: polling used to refresh
// the seat on every read, so the sweep does it through onAlive instead.
const withoutClock = (key, value) => (key === 'serverNow' ? undefined : value);
// Identifies a view's content for polling clients (`/api/state?since=`).
function stateTag(view) {
  return createHash('sha1')
    .update(JSON.stringify(view, withoutClock))
    .digest('base64url')
    .slice(0, 16);
}

function createStateStream({
  project,
  valid = () => true,
  onFlush = () => {},
  onAlive = () => {},
  onHeartbeat = () => {},
  sweepMs = 1000,
  heartbeatMs = 15000,
  roomLimit = 64,
  userLimit = 3,
}) {
  const rooms = new Map(),
    pending = new Map();
  let scheduled = false,
    closed = false;
  const event = (kind, data) => 'event: ' + kind + '\ndata: ' + data + '\n\n';

  function write(entry, text) {
    if (entry.closed) return false;
    try {
      // A client that cannot keep up reconnects and receives a fresh view.
      if (entry.res.write(text)) return true;
    } catch {
      /* The connection is already gone. */
    }
    entry.close();
    return false;
  }
  function send(entry) {
    if (!valid(entry)) return entry.close();
    let view;
    try {
      view = project(entry.room, entry.playerId);
    } catch {
      return entry.close();
    }
    const tag = stateTag(view);
    if (tag === entry.tag) return;
    if (write(entry, event('state', JSON.stringify({ ...view, stateTag: tag })))) entry.tag = tag;
  }
  function flush() {
    scheduled = false;
    const batch = [...pending.values()];
    pending.clear();
    for (const room of batch) {
      try {
        onFlush(room);
      } catch (error) {
        console.error(error);
      }
      for (const entry of [...(rooms.get(room.code) || [])]) if (entry.room === room) send(entry);
    }
  }
  function notify(room) {
    if (
      closed ||
      !room?.code ||
      ![...(rooms.get(room.code) || [])].some((entry) => entry.room === room)
    )
      return;
    pending.set(room.code, room);
    if (!scheduled) {
      scheduled = true;
      setImmediate(flush);
    }
  }
  // Timers run only while someone is connected.
  let sweep = null,
    heartbeat = null;
  function startTimers() {
    if (sweep) return;
    sweep = setInterval(sweepRooms, sweepMs);
    sweep.unref();
    heartbeat = setInterval(beat, heartbeatMs);
    heartbeat.unref();
  }
  function stopTimers() {
    clearInterval(sweep);
    clearInterval(heartbeat);
    sweep = heartbeat = null;
  }
  function sweepRooms() {
    for (const set of [...rooms.values()]) {
      let room = null;
      for (const entry of [...set]) {
        if (!valid(entry)) {
          entry.close();
          continue;
        }
        room = entry.room;
        try {
          onAlive(entry);
        } catch {
          entry.close();
        }
      }
      if (room) notify(room);
    }
  }
  function beat() {
    for (const set of [...rooms.values()])
      for (const entry of [...set]) {
        if (!valid(entry)) entry.close();
        else if (write(entry, ': heartbeat\n\n')) onHeartbeat(entry);
      }
  }

  function subscribe(room, { req, res, user, playerId }) {
    if (closed) return null;
    const set = rooms.get(room.code) || new Set();
    if (set.size >= roomLimit || [...set].filter((e) => e.userId === user.id).length >= userLimit)
      return null;
    const entry = {
      room,
      req,
      res,
      user,
      userId: user.id,
      playerId,
      tag: null,
      closed: false,
      close() {
        if (entry.closed) return;
        entry.closed = true;
        req.off('close', entry.close);
        set.delete(entry);
        if (!set.size && rooms.get(room.code) === set) rooms.delete(room.code);
        if (!rooms.size) stopTimers();
        try {
          res.end();
        } catch {
          /* Already closed. */
        }
      },
    };
    set.add(entry);
    rooms.set(room.code, set);
    startTimers();
    req.once('close', entry.close);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    // Asks the browser to wait a moment before reconnecting.
    write(entry, 'retry: 2000\n\n');
    send(entry);
    return entry;
  }
  // Small signals (new chat message, new invitation) that tell a page to read
  // that resource now instead of on its next slow poll.
  function hint(code, kind) {
    for (const entry of [...(rooms.get(code) || [])]) write(entry, event(kind, '{}'));
  }
  function hintUser(userId, kind) {
    for (const set of [...rooms.values()])
      for (const entry of [...set]) if (entry.userId === userId) write(entry, event(kind, '{}'));
  }
  const watched = (code) => !!rooms.get(code)?.size;
  function closeRoom(code) {
    for (const entry of [...(rooms.get(code) || [])]) entry.close();
    rooms.delete(code);
    pending.delete(code);
  }
  function close() {
    closed = true;
    for (const code of [...rooms.keys()]) closeRoom(code);
    stopTimers();
  }
  function rebind(previous, next) {
    if (previous.code !== next.code) throw Error('Cannot rebind another room');
    pending.delete(previous.code);
    for (const entry of rooms.get(previous.code) || [])
      if (entry.room === previous) {
        entry.room = next;
        entry.tag = null;
      }
    notify(next);
  }
  return { subscribe, notify, hint, hintUser, watched, closeRoom, close, rebind };
}

module.exports = { createStateStream, stateTag };
