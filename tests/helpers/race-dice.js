// Advance the server clock explicitly; mechanical tests never wait for wall time.
function revealDice(r,perform=(action,data)=>r.act(r.actor(),action,data)){
 const d=r.diceCheck;if(!d)throw Error('Expected a dice check');
 if(d.status==='awaiting')perform('rollDice',{check:d.id});
 if(r.diceCheck.status==='rolling')r.advanceDice(r.diceCheck.readyAt);
}
function settleDice(r,perform=(action,data)=>r.act(r.actor(),action,data)){
 for(let n=0;r.diceCheck;n++){if(n>100)throw Error('Dice chain did not settle');revealDice(r,perform);perform('acceptDice',{check:r.diceCheck.id});}
}
function autoStep(r){if(r.diceCheck?.status==='rolling')r.advanceDice(r.diceCheck.readyAt);else r.auto();}
module.exports={revealDice,settleDice,autoStep};
