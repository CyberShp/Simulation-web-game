/** Read-only FX for the formal profile; air points already contain height. */
export function createSwordStudyEffects({ctx,worldToScreen,getTransform,getActorPresentation}){
 const age=(f,tick)=>Math.max(0,(tick-f.tick)*.1),point=(f,b=null,tick=0)=>{const at=f.contact||f.to||f.from,p=worldToScreen(at.x,at.y);if(b&&f.space!=='visible-body-v1'){const actor=[b.player,...(b.enemies||[]),...(b.allies||[])].find(a=>a.id===f.targetId||a.personId===f.targetId)||b.player;const h=getActorPresentation?.(actor,b,tick)?.height||getTransform().sx*1.45;p.y-=(f.contactHeight??.9)*h/1.8;}return p;};
 function ring(p,r,color){const t=getTransform();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y,r*t.sx,r*t.sy,0,0,Math.PI*2);ctx.stroke();}
 function drawGround(b,tick=b.tick){
  ctx.save();
  for(const e of b.enemies||[])if(e.telegraph){const w=e.telegraph;ring(worldToScreen(w.x,w.y),w.radius,'#eea86c');}
  const m=b.player.motion;if(m?.action==='ground-sword'&&m.phase==='windup'&&m.target)ring(worldToScreen(m.target.x,m.target.y),1.1,'#91e2d0');
  for(const s of b.groundStrikes||[]){const p=worldToScreen(s.target.x,s.target.y),remaining=Math.max(0,s.landTick-tick),k=getTransform().sx;ring(p,s.radius,'#86e4d2');ctx.strokeStyle='#f2d589';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y-(.45+remaining*.6)*k);ctx.lineTo(p.x,p.y-remaining*.6*k);ctx.stroke();}
  for(const f of b.effects||[])if(f.kind==='impact'&&age(f,tick)<.2){const p=point(f);ring(p,f.groundSword?.38:.5,'#dfc889');ctx.strokeStyle='#8fcabd';ctx.beginPath();ctx.moveTo(p.x-7,p.y);ctx.lineTo(p.x+7,p.y);ctx.moveTo(p.x,p.y-4);ctx.lineTo(p.x,p.y+4);ctx.stroke();}
  ctx.restore();
 }
 function drawProjectiles(b,tick=b.tick){const t=getTransform();for(const s of b.projectiles||[]){if(tick<s.launchedTick)continue;const p=worldToScreen(s.x,s.y),d=s.direction||{x:1,y:0},k=t.sx;
   ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(d.y,d.x));ctx.strokeStyle='#76d7ce66';ctx.lineWidth=.035*k;ctx.beginPath();ctx.moveTo(-.62*k,0);ctx.lineTo(-.4*k,0);ctx.stroke();ctx.lineCap='round';ctx.strokeStyle='#b5f6e5';ctx.lineWidth=.1*k;ctx.beginPath();ctx.moveTo(-.3*k,0);ctx.lineTo(.3*k,0);ctx.stroke();ctx.strokeStyle='#f6f7d8';ctx.lineWidth=Math.max(1,.025*k);ctx.stroke();ctx.restore();
  }}
 function drawForeground(b,tick=b.tick){for(const f of b.effects||[]){if(f.projectileRelease||f.kind!=='hit'||!(f.amount>0))continue;const a=age(f,tick);if(a>.65)continue;const p=point(f,b,tick),heavy=f.reaction==='heavy'||f.groundSword;
   ctx.save();if(a<(heavy?.12:.08)){ctx.strokeStyle=heavy?'#f1d585':'#d7f5da';ctx.lineWidth=heavy?2:1;for(let i=0;i<6;i++){const d=i*Math.PI/3;ctx.beginPath();ctx.moveTo(p.x+Math.cos(d)*3,p.y+Math.sin(d)*3);ctx.lineTo(p.x+Math.cos(d)*(heavy?18:11),p.y+Math.sin(d)*(heavy?18:11));ctx.stroke();}}
   ctx.globalAlpha=Math.min(1,(.65-a)*3);ctx.font='bold '+(heavy?20:16)+'px serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#1b2b21';ctx.fillStyle='#fff0cc';const text='−'+Math.round(f.amount);ctx.strokeText(text,p.x,p.y-14-a*18);ctx.fillText(text,p.x,p.y-14-a*18);ctx.restore();
  }}
 return {drawGround,drawProjectiles,drawForeground,drawActorOverlay(){}};
}
