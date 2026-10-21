(() => {
  'use strict';
  const clips = [...document.querySelectorAll('audio')],
    cards = [...document.querySelectorAll('article')],
    count = document.querySelector('#count');
  for (const audio of clips)
    audio.addEventListener('play', () => {
      for (const other of clips) if (other !== audio) other.pause();
    });
  document.querySelector('#stop').onclick = () => clips.forEach((a) => a.pause());
  const filter = () => {
    const q = document.querySelector('#search').value.trim().toLowerCase();
    for (const card of cards) card.hidden = !card.textContent.toLowerCase().includes(q);
    count.textContent = cards.filter((c) => !c.hidden).length + ' 個音檔';
  };
  document.querySelector('#search').addEventListener('input', filter);
  filter();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clips.forEach((a) => a.pause());
  });
})();
