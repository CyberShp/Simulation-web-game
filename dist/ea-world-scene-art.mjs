/** Code-native local scenery. The visible base and input use the world's centred footprint. */
export const LOCAL_SCENE_PALETTES=Object.freeze({
 'scene:valley':{ground:'#899b72',edge:'#48695a',stone:'#a8ab91',roof:'#667d68',water:'#7eaaa2',motif:'stream'},
 'scene:market':{ground:'#bbb18a',edge:'#786b54',stone:'#c9bd9c',roof:'#667d70',water:'#809e93',motif:'street'},
 'scene:quarry':{ground:'#a5a58b',edge:'#696f5c',stone:'#bdbba6',roof:'#766e5c',water:'#879a8e',motif:'stone'},
 'scene:ruins':{ground:'#9da68b',edge:'#657768',stone:'#b4b9a1',roof:'#737e68',water:'#789f99',motif:'ruin'},
 'scene:prison':{ground:'#a9997d',edge:'#6c6353',stone:'#a7a28c',roof:'#76645b',water:'#8c9787',motif:'wall'},
 'scene:supply':{ground:'#b3a483',edge:'#786b51',stone:'#c4b59b',roof:'#84775f',water:'#849786',motif:'road'},
 'scene:ward':{ground:'#9ca78b',edge:'#637563',stone:'#b5b99a',roof:'#737f68',water:'#819f8f',motif:'array'},
 'scene:qixia':{ground:'#adb293',edge:'#6b7962',stone:'#c5c3aa',roof:'#65796a',water:'#82a398',motif:'memorial'}
});
const fallback={ground:'#a2ac93',edge:'#637969',stone:'#b8baa1',roof:'#6d8278',water:'#789e98',motif:'road'};
export function worldObjectFootprint(o){const w=o.width||3,h=o.height||2;return {left:o.x-w/2,top:o.y-h/2,right:o.x+w/2,bottom:o.y+h/2,width:w,height:h};}
export function worldObjectContains(o,p){const b=worldObjectFootprint(o);return p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom;}
export function worldObjectApproach(o){const b=worldObjectFootprint(o);return {x:o.x,y:b.bottom+1};}
export function drawLocalSceneGround(ctx,scene,c,project){
 const p=LOCAL_SCENE_PALETTES[scene.id]||fallback;
 ctx.fillStyle=p.ground;ctx.fillRect(0,0,c.w,c.h);
 const path=(points,color,width)=>{ctx.beginPath();points.forEach((q,i)=>{const v=project(q,c);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y);});ctx.strokeStyle=color;ctx.lineWidth=width*c.scale;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();};
 // Decorative paths and contours never claim a blocked or navigable footprint.
 path([{x:32,y:48},{x:30,y:36},{x:28,y:26},{x:21,y:13}],p.edge+'35',1.8);
 path([{x:32,y:48},{x:30,y:36},{x:28,y:26},{x:21,y:13}],'#d3c7a2',1.1);
 if(p.motif==='stream')path([{x:4,y:10},{x:18,y:19},{x:30,y:23},{x:42,y:28},{x:62,y:37}],p.water,2.3);
 if(p.motif==='street')path([{x:8,y:27},{x:56,y:27}],'#d2c4a0',3);
 if(p.motif==='wall')path([{x:7,y:8},{x:55,y:8},{x:55,y:42}],p.stone,1);
 for(let i=0;i<32;i++){const x=3+(i*17)%58,y=3+(i*23)%42;if((scene.objects||[]).some(o=>worldObjectContains(o,{x,y})))continue;const q=project({x,y},c);ctx.fillStyle=i%3?p.edge+'28':p.stone+'70';ctx.beginPath();ctx.ellipse(q.x,q.y,(.15+i%3*.09)*c.scale,.12*c.scale,0,0,Math.PI*2);ctx.fill();}
 return p;
}
export function drawLocalSceneObject(ctx,o,scene,c,project){
 const p=LOCAL_SCENE_PALETTES[scene.id]||fallback,b=worldObjectFootprint(o),a=project({x:b.left,y:b.top},c),z=project({x:b.right,y:b.bottom},c),q=project(o,c),u=c.scale;
 const polygon=(points,fill,stroke=p.edge)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(1,u*.025);ctx.stroke();};
 const line=(x1,y1,x2,y2,color,width=.045)=>{ctx.strokeStyle=color;ctx.lineWidth=u*width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
 ctx.save();
 polygon([[a.x,a.y],[z.x,a.y],[z.x,z.y],[a.x,z.y]],p.stone+'a0');
 if(['library','shop','warehouse','house','gate'].includes(o.kind)){
  const h=o.kind==='gate'?2.3:1.8,wallTop=z.y-h*u,mid=(a.x+z.x)/2;
  polygon([[a.x,wallTop],[z.x,wallTop],[z.x,z.y],[a.x,z.y]],'#b1a383');
  polygon([[a.x-.2*u,wallTop],[mid,a.y-(h+.45)*u],[z.x+.2*u,wallTop],[z.x,wallTop+.14*u],[a.x,wallTop+.14*u]],p.roof);
  for(let x=a.x+.3*u;x<z.x;x+=.65*u)line(x,wallTop,x+(x-mid)*.08,wallTop+.12*u,'#acb49a',.025);
  polygon([[mid-.55*u,z.y-1.25*u],[mid+.55*u,z.y-1.25*u],[mid+.55*u,z.y],[mid-.55*u,z.y]],'#596458');
  if(o.kind==='shop'){polygon([[a.x-.15*u,z.y-.9*u],[z.x+.15*u,z.y-.9*u],[z.x+.35*u,z.y-.4*u],[a.x-.35*u,z.y-.4*u]],'#a99063');for(let x=a.x+.3*u;x<z.x;x+=.7*u)line(x,z.y-.85*u,x,z.y-.45*u,'#cab98c',.12);}
  if(o.kind==='warehouse')for(let i=0;i<3;i++)polygon([[a.x+.3*u+i*.6*u,z.y-.45*u],[a.x+.8*u+i*.6*u,z.y-.45*u],[a.x+.8*u+i*.6*u,z.y-.05*u],[a.x+.3*u+i*.6*u,z.y-.05*u]],'#8e7958');
  if(o.kind==='gate')polygon([[mid-.65*u,z.y-1.65*u],[mid+.65*u,z.y-1.65*u],[mid+.65*u,z.y],[mid-.65*u,z.y]],'#49574d');
 }else if(o.kind==='bridge'){
  polygon([[a.x,a.y-.15*u],[z.x,a.y-.15*u],[z.x,z.y],[a.x,z.y]],scene.bridgeCondition==='blocked'?'#8a8e77':p.stone);
  for(let i=0;i<5;i++){const x=a.x+(z.x-a.x)*i/4;line(x,a.y-.4*u,x,z.y-.4*u,'#657762',.07);}
  line(a.x,a.y-.4*u,z.x,a.y-.4*u,'#d0c8ae',.09);line(a.x,z.y-.4*u,z.x,z.y-.4*u,'#d0c8ae',.09);
 }else if(o.kind==='array'){
  const r=Math.min(b.width,b.height)*u*.36;ctx.strokeStyle='#698f82';ctx.lineWidth=.07*u;ctx.beginPath();ctx.ellipse(q.x,q.y,r,r*c.depth,0,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<6;i++){const t=i*Math.PI/3;line(q.x,q.y,q.x+Math.cos(t)*r,q.y+Math.sin(t)*r*c.depth,'#91aa92',.035);}
  polygon([[q.x-.4*u,q.y-.6*u],[q.x+.4*u,q.y-.6*u],[q.x+.4*u,q.y],[q.x-.4*u,q.y]],'#8a9a83');
 }else if(o.kind==='cave'){
  polygon([[a.x,z.y],[a.x+.2*u,a.y-.9*u],[q.x,a.y-1.6*u],[z.x,a.y-.5*u],[z.x,z.y]],'#83917c');
  polygon([[q.x-.8*u,z.y],[q.x-.65*u,z.y-1.2*u],[q.x,z.y-1.6*u],[q.x+.65*u,z.y-1.2*u],[q.x+.8*u,z.y]],'#435b4b');
 }else if(o.kind==='resource'){
  for(let i=0;i<7;i++){const x=a.x+(z.x-a.x)*(i+.5)/7,y=q.y+(i%3-1)*.15*u;ctx.fillStyle='#6f8d68';ctx.beginPath();ctx.ellipse(x,y,.27*u,.16*u,-.3,0,Math.PI*2);ctx.fill();line(x,y,x+.06*u,y-.4*u,'#9cab77',.045);}
 }else if(o.kind==='dock'){
  for(let i=0;i<6;i++)line(a.x,a.y+(z.y-a.y)*i/5,z.x,a.y+(z.y-a.y)*i/5,'#9c8b66',.2);
  for(const x of[a.x,z.x])line(x,z.y,x,z.y-.65*u,'#5e7265',.12);
 }else if(o.kind==='memorial'){
  for(const x of[q.x-.65*u,q.x+.65*u]){polygon([[x-.35*u,q.y-1.3*u],[x+.35*u,q.y-1.3*u],[x+.35*u,q.y],[x-.35*u,q.y]],'#bfc0aa');line(x,q.y-1.1*u,x,q.y-.4*u,'#687967',.07);}
 }else if(o.kind==='person'){
  ctx.strokeStyle='#bcc6a2';ctx.lineWidth=.06*u;ctx.beginPath();ctx.ellipse(q.x,q.y,.8*u,.8*u*c.depth,0,0,Math.PI*2);ctx.stroke();
 }else{
  polygon([[q.x-.4*u,q.y-1.1*u],[q.x+.4*u,q.y-1.1*u],[q.x+.4*u,q.y],[q.x-.4*u,q.y]],'#b7b49a');line(q.x-.2*u,q.y-.85*u,q.x+.2*u,q.y-.85*u,'#6d7560');line(q.x-.2*u,q.y-.55*u,q.x+.2*u,q.y-.55*u,'#6d7560');
 }
 ctx.restore();
}
