"""S04: fixed-view 2D textured mesh with the approved S01 body and a chest-level hand seal."""
import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('cast_mesh', ROOT / 'scripts/art/shen-yan-cast/render-cast.py')
cast = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cast)
BASE = ROOT / 'assets/characters/shen-yan/cast-study-v1/source/casting-master-v1.png'
SOURCE = ROOT / 'assets/characters/shen-yan/guard-study-v1/source/guard-master-v1.png'
SEAL_SOURCE = ROOT / 'assets/characters/shen-yan/guard-study-v1/source/seal-master-v1.png'
SIZE = (640, 512)
ANCHOR = np.array([255., 456.])
SOURCE_ANCHOR = np.array([765., 993.])
SCALE = 384 / 978
OLD_NEAR = [(610,223),(639,225),(679,244),(707,284),(715,328),(700,375),
            (674,418),(644,477),(595,490),(558,511),(543,540),(520,559),
            (487,559),(458,540),(450,515),(478,481),(516,424),(482,410),
            (484,381),(542,330)]
NEAR = [(642,244),(680,239),(718,277),(740,330),(789,336),(811,298),
        (827,236),(847,236),(860,269),(869,291),(865,333),(849,354),
        (818,374),(793,402),(748,419),(718,454),(695,478),(653,449),
        (627,399),(635,308)]
FAR = [(849,221),(886,241),(920,284),(962,335),(978,383),(980,427),
       (958,478),(921,476),(902,459),(875,427),(848,416),(786,407),
       (771,394),(786,382),(817,376),(833,363),(860,370),(886,366),
       (877,327),(845,291)]
EQUIPMENT = [(626,345),(680,337),(706,385),(688,421),(678,446),(645,481),
             (499,593),(451,593),(447,568),(580,447),(610,407)]
JOINTS = {
    'near': {'shoulder': np.array([675.,270.]), 'elbow': np.array([724.,394.]), 'palm': np.array([836.,303.])},
    'far': {'shoulder': np.array([865.,252.]), 'elbow': np.array([938.,395.]), 'palm': np.array([818.,389.])},
}
# The casting hand rises to a compact seal; the supporting hand stays at the abdomen.
POSES = [
    dict(near=[0,42,.94],far=[0,-4,1],lean=0,dip=0,lag=0,phase='凝神',ms=140,strength=0,rise=0),
    dict(near=[0,24,.97],far=[0,-2,1],lean=0,dip=3,lag=-1,phase='抬手',ms=110,strength=0,rise=0),
    dict(near=[0,0,1],far=[0,0,1],lean=0,dip=2,lag=-2,phase='掐诀',ms=150,strength=.25,rise=.06),
    dict(near=[0,0,1],far=[0,0,1],lean=1,dip=0,lag=0,phase='起盾',ms=100,strength=.65,rise=.32),
    dict(near=[0,0,1],far=[0,0,1],lean=2,dip=0,lag=2,phase='护盾升起',ms=140,strength=.9,rise=.68),
    dict(near=[0,0,1],far=[0,0,1],lean=1,dip=0,lag=3,phase='合顶护身',ms=200,strength=1,rise=1,event='guard-start'),
    dict(near=[0,0,1],far=[0,0,1],lean=0,dip=1,lag=1,phase='持诀',ms=180,strength=1,rise=1),
    dict(near=[0,2,1],far=[0,0,1],lean=-3,dip=3,lag=4,phase='盾面受击',ms=140,strength=1,rise=1,pressure=1,event='pressure'),
    dict(near=[0,0,1],far=[0,0,1],lean=0,dip=1,lag=2,phase='护盾复稳',ms=200,strength=1,rise=1,pressure=.2),
    dict(near=[0,6,1],far=[0,-1,1],lean=0,dip=1,lag=1,phase='收诀散盾',ms=120,strength=.4,rise=1,event='guard-end'),
    dict(near=[0,24,.97],far=[0,-2,1],lean=0,dip=2,lag=0,phase='落手',ms=140,strength=0,rise=0),
    dict(near=[0,42,.94],far=[0,-4,1],lean=0,dip=0,lag=0,phase='归势',ms=140,strength=0,rise=0),
]
STARTS = [1 + sum(p['ms'] for p in POSES[:i]) for i in range(len(POSES))]


def body_delta(points, pose):
    x, y = points[:,0], points[:,1]
    w = np.clip((890-y)/520,0,1)
    result = np.column_stack((pose['lean']*w,pose['dip']*w))
    hair = np.clip((746-x)/320,0,1)*np.clip((340-y)/160,0,1)
    result[:,0] -= .6*pose['lag']*hair
    result[:,1] += 1.1*pose['lag']*hair
    hem = np.clip((y-440)/350,0,1)*np.clip((880-y)/65,0,1)
    result[:,0] -= pose['lag']*hem*np.clip(abs(x-770)/300,0,1)*.35
    return result


def deform(points, part, pose):
    if part == 'body':
        return points + body_delta(points,pose)
    if part == 'equipment':
        return points + body_delta(np.array([[680.,410.]]),pose)[0]
    j=JOINTS[part]
    shoulder,elbow=j['shoulder'],j['elbow']
    upper_angle,lower_angle,reach=pose[part]
    offset=body_delta(shoulder[None],pose)[0]
    upper=cast.rotate(points-shoulder,upper_angle)+shoulder+offset
    moved_elbow=cast.rotate((elbow-shoulder)[None],upper_angle)[0]+shoulder+offset
    local=points-elbow
    local[:,0]*=reach
    lower=cast.rotate(local,lower_angle)+moved_elbow
    if part=='near':
        blend=np.clip((points[:,0]-720)/65,0,1)*np.clip((445-points[:,1])/60,0,1)
    else:
        blend=np.clip((922-points[:,0])/65,0,1)*np.clip((points[:,1]-325)/45,0,1)
    return upper*(1-blend[:,None])+lower*blend[:,None]


def selected(point,part):
    if part=='body':
        return not any(cast.inside(point,p) for p in [OLD_NEAR,cast.ARM,cast.SWORD,[(445,345),(610,345),(610,565),(445,565)]])
    if part=='near': return cast.inside(point,NEAR)
    if part=='far': return cast.inside(point,FAR)
    return cast.inside(point,EQUIPMENT)


def make_mesh(part,texture):
    w,h=texture.size
    alpha=np.array(texture.pixels[:],dtype=np.float32).reshape(h,w,4)[:,:,3]
    vertices,faces,lookup=[],[],{}
    step=4
    for y in range(0,h,step):
        for x in range(0,w,step):
            if alpha[h-y-step:h-y,x:x+step].max()<.5 or not selected((x+2,y+2),part):continue
            face=[]
            for key in [(x,y),(x+step,y),(x+step,y+step),(x,y+step)]:
                if key not in lookup:lookup[key]=len(vertices);vertices.append(key)
                face.append(lookup[key])
            faces.append(face)
    pts=np.array(vertices,dtype=float)
    depth={'equipment':-.5,'body':0,'far':1,'near':2}[part]
    z=np.full(len(pts),depth,dtype=float)
    if part in JOINTS:z+=np.clip((pts[:,0]-JOINTS[part]['shoulder'][0])/400,0,1)*.5
    p=(pts-SOURCE_ANCHOR)*SCALE+ANCHOR
    mesh=bpy.data.meshes.new(part)
    mesh.from_pydata([(x,-y,zv) for (x,y),zv in zip(p,z)],[],faces)
    mesh.materials.append(cast.material(texture))
    uv=mesh.uv_layers.new(name='Unchanged source pixels')
    for loop in mesh.loops:
        x,y=vertices[loop.vertex_index];uv.data[loop.index].uv=(x/w,1-y/h)
    obj=bpy.data.objects.new(part,mesh);bpy.context.scene.collection.objects.link(obj)
    obj.shape_key_add(name='Basis')
    for i,pose in enumerate(POSES):
        key=obj.shape_key_add(name=f'S04 {i:02d} {pose["phase"]}')
        coords=(deform(pts,part,pose)-SOURCE_ANCHOR)*SCALE+ANCHOR
        key.data.foreach_set('co',np.column_stack((coords[:,0],-coords[:,1],z)).astype(np.float32).ravel())
        start=STARTS[i]
        for f,v in [(start-1,0),(start,1),(start+pose['ms'],0)]:
            key.value=v;key.keyframe_insert('value',frame=f)
    for layer in obj.data.shape_keys.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for k in curve.keyframe_points:k.interpolation='CONSTANT'
    return obj


def point(p,part,pose):
    return ((deform(np.array([p],dtype=float),part,pose)[0]-SOURCE_ANCHOR)*SCALE+ANCHOR).round(4).tolist()


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);ap.add_argument('--only',default='')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(args.output)
    (out/'sprites').mkdir(parents=True,exist_ok=True);(out/'motion').mkdir(exist_ok=True)
    hashes={str(p.relative_to(ROOT)):cast.sha(p) for p in [BASE,SOURCE,SEAL_SOURCE]}
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
    textures={}
    for name,p in [('base',BASE),('guard',SOURCE),('seal',SEAL_SOURCE)]:
        textures[name]=bpy.data.images.load(str(p));textures[name].pack()
    parts={part:make_mesh(part,textures['base' if part=='body' else 'guard' if part=='equipment' else 'seal']) for part in ['body','far','near','equipment']}
    data=bpy.data.cameras.new('Shared-scale orthographic camera');camera=bpy.data.objects.new('Fixed view',data)
    scene.collection.objects.link(camera);camera.location=(SIZE[0]/2,-SIZE[1]/2,1000)
    data.type='ORTHO';data.ortho_scale=SIZE[0];data.clip_end=2000;scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.use_denoising=False
    scene.cycles.pixel_filter_type='BOX';scene.cycles.filter_width=.01
    scene.render.resolution_x,scene.render.resolution_y=SIZE;scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    scene.render.fps=1000;scene.frame_start=1;scene.frame_end=sum(p['ms'] for p in POSES);scene.frame_set(1)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'motion/s04-guard-mesh.blend'),compress=True)
    chosen={int(x) for x in args.only.split(',') if x} or set(range(len(POSES)))
    frames=[]
    for i,pose in enumerate(POSES):
        frame={'index':i,'phase':pose['phase'],'durationMs':pose['ms'],'body':f'body-{i:03d}.png',
            'equipment':f'equipment-{i:03d}.png','effectBehind':f'effect-behind-{i:03d}.png',
            'effectFront':f'effect-front-{i:03d}.png','palms':[point(JOINTS[p]['palm'],p,pose) for p in ['near','far']],
            'foot':ANCHOR.tolist(),'guardStrength':pose['strength'],'pressure':pose.get('pressure',0),'shieldRise':pose['rise']}
        if 'event' in pose:frame['event']=pose['event']
        frames.append(frame)
        if i not in chosen:continue
        scene.frame_set(STARTS[i])
        for kind in ['body','equipment']:
            for part,obj in parts.items():obj.hide_render=(part=='equipment') if kind=='body' else (part!='equipment')
            scene.render.filepath=str(out/'sprites'/frame[kind]);bpy.ops.render.render(write_still=True)
    m={'kind':'s04-hand-seal-shield-2d-study','actionId':'S04','frameSize':list(SIZE),'sourceHeight':384,
       'frameCount':len(POSES),'fps':12,'timingMode':'per-frame-duration','durationMs':sum(p['ms'] for p in POSES),
       'anchor':ANCHOR.tolist(),'nominalHeight':80,'runtimeReferenceHeight':111,'layerOrder':['effectBehind','equipment','body','effectFront'],
       'holdRange':[5,8],'frames':frames,'sourceSha256':hashes,'poses':POSES,'sourceScale':SCALE,
       'sourceAnchor':SOURCE_ANCHOR.tolist(),'sourceJointAnchors':{p:{k:v.tolist() for k,v in j.items()} for p,j in JOINTS.items()},
       'handRoles':{'right':'chest-level two-finger seal','left':'supporting palm at upper abdomen'},'equipmentState':'sword-sheathed-at-start',
       'sourceBody':'../../cast-study-v1/source/casting-master-v1.png','sourceArms':'../source/seal-master-v1.png',
       'sourceEquipment':'../source/guard-master-v1.png',
       'motionFile':'../motion/s04-guard-mesh.blend','blendFrameRate':1000,'blendPoseFrames':STARTS,
       'alphaMode':{'renderCutoff':.65,'sourcesPreserved':True},'integrationStatus':'offline-art-study'}
    (out/'sprites/manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    assert hashes=={str(p.relative_to(ROOT)):cast.sha(p) for p in [BASE,SOURCE,SEAL_SOURCE]}
    print('GUARD_RENDER_READY '+str(out/'sprites'),flush=True)


if __name__=='__main__':main()
