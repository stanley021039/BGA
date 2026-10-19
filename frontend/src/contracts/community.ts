import { array, record, strings, text } from '../services/validation';
import type { Topic } from './libraries';

export const gameNames: Record<string, string> = {
  general: '大廳／其他',
  majority: '同頻俱樂部',
  thunder: '雷霆之路',
  poker: '德州撲克',
  gift: '送禮達人',
  draw: '你畫我猜',
};
export const typeNames: Record<string, string> = {
  two: '二選一',
  three: '三選一',
  blank: '填空題',
};
export const statusNames: Record<string, string> = {
  closed: '已處理',
  processing: '處理中',
  open: '待處理',
};
export interface Comment {
  name: string;
  body: string;
  at: string;
}
export interface Issue {
  id: string;
  game: string;
  status: string;
  title: string;
  body: string;
  name: string;
  at: string;
  githubUrl: string;
  comments: Comment[];
}
export interface Question {
  id: string;
  type: string;
  topic: string;
  prompt: string;
  pack: string;
  author: string;
  options: string[];
}
export function readIssues(value: unknown): Issue[] {
  return array(value).map((value) => {
    const x = record(value);
    return {
      id: text(x.id),
      game: text(x.game),
      status: text(x.status, 'open'),
      title: text(x.title),
      body: text(x.body),
      name: text(x.name),
      at: text(x.at),
      githubUrl: text(x.githubUrl),
      comments: array(x.comments).map((value) => {
        const c = record(value);
        return { name: text(c.name), body: text(c.body), at: text(c.at) };
      }),
    };
  });
}
export function readQuestions(value: unknown): { questions: Question[]; topics: Topic[] } {
  const x = record(value);
  return {
    questions: array(x.questions).map((value) => {
      const q = record(value);
      return {
        id: text(q.id),
        type: text(q.type),
        topic: text(q.topic),
        prompt: text(q.prompt),
        pack: text(q.pack),
        author: text(q.author),
        options: strings(q.options),
      };
    }),
    topics: array(x.topics).map((value) => {
      const t = record(value);
      return { id: text(t.id), label: text(t.label) };
    }),
  };
}
export function safeIssueUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      /^\/stanley021039\/BGA\/issues\/[1-9][0-9]*$/.test(url.pathname)
      ? url.href
      : '';
  } catch {
    return '';
  }
}
