import { createApp, Fragment, h, Teleport } from 'vue';
import type { Component } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { usePreferencesStore } from '../stores/preferences';
import SiteHeader from '../components/SiteHeader.vue';
import '../styles/foundations.scss';
import '../styles/feedback.scss';
import '../styles/controls.scss';

// Each HTML document owns its app/stores. BFCache restoration creates a fresh scope.
export function mountPage(component: Component, selector: string): void {
  let stop: (() => void) | undefined;
  function start(): void {
    if (stop) return;
    const pinia = createPinia();
    const header = document.querySelector<HTMLElement>('#site-header-app');
    if (header) { header.classList.add('vue-page', 'vue-site-header'); header.setAttribute('data-ui-owner', 'vue'); }
    const app = createApp({ render: () => h(Fragment, [header ? h(Teleport, { to: header }, h(SiteHeader)) : null, h(component)]) });
    app.use(pinia);
    usePreferencesStore(pinia);
    document.querySelector(selector)?.classList.add('vue-page');
    // Legacy enhancement observers must not reparent Vue-owned form/dialog nodes.
    document.querySelector<HTMLElement>(selector)?.setAttribute('data-ui-owner', 'vue');
    app.mount(selector);
    document.documentElement.dataset.frontend = 'vue';
    stop = () => { app.unmount(); disposePinia(pinia); stop = undefined; };
  }
  start();
  window.addEventListener('pagehide', () => stop?.());
  window.addEventListener('pageshow', event => { if (event.persisted) start(); });
}
