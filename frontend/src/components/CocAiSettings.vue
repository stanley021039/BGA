<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import UiPanel from './UiPanel.vue';
import UiField from './UiField.vue';
import UiButton from './UiButton.vue';
import StatusSlot from './StatusSlot.vue';
import { requestJson } from '../services/http';
import { array, record, text } from '../services/validation';

type KeyInfo = { scope: string; provider: string; model: string; suffix: string };
const provider = ref('openai'),
  scope = ref('user'),
  model = ref('gpt-6.1-sol'),
  key = ref('');
const keys = ref<KeyInfo[]>([]),
  admin = ref(false),
  pending = ref(false),
  loading = ref(true);
const message = ref(''),
  failed = ref(false),
  notice = ref(0);
const cli = ref({ enabled: false, ready: false, model: '', message: '' });
const showApi = ref(false);
watch(showApi, (visible) => {
  if (!visible) key.value = '';
});
const current = computed(() =>
  keys.value.find((item) => item.provider === provider.value && item.scope === scope.value),
);
const scopes = computed(() => [
  { value: 'user', label: '本人金鑰（由房主支付）' },
  ...(admin.value ? [{ value: 'station', label: '站方金鑰（供使用站方 AI 的房間）' }] : []),
]);
function read(value: unknown) {
  const data = record(value);
  admin.value = data.canManageStation === true;
  const connection = record(data.cli);
  cli.value = {
    enabled: connection.enabled === true,
    ready: connection.ready === true,
    model: text(connection.model),
    message: text(connection.message),
  };
  keys.value = array(data.keys).map((value) => {
    const item = record(value);
    return {
      scope: text(item.scope),
      provider: text(item.provider),
      model: text(item.model),
      suffix: text(item.suffix),
    };
  });
}
watch([provider, scope], () => {
  key.value = '';
  model.value =
    current.value?.model || (provider.value === 'openai' ? 'gpt-6.1-sol' : 'claude-sonnet-4-6');
  message.value = '';
});
async function run(action: 'load' | 'save' | 'remove' | 'probe' | 'cliProbe') {
  if (pending.value) return;
  pending.value = true;
  failed.value = false;
  message.value = '';
  try {
    if (action === 'load') read(await requestJson('/api/coc/ai/settings'));
    else if (action === 'probe' || action === 'cliProbe') {
      const isCli = action === 'cliProbe';
      const result = record(
        await requestJson('/api/coc/ai/probe', {
          method: 'POST',
          body: { provider: isCli ? 'openai' : provider.value, scope: isCli ? 'cli' : scope.value },
        }),
      );
      const usage = record(result.usage);
      message.value =
        usage.input == null || usage.output == null
          ? `${isCli ? 'CLI 回應成功' : '連線成功'}：${text(result.model)}；未回報完整用量，請至服務帳戶查看額度。`
          : `${isCli ? 'CLI 回應成功' : '連線成功'}：${text(result.model)}；本次輸入 ${usage.input}、輸出 ${usage.output} tokens。`;
    } else {
      const secret = key.value;
      key.value = '';
      read(
        await requestJson('/api/coc/ai/' + action, {
          method: 'POST',
          body: {
            provider: provider.value,
            scope: scope.value,
            model: model.value,
            ...(action === 'save' ? { key: secret } : {}),
          },
        }),
      );
      message.value =
        action === 'save' ? '金鑰已加密儲存。請按測試連線，確認金鑰與模型可用。' : '金鑰已刪除。';
    }
  } catch (error) {
    failed.value = true;
    message.value = error instanceof Error ? error.message : '無法完成設定';
  } finally {
    pending.value = false;
    loading.value = false;
    notice.value++;
  }
}
onMounted(() => void run('load'));
</script>
<template>
  <UiPanel title="克蘇魯的呼喚 · AI 主持設定" note="主持連線與遊戲存檔分開管理">
    <div v-if="cli.enabled" class="coc-cli-setting" :aria-busy="pending">
      <p
        >Codex CLI · {{ cli.model }}。使用此站已登入 ChatGPT 帳號的 Codex 額度，與該帳號其他 Codex
        工作共用；不需要填 API key。</p
      >
      <p
        >由此站管理者在 OpenAI
        登入畫面完成授權後即可使用。額度不足或連線失敗時，冒險會保留已保存的結果，等待稍後重試。</p
      >
      <div class="coc-ai-actions">
        <UiButton
          label="重新檢查 CLI 登入狀態"
          icon="refresh"
          :disabled="pending"
          @click="run('load')"
        />
        <UiButton
          v-if="admin"
          label="測試 CLI 主持（會使用 Codex 額度）"
          caption="測試 CLI"
          icon="play"
          :disabled="pending || !cli.ready"
          @click="run('cliProbe')"
        />
        <UiButton
          :label="showApi ? '收合 API 金鑰設定' : 'API 金鑰設定（選用）'"
          icon="settings"
          :aria-expanded="showApi"
          @click="showApi = !showApi"
        />
      </div>
    </div>
    <form
      v-if="!cli.enabled || showApi"
      class="coc-ai-form"
      aria-label="AI 主持金鑰設定"
      :aria-busy="pending"
      @submit.prevent="run('save')"
    >
      <p
        >此入口使用供應商的 API 額度，連線測試與 AI 主持會依用量扣抵。符合資格的 ChatGPT
        Pro／Business 可先在帳單設定領取訂閱附贈的 API credits，再使用該 API
        組織的金鑰；本入口不直接使用 ChatGPT 對話或 Codex
        登入額度。保存後只顯示末四碼，其他玩家看不到金鑰。</p
      >
      <div class="coc-ai-fields">
        <UiField
          v-model="provider"
          label="服務"
          control="select"
          :options="[
            { value: 'openai', label: 'OpenAI' },
            { value: 'anthropic', label: 'Claude' },
          ]"
          :disabled="pending"
        />
        <UiField
          v-model="scope"
          label="使用範圍"
          control="select"
          :options="scopes"
          :disabled="pending"
        />
        <UiField
          v-model="model"
          label="模型名稱"
          hint="可先保留預設值；儲存後測試連線，確認金鑰與模型權限。"
          maxlength="100"
          :disabled="pending"
          required
        />
        <UiField
          v-model="key"
          label="新的 API 金鑰"
          type="password"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          maxlength="300"
          :disabled="pending"
          :hint="
            current
              ? '已保存末四碼：' + current.suffix + '。輸入新金鑰會取代舊設定。'
              : '請從供應商控制台建立金鑰，貼到這個欄位。'
          "
          required
        />
      </div>
      <div class="coc-ai-actions">
        <UiButton
          label="儲存金鑰"
          icon="save"
          type="submit"
          variant="primary"
          :pending="pending"
          :disabled="loading || !key"
        />
        <UiButton
          label="測試連線（會使用少量 API 額度）"
          caption="測試連線"
          icon="refresh"
          :pending="pending"
          :disabled="loading || !current"
          @click="run('probe')"
        />
        <UiButton
          label="刪除已保存金鑰"
          icon="remove"
          variant="danger"
          :disabled="pending || !current"
          @click="run('remove')"
        />
        <UiButton
          v-if="failed && !current"
          label="重新載入設定"
          icon="refresh"
          :disabled="pending"
          @click="run('load')"
        />
      </div>
    </form>
    <div class="coc-ai-feedback" tabindex="0" aria-label="主持連線狀態"
      ><StatusSlot
        :message="
          message ||
          (loading
            ? '載入 AI 設定…'
            : cli.enabled && !showApi
              ? cli.message
              : current
                ? '已保存模型：' + current.model
                : '尚未保存金鑰')
        "
        :error="failed"
        :notice-key="notice"
        persistent
    /></div>
  </UiPanel>
</template>
<style scoped>
.coc-ai-form {
  display: grid;
  gap: var(--stitch-space-16);
  min-inline-size: 0;
}
.coc-cli-setting {
  display: grid;
  gap: var(--stitch-space-16);
  min-inline-size: 0;
}
.coc-ai-feedback {
  block-size: 3lh;
  min-inline-size: 0;
}
.coc-ai-feedback :deep(.ui-notice-slot[data-density='compact']) {
  block-size: 100%;
  min-block-size: 0;
  max-block-size: none;
  overflow: visible;
  scrollbar-gutter: auto;
}
.coc-ai-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-space-16);
}
.coc-ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-12);
  min-block-size: var(--stitch-control-height);
  align-items: center;
}
@media (max-width: 760px) {
  .coc-ai-feedback {
    block-size: 5lh;
  }
  .coc-ai-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
