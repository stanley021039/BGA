const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const theme=fs.readFileSync(path.join(__dirname,'../public/shared/playful-theme.css'),'utf8');
function declarations(block){return Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));}
const light=declarations(theme.slice(theme.indexOf('{')+1,theme.indexOf('}')));
const nightStart=theme.indexOf('color-scheme: dark;');
const dark={...light,...declarations(theme.slice(nightStart,theme.indexOf('}',nightStart)))};
function resolve(tokens,name,seen=new Set()){
 assert.ok(!seen.has(name),'cyclic color token '+name);seen.add(name);
 const value=tokens[name];assert.ok(value,'missing token '+name);
 const alias=/^var\((--[\w-]+)\)$/.exec(value);return alias?resolve(tokens,alias[1],seen):value;
}
function luminance(hex){assert.match(hex,/^#[\da-f]{6}$/i);const channels=hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [scheme,tokens]of Object.entries({light,dark}))test(scheme+' shared content, paper and widget text pairs retain readable contrast',()=>{
 for(const [foreground,background]of [
  ['--ui-text','--ui-surface-panel'],['--ui-muted','--ui-surface-panel'],
  ['--ui-widget-text','--ui-widget-panel'],['--ui-widget-error','--ui-widget-panel'],
  ['--ui-widget-selected-text','--ui-widget-selected'],
  ['--ui-paper-text','--ui-paper-background'],['--ui-paper-muted','--ui-paper-background']
 ]){const ratio=contrast(resolve(tokens,foreground),resolve(tokens,background));assert.ok(ratio>=4.5,`${scheme} ${foreground} on ${background}: ${ratio.toFixed(2)}:1`);}
});
test('regression examples distinguish unreadable inherited night ink and old selected-tab fallback',()=>{
 assert.ok(contrast(resolve(dark,'--play-ink'),'#fffdf8')<1.2);
 assert.ok(contrast(resolve(dark,'--green'),'#fffdf6')<1.2);
 assert.ok(contrast(resolve(dark,'--ui-widget-selected-text'),resolve(dark,'--ui-widget-selected'))>=4.5);
});
test('bare themed buttons pair their actual background and ink in both schemes',()=>{
 const rule=theme.match(/:where\(body\[data-visual-theme="playful"\]\) button\s*\{([^}]+)\}/);
 assert.ok(rule,'neutral themed button rule is missing');
 const background=rule[1].match(/background:\s*var\((--[\w-]+)\)/)?.[1];
 const foreground=rule[1].match(/color:\s*var\((--[\w-]+)\)/)?.[1];
 for(const tokens of [light,dark])assert.ok(contrast(resolve(tokens,foreground),resolve(tokens,background))>=4.5);
});
