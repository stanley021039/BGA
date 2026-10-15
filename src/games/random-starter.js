'use strict';
const {randomInt}=require('node:crypto');
// Select once at match start; never reorder the public seats or host ownership.
function starterIndex(players,rng=randomInt){if(!players.length)throw Error('沒有可開始的玩家');if(players.length===1)return 0;const i=rng(players.length);if(!Number.isInteger(i)||i<0||i>=players.length)throw Error('無效起始玩家亂數');return i;}
function starterOrder(players,rng){const i=starterIndex(players,rng);return players.slice(i).concat(players.slice(0,i));}
module.exports={starterIndex,starterOrder};
