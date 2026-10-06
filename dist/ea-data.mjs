/** EA data is independent of legacy shared objects. All randomness is state-owned. */
export const GAME_VERSION='1.6.0-dev';
export const DAY_LENGTH=120;
export const RESOURCES={jade:'灵石',wood:'灵木',stone:'青石',herb:'灵草',crystal:'灵晶',insight:'道韵',food:'口粮'};
export const RESOURCE=RESOURCES;
export const CELLS=[];
for(let x=0;x<12;x++)for(let y=0;y<10;y++)if(!((x===0&&y<2)||(x===7&&y>4&&y<7)||(y===0&&x>5)||(x===11&&y>7)))CELLS.push({x,y});
const building=(name,short,sprite,desc,cost,out={},work=false,extra={})=>({name,short,sprite,desc,cost,out,work,duration:20,max:3,upkeep:{},stage:0,tags:[],...extra});
export const BUILDINGS={
 hall:building('别院主屋','主屋',0,'山院根基，凝聚少量灵石，供共同居住与基础修炼。',{}, {jade:10},false,{capacity:4,unique:true,tags:['home']}),
 farm:building('灵草田','药圃',1,'门人自主照料灵草。临近灵泉增产，临近丹房利于取材。',{jade:30,wood:25,stone:10},{herb:12},true,{upkeep:{jade:1},tags:['plant']}),
 lumber:building('伐木场','伐木',2,'门人采集营造所需灵木；远离膳房与居所可免喧扰。',{jade:25,wood:20,stone:8},{wood:18},true,{upkeep:{jade:1},tags:['industry']}),
 quarry:building('采石场','采石',3,'采集营造青石，匠坊附近运输更省力。',{jade:35,wood:25},{stone:16},true,{upkeep:{jade:1},tags:['industry']}),
 house:building('门人居','居所',4,'每级提供四个床位。膳房与医庐附近休憩效果更好。',{jade:45,wood:40,stone:20},{},false,{capacity:4,tags:['home']}),
 meditation:building('聚灵台','聚灵',5,'提供正式修行场地；灵泉与藏经阁相邻提高修行效率。',{jade:60,wood:40,stone:25},{},true,{stage:1,upkeep:{jade:2},tags:['cultivation']}),
 alchemy:building('丹霞炉','丹房',6,'以丹方和炼丹知识开炉，升级缩短炼制时间。药圃相邻提高炼制效率。',{jade:65,wood:35,stone:30},{},false,{stage:1,unique:true,upkeep:{jade:2,wood:1},tags:['craft']}),
 library:building('藏经阁','藏经',7,'提供典籍接触与研读空间，整理典籍产出道韵。藏书不等于有人能授业。',{jade:65,wood:45,stone:20},{insight:6},true,{stage:1,upkeep:{jade:1},tags:['learning']}),
 well:building('灵泉','灵泉',8,'筑基修士以护脉知识接引灵脉，稳定凝聚灵晶并滋养周边灵植。',{jade:130,stone:65,insight:15},{crystal:4},true,{stage:2,realm:10,upkeep:{jade:3},tags:['water']}),
 granary:building('灵稻田','稻田',1,'门人自主种植口粮。每人每日需两份，膳房可减少消耗。',{jade:25,wood:20,stone:5},{food:22},true,{upkeep:{jade:1},tags:['plant','food']}),
 kitchen:building('山院膳房','膳房',4,'炊食减少口粮消耗，改善门人休息。每级基础节省一成口粮；近居供膳更省粮，采石干扰则降低效益。',{jade:45,wood:35,stone:20},{},false,{stage:1,unique:true,upkeep:{wood:2},tags:['home','food']}),
 clinic:building('济生医庐','医庐',6,'减少掌门疗伤所需时间；门人伤势也可自主在此休養。需有人掌握养脉或药理。',{jade:90,wood:45,stone:30,herb:15},{},false,{stage:2,upkeep:{herb:2},tags:['home','medicine']}),
 workshop:building('百工坊','匠坊',2,'以木石制作山中常用器物换取灵石，有实际原料开销。',{jade:100,wood:65,stone:45},{jade:24},true,{stage:2,input:{wood:3,stone:2},upkeep:{jade:2},tags:['industry','craft']}),
 watchtower:building('护山亭','护山',8,'以护脉阵术监护院中活动，提高发现隐患的机会，减轻风雨损耗。',{jade:120,wood:55,stone:60,insight:10},{},false,{stage:3,unique:true,upkeep:{jade:3,crystal:1},tags:['array','safety']})
};
export const TYPES=BUILDINGS;
const technique=(name,kind,element,realm,source,description,extra={})=>({name,kind,element,realm,source,description,duration:80,sourceType:'exchange',tags:[element],prerequisites:[],conflicts:[],teacherMastery:60,cost:null,...extra});
export const TECHNIQUES={
 qingyuan:technique('青岚养元诀','main','neutral',1,'家传炼气篇 · 随身带出','适性宽和的共同基础，进境提升12%，可以自学。',{sourceType:'inheritance',duration:55,cultivation:1.12}),
 spring:technique('春雨养脉法','support','water',1,'母亲药理手札 · 整理遗卷','温养经脉，休息回复额外精力，为药理路线奠基。',{sourceType:'story',duration:65,rest:.4}),
 ember:technique('赤阳行气诀','main','fire',2,'云游修士 · 交换','进境较快但耗神较多，与寒泉路线功体冲突。',{cost:{jade:140,herb:25},conflicts:['frost','river'],cultivation:1.3,fatigue:.42,prerequisites:[{id:'qingyuan',mastery:20}]}),
 frost:technique('寒泉静心诀','main','water',2,'寒潭散修 · 交换','清心节省精力，与赤阳、凝火的运气路线有特殊禁忌。',{cost:{jade:140,crystal:2},conflicts:['ember','flame'],cultivation:1.08,fatigue:.16,prerequisites:[{id:'qingyuan',mastery:20}]}),
 flame:technique('凝火诀','support','fire',2,'行脚丹师 · 交换','控制丹火，辅助进境与炼丹。水行并非全数相斥，仅寒泉静心诀禁配。',{cost:{jade:100,herb:20},conflicts:['frost'],cultivation:1.08,prerequisites:[{id:'qingyuan',mastery:20}]}),
 wood:technique('青木调息法','support','wood',1,'灵植师 · 交换','草木生机助修行，与水行相生，照料灵植时增产。',{cost:{jade:90,wood:40},cultivation:1.08,production:'plant'}),
 foundation:technique('青岚筑基篇','main','neutral',9,'旧账新证 · 可靠传承续篇','以家传炼气基础重建道基。精通此篇是筑基的可控知识来源。',{sourceType:'story',duration:180,cultivation:1.28,prerequisites:[{id:'qingyuan',mastery:40}],tags:['neutral','foundation']}),
 array:technique('护脉阵诀','support','earth',4,'父亲护脉手札 · 藏经阁研考','掌握灵脉节点、护山阵与破阵技巧，兼容三条主要路线。',{cost:{jade:120,stone:40,insight:12},duration:110,prerequisites:[{id:'qingyuan',mastery:30}],tags:['earth','array'],production:'array'}),
 alchemy:technique('丹霞药理经','support','wood',3,'母亲笔记与行脚丹师 · 互证','掌握药性与火候，支持筑基丹炼制，弟子可成长为丹道导师。',{cost:{jade:140,herb:35,insight:10},duration:110,prerequisites:[{id:'spring',mastery:20}],tags:['wood','alchemy'],production:'medicine'}),
 sword:technique('照夜御剑篇','support','metal',6,'栖霞旧道 · 商旅传剑','将灵力凝成剑势，战斗技艺增益；需已有稳定主修基础。',{cost:{jade:180,stone:35,insight:20},duration:130,prerequisites:[{anyMain:40}],tags:['metal','combat'],power:1.18}),
 river:technique('沧流归海诀','main','water',7,'寒潭遗境 · 旧碑拓本','水木相生的长期路线；不禁凝火辅修，与赤阳功体冲突。',{cost:{jade:240,crystal:8,insight:25},duration:140,conflicts:['ember'],prerequisites:[{anyMain:40}],cultivation:1.28,fatigue:.22,tags:['water','river']}),
 earth:technique('厚土载生诀','main','earth',5,'山中阵师 · 传承交换','厚土养生，稳定生产与耐力，可成护山和百工一脉。',{cost:{jade:200,stone:65,insight:15},duration:120,prerequisites:[{anyMain:30}],cultivation:1.18,fatigue:.2,tags:['earth','craft'],production:'industry'})
};
export const RECIPES={
 qi:{name:'聚气丹',description:'炼气修为 +70；筑基后药力减半。',cost:{jade:15,herb:12},duration:25,effect:{xp:70,energy:0,wound:0},sectLevel:1,realm:1,yield:2},
 spirit:{name:'灵息丹',description:'修为 +120，精力 +45。',cost:{jade:30,herb:22,crystal:2},duration:35,effect:{xp:120,energy:45,wound:0},sectLevel:1,realm:6,yield:2},
 heal:{name:'回春散',description:'掌门伤势 -25，精力 +15。',cost:{jade:10,herb:10},duration:20,effect:{xp:0,energy:15,wound:25},sectLevel:1,realm:1,yield:2},
 foundation:{name:'筑基丹',description:'突破筑基时消耗，稳定道基；不能作为普通丹药直接服用。',cost:{jade:180,herb:75,crystal:12,insight:15},duration:70,effect:{xp:0,energy:0,wound:0},sectLevel:1,realm:9,knowledge:'alchemy',mastery:35,yield:1}
};
export const ROUTES={
 valley_path:{name:'青萝灵径',scene:'valley',description:'沿溪采药与访村，稳妥补充灵草与粮食。',duration:40,minRealm:1,energy:15,cost:{jade:8},reward:{herb:22,wood:12,food:18},reputation:6,sectLevel:1,x:280,y:310},
 valley_ruins:{name:'古木灵迹',scene:'valley',description:'辨读旧阵遗迹，寻取灵晶与道韵。',duration:65,minRealm:3,energy:22,cost:{jade:18,food:4},reward:{herb:18,crystal:4,insight:9},reputation:10,sectLevel:1,x:590,y:245},
 lake_shore:{name:'寒潭浅岸',scene:'lake',description:'循潭岸寻药，风雨影响行程，足够准备可以稳妥归来。',duration:80,minRealm:6,energy:28,cost:{jade:24,food:6},reward:{herb:30,crystal:7,insight:8},reputation:12,sectLevel:1,x:300,y:300},
 lake_depths:{name:'寒潭古碑',scene:'lake',description:'探访水下阵碑，取得深厚传承所需灵材。',duration:100,minRealm:9,energy:35,cost:{jade:36,food:10},reward:{crystal:12,insight:18,jade:60},reputation:16,sectLevel:1,x:630,y:255}
};
export const EXPEDITIONS=ROUTES;
export const GOODS={food:{name:'口粮',buy:10,sell:4},wood:{name:'灵木',buy:18,sell:7},stone:{name:'青石',buy:22,sell:9},herb:{name:'灵草',buy:25,sell:10},crystal:{name:'灵晶',buy:100,sell:45},insight:{name:'道韵',buy:140,sell:55}};
export const STAGE_NAMES=['结庐立足','隐姓山居','山院初成','正式立派','双峰承道'];
export const TRAIT_NAMES=['仁心','野心','守信','自律','好奇'];
export const NAMES=['顾听澜','云见月','裴照雪','江晚棠','叶松声','苏归岚','洛清川','许望舒','温南星','陶静初','陆清和','徐闻溪'];
export const day=s=>Math.floor(s.time/DAY_LENGTH);
export const gameDay=day;
export const realmName=n=>n<=9?`炼气${n}层`:n<=30?(['筑基','金丹','元婴','化神','炼虚','合体','大乘'][Math.floor((n-10)/3)]+['初期','中期','后期'][(n-10)%3]):'境界未明';
export const xpNeed=n=>n<=9?n*100:1200+(n-10)*600;
export const finite=(n,min=0,max=1e12)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export const integer=(n,min=0,max=1e12)=>Number.isSafeInteger(n)&&finite(n,min,max);
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function rng(s){let x=s.sim.seed>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;s.sim.seed=(x>>>0)||1;return s.sim.seed/4294967296;}
export function log(s,text){s.logs.unshift({time:s.time,text:String(text).slice(0,500)});s.logs=s.logs.slice(0,100);}
export const addLog=log;
export function canPay(s,c={}){return c&&Object.entries(c).every(([k,v])=>Object.hasOwn(RESOURCES,k)&&finite(v)&&finite(s.resources[k])&&s.resources[k]>=v);}
export function pay(s,c={}){if(!canPay(s,c))throw Error('物资不足：'+Object.entries(c).filter(([k,v])=>!finite(v)||s.resources[k]<v).map(([k,v])=>`${RESOURCES[k]||k} ${Math.ceil(Math.max(0,v-(s.resources[k]||0)))}`).join('、'));for(const[k,v]of Object.entries(c)){s.resources[k]-=v;if(s.economy)s.economy.expense[k]=(s.economy.expense[k]||0)+v;}}
export function grant(s,c={}){for(const[k,v]of Object.entries(c)){if(!Object.hasOwn(RESOURCES,k)||!finite(v))throw Error('资源收益无效。');s.resources[k]=Math.min(1e12,s.resources[k]+v);if(s.economy)s.economy.income[k]=(s.economy.income[k]||0)+v;}}
export function capacity(s){return s.buildings.reduce((n,b)=>n+(BUILDINGS[b.type]?.capacity||0)*b.level,0);}
export function stage(s){if((s.society?.peaks?.length||0)>=2)return 4;if(s.sect.founded||s.sect.level>=2)return 3;if(s.disciples.length>=5&&(s.story?.step||0)>=3)return 2;return(s.story?.step||0)>=2||s.disciples.length>0?1:0;}
