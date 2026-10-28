import BarrageFrames from './barrage-frames.js';
import GameUI from './ui-widgets.js';
let MediaAppearance;
/* Personal player appearance shares the barrage catalogue, never its preference. */
(() => {
  'use strict';
  const key = 'bga.media.frame.v1',
    listeners = new Set();
  let selected = 'default',
    picker = null,
    trigger = null,
    catalogue = '';
  function options() {
    return BarrageFrames?.options || [{ id: 'default', label: '預設' }];
  }
  function read() {
    try {
      return localStorage.getItem(key) || 'default';
    } catch {
      return 'default';
    }
  }
  function get() {
    return options().some((option) => option.id === selected) &&
      BarrageFrames?.canUse?.(selected, 'media') !== false
      ? selected
      : 'default';
  }
  function notify() {
    for (const listener of listeners) listener(get());
  }
  function set(id) {
    if (BarrageFrames?.canUse?.(id, 'media') === false) return get();
    selected = options().some((option) => option.id === id) ? id : 'default';
    try {
      localStorage.setItem(key, selected);
    } catch {}
    notify();
    return get();
  }
  function subscribe(listener) {
    listeners.add(listener);
    listener(get());
    return () => listeners.delete(listener);
  }
  selected = read();
  window.addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) {
      selected = read();
      notify();
    }
  });
  function createPicker() {
    picker = document.createElement('dialog');
    picker.id = 'mediaFramePicker';
    picker.className = 'ui-dialog media-frame-picker';
    picker.setAttribute('aria-labelledby', 'mediaFrameTitle');
    const header = document.createElement('header'),
      title = document.createElement('h2'),
      close = document.createElement('button'),
      note = document.createElement('p'),
      grid = document.createElement('div');
    title.id = 'mediaFrameTitle';
    title.textContent = '播放器外觀';
    close.id = 'mediaFrameClose';
    close.type = 'button';
    close.textContent = '關閉';
    GameUI?.decorateButton(close, 'close', { iconOnly: true, label: '關閉播放器外觀選擇' });
    close.onclick = () => picker.close();
    header.append(title, close);
    note.textContent = '預覽播放器外觀，選擇喜歡的框飾。';
    grid.className = 'barrage-frame-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', '播放器外觀');
    picker.append(header, note, grid);
    document.body.append(picker);
    picker.addEventListener('close', () => trigger?.focus());
    subscribe(() => syncChoices());
  }
  function syncChoices() {
    if (!picker) return;
    for (const button of picker.querySelectorAll('[data-media-frame-choice]')) {
      const locked = BarrageFrames?.canUse?.(button.dataset.mediaFrameChoice, 'media') === false;
      button.classList.toggle('reward-locked', locked);
      button.setAttribute('aria-pressed', String(button.dataset.mediaFrameChoice === get()));
    }
  }
  function openPicker(source) {
    trigger = source;
    if (!picker) createPicker();
    const signature = JSON.stringify(options());
    if (signature !== catalogue) {
      catalogue = signature;
      const grid = picker.querySelector('.barrage-frame-grid');
      grid.replaceChildren();
      for (const option of options()) {
        const choice = document.createElement('button'),
          label = document.createElement('span'),
          preview = document.createElement('span');
        choice.type = 'button';
        choice.className = 'barrage-frame-choice';
        choice.dataset.mediaFrameChoice = option.id;
        choice.setAttribute('aria-label', option.label + '播放器風格');
        label.textContent = option.label;
        preview.className = 'barrage-frame-preview';
        preview.setAttribute('aria-hidden', 'true');
        BarrageFrames?.decorate?.(
          preview,
          { kind: 'builtin', id: option.id, version: 1 },
          '播放器',
          '我的風格',
        );
        choice.append(label, preview);
        if (option.achievementId) {
          const hint = document.createElement('small');
          hint.textContent = '成就獎勵 · ' + option.achievementTitle;
          choice.append(hint);
        }
        choice.onclick = () => {
          if (BarrageFrames?.canUse?.(option.id, 'media') === false) {
            location.href = '/achievements';
            return;
          }
          set(option.id);
          picker.close();
        };
        grid.append(choice);
      }
    }
    syncChoices();
    if (!picker.open) picker.showModal();
    picker.querySelector('[aria-pressed="true"]')?.focus();
    return picker;
  }
  BarrageFrames?.subscribe?.(() => {
    notify();
    syncChoices();
  });
  MediaAppearance = {
    get,
    set,
    subscribe,
    openPicker,
    closePicker() {
      if (picker?.open) picker.close();
    },
  };
})();

export default MediaAppearance;
