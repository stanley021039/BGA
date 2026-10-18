import { onScopeDispose, shallowRef } from 'vue';
import { defineStore } from 'pinia';

type Theme = 'auto' | 'light' | 'dark';
interface ColorState { preference: Theme; scheme: 'light' | 'dark' }
interface MotionState { enabled: boolean; barrages: boolean; reduced: boolean }
interface AudioState {
  version: number;
  music: { enabled: boolean; volume: number };
  effects: { enabled: boolean; volume: number };
}

declare global {
  interface Window {
    ColorScheme?: { get(): ColorState; set(theme: Theme): ColorState; subscribe(fn: (state: ColorState) => void): () => void };
    MotionPolicy?: { get(): MotionState; subscribe(fn: (state: MotionState) => void): () => void };
    AudioSettings?: { get(): AudioState; subscribe(fn: (state: AudioState) => void): () => void };
  }
}

// Bridge to the existing preference owners during migration. No duplicate storage schema.
export const usePreferencesStore = defineStore('preferences', () => {
  const color = shallowRef<ColorState | null>(null);
  const motion = shallowRef<MotionState | null>(null);
  const audio = shallowRef<AudioState | null>(null);
  const unsubscribers: (() => void)[] = [];
  if (window.ColorScheme) unsubscribers.push(window.ColorScheme.subscribe(value => { color.value = value; }));
  if (window.MotionPolicy) unsubscribers.push(window.MotionPolicy.subscribe(value => { motion.value = value; }));
  if (window.AudioSettings) unsubscribers.push(window.AudioSettings.subscribe(value => { audio.value = value; }));
  onScopeDispose(() => { for (const unsubscribe of unsubscribers) unsubscribe(); });
  return { color, motion, audio, setTheme: (theme: Theme) => window.ColorScheme?.set(theme) };
});
