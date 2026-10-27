import sceneTombstone from '../assets/scene-tombstone.svg?no-inline';
import type { GameType } from '../contracts/room';
import { requestJson } from './http';
import { record, strings } from './validation';
import { preloadAllowed, warm } from './preload';
import athleteTrackPreview from '../assets/second-wind/twisty-twirl-1600.webp';

// Art and sounds a game uses only once play starts, warmed while seats fill up.
// Sound files follow the registry in public/shared/audio-settings.js.
const sound = (name: string) => '/assets/game-sounds/' + name;
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

export function warmGame(type: GameType): void {
  warm([sceneTombstone, ...(inGame[type] || [])]);
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
