import { onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useSessionStore } from './session';
import { ApiError, requestJson } from '../services/http';
import { gamePath, readSeat, sessionKey } from '../contracts/room';
import { readInvitations, readInviteCandidates } from '../contracts/invitations';
import type { InviteCandidate, RoomInvitation } from '../contracts/invitations';

export const useInvitationsStore = defineStore('invitations', () => {
  const session = useSessionStore(), items = shallowRef<RoomInvitation[]>([]), users = shallowRef<InviteCandidate[]>([]), sending = shallowRef(new Set<string>());
  const loading = ref(false), error = ref(''), responding = ref(''), responseMessage = ref(''), responseFailed = ref(false), senderOpen = ref(false), senderCode = ref(''), candidateLoading = ref(false), candidateMessage = ref(''), candidateFailed = ref(false), canInvite = ref(false);
  let generation = 0, senderVersion = 0, disposed = false, unsupported = false, timer: ReturnType<typeof setTimeout> | null = null, pollJob: Promise<boolean> | null = null, candidateController: AbortController | null = null;
  const controllers = new Set<AbortController>();
  const current = (epoch: number) => !disposed && epoch === generation && !!session.user;
  async function request(path = '', data?: Record<string, unknown>, signal?: AbortSignal) {
    const controller = new AbortController(); controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(new DOMException('邀請結果尚未確認，請重新整理後再操作。', 'TimeoutError')), 10000);
    try { return await requestJson('/api/room-invitations' + path, { method: data ? 'POST' : 'GET', ...(data ? { body: data } : {}), signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal }); }
    catch (cause) { if (cause instanceof ApiError && cause.status === 401 && !controller.signal.aborted && !signal?.aborted) void session.refresh(); throw cause; }
    finally { clearTimeout(timeout); controllers.delete(controller); }
  }
  function schedule() { if (timer) clearTimeout(timer); timer = null; if (!disposed && session.user && !unsupported) timer = setTimeout(() => { timer = null; void poll(); }, document.hidden ? 30000 : 5000); }
  async function poll(force = false): Promise<boolean> {
    if (timer) clearTimeout(timer); timer = null;
    if (disposed || !session.user) return false; if (pollJob) return pollJob; if (force) unsupported = false; if (unsupported) return false;
    const epoch = generation; loading.value = true; error.value = '';
    const job = (async () => {
      try { const value = readInvitations(await request()); if (!current(epoch)) return false; items.value = value; if (senderOpen.value) await loadCandidates(); return true; }
      catch (cause) { if (current(epoch) && !(cause instanceof DOMException && cause.name === 'AbortError')) { if (cause instanceof ApiError && [401, 404].includes(cause.status)) unsupported = true; error.value = cause instanceof Error ? cause.message : '邀請暫時無法載入。'; } return false; }
      finally { if (current(epoch)) { loading.value = false; schedule(); } }
    })();
    pollJob = job; try { return await job; } finally { if (pollJob === job) pollJob = null; }
  }
  function closeSender() { senderVersion++; senderOpen.value = false; candidateController?.abort(); candidateController = null; candidateLoading.value = false; sending.value = new Set(); }
  function openSender(code: string) { closeSender(); senderCode.value = code; senderOpen.value = true; users.value = []; candidateMessage.value = ''; candidateFailed.value = false; canInvite.value = false; void loadCandidates(); }
  async function loadCandidates() {
    if (!senderOpen.value || !senderCode.value || !session.user || disposed) return false;
    candidateController?.abort(); const controller = new AbortController(); candidateController = controller;
    const epoch = generation, version = senderVersion, code = senderCode.value; candidateLoading.value = true;
    try { const data = readInviteCandidates(await request('/online?code=' + encodeURIComponent(code), undefined, controller.signal)); if (!current(epoch) || version !== senderVersion || candidateController !== controller) return false;
      users.value = data.users; canInvite.value = data.canInvite; candidateFailed.value = false; candidateMessage.value = data.reason || (!data.users.length ? '目前沒有可邀請的線上朋友。' : '選擇朋友送出邀請；對方確認後才會入座。'); return true;
    } catch (cause) { if (current(epoch) && version === senderVersion && candidateController === controller && !(cause instanceof DOMException && cause.name === 'AbortError')) { candidateFailed.value = true; candidateMessage.value = cause instanceof Error ? cause.message : '線上朋友暫時無法載入。'; } return false; }
    finally { if (candidateController === controller) { candidateController = null; candidateLoading.value = false; } }
  }
  async function send(user: InviteCandidate) {
    if (!senderOpen.value || !canInvite.value || user.pending || sending.value.has(user.id) || !users.value.some(item => item.id === user.id) || !session.user) return false;
    const epoch = generation, version = senderVersion, code = senderCode.value; sending.value = new Set([...sending.value, user.id]); candidateMessage.value = '正在送出邀請…'; candidateFailed.value = false;
    let message = '', failed = false;
    try { await request('', { code, targetId: user.id }); message = '已邀請 ' + user.name + '，等待對方確認。'; return true; }
    catch (cause) { failed = true; message = cause instanceof Error ? cause.message : '邀請未成功，請重新整理。'; return false; }
    finally { if (current(epoch) && version === senderVersion) { const next = new Set(sending.value); next.delete(user.id); sending.value = next; await loadCandidates(); if (current(epoch) && version === senderVersion) { candidateMessage.value = message; candidateFailed.value = failed; } } }
  }
  async function respond(invite: RoomInvitation, action: 'accept' | 'decline') {
    if (responding.value || !session.user || !items.value.some(item => item.id === invite.id) || action === 'accept' && !invite.canJoin) return false;
    const epoch = generation; responding.value = invite.id; responseMessage.value = action === 'accept' ? '正在加入房間…' : '正在婉拒…'; responseFailed.value = false;
    try { const value = await request('/respond', { id: invite.id, action }); if (!current(epoch)) return false;
      if (action === 'accept') { const seat = readSeat(value); try { const key = sessionKey(seat.type); localStorage.setItem(key, JSON.stringify(seat)); localStorage.setItem(key + ':' + seat.code, JSON.stringify(seat)); } catch { /* Cookie seat remains authoritative. */ } location.assign('/' + gamePath(seat.type) + '/' + seat.code); }
      else { responseMessage.value = '已婉拒邀請。'; await poll(); } return true;
    } catch (cause) { if (current(epoch) && !(cause instanceof DOMException && cause.name === 'AbortError')) { responseMessage.value = cause instanceof Error ? cause.message : '無法處理邀請。'; responseFailed.value = true; await poll(); } return false; }
    finally { if (current(epoch)) responding.value = ''; }
  }
  function reset() { generation++; closeSender(); for (const controller of controllers) controller.abort(); controllers.clear(); if (timer) clearTimeout(timer); timer = null; pollJob = null; unsupported = false; items.value = []; users.value = []; loading.value = false; responding.value = ''; error.value = responseMessage.value = ''; responseFailed.value = false; }
  watch(() => session.user?.id, () => { reset(); if (session.user) void poll(); }, { immediate: true, flush: 'sync' });
  function visibility() { if (!document.hidden) void poll(); else schedule(); }
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => { disposed = true; reset(); document.removeEventListener('visibilitychange', visibility); });
  return { items, users, sending, loading, error, responding, responseMessage, responseFailed, senderOpen, senderCode, candidateLoading, candidateMessage, candidateFailed, canInvite, poll, openSender, closeSender, loadCandidates, send, respond };
});
