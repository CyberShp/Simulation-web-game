import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ASSETS = [
  { id:'hall', title:'主殿', category:'architecture', group:'院落营造', note:'双层殿身 · 台基石栏' },
  { id:'pavilion', title:'廊亭', category:'architecture', note:'重檐木构 · 台阶回廊' },
  { id:'bridge', title:'石桥', category:'architecture', note:'拱券 · 石栏与桥面' },
  { id:'lantern', title:'石灯', category:'architecture', note:'石构小品' },
  { id:'pine', title:'古松', category:'nature', group:'松石地景', note:'曲干 · 分层针叶树冠' },
  { id:'terrain', title:'松石坡地', category:'nature', note:'连续地形 · 草岩与断面' },
  { id:'rock', title:'山石', category:'nature', note:'岩体与表面纹理' },
  { id:'shrub', title:'灌木', category:'nature', note:'低矮枝叶簇' },
  { id:'disciple', title:'青衣修士', category:'character-v2', design:'disciple-v2', group:'人物与动作', note:'三视图衣装样件 · 待机、行走、施法' }
];
const $ = id => document.getElementById(id);
const host = window.showcaseHost;
const settings = host ? await host.settings() : {};
let selected = ASSETS.find(a=>a.id===settings.asset) || ASSETS[0];
let current, mixer, action, gltf, size, centre, radius=10, currentView='hero';
let automatic=!settings.qa, rotating=!settings.qa, clay=false, loadSerial=0, ready=false, busy=false;
let nextAssetAt=Infinity, lastTime=performance.now(), nextMotionAt=Infinity, motionIndex=0;
const frames=[], results=[], warnings=[];
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dce0dd');
const renderer = new THREE.WebGLRenderer({canvas:$('stage'), antialias:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(33,1,.03,500);
const ortho=new THREE.OrthographicCamera(-10,10,10,-10,.01,600);
const controls=new OrbitControls(camera,$('stage'));
controls.enableDamping=true;
controls.dampingFactor=.08;
controls.minPolarAngle=.04;
controls.maxPolarAngle=Math.PI*.50;
controls.autoRotateSpeed=.50;
controls.addEventListener('start',()=>{setAutomatic(false);rotating=false;updateButtons();});
const sunlight = new THREE.DirectionalLight('#fff4df',3.1);
sunlight.castShadow=true;
sunlight.shadow.mapSize.set(2048,2048);
sunlight.shadow.normalBias=.03;
sunlight.shadow.bias=-.00015;
sunlight.shadow.radius=3;
scene.add(sunlight,sunlight.target);
scene.add(new THREE.HemisphereLight('#e8f4ff','#a4ad91',.8));
const fillLight=new THREE.DirectionalLight('#e3efff',1.15);
scene.add(fillLight,fillLight.target);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({color:'#c9d0c8',roughness:1}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const clayMaterial=new THREE.MeshStandardMaterial({color:'#c5c8c1',roughness:.8,metalness:0});
const loader=new GLTFLoader();
const originals=new WeakMap();
const errors=[];
window.addEventListener('error',e=>fail(e.error||e.message));
window.addEventListener('unhandledrejection',e=>fail(e.reason));
function fail(error){const message=String(error?.stack||error);errors.push(message);$('error').textContent='模型载入遇到问题\n'+message;$('error').style.display='block';console.error(message);}
function setAutomatic(value){automatic=value;nextAssetAt=performance.now()+24000;if(value){rotating=true;if(current)setView('hero');}updateButtons();$('sequence').textContent=value?'● 自动巡览 · 开启':'○ 自动巡览 · 暂停';}
function setMotion(name){if(!mixer)return;const clip=THREE.AnimationClip.findByName(gltf.animations,name);if(!clip)return;const next=mixer.clipAction(clip);if(action!==next){action?.fadeOut(.25);next.reset().fadeIn(.25).play();action=next;}document.querySelectorAll('#motion button').forEach(b=>b.classList.toggle('active',b.dataset.motion===name));}
function updateButtons(){document.querySelectorAll('#views button').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));$('rotate').classList.toggle('active',rotating);$('material').classList.toggle('active',!clay);$('clay').classList.toggle('active',clay);}
function setClay(value){clay=value;current?.traverse(o=>{if(!o.isMesh)return;const original=originals.get(o);const materials=Array.isArray(original)?original:[original];o.material=value?materials.map(m=>m.alphaTest>0?m:clayMaterial):original;if(!Array.isArray(original)&&value)o.material=o.material[0];});updateButtons();}
function frameCamera(cam,view,width,height){
  const directions={hero:[1.45,.95,1.65],front:[0,0,1],side:[1,0,0],back:[0,0,-1],top:[0,1,.001]};
  const dir=new THREE.Vector3(...directions[view]||directions.hero).normalize();
  cam.up.set(0,1,0);cam.position.copy(centre).addScaledVector(dir,radius*3.5);cam.lookAt(centre);
  cam.updateMatrixWorld();
  if(cam.isOrthographicCamera){
    const aspect=width/height, box=new THREE.Box3().setFromObject(current), inverse=cam.matrixWorldInverse;
    let extentX=0,extentY=0;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const p=new THREE.Vector3(x,y,z).applyMatrix4(inverse);extentX=Math.max(extentX,Math.abs(p.x));extentY=Math.max(extentY,Math.abs(p.y));
    }
    const half=Math.max(extentY,extentX/aspect)*1.18;
    cam.left=-half*aspect;cam.right=half*aspect;cam.top=half;cam.bottom=-half;
  }else{
    cam.aspect=width/height;const distance=radius/Math.sin(THREE.MathUtils.degToRad(cam.fov/2))*1.10;
    cam.position.copy(centre).addScaledVector(dir,distance);cam.lookAt(centre);
  }
  cam.near=.01;cam.far=radius*30+100;cam.updateProjectionMatrix();
}
function setView(view){currentView=view;document.body.classList.toggle('grid',view==='grid');controls.enabled=view==='hero';if(current){frameCamera(camera,view==='grid'?'hero':view,$('stage').clientWidth,$('stage').clientHeight);controls.target.copy(centre);controls.update();}updateButtons();}
function render(){
  if(!current)return;
  const width=$('stage').clientWidth,height=$('stage').clientHeight;
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.clear();
  if(currentView==='grid'){
    renderer.setScissorTest(true);
    const left=36,top=116,right=34,bottom=117,gap=12;
    const w=(width-left-right-gap)/2,h=(height-top-bottom-gap)/2;
    ['hero','front','side','back'].forEach((v,i)=>{
      const x=left+(i%2)*(w+gap),y=height-top-h-Math.floor(i/2)*(h+gap);
      renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
      frameCamera(ortho,v,w,h);renderer.render(scene,ortho);
    });renderer.setScissorTest(false);
  }else if(currentView==='hero'){renderer.render(scene,camera);}
  else{frameCamera(ortho,currentView,width*.90,height*.74);renderer.setViewport(width*.05,height*.13,width*.90,height*.74);renderer.render(scene,ortho);}
}
function resize(){const w=$('stage').clientWidth,h=$('stage').clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();}
window.addEventListener('resize',resize);
$('stage').addEventListener('dblclick',()=>setView('hero'));
function disposeModel(){if(!current)return;mixer?.stopAllAction();mixer?.uncacheRoot(current);current.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();const mat=originals.get(o);for(const m of(Array.isArray(mat)?mat:[mat])){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}});scene.remove(current);current=null;mixer=null;action=null;}
async function selectAsset(asset){
  const serial=++loadSerial;busy=true;ready=false;$('error').style.display='none';$('load-state').style.display='grid';$('load-state').textContent='载入'+asset.title+'…';
  try{
    const loaded=await loader.loadAsync(`./assets/asset-review/${asset.category}/${asset.id}.glb`);
    if(serial!==loadSerial)return;
    disposeModel();gltf=loaded;current=gltf.scene;selected=asset;scene.add(current);
    const person=asset.id==='disciple';renderer.toneMappingExposure=person?.85:1;
    sunlight.intensity=person?1.65:3.1;fillLight.intensity=person?.8:1.15;scene.environmentIntensity=person?.45:.8;
    $('design').hidden=!['hall','disciple'].includes(asset.id);
    current.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;originals.set(o,o.material);const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms){if(m.map)m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}}});
    const box=new THREE.Box3().setFromObject(current);size=box.getSize(new THREE.Vector3());centre=box.getCenter(new THREE.Vector3());radius=size.length()/2;
    floor.position.set(centre.x,box.min.y-.02,centre.z);floor.scale.setScalar(radius*80);
    sunlight.position.copy(centre).add(new THREE.Vector3(-1,1.65,1.35).multiplyScalar(radius*2));sunlight.target.position.copy(centre);
    fillLight.position.copy(centre).add(new THREE.Vector3(1,1,-2).multiplyScalar(radius*2));fillLight.target.position.copy(centre);
    Object.assign(sunlight.shadow.camera,{left:-radius*1.5,right:radius*1.5,top:radius*1.5,bottom:-radius*1.5,near:.1,far:radius*10});sunlight.shadow.camera.updateProjectionMatrix();sunlight.shadow.normalBias=radius*.0015;
    controls.minDistance=radius*.6;controls.maxDistance=radius*12;
    $('title').textContent=asset.title;
    $('dimension').textContent=`${asset.note}　／　宽 ${size.x.toFixed(2)} · 高 ${size.y.toFixed(2)} · 深 ${size.z.toFixed(2)} 米`;
    document.querySelectorAll('#assets button').forEach(b=>b.classList.toggle('active',b.dataset.asset===asset.id));
    $('motion').replaceChildren();$('motion').style.display=gltf.animations.length?'flex':'none';
    if(gltf.animations.length){mixer=new THREE.AnimationMixer(current);for(const [name,title]of[['idle','待机'],['walk','行走'],['cast','施法']]){const button=document.createElement('button');button.textContent=title;button.dataset.motion=name;button.onclick=()=>{setAutomatic(false);setMotion(name);};$('motion').append(button);}setMotion('idle');nextMotionAt=performance.now()+6000;motionIndex=0;}
    setClay(clay);setView(currentView);resize();
    await renderer.compileAsync(scene,camera);
    if(serial!==loadSerial)return;
    render();ready=true;busy=false;$('load-state').style.display='none';nextAssetAt=performance.now()+24000;
    console.log('ASSET_READY',asset.id,JSON.stringify({size:size.toArray(),animations:gltf.animations.map(a=>a.name)}));
  }catch(error){if(serial!==loadSerial)return;busy=false;ready=Boolean(current);$('load-state').style.display='none';setAutomatic(false);if(settings.qa)throw error;fail(error);}
}
for(const [i,a] of ASSETS.entries()){
  if(a.group){const label=document.createElement('div');label.className='group';label.textContent=a.group;$('assets').append(label);}
  const button=document.createElement('button');button.dataset.asset=a.id;button.append(document.createTextNode(a.title));const n=document.createElement('span');n.textContent=String(i+1).padStart(2,'0');button.append(n);button.onclick=()=>{setAutomatic(false);selectAsset(a);};$('assets').append(button);
}
for(const [view,title]of[['hero','外观'],['front','正面'],['side','侧面'],['back','背面'],['top','俯视'],['grid','四面同看']]){const b=document.createElement('button');b.dataset.view=view;b.textContent=title;b.onclick=()=>{setAutomatic(false);setView(view);};$('views').append(b);}
$('sequence').onclick=()=>setAutomatic(!automatic);
$('material').onclick=()=>setClay(false);$('clay').onclick=()=>setClay(true);
$('rotate').onclick=()=>{rotating=!rotating;setView('hero');updateButtons();};
$('design').onclick=()=>{setAutomatic(false);$('design-image').src=`./assets/asset-review/design/${selected.design||selected.id}.png`;$('design-label').textContent=selected.title+' · 设计图';$('design-dialog').showModal();};
$('design-close').onclick=()=>$('design-dialog').close();
function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-lastTime)/1000,.05);if(ready&&now-lastTime<500)frames.push(now-lastTime);lastTime=now;mixer?.update(dt);controls.autoRotate=rotating&&currentView==='hero';controls.update();render();if(automatic&&!settings.focus&&ready&&!busy&&now>nextAssetAt)selectAsset(ASSETS[(ASSETS.indexOf(selected)+1)%ASSETS.length]);if(automatic&&mixer&&now>nextMotionAt){motionIndex=(motionIndex+1)%3;setMotion(['idle','walk','cast'][motionIndex]);nextMotionAt=now+6000;}}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function capture(view,filename){setView(view);await delay(450);render();await new Promise(requestAnimationFrame);await host.capture(filename);}
async function audit(asset){
  if(selected.id!==asset.id)await selectAsset(asset);
  const fStart=frames.length;
  await capture('hero',`asset-${asset.id}-hero.png`);
  await capture('grid',`asset-${asset.id}-views.png`);
  await capture('top',`asset-${asset.id}-top.png`);
  setView('hero');const animationChecks=[];
  if(mixer)for(const name of ['idle','walk','cast']){setMotion(name);await delay(900);animationChecks.push({name,playing:action?.isRunning(),time:action?.time,tracks:action?.getClip().tracks.length});await host.capture(`asset-${asset.id}-${name}.png`);}
  const sampled=frames.slice(fStart);let meshes=0,triangles=0,skinned=0;current.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}if(o.isSkinnedMesh)skinned++;});
  results.push({asset:asset.id,size:size.toArray(),meshes,triangles,skinned,animations:animationChecks,frameCount:sampled.length,meanFrameMs:sampled.reduce((a,b)=>a+b,0)/sampled.length});
}
try{
  resize();setAutomatic(automatic);requestAnimationFrame(tick);
  try{const hdr=await new HDRLoader().loadAsync('./assets/asset-review/lighting/sky.hdr');hdr.mapping=THREE.EquirectangularReflectionMapping;scene.environment=hdr;scene.environmentIntensity=.8;}
  catch(error){warnings.push('Environment light unavailable: '+String(error));console.warn(warnings.at(-1));$('model-state').textContent='基础光照';}
  setView(settings.view||'hero');await selectAsset(selected);
  if(settings.qa){
    if(settings.reviewAll){for(const asset of ASSETS)await audit(asset);}else await audit(selected);
    await delay(Math.max(0,(settings.duration||2)*1000));
    await host.metrics({style:'assets',renderer:renderer.capabilities.isWebGL2?'WebGL2':'WebGL',viewport:[innerWidth,innerHeight],pixelRatio:renderer.getPixelRatio(),results,errors,warnings});await host.finish({failed:warnings.length>0});
  }
}catch(error){fail(error);$('load-state').style.display='none';if(settings.qa){await host.metrics({style:'assets',results,errors});await host.finish({failed:true});}}
