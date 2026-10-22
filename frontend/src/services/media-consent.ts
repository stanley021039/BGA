// One video decision per browser tab: entering other rooms keeps it, a reload asks again.
// Must match the legacy rule in public/shared/table-media.js.
export const MEDIA_CONSENT_KEY = 'bga.media.consent.v2';
const LEGACY_KEY = 'bga.media.consents.v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createMediaConsent(
  session: StoragePort | null,
  local: Pick<Storage, 'removeItem'> | null,
  navigationType: string,
) {
  let decision: boolean | undefined;
  try {
    local?.removeItem(LEGACY_KEY);
  } catch {
    /* The old per-room record is only cleanup. */
  }
  try {
    if (navigationType === 'reload') session?.removeItem(MEDIA_CONSENT_KEY);
    else {
      const saved = session?.getItem(MEDIA_CONSENT_KEY);
      if (saved === 'accepted') decision = true;
      else if (saved === 'declined') decision = false;
    }
  } catch {
    /* Without storage the decision lives for this page only. */
  }
  return {
    get: () => decision,
    set(accept: boolean) {
      decision = accept;
      try {
        session?.setItem(MEDIA_CONSENT_KEY, accept ? 'accepted' : 'declined');
      } catch {
        /* Never infer acceptance from unavailable storage. */
      }
    },
  };
}

function navigationType() {
  try {
    const entry = performance.getEntriesByType?.('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    if (entry) return entry.type;
    return performance.navigation?.type === 1 ? 'reload' : 'navigate';
  } catch {
    return 'navigate';
  }
}
function storage(name: 'sessionStorage' | 'localStorage') {
  try {
    return globalThis[name];
  } catch {
    return null;
  }
}

let shared: ReturnType<typeof createMediaConsent> | null = null;
// Evaluated once per page load so remounting the media window never clears a fresh choice.
export function mediaConsent() {
  shared ??= createMediaConsent(
    storage('sessionStorage'),
    storage('localStorage'),
    navigationType(),
  );
  return shared;
}
