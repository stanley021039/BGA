import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { ApiError, requestJson } from '../services/http';
import { readAchievements } from '../contracts/achievements';
import type { Achievement } from '../contracts/achievements';

export const achievementGroups = [
  { key: 'draw', label: '你畫我猜', icon: 'edit' },
  { key: 'gift', label: '送禮達人', icon: 'gift' },
  { key: 'majority', label: '同頻俱樂部', icon: 'users' },
  { key: 'poker', label: '德州撲克', icon: 'cards' },
  { key: 'thunder', label: '雷霆之路', icon: 'car' },
  { key: 'quacks', label: '郎中闖江湖', icon: 'table' },
  { key: 'musicquiz', label: '猜歌挑戰', icon: 'sound' },
  { key: 'bluff', label: '瞎掰王', icon: 'emoji' },
  { key: 'telephone', label: '傳情畫意', icon: 'edit' },
  { key: 'minimal', label: '極簡藝術家', icon: 'edit' },
  { key: 'trpg', label: '故事冒險', icon: 'book' },
  { key: 'all', label: '跨桌探索', icon: 'table' },
  { key: 'other', label: '其他成就', icon: 'book' },
];
export const achievementGroupKey = (item: Achievement): string =>
  achievementGroups.some((group) => group.key === item.game && group.key !== 'other')
    ? item.game
    : 'other';

export const useAchievementsStore = defineStore('achievements', () => {
  const items = shallowRef<Achievement[]>([]);
  const loading = ref(false),
    loaded = ref(false),
    error = ref('');
  const gameFilter = ref('*'),
    statusFilter = ref('*');
  let controller: AbortController | null = null;
  const unlocked = computed(() => items.value.filter((item) => item.unlockedAt).length);
  const availableGroups = computed(() =>
    achievementGroups.filter((group) =>
      items.value.some((item) => achievementGroupKey(item) === group.key),
    ),
  );
  const filtered = computed(() =>
    items.value.filter(
      (item) =>
        (gameFilter.value === '*' || achievementGroupKey(item) === gameFilter.value) &&
        (statusFilter.value === '*' || (statusFilter.value === 'unlocked') === !!item.unlockedAt),
    ),
  );
  const groups = computed(() =>
    achievementGroups.flatMap((group) => {
      const visible = filtered.value.filter((item) => achievementGroupKey(item) === group.key);
      const total = items.value.filter((item) => achievementGroupKey(item) === group.key);
      return visible.length
        ? [
            {
              ...group,
              items: visible,
              total: total.length,
              unlocked: total.filter((item) => item.unlockedAt).length,
            },
          ]
        : [];
    }),
  );

  async function load(): Promise<void> {
    if (loading.value) return;
    const request = (controller = new AbortController());
    loading.value = true;
    error.value = '';
    try {
      const response = await requestJson('/api/achievements', { signal: request.signal });
      if (controller !== request) return;
      items.value = readAchievements(response);
      loaded.value = true;
      if (!availableGroups.value.some((group) => group.key === gameFilter.value))
        gameFilter.value = '*';
    } catch (reason) {
      if (controller !== request || request.signal.aborted) return;
      if (reason instanceof ApiError && reason.status === 401) {
        location.replace('/login');
        return;
      }
      error.value = reason instanceof Error ? reason.message : '無法載入成就';
    } finally {
      if (controller === request) {
        loading.value = false;
        controller = null;
      }
    }
  }
  onScopeDispose(() => {
    controller?.abort();
    controller = null;
  });
  return {
    items,
    loading,
    loaded,
    error,
    gameFilter,
    statusFilter,
    unlocked,
    availableGroups,
    filtered,
    groups,
    load,
  };
});
