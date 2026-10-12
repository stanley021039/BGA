const test=require('node:test'),assert=require('node:assert/strict');
const {createChat}=require('../src/social/chat'),{sendRoomMessage,barrageText}=require('../src/social/room-message');
test('room messages retain 160 code points and broadcast exactly the first forty plus an ellipsis',()=>{
 const barrageEvents=new Map(),chat=createChat(),user={id:'reader',display_name:'玩家'},room={code:'ABC123'};
 const message='😀'.repeat(160),data={message,requestId:'same-message-id'};
 const record=sendRoomMessage({chat,barrageEvents,room,user,playerId:'seat',data});
 assert.equal(chat.read(room.code)[0].message,message);assert.equal(barrageEvents.get(room.code)[0].message,'😀'.repeat(40)+'…');
 assert.equal(sendRoomMessage({chat,barrageEvents,room,user,playerId:'seat',data}),record);assert.equal(chat.read(room.code).length,1);assert.equal(barrageEvents.get(room.code).length,1);
 assert.equal(barrageText('文'.repeat(40)),'文'.repeat(40));assert.equal(barrageText('文'.repeat(41)),'文'.repeat(40)+'…');assert.equal(barrageText('第一行\n第二行'),'第一行 第二行');
 assert.throws(()=>sendRoomMessage({chat,barrageEvents,room,user,playerId:'seat',data:{message:'文'.repeat(161)}}),e=>e.code==='INVALID_MESSAGE');assert.equal(chat.read(room.code).length,1);
});
test('an invalid barrage frame cannot leave a partial chat record',()=>{
 const chat=createChat(),barrageEvents=new Map(),room={code:'ABC123'};
 assert.throws(()=>sendRoomMessage({chat,barrageEvents,room,user:{id:'a',display_name:'A'},playerId:'seat',data:{message:'hello',builtinFrameId:'missing'}}));assert.equal(chat.read(room.code).length,0);assert.equal(barrageEvents.size,0);
});
test('emoji and expression records use safe readable text without a second send',()=>{
 const chat=createChat();chat.record('ABC123',{id:'e',kind:'emoji',name:'A',emoji:'🎉',at:1});chat.record('ABC123',{id:'e',kind:'emoji',name:'A',emoji:'🎉',at:1});chat.record('ABC123',{id:'x',kind:'expression',name:'A',label:'開心',at:2});assert.deepEqual(chat.read('ABC123').map(x=>x.message),['🎉','使用了「開心」表情']);assert.deepEqual(chat.read('OTHER'),[]);
});
test('room chat never polls or sends from the lobby',async()=>{
 const {ChatClient}=require('../public/shared/chat');let calls=0;const client=new ChatClient({fetcher:async()=>{calls++;throw Error('should not send');}});assert.equal(await client.poll(),false);assert.equal(await client.send('hi'),false);assert.equal(await client.request('lobby'),false);assert.equal(calls,0);
});
