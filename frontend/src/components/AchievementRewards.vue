<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useResource } from '../composables/resource';
import { useMutation } from '../composables/mutation';
import { usePreferencesStore } from '../stores/preferences';
import { array, record, text } from '../services/validation';
import UiButton from './UiButton.vue';
import FramePreview from './FramePreview.vue';
import StatusSlot from './StatusSlot.vue';
interface Reward {
  frameId: string;
  label: string;
  achievementTitle: string;
  earned: boolean;
  claimedAt: string | null;
}
const prefs = usePreferencesStore(),
  mutation = useMutation(),
  selected = ref(''),
  resource = useResource(async (request) => {
    const data = record(await request('/api/achievements'));
    return array(data.rewards).map((v) => {
      const r = record(v);
      return {
        frameId: text(r.frameId),
        label: text(r.label),
        achievementTitle: text(r.achievementTitle),
        earned: r.earned === true,
        claimedAt: typeof r.claimedAt === 'string' ? r.claimedAt : null,
      } as Reward;
    });
  });
onMounted(() => resource.load());
async function claim(frameId: string) {
  await mutation.run(async (request) => {
    const data = await request('/api/achievements/claim', { frameId });
    const frames = window.BarrageFrames as typeof window.BarrageFrames & {
      acceptRewards?(data: unknown): void;
    };
    frames?.acceptRewards?.(data);
    await resource.load();
  }, '獎勵已領取');
}
function apply(kind: 'barrage' | 'media', id: string) {
  prefs.setFrame(kind, id);
  selected.value = (kind === 'barrage' ? '彈幕框' : '播放器') + '已套用';
}
</script>
<template>
  <section class="page-panel"
    ><h2>專屬成就外觀獎勵</h2
    ><StatusSlot
      :message="mutation.message.value || resource.error.value || selected"
      :error="mutation.failed.value || !!resource.error.value" /><UiButton
      v-if="resource.error.value"
      label="重新讀取獎勵"
      @click="resource.load()" /><div class="vue-reward-grid"
      ><article v-for="reward in resource.data.value || []" :key="reward.frameId"
        ><h3>{{ reward.label }}</h3
        ><p>達成「{{ reward.achievementTitle }}」</p
        ><FramePreview
          :frame="reward.frameId"
          name="我的成就"
          message="這一桌留下我們的回憶。" /><FramePreview
          :frame="reward.frameId"
          kind="media"
          name="播放器"
          message="歌曲外觀預覽" /><template v-if="reward.claimedAt"
          ><p>已領取 · 彈幕與播放器皆可使用</p
          ><UiButton
            label="套用彈幕框"
            :aria-pressed="prefs.barrage?.selected === reward.frameId"
            @click="apply('barrage', reward.frameId)" /><UiButton
            label="套用播放器"
            :aria-pressed="prefs.media === reward.frameId"
            @click="apply('media', reward.frameId)" /></template
        ><UiButton
          v-else
          :label="reward.earned ? '領取獎勵' : '尚未達成'"
          :disabled="!reward.earned || mutation.pending.value"
          @click="claim(reward.frameId)" /></article></div
  ></section>
</template>
<style scoped>
.vue-reward-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 20px;
}
.vue-reward-grid article {
  min-width: 0;
  padding: 16px;
  border: 1px solid currentColor;
  border-radius: 16px;
}
</style>
