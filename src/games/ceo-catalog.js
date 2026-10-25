'use strict';

const { INDUSTRIES, validateCatalog } = require('./ceo');

const INDUSTRY_NAMES = Object.freeze({
  entertainment: '娛樂',
  finance: '金融',
  hardware: '硬體',
  mobile: '3C',
  retail: '零售',
  technology: '科技',
});
const SOURCE = '2026-10-24 使用者授權的本站暫用替代卡；非原版公司卡';
const SUFFIXES = ['工作室', '服務社', '研發所', '製造所', '商務社', '合作社', '創投社', '事業部'];

function provisionalCatalog() {
  const groups = INDUSTRIES.map((industry) => ({
    id: `ceo-group-${industry}`,
    name: `${INDUSTRY_NAMES[industry]}集團`,
    industry,
    income: 1,
    score: { kind: 'industry', points: 10, industries: [industry] },
    source: SOURCE,
  }));
  const companies = INDUSTRIES.flatMap((industry, index) =>
    [10, 15, 20, 25, 30, 35, 40, 50].map((assets, tier) => ({
      id: `ceo-company-${industry}-${tier + 1}`,
      name: `${INDUSTRY_NAMES[industry]}${SUFFIXES[tier]}`,
      industry,
      assets,
      income: tier >= 6 ? 3 : tier >= 3 ? 2 : 1,
      adjustment: tier < 2 ? 'up' : tier >= 6 ? 'down' : null,
      score:
        tier === 1 || tier === 5
          ? { kind: 'industry', points: 20, industries: [industry] }
          : tier === 3
            ? { kind: 'pair', points: 40, industries: [industry, INDUSTRIES[(index + 1) % 6]] }
            : { kind: 'fixed', points: [20, 0, 30, 0, 40, 0, 50, 60][tier] },
      source: SOURCE,
    })),
  );
  return validateCatalog({
    status: 'provisional',
    source: SOURCE,
    groups,
    companies,
    adjustments: {
      up: [10, 15, 20].flatMap((value) => Array(4).fill(value)),
      down: [-10, -15, -20].flatMap((value) => Array(4).fill(value)),
    },
  });
}

module.exports = { provisionalCatalog, INDUSTRY_NAMES };
