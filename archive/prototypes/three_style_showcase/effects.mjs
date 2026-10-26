const LIFE = {slash:0.60, bolt:0.80, ward:2.50, seal:1.85, dash:0.70};
const GROUND = 0.12;
const PALE = 0xfff3ca;
const GOLD = 0xffca72;
const TEAMS = [0x4abdd5, 0xef593c];
const VERTEX = /* glsl */`
  attribute float strength;
  attribute vec3 drift;
  uniform float age;
  varying vec2 ribbonUV;
  varying float brightness;
  void main() {
    ribbonUV = uv;
    brightness = strength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + drift * age, 1.0);
  }
`;
const FRAGMENT = /* glsl */`
  uniform vec3 tint;
  uniform float opacity;
  uniform float age;
  uniform float begins;
  uniform float ends;
  uniform float attack;
  uniform float release;
  uniform float pulse;
  uniform float reveal;
  uniform float taper;
  varying vec2 ribbonUV;
  varying float brightness;
  void main() {
    float entrance = smoothstep(begins, begins + attack, age);
    float exitFade = 1.0 - smoothstep(max(begins + attack, ends - release), ends, age);
    float edge = pow(max(0.0, 1.0 - abs(ribbonUV.y * 2.0 - 1.0)), 0.65);
    float tips = mix(1.0, smoothstep(0.0, 0.08, ribbonUV.x) * (1.0 - smoothstep(0.86, 1.0, ribbonUV.x)), taper);
    float sweep = reveal > 0.0 ? smoothstep(ribbonUV.x - 0.05, ribbonUV.x + 0.05, (age - begins) / reveal) : 1.0;
    float breath = pulse > 0.0 ? 0.85 + 0.15 * sin((age - begins) * pulse) : 1.0;
    float alpha = opacity * brightness * entrance * exitFade * edge * tips * sweep * breath;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(tint, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const add = (a,b) => a.map((v,i) => v+b[i]);
const sub = (a,b) => a.map((v,i) => v-b[i]);
const mul = (a,k) => a.map(v => v*k);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => mul(a,1/(Math.hypot(...a)||1));
const clamp = (n,a=0,b=1) => Math.max(a,Math.min(b,n));

/** Presentation VFX in scene coordinates; from/to are feet, +Y is up.
 * spawn returns its Group so a director can attach a travelling ward if needed.
 * The director owns movement, action events and cooldowns.
 */
export class ShowcaseEffects {
  constructor(THREE, scene, {pixel=false}={}) {
    this.THREE = THREE;
    this.pixel = pixel;
    this.effects = [];
    this.root = new THREE.Group();
    this.root.name = 'ShowcaseEffects';
    scene.add(this.root);
    // Keep a fixed light count: leases change intensity without rebuilding light shaders.
    this.lights = Array.from({length:4}, () => {
      const light = new THREE.PointLight(0xffffff,0,4,2);
      light.castShadow = false;
      this.root.add(light);
      return {light, owner:null};
    });
    this.disposed = false;
  }

  spawn(kind, from, to, team=0) {
    if (this.disposed || !Object.hasOwn(LIFE,kind)) return null;
    const source = this._point(from), target = this._point(to);
    if (!source || !target) return null;
    if (this.effects.length >= 24) this._remove(this.effects.shift());
    const T = this.THREE, root = new T.Group();
    root.name = `VFX:${kind}`;
    const vector = target.clone().sub(source); vector.y = 0;
    if (vector.lengthSq() < 1e-6) vector.set(0,0,1);
    vector.normalize();
    const effect = {root,kind,source,target,vector,age:0,life:LIFE[kind],materials:[],light:null};
    root.position.copy(kind === 'seal' ? target : source);
    if (kind === 'seal') root.position.y = GROUND;
    if (kind === 'slash' || kind === 'bolt') root.rotation.y = Math.atan2(vector.x,vector.z);
    effect.yaw = root.rotation.y;
    this.root.add(root);
    const accent = TEAMS[Math.abs(Math.trunc(team)) % 2];
    this[`_${kind}`](effect,accent);
    if (kind !== 'dash') {
      const lease = this.lights.find(slot => slot.owner === null);
      if (lease) {
        lease.owner = effect; effect.light = lease;
        lease.light.color.set(accent);
        lease.light.distance = kind === 'seal' ? 4.8 : 3.2;
      }
    }
    this.effects.push(effect);
    this._animate(effect);
    return root;
  }

  update(dt) {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    for (let i=this.effects.length-1;i>=0;i--) {
      const effect = this.effects[i];
      effect.age += dt;
      if (effect.age >= effect.life) {
        this._remove(effect); this.effects.splice(i,1);
      } else this._animate(effect);
    }
  }

  dispose() {
    if (this.disposed) return;
    for (const effect of this.effects) this._remove(effect);
    this.effects.length = 0;
    for (const {light} of this.lights) { light.removeFromParent(); light.dispose(); }
    this.lights.length = 0;
    this.root.removeFromParent();
    this.disposed = true;
  }

  _point(value) {
    const x=value?.x??value?.[0], y=value?.y??value?.[1], z=value?.z??value?.[2];
    return [x,y,z].every(Number.isFinite) ? new this.THREE.Vector3(x,y,z) : null;
  }

  _remove(effect) {
    if (effect.light) { effect.light.owner=null; effect.light.light.intensity=0; }
    effect.root.traverse(node => { if (node.isMesh) { node.geometry.dispose(); node.material.dispose(); } });
    effect.root.removeFromParent();
  }

  _animate(effect) {
    const age=this.pixel ? Math.floor(effect.age*12)/12 : effect.age;
    for (const material of effect.materials) material.uniforms.age.value=age;
    if (effect.kind==='bolt') effect.root.position.lerpVectors(effect.source,effect.target,clamp(age/0.64));
    if (effect.kind==='slash') effect.root.rotation.y=effect.yaw-0.32+clamp(age/0.22)*0.64;
    if (effect.kind==='ward') effect.root.rotation.y=age*0.28;
    if (effect.light) {
      const light=effect.light.light;
      light.position.copy(effect.root.position); light.position.y+=0.95;
      let power=clamp(1-age/effect.life)*3.8;
      if (effect.kind==='ward') power=clamp(age/0.15)*clamp((2.5-age)/0.4)*1.0;
      if (effect.kind==='seal') power=age<1 ? 0.32 : clamp(1-(age-1)/0.65)*7.5;
      light.intensity=power*(this.pixel?0.65:1);
    }
  }

  _slash(e,c) {
    const veil=this._data(); this._arc(veil,1.6,.24,.94,-1.35,.93);
    this._layer(e,veil,c,.34,0,.50,{reveal:.13,taper:1});
    const edge=this._data();
    this._arc(edge,1.62,.038,.95,-1.28,.91);
    this._arc(edge,1.43,.023,.91,-1.05,.62,.6);
    this._layer(e,edge,PALE,.98,.01,.40,{reveal:.11,taper:1});
    const traces=this._data();
    this._arc(traces,1.87,.036,.90,-1.02,.50,.62);
    this._arc(traces,1.28,.027,1.02,-.86,.88,.75);
    this._sparks(traces,[.92,.95,1.12],.44,7,.055,.35);
    this._layer(e,traces,GOLD,.85,.04,.60,{taper:0});
  }

  _bolt(e,c) {
    const core=this._data();
    this._diamond(core,[0,1.05,.28],[.045,.045,.62]);
    this._stroke(core,[-.16,1.05,-.06],[.16,1.05,-.06],.045);
    this._layer(e,core,PALE,.98,0,.76);
    const stream=this._data();
    this._stroke(stream,[0,1.05,-2.0],[0,1.05,.38],.17,.4,true);
    for (const sign of [-1,1]) {
      let prior=[sign*.12,1.05,-1.9];
      for (let i=1;i<=16;i++) {
        const t=i/16, next=[sign*Math.sin(t*Math.PI)*.18,1.05+Math.sin(t*Math.PI*2)*.055,-1.9+t*2.1];
        this._stroke(stream,prior,next,.028,t); prior=next;
      }
    }
    this._layer(e,stream,c,.72,0,.80,{taper:1});
    const sparks=this._data(); this._sparks(sparks,[0,1.02,-.7],.58,7,.037,.12);
    this._layer(e,sparks,GOLD,.7,.025,.72);
  }

  _ward(e,c) {
    const rings=this._data();
    this._arc(rings,.94,.035,.12,0,Math.PI*2);
    this._arc(rings,1.04,.028,1.02,0,Math.PI*2,.65);
    for (const turn of [0,Math.PI/2]) {
      for (let i=0;i<48;i++) {
        const point=a=>[Math.cos(a)*Math.cos(turn),1.05+Math.sin(a)*1.04,Math.cos(a)*Math.sin(turn)];
        this._stroke(rings,point(i/48*Math.PI*2),point((i+1)/48*Math.PI*2),.032,.6);
      }
    }
    this._layer(e,rings,c,.67,0,2.5,{pulse:4.5,attack:.15});
    const marks=this._data();
    for (let i=0;i<8;i++) {
      const a=i/8*Math.PI*2, center=[Math.sin(a),i%2?.73:1.44,Math.cos(a)];
      this._sigil(marks,center,a,.18);
    }
    this._layer(e,marks,GOLD,.78,.08,2.46,{pulse:3.2});
    const foot=this._data(); this._arc(foot,.67,.022,.02,0,Math.PI*2);
    for (let i=0;i<12;i++) {
      const a=i/12*Math.PI*2;
      this._stroke(foot,[Math.sin(a)*.78,.025,Math.cos(a)*.78],[Math.sin(a)*.9,.025,Math.cos(a)*.9],.035);
    }
    this._layer(e,foot,PALE,.68,0,2.25);
  }

  _seal(e,c) {
    const rim=this._data();
    this._arc(rim,2.15,.045,.018,0,Math.PI*2);
    this._arc(rim,1.87,.025,.025,0,Math.PI*2,.62);
    for (let i=0;i<24;i++) {
      const a=i/24*Math.PI*2, r=i%3?2.12:2.25;
      this._stroke(rim,[Math.sin(a)*1.98,.025,Math.cos(a)*1.98],[Math.sin(a)*r,.025,Math.cos(a)*r],.045);
    }
    this._layer(e,rim,c,.77,0,1.72,{pulse:8});
    const marks=this._data(); this._arc(marks,1.14,.032,.03,0,Math.PI*2);
    for (let i=0;i<8;i++) {
      const a=i/8*Math.PI*2, axis=[Math.sin(a),0,Math.cos(a)], tangent=[Math.cos(a),0,-Math.sin(a)];
      for (let row=0;row<3;row++) {
        const p=add(mul(axis,1.52+(row-1)*.10),[0,.04,0]);
        if ((row+i)%3===0) {
          this._stroke(marks,add(p,mul(tangent,-.21)),add(p,mul(tangent,-.05)),.04);
          this._stroke(marks,add(p,mul(tangent,.05)),add(p,mul(tangent,.21)),.04);
        } else this._stroke(marks,add(p,mul(tangent,-.21)),add(p,mul(tangent,.21)),.04);
      }
      const b=a+Math.PI/4;
      this._stroke(marks,add(mul(axis,.68),[0,.045,0]),[Math.sin(b)*.68,.045,Math.cos(b)*.68],.025);
    }
    this._layer(e,marks,GOLD,.83,.10,1.85,{reveal:.65,pulse:5});
    const strike=this._data(); let prior=[0,5.3,0];
    for (let i=1;i<=10;i++) {
      const p=[Math.sin(i*8.3)*.22,5.3-i*.52,Math.cos(i*6.7)*.17];
      this._stroke(strike,prior,p,.067,1,true); prior=p;
    }
    this._arc(strike,.70,.075,.06,0,Math.PI*2);
    this._layer(e,strike,PALE,1,1,1.58);
    const pulse=this._data();
    this._stroke(pulse,[0,.1,0],[0,4,0],.23,.26,true);
    this._arc(pulse,1.04,.04,.06,0,Math.PI*2,.8);
    this._arc(pulse,1.55,.035,.05,0,Math.PI*2,.5);
    this._sparks(pulse,[0,.20,0],1.25,14,.05,.16);
    this._layer(e,pulse,c,.73,1.04,1.85);
  }

  _dash(e,c) {
    const end=e.target.clone().sub(e.source).toArray(), side=[e.vector.z,0,-e.vector.x];
    const track=this._data();
    for (const offset of [-.20,.20]) this._stroke(track,add(mul(side,offset),[0,.18,0]),add(add(end,mul(side,offset)),[0,.18,0]),.045,.75);
    this._layer(e,track,c,.72,0,.62,{taper:1});
    const ghosts=this._data();
    for (let i=0;i<5;i++) {
      const p=mul(end,i/5), strength=.50-i*.065;
      const at=(s,h)=>add(p,add(mul(side,s),[0,h,0]));
      this._stroke(ghosts,at(-.30,.20),at(-.16,1.35),.085,strength);
      this._stroke(ghosts,at(.30,.20),at(.16,1.35),.085,strength);
      this._stroke(ghosts,at(-.16,1.35),at(.16,1.35),.075,strength);
      this._diamond(ghosts,at(0,1.58),[.10,.13,.10],strength);
    }
    this._layer(e,ghosts,c,.55,0,.70);
    const glints=this._data();
    for (let i=0;i<8;i++) this._diamond(glints,add(mul(end,i/8),add(mul(side,Math.sin(i*2.3)*.3),[0,.3,0])),[.04,.075,.04]);
    this._layer(e,glints,GOLD,.72,.015,.48);
  }

  _data() { return {position:[],uv:[],strength:[],drift:[]}; }

  _quad(d,a,b,c,e,strength=1,u0=0,u1=1,drift=[0,0,0]) {
    const points=[a,b,c,e], uv=[[u0,0],[u0,1],[u1,1],[u1,0]];
    for (const i of [0,1,2,0,2,3]) {
      d.position.push(...points[i].map(v=>this.pixel?Math.round(v/.025)*.025:v));
      d.uv.push(...uv[i]); d.strength.push(strength); d.drift.push(...drift);
    }
  }

  _stroke(d,a,b,width,strength=1,crossed=false) {
    const direction=norm(sub(b,a)); let side=norm(cross(direction,[0,1,0]));
    if (Math.hypot(...side)<.01) side=[1,0,0];
    const w=(this.pixel?Math.max(width,.05):width)/2;
    const half=mul(side,w);
    this._quad(d,sub(a,half),add(a,half),add(b,half),sub(b,half),strength);
    if (crossed) {
      const other=mul(norm(cross(direction,side)),w);
      this._quad(d,sub(a,other),add(a,other),add(b,other),sub(b,other),strength);
    }
  }

  _arc(d,r,width,y,start,end,strength=1) {
    const count=Math.max(4,Math.ceil(Math.abs(end-start)/(Math.PI*2)*(this.pixel?32:96)));
    const w=(this.pixel?Math.max(width,.05):width)/2;
    const point=(a,radius)=>[Math.sin(a)*radius,y,Math.cos(a)*radius];
    for (let i=0;i<count;i++) {
      const a=start+(end-start)*i/count,b=start+(end-start)*(i+1)/count;
      this._quad(d,point(a,r-w),point(a,r+w),point(b,r+w),point(b,r-w),strength,i/count,(i+1)/count);
    }
  }

  _diamond(d,p,size,strength=1,drift=[0,0,0]) {
    const [x,y,z]=size;
    if (this.pixel) {
      this._quad(d,add(p,[-x,-y,0]),add(p,[x,-y,0]),add(p,[x,y,0]),add(p,[-x,y,0]),strength,0,1,drift);
      this._quad(d,add(p,[-x,0,-z]),add(p,[x,0,-z]),add(p,[x,0,z]),add(p,[-x,0,z]),strength,0,1,drift);
    } else {
      this._quad(d,add(p,[-x,0,0]),add(p,[0,y,0]),add(p,[x,0,0]),add(p,[0,-y,0]),strength,0,1,drift);
      this._quad(d,add(p,[-x,0,0]),add(p,[0,0,z]),add(p,[x,0,0]),add(p,[0,0,-z]),strength,0,1,drift);
    }
  }

  _sparks(d,center,radius,count,size,speed) {
    for (let i=0;i<count;i++) {
      const a=i*2.399963,r=radius*(.35+.65*(i+1)/count), direction=[Math.cos(a),.4+Math.sin(i*1.7)*.2,Math.sin(a)];
      this._diamond(d,add(center,[direction[0]*r,Math.sin(i*1.7)*radius*.22,direction[2]*r]),
        [size,size*(this.pixel?1:2.0),size],.55+(i%3)*.2,mul(direction,speed));
    }
  }

  _sigil(d,p,angle,s) {
    const tangent=[Math.cos(angle)*s,0,-Math.sin(angle)*s], up=[0,s,0];
    this._stroke(d,sub(p,up),add(p,up),.029);
    this._stroke(d,add(p,up),add(p,add(mul(tangent,.7),mul(up,.4))),.029);
    this._stroke(d,add(p,mul(tangent,-.7)),add(p,mul(tangent,.7)),.029);
    this._stroke(d,add(p,mul(up,-.45)),add(p,add(mul(tangent,-.65),mul(up,-.8))),.029);
  }

  _layer(effect,data,color,opacity,begins,ends,options={}) {
    const T=this.THREE, geometry=new T.BufferGeometry();
    for (const [name,itemSize] of [['position',3],['uv',2],['strength',1],['drift',3]])
      geometry.setAttribute(name,new T.Float32BufferAttribute(data[name],itemSize));
    geometry.computeBoundingSphere();
    const material=new T.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,
      transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:T.AdditiveBlending,
      toneMapped:false,uniforms:{tint:{value:new T.Color(color)},opacity:{value:opacity},age:{value:0},
        begins:{value:begins},ends:{value:ends},attack:{value:options.attack??.025},
        release:{value:Math.min((ends-begins)*.55,.4)},pulse:{value:options.pulse??0},
        reveal:{value:options.reveal??0},taper:{value:options.taper??0}}});
    const mesh=new T.Mesh(geometry,material); mesh.frustumCulled=false;
    mesh.renderOrder=3; mesh.castShadow=false; mesh.receiveShadow=false;
    effect.root.add(mesh); effect.materials.push(material);
  }
}
