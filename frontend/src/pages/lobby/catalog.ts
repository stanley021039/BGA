import type { GameType } from '../../contracts/room';
export interface GameCard { id: GameType | 'market'; title: string; english: string; description: string; seats: string; category: string; art: string; guide: string }
export const gameCards: GameCard[] = [
  { id: 'musicquiz', title: '猜歌挑戰', english: 'MUSIC QUIZ', description: '聽六秒旋律開頭，每人猜一次，揭曉後一起回顧。', seats: '1–8 人', category: '派對・音樂', art: 'musicquiz', guide: '/musicquiz?learn=1' },
  { id: 'quacks', title: '郎中闖江湖', english: 'QUACKS OF QUEDLINBURG', description: '同步抽藥、拼運氣煮大釜；可加入草藥女巫。', seats: '2–8 人', category: '策略・運氣', art: 'quacks', guide: '/quacks?learn=1' },
  { id: 'bluff', title: '瞎掰王', english: 'BLUFF KING', description: '口說冷知識，找出唯一老實人。', seats: '3–9 人', category: '派對・口說', art: 'bluff', guide: '/bluff?learn=1' },
  { id: 'minimal', title: '極簡畫家', english: 'MINIMAL ARTIST', description: '只用直線與圓，用最少筆畫讓猜題者猜中。', seats: '3–6 人', category: '派對・畫圖', art: 'minimal', guide: '/minimal?learn=1' },
  { id: 'telephone', title: '傳情畫意', english: 'DRAW · PASS · GUESS', description: '同時畫圖、猜詞，最後揭曉故事如何變形。', seats: '3–8 人', category: '派對・傳畫', art: 'telephone', guide: '/telephone?learn=1' },
  { id: 'trpg', title: '霧港跑團', english: 'FOGHARBOR ADVENTURE', description: '輪流領隊、一起擲骰。六幕原創冒險，失敗也能繼續前進。', seats: '1–6 人', category: '合作・跑團', art: 'trpg', guide: '/trpg?learn=1' },
  { id: 'poker', title: '德州撲克', english: "TEXAS HOLD’EM", description: '讀懂牌面，也讀懂你的朋友。跟注、加注，或把這一手全部押上。', seats: '2–6 人', category: '紙牌・心理戰', art: 'poker', guide: '/rules?game=poker' },
  { id: 'thunder', title: '雷霆之路', english: 'THUNDER ROAD: VENDETTA', description: '骰子一擲，油門踩到底。在廢土上衝刺、撞擊、射擊，直到最後一支車隊。', seats: '2–4 人', category: '競速・對戰', art: 'thunder', guide: '/race?learn=1' },
  { id: 'majority', title: '同頻俱樂部', english: 'MAJORITY CLUB', description: '早餐、夜市、生活小事，都能選邊站。跟最多人同頻就得分。', seats: '3–12 人', category: '派對・默契', art: 'majority', guide: '/majority?learn=1' },
  { id: 'gift', title: '送禮達人', english: 'GIFT CLUB', description: '把禮物送進心坎，也許你最懂這桌朋友。秘密挑禮、標記喜好，拆開後一起揭曉。', seats: '3–8 人', category: '派對・送禮', art: 'gift', guide: '/gift?learn=1' },
  { id: 'draw', title: '你畫我猜', english: 'THE ART TABLE', description: '輪流挑題作畫，朋友即時猜答案。畫得越清楚、猜得越快，分數越高。', seats: '2–8 人', category: '派對・畫圖', art: 'draw', guide: '/draw?learn=1' },
  { id: 'market', title: '股市冥燈', english: 'MARKET JINX', description: '預測下一交易日台股指數漲跌區間。每天一票，收盤後揭曉你的眼光。', seats: '每日預測', category: '免費・積分', art: 'market', guide: '/market' },
];
export const gameTitle = (type: GameType) => gameCards.find(card => card.id === type)?.title || type;
