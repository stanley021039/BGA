import { array, record, text } from '../services/validation';
export interface StudioArtwork { id:string; name:string; mime:'image/png'|'image/gif'|'image/webp'; url:string; createdAt:string }
export interface StudioEditor { flatten():HTMLCanvasElement; importFiles(files:File[]):Promise<{added:number;errors:string[]}|undefined>; readonly revision:number; readonly dimensions:{width:number;height:number}; destroy():void }
export function readStudioArtwork(value:unknown):StudioArtwork {
 const x=record(value),id=text(x.id),mime=text(x.mime),url=text(x.url);
 if(!id || !['image/png','image/gif','image/webp'].includes(mime) || url!=='/assets/artworks/'+id)throw Error('圖庫資料格式不正確');
 return {id,name:text(x.name),mime:mime as StudioArtwork['mime'],url,createdAt:text(x.createdAt)};
}
export function readStudioArtworks(value:unknown):StudioArtwork[]{return array(record(value).artworks).map(readStudioArtwork);}
export function studioName(value:string):string {const name=value.trim();if(!name||[...name].length>40||/[\u0000-\u001f\u007f]/.test(name))throw Error('作品名稱需為 1–40 字，且不能換行。');return name;}
