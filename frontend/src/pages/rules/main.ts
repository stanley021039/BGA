import { mountPage } from '../../runtime/mount-page';
import Page from './RulesPage.vue';
import '../../styles/documents.scss';
if (new URLSearchParams(location.search).get('game') !== 'poker') location.replace('/race?learn=1');
else mountPage(Page, '#rules-app');
