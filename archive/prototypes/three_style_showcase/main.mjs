import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildEnvironment } from './environment.mjs';
import { ShowcaseEffects } from './effects.mjs';
import { Actor } from './actors.mjs';
import { PixelCrowd } from './pixel-actors.mjs';
import { drawHUD } from './hud.mjs';

const settings = await window.showcaseHost?.settings() ?? {style:'d'};
const style = settings.style==='pixel'?'pixel':'d';
const pixel=style==='pixel';
const canvas=document.querySelector('#world'), hud=document.querySelector('#hud');
const renderer = new THREE.WebGLRenderer({canvas, antialias:!pixel, alpha:false, preserveDrawingBuffer:settings.record});
renderer.setPixelRatio(1);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.info.autoReset=false;
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0xa9b8b8,.0028);
const camera=new THREE.PerspectiveCamera(43,16/9,.12,1400);
const sun=new THREE.DirectionalLight(0xffe2b6,3.2);
sun.position.set(-27,46,26);sun.target.position.set(0,0,-5);
sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
Object.assign(sun.shadow.camera,{left:-52,right:52,top:52,bottom:-52,near:.5,far:160});
sun.shadow.bias=-.00012;sun.shadow.normalBias=.035;
scene.add(sun,sun.target);
const hemi=new THREE.HemisphereLight(0xa2bed3,0x655441,1.2);scene.add(hemi);
const sky=new Sky();sky.scale.setScalar(1000);
Object.assign(sky.material.uniforms.turbidity,{value:6});
sky.material.uniforms.rayleigh.value=1.3;
sky.material.uniforms.mieCoefficient.value=.006;
sky.material.uniforms.mieDirectionalG.value=.8;
sky.material.uniforms.sunPosition.value.copy(sun.position).normalize();scene.add(sky);
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(sky,.02).texture;
scene.environmentIntensity=.36;
const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const ao=new SSAOPass(scene,camera,1200,675);
ao.kernelRadius=1.1;ao.minDistance=.0003;ao.maxDistance=.055;ao.enabled=!pixel;composer.addPass(ao);
const bloom=new UnrealBloomPass(new THREE.Vector2(1200,675),.23,.45,1.3);composer.addPass(bloom);
composer.addPass(new OutputPass());
if(pixel){
  const palette=new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float lum=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(lum),c,1.15);c=floor(c*30.0+.5)/30.0;gl_FragColor=vec4(c,1.0);}'});composer.addPass(palette);
  canvas.style.imageRendering='pixelated';
}
function resize(){
  const w=innerWidth,h=innerHeight;
  renderer.setSize(pixel?640:w,pixel?Math.round(640*h/w):h,false);
  composer.setSize(pixel?640:w,pixel?Math.round(640*h/w):h);
  camera.aspect=w/h;camera.updateProjectionMatrix();
  hud.width=w;hud.height=h;
}
resize();addEventListener('resize',resize);
let environment,actors=[],fx,crowd;
const cooldown=Array(12).fill(0),readyAt=Array(12).fill(0),fired=new Set(),captures=new Set();
let running=true,t=settings.start||0,last=performance.now(),start=last,phase=-1,frames=[];
let recorder,recordCanvas,recordCtx,chunks=[];
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
const lerp=(a,b,u)=>a.clone().lerp(b,u);

try{
  await document.fonts.ready;
  const loader=new GLTFLoader();
  const [master,worker,env]=await Promise.all([loader.loadAsync('./assets/disciple_master.glb'),loader.loadAsync('./assets/disciple_worker.glb'),buildEnvironment(THREE,scene,{loader,pixel})]);
  environment=env;
  if(pixel)crowd=new PixelCrowd(THREE,renderer,scene,camera);
  for(let i=0;i<30;i++){
    const source=i===0||i%5===0?master:worker,team=i===1||i>=16?1:0,isMaster=i===0||i%5===0;
    const actor=pixel?crowd.create(source,team,isMaster):new Actor(source,team,isMaster);
    scene.add(actor.root);actors.push(actor);
  }
  fx=new ShowcaseEffects(THREE,scene,{pixel});
  update(0);composer.render();
  document.querySelector('#loading').remove();
  if(settings.record) beginRecording();
  start=last=performance.now();
  requestAnimationFrame(frame);
  console.log('SHOWCASE_READY',style,'THREE',THREE.REVISION,'30 actors',renderer.capabilities.maxTextureSize);
}catch(error){fail(error);}

function fail(error){console.error(error.stack||error);document.querySelector('#error').style.display='block';document.querySelector('#error').textContent='样板加载失败：'+error.message;running=false;}
function positions(){
  const walking=smooth(21,30,t);
  for(let i=0;i<30;i++){
    const a=actors[i];let moving=0;
    a.root.visible=i<2||t>=43;
    if(i===0){
      a.root.position.copy(lerp(v(-8,.12,21),v(-4,.12,13),walking));
      moving=t>=21&&t<30?1:0;a.root.rotation.y=moving?Math.atan2(4,-8):Math.PI/2;
      if(t>=44&&t<62){a.root.position.set(-4+Math.sin(t*.4),.12,13+Math.cos(t*.4));moving=.3;}
    }else if(i===1){a.root.position.set(4,.12,13);a.root.rotation.y=-Math.PI/2;}
    else{
      const team=i>=16?1:0,n=team?i-16:i-2,row=Math.floor(n/5),col=n%5,arrive=smooth(43,47,t);
      a.root.position.set((team?7:-14)+col*1.8+(team?7:-7)*(1-arrive)+Math.sin(t*.6+i)*.4,.12,4+row*7+Math.cos(t*.5+i)*.4);
      a.root.rotation.y=team?-Math.PI/2:Math.PI/2;moving=t<47?1:.1;
    }
    a.pose(t+i*.0,moving,0);
  }
}
function aim(){
  let p,target;
  if(phase===0){const u=smooth(0,11,t);p=lerp(v(46,37,55),v(34,28,42),u);target=v(0,2,-10);}
  else if(phase===1){const u=smooth(11,21,t);p=lerp(v(21,13,4),v(-14,10,3),u);target=v(0,6,-23);}
  else if(phase===2){const u=smooth(21,32,t),a=actors[0].root.position;p=a.clone().add(v(5.5-u*2.5,3,7));target=a.clone().add(v(0,1.05,0));}
  else if(phase===3){const u=smooth(32,44,t);p=lerp(v(13,14,32),v(17,18,35),u);target=v(0,.7,13);}
  else if(phase===4){const u=smooth(44,62,t);p=lerp(v(24,30,46),v(-21,30,46),u);target=v(0,1,13);}
  else {const u=smooth(62,72,t);p=lerp(v(31,22,35),v(47,34,55),u);target=v(0,3,-10);}
  camera.position.copy(p);camera.lookAt(target);
}
function cast(kind,source,target,slot=-1){
  if(source===0&&slot>=0){if(t<readyAt[slot])return;readyAt[slot]=t+[3.5,4,6,8][slot];}
  const a=actors[source],b=actors[target];
  a.trigger(kind==='slash'?1:2,t,kind==='seal'?1.8:1);
  fx.spawn(kind,a.root.position.clone(),b.root.position.clone(),source===1||source>=16?1:0);
  if(kind==='bolt'||kind==='slash')b.trigger(3,t+.35,.65);
}
const events=[[32.7,'slash',0,1,0],[35,'bolt',0,1,1],[35.3,'ward',1,1,-1],[37.2,'slash',0,1,0],[38,'bolt',1,0,-1],[40,'seal',0,1,3],[40.4,'ward',0,0,2]];
function timeline(previous){
  for(let i=0;i<events.length;i++){
    const [when,kind,a,b,slot]=events[i];if(previous<=when&&t>=when&&!fired.has(i)){fired.add(i);cast(kind,a,b,slot);}
  }
  if(t>=45&&t<61.5){
    const beat=Math.floor((t-45)/1.5),key='group-'+beat;
    if(!fired.has(key)){
      fired.add(key);
      for(let n=0;n<4;n++){let a=2+(beat*3+n*2)%14,b=16+(beat+n*3)%14;if(n%2)[a,b]=[b,a];cast(n<3?'bolt':'slash',a,b);}
      cast(beat%3===0?'seal':beat%3===1?'bolt':'ward',0,beat%3===2?0:1,beat%3===0?3:beat%3===1?1:2);
    }
  }
}
function update(dt){
  phase=t<11?0:t<21?1:t<32?2:t<44?3:t<62?4:5;
  const dusk=smooth(62,70,t);
  sun.intensity=THREE.MathUtils.lerp(3.2,.3,dusk);sun.color.set(0xffe2b6).lerp(new THREE.Color(0xffaa6b),dusk);
  sun.position.y=THREE.MathUtils.lerp(46,12,dusk);hemi.intensity=THREE.MathUtils.lerp(1.2,.55,dusk);
  scene.environmentIntensity=THREE.MathUtils.lerp(.36,.12,dusk);scene.fog.color.set(0xa9b8b8).lerp(new THREE.Color(0x4c6583),dusk);
  environment.update?.(t,1-dusk);
  positions();aim();
  crowd?.update(t,1-dusk);
  cooldown.forEach((_,i)=>cooldown[i]=Math.max(0,readyAt[i]-t));
  fx?.update(dt);
  drawHUD(hud.getContext('2d'),hud.width,hud.height,{style,t,phase,cd:cooldown});
}
async function frame(now){
  if(!running)return;
  const dt=Math.min((now-last)/1000,.1);last=now;const previous=t;t+=dt;
  try{
    renderer.info.reset();positions();timeline(previous);update(dt);composer.render();
    if(t>2)frames.push((now-start)/1000);
    if(recordCtx){recordCtx.drawImage(canvas,0,0,1600,900);recordCtx.drawImage(hud,0,0,1600,900);}
    if(settings.qa){for(const at of [5,16,25,37,48,57,68])if(previous<=at&&t>=at&&!captures.has(at)){captures.add(at);await window.showcaseHost.capture(`${style}-${String(at).padStart(2,'0')}.png`);}}
    if(t>=72||(settings.duration>0&&t-settings.start>=settings.duration)){await finish();return;}
    requestAnimationFrame(frame);
  }catch(error){fail(error);}
}
function beginRecording(){
  recordCanvas=document.createElement('canvas');recordCanvas.width=1600;recordCanvas.height=900;recordCtx=recordCanvas.getContext('2d');
  const stream=recordCanvas.captureStream(30),mime='video/webm;codecs=vp9';
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12000000});
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.start(1000);
}
async function finish(){
  running=false;
  if(recorder){await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});const buffer=await new Blob(chunks,{type:'video/webm'}).arrayBuffer();await window.showcaseHost.recording({style,buffer});}
  const times=frames.slice(1).map((x,i)=>(x-frames[i])*1000).sort((a,b)=>a-b);
  await window.showcaseHost?.metrics({style,engine:'three.js r'+THREE.REVISION,nativeDesktop:true,seconds:t,wallSeconds:(performance.now()-start)/1000,frameCount:frames.length,meanFPS:frames.length/(frames.at(-1)-frames[0]),p95FrameMs:times[Math.floor(times.length*.95)],drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,actors:30,events:[...fired],recording:!!settings.record});
  if(settings.qa||settings.duration>0)await window.showcaseHost.finish();
  else if(settings.autoCompare){await window.showcaseHost.next();}
  else{t=0;fired.clear();readyAt.fill(0);frames=[];actors.forEach(a=>{a.actionStart=0;a.actionUntil=0;a.actionType=0;});fx.dispose();fx=new ShowcaseEffects(THREE,scene,{pixel});running=true;start=last=performance.now();requestAnimationFrame(frame);}
}
addEventListener('keydown',event=>{if(event.key==='Escape')window.showcaseHost?.finish();});
