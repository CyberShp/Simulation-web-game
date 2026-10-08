import * as base from './model.mjs?v=ea-160-courtyard-20261008-r8';
export * from './model.mjs?v=ea-160-courtyard-20261008-r8';
const {TYPES,RESOURCE,addLog,pay,canPay}=base;
Object.assign(RESOURCE,{crystal:'灵晶',insight:'道韵'});
Object.assign(TYPES,{
 alchemy:{name:'丹霞炉',short:'丹房',sprite:6,desc:'以灵草入炉，凝聚丹药。炼制聚气丹与灵息丹，助弟子精进。',cost:{jade:65,wood:35,stone:30},out:{},duration:20,work:false,max:3},
 library:{name:'藏经阁',short:'藏经',sprite:7,desc:'派遣弟子整理古卷，每轮获得道韵。道韵用于提升宗门。',cost:{jade:75,wood:50,stone:25},out:{insight:4},duration:20,work:true,max:3},
 well:{name:'灵泉',short:'灵泉',sprite:8,desc:'汲取地脉灵气，凝聚灵晶。需要二阶宗门，可支持高阶炼丹。',cost:{jade:110,stone:60,insight:10},out:{crystal:2},duration:20,work:true,max:3}
});
export const RECIPES={
 qi:{name:'聚气丹',description:'温养经脉，获得 35 点修为。',cost:{jade:15,herb:12},duration:25,effect:{xp:35,energy:0},sectLevel:1},
 spirit:{name:'灵息丹',description:'获得 70 点修为，恢复 40 点精力。',cost:{jade:30,herb:20,crystal:3},duration:40,effect:{xp:70,energy:40},sectLevel:2}
};
export const EXPEDITIONS={
 valley_path:{name:'青萝采药',scene:'valley',description:'循溪入谷，采撷林间灵草。',duration:40,minRealm:1,sectLevel:1,energy:20,cost:{jade:10},reward:{herb:24,wood:12},reputation:12,x:540,y:500},
 valley_ruins:{name:'古树问灵',scene:'valley',description:'参悟古树灵纹，寻一缕天地道韵。',duration:55,minRealm:1,sectLevel:1,energy:25,cost:{jade:15},reward:{insight:10,crystal:2},reputation:15,x:1010,y:580},
 lake_shore:{name:'寒潭取晶',scene:'lake',description:'踏上寒潭石岸，采集水府灵晶。',duration:65,minRealm:2,sectLevel:2,energy:30,cost:{jade:25,herb:5},reward:{crystal:8,herb:16},reputation:20,x:1030,y:440},
 lake_depths:{name:'残阵悟道',scene:'lake',description:'辨读水府遗阵，带回失传的道韵。',duration:85,minRealm:3,sectLevel:2,energy:35,cost:{jade:35,crystal:2},reward:{insight:24,jade:90},reputation:25,x:520,y:535}
};
const traits=['草木亲和','心澄如水','坚韧不拔','丹心灵慧'];
export function initial(){const s=base.initial();s.version=2;Object.assign(s.resources,{crystal:0,insight:0});s.sect={level:1,reputation:0};s.pills={qi:0,spirit:0};s.crafting=null;s.expedition=null;Object.assign(s.stats,{expeditions:0,crafted:0});s.disciples.forEach((d,i)=>Object.assign(d,{energy:100,trait:traits[i%4]}));return s;}
export function buildingLock(s,type){if(!TYPES[type]||type==='hall')return '仙府根基不可重复营造';if(type==='well'&&s.sect.level<2)return '宗门二阶解锁';if(type==='alchemy'&&s.buildings.some(b=>b.type===type))return '丹霞炉已建成';return '';}
export function build(s,type,x,y){const lock=buildingLock(s,type);if(lock)throw Error(lock);return base.build(s,type,x,y);}
export function isAway(s,id){return s.expedition?.discipleId===id;}
export function rates(s){const out=Object.fromEntries(Object.keys(RESOURCE).map(k=>[k,0]));for(const b of s.buildings){const d=s.disciples.find(d=>d.job===b.id),t=TYPES[b.type];if(t.work&&!d)continue;const m=b.level*(d?d.talent*(1+.1*(d.realm-1)):1);for(const[k,v]of Object.entries(t.out))out[k]+=v*m;}return out;}
export function assign(s,id,job){if(isAway(s,id))throw Error('此弟子正在游历，归来后才能安排事务。');return base.assign(s,id,job);}
export function recruit(s){const d=base.recruit(s);Object.assign(d,{energy:100,trait:traits[(d.id-1)%4]});return d;}
export function breakthrough(s,id){if(isAway(s,id))throw Error('游历归来后方可突破。');return base.breakthrough(s,id);}
export function sectUpgradeCost(s){if(s.sect.level>=3)return null;return s.sect.level===1?{cost:{jade:150,wood:80,stone:50,insight:10},reputation:40}:{cost:{jade:320,wood:150,stone:120,crystal:15,insight:35},reputation:120};}
export function upgradeSect(s){const c=sectUpgradeCost(s);if(!c)throw Error('已达当前最高宗门品阶。');if(s.sect.reputation<c.reputation)throw Error(`宗门声望需达到 ${c.reputation}。`);pay(s,c.cost);s.sect.level++;addLog(s,`青岚仙府晋升${s.sect.level}阶，山门气象焕然一新。`);}
export function craft(s,id){const r=RECIPES[id];if(!r)throw Error('丹方不存在。');if(!s.buildings.some(b=>b.type==='alchemy'))throw Error('请先营造丹霞炉。');if(s.sect.level<r.sectLevel)throw Error('此丹方需宗门二阶。');if(s.crafting)throw Error('丹炉正在炼制，请稍候。');pay(s,r.cost);const level=s.buildings.find(b=>b.type==='alchemy').level;const total=r.duration/(1+(level-1)*.3);s.crafting={recipeId:id,remaining:total,total};addLog(s,`${r.name}已入炉，静候丹成。`);}
export function usePill(s,id,discipleId){const r=RECIPES[id],d=s.disciples.find(d=>d.id===discipleId);if(!r||!d)throw Error('丹药或弟子不存在。');if(isAway(s,d.id))throw Error('游历归来后方可服丹。');if(s.pills[id]<1)throw Error('此丹药库存不足。');if(d.xp>=d.realm*100&&(!r.effect.energy||d.energy>=100))throw Error('修为已满，请先突破；此时服丹不会获得收益。');s.pills[id]--;d.xp=Math.min(d.realm*100,d.xp+r.effect.xp);d.energy=Math.min(100,d.energy+r.effect.energy);addLog(s,`${d.name}服下${r.name}，调息精进。`);}
export function expeditionLock(s,id){const r=EXPEDITIONS[id];if(!r)return '游历地点不存在';if(s.sect.level<r.sectLevel)return `宗门${r.sectLevel}阶解锁`;return '';}
export function startExpedition(s,id,discipleId){const r=EXPEDITIONS[id],d=s.disciples.find(d=>d.id===discipleId),lock=expeditionLock(s,id);if(lock)throw Error(lock);if(s.expedition)throw Error('已有弟子在外游历，请先等待归来。');if(!d)throw Error('请先选择弟子。');if(d.realm<r.minRealm)throw Error(`需炼气${r.minRealm}层。`);if(d.energy<r.energy)throw Error(`精力不足，需要 ${r.energy} 点；休憩可恢复。`);pay(s,r.cost);d.energy-=r.energy;d.job=null;s.expedition={routeId:id,discipleId:d.id,remaining:r.duration,total:r.duration,status:'traveling',encounterResolved:false,multiplier:1};addLog(s,`${d.name}离山游历，前往「${r.name}」。`);}
export function cancelExpedition(s){if(!s.expedition)throw Error('当前无人游历。');const d=s.disciples.find(d=>d.id===s.expedition.discipleId);addLog(s,`${d.name}结束游历，提前归山；本次未获奖励，出行消耗不返还。`);s.expedition=null;}
export function resolveEncounter(s,id){const e=s.expedition;if(!e||e.status!=='encounter'||!['careful','bold'].includes(id))throw Error('当前奇遇不可处理。');const d=s.disciples.find(d=>d.id===e.discipleId);if(id==='bold'&&d.energy<10)throw Error('深入探寻需额外 10 点精力。');if(id==='bold'){d.energy-=10;e.multiplier=1.5;}else e.multiplier=1;e.encounterResolved=true;e.status='traveling';addLog(s,`${d.name}${id==='bold'?'深入灵迹，预计额外收获五成。':'稳妥前行，继续原定游历。'}`);}
export function tick(s,dt){if(!Number.isFinite(dt)||dt<=0)return;const elapsed=dt*s.speed;base.tick(s,dt);if(!elapsed)return;for(const d of s.disciples)if(d.job===null&&!isAway(s,d.id))d.energy=Math.min(100,d.energy+elapsed*.6);if(s.crafting){s.crafting.remaining=Math.max(0,s.crafting.remaining-elapsed);if(!s.crafting.remaining){const id=s.crafting.recipeId;s.pills[id]++;s.stats.crafted++;addLog(s,`${RECIPES[id].name}炼成，已收入丹囊。`);s.crafting=null;}}
 const e=s.expedition;if(e?.status==='traveling'){e.remaining=Math.max(0,e.remaining-elapsed);if(!e.encounterResolved&&e.remaining<=e.total/2){e.remaining=e.total/2;e.status='encounter';addLog(s,'游历途中遇见灵迹，等待掌门抉择。');}else if(!e.remaining){const r=EXPEDITIONS[e.routeId],d=s.disciples.find(d=>d.id===e.discipleId);for(const[k,v]of Object.entries(r.reward))s.resources[k]+=Math.floor(v*e.multiplier);s.sect.reputation+=r.reputation;s.stats.expeditions++;d.xp=Math.min(d.realm*100,d.xp+30);s.expedition=null;addLog(s,`${d.name}自「${r.name}」归来，带回灵材并获得 30 修为。`);}}
}
export const QUESTS=[...base.QUESTS,
 {id:'alchemy',title:'丹火初燃',text:'建造丹霞炉，炼成第一枚丹药。',check:s=>s.stats.crafted>0,reward:{jade:70,herb:30}},
 {id:'expedition',title:'问道山外',text:'完成一次游历，将山外灵材带回仙府。',check:s=>s.stats.expeditions>0,reward:{jade:80,insight:10}},
 {id:'sect2',title:'山门渐盛',text:'将宗门晋升至二阶，开启寒潭遗境。',check:s=>s.sect.level>=2,reward:{crystal:10,herb:40}},
 {id:'realm3',title:'道心初定',text:'培养一名炼气三层弟子。',check:s=>s.disciples.some(d=>d.realm>=3),reward:{jade:150,insight:20}}
];
export function claim(s,id){const q=QUESTS.find(q=>q.id===id);if(!q||!q.check(s)||s.claimed.includes(id))throw Error('尚未完成，或奖励已领取。');for(const[k,v]of Object.entries(q.reward))s.resources[k]+=v;s.claimed.push(id);s.sect.reputation+=15;addLog(s,`完成「${q.title}」，获得奖励与 15 点声望。`);}
export function demolish(s,id){const b=s.buildings.find(b=>b.id===id);if(!b||b.type==='hall')throw Error('仙府主殿不可拆除。');if(b.type==='alchemy'&&s.crafting)throw Error('丹炉炼制中，不可拆除。');if(b.type==='house'&&s.disciples.length>base.capacity(s)-b.level*2)throw Error('拆除后居所不足，请先建造其他弟子居。');const refund={...TYPES[b.type].cost};for(let n=1;n<b.level;n++)for(const[k,v]of Object.entries(base.upgradeCost({level:n})))refund[k]=(refund[k]||0)+v;for(const[k,v]of Object.entries(refund))s.resources[k]+=v;s.disciples.filter(d=>d.job===id).forEach(d=>d.job=null);s.buildings=s.buildings.filter(x=>x.id!==id);addLog(s,`拆除${TYPES[b.type].name}，返还全部营造材料。`);return refund;}
export function validateSave(input){const s=structuredClone(input);if(!s||![1,2].includes(s.version))throw Error('不支持的存档版本。');if(s.version===1){Object.assign(s.resources,{crystal:0,insight:0});s.sect={level:1,reputation:s.claimed.length*15};s.pills={qi:0,spirit:0};s.crafting=null;s.expedition=null;Object.assign(s.stats,{crafted:0,expeditions:0});s.disciples.forEach((d,i)=>Object.assign(d,{energy:100,trait:traits[i%4]}));}
 const fail=()=>{throw Error('仙府进化存档字段异常。');};
 const finite=(n,min=0,max=1e12)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 if(!s.sect||![1,2,3].includes(s.sect.level)||!finite(s.sect.reputation)||!s.pills||!['qi','spirit'].every(k=>Number.isInteger(s.pills[k])&&finite(s.pills[k]))||!Number.isInteger(s.stats?.crafted)||s.stats.crafted<0||!Number.isInteger(s.stats?.expeditions)||s.stats.expeditions<0)fail();
 if(!Array.isArray(s.claimed)||!s.claimed.every(id=>QUESTS.some(q=>q.id===id))||new Set(s.claimed).size!==s.claimed.length)fail();
 const claimed=s.claimed;s.claimed=claimed.filter(id=>base.QUESTS.some(q=>q.id===id));s.version=1;base.validateSave(s);s.version=2;s.claimed=claimed;
 for(const d of s.disciples)if(!finite(d.energy,0,100)||typeof d.trait!=='string'||d.trait.length>30)fail();
 if(s.buildings.filter(b=>b.type==='alchemy').length>1)fail();
 if(s.crafting!==null){const c=s.crafting,r=RECIPES[c?.recipeId];if(!r||!s.buildings.some(b=>b.type==='alchemy')||s.sect.level<r.sectLevel||!finite(c.total,.01,r.duration)||!finite(c.remaining,0,c.total))fail();}
 if(s.expedition!==null){const e=s.expedition,r=EXPEDITIONS[e?.routeId],d=s.disciples.find(d=>d.id===e?.discipleId);if(!r||!d||d.job!==null||d.realm<r.minRealm||s.sect.level<r.sectLevel||e.total!==r.duration||!finite(e.remaining,0,e.total)||!['traveling','encounter'].includes(e.status)||typeof e.encounterResolved!=='boolean'||![1,1.5].includes(e.multiplier)||(e.status==='encounter'&&(e.encounterResolved||e.remaining!==e.total/2))||(!e.encounterResolved&&e.remaining<e.total/2))fail();}
 return s;
}
