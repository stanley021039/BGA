import { mountPage } from '../../runtime/mount-page';
import LoginPage from './LoginPage.vue';
import '../../styles/auth.scss';

mountPage(LoginPage, '#auth-app');
