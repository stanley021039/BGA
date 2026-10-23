import { computed, onScopeDispose, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useSpeechCaptions } from '../../composables/speech-captions';
import type { BluffSnapshot } from '../../contracts/bluff';

// Voice answers for one 瞎掰王 view. Recognised lines stay on this page until the
// speaker presses 結束; the joined text is then handed to `submit` as the answer.
// Only this round's discussion accepts answers; recognition stops otherwise.
export function useBluffSpeech(
  state: () => BluffSnapshot,
  submit: (text: string) => Promise<unknown> | void,
) {
  const room = useRoomStore(),
    heard = ref<string[]>([]),
    waiting = ref(false),
    message = ref('');
  const speech = useSpeechCaptions((line) => {
    if (line.final && line.text) heard.value = [...heard.value, line.text];
  });
  const listening = computed(() => speech.listening.value),
    status = computed(() =>
      !speech.supported
        ? '這個瀏覽器不支援語音辨識，請改用文字答題。'
        : speech.error.value ||
          message.value ||
          (waiting.value
            ? '正在等待語音辨識結果…'
            : speech.listening.value
              ? '正在聽你說話，說完按「結束」。'
              : ''),
    ),
    preview = computed(() => [...heard.value, speech.interim.value].filter(Boolean).join('')),
    failed = computed(() => !speech.supported || !!speech.error.value || !!message.value);
  watch(
    [() => state().roundId, () => state().phase, () => room.connected],
    ([roundId, phase, connected], [oldRound]) => {
      if (roundId !== oldRound || phase !== 'discussion' || !connected) {
        speech.stop(true);
        heard.value = [];
        waiting.value = false;
      }
    },
  );
  // Recognition ends a moment after stop(); the last final line arrives first.
  watch(listening, async (now) => {
    if (now || !waiting.value) return;
    waiting.value = false;
    const answer = heard.value.join('').trim();
    heard.value = [];
    if (!answer) {
      message.value = '沒有辨識到內容，請再試一次或改用文字答題。';
      return;
    }
    await submit(answer);
  });
  function visibility() {
    if (document.hidden && speech.listening.value) finish();
  }
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => document.removeEventListener('visibilitychange', visibility));
  function start() {
    message.value = '';
    heard.value = [];
    speech.start();
  }
  function finish() {
    if (!speech.listening.value) return;
    waiting.value = true;
    speech.stop();
  }
  return {
    supported: speech.supported,
    listening,
    waiting,
    preview,
    status,
    failed,
    start,
    finish,
  };
}
