const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const window={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'public/studio-editor.js'),'utf8'),{window});
const {normalizeHex,hsvToHex,hexToHsv}=window.StudioEditor.colors;

test('spectrum and hex input preserve precise colors',()=>{
 assert.equal(normalizeHex('#AbC'),'#aabbcc');
 assert.equal(normalizeHex('#12abEF'),'#12abef');
 for(const color of ['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#557bb5','#f0c866'])assert.equal(hsvToHex(hexToHsv(color)),color);
});

test('color input accepts only hex codes',()=>{
 for(const value of ['red','rgb(1,2,3)','#12345','#1234567','javascript:alert(1)'])assert.equal(normalizeHex(value),null);
});
