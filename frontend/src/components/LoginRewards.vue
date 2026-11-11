<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { readGachaCheckin, type GachaCheckin } from '../contracts/gacha';
import { requestJson } from '../services/http';
import RewardCurrencyIcon from './RewardCurrencyIcon.vue';
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiLink from './UiLink.vue';
import UiNotice from './UiNotice.vue';
import UiPanel from './UiPanel.vue';

const props = defineProps<{ userId: string }>();
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const rewards = ref<GachaCheckin | null>(null);
const busy = ref(false);
const error = ref('');
let controller: AbortController | undefined;
let shownDay = '';

async function refresh(kind?: 'daily' | 'legendary' | 'epic-ten') {
  if (busy.value) return;
  const request = new AbortController();
  controller = request;
  busy.value = true;
  error.value = '';
  try {
    const next = readGachaCheckin(
      await requestJson('/api/gacha/check-in', {
        signal: request.signal,
        ...(kind ? { method: 'POST', body: { kind } } : {}),
      }),
    );
    if (request.signal.aborted) return;
    rewards.value = next;
    return next;
  } catch (cause) {
    if (!request.signal.aborted)
      error.value = cause instanceof Error ? cause.message : '暫時無法讀取登入獎勵。';
  } finally {
    if (controller === request) {
      busy.value = false;
      controller = undefined;
    }
  }
}

async function showToday() {
  const next = await refresh();
  if (
    !next ||
    shownDay === next.day ||
    (next.claimed && next.milestone.status !== 'claimable' && next.epicTen?.status !== 'claimable')
  )
    return;
  shownDay = next.day;
  const key = 'bga:login-rewards:shown:' + props.userId;
  try {
    if (localStorage.getItem(key) === next.day) return;
    localStorage.setItem(key, next.day);
  } catch {
    // Storage-restricted browsers can still show the reminder once per page.
  }
  await dialog.value?.open();
}

function open(event: MouseEvent) {
  const trigger = event.currentTarget;
  void dialog.value?.open(trigger instanceof HTMLElement ? trigger : undefined);
  void refresh();
}

watch(
  () => props.userId,
  () => {
    controller?.abort();
    controller = undefined;
    busy.value = false;
    rewards.value = null;
    shownDay = '';
    dialog.value?.close();
    void showToday();
  },
  { immediate: true },
);
onBeforeUnmount(() => controller?.abort());
const number = new Intl.NumberFormat('zh-TW');
</script>

<template>
  <UiButton variant="ghost" label="登入獎勵" @click="open" />
  <UiDialog ref="dialog" class="login-reward-dialog" title="登入獎勵">
    <div class="login-reward-content" :aria-busy="busy">
      <template v-if="rewards">
        <UiPanel title="五次登入獎勵" density="compact">
          <ol class="login-reward-cycle">
            <li v-for="(amount, index) in rewards.cycle" :key="index">
              <UiPanel
                as="div"
                density="compact"
                :tone="index === rewards.step && !rewards.claimed ? 'selected' : 'subtle'"
                class="login-reward-day"
              >
                <div class="login-reward-day-content">
                  <span>第 {{ index + 1 }} 次</span>
                  <RewardCurrencyIcon kind="stone" :size="36" />
                  <strong>{{ number.format(amount) }}</strong>
                  <span class="ui-sr-only">聖潔石</span>
                  <UiBadge
                    v-if="index < rewards.step || (index === rewards.step && rewards.claimed)"
                    tone="success"
                    class="login-reward-stamp"
                    >已領取</UiBadge
                  >
                  <UiBadge v-else-if="index === rewards.step" tone="primary">今日可領</UiBadge>
                  <UiBadge v-else tone="disabled">待解鎖</UiBadge>
                </div>
              </UiPanel>
            </li>
          </ol>
          <div class="login-reward-actions">
            <span>每日 00:00（台灣時間）換日，領滿五次重新循環。</span>
            <UiButton
              v-if="!rewards.claimed"
              variant="primary"
              label="領取今日聖潔石"
              :disabled="busy"
              @click="refresh('daily')"
            />
          </div>
        </UiPanel>
        <UiPanel
          v-if="rewards.epicTen"
          title="史詩十連抽券"
          description="首次累積登入三天可領。到抽卡機使用，前九抽一般機率，第十抽固定史詩。"
          density="compact"
        >
          <div class="login-reward-actions">
            <span>累積登入 {{ Math.min(rewards.visits, 3) }}／3 天</span>
            <UiButton
              v-if="rewards.epicTen.status === 'claimable'"
              label="領取史詩十連券"
              variant="primary"
              :disabled="busy"
              @click="refresh('epic-ten')"
            />
            <UiLink
              v-else-if="rewards.epicTen.status === 'available'"
              href="/gacha"
              label="前往抽卡機使用"
            />
            <UiBadge v-else-if="rewards.epicTen.status === 'used'" tone="success">已使用</UiBadge>
          </div>
        </UiPanel>
        <UiPanel title="傳說單抽券" description="首次累積登入七天，可領取一次。" density="compact">
          <div class="login-reward-actions">
            <div class="login-reward-progress">
              <span>
                累積登入 {{ Math.min(rewards.visits, rewards.milestone.days) }}／{{
                  rewards.milestone.days
                }}
                天
              </span>
              <progress
                :value="Math.min(rewards.visits, rewards.milestone.days)"
                :max="rewards.milestone.days"
                aria-label="傳說單抽券登入進度"
              />
            </div>
            <UiButton
              v-if="rewards.milestone.status === 'claimable'"
              variant="primary"
              label="領取傳說單抽券"
              :disabled="busy"
              @click="refresh('legendary')"
            />
            <UiLink
              v-else-if="rewards.milestone.status === 'available'"
              href="/gacha"
              label="已領取 · 前往抽卡"
            />
            <UiBadge v-else-if="rewards.milestone.status === 'used'" tone="success">已使用</UiBadge>
          </div>
        </UiPanel>
      </template>
      <p v-else-if="busy" role="status">載入登入獎勵中…</p>
      <UiButton v-else label="重新載入" @click="refresh()" />
      <UiNotice v-if="error" :message="error" error persistent density="compact" />
    </div>
  </UiDialog>
</template>

<style scoped>
.login-reward-content {
  display: grid;
  gap: var(--stitch-space-16);
}
.login-reward-cycle {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--stitch-space-8);
  margin: 0;
  padding: 0;
  list-style: none;
}
.login-reward-day {
  align-content: center;
}
.login-reward-day-content {
  display: grid;
  justify-items: center;
  gap: var(--stitch-space-4);
  text-align: center;
}
.login-reward-day strong {
  font-size: var(--stitch-text-section);
}
.login-reward-day[data-tone='selected'] strong {
  color: var(--stitch-selected-ink);
}
.login-reward-stamp {
  transform: rotate(-7deg);
}
.login-reward-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--stitch-space-8);
  margin-block-start: var(--stitch-space-12);
}
.login-reward-progress {
  display: grid;
  gap: var(--stitch-space-4);
}
.login-reward-progress progress {
  inline-size: 100%;
  accent-color: var(--stitch-primary);
}
@media (max-width: 700px) {
  .login-reward-cycle {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
