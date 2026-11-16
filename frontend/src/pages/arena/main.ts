import { mountPage } from '../../runtime/mount-page';
import ArenaPage from '../lobby/LobbyArena.vue';
import TrainingGround from '../lobby/TrainingGround.vue';
import '../../styles/lobby.scss';
if (new URLSearchParams(location.search).has('training')) document.title = '特效訓練場｜302捉猶團';

mountPage(
  new URLSearchParams(location.search).has('training') ? TrainingGround : ArenaPage,
  '#arena-app',
);
