import { array, record } from './validation';
export interface ActionFeedback {
  id: string;
  at: number;
  actor: { id: string; name: string };
  action: string;
  target?: { id: string; name: string };
  item?: { color: string; value: number };
}
export function readActionFeedback(value: unknown): ActionFeedback[] {
  if (value === undefined) return [];
  return array(value)
    .slice(-20)
    .flatMap((value) => {
      try {
        const r = record(value),
          actor = record(r.actor);
        if (
          typeof r.id !== 'string' ||
          typeof r.at !== 'number' ||
          !Number.isFinite(r.at) ||
          typeof r.action !== 'string' ||
          typeof actor.id !== 'string' ||
          typeof actor.name !== 'string'
        )
          return [];
        const e: ActionFeedback = {
          id: r.id,
          at: r.at,
          action: r.action,
          actor: { id: actor.id, name: actor.name },
        };
        if (r.target) {
          const t = record(r.target);
          if (typeof t.id === 'string' && typeof t.name === 'string')
            e.target = { id: t.id, name: t.name };
        }
        if (r.item) {
          const t = record(r.item);
          if (
            ['orange', 'green', 'blue', 'red', 'yellow', 'purple', 'black'].includes(
              String(t.color),
            ) &&
            [1, 2, 4].includes(Number(t.value))
          )
            e.item = { color: String(t.color), value: Number(t.value) };
        }
        return [e];
      } catch {
        return [];
      }
    });
}
export function createActionFeedbackQueue() {
  let identity = '',
    seen = new Set<string>(),
    queue: ActionFeedback[] = [];
  return {
    update(next: string, events: ActionFeedback[], now: number, hidden = false) {
      if (next !== identity || hidden) {
        identity = next;
        seen = new Set(events.map((e) => e.id));
        queue = [];
        return;
      }
      for (const e of events) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        if (now - e.at <= 12000 && e.at <= now + 5000) queue.push(e);
      }
      if (seen.size > 160) seen = new Set([...seen].slice(-80));
      queue = queue.slice(-20);
    },
    next() {
      return queue.splice(0, 3);
    },
    reset() {
      identity = '';
      seen.clear();
      queue = [];
    },
  };
}
