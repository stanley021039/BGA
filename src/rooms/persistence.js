'use strict';
const fs = require('node:fs');
const v8 = require('node:v8');

// Keeps open rooms across a restart or deploy (#235).
//
// A room is a class instance whose methods are wrapped per instance
// (achievements) and whose providers close over app stores, so it cannot be
// serialized as is. Instead its own data is captured without functions, and a
// restore builds a fresh room through the same setup as a new one and lays the
// saved data back over it. References to the room itself inside its data are
// re-pointed at the new room.
const SCHEMA = 1,
  ROOM_REF = '$bgaRoomRef';

const isFunction = (value) => typeof value === 'function' || typeof value === 'symbol';
const special = (value) =>
  value instanceof Date || value instanceof RegExp || ArrayBuffer.isView(value);

// `lost` collects the paths of callbacks dropped from the value, when given.
function capture(value, room, seen = new Map(), lost = null, at = '') {
  if (value === room) return { [ROOM_REF]: true };
  if (isFunction(value)) {
    lost?.push(at);
    return undefined;
  }
  if (value === null || typeof value !== 'object' || special(value)) return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Map) {
    const out = new Map();
    seen.set(value, out);
    for (const [key, item] of value) {
      const saved = capture(item, room, seen, lost, at + '.' + String(key));
      if (saved !== undefined) out.set(capture(key, room, seen), saved);
    }
    return out;
  }
  if (value instanceof Set) {
    const out = new Set();
    seen.set(value, out);
    for (const item of value) {
      const saved = capture(item, room, seen, lost, at + '[]');
      if (saved !== undefined) out.add(saved);
    }
    return out;
  }
  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    value.forEach((item, index) =>
      out.push(capture(item, room, seen, lost, at + '[' + index + ']')),
    );
    return out;
  }
  const out = {};
  seen.set(value, out);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!('value' in descriptor)) continue;
    const saved = capture(descriptor.value, room, seen, lost, at + '.' + key);
    if (saved !== undefined) out[key] = saved;
  }
  return out;
}

function revive(value, room, seen = new Set()) {
  if (value === null || typeof value !== 'object' || special(value)) return value;
  if (value[ROOM_REF] === true) return room;
  if (seen.has(value)) return value;
  seen.add(value);
  if (value instanceof Map) {
    const entries = [...value].map(([key, item]) => [
      revive(key, room, seen),
      revive(item, room, seen),
    ]);
    value.clear();
    for (const [key, item] of entries) value.set(key, item);
  } else if (value instanceof Set) {
    const items = [...value].map((item) => revive(item, room, seen));
    value.clear();
    for (const item of items) value.add(item);
  } else for (const key of Object.keys(value)) value[key] = revive(value[key], room, seen);
  return value;
}

const plainProto = (value) => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
// Copies saved data into an object the fresh room already owns, keeping its
// prototype (e.g. an achievements tracker class) and any methods on it.
function fill(target, source) {
  if (Object.isFrozen(target)) return;
  if (target instanceof Map && source instanceof Map) {
    target.clear();
    for (const [key, item] of source) target.set(key, item);
    return;
  }
  if (target instanceof Set && source instanceof Set) {
    target.clear();
    for (const item of source) target.add(item);
    return;
  }
  if (Array.isArray(target) && Array.isArray(source)) {
    target.length = 0;
    target.push(...source);
    return;
  }
  if (!source || typeof source !== 'object') return;
  for (const key of Object.keys(source)) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor && (!('value' in descriptor) || isFunction(descriptor.value))) continue;
    if (descriptor && !descriptor.writable) {
      if (descriptor.value && typeof descriptor.value === 'object')
        fill(descriptor.value, source[key]);
      continue;
    }
    target[key] = source[key];
  }
}

function apply(room, data) {
  for (const [key, { value, enumerable }] of data) {
    const fresh = Object.getOwnPropertyDescriptor(room, key);
    if (fresh && (!('value' in fresh) || isFunction(fresh.value))) continue;
    const current = fresh?.value,
      builtin = Array.isArray(current) || current instanceof Map || current instanceof Set;
    // Fill what cannot be replaced, and class instances (to keep their methods);
    // writable arrays, maps and sets are simply replaced.
    if (
      current &&
      typeof current === 'object' &&
      (!fresh.writable || (!builtin && !plainProto(current)))
    ) {
      fill(current, value);
      continue;
    }
    if (fresh && !fresh.configurable) {
      if (fresh.writable) room[key] = value;
      continue;
    }
    Object.defineProperty(room, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: fresh ? fresh.enumerable : enumerable,
    });
  }
}

// Everything worth keeping about one room, without functions. A callback inside
// the game state (an enumerable field, e.g. a pending dice effect) cannot be
// restored, so it is listed in `callbacks` and the caller must not save the room.
// Methods on the room and its non-enumerable wiring (providers, trackers,
// recorders) are rebuilt on restore and are not reported.
function captureRoom(room, extra = {}) {
  const data = new Map(),
    callbacks = [];
  for (const key of Object.getOwnPropertyNames(room)) {
    const descriptor = Object.getOwnPropertyDescriptor(room, key);
    if (!('value' in descriptor)) continue;
    const lost = descriptor.enumerable && !isFunction(descriptor.value) ? callbacks : null;
    const value = capture(descriptor.value, room, new Map(), lost, key);
    if (value !== undefined) data.set(key, { value, enumerable: descriptor.enumerable });
  }
  return {
    type: room.type || 'poker',
    code: room.code,
    name: room.name,
    callbacks,
    data,
    extra: capture(extra, room),
  };
}

// Builds the room with `build(saved)` (fresh instance, providers and
// recorders attached), then restores its data. Returns the room and its
// revived extra data.
function restoreRoom(saved, build) {
  const room = build(saved);
  const revivedData = new Map(
    [...saved.data].map(([key, entry]) => [key, { ...entry, value: revive(entry.value, room) }]),
  );
  apply(room, revivedData);
  return { room, extra: revive(saved.extra, room) };
}

function save(file, snapshot) {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, v8.serialize({ schema: SCHEMA, savedAt: Date.now(), ...snapshot }), {
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
}

// Reads and removes the snapshot, so a crash during restore cannot loop.
function load(file) {
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  fs.rmSync(file, { force: true });
  const snapshot = v8.deserialize(bytes);
  return snapshot?.schema === SCHEMA ? snapshot : null;
}

module.exports = { captureRoom, restoreRoom, fill, save, load };
