import { computed, onScopeDispose, ref, shallowRef, type Ref } from 'vue';

interface PictureInPictureBrowser {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
}
// Own exactly one native window. Vue keeps ownership of the mounted surface;
// move it back into its original Teleport range before closing/unmounting.
// PiP documents are about:blank, so embeds inside them send no Referer and
// YouTube refuses to play (error 153). The surface therefore lives in a
// same-origin frame whose http URL supplies one.
const frameUrl = '/media-pip-frame',
  frameTimeout = 10000;
function loadFrame(view: Window): Promise<Document> {
  const shell = view.document,
    frame = shell.createElement('iframe');
  shell.title = '媒體子母畫面';
  shell.body.style.margin = '0';
  shell.body.style.overflow = 'hidden';
  Object.assign(frame.style, { display: 'block', border: '0', width: '100vw', height: '100vh' });
  frame.title = '媒體子母畫面';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('PiP frame timed out')), frameTimeout);
    frame.addEventListener(
      'load',
      () => {
        clearTimeout(timer);
        const target = frame.contentDocument;
        if (target?.body && target.URL !== 'about:blank') resolve(target);
        else reject(new Error('PiP frame unavailable'));
      },
      { once: true },
    );
    frame.src = new URL(frameUrl, document.baseURI).href;
    shell.body.append(frame);
  });
}
export function useDocumentPip(
  surface: Ref<HTMLElement | null>,
  moved: () => void,
  restored: () => void,
  keydown: (event: KeyboardEvent) => void,
) {
  const browser = window as Window & { documentPictureInPicture?: PictureInPictureBrowser };
  const available = !!browser.documentPictureInPicture,
    native = shallowRef<Window | null>(null),
    busy = ref(false),
    message = ref('');
  let generation = 0,
    disposed = false,
    home: Node | null = null,
    anchor: Comment | null = null,
    observer: MutationObserver | null = null,
    content: Document | null = null;
  const sizeKey = 'bga.media.pip.size.v1';
  function mirror() {
    const target = content;
    if (!target) return;
    for (const name of ['class', 'style', 'lang', 'data-color-scheme']) {
      const value = document.documentElement.getAttribute(name);
      if (value === null) target.documentElement.removeAttribute(name);
      else target.documentElement.setAttribute(name, value);
    }
    target.body.dataset.visualTheme = document.body.dataset.visualTheme || 'playful';
    target.documentElement.classList.toggle(
      'motion-reduced',
      document.documentElement.classList.contains('motion-reduced') || target.hidden,
    );
  }
  function remember() {
    const view = native.value;
    if (!view || view.closed) return;
    try {
      localStorage.setItem(
        sizeKey,
        JSON.stringify({ width: view.innerWidth, height: view.innerHeight }),
      );
    } catch {
      /* Optional local size preference. */
    }
  }
  function restore() {
    const view = native.value;
    if (!view) return;
    remember();
    view.removeEventListener('pagehide', restore);
    view.removeEventListener('resize', remember);
    content?.defaultView?.removeEventListener('pagehide', restore);
    content?.removeEventListener('keydown', keydown);
    content?.removeEventListener('visibilitychange', mirror);
    content = null;
    observer?.disconnect();
    observer = null;
    native.value = null;
    for (const modal of surface.value?.querySelectorAll<HTMLDialogElement>('.vue-dialog[open]') ||
      [])
      modal.close();
    if (surface.value && home)
      home.insertBefore(surface.value, anchor?.parentNode === home ? anchor : null);
    anchor?.remove();
    anchor = null;
    home = null;
    if (!disposed) restored();
  }
  function close() {
    generation++;
    busy.value = false;
    const view = native.value;
    restore();
    if (view && !view.closed) view.close();
  }
  async function open() {
    if (disposed || busy.value) return;
    if (native.value && !native.value.closed) {
      native.value.focus();
      return;
    }
    message.value = '';
    if (!browser.documentPictureInPicture) {
      message.value = '此瀏覽器不支援獨立子母視窗，仍可使用頁內「縮小視窗」。';
      return;
    }
    if (!surface.value?.parentNode) return;
    const epoch = ++generation;
    busy.value = true;
    let view: Window | null = null;
    try {
      let width = 430,
        height = 580;
      try {
        const saved = JSON.parse(localStorage.getItem(sizeKey) || 'null');
        if (Number.isFinite(saved?.width) && Number.isFinite(saved?.height)) {
          width = Math.max(300, Math.min(960, saved.width));
          height = Math.max(300, Math.min(900, saved.height));
        }
      } catch {
        /* Browser placement remains available without storage. */
      }
      // Called before the first await, while the click's user activation is live.
      view = await browser.documentPictureInPicture.requestWindow({ width, height });
      if (disposed || epoch !== generation || !surface.value?.parentNode) {
        view.close();
        return;
      }
      const target = await loadFrame(view);
      if (disposed || epoch !== generation || !surface.value?.parentNode || view.closed) {
        view.close();
        return;
      }
      for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
        const copy = node.cloneNode(true) as HTMLElement;
        if (node instanceof HTMLLinkElement) (copy as HTMLLinkElement).href = node.href;
        target.head.append(copy);
      }
      target.body.className = 'vue-media-pip-document';
      home = surface.value.parentNode;
      anchor = document.createComment('media-pip-home');
      home.insertBefore(anchor, surface.value);
      native.value = view;
      content = target;
      mirror();
      target.body.append(surface.value);
      view.addEventListener('pagehide', restore);
      // Closing the window may tear the frame down before the outer pagehide;
      // nodes adopted back after that lose their event listeners.
      target.defaultView?.addEventListener('pagehide', restore);
      view.addEventListener('resize', remember);
      target.addEventListener('keydown', keydown);
      target.addEventListener('visibilitychange', mirror);
      observer = new MutationObserver(mirror);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'style', 'lang', 'data-color-scheme'],
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-visual-theme'] });
      moved();
    } catch {
      restore();
      if (view && !view.closed) view.close();
      if (!disposed && epoch === generation)
        message.value = '子母視窗未能開啟，請直接按按鈕重試；目前的頁內播放器會繼續使用。';
    } finally {
      if (epoch === generation) busy.value = false;
    }
  }
  function dispose() {
    disposed = true;
    close();
  }
  // A hard navigation does not necessarily unmount Vue before the document dies.
  const pagehide = () => close();
  window.addEventListener('pagehide', pagehide);
  onScopeDispose(() => {
    window.removeEventListener('pagehide', pagehide);
    dispose();
  });
  return {
    available,
    active: computed(() => !!native.value),
    native,
    busy,
    message,
    open,
    close,
    dispose,
  };
}
