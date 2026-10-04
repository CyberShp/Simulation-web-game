// Clean plates derived from approved 07–09 prototypes. Road spines are expressed
// in each 836x470 atlas quadrant, then registered to the 1672x941 world.
const roads={
 valley:[[450,452],[436,413],[401,367],[352,331],[240,302],[237,274],[335,241],[428,215],[483,194],[548,173],[612,125],[702,111]],
 market:[[80,415],[168,397],[235,378],[300,340],[347,301],[310,272],[256,252],[214,229],[250,206],[356,188],[484,153],[542,121],[610,101]],
 quarry:[[210,450],[256,410],[295,370],[340,335],[398,310],[450,290],[497,270],[545,250],[600,235],[658,239],[721,243],[800,233]],
 ruins:[[145,460],[180,423],[208,395],[239,369],[275,350],[306,327],[320,307],[380,284],[420,275],[470,284],[520,290],[564,276]],
 prison:[[468,456],[423,433],[386,407],[354,380],[325,352],[299,331],[320,302],[366,286],[407,269],[427,255],[439,240],[452,226]],
 supply:[[430,455],[391,430],[358,405],[331,384],[306,364],[288,349],[270,332],[258,315],[256,295],[282,281],[312,267],[344,251]],
 ward:[[568,455],[570,425],[555,401],[540,380],[525,361],[505,343],[483,329],[481,310],[498,291],[515,281],[542,260],[558,241]],
 council:[[320,460],[335,428],[340,411],[342,390],[350,365],[367,337],[393,314],[428,302],[462,296],[482,283],[506,275],[525,258]],
 qixia:[[195,450],[230,425],[260,410],[282,386],[294,361],[320,342],[345,322],[371,305],[393,288],[431,258],[476,243],[491,194],[512,160]]
};
export const REGION_ART={valley:{atlas:'regions07',cell:0},market:{atlas:'regions07',cell:1},quarry:{atlas:'regions07',cell:2},ruins:{atlas:'regions07',cell:3},prison:{atlas:'regions08',cell:0},supply:{atlas:'regions08',cell:1},ward:{atlas:'regions08',cell:2},council:{atlas:'regions08',cell:3},qixia:{atlas:'qixia',cell:0,rows:2,columns:1}};
const segments=id=>{const list=roads[id]||roads.valley;return list.map(([x,y])=>({x:x*2,y:y*2}));};
export function regionPoint(x,y,id){const road=segments(id),t=Math.max(0,Math.min(1,x/12))*(road.length-1),i=Math.min(road.length-2,Math.floor(t)),a=road[i],b=road[i+1],u=t-i;return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};}
export function regionInverse(p,id){const road=segments(id);let best=null;for(let i=0;i<road.length-1;i++){const a=road[i],b=road[i+1],dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy))),q={x:a.x+dx*u,y:a.y+dy*u},d=Math.hypot(q.x-p.x,q.y-p.y);if(!best||d<best.distance)best={x:(i+u)/(road.length-1)*12,y:4,distance:d};}return best;}
export function drawAtlas(ctx,image,cell,{columns=2,rows=2}={}){const w=image.width/columns,h=image.height/rows;ctx.drawImage(image,cell%columns*w,Math.floor(cell/columns)*h,w,h,0,0,1672,941);}
export const finalArenaPoint=(x,y)=>({x:670+50*x-15*y,y:375+8*x+28*y});
export const finalArenaInverse=p=>{const a=p.x-670,b=p.y-375;return{x:(28*a+15*b)/1520,y:(50*b-8*a)/1520};};
