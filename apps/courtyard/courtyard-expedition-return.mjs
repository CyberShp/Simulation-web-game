const HOME='scene:yunxiu-courtyard';

/** Public route projection only; the travel transaction validates actual costs. */
export function expeditionReturnPlan(world){
 if(!world?.scene||world.scene.id===HOME||world.travel)return null;
 const exit=world.exits?.find(item=>item.destination===HOME);
 if(exit)return {kind:'exit',available:exit.available===true,label:exit.near?'启程返院':'走向归院道',reason:exit.reason||'',request:{action:'exit',exitId:exit.id}};
 const home=world.destinations?.find(item=>item.id===HOME);
 if(!home)return {kind:'travel',available:false,label:'返院路线未明',reason:'尚未取得通往山院的路线。',request:null};
 const costs=Object.entries(home.cost||{}).filter(([,amount])=>amount>0).map(([key,amount])=>`${{food:'口粮',jade:'灵石',herb:'草药'}[key]||key}${amount}`).join('、');
 return {kind:'travel',available:home.available??home.reachable===true,label:'启程返院',reason:[home.reason,costs&&`预计需${costs}，同行与票费按实际出发核算。`].filter(Boolean).join(' '),request:{action:'travel',destination:HOME,companions:[...(world.party?.companionIds||[])]}};
}
