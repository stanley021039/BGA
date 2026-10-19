<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { DrawSnapshot } from '../../contracts/drawing';
import type { PublicDrawSnapshot } from '../../contracts/draw-results';
import { useRoomStore } from '../../stores/room';
import { useDrawResultsStore } from '../../stores/draw-results';
import { record } from '../../services/validation';
import PlayerAvatar from '../../components/PlayerAvatar.vue';
import PlayerName from '../../components/PlayerName.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import ResultCanvas from '../../components/ResultCanvas.vue';
import DrawVote from '../../components/DrawVote.vue';
import DrawHighlights from './DrawHighlights.vue';
const props = defineProps<{ snapshot: DrawSnapshot }>();
const emit = defineEmits<{ start: []; next: []; gallery: [id: string]; review: [id: string]; settings: [] }>();
const room = useRoomStore(), results = useDrawResultsStore(), preview = shallowRef<PublicDrawSnapshot | null>(null), loading = ref(false), error = ref('');
const artist = computed(() => props.snapshot.players.find(player => player.id === props.snapshot.presenterId));
const rankings = computed(() => [...props.snapshot.players].sort((a, b) => Number(b.score) - Number(a.score)));
const winners = computed(() => props.snapshot.winner?.ids || []), me = computed(() => props.snapshot.players.find(player => player.id === props.snapshot.me));
const correctCounts = computed(() => { try { return record(record(props.snapshot.matchSummary).correctByPlayer); } catch { return {}; } });
let generation = 0, disposed = false;
async function loadPreview() {
  const id = ['reveal', 'finished'].includes(props.snapshot.phase) ? props.snapshot.result?.resultId : null, epoch = ++generation, scope = room.scope;
  preview.value = null; error.value = ''; loading.value = !!id; if (!id) return;
  try { const value = await results.load(id); if (!disposed && epoch === generation && scope === room.scope) preview.value = value; }
  catch (cause) { if (!disposed && epoch === generation && scope === room.scope) error.value = cause instanceof Error ? cause.message : '畫作載入失敗。'; }
  finally { if (epoch === generation) loading.value = false; }
}
watch(() => [props.snapshot.phase, props.snapshot.result?.resultId, room.scope], loadPreview, { immediate: true });
onBeforeUnmount(() => { disposed = true; generation++; });
function rank(index: number) { return rankings.value.findIndex(player => Number(player.score) === Number(rankings.value[index].score)) + 1; }
</script>
<template>
  <section v-if="snapshot.phase === 'waiting'" class="vue-draw-scene vue-draw-waiting" aria-label="開畫準備"><img :src="room.host ? '/assets/stitch/waiting-host.jpg' : '/assets/stitch/waiting-guest.jpg'" alt=""><div><h1>準備開畫</h1><p>{{ snapshot.players.length }} / 8 位朋友已入座</p><p>{{ room.host ? '邀請朋友、調整規則，兩人到齊就能開始。' : '入座後可先點就緒；等房主開始遊戲。' }}</p><UiButton v-if="!room.host" icon="check" :label="me?.ready ? '已就緒（點擊切換）' : '準備好了！點擊就緒'" :aria-pressed="me?.ready === true" :pending="room.busy" @click="room.command('action', { action: 'ready', ready: !me?.ready })" /><UiButton v-else icon="play" label="開始遊戲" :disabled="snapshot.players.length < 2 || room.busy" @click="emit('start')" /></div></section>
  <section v-else-if="snapshot.phase === 'choosing'" class="vue-draw-scene vue-draw-choosing" aria-label="畫者選題"><header><PlayerAvatar :name="artist?.name || '畫者'" :avatar="artist?.avatar || null" :bot="artist?.bot" /><p>{{ artist?.name || '畫者' }} 的回合</p><h1>{{ snapshot.presenterId === snapshot.me ? '選一張題卡，準備開畫' : '畫者正在挑題' }}</h1><p>{{ snapshot.presenterId === snapshot.me ? '只有你看得到題目，選好就開始。' : '題目選好後，畫作會出現在同一塊畫布。' }}</p></header><div v-if="snapshot.presenterId === snapshot.me" class="vue-draw-candidates"><button v-for="word in snapshot.candidates" :key="word.id" type="button" :disabled="room.busy" @click="room.command('action', { action: 'choose', questionId: word.id })"><small>{{ word.topicLabel || '綜合' }} · {{ word.category }}</small><strong>{{ word.title }}</strong><span>{{ [...word.title].length }} 字</span></button></div><img v-else class="vue-draw-secret-art" src="/assets/stitch/secret-cards.jpg" alt="等待秘密題卡揭曉的插畫"></section>
  <section v-else-if="snapshot.phase === 'reveal'" class="vue-draw-scene vue-draw-reveal" aria-label="本輪答案與畫作"><header><small>第 {{ snapshot.round }} 輪 · 答案揭曉</small><h1>{{ snapshot.result?.answer || '這輪沒有選定題目' }}</h1><p>{{ snapshot.result?.reason }}</p><p>{{ snapshot.result?.guessedIds.length || 0 }} 位朋友猜中 · 畫者每猜中一人 +15 分</p></header><ResultCanvas v-if="preview" :snapshot="preview" compact /><div v-else class="vue-draw-result-empty">{{ loading ? '正在讀取本輪畫作…' : '畫作尚未載入。' }}<UiButton v-if="error" icon="refresh" label="重新載入畫作" @click="loadPreview" /></div><StatusSlot :message="error" :error="!!error" /><DrawVote :result-id="snapshot.result?.resultId || null" /><footer class="vue-draw-scene-actions"><UiButton v-if="snapshot.result" icon="save" label="收藏這幅畫" :pending="!!results.view?.savingId" @click="emit('gallery', snapshot.result.resultId)" /><UiButton v-if="snapshot.result" icon="share" label="分享畫作" :disabled="results.busy" @click="results.share(snapshot.result.resultId)" /><UiButton v-if="room.host" icon="next" label="下一位畫者" :disabled="room.busy" @click="emit('next')" /><span v-else>等待下一輪</span></footer></section>
  <section v-else-if="snapshot.phase === 'finished'" class="vue-draw-scene vue-draw-finished" aria-label="本局成績"><header><small>本局結束</small><h1>今晚的畫猜高手</h1><p>{{ snapshot.winner?.reason || '每位畫者都已完成。' }}</p></header><DrawHighlights :snapshot="snapshot" @review="emit('review', $event)" /><ol class="vue-draw-ranking"><li v-for="(player, index) in rankings" :key="player.id" :class="{ 'is-winner': winners.includes(player.id) }"><strong :aria-label="'排名 ' + rank(index)">{{ rank(index) }}</strong><PlayerAvatar :name="player.name" :avatar="player.avatar" :bot="player.bot" /><div><PlayerName :name="player.name" /><small>猜中 {{ Number(correctCounts[player.id]) || 0 }} 題{{ winners.includes(player.id) ? ' · 本局獲勝' : '' }}</small></div><strong>{{ player.score }} 分</strong></li></ol><details v-if="snapshot.result"><summary>最後一幅畫 · {{ snapshot.result.answer || '未選定題目' }}</summary><ResultCanvas v-if="preview" :snapshot="preview" compact /><StatusSlot :message="error || (loading ? '正在讀取畫作…' : '')" :error="!!error" /><UiButton v-if="error" icon="refresh" label="重新載入畫作" @click="loadPreview" /></details><footer class="vue-draw-scene-actions"><a class="ui-button" href="/">返回大廳</a><UiButton icon="download" label="匯出本局畫作集" :disabled="results.busy || !results.results.length" @click="results.exportAll(true)" /><UiButton icon="settings" label="下一局設定" @click="emit('settings')" /><UiButton v-if="room.host" icon="replay" label="再來一局（同桌再戰）" :disabled="snapshot.players.length < 2 || room.busy" @click="emit('start')" /><span v-else>等待房主再開一局</span></footer></section>
</template>
