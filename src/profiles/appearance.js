const {HttpError}=require('../http/errors');

const parts={hair:['short','long','curly','bun'],face:['round','oval','square'],outfit:['hoodie','jacket','dress','shirt']};
const colors={skin:['#f6d6b8','#dca77c','#b87955','#8b583e','#5d392d'],hair:['#2b2020','#60432c','#ab7043','#d3ae70','#5a4b72','#a74c55'],outfit:['#557bb5','#be665f','#6b9a74','#9a78ae','#c0934f','#506773']};
const defaults={version:1,hair:'short',face:'round',outfit:'hoodie',skinColor:colors.skin[0],hairColor:colors.hair[0],outfitColor:colors.outfit[0]};

function validateAppearance(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Number(input.version)!==1)throw new HttpError(400,'INVALID_APPEARANCE','角色資料版本不正確');
 for(const key of Object.keys(parts))if(!parts[key].includes(input[key]))throw new HttpError(400,'INVALID_APPEARANCE','角色部件不正確');
 for(const [key,palette] of [['skinColor',colors.skin],['hairColor',colors.hair],['outfitColor',colors.outfit]])if(!palette.includes(input[key]))throw new HttpError(400,'INVALID_APPEARANCE','角色顏色不正確');
 return {version:1,hair:input.hair,face:input.face,outfit:input.outfit,skinColor:input.skinColor,hairColor:input.hairColor,outfitColor:input.outfitColor};
}

function renderAppearance(value){
 const a=validateAppearance(value),face={round:'<ellipse cx="80" cy="69" rx="31" ry="35"/>',oval:'<ellipse cx="80" cy="70" rx="27" ry="39"/>',square:'<rect x="50" y="35" width="60" height="72" rx="17"/>'}[a.face];
 const outfit={hoodie:'<path d="M23 160v-26q4-32 43-37h28q39 5 43 37v26z"/><path d="M61 103q19 28 38 0" fill="none" stroke="#ffffff66" stroke-width="4"/>',jacket:'<path d="M20 160v-27q7-33 45-36h30q38 3 45 36v27z"/><path d="M80 101v59" fill="none" stroke="#ffffff99" stroke-width="4"/>',dress:'<path d="M48 102h64l32 58H16z"/>',shirt:'<path d="M17 160v-42l37-20 26 15 26-15 37 20v42z"/>'}[a.outfit];
 const hair={short:'<path d="M48 62q-5-47 33-49 42-2 32 49-9-25-21-26-10 12-44 26z"/>',long:'<path d="M47 60q-4-46 34-47 41-1 34 48l6 62-23 5-2-77q-12-10-30 0l-3 77-23-5z"/>',curly:'<path d="M42 63q-12-12 1-22-2-17 16-20 9-17 26-11 17-8 29 8 20 1 18 20 14 10 1 24l-16 5q0-28-18-29-22 12-41 4l-1 25z"/>',bun:'<circle cx="81" cy="13" r="17"/><path d="M46 65q-4-47 36-48 40-1 34 48-8-25-18-28-13 11-52 28z"/>'}[a.hair];
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="角色外觀"><rect width="160" height="160" rx="25" fill="#ede5d6"/><path d="M48 105q32 16 64 0v55H48z" fill="${a.skinColor}"/><g fill="${a.outfitColor}">${outfit}</g><g fill="${a.skinColor}">${face}</g><path d="M65 72h1m28 0h1" stroke="#332a29" stroke-width="5" stroke-linecap="round"/><path d="M72 87q8 7 16 0" fill="none" stroke="#8a514b" stroke-width="2.5" stroke-linecap="round"/><g fill="${a.hairColor}">${hair}</g></svg>`;
}

module.exports={parts,colors,defaults,validateAppearance,renderAppearance};
