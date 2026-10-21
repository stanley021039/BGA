import { onScopeDispose, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { BarrageController, BarrageRenderer, ExpressionPlayback } from '../contracts/social';
import type { RoomSnapshot } from '../contracts/room';
export interface MotionGate {
  update(snapshot: RoomSnapshot, options: { connected: boolean }): boolean;
  take(key: string, eligible?: boolean): boolean;
  dispose(): void;
}

type Theme = 'auto' | 'light' | 'dark';
interface ColorState {
  preference: Theme;
  scheme: 'light' | 'dark';
}
interface MotionState {
  enabled: boolean;
  barrages: boolean;
  reduced: boolean;
}
interface EntryState {
  enabled: boolean;
  persisted: boolean;
}
interface AudioState {
  version: number;
  music: { enabled: boolean; volume: number };
  effects: { enabled: boolean; volume: number };
}
export interface FrameOption {
  id: string;
  label: string;
  group?: string;
}
interface FrameState {
  version: number;
  enabled: boolean;
  selected: string;
}

declare global {
  interface Window {
    EntryPreferences?: {
      get(): EntryState;
      set(enabled: boolean): EntryState;
      subscribe(fn: (state: EntryState) => void): () => void;
    };
    ColorScheme?: {
      get(): ColorState;
      set(theme: Theme): ColorState;
      subscribe(fn: (state: ColorState) => void): () => void;
    };
    MotionPolicy?: {
      get(): MotionState;
      set(value: Partial<MotionState>): MotionState;
      subscribe(fn: (state: MotionState) => void): () => void;
      createBarrageController(show: BarrageRenderer): BarrageController;
      createGate(): MotionGate;
      allowsMotion(): boolean;
      animate(
        node: Element | null,
        keyframes: Keyframe[],
        options: KeyframeAnimationOptions,
      ): Animation | null;
    };
    AudioSettings?: {
      get(): AudioState;
      subscribe(fn: (state: AudioState) => void): () => void;
      bindPreview(audio: HTMLAudioElement): () => void;
      set(
        kind: 'music' | 'effects',
        value: { enabled?: boolean; volume?: number },
        options?: { gesture?: boolean },
      ): void;
      stopEffect(clip: HTMLAudioElement | null | undefined): boolean;
      playEffect?(cue: string, options?: { onError?: () => void }): HTMLAudioElement | undefined;
      playExpression(
        sound: { url: string; durationMs: number },
        options?: { onStop?: (clip: HTMLAudioElement) => void; onError?: () => void },
      ): HTMLAudioElement | undefined;
    };
    ExpressionSounds?: {
      encodeFile(file: File | null): Promise<{ base64: string; durationMs: number }>;
      create(): ExpressionPlayback;
    };
    BarrageFrames?: {
      options: readonly FrameOption[];
      canUse?(id: string): boolean;
      get(): FrameState;
      set(value: Partial<FrameState>): FrameState;
      subscribe(fn: (state: FrameState) => void): () => void;
      decorate(
        node: HTMLElement,
        frame: { kind: 'builtin'; id: string; version: 1 },
        name: string,
        message: string,
      ): HTMLElement;
      place(layer: HTMLElement, bubble: HTMLElement): boolean;
    };
    MediaAppearance?: {
      get(): string;
      set(id: string): string;
      subscribe(fn: (id: string) => void): () => void;
    };
  }
}

// Bridge to the existing preference owners during migration. No duplicate storage schema.
export const usePreferencesStore = defineStore('preferences', () => {
  const color = shallowRef<ColorState | null>(null);
  const motion = shallowRef<MotionState | null>(null);
  const entry = shallowRef<EntryState | null>(null);
  const audio = shallowRef<AudioState | null>(null);
  const barrage = shallowRef<FrameState | null>(null),
    media = shallowRef('default');
  const frames = window.BarrageFrames?.options || [];
  const unsubscribers: (() => void)[] = [];
  if (window.EntryPreferences)
    unsubscribers.push(
      window.EntryPreferences.subscribe((value) => {
        entry.value = value;
      }),
    );
  if (window.ColorScheme)
    unsubscribers.push(
      window.ColorScheme.subscribe((value) => {
        color.value = value;
      }),
    );
  if (window.MotionPolicy)
    unsubscribers.push(
      window.MotionPolicy.subscribe((value) => {
        motion.value = value;
      }),
    );
  if (window.AudioSettings)
    unsubscribers.push(
      window.AudioSettings.subscribe((value) => {
        audio.value = value;
      }),
    );
  if (window.BarrageFrames)
    unsubscribers.push(
      window.BarrageFrames.subscribe((value) => {
        barrage.value = value;
      }),
    );
  if (window.MediaAppearance)
    unsubscribers.push(
      window.MediaAppearance.subscribe((value) => {
        media.value = value;
      }),
    );
  onScopeDispose(() => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  });
  function setFrame(kind: 'barrage' | 'media', id: string) {
    if (kind === 'barrage') window.BarrageFrames?.set({ selected: id });
    else window.MediaAppearance?.set(id);
  }
  return {
    canUse: (id: string) => window.BarrageFrames?.canUse?.(id) !== false,
    color,
    motion,
    entry,
    audio,
    barrage,
    media,
    frames,
    setFrame,
    setMotion: (enabled: boolean) => window.MotionPolicy?.set({ enabled }),
    setEntryIntro: (enabled: boolean) => window.EntryPreferences?.set(enabled),
    setTheme: (theme: Theme) => window.ColorScheme?.set(theme),
  };
});
