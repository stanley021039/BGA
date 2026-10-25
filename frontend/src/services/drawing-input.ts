import type { DrawingDraft, DrawingSession, DrawingStyle, Point } from '../contracts/drawing';
import { createStrokeSimplifier } from './stroke-simplify';

interface ActiveStroke extends DrawingDraft {
  pointerId: number;
  pointTimes: number[];
  startStamp: number | null;
  startNow: number;
  sent: boolean;
  simplifier: ReturnType<typeof createStrokeSimplifier>;
}
interface InputOptions {
  canvas: HTMLCanvasElement;
  session: DrawingSession;
  style: () => DrawingStyle;
  epoch: () => string | undefined;
  strokeId: () => string;
  feedback: (message: string) => void;
  now?: () => number;
}
// Same 512×256 input, point-time clock, 16-point/80ms flush and carry anchor as draw.js.
// Freehand samples are thinned within a fixed error bound before they use quota (#264);
// the unsent tip may be replaced, while anything already flushed stays immutable.
// The existing DrawTransport retains wire chunking, pacing, immutable retries and quotas.
export function createDrawingInput({
  canvas,
  session,
  style,
  epoch,
  strokeId,
  feedback,
  now = () => performance.now(),
}: InputOptions) {
  let active: ActiveStroke | null = null,
    pending: Point[] = [],
    pendingTimes: number[] = [],
    cursor: Point = [256, 128];
  let flushTimer: ReturnType<typeof setTimeout> | null = null,
    disposed = false;
  const brush = (tool: string) => tool === 'brush' || tool === 'erase';
  function clearFlush() {
    if (flushTimer !== null) clearTimeout(flushTimer);
    flushTimer = null;
  }
  function send(points: Point[], id: string, captured: DrawingStyle, times?: number[]) {
    void session.enqueue(points, id, captured, times);
  }
  function flush(final = false) {
    if (!active || !brush(active.tool)) return;
    clearFlush();
    if (pending.length > 1 || !active.sent) {
      const points = [...pending],
        times = [...pendingTimes],
        draft = active;
      if (points.length) {
        send(points, draft.strokeId, draft, times);
        if (active !== draft) return;
        draft.sent = true;
        draft.simplifier.commit();
        pending = final ? [] : [points[points.length - 1]!];
        pendingTimes = final ? [] : [times[times.length - 1]!];
      }
    }
    if (final) {
      pending = [];
      pendingTimes = [];
    }
  }
  function scheduleFlush() {
    if (flushTimer !== null || !active || !brush(active.tool)) return;
    const draft = active,
      captured = epoch();
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (!disposed && active === draft && epoch() === captured) flush();
    }, 80);
  }
  function samples(event: PointerEvent): { point: Point; stamp: number | null }[] {
    let coalesced: PointerEvent[] | undefined;
    if (event.type === 'pointermove')
      try {
        coalesced = event.getCoalescedEvents?.();
      } catch {
        /* Unsupported input implementations use the parent sample. */
      }
    const entries = (coalesced?.length ? coalesced : [event]).filter(
      (sample) => sample.pointerId === event.pointerId,
    );
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return [];
    return entries
      .map((sample) => ({
        point: [
          Math.max(0, Math.min(511, Math.floor(((sample.clientX - rect.left) * 512) / rect.width))),
          Math.max(0, Math.min(255, Math.floor(((sample.clientY - rect.top) * 256) / rect.height))),
        ] as Point,
        stamp: Number.isFinite(sample.timeStamp) && sample.timeStamp >= 0 ? sample.timeStamp : null,
      }))
      .filter((sample) => sample.point.every(Number.isFinite));
  }
  function collect(event: PointerEvent) {
    if (!active || session.view().commandBusy || event.pointerId !== active.pointerId) return false;
    const isBrush = brush(active.tool);
    let changed = false;
    for (const sample of samples(event)) {
      const point = sample.point,
        last = active.points[active.points.length - 1]!;
      const elapsed =
        sample.stamp !== null && active.startStamp !== null
          ? sample.stamp - active.startStamp
          : now() - active.startNow;
      const time = Math.min(
        120000,
        Math.max(active.pointTimes[active.pointTimes.length - 1]!, Math.round(elapsed)),
      );
      if (point[0] === last[0] && point[1] === last[1]) continue;
      // Replacing the unsent tip keeps the point count, so only new points need capacity.
      const replace = isBrush && pending.length > 1 && active.simplifier.fits(point);
      if (!replace && (active.points.length >= 30000 || !session.hasCapacity(1))) {
        feedback('本輪畫布點數已達上限，請放開後再操作。');
        break;
      }
      if (replace) {
        active.simplifier.push(point, true);
        active.points[active.points.length - 1] = point;
        active.pointTimes[active.pointTimes.length - 1] = time;
        pending[pending.length - 1] = point;
        pendingTimes[pendingTimes.length - 1] = time;
        session.replaceDraftTip(active.strokeId, point);
        cursor = point;
        changed = true;
        continue;
      }
      if (isBrush) {
        active.simplifier.push(point, false);
        active.points.push(point);
        active.pointTimes.push(time);
        pending.push(point);
        pendingTimes.push(time);
      } else {
        active.points = [active.points[0]!, point];
        pending = [...active.points];
      }
      session.appendDraft(active.strokeId, point, !isBrush);
      cursor = point;
      changed = true;
    }
    if (changed && isBrush) {
      if (pending.length >= 16) flush();
      else scheduleFlush();
    }
    return changed;
  }
  function down(event: PointerEvent) {
    if (disposed || !session.canDraw() || active || event.button !== 0) return;
    event.preventDefault();
    const view = session.view();
    if (
      view.quota.usedBatches >= 1000 ||
      view.quota.usedPoints >= 30000 ||
      !session.hasCapacity(1)
    ) {
      feedback('本輪筆畫額度已用完或仍在同步，請稍候。');
      return;
    }
    const sample = samples(event).at(-1);
    if (!sample) return;
    cursor = sample.point;
    const captured = { ...style() };
    if (captured.tool === 'fill') {
      send([cursor], strokeId(), captured);
      return;
    }
    const draft: ActiveStroke = {
      ...captured,
      strokeId: strokeId(),
      pointerId: event.pointerId,
      points: [cursor],
      pointTimes: [0],
      ...(captured.tool === 'brush' ? { curve: 'quadratic' as const } : {}),
      startStamp: sample.stamp,
      startNow: now(),
      sent: false,
      simplifier: createStrokeSimplifier(cursor),
    };
    if (!session.beginDraft(draft)) {
      feedback('畫布同步中的筆畫已達上限，請稍候。');
      return;
    }
    active = draft;
    pending = [cursor];
    pendingTimes = [0];
    canvas.setPointerCapture(event.pointerId);
    scheduleFlush();
    session.schedulePreview();
  }
  function move(event: PointerEvent) {
    if (!disposed && collect(event)) session.schedulePreview();
  }
  function finish(event?: PointerEvent) {
    if (!active || (event && event.pointerId !== active.pointerId)) return;
    event?.preventDefault();
    if (event?.type === 'pointerup') collect(event);
    clearFlush();
    session.cancelPreview();
    if (brush(active.tool)) flush(true);
    else
      send([active.points[0]!, active.points[active.points.length - 1]!], active.strokeId, active);
    if (!active) return;
    const draft = active;
    active = null;
    pending = [];
    pendingTimes = [];
    session.finishDraft(draft.strokeId);
    release(draft.pointerId);
    session.redraw();
  }
  function release(pointerId: number) {
    try {
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    } catch {
      /* The browser may have released capture already. */
    }
  }
  function cancel(failed = false) {
    clearFlush();
    session.cancelPreview();
    const draft = active;
    active = null;
    pending = [];
    pendingTimes = [];
    if (draft) {
      session.finishDraft(draft.strokeId, failed);
      release(draft.pointerId);
    }
  }
  function key(event: KeyboardEvent) {
    if (disposed || !session.canDraw()) return;
    const moves: Record<string, Point> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      },
      movement = moves[event.key];
    if (movement) {
      event.preventDefault();
      cursor = [
        Math.max(0, Math.min(511, cursor[0] + movement[0])),
        Math.max(0, Math.min(255, cursor[1] + movement[1])),
      ];
      feedback(`畫布位置 ${cursor[0] + 1}，${cursor[1] + 1}；按空白鍵落筆`);
    }
    if (event.key === ' ') {
      event.preventDefault();
      const captured = style();
      send([cursor], strokeId(), {
        ...captured,
        tool: captured.tool === 'fill' ? 'fill' : 'brush',
      });
    }
  }
  function dispose() {
    disposed = true;
    cancel();
  }
  return { down, move, finish, cancel, key, dispose };
}
