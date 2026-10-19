import { computed, onScopeDispose, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { ApiError, requestJson } from '../services/http';
import { readUser } from '../contracts/auth';
import type { Credentials, Registration, User } from '../contracts/auth';

export const useSessionStore = defineStore('session', () => {
  const user = shallowRef<User | null>(null);
  const pending = shallowRef(false);
  const authenticated = computed(() => user.value !== null);
  let generation = 0,
    refreshJob: Promise<void> | null = null;
  const requests = new Set<AbortController>();

  async function run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    requests.add(controller);
    const timer = setTimeout(
      () => controller.abort(new DOMException('帳號操作逾時，請重新確認結果。', 'TimeoutError')),
      10000,
    );
    try {
      return await operation(controller.signal);
    } finally {
      clearTimeout(timer);
      requests.delete(controller);
    }
  }

  async function refresh(): Promise<void> {
    if (refreshJob) return refreshJob;
    if (pending.value) return;
    const epoch = ++generation;
    const job = (async () => {
      try {
        const result = await run((signal) => requestJson('/api/auth/me', { signal }));
        if (epoch === generation) user.value = readUser(result);
      } catch (error) {
        if (epoch !== generation) return;
        if (error instanceof ApiError && error.status === 401) {
          user.value = null;
          return;
        }
        throw error;
      }
    })();
    refreshJob = job;
    try {
      await job;
    } finally {
      if (refreshJob === job) refreshJob = null;
    }
  }

  async function authenticate(
    mode: 'login' | 'register',
    payload: Credentials | Registration,
  ): Promise<void> {
    if (pending.value) throw new Error('正在處理帳號操作，請稍候');
    pending.value = true;
    const epoch = ++generation;
    try {
      const result = await run((signal) =>
        requestJson(`/api/auth/${mode}`, { method: 'POST', body: payload, signal }),
      );
      if (epoch === generation) user.value = readUser(result);
    } finally {
      if (epoch === generation) pending.value = false;
    }
  }

  async function resetPassword(payload: {
    password: string;
    confirmPassword: string;
    token: string;
  }): Promise<void> {
    if (pending.value) throw new Error('正在處理帳號操作，請稍候');
    pending.value = true;
    const epoch = ++generation;
    try {
      await run((signal) =>
        requestJson('/api/auth/reset', { method: 'POST', body: payload, signal }),
      );
      if (epoch === generation) user.value = null;
    } finally {
      if (epoch === generation) pending.value = false;
    }
  }

  async function logout(): Promise<void> {
    if (pending.value) throw new Error('正在處理帳號操作，請稍候');
    pending.value = true;
    const epoch = ++generation;
    for (const request of requests) request.abort();
    try {
      await run((signal) => requestJson('/api/auth/logout', { method: 'POST', body: {}, signal }));
      if (epoch === generation) user.value = null;
    } finally {
      if (epoch === generation) pending.value = false;
    }
  }

  function dispose(): void {
    generation++;
    for (const request of requests) request.abort();
    requests.clear();
    pending.value = false;
    user.value = null;
  }
  onScopeDispose(dispose);
  return { user, pending, authenticated, refresh, authenticate, resetPassword, logout, dispose };
});
