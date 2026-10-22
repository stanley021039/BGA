import { mountPage } from '../../runtime/mount-page';
import AchievementsPage from './AchievementsPage.vue';
import '../../styles/achievements.scss';
import '../../../../public/shared/achievement-glow.css';

mountPage(AchievementsPage, '#achievements-app');
