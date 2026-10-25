/** Mountain ape: source-art body layers sampled from the formal action clock. */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const point=(x,y)=>({x,y});
const lerp=(a,b,t)=>point(mix(a.x,b.x,t),mix(a.y,b.y,t));
const add=(a,b)=>point(a.x+b.x,a.y+b.y);
const rotate=(p,c,a)=>{const x=p.x-c.x,y=p.y-c.y;return point(c.x+x*Math.cos(a)-y*Math.sin(a),c.y+x*Math.sin(a)+y*Math.cos(a));};
const V={hip:point(532,442),chest:point(325,371),neck:point(228,328),farShoulder:point(181,371),farElbow:point(124,476),farHand:point(101,586),nearShoulder:point(399,347),nearElbow:point(478,485),nearHand:point(433,631),farKnee:point(315,528),farFoot:point(300,594),nearKnee:point(636,552),nearFoot:point(650,626)};
const PARTS=[
 {name:'farLeg',polygon:[[294,456],[411,456],[417,508],[387,583],[369,610],[278,630],[229,620],[233,579],[272,559],[258,511]],bone:['hip','farKnee','farFoot']},
 {name:'nearLeg',polygon:[[505,352],[601,388],[649,455],[693,541],[724,607],[724,661],[594,666],[573,622],[563,561],[531,516],[508,450]],bone:['hip','nearKnee','nearFoot']},
 {name:'farArm',polygon:[[144,313],[206,344],[220,393],[205,449],[203,492],[180,552],[181,606],[172,634],[115,648],[57,648],[12,623],[13,591],[40,556],[49,498],[58,446],[89,402],[101,360]],bone:['farShoulder','farElbow','farHand']},
 {name:'chest',polygon:[[221,368],[275,393],[359,412],[404,365],[446,336],[486,370],[507,427],[487,483],[451,540],[395,550],[330,519],[281,495],[241,460],[217,417]],body:true,sourceOffset:724,remap:v=>point((v.x-340)*1.08+365,(v.y-360)*.79+320)},
 {name:'body',polygon:[[152,222],[184,177],[250,135],[320,137],[385,168],[464,207],[537,263],[589,325],[603,393],[562,458],[500,489],[423,491],[343,487],[273,450],[211,396],[153,353]],body:true},
 {name:'nearArm',polygon:[[333,275],[403,281],[457,330],[491,393],[524,446],[566,488],[577,538],[554,587],[540,635],[515,681],[484,708],[355,716],[324,695],[317,656],[349,626],[377,593],[396,551],[398,501],[366,461],[341,410],[310,346]],bone:['nearShoulder','nearElbow','nearHand']},
 {name:'head',polygon:[[147,246],[196,224],[255,235],[286,252],[314,285],[325,329],[311,369],[270,406],[232,432],[190,411],[157,385],[135,350],[116,314],[128,271]],head:true},
];
const SIZE=224,ORIGIN={x:112,y:183},NOMINAL=111,SCALE=NOMINAL/600,CACHE_LIMIT=224,PIXEL_LIMIT=20*1024*1024;
const COUNTS={idle:8,windup:24,release:6,recovery:20,hit:8,move:12};

function twoBone(root,end,a,b,bend){
 const d=Math.max(.01,Math.hypot(end.x-root.x,end.y-root.y)),reach=Math.min(d,a+b-.01),angle=Math.atan2(end.y-root.y,end.x-root.x),cos=clamp((a*a+reach*reach-b*b)/(2*a*reach),-1,1),v=angle+bend*Math.acos(cos);
 return point(root.x+Math.cos(v)*a,root.y+Math.sin(v)*a);
}
function interpolatePose(a,b,t){const p={};for(const key of Object.keys(V))p[key]=lerp(a[key],b[key],t);p.torso=mix(a.torso,b.torso,t);p.headTilt=mix(a.headTilt,b.headTilt,t);return p;}
function stance(){return {...Object.fromEntries(Object.entries(V).map(([k,p])=>[k,{...p}])),torso:0,headTilt:0};}
function loaded(){const p=stance();p.hip=point(553,426);p.chest=point(365,294);p.neck=point(285,274);p.farShoulder=point(236,299);p.nearShoulder=point(420,290);p.farHand=point(192,77);p.nearHand=point(448,45);p.torso=.13;p.headTilt=.06;return solve(p);}
function contact(){const p=stance();p.hip=point(510,465);p.chest=point(282,406);p.neck=point(195,365);p.farShoulder=point(144,414);p.nearShoulder=point(353,401);p.farHand=point(59,586);p.nearHand=point(319,631);p.torso=-.11;p.headTilt=-.08;return solve(p);}
function solve(p){
 p.farElbow=twoBone(p.farShoulder,p.farHand,Math.hypot(V.farElbow.x-V.farShoulder.x,V.farElbow.y-V.farShoulder.y),Math.hypot(V.farHand.x-V.farElbow.x,V.farHand.y-V.farElbow.y),1);
 p.nearElbow=twoBone(p.nearShoulder,p.nearHand,Math.hypot(V.nearElbow.x-V.nearShoulder.x,V.nearElbow.y-V.nearShoulder.y),Math.hypot(V.nearHand.x-V.nearElbow.x,V.nearHand.y-V.nearElbow.y),-1);
 p.farKnee=twoBone(p.hip,p.farFoot,Math.hypot(V.farKnee.x-V.hip.x,V.farKnee.y-V.hip.y),Math.hypot(V.farFoot.x-V.farKnee.x,V.farFoot.y-V.farKnee.y),1);
 p.nearKnee=twoBone(p.hip,p.nearFoot,Math.hypot(V.nearKnee.x-V.hip.x,V.nearKnee.y-V.hip.y),Math.hypot(V.nearFoot.x-V.nearKnee.x,V.nearFoot.y-V.nearKnee.y),-1);return p;
}

/** Pure sampling; all coordinates are local presentation pixels. */
export function sampleCombatBeastPose(sample={}){
 const phase=sample.phase||'idle',p=clamp(sample.progress||0),base=stance();let q=base,contactWeight=0;
 if(phase==='windup'){
  // Rear-leg compression starts before either fist clears the shoulders.
  const load=loaded(),rise=clamp(p/.67),fall=ease(clamp((p-.86)/.14));q=interpolatePose(base,load,ease(rise));
  q.hip.y+=Math.sin(rise*Math.PI)*19;q.hip.x+=Math.sin(rise*Math.PI)*11;
  q.farHand=lerp(base.farHand,load.farHand,ease(clamp((rise-.04)/.88)));
  q.nearHand=lerp(base.nearHand,load.nearHand,ease(clamp((rise-.12)/.88)));
  q=interpolatePose(q,contact(),fall);
 }else if(phase==='release'){
  // The formal release tick already contains the hit; both hands are in contact.
  q=contact();const settle=Math.sin(p*Math.PI)*8;q.chest.y+=settle;q.neck.y+=settle*.55;contactWeight=1;
 }else if(phase==='recovery'){
  const t=ease(clamp((p-.12)/.88));q=interpolatePose(contact(),base,t);contactWeight=1-ease(clamp(p/.3));
  q.nearHand=lerp(contact().nearHand,base.nearHand,ease(clamp((p-.24)/.76)));
  q.farHand=lerp(contact().farHand,base.farHand,ease(clamp((p-.08)/.92)));
 }else if(phase==='hit'){
  const recoil=(p<.28?.35+.65*ease(p/.28):1-ease((p-.28)/.72))*(sample.reaction==='heavy'?1:.58);
  const facing=sample.facing==='right'?1:-1,impact=sample.direction||{x:-facing,y:0},push=clamp(Number(impact.x)||0,-1,1)*facing;
  q.hip.x-=17*recoil*push;q.hip.y+=14*recoil;q.chest.x-=53*recoil*push;q.chest.y-=13*recoil;
  q.neck.x-=69*recoil*push;q.neck.y-=20*recoil;q.torso=.13*recoil*push;q.headTilt=.11*recoil*push;
  q.farShoulder.x-=46*recoil*push;q.farShoulder.y-=10*recoil;q.nearShoulder.x-=58*recoil*push;q.nearShoulder.y-=4*recoil;
  q.farHand.x-=35*recoil*push;q.farHand.y-=52*recoil;q.nearHand.x-=31*recoil*push;q.nearHand.y-=68*recoil;
  q.farFoot.x+=14*recoil*push;q.farFoot.y-=10*recoil;
 }else if(phase==='move'){
  const gait=(sample.gait??((sample.tick||0)/8%1))*Math.PI*2,s=Math.sin(gait),lift=Math.sin(gait+Math.PI/2);
  q.hip.x+=s*11;q.hip.y-=Math.abs(s)*6;q.chest.x-=s*9;q.chest.y-=Math.abs(s)*8;q.neck.x-=s*12;
  q.farFoot.x-=s*29;q.nearFoot.x+=s*29;q.farFoot.y-=Math.max(0,lift)*21;q.nearFoot.y-=Math.max(0,-lift)*21;
  q.farHand.x+=s*23;q.nearHand.x-=s*23;q.farHand.y-=Math.max(0,-s)*17;q.nearHand.y-=Math.max(0,s)*17;
 }else{
  const breath=Math.sin((sample.gait??((sample.tick||0)/24%1))*Math.PI*2);q.chest.y-=breath*3;q.neck.y-=breath*2;
 }
 q=solve(q);const facing=sample.facing==='right'?-1:1;
 const local=v=>point((v.x-374)*SCALE*facing,(v.y-663)*SCALE);
 return {...Object.fromEntries(Object.keys(V).map(k=>[k,local(q[k])])),source:q,facing:sample.facing==='right'?'right':'left',contactWeight,phase,progress:p,hand:local(q.nearHand),foot:point(0,0),supportFoot:local(q.nearFoot)};
}

function triangle(ctx,image,s,t){
 const[a,b,c]=s,[u,v,w]=t,d=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(d)<1e-7)return;
 const aa=((v.x-u.x)*(c.y-a.y)-(w.x-u.x)*(b.y-a.y))/d,cc=((w.x-u.x)*(b.x-a.x)-(v.x-u.x)*(c.x-a.x))/d,bb=((v.y-u.y)*(c.y-a.y)-(w.y-u.y)*(b.y-a.y))/d,dd=((w.y-u.y)*(b.x-a.x)-(v.y-u.y)*(c.x-a.x))/d;
 ctx.save();ctx.beginPath();const center=point((u.x+v.x+w.x)/3,(u.y+v.y+w.y)/3);for(const [i,z]of [u,v,w].entries()){const dx=z.x-center.x,dy=z.y-center.y,len=Math.hypot(dx,dy)||1;ctx[i?'lineTo':'moveTo'](z.x+dx/len*.35,z.y+dy/len*.35);}ctx.closePath();ctx.clip();ctx.transform(aa,bb,cc,dd,u.x-aa*a.x-cc*a.y,u.y-bb*a.x-dd*a.y);ctx.drawImage(image,0,0);ctx.restore();
}
function boneMap(v,a,b,u,w){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),x=((v.x-a.x)*dx+(v.y-a.y)*dy)/len,y=(-(v.x-a.x)*dy+(v.y-a.y)*dx)/len,tx=w.x-u.x,ty=w.y-u.y,l=Math.hypot(tx,ty);return point(u.x+tx*x/len-ty*y/l,u.y+ty*x/len+tx*y/l);}
function mapped(v,part,j){
 if(part.remap)v=part.remap(v);
 if(part.body){const t=ease((v.y-220)/310),d=lerp(point(j.chest.x-V.chest.x,j.chest.y-V.chest.y),point(j.hip.x-V.hip.x,j.hip.y-V.hip.y),t);return add(v,d);}
 if(part.head){const r=rotate(v,V.neck,j.headTilt);return add(r,point(j.neck.x-V.neck.x,j.neck.y-V.neck.y));}
 const[a,b,c]=part.bone,first=boneMap(v,V[a],V[b],j[a],j[b]),second=boneMap(v,V[b],V[c],j[b],j[c]),axis=point(V[c].x-V[a].x,V[c].y-V[a].y),t=((v.x-V[b].x)*axis.x+(v.y-V[b].y)*axis.y)/(axis.x*axis.x+axis.y*axis.y);return lerp(first,second,ease((t+.08)/.16));
}

export function createCombatBeastRig({images,makeCanvas}){
 if(!images?.foeActions||typeof makeCanvas!=='function')throw new Error('Mountain ape rig needs foeActions and makeCanvas');
 const parts=PARTS.map(part=>{
  const xs=part.polygon.map(p=>p[0]),ys=part.polygon.map(p=>p[1]),x=Math.floor(Math.min(...xs)),y=Math.floor(Math.min(...ys)),w=Math.ceil(Math.max(...xs))-x,h=Math.ceil(Math.max(...ys))-y,c=makeCanvas(w,h),ctx=c.getContext('2d');c.width=w;c.height=h;
  ctx.save();ctx.translate(-x,-y);ctx.beginPath();part.polygon.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...p));ctx.closePath();ctx.clip();ctx.drawImage(images.foeActions,-(part.sourceOffset||0),0);
  if(part.name==='body'){ctx.globalCompositeOperation='destination-out';ctx.beginPath();PARTS.find(p=>p.name==='nearArm').polygon.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...p));ctx.closePath();ctx.fill();}
  ctx.restore();return {...part,image:c,x,y,w,h};
 });
 const cache=new Map(),work=makeCanvas(SIZE,SIZE);work.width=SIZE;work.height=SIZE;
 let hits=0,misses=0,pixelBytes=0;
 function quantize(sample={}){
  const phase=sample.phase||'idle',n=COUNTS[phase]||8,moving=phase==='move'||phase==='idle',f=sample.facing==='right'?'right':'left';
  const progress=moving?0:Math.round(clamp(sample.progress||0)*(n-1))/(n-1),cycle=sample.gait??((sample.tick||0)/(phase==='move'?8:24));
  const gait=moving?(Math.round(((cycle%1+1)%1)*n)%n)/n:0;
  return {phase,progress,gait,facing:f,reaction:phase==='hit'&&sample.reaction==='heavy'?'heavy':'light',direction:phase==='hit'?{x:Math.sign(sample.direction?.x??(f==='right'?-1:1)),y:0}:undefined};
 }
 function image(sample={}){
  const q=quantize(sample),key=JSON.stringify(q);if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);hits++;return v;}misses++;
  const pose=sampleCombatBeastPose(q),ctx=work.getContext('2d');ctx.resetTransform();ctx.clearRect(0,0,SIZE,SIZE);ctx.imageSmoothingEnabled=false;ctx.translate(ORIGIN.x,ORIGIN.y);const flip=q.facing==='right'?-1:1;
  for(const part of parts){const cols=Math.ceil(part.w/45),rows=Math.ceil(part.h/45),vertices=[];for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const s=point(x*part.w/cols,y*part.h/rows),v=mapped(point(part.x+s.x,part.y+s.y),part,pose.source);vertices.push({s,t:point((v.x-374)*SCALE*flip,(v.y-663)*SCALE)});}for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=vertices[y*(cols+1)+x],b=vertices[y*(cols+1)+x+1],c=vertices[(y+1)*(cols+1)+x],d=vertices[(y+1)*(cols+1)+x+1];triangle(ctx,part.image,[a.s,b.s,c.s],[a.t,b.t,c.t]);triangle(ctx,part.image,[b.s,d.s,c.s],[b.t,d.t,c.t]);}}
  ctx.resetTransform();
  const rgba=ctx.getImageData(0,0,SIZE,SIZE).data;let left=SIZE,top=SIZE,right=0,bottom=0;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(rgba[(y*SIZE+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(SIZE-1,right+2);bottom=Math.min(SIZE-1,bottom+2);
  const canvas=makeCanvas(right-left+1,bottom-top+1);canvas.width=right-left+1;canvas.height=bottom-top+1;canvas.getContext('2d').drawImage(work,left,top,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
  const result={canvas,origin:{x:ORIGIN.x-left,y:ORIGIN.y-top},nominalHeight:NOMINAL,pose};cache.set(key,result);pixelBytes+=canvas.width*canvas.height*4;
  while(cache.size>CACHE_LIMIT||pixelBytes>PIXEL_LIMIT){const oldest=cache.keys().next().value,old=cache.get(oldest);pixelBytes-=old.canvas.width*old.canvas.height*4;cache.delete(oldest);}
  return result;
 }
 async function prewarm(){
  let count=0;
  for(const facing of ['left','right'])for(const phase of ['idle','move','windup','release','recovery','hit'])for(const reaction of phase==='hit'?['light','heavy']:['light'])for(let i=0;i<COUNTS[phase];i++){
   image({phase,progress:i/(COUNTS[phase]-1),gait:i/COUNTS[phase],facing,reaction});
   if(++count%3===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return cacheStats();
 }
 function cacheStats(){return {entries:cache.size,limit:CACHE_LIMIT,pixelBytes,pixelLimit:PIXEL_LIMIT,hits,misses};}
 return {image,pose:sampleCombatBeastPose,quantize,prewarm,cacheStats};
}
