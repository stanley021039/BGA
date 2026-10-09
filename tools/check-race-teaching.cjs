'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Delimiters describe the existing HTML; this check never rewrites runtime assets.
const SCRIPT_OPEN = '<script data-teaching-table>';
const ENGINE_OPEN = "if(new URLSearchParams(location.search).get('learn')==='1'){const TutorialEngine=(()=>{const module={exports:{}};let id=0;const require=name=>name==='../../public/shared/race-paths'?window.RacePaths:({randomInt:n=>Math.floor(Math.random()*n),randomUUID:()=> 'lesson-'+(++id)});";
const MODULE_CLOSE = 'return module.exports;})();\n';
const LESSON_OPEN = 'const LessonScenarios=(()=>{const module={exports:{}};const require=()=>TutorialEngine;';
const SHELL_OPEN = '(()=>{\nconst $=s=>document.querySelector(s);\nconst exitHref=';
const normalize = text => text.replace(/\r\n/g, '\n');

function uniqueIndex(text, marker, label) {
  const index = text.indexOf(marker);
  if (index < 0 || text.indexOf(marker, index + marker.length) >= 0) {
    throw new Error(`Expected exactly one ${label}`);
  }
  return index;
}

function checkTeachingSources({ html, thunder, tutorial }) {
  html = normalize(html);
  thunder = normalize(thunder);
  tutorial = normalize(tutorial);
  const start = uniqueIndex(html, SCRIPT_OPEN, 'data-teaching-table script') + SCRIPT_OPEN.length;
  const end = html.indexOf('</script>', start);
  if (end < 0) throw new Error('Missing teaching script closing tag');
  const script = html.slice(start, end);
  const shell = uniqueIndex(script, SHELL_OPEN, 'handwritten teaching shell boundary');
  const expected = ENGINE_OPEN + thunder + MODULE_CLOSE + LESSON_OPEN + tutorial + MODULE_CLOSE;
  const actual = script.slice(0, shell);
  if (actual !== expected) {
    let offset = 0;
    while (offset < actual.length && offset < expected.length && actual[offset] === expected[offset]) offset++;
    const line = expected.slice(0, offset).split('\n').length;
    throw new Error(`race.html teaching source mismatch at embedded line ${line}; check src/games/thunder.js, src/games/tutorial.js and the documented wrappers`);
  }
}

function checkRepository(root = path.resolve(__dirname, '..')) {
  const read = name => fs.readFileSync(path.join(root, name), 'utf8');
  checkTeachingSources({
    html: read('public/race.html'),
    thunder: read('src/games/thunder.js'),
    tutorial: read('src/games/tutorial.js'),
  });
}

if (require.main === module) {
  try {
    checkRepository();
    console.log('race teaching sources match (CRLF/LF normalization only)');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { checkTeachingSources, checkRepository };
