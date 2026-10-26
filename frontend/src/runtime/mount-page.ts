import '../engines/entry-intro.js';
import '../styles/noto-sans-tc.css';
import { createApp, Fragment, h, Teleport, defineAsyncComponent } from 'vue';
import type { App, Component } from 'vue';
import { createPinia, disposePinia, type Pinia } from 'pinia';
import { usePreferencesStore } from '../stores/preferences';
import SiteHeader from '../components/SiteHeader.vue';
import { resetMediaConsentOnReload } from '../services/media-consent';
import '../styles/foundations.scss';
import '../styles/feedback.scss';
import '../styles/controls.scss';
import '../styles/ui-components.scss';

// Each HTML document owns its app/stores. BFCache restoration creates a fresh scope.
export function mountPage(
  component: Component,
  selector: string,
  configure?: (app: App, pinia: Pinia) => void,
): void {
  const tutorialPaths = [
    'poker',
    'race',
    'majority',
    'gift',
    'draw',
    'trpg',
    'quacks',
    'bluff',
    'telephone',
    'musicquiz',
    'minimal',
    'ceo',
    'second-wind',
  ];
  if (
    new URLSearchParams(location.search).get('learn') === '1' &&
    !new URLSearchParams(location.search).has('detail') &&
    tutorialPaths.includes(location.pathname.split('/')[1])
  )
    component = defineAsyncComponent(() => import('../pages/tutorial/TutorialPage.vue'));
  if (new URLSearchParams(location.search).get('learn') === '1' && location.pathname === '/market')
    component = defineAsyncComponent(() => import('../pages/tutorial/MarketTutorialPage.vue'));
  // Before any room media reads it: a reload of any page asks for video consent again.
  resetMediaConsentOnReload();
  let stop: (() => void) | undefined;
  function start(): void {
    if (stop) return;
    const pinia = createPinia();
    const header = document.querySelector<HTMLElement>('#site-header-app');
    if (header) {
      header.classList.add('vue-page', 'vue-site-header');
      header.setAttribute('data-ui-owner', 'vue');
    }
    const app = createApp({
      render: () =>
        h(Fragment, [header ? h(Teleport, { to: header }, h(SiteHeader)) : null, h(component)]),
    });
    app.use(pinia);
    // Pinia setup runs in app.runWithContext; its injections must belong to the app.
    configure?.(app, pinia);
    usePreferencesStore(pinia);
    document.querySelector(selector)?.classList.add('vue-page');
    // Legacy enhancement observers must not reparent Vue-owned form/dialog nodes.
    document.querySelector<HTMLElement>(selector)?.setAttribute('data-ui-owner', 'vue');
    app.mount(selector);
    document.documentElement.dataset.frontend = 'vue';
    stop = () => {
      app.unmount();
      disposePinia(pinia);
      stop = undefined;
    };
  }
  start();
  window.addEventListener('pagehide', () => stop?.());
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) start();
  });
}
