import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import type { ComputedRef } from 'vue';
import type { Character } from '../contracts/profile';
import { useRequests } from './requests';

export function useExpressionSound(
  target: ComputedRef<{ character: Character | undefined; expression: string }>,
  reload: () => Promise<boolean>,
) {
  const requests = useRequests(),
    pending = ref(false),
    message = ref(''),
    failed = ref(false);
  const file = shallowRef<File | null>(null),
    input = ref<HTMLInputElement | null>(null);
  const key = computed(() => `${target.value.character?.id || ''}:${target.value.expression}`);
  const sound = computed(() => target.value.character?.sounds[target.value.expression]);
  const editable = computed(
    () =>
      !!target.value.character?.owned &&
      target.value.character.id.startsWith('user:') &&
      target.value.expression !== 'neutral' &&
      !!target.value.character.expressions[target.value.expression],
  );
  let generation = 0,
    previewRequest = 0,
    clip: HTMLAudioElement | undefined;
  function stop() {
    window.AudioSettings?.stopEffect(clip);
    clip = undefined;
  }
  function reset() {
    generation++;
    previewRequest++;
    stop();
    pending.value = false;
    file.value = null;
    message.value = '';
    failed.value = false;
    if (input.value) input.value.value = '';
  }
  watch(key, reset);
  function choose(value: File | null) {
    file.value = value;
    failed.value = false;
    message.value = value ? `已選取：${value.name}` : '尚未選取音檔';
  }
  async function mutate(remove: boolean): Promise<boolean> {
    if (pending.value || !editable.value || (remove && !sound.value)) return false;
    const character = target.value.character!,
      expression = target.value.expression,
      targetKey = key.value,
      epoch = ++generation;
    const current = () => requests.active() && generation === epoch && key.value === targetKey;
    pending.value = true;
    failed.value = false;
    message.value = remove ? '正在移除音效…' : '正在讀取及轉換音檔…';
    if (remove) stop();
    try {
      let body: { base64?: string } = {};
      if (!remove) {
        if (!window.ExpressionSounds) throw Error('此瀏覽器暫時無法匯入音效');
        const encoded = await window.ExpressionSounds.encodeFile(file.value);
        if (!current()) return false;
        body = { base64: encoded.base64 };
        message.value = '正在上傳音效…';
      }
      await requests.request(
        `/api/profile/characters/${encodeURIComponent(character.id.slice(5))}/expressions/${encodeURIComponent(expression)}/sound${remove ? '/remove' : ''}`,
        body,
      );
      const loaded = await reload();
      if (current()) {
        file.value = null;
        if (input.value) input.value.value = '';
        message.value =
          (remove ? '表情音效已移除。' : '表情音效已保存。') +
          (loaded ? '' : '圖庫暫時無法更新，請重新載入。');
      }
      return true;
    } catch (error) {
      if (current()) {
        failed.value = true;
        message.value = error instanceof Error ? error.message : '音效無法保存，請重試';
      }
      return false;
    } finally {
      if (current()) pending.value = false;
    }
  }
  function preview() {
    if (pending.value || !sound.value) return;
    const epoch = generation,
      targetKey = key.value,
      request = ++previewRequest;
    const current = () =>
      requests.active() &&
      generation === epoch &&
      key.value === targetKey &&
      request === previewRequest;
    stop();
    window.AudioSettings?.set('effects', { enabled: true }, { gesture: true });
    let errored = false;
    failed.value = false;
    message.value = '正在試聽音效。';
    clip = window.AudioSettings?.playExpression(sound.value, {
      onStop: (value) => {
        if (current() && value === clip) {
          clip = undefined;
          message.value = '試聽已停止。';
        }
      },
      onError: () => {
        if (current()) {
          errored = true;
          failed.value = true;
          message.value = '瀏覽器無法播放這段音效，請重試或重新上傳。';
        }
      },
    });
    if (!clip && !errored) message.value = '請在右上角設定調高音效音量，再試聽。';
  }
  const visibility = () => {
    if (document.hidden) stop();
  };
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => {
    generation++;
    stop();
    document.removeEventListener('visibilitychange', visibility);
  });
  return {
    pending,
    message,
    failed,
    file,
    input,
    sound,
    editable,
    choose,
    preview,
    upload: () => mutate(false),
    remove: () => mutate(true),
  };
}
