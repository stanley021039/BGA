export interface LessonCell {kind:string;hazard?:{kind:string;face:boolean}}
export interface LessonCar {id:string;owner:string;size:number;dead:boolean;x:number;y:number;damage:unknown[]}
export interface LessonPlayer {id:string;name:string;dice:{value:number;used:boolean}[];turns:number;chopper:{x:number;y:number;chopper?:boolean}|null}
export interface LessonRoom {cars:LessonCar[];players:LessonPlayer[];tiles:{name:string;cells:LessonCell[][]}[];phase:string;code:string;name:string;finishAt:number|null;tileCount:number;log:string[];diceCheck:{id:number;status:string;readyAt?:number}|null;actor():string;terrain(x:number,y:number):LessonCell;view(id:string):Record<string,unknown>;advanceDice(now?:number):boolean}
export interface LessonOutcome {ok:boolean;text:string}
export interface LessonMission {title:string;goal:string;why:string;hint:string;flag?:{x:number;y:number};dice:number[]}
export interface LessonScenario {r:LessonRoom;p:LessonPlayer;q:LessonPlayer;car:LessonCar;target:LessonCar;ally:LessonCar;index:number;bonus:boolean;command:string;moveValue?:number;commandValue?:number;result:LessonOutcome|null}
export const LessonScenarios:{missions:LessonMission[];createScenario(index:number):LessonScenario;outcome(scene:LessonScenario):LessonOutcome|null;act(scene:LessonScenario,action:string,data?:Record<string,unknown>):LessonOutcome|null};
