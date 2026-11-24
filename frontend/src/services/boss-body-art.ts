// Literal paths receive content hashes from Vite. Warm only bosses present in the scene.
import { sizedImage } from './image-size';
export const bossPhaseArt: Record<string, Record<number, string>> = {
  'dark-zagi': {
    2: '/assets/characters/boss-dark-zagi-phase-2.webp',
    3: '/assets/characters/boss-dark-zagi-phase-3.webp',
  },
  'gleam-eyes': {
    2: '/assets/characters/boss-gleam-eyes-phase-2.webp',
    3: '/assets/characters/boss-gleam-eyes-phase-3.webp',
  },
  mutalith: {
    2: '/assets/characters/boss-mutalith-phase-2.webp',
    3: '/assets/characters/boss-mutalith-phase-3.webp',
  },
  cthulhu: {
    2: '/assets/characters/boss-cthulhu-phase-2.webp',
    3: '/assets/characters/boss-cthulhu-phase-3.webp',
  },
  gatanozoa: {
    2: '/assets/characters/boss-gatanozoa-phase-2.webp',
    3: '/assets/characters/boss-gatanozoa-phase-3.webp',
  },
  arkveld: {
    2: '/assets/characters/boss-arkveld-phase-2.webp',
    3: '/assets/characters/boss-arkveld-phase-3.webp',
  },
  greeza: {
    2: '/assets/characters/boss-greeza-phase-2.webp',
    3: '/assets/characters/boss-greeza-phase-3.webp',
  },
  'hyper-zetton': {
    2: '/assets/characters/boss-hyper-zetton-phase-2.webp',
    3: '/assets/characters/boss-hyper-zetton-phase-3.webp',
  },
  colossal: {
    2: '/assets/characters/boss-colossal-phase-2.webp',
    3: '/assets/characters/boss-colossal-phase-3.webp',
  },
  'steel-behemoth': {
    2: '/assets/characters/boss-steel-behemoth-phase-2.webp',
    3: '/assets/characters/boss-steel-behemoth-phase-3.webp',
  },
  'prismatic-void': {
    2: '/assets/characters/boss-prismatic-void-phase-2.webp',
    3: '/assets/characters/boss-prismatic-void-phase-3.webp',
  },
  gyo: {
    2: '/assets/characters/boss-gyo-phase-2.webp',
    3: '/assets/characters/boss-gyo-phase-3.webp',
  },
  'ghidorah-turtle': {
    2: '/assets/characters/boss-ghidorah-turtle-phase-2.webp',
    3: '/assets/characters/boss-ghidorah-turtle-phase-3.webp',
  },
};
export function bossPhaseImage(id: string, phase: number, fallback: string, size: 128 | 256 | 512) {
  return sizedImage(bossPhaseArt[id]?.[phase] || fallback, size);
}
