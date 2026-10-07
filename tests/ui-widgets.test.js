const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {dom}=require('./helpers/widget-dom.cjs'),source=fs.readFileSync(path.join(__dirname,'../public/shared/ui-widgets.js'),'utf8');
function fixture(html){const f=dom(html),window={GameUI:{openDialog(dialog){dialog.showModal();}}};vm.runInNewContext(source,{window,MutationObserver:f.MutationObserver,Promise});return {...f,ui:window.GameUI};}
const tabs='<nav id="tabs"><button data-ui-tab="one" aria-controls="one">一</button><button data-ui-tab="two" aria-controls="two">二</button><button data-ui-tab="admin" aria-controls="admin" hidden>管理</button><button data-ui-tab="three" aria-controls="three">三</button></nav><section id="one"></section><section id="two" hidden></section><section id="admin" hidden></section><section id="three" hidden></section>';
test('manual tabs wrap keyboard focus without committing a panel or calling the activation callback',()=>{
 const f=fixture(tabs),changes=[],binding=f.ui.mountTabs(f.node('tabs'),{initial:'one',activation:'manual',onChange:(key,info)=>changes.push({key,previous:info.previous,reason:info.reason})}),buttons=f.node('tabs').querySelectorAll('button');
 buttons[0].focus();buttons[0].dispatch('keydown',{key:'ArrowRight'});assert.equal(f.document.activeElement,buttons[1]);assert.equal(binding.value,'one');assert.equal(f.node('two').hidden,true);assert.equal(changes.length,0);
 buttons[1].dispatch('keydown',{key:'ArrowRight'});assert.equal(f.document.activeElement,buttons[3]);buttons[3].dispatch('keydown',{key:'ArrowRight'});assert.equal(f.document.activeElement,buttons[0]);buttons[0].dispatch('keydown',{key:'End'});assert.equal(f.document.activeElement,buttons[3]);buttons[3].dispatch('keydown',{key:'Home'});assert.equal(f.document.activeElement,buttons[0]);
 buttons[0].dispatch('keydown',{key:'ArrowRight'});buttons[1].dispatch('keydown',{key:'Enter'});assert.equal(binding.value,'two');assert.equal(f.node('one').hidden,true);assert.equal(f.node('two').hidden,false);assert.equal(f.node('two').getAttribute('aria-labelledby'),buttons[1].id);assert.deepEqual(changes,[{key:'two',previous:'one',reason:'keyboard'}]);
 buttons[1].dispatch('keydown',{key:'ArrowRight'});buttons[3].dispatch('keydown',{key:' '});assert.equal(binding.value,'three');assert.equal(changes.length,2);
});
test('hidden/disabled admin tabs cannot activate, permission loss restores a visible focused tab and destroy releases observers',()=>{
 const f=fixture(tabs),changes=[],binding=f.ui.mountTabs(f.node('tabs'),{onChange:key=>changes.push(key)}),buttons=f.node('tabs').querySelectorAll('button');assert.equal(binding.select('admin'),false);
 buttons[1].disabled=true;buttons[0].dispatch('keydown',{key:'ArrowRight'});assert.equal(f.document.activeElement,buttons[3]);buttons[2].hidden=false;f.mutate();assert.equal(binding.select('admin',{focus:true}),true);assert.equal(f.node('admin').hidden,false);
 buttons[2].hidden=true;f.mutate();assert.equal(binding.value,'one');assert.equal(f.document.activeElement,buttons[0]);assert.equal(f.node('admin').hidden,true);assert.deepEqual(changes,['admin','one']);
 binding.destroy();buttons[0].dispatch('keydown',{key:'ArrowRight'});assert.equal(f.document.activeElement,buttons[0]);assert.ok(f.observers.every(observer=>!observer.connected));assert.equal(f.node('tabs').getAttribute('role'),null);
});
test('automatic vertical tabs activate on arrows and programmatic refresh retains manual focus when selection is unchanged',()=>{
 const f=fixture(tabs),binding=f.ui.mountTabs(f.node('tabs'),{orientation:'vertical',activation:'automatic'}),buttons=f.node('tabs').querySelectorAll('button');buttons[0].dispatch('keydown',{key:'ArrowDown'});assert.equal(binding.value,'two');assert.equal(f.node('two').hidden,false);binding.destroy();
 const manual=f.ui.mountTabs(f.node('tabs'));buttons[0].dispatch('keydown',{key:'ArrowRight'});manual.select('one',{notify:false});assert.equal(buttons[1].getAttribute('tabindex'),'0');assert.equal(f.document.activeElement,buttons[1]);
});
test('form validation uses native constraints, associates inline errors and preserves unrelated server descriptions and pending state',async()=>{
 const f=fixture('<form id="form"><label>名稱<input id="name" name="name" required aria-describedby="hint"></label><p id="hint">提示</p><p id="server" role="status">伺服器錯誤仍保留</p><button id="save" disabled>等待回覆</button></form>'),form=f.node('form'),field=f.node('name'),originalSubmit=()=>{};form.onsubmit=originalSubmit;const binding=f.ui.bindForm(form);
 assert.equal(binding.validate(),false);assert.ok(form.checks>0);assert.equal(field.getAttribute('aria-invalid'),'true');assert.equal(f.document.activeElement,field);assert.equal(form.onsubmit,originalSubmit);assert.equal(f.node('server').textContent,'伺服器錯誤仍保留');assert.equal(f.node('save').disabled,true);assert.equal(form.querySelectorAll('[data-ui-field-error]').length,1);
 const error=form.querySelector('[data-ui-field-error]');assert.ok(field.getAttribute('aria-describedby').includes('hint'));assert.ok(field.getAttribute('aria-describedby').includes(error.id));binding.validate({report:true});assert.equal(form.reports,1);assert.equal(form.querySelectorAll('[data-ui-field-error]').length,1);
 field.setAttribute('aria-describedby',field.getAttribute('aria-describedby')+' live-server-help');field.value='朋友';field.dispatch('input');assert.equal(field.getAttribute('aria-invalid'),null);assert.equal(field.getAttribute('aria-describedby'),'hint live-server-help');assert.equal(form.querySelectorAll('[data-ui-field-error]').length,0);
 field.value='';assert.equal(f.ui.validateForm(form),false);form.reset();await Promise.resolve();assert.equal(form.querySelectorAll('[data-ui-field-error]').length,0);assert.equal(f.node('server').textContent,'伺服器錯誤仍保留');assert.equal(f.node('save').disabled,true);binding.destroy();assert.equal(form.onsubmit,originalSubmit);
});
test('form destroy removes only its own error and respects disabled/dynamic controls and original invalid attributes',()=>{
 const f=fixture('<form id="form"><label>姓名<input name="name" id="name" required aria-invalid="false"></label><input id="pending" required disabled></form>'),form=f.node('form'),binding=f.ui.bindForm(form);assert.equal(binding.validate({focus:false}),false);assert.equal(f.node('pending').getAttribute('aria-invalid'),null);
 const field=f.document.createElement('input');field.required=true;field.id='later';form.append(field);f.node('name').value='名字';assert.equal(binding.validate({focus:false}),false);assert.equal(field.getAttribute('aria-invalid'),'true');binding.destroy();assert.equal(f.node('name').getAttribute('aria-invalid'),'false');assert.equal(field.getAttribute('aria-invalid'),null);assert.equal(form.querySelectorAll('[data-ui-field-error]').length,0);
});
test('one native invalid batch focuses the first invalid field after all inline errors exist',async()=>{
 const f=fixture('<form id="form"><label>姓名<input id="first" required></label><label>檔案<input id="second" type="file" required></label><button id="submit">上傳</button></form>'),form=f.node('form'),binding=f.ui.bindForm(form),first=f.node('first'),second=f.node('second');let focusCalls=0;
 const focus=first.focus.bind(first);first.focus=(...args)=>{focusCalls++;assert.equal(form.querySelectorAll('[data-ui-field-error]').length,2);focus(...args);};f.node('submit').focus();first.dispatch('invalid');second.dispatch('invalid');assert.equal(f.document.activeElement,f.node('submit'));
 await Promise.resolve();assert.equal(f.document.activeElement,first);assert.equal(focusCalls,1);assert.equal(first.getAttribute('aria-invalid'),'true');assert.equal(second.getAttribute('aria-invalid'),'true');
 f.node('submit').focus();assert.equal(binding.validate({focus:false}),false);await Promise.resolve();assert.equal(f.document.activeElement,f.node('submit'));assert.equal(focusCalls,1,'checkValidity inside validate must not schedule a hidden autofocus');
});
test('a queued native invalid focus cannot survive reset, destroy or a newer explicit focus:false validation',async()=>{
 for(const cancel of ['reset','destroy','validate']){
  const f=fixture('<form id="form"><input id="first" required><button id="submit">送出</button></form>'),form=f.node('form'),binding=f.ui.bindForm(form);f.node('submit').focus();f.node('first').dispatch('invalid');if(cancel==='reset')form.reset();else if(cancel==='destroy')binding.destroy();else binding.validate({focus:false});await Promise.resolve();assert.equal(f.document.activeElement,f.node('submit'),cancel);
 }
});
test('dialog binding keeps native modality and application handlers, blocks busy cancellation and returns focus on close',()=>{
 const f=fixture('<button id="trigger">預覽</button><dialog id="dialog"><h2>結算確認</h2><button id="cancel" data-ui-close>返回</button></dialog>'),dialog=f.node('dialog'),trigger=f.node('trigger');let busy=false,appCancels=0;const app=()=>appCancels++;dialog.addEventListener('cancel',app);
 const binding=f.ui.bindDialog(dialog,{canClose:()=>!busy});assert.equal(dialog.open,false);assert.equal(dialog.modalCalls,undefined);assert.equal(dialog.getAttribute('aria-labelledby'),dialog.querySelector('h2').id);binding.open(trigger);assert.equal(dialog.modalCalls,1);
 busy=true;assert.equal(dialog.escape().defaultPrevented,true);assert.equal(dialog.open,true);f.node('cancel').click();assert.equal(dialog.open,true);assert.equal(appCancels,1);
 busy=false;assert.equal(dialog.escape().defaultPrevented,false);assert.equal(dialog.open,false);assert.equal(f.document.activeElement,trigger);assert.equal(appCancels,2);binding.open(trigger);f.node('cancel').click();assert.equal(dialog.open,false);assert.equal(f.document.activeElement,trigger);
 binding.destroy();dialog.dispatch('cancel');assert.equal(appCancels,3);
});
test('nonmodal dialogs are not opened or promoted and request-close callbacks retain control of pending confirmation',()=>{
 const f=fixture('<button id="trigger">開窗</button><dialog id="dialog" aria-label="個人媒體"><button id="cancel" data-ui-close>關閉</button></dialog>'),dialog=f.node('dialog');dialog.show();let requests=0;
 const binding=f.ui.bindDialog(dialog,{onRequestClose(){requests++;}});assert.equal(dialog.modal,false);assert.equal(dialog.modalCalls,undefined);assert.equal(dialog.escape().defaultPrevented,true);assert.equal(requests,1);assert.equal(dialog.open,true);
 assert.equal(f.ui.bindDialog(dialog),binding);f.node('cancel').click();assert.equal(requests,2);binding.close();assert.equal(dialog.open,false);
});
