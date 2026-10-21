'use strict';
// Ignore isolated clicks: sound must occupy at least 200ms of a 300ms window.
// Keep 200ms before the first audible block so the opening is not cut off.
function findIntroStart(pcm, { rate = 4000, channels = 1 } = {}) {
  const frames = pcm.length / (4 * channels),
    block = Math.round(rate * 0.02),
    energies = [];
  if (!Number.isInteger(frames) || !frames) throw Error('音訊取樣不正確');
  for (let start = 0; start < frames; start += block) {
    let sum = 0;
    const n = Math.min(block, frames - start);
    for (let i = 0; i < n * channels; i++) {
      const x = pcm.readFloatLE((start * channels + i) * 4);
      if (!Number.isFinite(x)) throw Error('音訊取樣不正確');
      sum += x * x;
    }
    energies.push(Math.sqrt(sum / (n * channels)));
  }
  const peak = energies.reduce((max, x) => Math.max(max, x), 0),
    threshold = Math.max(10 ** (-50 / 20), peak * 0.025);
  for (let i = 0; i < energies.length; i++) {
    const window = energies.slice(i, i + 15),
      active = window.filter((x) => x > threshold);
    if (active.length >= 10) {
      const first = i + window.findIndex((x) => x > threshold);
      return Math.max(0, Math.floor((first * 0.02 - 0.2) * 100 + 1e-6) / 100);
    }
  }
  return null;
}
module.exports = { findIntroStart };
