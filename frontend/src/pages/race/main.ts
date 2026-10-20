import { mountPage } from '../../runtime/mount-page';
import RacePage from './RacePage.vue';
import RaceLessonPage from './RaceLessonPage.vue';
import '../../styles/race.scss';
mountPage(
  new URLSearchParams(location.search).get('learn') === '1' ? RaceLessonPage : RacePage,
  '#race-app',
);
