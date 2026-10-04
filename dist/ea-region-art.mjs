// Clean plates derived from approved 07–09 prototypes. Road spines are expressed
// in each 836x470 atlas quadrant, then registered to the 1672x941 world.
export const REGION_ROADS={"valley":[[215,467],[178,446],[143,420],[106,391],[80,367],[77,346],[105,323],[156,302],[218,291],[283,287],[337,274],[390,251],[446,231],[496,215],[540,202],[546,180],[529,155],[492,137],[450,119],[472,101],[518,91],[578,78]],"market":[[382,465],[384,435],[350,410],[315,386],[270,363],[253,339],[293,310],[345,290],[373,267],[397,245],[418,219],[425,193],[442,175],[483,155],[530,141],[571,140],[610,147],[650,166],[695,189],[742,210],[784,218]],"quarry":[[170,468],[182,442],[174,414],[154,382],[133,353],[114,325],[95,304],[80,285],[67,260],[81,235],[130,219],[178,214],[227,209],[278,205],[337,212],[397,231],[446,249],[493,271],[545,294],[588,306],[635,302],[682,276],[720,249],[760,232],[805,211]],"ruins":[[97,467],[118,443],[143,418],[173,397],[211,384],[256,371],[295,355],[323,328],[340,297],[359,275],[385,267],[405,277],[437,292],[480,295],[520,286],[549,270],[563,249],[550,228],[513,213],[476,206]],"prison":[[580,467],[541,452],[500,438],[468,419],[432,396],[389,386],[354,371],[320,359],[311,337],[332,318],[369,307],[399,312],[430,304]],"supply":[[400,467],[395,436],[373,416],[345,397],[314,380],[286,358],[267,338],[282,320],[321,310],[365,275],[413,251],[450,236],[475,224],[525,208],[570,178],[600,161],[645,135],[705,114],[753,88]],"ward":[[564,467],[535,448],[501,430],[461,415],[429,397],[393,386],[373,365],[338,348],[310,327],[285,310],[307,301],[324,279],[332,254],[350,244],[360,214],[375,193],[390,178],[453,183],[480,173],[492,142],[472,125],[447,111]],"council":[[320,467],[320,442],[318,414],[324,382],[340,354],[349,333],[331,312],[318,298],[315,280],[321,261],[340,238],[358,218],[371,202],[389,185],[421,180],[453,174]],"qixia":[[330,467],[309,443],[288,420],[278,390],[285,366],[312,345],[350,333],[377,327],[395,311],[431,321],[453,311],[462,285],[456,257],[448,236],[445,218],[452,196],[459,174],[469,150],[491,144],[519,147]]};
const roads=REGION_ROADS;
export const REGION_ART={valley:{atlas:'regions07',cell:0},market:{atlas:'regions07',cell:1},quarry:{atlas:'regions07',cell:2},ruins:{atlas:'regions07',cell:3},prison:{atlas:'regions08',cell:0},supply:{atlas:'regions08',cell:1},ward:{atlas:'regions08',cell:2},council:{atlas:'regions08',cell:3},qixia:{atlas:'qixia',cell:0,rows:2,columns:1}};
const segments=id=>{const list=roads[id]||roads.valley;return list.map(([x,y])=>({x:x*2,y:y*2}));};
export function regionPoint(x,y,id){const road=segments(id),t=Math.max(0,Math.min(1,x/12))*(road.length-1),i=Math.min(road.length-2,Math.floor(t)),a=road[i],b=road[i+1],u=t-i;return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};}
export function regionInverse(p,id){const road=segments(id);let best=null;for(let i=0;i<road.length-1;i++){const a=road[i],b=road[i+1],dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy))),q={x:a.x+dx*u,y:a.y+dy*u},d=Math.hypot(q.x-p.x,q.y-p.y);if(!best||d<best.distance)best={x:(i+u)/(road.length-1)*12,y:4,distance:d};}return best;}
export function drawAtlas(ctx,image,cell,{columns=2,rows=2}={}){const w=image.width/columns,h=image.height/rows;ctx.drawImage(image,cell%columns*w,Math.floor(cell/columns)*h,w,h,0,0,1672,941);}
export const finalArenaPoint=(x,y)=>({x:670+50*x-15*y,y:375+8*x+28*y});
export const finalArenaInverse=p=>{const a=p.x-670,b=p.y-375;return{x:(28*a+15*b)/1520,y:(50*b-8*a)/1520};};

// Portrait play follows the party instead of shrinking a landscape plate into a strip.
export function campaignCamera(width,height,focus,pan={x:0,y:0},zoom=1){
 if(width<760&&height>width){
  const scale=Math.max(width/1672,height/941)*(height<650?1.75:1.4)*zoom;
  return {scale,ox:Math.min(0,Math.max(width-1672*scale,width*.5-focus.x*scale+pan.x)),oy:Math.min(0,Math.max(height-941*scale,height*.36-focus.y*scale+pan.y))};
 }
 const scale=Math.min(width/1672,height/941)*zoom;
 return {scale,ox:(width-1672*scale)/2+pan.x,oy:(height-941*scale)/2+pan.y};
}
