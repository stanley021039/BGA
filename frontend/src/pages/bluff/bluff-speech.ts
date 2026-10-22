import { computed, onScopeDispose, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useSpeechCaptions } from '../../composables/speech-captions';
import type { BluffSnapshot } from '../../contracts/bluff';

// The talk button's state for one 瞎掰王 view. Only this round's discussion
// accepts subtitles; recognition stops whenever that stops being true.
export function useBluffSpeech(state: () => BluffSnapshot) {
  const room = useRoomStore();
  const speech = useSpeechCaptions((line) => {
    const current = state();
    if (!current.roundId || current.phase !== 'discussion' || !room.connected) return;
    return room.request(
      'bluff/caption',
      { roundId: current.roundId, ...line },
      { affectsConnection: false },
    );
  });
  const listening = computed(() => speech.listening.value),
    status = computed(() =>
      !speech.supported
        ? '這個瀏覽器不支援語音辨識，請改用 Chrome、Edge 或 Safari。'
        : speech.error.value ||
          (speech.listening.value
            ? '正在聽你說話，再按一次停止。'
            : '按「講話」後才會收音，說的話會轉成字幕給同桌看。'),
    ),
    failed = computed(() => !speech.supported || !!speech.error.value);
  watch(
    [() => state().roundId, () => state().phase, () => room.connected],
    ([roundId, phase, connected], [oldRound]) => {
      if (roundId !== oldRound || phase !== 'discussion' || !connected) speech.stop(true);
    },
  );
  function visibility() {
    if (document.hidden) speech.stop();
  }
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => document.removeEventListener('visibilitychange', visibility));
  function toggle() {
    if (speech.listening.value) speech.stop();
    else speech.start();
  }
  return {
    supported: speech.supported,
    listening,
    interim: speech.interim,
    status,
    failed,
    toggle,
  };
}
