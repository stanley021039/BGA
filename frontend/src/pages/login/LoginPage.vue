<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue';
import type { AuthMode } from '../../contracts/auth';
import { useSessionStore } from '../../stores/session';
import { loginDestination } from '../../services/navigation';
import StatusSlot from '../../components/StatusSlot.vue';
import UiButton from '../../components/UiButton.vue';

const session = useSessionStore();
const params = new URLSearchParams(location.search);
let resetToken = params.get('reset') || '';
const destination = loginDestination(params.get('next'));
const mode = ref<AuthMode>(
  resetToken
    ? 'reset'
    : params.get('invite') || params.get('mode') === 'register'
      ? 'register'
      : 'login',
);
const login = reactive({ username: '', password: '' });
const registration = reactive({
  invite: params.get('invite') || '',
  displayName: '',
  username: '',
  password: '',
  confirmPassword: '',
});
const reset = reactive({ password: '', confirmPassword: '' });
const message = ref('');
const hasError = ref(false);
let disposed = false;
const copy = computed(
  () =>
    ({
      login: ['歡迎回來', '登入帳號，今晚繼續開桌。'],
      register: ['加入這一桌', '有邀請碼嗎？建立帳號就能和朋友一起玩。'],
      reset: ['設定新密碼', '為你的帳號換一把新鑰匙。'],
    })[mode.value],
);
const submitLabel = computed(
  () => ({ login: '進入俱樂部', register: '建立帳號', reset: '重設密碼' })[mode.value],
);
const artwork = computed(() => {
  const kind = mode.value === 'register' ? 'register' : 'login';
  const widths = kind === 'register' ? [320, 480, 576] : [320, 480, 576, 864];
  return {
    alt: kind === 'register' ? '又來了一個新人' : '歡迎來到 Ave Mujica 的世界',
    src: `/assets/auth/${kind}-320.webp`,
    srcset: widths.map((width) => `/assets/auth/${kind}-${width}.webp ${width}w`).join(', '),
    sizes:
      '(max-width: 760px) min(92vw, 576px), (max-width: 1000px) calc(92vw - 499px), min(calc(85vw - 479px), 576px)',
  };
});
function selectMode(value: 'login' | 'register'): void {
  if (session.pending) return;
  mode.value = value;
  message.value = '';
  hasError.value = false;
}
async function tabKey(event: KeyboardEvent): Promise<void> {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || session.pending) return;
  event.preventDefault();
  selectMode(
    event.key === 'Home'
      ? 'login'
      : event.key === 'End'
        ? 'register'
        : mode.value === 'login'
          ? 'register'
          : 'login',
  );
  await nextTick();
  document.getElementById(`tab-${mode.value}`)?.focus();
}
async function submit(): Promise<void> {
  if (session.pending) return;
  message.value = '';
  hasError.value = false;
  try {
    if (mode.value === 'reset') {
      if (reset.password !== reset.confirmPassword) throw new Error('兩次密碼輸入不一致');
      await session.resetPassword({ ...reset, token: resetToken });
      if (disposed) return;
      reset.password = reset.confirmPassword = resetToken = '';
      history.replaceState(null, '', '/login');
      mode.value = 'login';
      message.value = '密碼已更新，請重新登入。';
      await nextTick();
      document.querySelector<HTMLInputElement>('#loginForm input')?.focus();
    } else {
      if (mode.value === 'register' && registration.password !== registration.confirmPassword)
        throw new Error('兩次密碼輸入不一致');
      await session.authenticate(
        mode.value,
        mode.value === 'login' ? { ...login } : { ...registration },
      );
      if (disposed) return;
      login.password = registration.password = registration.confirmPassword = '';
      await window.EntryIntro?.playFrom(
        document.querySelector<HTMLImageElement>('#authArtwork img'),
        destination,
      );
      if (disposed) return;
      location.replace(destination);
    }
  } catch (error) {
    if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return;
    hasError.value = true;
    message.value = error instanceof Error ? error.message : '無法完成帳號操作，請稍後重試';
  }
}
onBeforeUnmount(() => {
  disposed = true;
  session.dispose();
  login.password =
    registration.password =
    registration.confirmPassword =
    reset.password =
    reset.confirmPassword =
      '';
});
</script>

<template>
  <section class="auth-story" aria-label="歡迎圖片與製作團隊">
    <figure id="authArtwork" class="auth-artwork" :hidden="mode === 'reset'"
      ><img
        width="576"
        height="324"
        decoding="async"
        :alt="artwork.alt"
        :src="artwork.src"
        :srcset="artwork.srcset"
        :sizes="artwork.sizes"
    /></figure>
    <footer class="auth-credits" aria-label="網站製作團隊">
      <p>powered by</p>
      <div class="auth-credit-list">
        <a href="https://github.com/stanley021039"
          ><span>stanley021039</span
          ><img
            src="/assets/auth/stanley021039-88.webp"
            srcset="
              /assets/auth/stanley021039-64.webp   64w,
              /assets/auth/stanley021039-88.webp   88w,
              /assets/auth/stanley021039-176.webp 176w
            "
            sizes="(max-width: 520px) 64px, (min-width: 761px) and (max-width: 1100px) 64px, 88px"
            width="88"
            height="88"
            loading="lazy"
            decoding="async"
            alt=""
        /></a>
        <a href="https://github.com/x55662306"
          ><span>x55662306</span
          ><img
            src="/assets/auth/x55662306-88.webp"
            srcset="
              /assets/auth/x55662306-64.webp   64w,
              /assets/auth/x55662306-88.webp   88w,
              /assets/auth/x55662306-176.webp 176w
            "
            sizes="(max-width: 520px) 64px, (min-width: 761px) and (max-width: 1100px) 64px, 88px"
            width="88"
            height="88"
            loading="lazy"
            decoding="async"
            alt=""
        /></a>
        <a href="https://github.com/disasterazrael04"
          ><span>azrael04</span
          ><img
            src="/assets/auth/azrael04-88.webp"
            srcset="
              /assets/auth/azrael04-64.webp   64w,
              /assets/auth/azrael04-88.webp   88w,
              /assets/auth/azrael04-176.webp 176w
            "
            sizes="(max-width: 520px) 64px, (min-width: 761px) and (max-width: 1100px) 64px, 88px"
            width="88"
            height="88"
            loading="lazy"
            decoding="async"
            alt=""
        /></a>
      </div>
    </footer>
  </section>
  <section class="auth-card" aria-label="會員登入與註冊">
    <h2 id="authTitle">{{ copy[0] }}</h2>
    <p id="authIntro" class="card-intro">{{ copy[1] }}</p>
    <div class="auth-tabs" role="tablist" aria-label="帳號操作" :hidden="mode === 'reset'">
      <UiButton
        :variant="mode === 'login' ? 'primary' : 'secondary'"
        label="登入"
        id="tab-login"
        type="button"
        data-mode="login"
        role="tab"
        :aria-selected="mode === 'login'"
        aria-controls="loginForm"
        :tabindex="mode === 'login' ? 0 : -1"
        :disabled="session.pending"
        @click="selectMode('login')"
        @keydown="tabKey"
      />
      <UiButton
        :variant="mode === 'register' ? 'primary' : 'secondary'"
        label="邀請碼註冊"
        id="tab-register"
        type="button"
        data-mode="register"
        role="tab"
        :aria-selected="mode === 'register'"
        aria-controls="registerForm"
        :tabindex="mode === 'register' ? 0 : -1"
        :disabled="session.pending"
        @click="selectMode('register')"
        @keydown="tabKey"
      />
    </div>
    <form
      id="loginForm"
      class="auth-form"
      :hidden="mode !== 'login'"
      @submit.prevent="submit"
      :aria-busy="session.pending"
      aria-describedby="message"
    >
      <label
        >帳號<input
          v-model="login.username"
          name="username"
          autocomplete="username"
          placeholder="輸入你的帳號"
          required
      /></label>
      <label
        >密碼<input
          v-model="login.password"
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="輸入密碼"
          required
      /></label>
    </form>
    <form
      id="registerForm"
      class="auth-form"
      :hidden="mode !== 'register'"
      @submit.prevent="submit"
      :aria-busy="session.pending"
      aria-describedby="message"
    >
      <label
        >邀請碼<input
          v-model="registration.invite"
          name="invite"
          placeholder="輸入朋友給你的邀請碼"
          required
      /></label>
      <label
        >顯示暱稱<input
          v-model="registration.displayName"
          name="displayName"
          maxlength="16"
          placeholder="朋友怎麼稱呼你？"
          required
      /></label>
      <label
        >帳號<input
          v-model="registration.username"
          name="username"
          pattern="[A-Za-z0-9_]{3,24}"
          autocomplete="username"
          placeholder="3–24 個英數字或底線"
          required
      /></label>
      <label
        >密碼（至少 8 字）<input
          v-model="registration.password"
          name="password"
          type="password"
          minlength="8"
          autocomplete="new-password"
          placeholder="設定登入密碼"
          required
      /></label>
      <label
        >確認密碼<input
          v-model="registration.confirmPassword"
          name="confirmPassword"
          type="password"
          minlength="8"
          autocomplete="new-password"
          placeholder="再次輸入密碼"
          required
      /></label>
    </form>
    <form
      id="resetForm"
      class="auth-form"
      :hidden="mode !== 'reset'"
      @submit.prevent="submit"
      :aria-busy="session.pending"
      aria-describedby="message"
    >
      <p class="form-note">透過管理者提供的一次性連結設定新密碼。</p>
      <label
        >新密碼（至少 8 字）<input
          v-model="reset.password"
          name="password"
          type="password"
          minlength="8"
          autocomplete="new-password"
          placeholder="設定新密碼"
          required
      /></label>
      <label
        >確認新密碼<input
          v-model="reset.confirmPassword"
          name="confirmPassword"
          type="password"
          minlength="8"
          autocomplete="new-password"
          placeholder="再次輸入新密碼"
          required
      /></label>
    </form>
    <UiButton
      variant="primary"
      type="submit"
      class="frontend-submit"
      icon="next"
      :pending="session.pending"
      :form="mode + 'Form'"
      :label="submitLabel"
    /><StatusSlot id="message" :message="message" :error="hasError" />
  </section>
</template>
