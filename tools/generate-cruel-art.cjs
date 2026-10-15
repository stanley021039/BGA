'use strict';
const fs=require('fs'),path=require('path'),{CRUEL_QUESTIONS}=require('../src/games/majority-cruel-catalog');
const out=path.join(__dirname,'../public/assets/majority-cruel');fs.mkdirSync(out,{recursive:true});
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const heart='<path d="M0 12C-42-24-49-57-23-69C-11-75-2-69 0-57C5-73 24-76 35-66C65-36 17-3 0 12Z" fill="#ed7a92"/>';
const person=(x,y,shirt='#84b9c0',pose='normal')=>'<g transform="translate('+x+' '+y+')"><path d="M-30 110Q-44 52-25 30L26 30Q45 53 30 110Z" fill="'+shirt+'"/><circle cy="0" r="35" fill="#f6c9a1"/><path d="M-35-2Q-43-42-2-42Q42-45 35 0L19-18-6-13-19-26Z" fill="#434955"/><circle cx="-11" cy="3" r="2.6" fill="#343544" stroke="none"/><circle cx="11" cy="3" r="2.6" fill="#343544" stroke="none"/><path d="M-7 17Q0 24 9 16" fill="none"/><path d="'+(pose==='up'?'M-26 41L-53 12-77-36M25 41L58 18 85-22':'M-26 40L-54 77M26 40L58 77')+'" fill="none" stroke-width="13"/></g>';
const shapes={
chair:'<path d="M-49-61H36Q48-61 48-48V5H-49Z" fill="#a9bdb6"/><path d="M-54 10H58V31H-54Z" fill="#dec387"/><path d="M-42 31V77M45 31V77M-49-48V10" stroke-width="9"/>',
heart:'<g transform="translate(0 10)">'+heart+'</g>',
hearts:'<g transform="translate(-35 0) scale(.7)">'+heart+'</g><g transform="translate(30 40) scale(.75)">'+heart+'</g>',
brokenheart:heart+'<path d="M0-59L-9-37 9-19-4 6" stroke="#fff0dd" fill="none" stroke-width="7"/>',
phone:'<rect x="-44" y="-66" width="88" height="144" rx="16" fill="#778bad"/><rect x="-34" y="-46" width="68" height="94" rx="4" fill="#fff4db"/><path d="M-19-20H23M-19-3H12M-19 14H23" stroke="#8da6b2"/><circle cy="62" r="5" fill="#fff4db"/>',
lock:'<rect x="-48" y="-14" width="96" height="88" rx="16" fill="#e7bf68"/><path d="M-27-16V-38A27 27 0 0 1 27-38V-16" fill="none" stroke-width="10"/><circle cy="23" r="8" fill="#505465"/><path d="M0 25V47"/>',
clock:'<circle r="66" fill="#f5ecd2"/><circle r="54" fill="#a8c4bf"/><path d="M0-39V0L29 20"/><circle r="4" fill="#414957"/>',
calendar:'<rect x="-65" y="-52" width="130" height="125" rx="11" fill="#f5ecd2"/><path d="M-65-20H65" stroke-width="10" stroke="#dc8795"/><path d="M-32-67V-41M32-67V-41"/><path d="M-35 5H-14M13 5H35M-35 29H-14M13 29H35M-35 52H-14M13 52H35" stroke="#8ba2a2" stroke-width="10"/>',
home:'<path d="M-69-3L0-64 69-3V76H-69Z" fill="#b6c2bd"/><path d="M-84 0L0-77 83 0" fill="none" stroke-width="10" stroke="#ec9e78"/><rect x="-16" y="25" width="34" height="51" fill="#eac97a"/><rect x="-48" y="17" width="21" height="24" fill="#ebf2eb"/>',
city:'<rect x="-72" y="-70" width="66" height="140" fill="#adc1c3"/><rect x="3" y="-35" width="69" height="105" fill="#d49cab"/>'+[-52,-24,24,50].map((x,i)=>'<path d="M'+x+' '+(i<2?-44:-8)+'v75" stroke="#fcf0c3" stroke-width="9" stroke-dasharray="10 15"/>').join(''),
coins:'<ellipse cy="54" rx="62" ry="16" fill="#dca94f"/><path d="M-62 31V54M62 31V54" stroke-width="8" stroke="#dca94f"/><ellipse cy="29" rx="62" ry="16" fill="#f2d883"/><circle cx="13" cy="-24" r="42" fill="#f2d883"/><path d="M13-50V2M28-41Q-10-51-4-28Q35-14 17-2" fill="none"/>',
book:'<path d="M0-53Q-30-76-75-53V71Q-32 56 0 75Q35 53 75 70V-53Q32-74 0-53Z" fill="#faf0db"/><path d="M0-53V75M-59-27L-15-22M-59-5L-15 0M16-22L60-27M16 0L60-5"/>',
voice:'<path d="M-72-58H72V27H12L-17 62V27H-72Z" fill="#a5cdd0"/><path d="M-48-25H48M-48-3H27"/>',
ear:'<path d="M-32 48Q-68-65-5-69Q68-57 40 16Q7 17 12 50Q-4 93-32 48Z" fill="#f2c69d"/><path d="M-19 20Q-35-32-1-42Q35-41 21-7L-2 11" fill="none"/>',
mouth:'<path d="M-70-5Q-40-41-2-14Q33-44 70-5Q34 70-3 63Q-45 68-70-5Z" fill="#d88791"/><path d="M-56 0Q0 19 56 0Q22 42-21 34Z" fill="#fff0db"/>',
plate:'<ellipse cy="43" rx="78" ry="30" fill="#f0e8d0"/><ellipse cy="40" rx="59" ry="18" fill="#d9e4d6"/><path d="M-31 28Q-40-20-3-15Q40-40 41 22Z" fill="#e6b456"/><path d="M-2 15Q-14 1-6-16" fill="none"/>',
orange:'<circle cx="-23" cy="20" r="45" fill="#f1af4e"/><path d="M11-23Q41-42 57-6Q25 13 11-23Z" fill="#92b69d"/><path d="M11-23Q16-57 40-59" fill="none"/>',
music:'<path d="M-20 36V-49L55-70V13" fill="none" stroke-width="12"/><ellipse cx="-39" cy="40" rx="27" ry="18" fill="#ac9ecd"/><ellipse cx="35" cy="17" rx="27" ry="18" fill="#ac9ecd"/>',
screen:'<rect x="-79" y="-58" width="158" height="104" rx="14" fill="#6f899d"/><rect x="-64" y="-43" width="128" height="74" fill="#eedfbf"/><path d="M-14-24L28-6-14 17Z" fill="#c98394"/><path d="M0 48V68M-34 70H34"/>',
camera:'<rect x="-75" y="-31" width="150" height="100" rx="16" fill="#8c9fb1"/><path d="M-40-31L-22-55H25L43-31" fill="#8c9fb1"/><circle cy="18" r="31" fill="#e2e8d9"/><circle cy="18" r="17" fill="#a6c9c9"/><circle cx="50" cy="-11" r="7" fill="#f4d38b"/>',
gift:'<rect x="-64" y="-15" width="128" height="95" rx="7" fill="#df9ead"/><rect x="-73" y="-31" width="146" height="29" rx="8" fill="#ecd0b0"/><path d="M0-31V80" stroke="#f5d580" stroke-width="13"/><path d="M0-30Q-63-84-46-91Q-21-106 0-30Q24-103 48-89Q67-76 0-30Z" fill="#f5d580"/>',
flame:'<path d="M0-78Q63-10 49 49Q10 107-39 60Q-74 25-29-34Q-33 10-12 18Q7-10 0-78Z" fill="#e99670"/><path d="M8-9Q46 46 16 72Q-17 93-20 47Z" fill="#f3d88b"/>',
law:'<g transform="rotate(-22)"><rect x="-65" y="-52" width="97" height="43" rx="10" fill="#bc987d"/><path d="M-17-9V78" stroke="#bc987d" stroke-width="20"/></g><path d="M-74 84H68" stroke="#8e7871" stroke-width="15"/>',
shield:'<path d="M-63-59L0-79 63-59V5Q61 53 0 80Q-59 53-63 5Z" fill="#98bdbc"/><path d="M-29 0L-6 27 34-25" stroke="#faf0cf" fill="none" stroke-width="12"/>',
scale:'<path d="M0-66V72M-54 73H54M-65-42H65M-57-42L-82 17H-30ZM57-42L32 17H84Z" fill="#e9c778"/><path d="M-82 17Q-57 49-30 17M32 17Q58 49 84 17" fill="#a6baca"/>',
job:'<rect x="-77" y="-31" width="154" height="103" rx="13" fill="#b39f8f"/><path d="M-31-31V-57H31V-31M-77 7H77" fill="none"/><rect x="-11" y="-2" width="22" height="24" fill="#f1d183"/>',
social:'<rect x="-64" y="-58" width="128" height="130" rx="16" fill="#f5e9d2"/><circle cy="-18" r="25" fill="#cf9ead"/><path d="M-30 10Q0-1 31 10V31H-30Z" fill="#8db7b8"/><path d="M-42 49H-22M-9 49H42" stroke="#809eaf"/>',
bed:'<path d="M-78-8H78V70H-78Z" fill="#a4b9c2"/><path d="M-78-53V86M78 50V86" stroke-width="10"/><rect x="-69" y="-22" width="51" height="31" rx="9" fill="#f6e8cd"/><path d="M-12-8H78V51H-12Z" fill="#cb9bb4"/>',
ghost:'<path d="M-51 63V-12Q-50-73 0-74Q54-73 54-12V63L26 45 0 63-26 45Z" fill="#d5dfe5"/><ellipse cx="-17" cy="-13" rx="6" ry="10" fill="#647087"/><ellipse cx="18" cy="-13" rx="6" ry="10" fill="#647087"/><ellipse cy="20" rx="8" ry="12" fill="#647087"/>',
bug:'<ellipse cy="15" rx="31" ry="56" fill="#ac9273"/><path d="M0-38V70M-25-19L-66-48M25-19L62-47M-30 10L-73-2M31 10L73-2M-28 43L-64 62M28 43L64 62" fill="none"/><path d="M-11-38L-29-78M12-38L29-78" fill="none"/>',
coffin:'<path d="M-39-76H39L62-40 46 80H-46L-62-40Z" fill="#b59a91"/><path d="M0-33V18M-21-8H21" stroke="#e9dbbb" stroke-width="10"/>',
party:'<path d="M-70 43L-23-69 27 43Z" fill="#df9fab"/><path d="M-42-24L-5-10M-53 3L9 28" stroke="#f3d482" stroke-width="10"/><path d="M47-55L69-68M45-18L75-13M41 20L60 38M-70-56L-84-78" stroke="#8aacb7" stroke-width="7"/>',
shirt:'<path d="M-30-53L-72-37-87-4-54 13-43-5V76H43V-5L54 13 87-4 72-37 30-53Q0-20-30-53Z" fill="#c2a5c2"/>',
shoe:'<path d="M-71 30V-25H-16Q-10 11 34 17L66 27Q84 31 79 63H-72Z" fill="#9ebcc0"/><path d="M-72 49H79M-12 2L4-10M1 13L17 0" fill="none"/>',
mirror:'<ellipse cy="-12" rx="47" ry="59" fill="#b9ced2"/><ellipse cy="-12" rx="38" ry="48" fill="#eef0dd"/><path d="M0 46V90" stroke="#b49caf" stroke-width="20"/><path d="M-19-33L11-51" stroke="#fff" stroke-width="7"/>',
crystal:'<circle cy="-7" r="57" fill="#b5a4cb"/><path d="M-44 50H44L58 74H-58Z" fill="#d6ba7c"/><path d="M-31-25Q-31-49-11-51" stroke="#f6ecdc" fill="none" stroke-width="8"/><path d="M18-30L24-14 40-8 24-2 18 14 12-2-4-8 12-14Z" fill="#f2dc8f"/>',
trash:'<path d="M-56-42H56L47 77H-47Z" fill="#96b8aa"/><path d="M-67-46H67M-22-66H22M-22-16V48M22-16V48" fill="none"/>',
lamp:'<path d="M-43-24Q-61-78 0-81Q61-78 43-24L23 9H-23Z" fill="#f1ce75"/><path d="M-23 10V37H23V10M0-99V-117M-65-76L-85-87M65-76L85-87" fill="none"/><path d="M-22 38H22" stroke-width="10"/>',
candy:'<path d="M-43-17L-83-38V32L-43 10M43-17L83-38V32L43 10" fill="#cd9fc0"/><ellipse rx="50" ry="39" fill="#e8c47e"/><path d="M-23-34L-9 36M10-38L25 32" stroke="#d99cae" stroke-width="11"/>',
toilet:'<path d="M-50-69H14V-7H-50Z" fill="#b5cad0"/><path d="M-70-8H67Q62 51 7 56V79H-21V35Q-62 34-70-8Z" fill="#efeee0"/><ellipse cy="-7" rx="60" ry="16" fill="#f9f4e3"/>',
street:'<path d="M-38-83H38L83 83H-83Z" fill="#a2a8af"/><path d="M0-75V75" stroke="#fff0bc" stroke-width="8" stroke-dasharray="20 17"/>',
crown:'<path d="M-65-31L-36-5 0-54 36-5 65-31 54 63H-54Z" fill="#efce7e"/><circle cy="22" r="13" fill="#dca0ac"/>',
person:person(0,-20,'#91b9c0','up')
};
for(const q of CRUEL_QUESTIONS)for(let i=0;i<2;i++){
 const bg=i?'#dbeaf0':'#fae0df',accent=i?'#60869c':'#b76b83',scene=q.scenes[i],prop=shapes[scene];if(!prop)throw Error('Missing scene '+scene);
 const body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 270" role="img"><title>'+esc(q.options[i])+'</title><desc>原創插畫：'+esc(q.prompt+'；'+q.options[i])+'</desc><rect width="420" height="270" rx="24" fill="'+bg+'"/><circle cx="294" cy="139" r="105" fill="'+accent+'" opacity=".13"/><path d="M24 237Q210 216 397 237" stroke="'+accent+'" stroke-width="3" fill="none"/><g stroke="#404654" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+person(99,116,i?'#9b92b9':'#87b8ac',i?'up':'normal')+'<g transform="translate(287 128) rotate('+(i?4:-4)+') scale(.97)">'+prop+'</g><path d="M171 89Q189 62 209 61M172 179L196 182" stroke="'+accent+'" fill="none"/><circle cx="370" cy="35" r="4" fill="'+accent+'" stroke="none"/><path d="M39 34V47M33 41H46" stroke="'+accent+'"/></g></svg>';
 fs.writeFileSync(path.join(out,q.id+'-'+(i?'b':'a')+'.svg'),body);
}console.log(CRUEL_QUESTIONS.length+' original paired cards rendered');
