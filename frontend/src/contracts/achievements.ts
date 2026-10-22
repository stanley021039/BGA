export interface Achievement {
  rewardLabels: string[];
  id: string;
  title: string;
  description: string;
  game: string;
  category: string;
  icon: string;
  unlockedAt: string | null;
  status: 'enabled' | 'paused';
}

export function readAchievements(value: unknown): Achievement[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !Array.isArray((value as Record<string, unknown>).achievements)
  ) {
    throw new Error('成就資料格式不正確，請重新載入。');
  }
  return ((value as Record<string, unknown>).achievements as unknown[]).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const id = row.achievement_id || row.id;
    if (
      typeof id !== 'string' ||
      !(
        row.status === undefined ||
        row.status === 'enabled' ||
        (row.status === 'paused' && row.unlockedAt)
      )
    )
      return [];
    return [
      {
        id,
        rewardLabels: Array.isArray(row.rewardLabels)
          ? row.rewardLabels.filter((v): v is string => typeof v === 'string')
          : [],
        title: typeof row.title === 'string' ? row.title : '未命名成就',
        description: typeof row.description === 'string' ? row.description : '',
        game: typeof row.game === 'string' ? row.game : 'other',
        category: typeof row.category === 'string' ? row.category : '',
        icon: typeof row.icon_key === 'string' ? row.icon_key : '',
        unlockedAt: typeof row.unlockedAt === 'string' && row.unlockedAt ? row.unlockedAt : null,
        status: row.status === 'paused' ? ('paused' as const) : ('enabled' as const),
      },
    ];
  });
}
