import { defineStore } from 'pinia';
import { playActionFeedback } from '../services/action-sounds';
import { computed, onScopeDispose, ref, watch } from 'vue';
import { useSessionStore } from './session';
import { ApiError, requestJson } from '../services/http';
import { array, record } from '../services/validation';
import {
  readGachaState,
  readGachaReceipt,
  readGachaOdds,
  type GachaOdds,
  type GachaState,
  type GachaReceipt,
} from '../contracts/gacha';
type Operation =
  | { operation: 'draw'; requestId: string; pool: string; count: 1 | 10; oddsRevision?: string }
  | { operation: 'exchange'; requestId: string; key: string };
export const useGachaStore = defineStore('gacha', () => {
  const session = useSessionStore(),
    identity = computed(() => session.user?.id || '');
  const state = ref<GachaState | null>(null),
    loading = ref(false),
    pending = ref(false),
    message = ref(''),
    notice = ref(0),
    last = ref<GachaReceipt | null>(null),
    unsettled = ref<Operation | null>(null),
    history = ref<GachaReceipt[]>([]);
  const adminOdds = ref<GachaOdds | null>(null),
    oddsPending = ref(false),
    oddsMessage = ref(''),
    oddsNotice = ref(0);
  let generation = 0,
    loadGeneration = 0;
  const controllers = new Set<AbortController>(),
    key = () => 'bga:gacha:pending:' + identity.value;
  function retain(operation: Operation | null) {
    unsettled.value = operation;
    try {
      if (operation) sessionStorage.setItem(key(), JSON.stringify(operation));
      else sessionStorage.removeItem(key());
    } catch {
      /* Private browsing still has in-memory recovery. */
    }
  }
  function restore() {
    try {
      const p = JSON.parse(sessionStorage.getItem(key()) || 'null');
      if (!p || !/^[a-f0-9-]{36}$/i.test(p.requestId)) return;
      if (
        p.operation === 'draw' &&
        typeof p.pool === 'string' &&
        [1, 10].includes(p.count) &&
        (p.oddsRevision === undefined ||
          (typeof p.oddsRevision === 'string' && /^[a-f0-9]{64}$/.test(p.oddsRevision)))
      )
        unsettled.value = {
          operation: 'draw',
          requestId: p.requestId,
          pool: p.pool,
          count: p.count,
          ...(p.oddsRevision ? { oddsRevision: p.oddsRevision } : {}),
        };
      else if (p.operation === 'exchange' && typeof p.key === 'string')
        unsettled.value = { operation: 'exchange', requestId: p.requestId, key: p.key };
    } catch {
      /* Invalid local recovery data is never sent. */
    }
  }
  async function request(path: string, options: { method?: 'POST'; body?: unknown } = {}) {
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      return await requestJson(path, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }
  async function load() {
    if (!identity.value) return;
    const epoch = generation,
      revision = ++loadGeneration;
    loading.value = true;
    try {
      const next = readGachaState(await request('/api/gacha'));
      if (epoch === generation && revision === loadGeneration) {
        state.value = next;
        message.value = '';
      }
    } catch (e) {
      if (epoch === generation) {
        message.value = e instanceof Error ? e.message : '無法讀取抽卡機';
        notice.value++;
      }
    } finally {
      if (epoch === generation && revision === loadGeneration) loading.value = false;
    }
  }
  async function execute(operation: Operation) {
    if (pending.value || !identity.value) return null;
    const epoch = generation;
    pending.value = true;
    message.value = '';
    retain(operation);
    try {
      const { operation: kind, ...body } = operation;
      const receipt = readGachaReceipt(
        await request('/api/gacha/' + kind, { method: 'POST', body }),
        kind,
      );
      if (epoch !== generation) return null;
      loadGeneration++;
      loading.value = false;
      retain(null);
      last.value = receipt;
      if (state.value) {
        state.value.wallet = receipt.wallet;
        if (receipt.operation === 'draw' && receipt.drawCount !== undefined) {
          const pool = state.value.pools.find((pool) => pool.id === receipt.pool);
          if (pool) pool.drawCount = Math.max(pool.drawCount, receipt.drawCount);
        }
        const keys = new Set(
          receipt.operation === 'draw' ? receipt.results.map((i) => i.key) : [receipt.item.key],
        );
        state.value.items = state.value.items.map((i) =>
          keys.has(i.key) ? { ...i, owned: true } : i,
        );
      }
      if (receipt.operation === 'exchange') playActionFeedback();
      window.dispatchEvent(new CustomEvent('achievement-rewards-updated'));
      return receipt;
    } catch (e) {
      if (epoch === generation) {
        const definitive = e instanceof ApiError && e.status >= 400 && e.status < 500;
        if (definitive) retain(null);
        if (e instanceof ApiError && e.code === 'GACHA_ODDS_CHANGED') await load();
        if (epoch !== generation) return null;
        message.value = definitive
          ? e.message
          : '結果尚未確認，請按「確認上次結果」；同一操作不會重複扣款。';
        notice.value++;
      }
      return null;
    } finally {
      if (epoch === generation) pending.value = false;
    }
  }
  function draw(pool: string, count: 1 | 10) {
    if (unsettled.value || !state.value) return Promise.resolve(null);
    return execute({
      operation: 'draw',
      requestId: crypto.randomUUID(),
      pool,
      count,
      oddsRevision: state.value.odds.revision,
    });
  }
  async function loadOdds() {
    if (session.user?.role !== 'admin' || oddsPending.value) return;
    const epoch = generation;
    oddsPending.value = true;
    try {
      const next = readGachaOdds(await request('/api/admin/gacha/odds'));
      if (epoch === generation) {
        adminOdds.value = next;
        oddsMessage.value = '';
      }
    } catch (e) {
      if (epoch === generation) {
        oddsMessage.value = e instanceof Error ? e.message : '權重讀取失敗';
        oddsNotice.value++;
      }
    } finally {
      if (epoch === generation) oddsPending.value = false;
    }
  }
  async function saveOdds(weights: GachaOdds['weights']) {
    if (session.user?.role !== 'admin' || !adminOdds.value || oddsPending.value) return false;
    const epoch = generation;
    oddsPending.value = true;
    try {
      const next = readGachaOdds(
        await request('/api/admin/gacha/odds', {
          method: 'POST',
          body: { weights, revision: adminOdds.value.revision },
        }),
      );
      if (epoch !== generation) return false;
      adminOdds.value = next;
      await load();
      if (epoch !== generation) return false;
      oddsMessage.value = '權重已儲存，新的抽取將使用此設定。';
      oddsNotice.value++;
      return true;
    } catch (e) {
      if (epoch === generation) {
        oddsMessage.value = e instanceof Error ? e.message : '儲存結果未確認，請重新讀取權重。';
        oddsNotice.value++;
      }
      return false;
    } finally {
      if (epoch === generation) oddsPending.value = false;
    }
  }
  function exchange(key: string) {
    if (unsettled.value) return Promise.resolve(null);
    return execute({ operation: 'exchange', requestId: crypto.randomUUID(), key });
  }
  async function loadHistory() {
    const epoch = generation;
    try {
      const value = record(await request('/api/gacha/history'));
      const entries = array(value.operations).map((entry) => {
        const operation = record(entry).operation;
        if (operation !== 'draw' && operation !== 'exchange') throw Error('抽卡紀錄格式不正確');
        return readGachaReceipt(entry, operation);
      });
      if (epoch === generation) history.value = entries;
    } catch (e) {
      if (epoch === generation) {
        message.value = e instanceof Error ? e.message : '紀錄讀取失敗';
        notice.value++;
      }
    }
  }
  watch(
    identity,
    () => {
      generation++;
      loadGeneration++;
      controllers.forEach((c) => c.abort());
      controllers.clear();
      state.value = null;
      last.value = null;
      history.value = [];
      adminOdds.value = null;
      oddsPending.value = false;
      oddsMessage.value = '';
      pending.value = loading.value = false;
      unsettled.value = null;
      if (identity.value) {
        restore();
        void load();
      }
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    generation++;
    controllers.forEach((c) => c.abort());
    controllers.clear();
  });
  return {
    state,
    loading,
    pending,
    message,
    notice,
    last,
    unsettled,
    history,
    load,
    draw,
    exchange,
    loadHistory,
    recover: () => (unsettled.value ? execute(unsettled.value) : Promise.resolve(null)),
    adminOdds,
    oddsPending,
    oddsMessage,
    oddsNotice,
    loadOdds,
    saveOdds,
  };
});
