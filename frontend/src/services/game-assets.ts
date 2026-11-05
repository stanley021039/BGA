import sceneTombstone from '../assets/scene-tombstone.svg?no-inline';
import type { GameType } from '../contracts/room';
import { requestJson } from './http';
import { record, strings } from './validation';
import { preloadAllowed, warm, whenIdle } from './preload';
import AudioSettings from '../engines/audio-settings.js';
import athleteTrackPreview from '../assets/second-wind/twisty-twirl-1600.webp';

// Art and sounds a game uses only once play starts, warmed while seats fill up.
// Sound files follow the registry in public/shared/audio-settings.js.
const sound = (name: string) => '/assets/game-sounds/' + name;
export function warmNewSkillAssets(effect: string, width = 0, height = 0) {
  if (effect.replace(/_alt$/, '') === 'shaohua_devour')
    warm(['/assets/attacks/shaohua-closed.webp', '/assets/attacks/shaohua-open.webp']);
  if (effect.replace(/_alt$/, '') === 'reaper_seal') {
    const scale = Math.min(1.1, Math.max(0.38, height / 700), width / 550);
    warm([
      scale < 0.37
        ? '/assets/attacks/reaper-person-128.webp'
        : scale < 0.74
          ? '/assets/attacks/reaper-person-256.webp'
          : '/assets/attacks/reaper-person-512.webp',
    ]);
  }
}
const inGame: Partial<Record<GameType, readonly string[]>> = {
  'second-wind': [athleteTrackPreview],
  quacks: [
    '/assets/quacks/draw-777.webp',
    '/assets/quacks/stop-portrait-v1.webp',
    '/assets/quacks/explosion-reference-v1.webp',
    '/assets/quacks/fortune-back.svg',
    sound('quacks-push-user.wav'),
    sound('quacks-decline-user.wav'),
    sound('quacks-explosion-fish.wav'),
    sound('quacks-settlement-user.wav'),
    sound('quacks-settlement.wav'),
    sound('quacks-danger.wav'),
    sound('quacks-drink-real.mp3'),
    sound('quacks-buy.wav'),
    sound('quacks-ruby.wav'),
    sound('quacks-witch.wav'),
    sound('quacks-card.wav'),
  ],
  bluff: ['/assets/bluff-reaction-photo-144.webp', sound('bluff-reaction.mp3')],
  musicquiz: [sound('correct-user.mp3'), sound('incorrect-user.mp3')],
  thunder: [
    sound('dice-roll.wav'),
    sound('nitro.wav'),
    sound('skid.wav'),
    sound('slam.wav'),
    sound('shot.wav'),
  ],
  majority: [sound('quacks-settlement-user.wav')],
};
const decryptoSounds = [
  sound('quacks-buy.wav'),
  sound('quacks-ruby.wav'),
  sound('quacks-settlement.wav'),
  sound('quacks-settlement-user.wav'),
];

export function warmGame(type: GameType): void {
  warm([sceneTombstone, ...(inGame[type] || [])]);
  if (type === 'decrypto' && preloadAllowed())
    whenIdle(() => {
      const effects = AudioSettings?.get()?.effects;
      if (effects?.enabled && effects.volume && !document.hidden)
        warm(decryptoSounds, { idle: false });
    });
}

// The room page of each game, so choosing a game card starts loading it.
const pages = new Map<string, Promise<void>>();
export function warmGamePage(type: GameType | 'market'): void {
  if (type === 'market' || pages.has(type) || !preloadAllowed()) return;
  pages.set(
    type,
    requestJson('/api/frontend/page-assets?type=' + encodeURIComponent(type))
      .then((value) => warm(strings(record(value).assets), { idle: false }))
      .catch(() => {
        pages.delete(type);
      }),
  );
}
