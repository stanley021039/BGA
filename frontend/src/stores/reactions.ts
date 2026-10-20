import { computed, onScopeDispose, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { useResource } from '../composables/resource';
import { readEmojis } from '../contracts/social';
import { readCharacterOptions, readSettings } from '../contracts/profile';

export const useReactionsStore = defineStore('reactions', () => {
  const room = useRoomStore();
  const emojis = useResource(async (request) => readEmojis(await request('/api/social/options')));
  const character = useResource(async (request) => {
    const [settingsValue, optionsValue] = await Promise.all([
      request('/api/profile/settings'),
      request('/api/profile/options'),
    ]);
    const settings = readSettings(settingsValue),
      options = readCharacterOptions(optionsValue);
    const selected =
      options.characters.find((character) => character.id === settings.appearance.characterId) ||
      options.characters[0];
    if (!selected) throw Error('目前沒有可用角色，請到形象設定選擇角色。');
    return {
      name: selected.name,
      choices: Object.entries(selected.expressions).map(([id, url]) => ({
        id,
        url,
        label: selected.labels[id] || options.expressionLabels[id] || id,
      })),
    };
  });
  const pending = ref(false),
    message = ref(''),
    failed = ref(false),
    enabled = computed(() => !!room.seat && !!room.snapshot && !room.terminal);
  const emojiChoices = computed(() => emojis.data.value || []),
    expressions = computed(() => character.data.value?.choices || []);
  let controller: AbortController | null = null,
    disposed = false;
  async function load() {
    if (!enabled.value) return false;
    const results = await Promise.allSettled([emojis.load(), character.load()]);
    return results.every((result) => result.status === 'fulfilled' && result.value);
  }
  async function send(kind: 'emoji' | 'expression', value: string): Promise<boolean> {
    if (!enabled.value || pending.value) return false;
    const choice =
      kind === 'emoji'
        ? emojiChoices.value.includes(value)
        : expressions.value.some((choice) => choice.id === value);
    if (!choice) {
      message.value = '請先載入並選擇有效的表情。';
      failed.value = true;
      return false;
    }
    const epoch = room.scope,
      operation = new AbortController();
    controller = operation;
    pending.value = true;
    message.value = '';
    failed.value = false;
    const timer = setTimeout(
      () => operation.abort(new DOMException('傳送結果尚未確認，請查看房間狀態。', 'TimeoutError')),
      10000,
    );
    try {
      const result = await room.request(
        'social',
        { kind, [kind]: value },
        { signal: operation.signal },
      );
      if (disposed || epoch !== room.scope || controller !== operation) return false;
      room.accept(result);
      if (!enabled.value) return false;
      message.value =
        kind === 'emoji'
          ? `已送出 ${value} emoji 彈幕`
          : `已送出「${expressions.value.find((choice) => choice.id === value)?.label || value}」表情`;
      return true;
    } catch (cause) {
      if (!disposed && epoch === room.scope && controller === operation) {
        message.value = cause instanceof Error ? cause.message : '傳送失敗，請重試。';
        failed.value = true;
      }
      return false;
    } finally {
      clearTimeout(timer);
      if (controller === operation) {
        controller = null;
        pending.value = false;
      }
    }
  }
  watch(
    () => room.scope,
    () => {
      controller?.abort();
      controller = null;
      pending.value = false;
      message.value = '';
      failed.value = false;
      emojis.reset();
      character.reset();
    },
  );
  function refreshCharacter() {
    if (enabled.value) {
      character.reset();
      void character.load();
    }
  }
  const focus = () => {
    if (!document.hidden && enabled.value) void character.load();
  };
  window.addEventListener('profile-updated', refreshCharacter);
  window.addEventListener('focus', focus);
  onScopeDispose(() => {
    disposed = true;
    controller?.abort();
    window.removeEventListener('profile-updated', refreshCharacter);
    window.removeEventListener('focus', focus);
  });
  return {
    emojiChoices,
    expressions,
    characterName: computed(() => character.data.value?.name || ''),
    emojiLoading: emojis.loading,
    emojiError: emojis.error,
    characterLoading: character.loading,
    characterError: character.error,
    loadEmojis: emojis.load,
    loadCharacter: character.load,
    enabled,
    pending,
    message,
    failed,
    load,
    send,
  };
});
