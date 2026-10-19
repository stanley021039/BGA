import { computed, inject, type ComputedRef, type InjectionKey } from 'vue';
import { useRoomStore } from '../stores/room';
import type { GameType } from '../contracts/room';

export interface PingSurface {
  type: GameType | 'lobby';
  players: { id: string; name: string }[];
  pingContext?: unknown;
}
export interface InteractionSource {
  snapshot: ComputedRef<PingSurface | null>;
  identity: ComputedRef<string>;
  code: ComputedRef<string>;
  request(
    action: string,
    body?: Record<string, unknown>,
    options?: { signal?: AbortSignal; query?: Record<string, string>; affectsConnection?: boolean },
  ): Promise<unknown>;
}
export const interactionSourceKey: InjectionKey<InteractionSource> = Symbol('interaction-source');

// A page can provide a public lobby source without inventing a game seat.
export function useInteractionSource(): InteractionSource {
  const source = inject(interactionSourceKey, null);
  if (source) return source;
  const room = useRoomStore();
  return {
    snapshot: computed(() => room.snapshot),
    code: computed(() => room.code),
    identity: computed(() =>
      !room.seat || !room.snapshot || room.terminal
        ? ''
        : `${room.scope}:${room.code}:${room.snapshot.me}:${String((room.snapshot.media as Record<string, unknown> | undefined)?.roomInstanceId || '')}`,
    ),
    request: (action, body, options) => room.request(action, body, options),
  };
}
