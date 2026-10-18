import { createApp } from 'vue';
import type { Component } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { usePreferencesStore } from '../stores/preferences';

// Each HTML document owns its app/stores. BFCache restoration creates a fresh scope.
export function mountPage(component: Component, selector: string): void {
  let stop: (() => void) | undefined;
  function start(): void {
    if (stop) return;
    const pinia = createPinia();
    const app = createApp(component);
    app.use(pinia);
    usePreferencesStore(pinia);
    app.mount(selector);
    document.documentElement.dataset.frontend = 'vue';
    stop = () => { app.unmount(); disposePinia(pinia); stop = undefined; };
  }
  start();
  window.addEventListener('pagehide', () => stop?.());
  window.addEventListener('pageshow', event => { if (event.persisted) start(); });
}
