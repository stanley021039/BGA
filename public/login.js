const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const resetToken = params.get('reset');
const next = params.get('next');
const returnTo =
  /^\/(?:poker|race|majority|gift)\/[A-Fa-f0-9]{6}\/?$/.test(next || '') || next === '/market'
    ? next
    : '/';
const forms = { login: $('#loginForm'), register: $('#registerForm'), reset: $('#resetForm') };
const artwork = $('#authArtwork');
function showArtwork(value) {
  const image = artwork.querySelector('img');
  artwork.hidden = value === 'reset';
  if (value === 'reset') return;
  if (image.dataset.mode === value) return;
  const caption = value === 'register' ? '又來了一個新人' : '歡迎來到 Ave Mujica 的世界';
  const widths = value === 'register' ? [320, 480, 576] : [320, 480, 576, 864];
  image.alt = caption;
  image.sizes =
    '(max-width: 760px) min(92vw, 576px), (max-width: 1000px) calc(92vw - 499px), min(calc(85vw - 479px), 576px)';
  image.srcset = widths.map((width) => `/assets/auth/${value}-${width}.webp ${width}w`).join(', ');
  image.src = `/assets/auth/${value}-320.webp`;
  image.dataset.mode = value;
}
function mode(value) {
  showArtwork(value);
  for (const [name, form] of Object.entries(forms)) form.hidden = name !== value;
  for (const tab of document.querySelectorAll('[data-mode]'))
    tab.setAttribute('aria-selected', String(tab.dataset.mode === value));
  $('.auth-tabs').hidden = value === 'reset';
  const copy = {
    login: ['歡迎回來', '登入帳號，今晚繼續開桌。'],
    register: ['加入這一桌', '有邀請碼嗎？建立帳號就能和朋友一起玩。'],
    reset: ['設定新密碼', '為你的帳號換一把新鑰匙。'],
  };
  $('#authTitle').textContent = copy[value][0];
  $('#authIntro').textContent = copy[value][1];
  $('#message').textContent = '';
}
for (const tab of document.querySelectorAll('[data-mode]'))
  tab.onclick = () => mode(tab.dataset.mode);
if (params.get('invite')) forms.register.elements.invite.value = params.get('invite');
mode(
  resetToken
    ? 'reset'
    : params.get('invite') || params.get('mode') === 'register'
      ? 'register'
      : 'login',
);
async function send(route, payload) {
  const res = await fetch('/api/auth/' + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error);
  return data;
}
for (const [name, form] of Object.entries(forms))
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      if (name !== 'login' && values.password !== values.confirmPassword)
        throw Error('兩次密碼輸入不一致');
      if (name === 'reset') values.token = resetToken;
      if (name !== 'reset') window.EntryIntro?.prepareSound?.();
      await send(name, values);
      if (name === 'reset') {
        history.replaceState(null, '', '/login');
        mode('login');
        $('#message').textContent = '密碼已更新，請重新登入。';
      } else {
        await window.EntryIntro?.playFrom(artwork.querySelector('img'), returnTo);
        location.replace(returnTo);
      }
    } catch (error) {
      $('#message').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
