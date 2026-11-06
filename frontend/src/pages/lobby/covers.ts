import type { LobbyCardId } from './catalog';
import dramaBar360 from '../../assets/lobby/covers/drama-bar-cover-360.webp?no-inline';
import dramaBar680 from '../../assets/lobby/covers/drama-bar-cover-680.webp?no-inline';
import secondWind360 from '../../assets/lobby/covers/second-wind-cover-360.webp?no-inline';
import secondWind680 from '../../assets/lobby/covers/second-wind-cover-680.webp?no-inline';
import ceo360 from '../../assets/lobby/covers/ceo-cover-360.webp?no-inline';
import ceo680 from '../../assets/lobby/covers/ceo-cover-680.webp?no-inline';
import musicquiz360 from '../../assets/lobby/covers/musicquiz-cover-360.webp?no-inline';
import musicquiz680 from '../../assets/lobby/covers/musicquiz-cover-680.webp?no-inline';
import quacks360 from '../../assets/lobby/covers/quacks-cover-360.webp?no-inline';
import quacks680 from '../../assets/lobby/covers/quacks-cover-680.webp?no-inline';
import bluff360 from '../../assets/lobby/covers/bluff-cover-360.webp?no-inline';
import bluff680 from '../../assets/lobby/covers/bluff-cover-680.webp?no-inline';
import trpg360 from '../../assets/lobby/covers/trpg-cover-360.webp?no-inline';
import trpg680 from '../../assets/lobby/covers/trpg-cover-680.webp?no-inline';
import poker360 from '../../assets/lobby/covers/poker-cover-360.webp?no-inline';
import poker680 from '../../assets/lobby/covers/poker-cover-680.webp?no-inline';
import thunder360 from '../../assets/lobby/covers/thunder-cover-360.webp?no-inline';
import thunder680 from '../../assets/lobby/covers/thunder-cover-680.webp?no-inline';
import majority360 from '../../assets/lobby/covers/majority-cover-360.webp?no-inline';
import majority680 from '../../assets/lobby/covers/majority-cover-680.webp?no-inline';
import gift360 from '../../assets/lobby/covers/gift-cover-360.webp?no-inline';
import gift680 from '../../assets/lobby/covers/gift-cover-680.webp?no-inline';
import draw360 from '../../assets/lobby/covers/draw-cover-360.webp?no-inline';
import draw680 from '../../assets/lobby/covers/draw-cover-680.webp?no-inline';
import market360 from '../../assets/lobby/covers/market-cover-360.webp?no-inline';
import market680 from '../../assets/lobby/covers/market-cover-680.webp?no-inline';
import lounge360 from '../../assets/lobby/covers/lounge-cover-360.webp?no-inline';
import lounge680 from '../../assets/lobby/covers/lounge-cover-680.webp?no-inline';
import coc360 from '../../assets/lobby/cthulhu-fog-360.webp?no-inline';
import coc680 from '../../assets/lobby/cthulhu-fog-680.webp?no-inline';

function responsiveCover(thumb: string, large: string) {
  return { src: thumb, srcset: `${thumb} 360w, ${large} 680w` };
}

export const lobbyCovers = {
  'drama-bar': responsiveCover(dramaBar360, dramaBar680),
  'second-wind': responsiveCover(secondWind360, secondWind680),
  ceo: responsiveCover(ceo360, ceo680),
  musicquiz: responsiveCover(musicquiz360, musicquiz680),
  quacks: responsiveCover(quacks360, quacks680),
  bluff: responsiveCover(bluff360, bluff680),
  trpg: responsiveCover(trpg360, trpg680),
  poker: responsiveCover(poker360, poker680),
  thunder: responsiveCover(thunder360, thunder680),
  majority: responsiveCover(majority360, majority680),
  gift: responsiveCover(gift360, gift680),
  draw: responsiveCover(draw360, draw680),
  market: responsiveCover(market360, market680),
  lounge: responsiveCover(lounge360, lounge680),
  coc: responsiveCover(coc360, coc680),
} satisfies Record<LobbyCardId, ReturnType<typeof responsiveCover>>;
