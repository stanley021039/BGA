import { array, number, record, text } from '../services/validation';

export interface Appearance {
  version: 5;
  characterId: string;
  expression: string;
}
export type Avatar =
  | { kind: 'character'; characterId: string; expression: string }
  | { kind: 'artwork'; artworkId: string };
export interface ExpressionSound {
  url: string;
  durationMs: number;
}
export interface Character {
  id: string;
  name: string;
  source: string;
  owned: boolean;
  shared: boolean;
  expressions: Record<string, string>;
  labels: Record<string, string>;
  sounds: Record<string, ExpressionSound>;
}
export interface ProfileSettings {
  appearance: Appearance;
  avatar: Avatar;
}
const dictionary = (value: unknown): Record<string, string> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (item): item is [string, string] => typeof item[1] === 'string',
        ),
      )
    : {};

export function readAppearance(value: unknown): Appearance {
  const x = record(value);
  if (x.version !== 5 || typeof x.characterId !== 'string' || typeof x.expression !== 'string')
    throw Error('角色設定資料格式不正確');
  return { version: 5, characterId: x.characterId, expression: x.expression };
}
export function readSettings(value: unknown): ProfileSettings {
  const x = record(value),
    a = record(x.avatar);
  if (
    a.kind === 'artwork'
      ? typeof a.artworkId !== 'string'
      : a.kind !== 'character' ||
        typeof a.characterId !== 'string' ||
        typeof a.expression !== 'string'
  )
    throw Error('頭像設定資料格式不正確');
  const avatar: Avatar =
    a.kind === 'artwork'
      ? { kind: 'artwork', artworkId: text(a.artworkId) }
      : {
          kind: 'character',
          characterId: text(a.characterId),
          expression: text(a.expression, 'neutral'),
        };
  return { appearance: readAppearance(x.appearance), avatar };
}
export function readCharacterOptions(value: unknown) {
  const x = record(value);
  return {
    defaults: readAppearance(x.defaults),
    expressionLabels: dictionary(x.expressionLabels),
    characters: array(x.characters).map((value) => {
      const c = record(value),
        sounds: Record<string, ExpressionSound> = {};
      if (c.sounds && typeof c.sounds === 'object')
        for (const [id, value] of Object.entries(c.sounds)) {
          const s = record(value);
          sounds[id] = { url: text(s.url), durationMs: number(s.durationMs) };
        }
      return {
        id: text(c.id),
        name: text(c.name),
        source: text(c.source),
        owned: c.owned === true,
        shared: c.shared === true,
        expressions: dictionary(c.expressions),
        labels: dictionary(c.labels),
        sounds,
      } satisfies Character;
    }),
  };
}
export function avatarKey(value: Avatar): string {
  return value.kind === 'artwork'
    ? 'artwork:' + value.artworkId
    : value.characterId + '|' + value.expression;
}
