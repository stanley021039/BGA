import { mountPage } from '../../runtime/mount-page';
import QuacksPage from './QuacksPage.vue';
import '../../styles/quacks.scss';
import '../../styles/quacks-dialogs.scss';
import '../../styles/quacks-setup.scss';
mountPage(QuacksPage, '#quacks-app');
