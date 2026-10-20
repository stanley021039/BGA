import { defineStore } from 'pinia';
import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { useRequests } from '../composables/requests';
import { ApiError, requestJson } from '../services/http';
import {
  readAdminUsers,
  readAdminSubmissions,
  readAdminRetry,
  readAdminOK,
  readAdminSecret,
  readShareOrigin,
} from '../contracts/admin';
import type { AdminUser, AdminSubmission, AdminSecret } from '../contracts/admin';
export const useAdminStore = defineStore('admin', () => {
  const requests = useRequests(),
    users = shallowRef<AdminUser[]>([]),
    submissions = shallowRef<AdminSubmission[]>([]),
    secret = shallowRef<AdminSecret | null>(null);
  const days = ref(7),
    revokeCode = ref(''),
    usersLoading = ref(false),
    usersLoaded = ref(false),
    usersError = ref(''),
    submissionsLoading = ref(false),
    submissionsLoaded = ref(false),
    submissionsError = ref(''),
    forbidden = ref(false);
  const pending = ref(false),
    operation = ref(''),
    invitationMessage = ref(''),
    invitationFailed = ref(false),
    memberMessage = ref(''),
    memberFailed = ref(false),
    syncMessage = ref(''),
    syncFailed = ref(false),
    copyMessage = ref(''),
    uncertain = ref('');
  const canWrite = computed(() => usersLoaded.value && !forbidden.value && !pending.value);
  let usersVersion = 0,
    submissionVersion = 0,
    writeSent = false;
  function clearSecret() {
    secret.value = null;
    copyMessage.value = '';
  }
  function deny() {
    forbidden.value = true;
    usersLoaded.value = false;
    submissionsLoaded.value = false;
    users.value = [];
    submissions.value = [];
    clearSecret();
    requests.cancel();
  }
  async function call(path: string, body?: Record<string, unknown>) {
    return requests.run(async (signal) => {
      const controller = new AbortController(),
        cancel = () => controller.abort(signal.reason),
        timeout = setTimeout(
          () =>
            controller.abort(
              new DOMException('結果尚未確認，請先更新狀態，勿直接重送操作。', 'TimeoutError'),
            ),
          15000,
        );
      signal.addEventListener('abort', cancel, { once: true });
      try {
        signal.throwIfAborted();
        if (body !== undefined) writeSent = true;
        return await requestJson(path, {
          method: body === undefined ? 'GET' : 'POST',
          body,
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          deny();
          if (error.status === 401) location.replace('/login?next=' + encodeURIComponent('/admin'));
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancel);
      }
    });
  }
  async function loadUsers() {
    const version = ++usersVersion;
    usersLoading.value = true;
    usersError.value = '';
    try {
      const list = readAdminUsers(await call('/api/admin/users'));
      if (requests.active() && version === usersVersion && !forbidden.value) {
        users.value = list;
        usersLoaded.value = true;
      }
      return true;
    } catch (error) {
      if (requests.active() && version === usersVersion) {
        usersError.value = error instanceof Error ? error.message : '無法載入會員名單';
      }
      return false;
    } finally {
      if (requests.active() && version === usersVersion) usersLoading.value = false;
    }
  }
  async function loadSubmissions() {
    const version = ++submissionVersion;
    submissionsLoading.value = true;
    submissionsError.value = '';
    try {
      const list = readAdminSubmissions(await call('/api/admin/submissions'));
      if (requests.active() && version === submissionVersion && !forbidden.value) {
        submissions.value = list;
        submissionsLoaded.value = true;
      }
      return true;
    } catch (error) {
      if (requests.active() && version === submissionVersion)
        submissionsError.value = error instanceof Error ? error.message : '無法載入提交清單';
      return false;
    } finally {
      if (requests.active() && version === submissionVersion) submissionsLoading.value = false;
    }
  }
  async function refreshAccess() {
    forbidden.value = false;
    await Promise.allSettled([loadUsers(), loadSubmissions()]);
  }
  async function mutate(
    key: string,
    panel: 'invite' | 'member' | 'sync',
    work: () => Promise<void>,
    success: string,
  ) {
    if (!canWrite.value) return false;
    pending.value = true;
    operation.value = key;
    writeSent = false;
    clearSecret();
    const message =
        panel === 'invite' ? invitationMessage : panel === 'member' ? memberMessage : syncMessage,
      failed =
        panel === 'invite' ? invitationFailed : panel === 'member' ? memberFailed : syncFailed;
    message.value = '正在處理…';
    failed.value = false;
    try {
      await work();
      if (!requests.active()) return false;
      if (success) message.value = success;
      uncertain.value = '';
      return true;
    } catch (error) {
      if (requests.active()) {
        failed.value = true;
        message.value = error instanceof Error ? error.message : '操作失敗';
        if (writeSent && (!(error instanceof ApiError) || !error.status || error.status >= 500))
          uncertain.value = key;
      }
      return false;
    } finally {
      if (requests.active()) {
        pending.value = false;
        operation.value = '';
      }
    }
  }
  async function invite() {
    return mutate(
      'invite',
      'invite',
      async () => {
        if (!Number.isInteger(days.value) || days.value < 1 || days.value > 90)
          throw Error('邀請碼期限需為 1–90 天');
        const origin = readShareOrigin(await call('/api/info'), location.origin);
        const value = readAdminSecret(
          await call('/api/admin/invites', { days: days.value }),
          'invite',
          origin,
        );
        if (requests.active()) secret.value = value;
      },
      '邀請碼已產生。請安全交給對方；離開頁面後無法再次查閱。',
    );
  }
  async function revoke() {
    const code = revokeCode.value.trim();
    return mutate(
      'revoke',
      'invite',
      async () => {
        if (!code) throw Error('請輸入要撤銷的邀請碼');
        readAdminOK(await call('/api/admin/invites/revoke', { code }));
        revokeCode.value = '';
      },
      '邀請碼已撤銷。',
    );
  }
  async function reset(user: AdminUser) {
    return mutate(
      'reset:' + user.id,
      'member',
      async () => {
        const value = readAdminSecret(
          await call('/api/admin/resets', { userId: user.id }),
          'reset',
          location.origin,
          user.displayName + '（' + user.username + '）',
        );
        if (requests.active()) secret.value = value;
      },
      '密碼重設連結已產生。連結只在此頁保留，請安全交給指定會員。',
    );
  }
  async function setDisabled(user: AdminUser) {
    return mutate(
      'disable:' + user.id,
      'member',
      async () => {
        if (user.role === 'admin') throw Error('不能變更管理者帳號狀態');
        usersVersion++;
        usersLoading.value = false;
        readAdminOK(
          await call('/api/admin/users/disable', { userId: user.id, disabled: !user.disabled }),
        );
        await loadUsers();
      },
      '會員狀態已更新。',
    );
  }
  async function retry(item: AdminSubmission) {
    let done = false;
    const ok = await mutate(
      'retry:' + item.id,
      'sync',
      async () => {
        const current = submissions.value.find((s) => s.id === item.id);
        if (!current || current.state !== 'needs_review')
          throw Error('提交狀態已更新，請先重新確認清單');
        submissionVersion++;
        submissionsLoading.value = false;
        const result = readAdminRetry(await call('/api/admin/submissions/retry', { id: item.id }));
        if (result.id !== item.id) throw Error('收到其他提交的結果，請更新清單確認');
        done = result.state === 'done';
        syncMessage.value = done ? '同步完成。' : result.error || '仍需確認 GitHub 結果。';
        await loadSubmissions();
      },
      '',
    );
    if (ok && !done) syncFailed.value = true;
    return ok;
  }
  async function copySecret() {
    const current = secret.value;
    if (!current) return;
    copyMessage.value = '';
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(current.href);
        copied = true;
      }
    } catch {}
    if (!copied && secret.value === current) {
      const before = document.activeElement,
        field = document.createElement('textarea');
      field.value = current.href;
      field.setAttribute('aria-label', '暫存複製連結');
      field.style.position = 'fixed';
      field.style.left = '-9999px';
      document.body.append(field);
      field.select();
      try {
        copied = document.execCommand('copy');
      } catch {
      } finally {
        field.value = '';
        field.remove();
        if (before instanceof HTMLElement && before.isConnected) before.focus();
      }
    }
    if (requests.active() && secret.value === current)
      copyMessage.value = copied ? '連結已複製。' : '無法自動複製，請選取上方連結手動複製。';
  }
  onScopeDispose(() => {
    clearSecret();
    revokeCode.value = '';
    usersVersion++;
    submissionVersion++;
  });
  return {
    users,
    submissions,
    secret,
    days,
    revokeCode,
    usersLoading,
    usersLoaded,
    usersError,
    submissionsLoading,
    submissionsLoaded,
    submissionsError,
    forbidden,
    pending,
    operation,
    canWrite,
    invitationMessage,
    invitationFailed,
    memberMessage,
    memberFailed,
    syncMessage,
    syncFailed,
    copyMessage,
    uncertain,
    loadUsers,
    loadSubmissions,
    refreshAccess,
    invite,
    revoke,
    reset,
    setDisabled,
    retry,
    copySecret,
    clearSecret,
  };
});
