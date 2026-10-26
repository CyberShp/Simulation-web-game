import {Actor} from './actors.mjs';

const COLS=6, ROWS=6, CELL_W=96, CELL_H=128;
const WORLD_W=2.4, WORLD_H=3.2, FOOT_PIXELS=16;
const CENTER_HEIGHT=WORLD_H*(0.5-FOOT_PIXELS/CELL_H);
const VERTEX=/* glsl */`
  varying vec2 cellUV;
  void main() {
    cellUV=uv;
    vec4 feet=modelViewMatrix*vec4(0.0,0.0,0.0,1.0);
    feet.xy+=vec2(position.x,position.y+1.2);
    gl_Position=projectionMatrix*feet;
  }
`;
const FRAGMENT=/* glsl */`
  uniform sampler2D atlas;
  uniform vec2 cell;
  uniform float outline;
  varying vec2 cellUV;
  vec4 sampleCell(vec2 p) {
    if(p.x<0.0||p.y<0.0||p.x>=1.0||p.y>=1.0) return vec4(0.0);
    vec2 pixel=floor(p*vec2(96.0,128.0))+0.5;
    return texture2D(atlas,(cell*vec2(96.0,128.0)+pixel)/vec2(576.0,768.0));
  }
  void main() {
    vec4 ink=sampleCell(cellUV);
    if(ink.a<0.22) {
      if(outline<0.5) discard;
      vec2 texel=1.0/vec2(96.0,128.0);
      float neighbor=max(max(sampleCell(cellUV+vec2(texel.x,0.0)).a,sampleCell(cellUV-vec2(texel.x,0.0)).a),
        max(sampleCell(cellUV+vec2(0.0,texel.y)).a,sampleCell(cellUV-vec2(0.0,texel.y)).a));
      if(neighbor<0.5) discard;
      gl_FragColor=vec4(0.018,0.032,0.040,1.0);
    } else {
      vec3 color=ink.rgb/max(ink.a,0.22);
      color=floor(clamp(color,0.0,2.0)*24.0+0.5)/24.0;
      gl_FragColor=vec4(color,1.0);
    }
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const SHADOW_VERTEX=/* glsl */`
  varying vec2 shadowUV;
  void main(){shadowUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const SHADOW_FRAGMENT=/* glsl */`
  varying vec2 shadowUV;
  void main(){float radius=length((shadowUV-0.5)*2.0);float alpha=(1.0-smoothstep(0.12,1.0,radius))*0.23;
    if(alpha<0.005)discard;gl_FragColor=vec4(0.018,0.022,0.024,alpha);
    #include <colorspace_fragment>
  }
`;

/** Shared 18 Hz character atlas. Call update after poses and camera placement,
 * before the main scene render. Wrapper roots use the director's feet and yaw.
 */
export class PixelCrowd {
  constructor(THREE,renderer,scene,camera) {
    this.THREE=THREE;this.renderer=renderer;this.scene=scene;this.camera=camera;
    this.entries=[];this.slots=Array(COLS*ROWS).fill(false);this.borrowedGeometry=new Set();
    this.lastFrame=-Infinity;this.dirty=true;this.disposed=false;
    this.atlasScene=new THREE.Scene();
    this.atlasCamera=new THREE.OrthographicCamera(-COLS*WORLD_W/2,COLS*WORLD_W/2,ROWS*WORLD_H/2,-ROWS*WORLD_H/2,.1,40);
    this.atlasCamera.position.set(0,0,20);
    this.target=new THREE.WebGLRenderTarget(COLS*CELL_W,ROWS*CELL_H,{
      minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,
      generateMipmaps:false,depthBuffer:true,stencilBuffer:false,
      type:THREE.HalfFloatType,format:THREE.RGBAFormat});
    this.target.texture.name='SharedPixelCharacterAtlas';
    this.target.texture.colorSpace=THREE.LinearSRGBColorSpace;
    this.sun=new THREE.DirectionalLight(0xffecd1,2.2);
    this.sun.position.set(-5,8,10);this.atlasScene.add(this.sun);
    this.ambient=new THREE.HemisphereLight(0xbcd6e3,0x6c6555,1.4);
    this.atlasScene.add(this.ambient);
    this.planeGeometry=new THREE.PlaneGeometry(WORLD_W,WORLD_H);
    this.shadowGeometry=new THREE.PlaneGeometry(1.05,.68);
    this.shadowMaterial=new THREE.ShaderMaterial({vertexShader:SHADOW_VERTEX,fragmentShader:SHADOW_FRAGMENT,
      transparent:true,depthWrite:false,depthTest:true,toneMapped:false,side:THREE.DoubleSide,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    this.scratch={clear:new THREE.Color(),viewport:new THREE.Vector4(),scissor:new THREE.Vector4(),
      cameraAxis:new THREE.Vector3(),forward:new THREE.Vector3()};
  }

  create(gltf,team,master=false) {
    if(this.disposed)throw new Error('PixelCrowd has been disposed.');
    const slot=this.slots.indexOf(false);
    if(slot<0)throw new Error('PixelCrowd supports 36 simultaneous characters.');
    this.slots[slot]=true;
    const T=this.THREE,col=slot%COLS,row=Math.floor(slot/COLS),bottomRow=ROWS-row-1;
    gltf.scene.traverse(node=>{if(node.isMesh)this.borrowedGeometry.add(node.geometry);});
    const proxy=new Actor(gltf,team,master),tilt=new T.Group();
    tilt.position.set((col+.5-COLS*.5)*WORLD_W,(ROWS*.5-row-1)*WORLD_H+FOOT_PIXELS*WORLD_H/CELL_H,0);
    tilt.add(proxy.root);this.atlasScene.add(tilt);
    const bounds=new T.Vector4(col*CELL_W,bottomRow*CELL_H,(col+1)*CELL_W,(bottomRow+1)*CELL_H);
    const clipped=new Set();
    proxy.root.traverse(node=>{
      if(!node.isMesh)return;
      node.castShadow=false;node.receiveShadow=false;
      for(const material of Array.isArray(node.material)?node.material:[node.material]) {
        if(clipped.has(material))continue;clipped.add(material);
        const prior=material.onBeforeCompile;
        material.onBeforeCompile=(shader,renderer)=>{
          prior.call(material,shader,renderer);
          shader.uniforms.atlasCellBounds={value:bounds};
          shader.fragmentShader='uniform vec4 atlasCellBounds;\n'+shader.fragmentShader.replace('void main() {',
            'void main() {\nif(gl_FragCoord.x<atlasCellBounds.x||gl_FragCoord.x>=atlasCellBounds.z||gl_FragCoord.y<atlasCellBounds.y||gl_FragCoord.y>=atlasCellBounds.w)discard;');
        };
        material.customProgramCacheKey=()=> 'pixel-character-cell-clip-v1';
        material.needsUpdate=true;
      }
    });
    const root=new T.Group();root.name=`PixelActor:${slot}`;
    const material=new T.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,
      uniforms:{atlas:{value:this.target.texture},cell:{value:new T.Vector2(col,bottomRow)},outline:{value:1}},
      transparent:false,depthWrite:true,depthTest:true,side:T.DoubleSide,toneMapped:true});
    const sprite=new T.Mesh(this.planeGeometry,material);
    sprite.frustumCulled=false;sprite.castShadow=false;sprite.receiveShadow=false;root.add(sprite);
    const shadow=new T.Mesh(this.shadowGeometry,this.shadowMaterial);
    shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;shadow.renderOrder=1;root.add(shadow);
    this.scene.add(root);
    const entry={slot,root,proxy,tilt,sprite,shadow,time:0,moving:0,delta:0,alive:true};
    const wrapper={root,
      trigger:(type,time,duration=1)=>{proxy.trigger(type,time,duration);this.dirty=true;},
      pose:(time,moving,delta=0)=>{entry.time=time;entry.moving=moving;entry.delta=delta;},
      dispose:()=>this._remove(entry)};
    for(const key of ['actionStart','actionUntil','actionType']) Object.defineProperty(wrapper,key,{
      enumerable:true,get:()=>proxy[key],set:value=>{proxy[key]=value;this.dirty=true;}});
    this.entries.push(entry);this.dirty=true;
    return wrapper;
  }

  update(t,daylight=1) {
    if(this.disposed||!Number.isFinite(t))return;
    const frame=Math.floor(t*18);
    if(frame===this.lastFrame&&!this.dirty)return;
    const T=this.THREE,day=T.MathUtils.clamp(daylight,0,1);
    this.camera.updateWorldMatrix(true,false);
    const axis=this.scratch.cameraAxis.setFromMatrixColumn(this.camera.matrixWorld,2).normalize();
    const azimuth=Math.atan2(axis.x,axis.z),elevation=Math.atan2(axis.y,Math.hypot(axis.x,axis.z));
    for(const entry of this.entries) {
      entry.root.updateWorldMatrix(true,false);
      entry.root.getWorldDirection(this.scratch.forward);
      entry.tilt.rotation.x=elevation;
      entry.proxy.root.rotation.y=Math.atan2(this.scratch.forward.x,this.scratch.forward.z)-azimuth;
      entry.proxy.root.visible=entry.root.visible;
      if(entry.root.visible)entry.proxy.pose(Math.floor(entry.time*18)/18,entry.moving,entry.delta);
    }
    this.sun.intensity=T.MathUtils.lerp(.55,2.2,day);
    this.sun.color.set(0xeeb794).lerp(new T.Color(0xffecd1),day);
    this.ambient.intensity=T.MathUtils.lerp(.65,1.4,day);
    const r=this.renderer,s=this.scratch;
    const previous={target:r.getRenderTarget(),face:r.getActiveCubeFace(),mip:r.getActiveMipmapLevel(),
      scissorTest:r.getScissorTest(),alpha:r.getClearAlpha(),autoClear:r.autoClear,xr:r.xr.enabled};
    r.getClearColor(s.clear);r.getViewport(s.viewport);r.getScissor(s.scissor);
    try {
      r.xr.enabled=false;r.autoClear=false;
      r.setRenderTarget(this.target);r.setViewport(0,0,COLS*CELL_W,ROWS*CELL_H);r.setScissorTest(false);
      r.setClearColor(0x000000,0);r.clear(true,true,true);
      r.render(this.atlasScene,this.atlasCamera);
      this.lastFrame=frame;this.dirty=false;
    } finally {
      r.setRenderTarget(previous.target,previous.face,previous.mip);
      r.setViewport(s.viewport);r.setScissor(s.scissor);r.setScissorTest(previous.scissorTest);
      r.setClearColor(s.clear,previous.alpha);r.autoClear=previous.autoClear;r.xr.enabled=previous.xr;
    }
  }

  _remove(entry) {
    if(!entry.alive)return;
    entry.alive=false;this.slots[entry.slot]=false;
    const materials=new Set(),geometry=new Set();
    entry.proxy.root.traverse(node=>{
      if(!node.isMesh)return;
      for(const m of Array.isArray(node.material)?node.material:[node.material])materials.add(m);
      if(!this.borrowedGeometry.has(node.geometry))geometry.add(node.geometry);
    });
    for(const material of materials)material.dispose();
    for(const item of geometry)item.dispose();
    entry.proxy.mixer.stopAllAction();entry.proxy.mixer.uncacheRoot(entry.proxy.model);
    entry.sprite.material.dispose();entry.tilt.removeFromParent();entry.root.removeFromParent();
    this.entries=this.entries.filter(item=>item!==entry);this.dirty=true;
  }

  dispose() {
    if(this.disposed)return;
    for(const entry of [...this.entries])this._remove(entry);
    this.target.dispose();this.planeGeometry.dispose();this.shadowGeometry.dispose();this.shadowMaterial.dispose();
    this.sun.dispose();this.atlasScene.clear();this.slots.fill(false);this.borrowedGeometry.clear();
    this.disposed=true;
  }
}

export const PIXEL_CHARACTER_LAYOUT=Object.freeze({columns:COLS,rows:ROWS,cellWidth:CELL_W,cellHeight:CELL_H,
  worldWidth:WORLD_W,worldHeight:WORLD_H,footPixels:FOOT_PIXELS,centerHeight:CENTER_HEIGHT});
