import { mountPage } from '../../runtime/mount-page';
import Page from './LobbyPage.vue';
import { useLobbyStore } from '../../stores/lobby';
import { interactionSourceKey } from '../../services/interaction-source';
import '../../styles/lobby.scss';
mountPage(Page, '#lobby-app', (app, pinia) =>
  app.provide(interactionSourceKey, useLobbyStore(pinia).interaction),
);
