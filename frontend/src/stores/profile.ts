import { defineStore } from 'pinia';
import { useResource } from '../composables/resource';
import { readSettings, readCharacterOptions } from '../contracts/profile';
import { readArtworks } from '../contracts/libraries';

export const useProfileStore = defineStore('profile', () => useResource(async request => {
  const [settings, options, artworks] = await Promise.all([
    request('/api/profile/settings'), request('/api/profile/options'), request('/api/collection/avatars'),
  ]);
  return { ...readSettings(settings), ...readCharacterOptions(options), artworks: readArtworks(artworks) };
}));
