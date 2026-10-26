import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Actor} from './actors.mjs';
import {buildReferenceWorld} from './reference-world.mjs';
const settings=await window.showcaseHost.settings();
const canvas=document.querySelector('#world'),hud=document.querySelector('#hud');hud.style.display='none';
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:!!settings.record});
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.info.autoReset=false;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xc6d7df);scene.fog=new THREE.Fog(0xb4c7d0,78,285);
const sky=new THREE.Mesh(new THREE.SphereGeometry(650,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 direction;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){vec3 d=normalize(direction);float h=clamp(d.y,0.,1.);vec3 c=mix(vec3(.72,.81,.86),vec3(.33,.52,.69),sqrt(h));vec2 p=d.xz/(max(.12,d.y+.2))*3.;float n=noise(p)*.56+noise(p*2.1)*.28+noise(p*4.3)*.13;float cloud=smoothstep(.47,.72,n)*smoothstep(-.05,.18,d.y);c=mix(c,vec3(.9,.92,.92),cloud*.85);gl_FragColor=vec4(c,1.);}` }));scene.add(sky);
const pmrem=new THREE.PMREMGenerator(renderer);const studio=new RoomEnvironment();scene.environment=pmrem.fromScene(studio,.03).texture;scene.environmentIntensity=.5;studio.dispose();pmrem.dispose();
const sun=new THREE.DirectionalLight(0xffeed4,2.2);sun.position.set(-45,70,35);sun.target.position.set(0,2,-7);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-80,right:80,top:70,bottom:-70,near:1,far:190});sun.shadow.normalBias=.045;sun.shadow.bias=-.00008;scene.add(sun,sun.target);
scene.add(new THREE.HemisphereLight(0xbad0e1,0x86918a,1.5));
const fill=new THREE.DirectionalLight(0xdbe9f0,.85);fill.position.set(15,24,55);fill.target.position.set(0,7,-15);scene.add(fill,fill.target);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,900);camera.position.set(0,25,62);camera.lookAt(2,-5,-3);
if(settings.camera==='hall'){camera.position.set(0,15,18);camera.lookAt(0,11,-28);camera.fov=46;camera.updateProjectionMatrix();}
if(settings.camera==='garden'){camera.position.set(-3,11,42);camera.lookAt(-30,6,18);camera.fov=49;camera.updateProjectionMatrix();}
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const ao=new SSAOPass(scene,camera,innerWidth,innerHeight);ao.kernelRadius=1.0;ao.minDistance=.0005;ao.maxDistance=.012;ao.enabled=false;composer.addPass(ao);composer.addPass(new OutputPass());
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
let world,time=0,last=performance.now(),start,frames=[],recording,parts=[],running=true;
try{
  world=await buildReferenceWorld(new GLTFLoader());scene.add(world.group);
  // Small human figures establish the same metres and ground contact throughout.
  const master=await new GLTFLoader().loadAsync('./assets/disciple_master.glb');
  const places=[[-9,2.06,4],[-7,2.06,2],[9,2.06,4],[12,2.06,3],[-11,2.06,7],[-7,2.06,7],[6,2.06,-3],[18,2.06,19],[-3,-.1,34],[4,-1.7,43],[-29,2.1,1],[28,2.1,14]];
  places.forEach((p,i)=>{const a=new Actor(master,i%3===2,i%3===0);a.root.position.set(...p);a.root.scale.setScalar(1.4);a.root.rotation.y=(i%3-1)*.8;a.pose(i*.23,0,0);scene.add(a.root);});
  composer.render();document.querySelector('#loading').remove();
  console.log('REFERENCE_READY',JSON.stringify({camera:settings.camera,renderer:renderer.capabilities.maxTextureSize,landmarks:world.landmarks}));
  if(settings.record){recording=new MediaRecorder(canvas.captureStream(30),{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:16000000});recording.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};recording.start(1000);}
  start=last=performance.now();requestAnimationFrame(frame);
}catch(e){console.error(e.stack);document.querySelector('#error').style.display='block';document.querySelector('#error').textContent='场景载入失败：'+e.message;}
let captured=false;
async function frame(now){if(!running)return;const dt=Math.min(.1,(now-last)/1000);last=now;time+=dt;world.update(time);renderer.info.reset();composer.render();if(time>2)frames.push(now);
  if(settings.qa&&!captured&&time>3){captured=true;await window.showcaseHost.capture('reference-'+settings.camera+'.png');}
  if(settings.qa&&time>(settings.duration||6)){running=false;if(recording){await new Promise(resolve=>{recording.onstop=resolve;recording.stop();});await window.showcaseHost.recording({style:'reference',buffer:await new Blob(parts).arrayBuffer()});}
    const intervals=frames.slice(1).map((n,i)=>n-frames[i]).sort((a,b)=>a-b);const landmarks=Object.fromEntries(Object.entries(world.landmarks).map(([n,p])=>{const v=new THREE.Vector3(...p).project(camera);return[n,[(v.x+1)/2,(1-v.y)/2]];}));
    await window.showcaseHost.metrics({style:'reference',camera:settings.camera,seconds:time,wallSeconds:(now-start)/1000,meanFPS:(frames.length-1)*1000/(frames.at(-1)-frames[0]),p95FrameMs:intervals[Math.floor(intervals.length*.95)],drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,landmarks});await window.showcaseHost.finish();return;}
  requestAnimationFrame(frame);
}
addEventListener('keydown',e=>{if(e.key==='Escape')window.showcaseHost.finish();});
