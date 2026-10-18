import { mountPage } from '../../runtime/mount-page';
import Page from './WordsPage.vue';
import '../../styles/auth.scss';
import '../../styles/resources.scss';

mountPage(Page, '#draw-words-app');
