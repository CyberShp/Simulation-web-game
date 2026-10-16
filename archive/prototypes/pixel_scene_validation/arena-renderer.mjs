import { Effects } from './effects.mjs';
import { trailConnection } from './trail-stair-connection.mjs';

const BASE_VIEW = Object.freeze({width:1672,height:941});
const TRAIL_WORLD = Object.freeze({width:1672,height:2823});
const isTrailMode = mode => mode==='trail'||mode==='trail32';
const intersects = (a,b) => a.x+a.w>=b.x && b.x+b.w>=a.x && a.y+a.h>=b.y && b.y+b.h>=a.y;

const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mix = (a, b, t) => a + (b - a) * t;
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const pixelColor = { blue: '#62c8dd', red: '#d78965', gold: '#e5c774' };
const frames = [
  [55,18,250,335,173,328],[433,18,225,335,154,329],
  [803,18,237,335,157,330],[1200,18,211,335,137,329],
  [76,360,281,300,125,293],[444,360,288,300,133,294],
  [805,360,296,300,136,294],[1212,360,279,300,130,294],
  [70,660,218,335,134,329],[426,668,317,330,160,322],
  [758,686,406,298,189,287],[1172,674,299,325,185,314]
];
const discipleFrames = [
  [55,42,280,447,151,438],[407,44,270,446,160,436],
  [784,42,286,449,177,438],[1121,89,414,397,190,383],
  [57,525,274,469,139,449],[410,531,290,458,158,442],
  [788,531,288,460,161,448],[1140,535,375,462,183,447]
];
const garden = [
  { id:'lantern',x:510,y:665,rect:[135,155,370,795],height:108,width:50 },
  { id:'pine',x:1210,y:685,rect:[623,10,913,945],height:155,width:150 }
];
const foreground = [
  [[305,663],[375,651],[409,693],[401,874],[375,941],[307,941]],
  [[1270,658],[1340,664],[1339,923],[1283,941],[1260,876]],
  [[550,727],[603,727],[626,774],[626,846],[549,831]],
  [[1050,720],[1116,720],[1132,840],[1045,842]]
];
const trailIsland = {
  id:'central-pine-island',sortY:941+735*1882/1330,
  polygon:[
    [548,444],[578,448],[600,465],[641,467],[666,485],[687,488],
    [703,514],[707,535],[678,550],[724,550],[745,565],[775,568],
    [788,583],[813,581],[834,610],[827,632],[794,625],[786,657],
    [794,687],[780,711],[748,719],[702,732],[647,735],[607,742],
    [555,734],[514,729],[473,713],[445,691],[427,669],[420,642],
    [414,612],[405,591],[415,571],[440,559],[457,547],[473,541],
    [483,519],[486,499],[504,484],[519,464],[540,460]
  ].map(([x,y])=>[x*1672/1182,941+y*1882/1330])
};

function loadImage(path) {
  return new Promise((resolve,reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`素材加载失败: ${path}`));
    image.src = new URL(path,import.meta.url).href;
  });
}

function sprite(image, frame, scale) {
  const surface = document.createElement('canvas');
  surface.width = 104; surface.height = 82;
  const ctx = surface.getContext('2d');
  if (!ctx) throw new Error('无法建立人物画布');
  ctx.imageSmoothingEnabled = false;
  const [sx,sy,sw,sh,ax,ay] = frame;
  ctx.drawImage(image,sx,sy,sw,sh,Math.round(52-ax*scale),Math.round(77-ay*scale),Math.round(sw*scale),Math.round(sh*scale));
  return surface;
}

function dot(ctx,x,y,size,color,alpha=1) {
  if (alpha <= 0) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = color;
  const s = Math.max(1,Math.round(size));
  ctx.fillRect(Math.round(x-s/2),Math.round(y-s/2),s,s);
}

function pixelLine(ctx,x1,y1,x2,y2,width,color,alpha=1) {
  const steps = Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/1.5));
  for (let i=0;i<=steps;i++) dot(ctx,mix(x1,x2,i/steps),mix(y1,y2,i/steps),width,color,alpha);
}

function ring(ctx,x,y,radius,color,alpha=1,width=1) {
  const steps = Math.max(36,Math.ceil(radius*4));
  for (let i=0;i<steps;i++) {
    const a = i/steps*TAU;
    dot(ctx,x+Math.cos(a)*radius,y+Math.sin(a)*radius*.35,width,color,alpha);
  }
}

function eventPoint(event,side,actors) {
  const point = event[side];
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return point;
  const actor = actors.get(side==='from'?event.sourceId:event.targetId);
  return actor ? {x:actor.x,y:actor.y} : null;
}

function seed(value) {
  let n = 17;
  for (const letter of String(value)) n = (n*31+letter.charCodeAt(0))>>>0;
  return n;
}

function scatter(index,eventSeed) {
  const n = Math.sin(index*127.1+eventSeed*.017)*43758.5453;
  return n-Math.floor(n);
}

/** Read-only pixel world projection. Zoom 1 always fits a 1672 × 941 region,
 * including on the long trail. Root input owns camera movement and commands.
 */
export class ArenaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d',{alpha:false});
    if (!this.ctx) throw new Error('无法建立场景画布');
    this.camera = {x:836,y:590,zoom:1.45};
    this.viewport = {w:1600,h:900,fit:1};
    this.mode = 'team';
    this.worldBounds = BASE_VIEW;
    this.minimapRect = null;
    this.trailForeground = [trailIsland];
    this.ready = false;
    this.wardEffects = new Map();
    this.resize();
  }

  async load() {
    const [ground,people,props,disciples,trail,connection] = await Promise.all([
      loadImage('assets/courtyard-v1.png'),loadImage('assets/cultivator-v1.png'),
      loadImage('assets/garden-props-v1.png'),loadImage('assets/disciples-v1.png'),
      loadImage('assets/trail-terrain-v5.png'),loadImage('assets/trail-stair-connection-v1.png')
    ]);
    this.ground = ground; this.props = props; this.trail = trail;
    // The connecting terrain is painted in the same fixed world coordinates.
    this.trailEdge = document.createElement('canvas');
    const {width,height,step,top,bottom}=trailConnection;
    this.trailEdge.width = width; this.trailEdge.height = height;
    const edge = this.trailEdge.getContext('2d');
    edge.imageSmoothingEnabled=false;
    edge.beginPath();
    top.forEach((y,i)=>i?edge.lineTo(i*step,y):edge.moveTo(0,y));
    for(let i=bottom.length-1;i>=0;i--)edge.lineTo(i*step,bottom[i]);
    edge.closePath();edge.clip();
    edge.drawImage(connection,0,0,width,height);
    this.sprites = frames.map((frame,index) => sprite(people,frame,index>=4&&index<=7?.237:.217));
    this.discipleSprites = discipleFrames.map(frame => sprite(disciples,frame,.159));
    this.minimapSurface = document.createElement('canvas');
    this.minimapSurface.width = 132; this.minimapSurface.height = 223;
    const map = this.minimapSurface.getContext('2d');
    if (!map) throw new Error('无法建立山路图');
    map.imageSmoothingEnabled = false;
    map.drawImage(ground,0,0,132,223/3);
    map.drawImage(trail,0,223/3,132,223*2/3);
    map.drawImage(this.trailEdge,0,trailConnection.y*223/2823,132,height*223/2823);
    this.ready = true;
    return this;
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    const w = Math.max(1,Math.round(box.width||globalThis.innerWidth||1600));
    const h = Math.max(1,Math.round(box.height||globalThis.innerHeight||900));
    this.viewport = {w,h,fit:Math.min(w/BASE_VIEW.width,h/BASE_VIEW.height)};
    this.canvas.width = w; this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
    this.constrainCamera();
  }

  constrainCamera() {
    const {w,h,fit} = this.viewport;
    const camera = this.camera,world = this.worldBounds;
    camera.zoom = clamp(finite(camera.zoom,1),isTrailMode(this.mode)?.33:1,2.8);
    const halfW = w/(2*fit*camera.zoom),halfH = h/(2*fit*camera.zoom);
    camera.x = halfW>=world.width/2?world.width/2:clamp(finite(camera.x,836),halfW,world.width-halfW);
    camera.y = halfH>=world.height/2?world.height/2:clamp(finite(camera.y,470.5),halfH,world.height-halfH);
  }

  setMode(mode) {
    this.mode = mode;
    this.worldBounds = isTrailMode(mode)?TRAIL_WORLD:BASE_VIEW;
    if (!isTrailMode(mode)) this.minimapRect = null;
    this.constrainCamera();
    return this.worldBounds;
  }

  setWorldForState(state) {
    return this.setMode(state.mode||'team');
  }

  followActor(actor,{snap=false,deltaSeconds=.016,zoom=1.25}={}) {
    if (!actor || !Number.isFinite(actor.x) || !Number.isFinite(actor.y)) return;
    const fraction = snap?1:1-Math.exp(-Math.max(0,finite(deltaSeconds))*7);
    this.camera.x = mix(this.camera.x,actor.x,fraction);
    this.camera.y = mix(this.camera.y,actor.y-70,fraction);
    this.camera.zoom = clamp(finite(zoom,1.25),1,2.8);
    this.constrainCamera();
  }

  followBattle(state,options={}) {
    const player=state.actors.find(actor=>actor.id===state.playerId);
    if (!player) return;
    if (state.trail?.phase!=='combat') return this.followActor(player,options);
    const nearby=state.actors.filter(actor=>actor.hp>0&&Math.hypot(actor.x-player.x,actor.y-player.y)<650);
    if (!nearby.length) return this.followActor(player,options);
    const left=Math.min(...nearby.map(actor=>actor.x)),right=Math.max(...nearby.map(actor=>actor.x));
    const top=Math.min(...nearby.map(actor=>actor.y-78)),bottom=Math.max(...nearby.map(actor=>actor.y));
    // Keep the skirmish above the skill bar while the master remains in view.
    this.followActor({x:clamp((left+right)/2,player.x-160,player.x+160),y:(top+bottom)/2+130},options);
  }

  showOverview() {
    const {w,h,fit} = this.viewport,world = this.worldBounds;
    this.camera.x = world.width/2; this.camera.y = world.height/2;
    this.camera.zoom = Math.min(w/world.width,h/world.height)/fit;
    this.constrainCamera();
  }

  getVisibleWorldRect() {
    const {w,h,fit} = this.viewport,s = fit*this.camera.zoom;
    return {x:this.camera.x-w/(2*s),y:this.camera.y-h/(2*s),w:w/s,h:h/s};
  }

  setTrailForeground(masks) {
    this.trailForeground = masks.map(mask=>({
      ...mask,polygon:mask.polygon.map(([x,y])=>[x,y])
    }));
  }

  drawPlate(image,x,y,width,height,view) {
    const left = Math.max(x,view.x),top = Math.max(y,view.y);
    const right = Math.min(x+width,view.x+view.w),bottom = Math.min(y+height,view.y+view.h);
    if (right<=left||bottom<=top) return;
    const sx = (image.naturalWidth||image.width)/width,sy = (image.naturalHeight||image.height)/height;
    this.ctx.drawImage(image,(left-x)*sx,(top-y)*sy,(right-left)*sx,(bottom-top)*sy,left,top,right-left,bottom-top);
  }

  drawTerrain(view) {
    this.drawPlate(this.ground,0,0,BASE_VIEW.width,BASE_VIEW.height,view);
    if (isTrailMode(this.mode)) {
      this.drawPlate(this.trail,0,BASE_VIEW.height,TRAIL_WORLD.width,TRAIL_WORLD.height-BASE_VIEW.height,view);
      const {x,y,width,height}=trailConnection;
      if (view.y<y+height&&view.y+view.h>y) this.drawPlate(this.trailEdge,x,y,width,height,view);
    }
  }

  worldToScreen(x,y) {
    const rect = this.canvas.getBoundingClientRect();
    const {w,h,fit} = this.viewport,s = fit*this.camera.zoom;
    return {x:(x-this.camera.x)*s+w/2+rect.left,y:(y-this.camera.y)*s+h/2+rect.top};
  }

  screenToWorld(clientX,clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const {w,h,fit} = this.viewport,s = fit*this.camera.zoom;
    return {x:(clientX-rect.left-w/2)/s+this.camera.x,y:(clientY-rect.top-h/2)/s+this.camera.y};
  }

  actorPose(actor,tick) {
    const action = actor.action;
    const active = action && tick>=action.startTick && tick<action.endTick;
    if (active) {
      if (action.skill==='sword'||action.skill==='attack') return tick<action.releaseTick?9:10;
      return 11;
    }
    if (actor.moving) return (actor.back?4:0)+Math.floor(finite(actor.distance)/12)%4;
    return actor.back?5:8;
  }

  drawActor(actor,state) {
    const ctx = this.ctx;
    const dead = actor.hp<=0;
    const selected = actor.id===state.selectedTargetId;
    const player = actor.id===state.playerId;
    ctx.save(); ctx.translate(Math.round(actor.x),Math.round(actor.y));
    ctx.fillStyle = '#142c3548';ctx.beginPath();ctx.ellipse(0,-1,dead?24:16,5,0,0,TAU);ctx.fill();
    if (!dead) {
      ring(ctx,0,0,selected?24:player?22:17,selected?pixelColor.gold:pixelColor[actor.team]||pixelColor.blue,selected?1:player?.85:.45,selected?2:1);
      if (selected) {
        pixelLine(ctx,-27,-4,-31,-4,2,pixelColor.gold);
        pixelLine(ctx,27,-4,31,-4,2,pixelColor.gold);
      }
      if (actor.shield>0 && (!Number.isFinite(actor.shieldUntil)||state.tick<actor.shieldUntil)) ring(ctx,0,1,25,'#a4dedf',.7);
      if (player) dot(ctx,0,-84,4,pixelColor.gold);
    }
    ctx.globalAlpha = dead?.4:1;
    const pose = this.actorPose(actor,state.tick);
    let surface = this.sprites[pose];
    if (actor.appearance==='red'||actor.appearance==='white') {
      const offset = actor.appearance==='white'?4:0;
      const active = actor.action && state.tick>=actor.action.startTick && state.tick<actor.action.endTick;
      const frame = active?3:actor.moving?1+Math.floor(finite(actor.distance)/14)%2:0;
      surface = this.discipleSprites[offset+frame];
    }
    if (dead) {ctx.translate(-17,-4);ctx.rotate(-Math.PI/2);ctx.scale(.78,.78);}
    ctx.scale(actor.dir===-1?-1:1,1);ctx.drawImage(surface,-52,-77);ctx.restore();
  }

  drawProp(prop) {
    const ctx = this.ctx;
    ctx.save();ctx.fillStyle = '#21363240';ctx.beginPath();ctx.ellipse(prop.x+8,prop.y-1,prop.width*.33,7,0,0,TAU);ctx.fill();
    ctx.drawImage(this.props,...prop.rect,Math.round(prop.x-prop.width/2),Math.round(prop.y-prop.height),prop.width,prop.height);ctx.restore();
  }

  drawForeground(view) {
    const ctx = this.ctx;
    for (const polygon of foreground) {
      const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);
      if (!intersects(view,{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)})) continue;
      ctx.save();ctx.beginPath();
      polygon.forEach(([x,y],index) => index?ctx.lineTo(x,y):ctx.moveTo(x,y));
      ctx.closePath();ctx.clip();this.drawPlate(this.ground,0,0,BASE_VIEW.width,BASE_VIEW.height,view);ctx.restore();
    }
  }

  drawTrailMask(mask,view) {
    const ctx = this.ctx;
    ctx.save();ctx.beginPath();
    mask.polygon.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.closePath();ctx.clip();this.drawPlate(this.trail,0,941,1672,1882,view);ctx.restore();
  }

  drawMotes(time,view) {
    const ctx = this.ctx;
    const rows = isTrailMode(this.mode)?3:1;
    for (let row=0;row<rows;row++) for (let i=0;i<24;i++) {
      const x = 95+(i*131+time*(3+i%3))%1480;
      const y = row*941+115+(i*73)%500+Math.sin(time*.9+i)*9;
      if (x<view.x||x>view.x+view.w||y<view.y||y>view.y+view.h) continue;
      ctx.fillStyle = i%3?'#ead88b77':'#cce8cb55';ctx.fillRect(Math.round(x),Math.round(y),2,1);
    }
  }

  releaseVisual(event,state,actors) {
    const from = eventPoint(event,'from',actors),to = eventPoint(event,'to',actors);
    if (!from||!to) return null;
    const age = (state.tick-event.atTick)*.1;
    const duration = event.skill==='attack'?.1:.5;
    if (age<0||age>=duration||event.skill==='ward') return null;
    return {event,from,to,age,duration,y:mix(from.y,to.y,age/duration)};
  }

  drawRelease(visual) {
    const {event,from,to,age,duration} = visual;
    const ctx = this.ctx;
    const p = clamp(age/duration);
    const angle = Math.atan2(to.y-from.y,to.x-from.x);
    const nx = Math.cos(angle),ny = Math.sin(angle),px = -ny,py = nx;
    const hand = {x:from.x+nx*11,y:from.y-27+ny*8};
    ctx.save();
    if (event.skill==='sword'||event.skill==='attack') {
      const q = event.skill==='attack'?.55:clamp(age/.3);
      if (age<.3) for (let i=0;i<=52;i++) {
        const t = i/52,a = mix(-1.45,.6,q)+t*1.5;
        const r = 33+q*8;
        const ahead = Math.cos(a)*r,across = Math.sin(a)*r*.82;
        const x = hand.x+nx*ahead+px*across,y = hand.y+ny*ahead+py*across;
        const taper = Math.sin(t*Math.PI);
        dot(ctx,x,y,1+taper*4,'#31bad7',.8);
        dot(ctx,x+nx,y+ny,1+taper*2,'#e7ffff',.9);
      }
      if (event.skill==='sword') {
        const x = mix(hand.x,to.x,p),y = mix(hand.y,to.y-26,p);
        for (let i=4;i>0;i--) pixelLine(ctx,x-nx*(i*6+6),y-ny*(i*6+6),x-nx*(i*6-5),y-ny*(i*6-5),2,'#31bad7',(1-i/5)*.5);
        pixelLine(ctx,x-nx*10,y-ny*10,x+nx*10,y+ny*10,3,'#31bad7');
        pixelLine(ctx,x-nx*6,y-ny*6,x+nx*10,y+ny*10,1,'#e7ffff');
        pixelLine(ctx,x-nx*6-px*4,y-ny*6-py*4,x-nx*6+px*4,y-ny*6+py*4,1,'#e5c37d');
      }
    } else if (event.skill==='fire') {
      const x = mix(hand.x,to.x,p),y = mix(hand.y,to.y-25,p)-Math.sin(p*Math.PI)*9;
      for (let i=13;i>=0;i--) {
        const f = 1-i/15,wobble = Math.sin(age*24+i*1.8)*i*.2;
        dot(ctx,x-nx*i*2.3+px*wobble,y-ny*i*2.3+py*wobble,1+f*5,'#ef792b',f*.82);
      }
      dot(ctx,x,y,9,'#ef792b');dot(ctx,x+nx,y+ny,6,'#ffbe54');dot(ctx,x+nx*2,y+ny*2,3,'#fff0b0');
    }
    ctx.restore();
  }

  drawHit(event,time,point) {
    const age = time-event.atTick*.1,p = clamp(age/.65);
    if (age<0||age>=.65) return;
    const ctx = this.ctx;
    const fire = event.skill==='fire';
    const palette = fire?['#ef792b','#ffbe54','#fff0b0']:['#31bad7','#95e9eb','#e7ffff'];
    const eventSeed = seed(event.id);
    const cx = point.x,cy = point.y-26;
    ctx.save();
    for (let i=0;i<(fire?26:17);i++) {
      const a = scatter(i,eventSeed)*TAU;
      const radius = (fire?42:28)*(.25+scatter(i+30,eventSeed)*.75)*(1-(1-p)**3);
      const x = cx+Math.cos(a)*radius,y = cy+Math.sin(a)*radius*.7-Math.sin(p*Math.PI)*(fire?10:3);
      dot(ctx,x,y,i%5===0?3:i%3===0?2:1,palette[i%3],(1-p)**1.4);
      if (i%4===0) pixelLine(ctx,x,y,x-Math.cos(a)*5*(1-p),y-Math.sin(a)*3*(1-p),1,palette[1],(1-p)*.7);
    }
    if (p<.4) {
      const f = 1-p/.4;
      pixelLine(ctx,cx-10,cy-11,cx+10,cy+11,fire?3:2,palette[2],f);
      pixelLine(ctx,cx+8,cy-10,cx-8,cy+10,1,palette[1],f);
    }
    ctx.restore();
  }

  drawActorBars(actors,state) {
    const ctx = this.ctx;
    const box = this.canvas.getBoundingClientRect();
    for (const actor of actors) {
      if (actor.hp<=0) continue;
      const screen = this.worldToScreen(actor.x,actor.y-78);
      const x = Math.round(screen.x-box.left),y = Math.round(screen.y-box.top);
      if (x<-60||x>this.viewport.w+60||y<-25||y>this.viewport.h+15) continue;
      const player = actor.id===state.playerId,selected = actor.id===state.selectedTargetId;
      const w = selected||player?48:34,h = selected||player?4:3;
      ctx.fillStyle = '#13252aea';ctx.fillRect(x-w/2-1,y-1,w+2,h+2);
      ctx.fillStyle = actor.team==='red'?'#c97459':'#78b7ad';
      ctx.fillRect(x-w/2,y,Math.round(w*clamp(actor.hp/Math.max(1,actor.maxHp))),h);
      if (actor.shield>0) {ctx.fillStyle='#a7dce1';ctx.fillRect(x-w/2,y+h+2,Math.round(w*clamp(actor.shield/Math.max(1,actor.maxHp))),2);}
      if (player||selected) {
        const name = player?'掌门':actor.name;
        if (name) {
          ctx.font='12px "Songti SC", "Noto Serif CJK SC", serif';ctx.textAlign='center';
          ctx.lineWidth=3;ctx.strokeStyle='#14272a';ctx.strokeText(name,x,y-6);
          ctx.fillStyle=selected?'#f0d797':'#e4e3c9';ctx.fillText(name,x,y-6);
        }
      }
    }
  }

  drawFeedback(events,time,actors,state) {
    const ctx = this.ctx,box = this.canvas.getBoundingClientRect();
    const latest=new Map();
    for (const event of events) {
      if (![event.sourceId,event.targetId].includes(state.playerId)&&event.targetId!==state.selectedTargetId) continue;
      if (!['hit','miss','ward'].includes(event.kind)) continue;
      latest.set(`${event.kind}:${event.targetId||event.sourceId}`,event);
    }
    for (const event of latest.values()) {
      if (!['hit','miss','ward'].includes(event.kind)) continue;
      const age = time-event.atTick*.1;
      if (age<0||age>1.05) continue;
      const point = eventPoint(event,event.kind==='ward'?'from':'to',actors);
      if (!point) continue;
      const screen = this.worldToScreen(point.x,point.y-48-age*22);
      const x = Math.round(screen.x-box.left),y = Math.round(screen.y-box.top);
      if (x<-90||x>this.viewport.w+90||y<-35||y>this.viewport.h+25) continue;
      const amount = Math.max(0,finite(event.amount));
      const absorbed = Math.max(0,finite(event.absorbed));
      const text = event.kind==='miss'?'失手':event.kind==='ward'?`护盾 +${Math.round(amount)}`:amount>0?`−${Math.round(amount)}`:absorbed>0?`护盾 −${Math.round(absorbed)}`:'';
      if (!text) continue;
      ctx.save();ctx.globalAlpha=clamp((1.05-age)/.35);ctx.textAlign='center';ctx.font=`${event.kind==='hit'?17:13}px "Songti SC", "Noto Serif CJK SC", serif`;
      ctx.lineWidth=3;ctx.strokeStyle='#17262b';ctx.strokeText(text,x,y);
      ctx.fillStyle=event.kind==='miss'?'#c5c5b3':event.kind==='ward'||!amount?'#a2e1df':'#ffe0ac';ctx.fillText(text,x,y);
      if (amount>0&&absorbed>0) {ctx.font='11px "Songti SC", serif';ctx.fillStyle='#a2e1df';ctx.fillText(`盾 ${Math.round(absorbed)}`,x,y+14);}
      ctx.restore();
    }
  }

  drawMinimap(state,actors) {
    if (!isTrailMode(this.mode)) {this.minimapRect=null;return;}
    const ctx=this.ctx,{w,h}=this.viewport;
    const mapH=Math.round(clamp(h-335,160,223)),mapW=Math.round(mapH*TRAIL_WORLD.width/TRAIL_WORLD.height);
    const panelW=mapW+28,panelH=mapH+50;
    const x=w-panelW-24,y=110,mapX=x+14,mapY=y+28;
    const box=this.canvas.getBoundingClientRect();
    this.minimapRect={x:x+box.left,y:y+box.top,w:panelW,h:panelH,mapX:mapX+box.left,mapY:mapY+box.top,mapW,mapH};
    ctx.save();ctx.globalAlpha=1;ctx.fillStyle='#10272df0';ctx.fillRect(x,y,panelW,panelH);
    ctx.strokeStyle='#a4936399';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,panelW-1,panelH-1);
    ctx.font='13px "Songti SC", "Noto Serif CJK SC", serif';ctx.textAlign='center';ctx.fillStyle='#e5d7af';ctx.fillText('云岫山路',x+panelW/2,y+19);
    ctx.drawImage(this.minimapSurface,mapX,mapY,mapW,mapH);
    const sx=mapW/TRAIL_WORLD.width,sy=mapH/TRAIL_WORLD.height;
    ctx.save();ctx.beginPath();ctx.rect(mapX,mapY,mapW,mapH);ctx.clip();
    for (const [title,wy] of [['山院',470],['林道',1440],['谷地',2370]]) {
      const ty=mapY+wy*sy;
      ctx.fillStyle='#10272dbb';ctx.fillRect(mapX+3,ty-9,29,15);
      ctx.font='11px "Songti SC", "Noto Serif CJK SC", serif';ctx.textAlign='left';ctx.fillStyle='#efe3c7';ctx.fillText(title,mapX+6,ty+2);
    }
    for (const actor of actors) {
      if (actor.hp<=0||actor.id===state.playerId) continue;
      ctx.fillStyle=actor.team==='red'?'#d88b65':'#80c6c5';
      ctx.fillRect(Math.round(mapX+actor.x*sx-1),Math.round(mapY+actor.y*sy-1),2,2);
    }
    const player=actors.find(actor=>actor.id===state.playerId);
    if (player) {
      const px=Math.round(mapX+player.x*sx),py=Math.round(mapY+player.y*sy);
      ctx.fillStyle='#13282c';ctx.fillRect(px-3,py-3,7,7);
      ctx.fillStyle='#ffe3a2';ctx.beginPath();ctx.moveTo(px,py-4);ctx.lineTo(px+3,py+3);ctx.lineTo(px,py+1);ctx.lineTo(px-3,py+3);ctx.closePath();ctx.fill();
    }
    const visible=this.getVisibleWorldRect();
    const left=clamp(visible.x,0,TRAIL_WORLD.width),top=clamp(visible.y,0,TRAIL_WORLD.height);
    const right=clamp(visible.x+visible.w,0,TRAIL_WORLD.width),bottom=clamp(visible.y+visible.h,0,TRAIL_WORLD.height);
    ctx.strokeStyle='#fff2c4';ctx.lineWidth=1;ctx.strokeRect(mapX+left*sx+.5,mapY+top*sy+.5,Math.max(0,(right-left)*sx-1),Math.max(0,(bottom-top)*sy-1));
    ctx.restore();ctx.font='10px "Songti SC", "Noto Serif CJK SC", serif';ctx.textAlign='center';ctx.fillStyle='#d1c8aa';ctx.fillText('金标 · 掌门　白框 · 视野',x+panelW/2,y+panelH-9);ctx.restore();
  }

  minimapToWorld(clientX,clientY) {
    const r=this.minimapRect;
    if (!r||clientX<r.mapX||clientX>r.mapX+r.mapW||clientY<r.mapY||clientY>r.mapY+r.mapH) return null;
    return {x:(clientX-r.mapX)/r.mapW*this.worldBounds.width,y:(clientY-r.mapY)/r.mapH*this.worldBounds.height};
  }

  render(state,{previous=null,alpha=1}={}) {
    if (!this.ready) throw new Error('场景素材尚未加载');
    const ctx = this.ctx,time = state.tick*.1;
    this.setWorldForState(state);
    const view=this.getVisibleWorldRect();
    const previousActors = new Map((previous?.actors||[]).map(actor=>[actor.id,actor]));
    const canInterpolate = previous && previous.mode===state.mode && previous.tick<=state.tick && previous.tick>=state.tick-1;
    const fraction = clamp(finite(alpha,1));
    const actors = state.actors.map(actor=>{
      const before = canInterpolate?previousActors.get(actor.id):null;
      return before?{...actor,x:mix(before.x,actor.x,fraction),y:mix(before.y,actor.y,fraction),distance:mix(finite(before.distance),finite(actor.distance),fraction)}:actor;
    });
    const actorsById = new Map(actors.map(actor=>[actor.id,actor]));
    const events = (state.events||[]).filter(event=>Number.isFinite(event.atTick)&&event.atTick<=state.tick);
    ctx.save();ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#10262c';ctx.fillRect(0,0,this.viewport.w,this.viewport.h);
    ctx.translate(this.viewport.w/2,this.viewport.h/2);ctx.scale(this.viewport.fit*this.camera.zoom,this.viewport.fit*this.camera.zoom);ctx.translate(-this.camera.x,-this.camera.y);
    this.drawTerrain(view);this.drawMotes(time,view);
    const activeWards = new Set(),air=[];
    for (const event of events) {
      if (event.kind==='ward' && state.tick-event.atTick<24) {
        const from = eventPoint(event,'from',actorsById);
        if (!from) continue;
        if (!intersects(view,{x:from.x-65,y:from.y-65,w:130,h:100})) continue;
        if (event.sourceId!==state.playerId) {
          const age=(state.tick-event.atTick)*.1;
          if (age<.4) {ctx.save();ring(ctx,from.x,from.y,25+age*22,'#a4dedf',(1-age/.4)*.65);ctx.restore();}
          continue;
        }
        const cacheKey = `${event.id}:${event.atTick}:${from.x}:${from.y}`;
        activeWards.add(cacheKey);
        let effects = this.wardEffects.get(cacheKey);
        if (!effects) {
          effects = new Effects();effects.cast('ward',from.x,from.y,from.x,from.y,event.atTick*.1);
          this.wardEffects.set(cacheKey,effects);
        }
        effects.drawGround(ctx,time);air.push({y:from.y+.2,draw:()=>effects.drawAir(ctx,time)});
      }
      if (event.kind==='release') {
        const visual = this.releaseVisual(event,state,actorsById);
        if (visual) {
          const {from,to}=visual;
          const bounds={x:Math.min(from.x,to.x)-65,y:Math.min(from.y,to.y)-95,w:Math.abs(from.x-to.x)+130,h:Math.abs(from.y-to.y)+130};
          if (intersects(view,bounds)) air.push({y:visual.y+.2,draw:()=>this.drawRelease(visual)});
        }
      }
      if (event.kind==='hit' && state.tick-event.atTick<7) {
        const to = eventPoint(event,'to',actorsById);
        if (to&&intersects(view,{x:to.x-50,y:to.y-80,w:100,h:110})) air.push({y:to.y+.3,draw:()=>this.drawHit(event,time,to)});
      }
    }
    for (const key of this.wardEffects.keys()) if (!activeWards.has(key)) this.wardEffects.delete(key);
    const player = actorsById.get(state.playerId),destination = player?.path?.at(-1);
    if (destination && player.hp>0) {ctx.save();ring(ctx,destination.x,destination.y,12,pixelColor.gold,.75);ctx.restore();}
    const visibleActors=actors.filter(actor=>intersects(view,{x:actor.x-65,y:actor.y-100,w:130,h:115}));
    const visibleProps=garden.filter(prop=>intersects(view,{x:prop.x-prop.width/2-10,y:prop.y-prop.height,w:prop.width+20,h:prop.height+15}));
    const masks=isTrailMode(this.mode)?this.trailForeground.filter(mask=>{
      const xs=mask.polygon.map(p=>p[0]),ys=mask.polygon.map(p=>p[1]);
      return intersects(view,{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)});
    }):[];
    const layers = [
      ...visibleActors.map(actor=>({y:actor.y,draw:()=>this.drawActor(actor,state)})),
      ...visibleProps.map(prop=>({y:prop.y,draw:()=>this.drawProp(prop)})),
      ...masks.filter(mask=>Number.isFinite(mask.sortY)).map(mask=>({y:mask.sortY,draw:()=>this.drawTrailMask(mask,view)})),...air
    ].sort((a,b)=>a.y-b.y);
    for (const layer of layers) layer.draw();
    this.drawForeground(view);
    for (const mask of masks.filter(mask=>!Number.isFinite(mask.sortY))) this.drawTrailMask(mask,view);
    ctx.restore();
    this.drawActorBars(visibleActors,state);this.drawFeedback(events,time,actorsById,state);this.drawMinimap(state,actors);
    this.lastFrameStats={actorsTotal:actors.length,actorsDrawn:visibleActors.length,propsDrawn:visibleProps.length,effectsDrawn:air.length,view:{...view},world:{...this.worldBounds}};
  }
}
