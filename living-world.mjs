import * as world from './world.mjs?v=ea-160-courtyard-20261008-r17';
export * from './world.mjs?v=ea-160-courtyard-20261008-r17';
export const GOODS={wood:{name:'灵木',buy:18,sell:7},stone:{name:'青石',buy:22,sell:9},herb:{name:'灵草',buy:25,sell:10}};
const orders=[
 [{id:'timber',name:'修缮山道',text:'山下村民求购灵木，修复入山栈道。',cost:{wood:25},reward:{jade:30,insight:2},rep:4},{id:'herbs',name:'悬壶济世',text:'行脚医师需要凝露草，救治山中病患。',cost:{herb:18},reward:{jade:35},rep:5},{id:'pill',name:'同道求丹',text:'云游散修求一枚聚气丹，愿以道韵相酬。',pill:'qi',reward:{jade:35,insight:5},rep:8}],
 [{id:'stone',name:'重立界碑',text:'交付青石，为仙府重立山门界碑。',cost:{stone:20},reward:{jade:32,insight:2},rep:4},{id:'supplies',name:'远行补给',text:'为远行同道备好灵木与药草。',cost:{wood:15,herb:10},reward:{jade:38},rep:6},{id:'pill',name:'护送丹药',text:'送一枚聚气丹至邻峰，结下一段善缘。',pill:'qi',reward:{jade:35,crystal:2},rep:8}],
 [{id:'garden',name:'灵圃整修',text:'灵木与青石可助山下灵圃恢复生机。',cost:{wood:15,stone:12},reward:{jade:38,herb:12},rep:5},{id:'herbs',name:'草木问道',text:'以一束灵草，换取游方丹师的心得。',cost:{herb:22},reward:{jade:25,insight:4},rep:5},{id:'pill',name:'丹香结缘',text:'以一枚聚气丹结交远客，增益宗门声望。',pill:'qi',reward:{jade:40,insight:4},rep:8}]
];
const fresh=day=>({day,fulfilled:[],trades:{wood:0,stone:0,herb:0},completed:0});
export const gameDay=s=>Math.floor(s.time/120);
function renew(s){if(s.community.day!==gameDay(s)){const completed=s.community.completed;s.community=fresh(gameDay(s));s.community.completed=completed;}}
export function initial(){const s=world.initial();s.version=3;s.community=fresh(0);return s;}
export function tick(s,dt){world.tick(s,dt);renew(s);}
export function commissions(s){return orders[gameDay(s)%orders.length];}
export function fulfill(s,id,expectedDay=gameDay(s)){if(expectedDay!==gameDay(s))throw Error('委托已轮换，请查看今日委托。');renew(s);const o=commissions(s).find(x=>x.id===id);if(!o||s.community.fulfilled.includes(id))throw Error('此委托已完成或已经轮换。');if(o.pill&&s.pills[o.pill]<1)throw Error('请先炼制一枚聚气丹。');world.pay(s,o.cost||{});if(o.pill)s.pills[o.pill]--;for(const[k,v]of Object.entries(o.reward))s.resources[k]+=v;s.sect.reputation+=o.rep;s.community.fulfilled.push(id);s.community.completed++;world.addLog(s,`完成委托「${o.name}」，获得灵材与 ${o.rep} 点声望。`);}
export function trade(s,key,side,expectedDay=gameDay(s)){if(expectedDay!==gameDay(s))throw Error('货郎已补货，请查看今日价格。');renew(s);const g=GOODS[key];if(!g||!['buy','sell'].includes(side))throw Error('交易不存在。');if(side==='buy'){if(s.community.trades[key]>=5)throw Error('此灵材今日已售罄，下一游戏日补货。');world.pay(s,{jade:g.buy});s.resources[key]+=10;s.community.trades[key]++;}else{world.pay(s,{[key]:10});s.resources.jade+=g.sell;}world.addLog(s,`${side==='buy'?'购入':'售出'}${g.name} 10 份，${side==='buy'?'花费':'获得'}灵石 ${g[side]}。`);}
export function validateSave(input){const copy=structuredClone(input),version=copy?.version;if(![1,2,3].includes(version))throw Error('不支持的存档版本。');if(version===3)copy.version=2;const s=world.validateSave(copy);s.version=3;if(version<3)s.community=fresh(gameDay(s));const c=s.community;if(!c||!Number.isSafeInteger(c.day)||c.day!==gameDay(s)||!Number.isSafeInteger(c.completed)||c.completed<0||!Array.isArray(c.fulfilled)||new Set(c.fulfilled).size!==c.fulfilled.length||!c.fulfilled.every(id=>commissions(s).some(o=>o.id===id))||c.completed<c.fulfilled.length||!c.trades||!Object.keys(GOODS).every(k=>Number.isInteger(c.trades[k])&&c.trades[k]>=0&&c.trades[k]<=5))throw Error('坊市与委托存档字段异常。');return s;}
