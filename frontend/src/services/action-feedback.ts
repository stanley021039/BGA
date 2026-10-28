import { record } from './validation';
import type { ChatMessage } from '../contracts/social';
export interface ActionFeedback {
  id: string;
  at: number;
  actor: { id: string; name: string };
  action: string;
  target?: { id: string; name: string };
  item?: { color: string; value: number };
}
export function readActionFeedback(value: unknown): ActionFeedback[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-20).flatMap((value) => {
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
export interface ChatTimelineMessage extends ChatMessage {
  feedback?: ActionFeedback;
}
export function mergeChatTimeline(chat: ChatMessage[], feedback: unknown): ChatTimelineMessage[] {
  const rows = new Map<string, ChatTimelineMessage>();
  for (const message of chat.slice(-50)) {
    const id = 'chat:' + message.id;
    rows.set(id, { ...message, id });
  }
  for (const event of readActionFeedback(feedback)) {
    const id = 'action:' + event.id;
    rows.set(id, {
      id,
      name: event.actor.name,
      message: event.action + (event.target ? ' → ' + event.target.name : ''),
      at: event.at,
      feedback: event,
    });
  }
  return [...rows.values()].sort((a, b) => a.at - b.at);
}
