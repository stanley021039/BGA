<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import { useReactionsStore } from '../stores/reactions';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiTabs from './UiTabs.vue';
import StatusSlot from './StatusSlot.vue';
import '../styles/room-social.scss';
const props = defineProps<{ disabled?: boolean }>(), emit = defineEmits<{ compose: [text: string] }>();
const room = useRoomStore(), reactions = useReactionsStore(), dialog = ref<InstanceType<typeof UiDialog> | null>(null), tab = ref('emoji'), prefix = useId();
const featured = [['😂','笑死'],['👏','神作'],['🔥','熱血'],['🤔','思考'],['😱','崩潰'],['👍','厲害'],['❤️','喜歡'],['🎉','恭喜'],['💩','畫啥呢'],['🤡','小丑'],['🚀','起飛'],['💡','靈光'],['🎨','畫工'],['💯','滿分'],['👻','抓到了'],['🕶️','淡定'],['👀','圍觀'],['🤯','震驚'],['🤝','同意'],['🎯','命中'],['⏳','快點'],['🤐','保密'],['🍿','爆米花'],['🏆','MVP']];
const names: Record<string, string> = { '😀':'開心', '🥰':'喜歡', '😎':'帥氣', '😮':'驚訝', '😭':'哭哭', '😡':'生氣', '👎':'不行', '🙌':'歡呼', '🙏':'拜託', '🥳':'慶祝', '😴':'想睡', '✨':'閃亮', '💪':'加油' };
const enhanced = computed(() => room.type === 'draw' || room.type === 'quacks');
const primary = computed(() => enhanced.value ? featured.filter(([value]) => reactions.emojiChoices.includes(value!)) : reactions.emojiChoices.map(value => [value, names[value] || featured.find(([glyph]) => glyph === value)?.[1] || '表情互動']));
const extra = computed(() => enhanced.value ? reactions.emojiChoices.filter(value => !primary.value.some(([glyph]) => glyph === value)).map(value => [value, names[value] || '表情互動']) : []);
const tabs = computed(() => [{ id: 'emoji', label: '全部表情', count: String(primary.value.length) }, { id: 'character', label: '動態肢體' }, ...(enhanced.value ? [{ id: 'phrases', label: '桌遊吐槽' }] : [])]);
const phrases = computed(() => room.type === 'quacks' ? ['💬 這鍋穩啦！','💬 先停還是衝？','💬 差一顆就爆了！'] : ['💬 太抽象了！','💬 肯定是那個吧？','💬 加油快畫完！']);
const blocked = computed(() => !!props.disabled || reactions.pending || !reactions.enabled);
function open(event: MouseEvent) { if (blocked.value) return; void dialog.value?.open(event.currentTarget as HTMLElement); void reactions.load(); }
async function send(kind: 'emoji' | 'expression', value: string) { if (blocked.value) return; const scope = room.scope; if (await reactions.send(kind, value) && scope === room.scope) dialog.value?.close(); }
let queuedCompose: { text: string; scope: number } | null = null;
function compose(value: string) { if (blocked.value) return; queuedCompose = { text: value, scope: room.scope }; dialog.value?.close(); }
function closed() { const value = queuedCompose; queuedCompose = null; if (value && value.scope === room.scope && reactions.enabled) emit('compose', value.text); }
watch(() => reactions.enabled, enabled => { if (!enabled) { queuedCompose = null; dialog.value?.close(); } });
watch(() => room.scope, () => { queuedCompose = null; dialog.value?.close(); tab.value = 'emoji'; });
defineExpose({ open });
</script>
<template>
  <UiButton icon="emoji" icon-only label="選擇 emoji 或角色表情" caption="表情" :disabled="blocked" @click="open" />
  <UiDialog ref="dialog" title="表情互動面板" @closed="closed">
    <UiTabs v-model="tab" :items="tabs" label="表情分類" :id-prefix="prefix + '-tab'" :panel-prefix="prefix + '-panel'" :disabled="reactions.pending" />
    <div class="vue-reaction-content">
      <section v-show="tab === 'emoji'" :id="prefix + '-panel-emoji'" role="tabpanel" :aria-labelledby="prefix + '-tab-emoji'" :aria-busy="reactions.emojiLoading">
        <p v-if="reactions.emojiLoading && !reactions.emojiChoices.length">正在載入表情…</p>
        <div v-if="reactions.emojiError" class="vue-social-load-error"><p>{{ reactions.emojiError }}</p><UiButton icon="refresh" label="重新載入 emoji" :pending="reactions.emojiLoading" @click="reactions.loadEmojis()" /></div>
        <div class="vue-emoji-grid"><button v-for="[value, label] in primary" :key="value" type="button" :aria-label="'送出' + label + '表情（' + value + '）'" :disabled="blocked" @click="send('emoji', value!)"><span class="vue-emoji-glyph" aria-hidden="true">{{ value }}</span><span>{{ label }}</span></button></div>
        <details v-if="extra.length" class="vue-emoji-more"><summary>更多表情</summary><div class="vue-emoji-grid"><button v-for="[value, label] in extra" :key="value" type="button" :aria-label="'送出' + label + '（' + value + '）'" :disabled="blocked" @click="send('emoji', value!)"><span class="vue-emoji-glyph" aria-hidden="true">{{ value }}</span><span>{{ label }}</span></button></div></details>
      </section>
      <section v-show="tab === 'character'" :id="prefix + '-panel-character'" role="tabpanel" :aria-labelledby="prefix + '-tab-character'" :aria-busy="reactions.characterLoading">
        <p v-if="reactions.characterLoading && !reactions.expressions.length">正在載入角色表情…</p><p v-else>使用「{{ reactions.characterName }}」的角色表情。</p>
        <div v-if="reactions.characterError" class="vue-social-load-error"><p>{{ reactions.characterError }}</p><UiButton icon="refresh" label="重新載入角色表情" :pending="reactions.characterLoading" @click="reactions.loadCharacter()" /></div>
        <div class="vue-expression-grid"><button v-for="choice in reactions.expressions" :key="choice.id" type="button" :aria-label="'送出「' + choice.label + '」表情'" :disabled="blocked" @click="send('expression', choice.id)"><img :src="choice.url" alt="" loading="lazy"><span>{{ choice.label }}</span></button></div>
      </section>
      <section v-if="enhanced" v-show="tab === 'phrases'" :id="prefix + '-panel-phrases'" role="tabpanel" :aria-labelledby="prefix + '-tab-phrases'" class="vue-reaction-phrases"><UiButton v-for="phrase in phrases" :key="phrase" :label="phrase" :disabled="blocked" @click="compose(phrase)" /></section>
    </div>
    <StatusSlot :message="reactions.pending ? '傳送中…' : reactions.message" :error="reactions.failed" />
  </UiDialog>
</template>
