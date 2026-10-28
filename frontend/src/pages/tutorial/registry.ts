import { defineAsyncComponent } from 'vue';
import type { GameType, RoomSnapshot } from '../../contracts/room';
import { readPokerSnapshot } from '../../contracts/poker';
import { readRaceSnapshot } from '../../contracts/race';
import { readMajoritySnapshot } from '../../contracts/majority';
import { readGiftSnapshot } from '../../contracts/gift';
import { readDrawSnapshot } from '../../contracts/drawing';
import { readTrpgSnapshot } from '../../contracts/trpg';
import { readQuacksSnapshot } from '../../contracts/quacks';
import { readBluffSnapshot } from '../../contracts/bluff';
import { readTelephoneSnapshot } from '../../contracts/telephone';
import { readMusicQuizSnapshot } from '../../contracts/musicquiz';
import { readMinimalSnapshot } from '../../contracts/minimal';
import { readCeoSnapshot } from '../../contracts/ceo';
import { readAthleteSnapshot } from '../../contracts/second-wind';
export type TutorialType = Exclude<GameType, 'lounge'>;
interface Lesson {
  title: string;
  goal: string;
  points: readonly string[];
  reader: (v: unknown) => RoomSnapshot;
  scene: ReturnType<typeof defineAsyncComponent>;
}
export const lessons: Record<TutorialType, Lesson> = {
  poker: {
    title: '德州撲克',
    goal: '從盲注、輪流下注到攤牌分配底池。',
    points: [
      '每人兩張底牌；對手底牌在攤牌前保密。',
      '跟注補齊差額；過牌只在不用補注時可用，也可棄牌或加注。',
      '翻牌三張、轉牌一張、河牌一張；用七張中的最佳五張比牌，籌碼進入底池再分配。',
    ],
    reader: readPokerSnapshot,
    scene: defineAsyncComponent(() => import('../poker/PokerScene.vue')),
  },
  thunder: {
    title: '雷霆之路',
    goal: '指派骰子、移動一輛車、處理地形與射擊。',
    points: [
      '每隊三種車型；先選車輛與可用骰子。',
      '選亮起的格子移動，地形會改變費用；公路可能取得加速。',
      '移動後有目標才射擊；碰撞、損傷與道路延伸都會影響下一步。',
    ],
    reader: readRaceSnapshot,
    scene: defineAsyncComponent(() => import('../race/RaceScene.vue')),
  },
  majority: {
    title: '同頻俱樂部',
    goal: '出題、各自作答，觀察多數答案如何計分。',
    points: [
      '出題者先挑題型與題目；你可以在原本介面選題。',
      '每個人送出自己的答案，尚未揭曉時不公開其他人的選擇。',
      '唯一最大組至少兩人才得分；注意出題者未凝聚共識時的扣分規則。',
    ],
    reader: readMajoritySnapshot,
    scene: defineAsyncComponent(() => import('../majority/MajorityScene.vue')),
  },
  gift: {
    title: '送禮達人',
    goal: '分配禮物、標記喜好並逐位收禮。',
    points: [
      '秘密選擇送給每位朋友的禮物，並排出自己的喜好。',
      '送禮與喜好都準備好後，依序揭曉與接受禮物。',
      '選到朋友喜歡的禮物、收到自己喜歡的禮物，分別影響送禮和收禮分數。',
    ],
    reader: readGiftSnapshot,
    scene: defineAsyncComponent(() => import('../gift/GiftScene.vue')),
  },
  draw: {
    title: '你畫我猜',
    goal: '選題、親自畫圖，觀看其他人的猜測與揭曉。',
    points: [
      '畫者從候選題目選一個；題目只給畫者看。',
      '在練習畫布拖曳作畫；其他席位依序示範猜題。',
      '猜中越快分數越高；揭曉才公開答案與本輪分數。',
    ],
    reader: readDrawSnapshot,
    scene: defineAsyncComponent(() => import('./TutorialDraw.vue')),
  },
  trpg: {
    title: '霧港跑團',
    goal: '全隊準備後，由領隊擲骰並閱讀本幕結果。',
    points: [
      '領隊選擇觀察、交涉或冒險，先看難度、補給與收益。',
      '隊友可協助或整備；最多兩位協助者各花專注加一。',
      '所有人準備後領隊才能檢定；失敗仍能前進，故事正式遊玩共有六幕。',
    ],
    reader: readTrpgSnapshot,
    scene: defineAsyncComponent(() => import('../trpg/TrpgScene.vue')),
  },
  quacks: {
    title: '郎中闖江湖',
    goal: '翻占卜、抽藥或停手，完成結算與採購。',
    points: [
      '先翻占卜卡；依藥材圖像及按需說明理解效果。',
      '抽藥推進大釜，但白色藥材超過門檻就爆鍋；你可以提早停手。',
      '結算分數與預算後，用有限庫存採購不同藥材，準備下一輪。',
    ],
    reader: readQuacksSnapshot,
    scene: defineAsyncComponent(() => import('../quacks/QuacksScene.vue')),
  },
  bluff: {
    title: '瞎掰王',
    goal: '選題、看秘密身分、發言並指認想想。',
    points: [
      '想想選題，其他席位依秘密身分準備說法。',
      '這是口說遊戲；可在教學文字區準備並完成發言。',
      '全員發言後，依公開討論指認目標；揭曉後看身分與分數。',
    ],
    reader: readBluffSnapshot,
    scene: defineAsyncComponent(() => import('../bluff/BluffScene.vue')),
  },
  telephone: {
    title: '傳情畫意',
    goal: '想主題、畫圖、猜前一頁，再揭曉傳遞結果。',
    points: [
      '先寫自己的原創主題，送出後交給下一位。',
      '每一步只看收到的前一頁，輪流畫圖或猜詞。',
      '全部傳完再看整本傳遞簿，觀察訊息如何改變。',
    ],
    reader: readTelephoneSnapshot,
    scene: defineAsyncComponent(() => import('../telephone/TelephoneScene.vue')),
  },
  musicquiz: {
    title: '猜歌挑戰',
    goal: '前奏作答、放置年代卡並觀察挑戰結果。',
    points: [
      '本教學用自製旋律示範操作；年份僅供排序練習，不代表真實發行年份。',
      '先開始前奏，每人可作答或略過；歌名與年份暫時保密。',
      'DJ 在自己的年代線放置卡片，其他人可挑戰；揭曉後確認年份及代幣。',
    ],
    reader: readMusicQuizSnapshot,
    scene: defineAsyncComponent(() => import('../musicquiz/MusicQuizScene.vue')),
  },
  minimal: {
    title: '極簡畫家',
    goal: '只畫直線與圓，少筆畫優先展示，再輪到猜題者作答。',
    points: [
      '畫家看到共同秘密詞，猜題者看不到。',
      '在原本畫布畫直線或封閉圓，完成後送出；每張最多四十筆。',
      '依筆畫由少到多猜圖；猜中畫家加二、猜題者加一。',
    ],
    reader: readMinimalSnapshot,
    scene: defineAsyncComponent(() => import('../minimal/MinimalScene.vue')),
  },
  ceo: {
    title: '王牌執行長',
    goal: '從收購、股票與股利到公司計分。',
    points: [
      '本站使用替代牌庫；先看公司資產、能力與收購費用。',
      '依現金收購公司，或分配股利取得資金；也能依介面規則買賣股票。',
      '公司集團和持股共同影響最終分數，教學會演示到計分。',
    ],
    reader: readCeoSnapshot,
    scene: defineAsyncComponent(() => import('../ceo/CeoScene.vue')),
  },
  'second-wind': {
    title: '運動員',
    goal: '擲骰選角、組隊、選擇出賽者並完成一場競速。',
    points: [
      '先擲骰決定選角順序，輪流挑選自己的運動員。',
      '從隊伍選擇本場出賽者，再依順序擲骰移動。',
      '遇到能力或 Twist 選項要先處理；第一位抵達終點後看本場結果。',
    ],
    reader: readAthleteSnapshot,
    scene: defineAsyncComponent(() => import('../second-wind/AthleteScene.vue')),
  },
};
export function tutorialType(path: string): TutorialType | null {
  const type = path.split('/')[1] === 'race' ? 'thunder' : path.split('/')[1];
  return Object.hasOwn(lessons, type) ? (type as TutorialType) : null;
}
