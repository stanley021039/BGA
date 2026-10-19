import { record } from '../services/validation';
export const drawingTopics = [
  ['food', '食物飲料'],
  ['animals', '動物生物'],
  ['transport', '交通工具'],
  ['objects', '生活物品'],
  ['people', '人物職業'],
  ['nature', '自然奇幻'],
  ['places', '場所娛樂'],
  ['activities', '運動音樂'],
  ['meme', '迷因 Meme'],
  ['custom', '自定義'],
] as const;
export interface DrawSettingsDraft {
  topics: string[];
  seconds: number;
  mode: 'legacy' | 'rounds' | 'score';
  rounds: number | string;
  score: number | string;
}
export function readDrawSettings(value: unknown): DrawSettingsDraft {
  const row = record(value),
    ending = row.ending && typeof row.ending === 'object' ? record(row.ending) : {};
  const topics = drawingTopics
    .filter(([id]) =>
      Array.isArray(row.topics)
        ? row.topics.includes(id)
        : id === 'custom'
          ? row.customPercent !== 0
          : !row.topic || row.topic === 'all' || row.topic === id,
    )
    .map(([id]) => id);
  const mode = ending.value == null ? 'legacy' : ending.mode === 'score' ? 'score' : 'rounds';
  return {
    topics,
    seconds: typeof row.seconds === 'number' ? row.seconds : 90,
    mode,
    rounds: mode === 'rounds' && typeof ending.value === 'number' ? ending.value : 8,
    score: mode === 'score' && typeof ending.value === 'number' ? ending.value : 100,
  };
}
export function drawSettingsKey(value: DrawSettingsDraft): string {
  return JSON.stringify([
    drawingTopics.filter(([id]) => value.topics.includes(id)).map(([id]) => id),
    value.seconds,
    value.mode,
    value.mode === 'legacy' ? null : Number(value[value.mode]),
  ]);
}
export function drawSettingsPayload(value: DrawSettingsDraft): Record<string, unknown> {
  const topics = drawingTopics.filter(([id]) => value.topics.includes(id)).map(([id]) => id);
  if (!topics.length) throw Error('請至少選擇一個題目類別。');
  if (![60, 90, 120].includes(value.seconds)) throw Error('作畫時間請選 60、90 或 120 秒。');
  if (value.mode === 'legacy') return { seconds: value.seconds, topics };
  const number = Number(value[value.mode]),
    min = value.mode === 'score' ? 10 : 1,
    max = value.mode === 'score' ? 1000 : 64;
  if (!Number.isInteger(number) || number < min || number > max)
    throw Error(
      value.mode === 'score' ? '目標分數需為 10–1000 的整數。' : '固定總題數需為 1–64 的整數。',
    );
  return { seconds: value.seconds, topics, ending: { mode: value.mode, value: number } };
}
