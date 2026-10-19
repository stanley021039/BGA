import type { InjectionKey } from 'vue';
import type { MarketImage } from '../../contracts/market';
export const marketImagePreviewKey:InjectionKey<(image:MarketImage)=>void>=Symbol('market-image-preview');
