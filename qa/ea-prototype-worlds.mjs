/** Browser acceptance fixtures: each state is reached through public gameplay commands. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Player} from './ea-player.mjs';
import * as sim from '../dist/ea-sim.mjs';
await mkdir(new URL('./prototype-worlds/',import.meta.url),{recursive:true});
const save=async(id,p)=>{p.validate();await writeFile(new URL(`./prototype-worlds/${id}.json`,import.meta.url),JSON.stringify(p.state));};
const early=new Player();await save('estate-1',early);early.chapterOne();early.recruitTo(5);await save('estate-2',early);
const before=new Player().foundation().prepareRevenge().finishRevenge();before.recruitTo(12);before.build('kitchen');before.build('workshop');before.claimReady();before.resources(sim.foundingStatus(before.state).cost);before.action('foundSect','云岫承道仙府');await save('estate-3',before);
const reference=JSON.parse(await readFile(new URL('./ea-reference-world.json',import.meta.url),'utf8'));
for(const id of Object.keys(sim.REGIONS)){const p=new Player(structuredClone(reference));p.rest();const companions=sim.companionOptions(p.state,id).filter(x=>x.willing).slice(0,2).map(x=>x.id);p.action('startExploration',id,{companionIds:companions});p.until(s=>s.world.exploration?.status==='exploring',{limit:100,chunk:1});p.action('moveExploration',8,4);p.until(s=>sim.explorationOptions(s).active.canInteract,{limit:40,chunk:1});await save(id,p);console.log(id,companions);}
const fight=new Player(JSON.parse(await readFile(new URL('./ea-battle-ready-world.json',import.meta.url),'utf8')));fight.action('resolveExploration','challenge');await save('battle',fight);

const party=new Player(JSON.parse(await readFile(new URL('./ea-battle-ready-world.json',import.meta.url),'utf8')));party.action('leaveRegion');party.rest();party.until(s=>sim.companionOptions(s,'qixia').some(o=>o.id===2&&o.willing),{limit:600,chunk:1});party.explore('qixia','challenge',{}, {leave:false,companions:[2]});await save('battle-party',party);
const visitor=new Player(structuredClone(reference));visitor.rest();visitor.until(s=>sim.getSocietyView(s).visitors.length>0,{limit:400,chunk:1});await save('visitors',visitor);
const legacy=await import('../dist/sect-sim.mjs');const v4=legacy.initial();v4.speed=0;await writeFile(new URL('./prototype-worlds/legacy-v4.json',import.meta.url),JSON.stringify(v4));
