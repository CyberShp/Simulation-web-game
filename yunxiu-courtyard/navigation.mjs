// A navigable network registered to the painted stone paths, steps and bridge.
// Pixel coordinates are world coordinates on the 1672 × 941 background plate.
export const WIDTH = 1672, HEIGHT = 941;
export const NODES = {
  meditation:[248,181], bambooSteps:[349,245], bambooLane:[401,296], shade:[440,337], upperLane:[508,381], lane:[615,436],
  workshop:[420,561], workshopGate:[499,577], stoneWorks:[265,709], worksLane:[383,656],
  bridgeWest:[554,568], bridgeA:[598,542], bridgeCrown:[650,526], bridgeEast:[714,528], centre:[758,478],
  stairsLower:[828,423], stairsMid:[881,368], stairsUpper:[920,326], mainCourt:[948,296], mainSteps:[858,258], mainDoor:[816,214],
  eastCourt:[1050,286], gardenEntry:[1127,308], herbs:[1260,322], gardenTurn:[1457,315], middleTurn:[1515,366], herbsMiddle:[1300,377],
  lowerTurn:[1570,420], herbsLower:[1380,469], waterwheel:[1545,485], streamPath:[733,583], streamBend:[742,642], kitchenSide:[780,715], kitchen:[1189,763], kitchenCourt:[958,772], gate:[861,889]
};
const E = (a,b,w=36)=>({a,b,w});
export const EDGES = [E('meditation','bambooSteps',32),E('bambooSteps','bambooLane',27),E('bambooLane','shade',32),E('shade','upperLane',32),E('upperLane','lane',35),E('lane','centre',38),
 E('workshop','workshopGate',45),E('workshopGate','bridgeWest',29),E('workshop','worksLane',42),E('worksLane','stoneWorks',45),
 E('bridgeWest','bridgeA',27),E('bridgeA','bridgeCrown',25),E('bridgeCrown','bridgeEast',26),E('bridgeEast','centre',42),
 E('centre','stairsLower',34),E('stairsLower','stairsMid',29),E('stairsMid','stairsUpper',29),E('stairsUpper','mainCourt',45),E('mainCourt','mainSteps',48),E('mainSteps','mainDoor',35),
 E('mainCourt','eastCourt',48),E('eastCourt','gardenEntry',35),E('gardenEntry','herbs',27),E('herbs','gardenTurn',25),E('gardenTurn','middleTurn',22),E('middleTurn','herbsMiddle',26),E('middleTurn','lowerTurn',22),E('lowerTurn','herbsLower',27),E('lowerTurn','waterwheel',23),
 E('bridgeEast','streamPath',26),E('streamPath','streamBend',22),E('streamBend','kitchenSide',22),E('kitchenSide','kitchenCourt',30),E('kitchenCourt','kitchen',35),E('kitchenCourt','gate',34)
];
export const LANDMARKS = [
 {id:'main',name:'云岫主屋',node:'mainDoor',x:790,y:243,hit:[[564,58],[961,43],[991,222],[700,293],[530,229]],desc:'山院旧居，家传典籍仍保存在此。'},
 {id:'meditation',name:'竹林静台',node:'meditation',x:248,y:181,hit:[[151,110],[363,104],[423,197],[298,247],[148,198]],desc:'竹风过耳，适合静修与研习。'},
 {id:'workshop',name:'百工坊',node:'workshop',x:420,y:561,hit:[[72,381],[293,360],[393,505],[295,568],[104,535]],desc:'木石成器，修缮山院所需从此而出。'},
 {id:'works',name:'营造工地',node:'stoneWorks',x:265,y:709,hit:[[76,557],[295,545],[581,733],[466,843],[114,760]],desc:'石料、木料备齐后，才可修筑新的居所。'},
 {id:'herbs',name:'灵草田',node:'herbsMiddle',x:1300,y:397,hit:[[1028,333],[1459,266],[1611,426],[1261,509],[1116,459]],desc:'依山势开垦的药圃，门人自行照料。'},
 {id:'kitchen',name:'膳房药庐',node:'kitchen',x:1232,y:795,hit:[[826,552],[1120,527],[1420,676],[1330,848],[1000,868],[824,748]],desc:'饭食与药香相伴，照看院中人的日常。'},
 {id:'gate',name:'山门',node:'gate',x:906,y:888,hit:[[746,834],[917,786],[1051,862],[930,940],[730,940]],desc:'石阶通往山外。出行之前，先备好干粮。'}
];
export const point = id => ({x:NODES[id][0],y:NODES[id][1]});
export const distance = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function inPolygon(p,vertices){let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const [xi,yi]=vertices[i],[xj,yj]=vertices[j];if(((yi>p.y)!==(yj>p.y))&&(p.x<(xj-xi)*(p.y-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
function projectTo(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return{x:a.x+t*dx,y:a.y+t*dy};}
export function nearest(p){let best=null;for(const e of EDGES){const q=projectTo(p,point(e.a),point(e.b)),d=distance(p,q);if(!best||d<best.d)best={...q,d,edge:e};}return best;}
export function canStand(p,radius=5){return EDGES.some(e=>distance(p,projectTo(p,point(e.a),point(e.b)))<=e.w/2-radius+.001);}
export function sweep(from,to,radius=5){const n=Math.max(1,Math.ceil(distance(from,to)/3));let last={x:from.x,y:from.y};for(let i=1;i<=n;i++){const p={x:from.x+(to.x-from.x)*i/n,y:from.y+(to.y-from.y)*i/n};if(!canStand(p,radius))return{...last,blocked:true};last=p;}return{...last,blocked:false};}
function graphRoute(start,goal){const open=[{id:start,cost:0}],costs=new Map([[start,0]]),previous=new Map();while(open.length){open.sort((a,b)=>a.cost-b.cost);const current=open.shift();if(current.cost!==costs.get(current.id))continue;if(current.id===goal){const result=[goal];while(result[0]!==start)result.unshift(previous.get(result[0]));return result.map(point);}for(const e of EDGES){const id=e.a===current.id?e.b:e.b===current.id?e.a:null;if(!id)continue;const cost=current.cost+distance(point(current.id),point(id));if(cost<(costs.get(id)??Infinity)){costs.set(id,cost);previous.set(id,current.id);open.push({id,cost});}}}return null;}
export function findPath(from,goal,{maxSnap=70}={}){const a=nearest(from),b=nearest(goal);if(!a||!b||b.d>maxSnap||!canStand(from))return null;if(a.edge===b.edge&&!sweep(from,b).blocked)return[{x:b.x,y:b.y}];let best=null;for(const start of [a.edge.a,a.edge.b])for(const end of [b.edge.a,b.edge.b]){const route=graphRoute(start,end);if(!route)continue;const path=[{x:a.x,y:a.y},...route,{x:b.x,y:b.y}];let p=from,total=0,valid=true;for(const q of path){if(sweep(p,q).blocked){valid=false;break;}total+=distance(p,q);p=q;}if(valid&&(!best||total<best.total))best={total,path};}return best?.path||null;}
