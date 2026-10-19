import {computed,ref,watch} from 'vue';
import type {RaceDomain} from '../../contracts/race';
import {accepts} from './race-meta';
export function useRaceSelection(model:RaceDomain){
 const car=ref(''),die=ref(-1),command=ref(''),commandDie=ref(-1),repairCar=ref('');
 const player=computed(()=>model.state?.players.find(p=>p.id===model.state?.me)),cars=computed(()=>model.state?.cars.filter(c=>c.owner===model.state?.me)||[]),selected=computed(()=>cars.value.find(c=>c.id===car.value));
 function reason(kind:string){const p=player.value,c=selected.value;if(!p)return '尚未入座';if(p.commandUsed)return '本輪已使用指令';if(!c)return '先選擇車輛';if(c.moved)return '滑行不能使用指令';if(p.dice.filter(d=>!d.used).length<2)return '需兩顆未使用骰子';if(!p.dice.some(d=>!d.used&&accepts(kind,d.value)))return '沒有符合點數的骰子';if(kind==='repair'&&!cars.value.some(c=>!c.dead&&c.damage.length))return '沒有可維修車輛';return '';}
 function normalize(){const s=model.state,p=player.value;if(!s||!p)return;if(!s.available.includes(car.value))car.value=s.available[0]||'';if(!p.dice[die.value]||p.dice[die.value]?.used)die.value=p.dice.findIndex(d=>!d.used);if(!command.value||reason(command.value)){command.value='';commandDie.value=-1;}else if(commandDie.value===die.value||!p.dice[commandDie.value]||p.dice[commandDie.value]?.used||!accepts(command.value,p.dice[commandDie.value]!.value)){commandDie.value=p.dice.findIndex((d,i)=>!d.used&&i!==die.value&&accepts(command.value,d.value));if(commandDie.value<0){commandDie.value=die.value;die.value=p.dice.findIndex((d,i)=>!d.used&&i!==commandDie.value);}}if(!cars.value.some(c=>c.id===repairCar.value&&!c.dead&&c.damage.length))repairCar.value=cars.value.find(c=>!c.dead&&c.damage.length)?.id||'';}
 watch(()=>[model.state?.code,model.state?.round,model.state?.phase,model.state?.version],normalize,{immediate:true});
 function selectCommand(value:string){command.value=value;normalize();}
 function selectCommandDie(value:number){const p=player.value;if(!p?.dice[value]||p.dice[value]?.used||!accepts(command.value,p.dice[value]!.value))return;if(value===die.value)die.value=commandDie.value>=0&&commandDie.value!==value&&!p.dice[commandDie.value]?.used?commandDie.value:p.dice.findIndex((d,i)=>i!==value&&!d.used);commandDie.value=value;normalize();}
 return {car,die,command,commandDie,repairCar,player,cars,selected,reason,normalize,selectCommand,selectCommandDie};
}
