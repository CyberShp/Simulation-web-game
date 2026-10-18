"""Render a single-view textured 2D mesh driven by projected Shen Yan walk joints.

Blender --background --python project_pixel_walk.py -- --output QA/pixel-mesh
The original RGBA texture and motion blend are read-only inputs. Layer masks,
2D landmark estimates and source-projection trajectories are recorded in QA.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

REPO_ROOT=Path(__file__).resolve().parents[3]
DEFAULT_IMAGE=str(REPO_ROOT/'assets/characters/shen-yan/pixel-walk-study-v1/source/pixel-identity-reference.png')
DEFAULT_MOTION=str(REPO_ROOT/'assets/characters/shen-yan/walk-study-v1/motion/shen-yan-walk.blend')
WIDTH,HEIGHT=218,335
PIVOT=np.array([134.,329.])
CANVAS_PIVOT=np.array([256.,460.])
DURATION=41/30
WORLD_HEIGHT=1.3340018207381945
SOURCE_HEIGHT=323
MOTION_GAIN=.6
BONES=['Hips','Spine2','Neck','Head','RightShoulder','RightArm','RightForeArm','RightHand','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightUpLeg','RightLeg','RightFoot','RightToeBase','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase']
# Coordinates refer to visible source pixels; covered hip/knee anchors are estimates.
ANCHORS={'head':[139,82],'hips':[133,170],
 'right_shoulder':[101,94],'right_elbow':[78,144],'right_hand':[68,174],
 'left_shoulder':[164,99],'left_elbow':[184,137],'left_hand':[194,161],
 'right_ankle':[87,309],'left_ankle':[176,298]}
# Masks are mesh-face groups in source UV coordinates, not edited image files.
SWORD=[(42,190),(55,163),(82,163),(86,181),(80,199),(70,208),(26,290),(19,305),(0,310),(0,275),(35,205)]
RIGHT_LEG=[(88,284),(107,285),(113,297),(115,335),(62,335),(62,305),(78,297)]
LEFT_LEG=[(169,282),(187,282),(194,295),(218,303),(218,335),(155,335),(155,311),(162,302)]


def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def inside(p,poly):
    x,y=p; yes=False
    for a,b in zip(poly,poly[1:]+poly[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:yes=not yes
    return yes


def read_motion(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig=bpy.data.objects['ShenYan_Rig']
    yaw,elev=math.radians(40),math.radians(25)
    direction=Vector((-math.sin(yaw)*math.cos(elev),-math.cos(yaw)*math.cos(elev),math.sin(elev)))
    right=Vector((math.cos(yaw),-math.sin(yaw),0));up=direction.cross(right)
    ppu=SOURCE_HEIGHT/(WORLD_HEIGHT*math.cos(elev))
    rows=[]
    for i in range(17):
        t=1+41*i/16
        bpy.context.scene.frame_set(math.floor(t),subframe=t%1)
        row={}
        for name in BONES:
            b=rig.pose.bones[name]
            point=rig.matrix_world@b.head
            tail=rig.matrix_world@b.tail
            row[name]=[point.dot(right)*ppu,-point.dot(up)*ppu,point.dot(direction)]
            row[name+'_tail']=[tail.dot(right)*ppu,-tail.dot(up)*ppu,tail.dot(direction)]
        rows.append(row)
    means={n:np.array([r[n][:2] for r in rows[:16]]).mean(axis=0) for n in rows[0]}
    return rows,means,ppu


def rotate(points,angle):
    c,s=math.cos(angle),math.sin(angle)
    return points@np.array([[c,-s],[s,c]]).T


def angular_change(row,means,name):
    a=np.array(row[name+'_tail'][:2])-row[name][:2]
    b=means[name+'_tail']-means[name]
    d=math.atan2(a[1],a[0])-math.atan2(b[1],b[0])
    return math.atan2(math.sin(d),math.cos(d))*MOTION_GAIN


def deform(points,part,row,means):
    delta=lambda n:(np.array(row[n][:2])-means[n])*MOTION_GAIN
    if part=='sword':
        anchor=np.array(ANCHORS['right_hand'])
        return rotate(points-anchor,angular_change(row,means,'RightHand'))+anchor+delta('RightHand')
    if part in ['right_leg','left_leg']:
        side='Right' if part=='right_leg' else 'Left'
        anchor=np.array(ANCHORS[part.replace('_leg','_ankle')])
        ankle_delta=delta(side+'Foot')
        angle=angular_change(row,means,side+'Foot')
        rigid=rotate(points-anchor,angle)+anchor+ankle_delta
        # Visible pant top stays beneath the robe; the boot remains rigid.
        top=282
        blend=np.clip((points[:,1]-top)/23,0,1)
        hipdelta=delta('Hips')+.25*delta(side+'Leg')
        return (points+hipdelta)*(1-blend[:,None])+rigid*blend[:,None]
    out=points.copy()
    for i,p in enumerate(points):
        x,y=p
        hip=delta('Hips')
        if y<86 or (x<87 and y<112):
            out[i]=rotate((p-np.array(ANCHORS['head']))[None],angular_change(row,means,'Head'))[0]+ANCHORS['head']+delta('Head')
        elif y<165:
            # Continuous upper mesh keeps the sleeve/torso joins covered.
            if x<108 and y>90:
                t=np.clip((y-94)/50,0,1)
                d=(1-t)*delta('RightArm')+t*delta('RightForeArm')
                if y>144:
                    t=np.clip((y-144)/22,0,1);d=(1-t)*delta('RightForeArm')+t*delta('RightHand')
                edge=np.clip((113-x)/18,0,1)
                out[i]=p+edge*d+(1-edge)*delta('Spine2')
            elif x>160 and y>90:
                t=np.clip((y-99)/38,0,1);d=(1-t)*delta('LeftArm')+t*delta('LeftForeArm')
                if y>137:
                    t=np.clip((y-137)/24,0,1);d=(1-t)*delta('LeftForeArm')+t*delta('LeftHand')
                edge=np.clip((x-157)/20,0,1)
                out[i]=p+edge*d+(1-edge)*delta('Spine2')
            else:
                t=np.clip((y-85)/80,0,1);out[i]=p+(1-t)*delta('Head')+t*hip
        elif x>181 and y<196:
            out[i]=p+delta('LeftHand')
        else:
            # One continuous front-robe mesh, with limited lower hem follow.
            t=np.clip((y-175)/110,0,1)**1.5
            side=np.clip((x-110)/65,0,1)
            leg=(1-side)*delta('RightLeg')+side*delta('LeftLeg')
            out[i]=p+hip+t*.18*(leg-hip)
    return out


def make_material(image):
    mat=bpy.data.materials.new('Original pixel colors')
    mat.use_nodes=True
    n=mat.node_tree.nodes;n.clear();l=mat.node_tree.links
    tex=n.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Closest';tex.extension='CLIP'
    em=n.new('ShaderNodeEmission');em.inputs['Strength'].default_value=1
    clear=n.new('ShaderNodeBsdfTransparent');mix=n.new('ShaderNodeMixShader');out=n.new('ShaderNodeOutputMaterial')
    l.new(tex.outputs['Color'],em.inputs['Color']);l.new(tex.outputs['Alpha'],mix.inputs[0]);l.new(clear.outputs[0],mix.inputs[1]);l.new(em.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs[0])
    return mat


def make_layer(part,material):
    vertices=[];uvs=[];faces=[];indices={}
    step=2
    for y in range(0,HEIGHT,step):
        for x in range(0,WIDTH,step):
            center=(x+1,y+1)
            sword=inside(center,SWORD);rleg=inside(center,RIGHT_LEG);lleg=inside(center,LEFT_LEG)
            accept={'sword':sword,'right_leg':rleg,'left_leg':lleg,'body':not(sword or rleg or lleg)}[part]
            if not accept:continue
            cell=[]
            for key in [(x,y),(min(x+step,WIDTH),y),(min(x+step,WIDTH),min(y+step,HEIGHT)),(x,min(y+step,HEIGHT))]:
                if key not in indices:
                    indices[key]=len(vertices);vertices.append(key);uvs.append((key[0]/WIDTH,1-key[1]/HEIGHT))
                cell.append(indices[key])
            faces.append(cell)
    mesh=bpy.data.meshes.new(part)
    coords=[(x-PIVOT[0],PIVOT[1]-y,0) for x,y in vertices]
    mesh.from_pydata(coords,[],faces);mesh.materials.append(material)
    uv=mesh.uv_layers.new(name='Original pixel UV')
    for loop in mesh.loops:uv.data[loop.index].uv=uvs[loop.vertex_index]
    obj=bpy.data.objects.new(part,mesh);bpy.context.scene.collection.objects.link(obj)
    obj.shape_key_add(name='Basis')
    return obj,np.array(vertices,dtype=float)


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--image',default=DEFAULT_IMAGE);ap.add_argument('--motion',default=DEFAULT_MOTION);ap.add_argument('--output',required=True);ap.add_argument('--only',type=int)
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    before={'image':sha(args.image),'motion':sha(args.motion)}
    rows,means,ppu=read_motion(args.motion)
    bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene
    image=bpy.data.images.load(str(args.image),check_existing=True);image.pack();mat=make_material(image)
    layers={p:make_layer(p,mat) for p in ['right_leg','left_leg','body','sword']}
    trajectory=[]
    for frame,row in enumerate(rows):
        for name,(obj,points) in layers.items():
            p=deform(points,name,row,means)
            key=obj.shape_key_add(name=f'Walk {frame:02d}')
            # Front robe covers both upper leg seams. Sword stays in front.
            depth={'body':10,'sword':20,'right_leg':1,'left_leg':2}[name]
            if name.endswith('_leg'):
                side='Right' if name.startswith('right') else 'Left'
                depth=2+row[side+'Foot'][2]
            values=np.column_stack((p[:,0]-PIVOT[0],PIVOT[1]-p[:,1],np.full(len(p),depth))).astype(np.float32)
            key.data.foreach_set('co',values.ravel())
            for f,v in [(max(1,frame),0),(frame+1,1),(frame+2,0)]:key.value=v;key.keyframe_insert('value',frame=f)
        trajectory.append({'index':frame,'source_frame':1+41*frame/16,'projected_joints':row})
    for obj,_ in layers.values():
        for layer in obj.data.shape_keys.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for k in curve.keyframe_points:k.interpolation='LINEAR'
    camera_data=bpy.data.cameras.new('Pixel camera');camera=bpy.data.objects.new('Pixel camera',camera_data);s.collection.objects.link(camera)
    camera.location=(256-CANVAS_PIVOT[0],CANVAS_PIVOT[1]-256,1000);camera_data.type='ORTHO';camera_data.ortho_scale=512;s.camera=camera
    s.render.engine='CYCLES';s.cycles.samples=1;s.cycles.use_denoising=False;s.cycles.pixel_filter_type='BOX';s.cycles.filter_width=.01
    s.render.resolution_x=s.render.resolution_y=512;s.render.resolution_percentage=100;s.render.film_transparent=True
    s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.view_settings.view_transform='Standard';s.view_settings.look='None'
    s.render.fps=30;s.render.fps_base=30/(16/DURATION);s.frame_start=1;s.frame_end=16
    s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(out/'pixel-walk-mesh.blend'),compress=True)
    frames=[]
    for i in range(16):
        filename=f'walk-{i:03d}.png';frames.append(filename)
        if args.only is not None and args.only!=i:continue
        s.frame_set(i+1);s.render.filepath=str(out/filename);bpy.ops.render.render(write_still=True)
    manifest={'kind':'projected-motion-textured-2d-mesh','frames':frames,'fps':16/DURATION,'frameSize':[512,512],'pivot':CANVAS_PIVOT.tolist(),'sourceHeight':323,'nominalHeight':111,'duration':DURATION,'strideWorld':1.0895218881790494*MOTION_GAIN,'motionAmplitudeScale':MOTION_GAIN,'worldHeight':WORLD_HEIGHT,'forwardScreenPerWorld':[math.sin(math.radians(40))*ppu,math.cos(math.radians(40))*math.sin(math.radians(25))*ppu],'camera':{'projection':'orthographic-joint-projection-onto-image-plane','yawDegrees':40,'elevationDegrees':25,'pixelsPerWorldUnit':ppu,'fixedForEveryFrame':True},'inputTexture':args.image,'inputMotion':args.motion,'sourceHashes':before,'sourceFrames':[1+41*i/16 for i in range(16)],'anatomicalMapping':{'screenLeftSword':'RightHand','screenLeftLeg':'RightFoot','screenRightLeg':'LeftFoot'},'meshRegions':{'sword':SWORD,'rightLeg':RIGHT_LEG,'leftLeg':LEFT_LEG},'anchors':ANCHORS,'method':'Original RGBA sampled with emission and closest filtering. Projected joint displacement relative to cycle mean drives four source-UV mesh regions. Sword/hand use one rigid transform; front robe has continuous lower-leg blending.','limitations':['Covered thighs and knees have no independent source texture; visible pant regions stretch to keep boot attachments covered.','One fixed-view 2D mesh study; occluded body surfaces and additional views require separate artwork.']}
    assert before=={'image':sha(args.image),'motion':sha(args.motion)}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(out/'projected-motion.json').write_text(json.dumps(trajectory,indent=2)+'\n')
    print('PIXEL_MESH_READY '+str(out),flush=True)

if __name__=='__main__':main()
