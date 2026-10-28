import AudioSettings from '../engines/audio-settings.js';
import type { RoomInvitation } from '../contracts/invitations';

// One owner per signed-in document. Keep pending IDs across reload/BFCache in
// this tab; neither a poll nor a dialog render is a new notification.
export function createInvitationSound(userId: string, blocked: (value: boolean) => void) {
  const key = 'bga-invitation-sounds-v1:' + userId,
    seen = new Set<string>();
  let clip: HTMLAudioElement | undefined,
    revision = 0,
    disposed = false;
  try {
    const raw = sessionStorage.getItem(key);
    const saved: unknown = raw && raw.length <= 40000 ? JSON.parse(raw) : [];
    if (Array.isArray(saved))
      for (const id of saved.slice(-256)) {
        if (typeof id === 'string' && id.length > 0 && id.length <= 128) seen.add(id);
      }
  } catch {
    /* Restricted storage still keeps in-document deduplication. */
  }
  function stop() {
    revision++;
    AudioSettings?.stopEffect(clip);
    clip = undefined;
  }
  function play() {
    const settings = AudioSettings?.get().effects;
    if (disposed || document.hidden || !settings?.enabled || !settings.volume) return;
    stop();
    const token = revision;
    let failed = false;
    const next = AudioSettings?.playEffect?.('invitation', {
      onError: () => {
        failed = true;
        if (!disposed && token === revision && !document.hidden) blocked(true);
      },
    });
    clip = failed ? undefined : next;
    if (next && !failed) blocked(false);
  }
  function observe(items: RoomInvitation[]) {
    if (disposed) return;
    let fresh = false;
    for (const item of items) {
      if (!seen.has(item.id)) fresh = true;
      // Refresh active IDs before pruning so pending invitations stay remembered.
      seen.delete(item.id);
      seen.add(item.id);
    }
    while (seen.size > 256) seen.delete(seen.values().next().value!);
    try {
      sessionStorage.setItem(key, JSON.stringify([...seen]));
    } catch {
      /* Best effort. */
    }
    if (!items.length) blocked(false);
    if (fresh) play(); // A burst shares one short cue; hidden/muted cues are never queued.
  }
  function visibility() {
    if (document.hidden) stop();
  }
  const unsubscribe = AudioSettings?.subscribe((settings) => {
    if (!settings.effects.enabled || !settings.effects.volume) {
      stop();
      blocked(false);
    }
  });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', stop);
  return {
    observe,
    enable: play, // Explicit gesture plays a sample; it does not replay an invitation.
    destroy() {
      disposed = true;
      stop();
      unsubscribe?.();
      blocked(false);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', stop);
    },
  };
}
