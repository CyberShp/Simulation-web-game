import {TECHNIQUES,log} from './ea-data.mjs';
import {spendResources} from './ea-sr-equipment.mjs';

// Y-001/003/004/011/012/013/041/043 and Y-228–234. One independent art per key.
export const OPENING_INHERITANCES=Object.freeze({
 qinglan:{name:'青岚',heart:'qingyuan',attack:'qingwind',guard:'qingguard',element:'风',supply:'灵脉与灵石',temper:'平稳、适性宽',flavor:'风过岚岭，先护住一息，再借风开路。',attackMode:'远距引风',guardMode:'护息挡势',source:'听雨遗址旧卷藏处'},
 chiyang:{name:'赤阳',heart:'ember',attack:'firestrike',guard:'fireguard',element:'火',supply:'日精与地火',temper:'进境快、劳损高',flavor:'朝日入脉，焰从指间起，盛时亦须惜身。',attackMode:'灼脉直击',guardMode:'聚焰隔身',source:'青溪坊市寄售原本'},
 hanquan:{name:'寒泉',heart:'frost',attack:'froststrike',guard:'frostguard',element:'水',supply:'寒潭与阴凉静室',temper:'耐久、起手偏慢',flavor:'听泉滴石，凝息如针，静极而后发。',attackMode:'凝水穿刺',guardMode:'寒流卸劲',source:'听雨遗址灵泉浅滩'},
 houttu:{name:'厚土',heart:'earth',attack:'earthstrike',guard:'earthguard',element:'土',supply:'地脉与青石',temper:'承压强、挪步慢',flavor:'脚下有山，立得稳，才托得起身前之人。',attackMode:'石脊短击',guardMode:'立足护位',source:'听雨遗址旧护阵拓刻'},
 jinfeng:{name:'金锋',heart:'goldmain',attack:'swordbasic',guard:'metalguard',element:'金',supply:'金石与磨剑场',temper:'破绽强、须持剑',flavor:'磨锋养息，持剑开路，锋芒从一寸处生。',attackMode:'开山剑式',guardMode:'横锋格挡',source:'青溪坊市旧兵铺封卷'}
});

const COMBAT_PROFILES=Object.freeze({
 qinglan:{range:6,cost:16,damage:25,guardSeconds:2.2},
 chiyang:{range:5.4,cost:20,damage:29,guardSeconds:1.8},
 hanquan:{range:6.5,cost:17,damage:23,guardSeconds:2.6},
 houttu:{range:3.8,cost:14,damage:27,guardSeconds:2.8},
 jinfeng:{range:2.2,cost:12,damage:30,guardSeconds:2.3}
});
export function openingCombatProfile(s){
 const selected=s.story?.opening?.inheritance?.selected||'qinglan';
 const kit=OPENING_INHERITANCES[selected];
 return kit?{...COMBAT_PROFILES[selected],attackName:TECHNIQUES[kit.attack].name,guardName:TECHNIQUES[kit.guard].name,attackArtId:kit.attack,guardArtId:kit.guard}:null;
}

export function openingInheritanceView(s){
 const record=s.story?.opening?.inheritance;
 if(!record)return null;
 return {status:record.status,selected:record.selected??null,options:Object.entries(OPENING_INHERITANCES).map(([id,kit])=>({id,...kit,heartName:TECHNIQUES[kit.heart].name,attackName:TECHNIQUES[kit.attack].name,guardName:TECHNIQUES[kit.guard].name}))};
}

export function beginOpeningInheritance(s){
 const record=s.story?.opening?.inheritance;
 if(!record||record.status!=='sealed')return;
 record.status='pending';record.openedTick=s.worldTick;record.resumeSpeed=s.speed;s.speed=0;
 log(s,'灵草药力入脉。你解开母亲逃亡时塞来的旧布包，摸到一卷封好的传承。');
}

export function chooseOpeningInheritance(s,id){
 const record=s.story?.opening?.inheritance,kit=OPENING_INHERITANCES[id];
 if(!record||record.status!=='pending')throw Error('此刻没有待择的传承。');
 if(!kit)throw Error('此处没有这条传承。');
 const p=s.master;
 p.main=kit.heart;p.knowledge={};p.artsById??={};
 for(const artId of [kit.heart,kit.attack,kit.guard]){
  p.knowledge[artId]=40;
  p.artsById[artId]={artId,access:true,understanding:40,mastery:0,source:'mother-package',chapter:'qi'};
  if(!s.doctrine.books.includes(artId))s.doctrine.books.push(artId);
 }
 record.status='chosen';record.selected=id;record.chosenTick=s.worldTick;record.recovered=[];
 s.speed=record.resumeSpeed;delete record.resumeSpeed;
 log(s,`你启开卷上的封缄，得见《${TECHNIQUES[kit.heart].name}》与两式攻守法。`);
 return {selected:id,heart:kit.heart,attack:kit.attack,guard:kit.guard};
}

const LATER_SOURCES=Object.freeze({
 qinglan:{sceneId:'scene:ruins',objectId:'object:ruins:notes'},
 chiyang:{sceneId:'scene:market',objectId:'object:market:merchant',cost:{jade:120}},
 hanquan:{sceneId:'scene:ruins',objectId:'object:ruins:pool'},
 houttu:{sceneId:'scene:ruins',objectId:'object:ruins:seal'},
 jinfeng:{sceneId:'scene:market',objectId:'object:market:merchant',cost:{jade:120}}
});
export function openingRecoveryOptions(s,objectId){
 const record=s.story?.opening?.inheritance;
 if(record?.status!=='chosen')return [];
 return Object.entries(LATER_SOURCES).filter(([id,source])=>source.objectId===objectId&&id!==record.selected&&!record.recovered?.includes(id)).map(([id,source])=>({id,name:OPENING_INHERITANCES[id].name,cost:source.cost||null}));
}
export function recoverOpeningInheritance(s,id){
 const record=s.story?.opening?.inheritance,kit=OPENING_INHERITANCES[id],source=LATER_SOURCES[id];
 if(!record||record.status!=='chosen'||!kit||id===record.selected||record.recovered?.includes(id))throw Error('这条传承并非当前可寻的原本。');
 const position=s.master.location?.kind==='local'?s.master.location:s.master.position;
 if(position?.sceneId!==source.sceneId||s.srWorld?.activeTravelId||s.combat?.status==='active')throw Error('须亲自到达线索所指地点。');
 const point={qinglan:[42,30],chiyang:[37,18],hanquan:[42,16],houttu:[22,17],jinfeng:[37,18]}[id];
 if(Math.hypot(position.x-point[0],position.y-point[1])>6)throw Error('须走近传承原本所在之处。');
 if(source.cost)spendResources(s,source.cost);
 for(const artId of [kit.heart,kit.attack,kit.guard])if(!s.doctrine.books.includes(artId))s.doctrine.books.push(artId);
 record.recovered.push(id);
 s.factsById[`fact:opening-inheritance:${id}`]={id:`fact:opening-inheritance:${id}`,kind:'inheritance-source',inheritanceId:id,sceneId:source.sceneId,objectId:source.objectId,atTick:s.worldTick};
 log(s,`在${kit.source}取得${kit.name}原本。山院有了接触机会，仍须实际研习才能掌握。`);
 return {inheritanceId:id,arts:[kit.heart,kit.attack,kit.guard]};
}

export function validateOpeningInheritance(s){
 const r=s.story?.opening?.inheritance;
 if(!r)return true; // Existing saves keep their actual learned arts.
 if(!['sealed','pending','chosen'].includes(r.status)||r.selected!==null&&(!OPENING_INHERITANCES[r.selected]||r.status!=='chosen'))throw Error('开局传承记录异常。');
 if(r.status==='pending'&&(s.speed!==0||!Number.isSafeInteger(r.openedTick)||![0,1,2,4].includes(r.resumeSpeed)))throw Error('择法期间的世界暂停记录异常。');
 if(r.status==='chosen'){
  const kit=OPENING_INHERITANCES[r.selected];
  if(!kit||[kit.heart,kit.attack,kit.guard].some(id=>!s.doctrine.books.includes(id)||!(s.master.knowledge[id]>0)))throw Error('所择传承与已学内容不符。');
  if(!Array.isArray(r.recovered)||new Set(r.recovered).size!==r.recovered.length||r.recovered.some(id=>!OPENING_INHERITANCES[id]||id===r.selected||!LATER_SOURCES[id]||!s.factsById[`fact:opening-inheritance:${id}`]||[OPENING_INHERITANCES[id].heart,OPENING_INHERITANCES[id].attack,OPENING_INHERITANCES[id].guard].some(art=>!s.doctrine.books.includes(art))))throw Error('寻回传承记录异常。');
 }
 return true;
}
