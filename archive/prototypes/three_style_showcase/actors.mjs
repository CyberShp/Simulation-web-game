import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const q = new THREE.Quaternion();
const e = new THREE.Euler();
export class Actor {
  constructor(gltf, team, master = false) {
    this.root = new THREE.Group();
    this.model = clone(gltf.scene);
    this.root.add(this.model);
    this.bones = {};
    this.model.traverse(object => {
      if (object.isBone) this.bones[object.name] = object;
      if (!object.isMesh) return;
      object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
      const change = original => {
        const m = original.clone(), n = m.name.toLowerCase();
        if (/^(wood|iron)/.test(n)) { m.visible = false; }
        if (/^(robe|lining)/.test(n)) {
          m.color.set(team ? (master ? '#8b3342' : '#583540') : (master ? '#bcc9c7' : '#345e61'));
          if (n.includes('shade')) m.color.multiplyScalar(.8);
          if (n.startsWith('lining')) m.color.set(team ? '#382a35' : '#1e3542');
        }
        m.roughness = .78;
        return m;
      };
      object.material = Array.isArray(object.material) ? object.material.map(change) : change(object.material);
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = Object.fromEntries(gltf.animations.map(c => [c.name, this.mixer.clipAction(c)]));
    this.basePose=Object.fromEntries(Object.entries(this.bones).map(([name,bone])=>[name,bone.quaternion.clone()]));
    this.active = ''; this.actionStart = 0; this.actionUntil = 0; this.actionType = 0;
    const sword = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({color:'#b9cbd2', metalness:.85, roughness:.23});
    const gold = new THREE.MeshStandardMaterial({color:'#ab8241', metalness:.75, roughness:.32});
    [[.048,.76,.022,0,.47,steel],[.22,.032,.06,0,.08,gold],[.045,.18,.045,0,-.02,gold]].forEach(([x,y,z,px,py,mat])=>{
      const m = new THREE.Mesh(new THREE.BoxGeometry(x,y,z),mat); m.position.set(px,py,0); m.castShadow=true; sword.add(m);
    });
    const hand = this.bones['hand.R'] || this.bones.handR;
    if (hand) hand.add(sword);
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(.055,12,8), new THREE.MeshBasicMaterial({color:team ? 0xff984d : 0xa1ffed}));
    (this.bones['hand.L'] || this.bones.handL)?.add(this.orb);
    this.orb.visible = false;
  }
  trigger(type, time, duration=1) { this.actionType=type; this.actionStart=time; this.actionUntil=time+duration; }
  pose(time, moving, delta) {
    const clip = moving > .08 ? 'walk' : 'idle';
    if (clip!==this.active) { this.mixer.stopAllAction(); this.actions[clip]?.reset().play(); this.active=clip; }
    for(const [name,bone] of Object.entries(this.bones))bone.quaternion.copy(this.basePose[name]);
    this.mixer.setTime(time*(moving>.08 ? 1.1 : 1));
    for(const [name,bone] of Object.entries(this.bones))this.basePose[name].copy(bone.quaternion);
    const add = (n,x,y,z) => {
      const b = this.bones[n] || this.bones[n.replaceAll('.','')];
      if (b) { e.set(x,y,z); b.quaternion.multiply(q.setFromEuler(e)); }
    };
    const action = time>=this.actionStart && time<this.actionUntil ? this.actionType : 0;
    this.orb.visible=action===2;
    const swing=Math.sin(time*Math.PI*2/1.05), lift=.5+.5*Math.sin(time*Math.PI*2/1.05-.7);
    if(action===1) { add('chest',.1,.46*swing,-.1*swing);add('upper_arm.R',-.55-lift*1.1,.1,-.4+swing*.48);add('forearm.R',-.35-lift*.65,0,0);add('upper_arm.L',-.24,0,.32); }
    if(action===2) { add('upper_arm.L',-1.2+Math.sin(time*3.5)*.13,0,.22);add('forearm.L',-.65,0,0);add('chest',-.09,.08*Math.sin(time*3.5),0); }
    if(action===3) { add('chest',-.28,0,.12);add('head',-.16,0,0); }
  }
}
