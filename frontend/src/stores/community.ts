import { defineStore } from 'pinia';
import { useResource } from '../composables/resource';
import { readIssues, readQuestions } from '../contracts/community';
import { record, text } from '../services/validation';

export const useCommunityStore = defineStore('community', () =>
  useResource(async (request) => {
    const [issues, questions, me] = await Promise.all([
      request('/api/community/issues'),
      request('/api/community/questions'),
      request('/api/auth/me'),
    ]);
    const user = record(me);
    return {
      issues: readIssues(issues),
      ...readQuestions(questions),
      name: text(user.displayName),
      admin: user.role === 'admin',
    };
  }),
);
