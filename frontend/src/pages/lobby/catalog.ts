import type { GameType } from '../../contracts/room';
export interface GameCard {
  id: GameType | 'market';
  title: string;
  english: string;
  description: string;
  seats: string;
  category: string;
  guide: string;
}
// The lounge is selectable alongside the games (#277, revised 2026-10-25).
export const loungeCard: GameCard = {
  id: 'lounge',
  guide: '',
  title: '場外休憩區',
  english: 'OFF-TABLE LOUNGE',
  description: '不開局，大家一起看影片、聽歌、聊天。',
  seats: '1–10 人',
  category: '共看・聊天',
};
export const gameCards: GameCard[] = [
  {
    id: 'brainwave',
    title: '電波畫家',
    english: 'BRAINWAVE PAINTERS',
    seats: '3–8 人',
    category: '派對・語音畫圖',
    description: '聽口令各自跟畫，搶答採集水晶。需要同桌或外部語音。',
    guide: '/brainwave?learn=1',
  },
  {
    id: 'drama-bar',
    title: '戲精酒吧',
    english: 'DRAMA BAR',
    seats: '3–8 人',
    category: '派對・聲音表演',
    description: '一句台詞，六種情境。只聽語氣就猜得出來嗎？',
    guide: '/drama-bar?learn=1',
  },
  {
    id: 'decrypto',
    title: '截碼戰',
    english: 'SECRET SIGNALS',
    description: '三條線索傳密碼，讓隊友猜中、讓對手猜不透。',
    seats: '4–8 人',
    category: '派對・推理',
    guide: '/decrypto?learn=1',
  },
  {
    id: 'second-wind',
    title: '運動員 Second Wind',
    english: 'SECOND WIND',
    seats: '3–6 人',
    category: '競速・能力',
    description: '招募四名選手，連賽四場，讓能力改寫賽局。',
    guide: '/second-wind?learn=1',
  },
  {
    id: 'ceo',
    title: '王牌執行長',
    english: '1ST CEO',
    description: '收購公司、買進股票與分配股利；本站替代牌庫試玩版。',
    seats: '3–6 人',
    category: '策略・經營',
    guide: '/ceo?learn=1',
  },
  {
    id: 'musicquiz',
    title: '猜歌挑戰',
    english: 'MUSIC QUIZ',
    description: '8秒前奏6選1、年代排序與歌王插歌。',
    seats: '1–8 人',
    category: '派對・音樂',
    guide: '/musicquiz?learn=1',
  },
  {
    id: 'quacks',
    title: '郎中闖江湖',
    english: 'QUACKS OF QUEDLINBURG',
    description: '同步抽藥、拼運氣煮大釜；可加入草藥女巫。',
    seats: '2–8 人',
    category: '策略・運氣',
    guide: '/quacks?learn=1',
  },
  {
    id: 'bluff',
    title: '瞎掰王',
    english: 'BLUFF KING',
    description: '口說冷知識，找出唯一老實人。',
    seats: '3–9 人',
    category: '派對・口說',
    guide: '/bluff?learn=1',
  },
  {
    id: 'minimal',
    title: '極簡畫家',
    english: 'MINIMAL ARTIST',
    description: '只用直線與圓，用最少筆畫讓猜題者猜中。',
    seats: '3–8 人',
    category: '派對・畫圖',
    guide: '/minimal?learn=1',
  },
  {
    id: 'telephone',
    title: '傳情畫意',
    english: 'DRAW · PASS · GUESS',
    description: '先各自想主題，再傳畫猜詞，最後逐頁揭曉故事。',
    seats: '3–8 人',
    category: '派對・傳畫',
    guide: '/telephone?learn=1',
  },
  {
    id: 'coc',
    title: '克蘇魯的呼喚',
    english: 'CALL OF CTHULHU',
    description: 'AI 主持的合作調查。建立英雄、共享線索，保存冒險並分次繼續。',
    seats: '1–4 位真人',
    category: '合作・調查・Pulp',
    guide: '/coc?learn=1',
  },
  {
    id: 'trpg',
    title: '霧港跑團',
    english: 'FOGHARBOR ADVENTURE',
    description: '輪流領隊、一起擲骰。六幕原創冒險，失敗也能繼續前進。',
    seats: '1–8 人',
    category: '合作・跑團',
    guide: '/trpg?learn=1',
  },
  {
    id: 'poker',
    title: '德州撲克',
    english: 'TEXAS HOLD’EM',
    description: '讀懂牌面，也讀懂你的朋友。跟注、加注，或把這一手全部押上。',
    seats: '2–8 人',
    category: '紙牌・心理戰',
    guide: '/poker?learn=1',
  },
  {
    id: 'thunder',
    title: '雷霆之路',
    english: 'THUNDER ROAD: VENDETTA',
    description: '骰子一擲，油門踩到底。在廢土上衝刺、撞擊、射擊，直到最後一支車隊。',
    seats: '2–4 人',
    category: '競速・對戰',
    guide: '/race?learn=1',
  },
  {
    id: 'majority',
    title: '同頻俱樂部',
    english: 'MAJORITY CLUB',
    description: '早餐、夜市、生活小事，都能選邊站。跟最多人同頻就得分。',
    seats: '3–12 人',
    category: '派對・默契',
    guide: '/majority?learn=1',
  },
  {
    id: 'gift',
    title: '送禮達人',
    english: 'GIFT CLUB',
    description: '把禮物送進心坎，也許你最懂這桌朋友。秘密挑禮、標記喜好，拆開後一起揭曉。',
    seats: '3–8 人',
    category: '派對・送禮',
    guide: '/gift?learn=1',
  },
  {
    id: 'draw',
    title: '你畫我猜',
    english: 'THE ART TABLE',
    description: '經典輪流畫猜，或在房間切換塗鴉神諭，一起沿虛線作畫。',
    seats: '2–8 人',
    category: '派對・畫圖',
    guide: '/draw?learn=1',
  },
  {
    id: 'market',
    title: '股市冥燈',
    english: 'MARKET JINX',
    description: '預測下一交易日台股指數漲跌區間。每天一票，收盤後揭曉你的眼光。',
    seats: '每日預測',
    category: '免費・積分',
    guide: '/market?learn=1',
  },
  loungeCard,
];
export const drawingGameTypes = ['draw', 'brainwave', 'minimal', 'telephone'] as const;
export const isDrawingGame = (id: string) => drawingGameTypes.some((type) => type === id);
export type LobbyCardId = Exclude<
  GameCard['id'],
  Exclude<(typeof drawingGameTypes)[number], 'draw'>
>;
export const lobbyCards = gameCards
  .filter(
    (card): card is GameCard & { id: LobbyCardId } => card.id === 'draw' || !isDrawingGame(card.id),
  )
  .map((card) =>
    card.id === 'draw'
      ? {
          ...card,
          title: '畫畫天堂',
          description: '和朋友進同一間畫室，再選你畫我猜、塗鴉神諭、電波畫家、極簡畫家或傳情畫意。',
          guide: '',
        }
      : card,
  );
export const gameTitle = (type: GameType) =>
  type === 'lounge' ? loungeCard.title : gameCards.find((card) => card.id === type)?.title || type;
