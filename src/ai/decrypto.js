'use strict';
const { randomUUID } = require('node:crypto');
const { CODES } = require('../games/decrypto');
const { WORDS } = require('../games/decrypto-catalog');
// Practice AI uses its own private view and public clue history only. It never
// reads the opponent's keywords, code deck, or sealed submissions.
const associations = {
  紅白機: '電視遊樂器',
  卡帶: '倒轉磁帶',
  錄影帶: '家庭影片',
  隨身聽: '耳機音樂',
  收音機: '廣播頻道',
  大哥大: '行動通話',
  公共電話: '街頭通話',
  電話卡: '通話儲值',
  撥接網路: '連線嗶聲',
  光碟片: '雷射讀取',
  軟碟: '方形儲存',
  電視: '客廳節目',
  遙控器: '遠端換台',
  天線: '接收訊號',
  底片: '沖洗照片',
  相機: '留下照片',
  錄音機: '聲音記錄',
  呼叫器: '腰間訊息',
  打字機: '紙上敲字',
  黑膠唱片: '轉盤音樂',
  傳真機: '遠端紙張',
  電子寵物: '虛擬餵食',
  遊戲機: '手把闖關',
  遊樂場: '投幣娛樂',
  投幣: '投入零錢',
  扭蛋: '轉出驚喜',
  漫畫: '分格故事',
  卡通: '動畫節目',
  電影: '大銀幕',
  偶像: '追星對象',
  海報: '牆上宣傳',
  貼紙: '黏貼收藏',
  集郵: '信件收藏',
  皮影戲: '光下戲偶',
  布袋戲: '掌中戲偶',
  唱片行: '音樂商店',
  租書店: '借閱漫畫',
  雜貨店: '街角小舖',
  柑仔店: '古早零食店',
  福利社: '下課購物',
  彈珠: '玻璃小球',
  跳格子: '地上方框',
  珍珠奶茶: '搖杯飲料',
  泡麵: '熱水宵夜',
  尪仔標: '紙片對戰',
  黑板: '課堂書寫',
  粉筆: '白色筆灰',
  板擦: '清除筆灰',
  紅包: '過年祝福',
  月亮: '夜空圓缺',
  太陽: '白天光熱',
};
const patterns = [
  '童年想到的%s',
  '生活中的%s',
  '記憶裡的%s',
  '熟悉的%s',
  '常見的%s',
  '身邊的%s',
  '日常想到的%s',
  '回想那個%s',
];
function clue(word, round) {
  const hint =
    associations[word] ||
    (WORDS.indexOf(word) < 86
      ? '校園活動'
      : WORDS.indexOf(word) < 139
        ? '飲食記憶'
        : WORDS.indexOf(word) < 190
          ? '居家用品'
          : WORDS.indexOf(word) < 238
            ? '出門風景'
            : '休閒印象');
  return patterns[(round - 1) % 8].replace('%s', hint);
}
module.exports = {
  maxPlayers: 8,
  plan(room, player) {
    const s = room.view(player.id),
      t = s.myTeam;
    const input = { roundId: s.roundId, turn: s.turn, requestId: randomUUID() };
    const op = (action, data = {}) => ({
      actor: player.id,
      action,
      input: { ...input, ...data },
      run: (r) => r.act(player.id, action, { ...input, ...data }),
    });
    if (s.phase === 'clues' && s.secretCode && !s.clueReady[t]) {
      const clues = s.secretCode.map((digit, i) => {
        let value = clue(s.keywords[t][digit - 1], s.round);
        // Generic fallbacks remain distinct without encoding numeric positions.
        if (s.secretCode.slice(0, i).some((d) => clue(s.keywords[t][d - 1], s.round) === value))
          value += ['', '的聯想', '的情境'][i];
        return value;
      });
      return op('clues', { clues });
    }
    if (s.phase === 'guessing' && s.decoders[t] === player.id) {
      const action = t === s.turn ? 'decode' : 'intercept';
      if (s.guessReady[action] || (action === 'intercept' && s.round === 1)) return null;
      const clues = s.clues[s.turn];
      const options = CODES.filter((c) =>
        c.every(
          (digit, i) =>
            !s.history[s.turn].some((entries, k) => entries.includes(clues[i]) && k + 1 !== digit),
        ),
      );
      return op(action, {
        digits: (options.length ? options : CODES)[room.rng(options.length || CODES.length)],
      });
    }
    if (s.phase === 'reveal' && player.id === s.host) return op('next');
    if (s.phase === 'tiebreak' && player.id === s.decoders[t] && !s.tieReady[t])
      return op('keywords', { words: ['', '', '', ''] });
    return null;
  },
};
