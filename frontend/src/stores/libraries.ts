import { defineStore } from 'pinia';
import { useResource } from '../composables/resource';
import {
  readWordLibrary,
  readGiftLibrary,
  readMusicLibrary,
  readArtworks,
} from '../contracts/libraries';

export const useWordsStore = defineStore('library.words', () =>
  useResource(async (request) => readWordLibrary(await request('/api/draw/words'))),
);
export const useGiftsStore = defineStore('library.gifts', () =>
  useResource(async (request) => {
    const [gifts, artworks] = await Promise.all([
      request('/api/community/gifts'),
      request('/api/artworks'),
    ]);
    return { ...readGiftLibrary(gifts), artworks: readArtworks(artworks) };
  }),
);
export const useMusicStore = defineStore('library.music', () =>
  useResource(async (request) => readMusicLibrary(await request('/api/music'))),
);
