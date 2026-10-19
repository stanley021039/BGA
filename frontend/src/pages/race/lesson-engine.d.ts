import type { LessonRoom } from './lesson-scenarios.js';
export const TutorialEngine:{ThunderRoom:new(code:string,name:string,rng?:(n:number)=>number)=>LessonRoom;neighbor(x:number,y:number,direction:number):{x:number;y:number};SHOT_DIE:string[]};
