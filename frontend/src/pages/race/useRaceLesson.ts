import { computed, onScopeDispose, reactive, ref, shallowRef } from 'vue';
import { readRaceSnapshot } from '../../contracts/race';
import type { RaceDomain } from '../../contracts/race';
import { LessonScenarios } from './lesson-scenarios.js';
import type { LessonScenario, LessonOutcome } from './lesson-scenarios.js';
import { raceLessonSteps } from './lesson-steps';
export function useRaceLesson() {
  const chapter = ref(0),
    sceneKey = ref(0),
    feedback = ref(''),
    failed = ref(false),
    hint = ref(false),
    busy = ref(false),
    moving = ref(false),
    foreground = ref(!document.hidden),
    now = ref(Date.now()),
    result = shallowRef<LessonOutcome | null>(null),
    state = shallowRef<ReturnType<typeof readRaceSnapshot> | null>(null);
  let scene: LessonScenario | undefined,
    disposed = false,
    generation = 0,
    diceTimer: ReturnType<typeof setTimeout> | undefined,
    clock: ReturnType<typeof setInterval> | undefined;
  const step = computed(() => raceLessonSteps[chapter.value]),
    practice = computed(() => step.value[4] !== undefined),
    success = computed(() => !!result.value?.ok),
    canNext = computed(() => !practice.value || (success.value && !moving.value)),
    mission = computed(() => (practice.value ? LessonScenarios.missions[step.value[4]!] : null));
  const query = new URLSearchParams(location.search),
    room = query.get('room') || '',
    exitHref =
      query.get('from') === 'game'
        ? '/race' + (/^[A-Fa-f0-9]{6}$/.test(room) ? '/' + room.toUpperCase() : '')
        : '/';
  const annotations = computed(() => {
    void state.value;
    const current = scene;
    if (!current) return [];
    const key = step.value[3],
      own = current.r.cars.filter((car) => car.owner === current.p.id),
      enemy = current.r.cars.find((car) => car.owner !== current.p.id && !car.dead),
      items: { x: number; y: number; label: string; color?: string }[] = [];
    const mark = (x: number, y: number, label: string, color?: string) =>
      items.push({ x, y, label, ...(color ? { color } : {}) });
    if (key === 'own') {
      const car = own[0];
      if (car) mark(car.x, car.y, '你的車隊', '#ffc06c');
      if (enemy) mark(enemy.x, enemy.y, '對手車隊', '#6be2df');
    }
    if (key === 'size' || key === 'damage')
      for (const car of own)
        mark(
          car.x,
          car.y,
          key === 'size'
            ? ['輕型車', '中型車', '重型車'][car.size]
            : `${car.damage.length} 損傷 · ${car.damage.length >= 2 ? '失能' : '可用'}`,
        );
    if (key === 'terrain') {
      mark(0, 4, '岩壁 · 淘汰');
      mark(0, 5, '泥地 · 2 點');
      mark(2, 6, '公路 · 1 點');
      mark(4, 5, '未知危險 · 進入揭露');
      mark(5, 16, '荒地 · 1 點');
    }
    if (key === 'heli') mark(3, 10, '直升機：不要停在下方');
    if (key === 'goal' || key === 'end')
      mark(current.car.x, current.car.y, '向右衝過終點', '#ffc06c');
    if (key === 'road') {
      mark(0, 3, '後段：新路接上時移除');
      mark(0, 11, '中段 → 後段');
      mark(0, 19, '前段 → 中段');
    }
    if (key === 'practice' && !result.value) {
      if (current.r.phase === 'assign') mark(current.car.x, current.car.y, '操作這輛車');
      if (step.value[4] === 3)
        mark(current.target.x, current.target.y, '靠近後才能射擊', '#6be2df');
    }
    return items;
  });
  function clearDice() {
    clearTimeout(diceTimer);
    diceTimer = undefined;
  }
  function publish() {
    if (!scene || disposed) return;
    now.value = Date.now();
    const value = scene.r.view(scene.p.id);
    state.value = readRaceSnapshot(
      { ...value, code: 'FFFFFF', serverNow: now.value, deadline: null },
      true,
    );
    result.value = scene.result;
  }
  function scheduleDice() {
    clearDice();
    const current = scene,
      check = current?.r.diceCheck,
      token = generation;
    if (!current || check?.status !== 'rolling' || !foreground.value) return;
    const id = check.id;
    diceTimer = setTimeout(
      () => {
        if (
          disposed ||
          token !== generation ||
          scene !== current ||
          current.r.diceCheck?.id !== id ||
          !foreground.value
        )
          return;
        current.r.advanceDice();
        current.result = LessonScenarios.outcome(current);
        publish();
      },
      Math.max(0, (check.readyAt || Date.now()) - Date.now()) + 5,
    );
  }
  function setup() {
    generation++;
    sceneKey.value++;
    clearDice();
    moving.value = false;
    busy.value = false;
    scene = LessonScenarios.createScenario(step.value[4] ?? 0);
    const { r, p } = scene;
    for (const car of r.cars)
      if (car.dead)
        Object.assign(car, {
          dead: false,
          x: car.size * 2,
          y: car.owner === p.id ? 11 : 18,
          damage: [],
        });
    if (!practice.value) {
      for (const car of r.cars) {
        car.x = car.size * 2;
        car.y = car.owner === p.id ? 2 : 13;
        car.damage = [];
      }
      r.terrain(0, 4).kind = 'X';
      r.terrain(0, 5).kind = 'M';
      r.terrain(2, 6).kind = 'R';
      r.terrain(4, 5).hazard = { kind: 'mine', face: false };
      if (step.value[3] === 'damage') {
        const medium = r.cars.find((c) => c.owner === p.id && c.size === 1),
          heavy = r.cars.find((c) => c.owner === p.id && c.size === 2);
        if (medium) medium.damage = ['dent'];
        if (heavy) heavy.damage = ['dent', 'dent'];
      }
      p.chopper = { x: 3, y: 10, chopper: true };
      r.finishAt = ['goal', 'end'].includes(step.value[3]) ? 24 : null;
      if (r.finishAt) {
        scene.car.y = 21;
        r.tileCount = 5;
      }
    }
    r.name = '雷霆之路 · 新手教學桌';
    r.code = 'FFFFFF';
    r.tiles.forEach((tile, index) => {
      tile.name = ['教學後段', '教學中段', '教學前段'][index] || '教學道路';
    });
    feedback.value = '';
    failed.value = false;
    hint.value = false;
    result.value = null;
    publish();
  }
  async function run(action: string, data: Record<string, unknown> = {}) {
    const current = scene;
    if (
      !current ||
      disposed ||
      !practice.value ||
      current.result ||
      moving.value ||
      busy.value ||
      !foreground.value ||
      current.r.actor() !== current.p.id
    ) {
      feedback.value = '目前是教學導覽，請使用教學面板前往操作練習。';
      failed.value = true;
      return false;
    }
    busy.value = true;
    failed.value = false;
    try {
      LessonScenarios.act(current, action, data);
      feedback.value = current.r.log[0] || '請看車輛位置與剩餘移動點數。';
      publish();
      scheduleDice();
      return true;
    } catch (error) {
      feedback.value = error instanceof Error ? error.message : '教學操作失敗，請核對目前階段';
      failed.value = true;
      return false;
    } finally {
      busy.value = false;
    }
  }
  function go(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= raceLessonSteps.length) return;
    chapter.value = index;
    setup();
  }
  function next() {
    if (!canNext.value) return;
    if (chapter.value === raceLessonSteps.length - 1) {
      location.href = exitHref;
      return;
    }
    go(chapter.value + 1);
  }
  function timers() {
    clearInterval(clock);
    if (!foreground.value) return;
    clock = setInterval(() => {
      now.value = Date.now();
    }, 250);
  }
  function visibility() {
    foreground.value = !document.hidden;
    timers();
    clearDice();
    if (foreground.value) {
      now.value = Date.now();
      scheduleDice();
    }
  }
  document.addEventListener('visibilitychange', visibility);
  setup();
  timers();
  onScopeDispose(() => {
    disposed = true;
    generation++;
    clearDice();
    clearInterval(clock);
    document.removeEventListener('visibilitychange', visibility);
    scene = undefined;
    state.value = null;
  });
  const model: RaceDomain & {
    lessonAnnotations: { x: number; y: number; label: string; color?: string }[];
    lessonFocus: string;
    lessonGoal: { x: number; y: number } | null;
    setLessonMoving: (moving: boolean) => void;
  } = reactive({
    get state() {
      return state.value;
    },
    get busy() {
      return busy.value;
    },
    get connected() {
      return foreground.value;
    },
    get canAct() {
      return (
        practice.value &&
        !result.value &&
        !moving.value &&
        !busy.value &&
        foreground.value &&
        !!state.value &&
        state.value.actor === state.value.me
      );
    },
    get notice() {
      return result.value?.text || feedback.value;
    },
    get failed() {
      return failed.value || result.value?.ok === false;
    },
    get now() {
      return now.value;
    },
    get offset() {
      return 0;
    },
    lesson: true,
    run,
    get lessonAnnotations() {
      return annotations.value;
    },
    get lessonFocus() {
      return step.value[3];
    },
    get lessonGoal() {
      return mission.value?.flag || null;
    },
    setLessonMoving(value: boolean) {
      moving.value = value;
    },
  });
  return {
    model,
    chapter,
    sceneKey,
    step,
    practice,
    success,
    result,
    hint,
    busy,
    moving,
    feedback,
    failed,
    canNext,
    mission,
    exitHref,
    go,
    next,
    retry: () => setup(),
    setMoving: (value: boolean) => {
      moving.value = value;
    },
    steps: raceLessonSteps,
  };
}
