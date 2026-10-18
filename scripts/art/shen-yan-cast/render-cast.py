"""Render the S01 fixed-view textured 2D rig in Blender.

The source PNG remains byte-for-byte unchanged. Mesh groups separate the casting
arm and rigid sword, while the planted boots share one fixed image-space anchor.
Run: Blender -b --python render-cast.py -- --output ASSET_DIR [--only 0,5,11]
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'assets/characters/shen-yan/cast-study-v1/source/casting-master-v1.png'
SIZE = (640, 512)
ANCHOR = np.array([255., 456.])
SOURCE_ANCHOR = np.array([765., 993.])
SCALE = 384 / 978
SHOULDER = np.array([864., 259.])
ELBOW = np.array([1027., 245.])
FINGER = np.array([1254., 194.])
GRIP = np.array([492., 530.])
ARM = [(854,207),(900,210),(976,184),(1280,160),(1280,280),
       (1080,300),(1068,400),(990,400),(904,339),(854,324)]
SWORD = [(438,518),(490,512),(540,546),(540,590),(504,592),
         (245,906),(200,906),(200,860),(430,560)]
# Degrees are changes from the extended-arm master; length is projected reach.
POSES = [
    dict(upper=68, lower=-77, reach=.78, lean=0, dip=0, lag=0, phase='起势', ms=130),
    dict(upper=76, lower=-83, reach=.78, lean=-5, dip=4, lag=-1, phase='收诀', ms=100),
    dict(upper=82, lower=-84, reach=.80, lean=-9, dip=8, lag=-3, phase='蓄势', ms=110),
    dict(upper=52, lower=-55, reach=.88, lean=-4, dip=5, lag=-5, phase='开肘', ms=100),
    dict(upper=20, lower=-18, reach=.96, lean=6, dip=1, lag=-2, phase='送臂', ms=60),
    dict(upper=0, lower=0, reach=1, lean=15, dip=0, lag=4, phase='释放', ms=60),
    dict(upper=-2, lower=2, reach=1, lean=18, dip=1, lag=8, phase='随势', ms=90),
    dict(upper=10, lower=-12, reach=.97, lean=12, dip=2, lag=9, phase='卸力', ms=100),
    dict(upper=33, lower=-35, reach=.90, lean=7, dip=2, lag=7, phase='收臂', ms=110),
    dict(upper=54, lower=-60, reach=.83, lean=3, dip=1, lag=3, phase='回诀', ms=120),
    dict(upper=66, lower=-75, reach=.79, lean=0, dip=0, lag=1, phase='归位', ms=120),
    dict(upper=68, lower=-77, reach=.78, lean=0, dip=0, lag=0, phase='收势', ms=180),
]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def inside(point, polygon):
    x, y = point
    hit = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            hit = not hit
    return hit


def rotate(p, degrees):
    a = math.radians(degrees)
    return p @ np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]).T


def body_delta(points, pose):
    x, y = points[:, 0], points[:, 1]
    # The head/face translates rigidly; the boot region remains exactly fixed.
    w = np.clip((890-y)/520, 0, 1)
    delta = np.column_stack((pose['lean']*w, pose['dip']*w))
    hair = np.clip((746-x)/320, 0, 1) * np.clip((340-y)/160, 0, 1)
    delta[:, 0] += pose['lag'] * hair * -.6
    delta[:, 1] += pose['lag'] * hair * 1.2
    hem = np.clip((y-440)/350, 0, 1) * np.clip((880-y)/65, 0, 1)
    side = np.clip(np.abs(x-770)/300, 0, 1)
    delta[:, 0] += pose['lag'] * hem * side * -.45
    return delta


def deform(points, part, pose):
    if part == 'sword':
        return points + body_delta(GRIP[None], pose)[0]
    if part == 'body':
        result = points + body_delta(points, pose)
        # The gripping fingers/bracer and sword use the very same translation.
        grip_region = (points[:, 0] < 590) & (points[:, 1] > 460) & (points[:, 1] < 590)
        result[grip_region] = points[grip_region] + body_delta(GRIP[None], pose)[0]
        return result
    offset = body_delta(SHOULDER[None], pose)[0]
    upper = rotate(points-SHOULDER, pose['upper']) + SHOULDER + offset
    moved_elbow = rotate((ELBOW-SHOULDER)[None], pose['upper'])[0] + SHOULDER + offset
    local = points-ELBOW
    local[:, 0] *= pose['reach']
    lower = rotate(local, pose['lower']) + moved_elbow
    # Blend across the sleeve cuff; its hanging flap follows the upper sleeve.
    blend = np.clip((points[:, 0]-1006)/43, 0, 1)
    blend *= np.clip((302-points[:, 1])/32, 0, 1)
    return upper*(1-blend[:, None]) + lower*blend[:, None]


def output_point(point, part, pose):
    p = deform(np.array(point, dtype=float)[None], part, pose)[0]
    return ((p-SOURCE_ANCHOR)*SCALE+ANCHOR).round(4).tolist()


def material(image):
    mat = bpy.data.materials.new('Pixel texture emission')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    links = mat.node_tree.links
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Closest'
    tex.extension = 'CLIP'
    emission = nodes.new('ShaderNodeEmission')
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    cutout = nodes.new('ShaderNodeMath')
    cutout.operation = 'GREATER_THAN'
    cutout.inputs[1].default_value = .65
    mix = nodes.new('ShaderNodeMixShader')
    out = nodes.new('ShaderNodeOutputMaterial')
    links.new(tex.outputs['Color'], emission.inputs['Color'])
    links.new(tex.outputs['Alpha'], cutout.inputs[0])
    links.new(cutout.outputs[0], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs[0])
    return mat


def make_mesh(part, mat, image, alpha):
    width, height = image.size
    vertices, faces, indexes = [], [], {}
    step = 4
    for y in range(0, height, step):
        for x in range(0, width, step):
            if alpha[max(0,height-y-step):height-y,x:x+step].max() < .5:
                continue
            center = (x+step/2, y+step/2)
            group = 'arm' if inside(center, ARM) else 'sword' if inside(center, SWORD) else 'body'
            if group != part:
                continue
            face = []
            for key in [(x,y),(x+step,y),(x+step,y+step),(x,y+step)]:
                if key not in indexes:
                    indexes[key] = len(vertices)
                    vertices.append(key)
                face.append(indexes[key])
            faces.append(face)
    pts = np.array(vertices,dtype=float)
    screen = (pts-SOURCE_ANCHOR)*SCALE+ANCHOR
    depth = {'body':0, 'arm':1, 'sword':2}[part]
    # A shallow depth gradient gives the folded forearm a stable draw order over
    # its sleeve; the orthographic camera preserves the image-space silhouette.
    depths = np.full(len(pts), depth, dtype=float)
    if part == 'arm':
        depths += np.clip((pts[:,0]-854)/420,0,1)*.5
    mesh = bpy.data.meshes.new(part)
    mesh.from_pydata([(x,-y,z) for (x,y),z in zip(screen,depths)], [], faces)
    mesh.materials.append(mat)
    uv = mesh.uv_layers.new(name='Source pixels')
    for loop in mesh.loops:
        x,y = vertices[loop.vertex_index]
        uv.data[loop.index].uv = (x/width,1-y/height)
    obj = bpy.data.objects.new(part,mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.shape_key_add(name='Basis')
    for i, pose in enumerate(POSES):
        key = obj.shape_key_add(name=f'S01 {i:02d} {pose["phase"]}')
        p = (deform(pts,part,pose)-SOURCE_ANCHOR)*SCALE+ANCHOR
        coords = np.column_stack((p[:,0],-p[:,1],depths)).astype(np.float32)
        key.data.foreach_set('co',coords.ravel())
        for f,v in [(max(0,i),0),(i+1,1),(i+2,0)]:
            key.value=v
            key.keyframe_insert('value',frame=f)
    for layer in obj.data.shape_keys.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for k in curve.keyframe_points:
                        k.interpolation='CONSTANT'
    return obj


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--output',required=True)
    ap.add_argument('--only',default='')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    out=Path(args.output)
    sprites=out/'sprites'
    motion=out/'motion'
    sprites.mkdir(parents=True,exist_ok=True)
    motion.mkdir(parents=True,exist_ok=True)
    original_hash=sha(SOURCE)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    texture=bpy.data.images.load(str(SOURCE))
    texture.pack()
    pixels=np.array(texture.pixels[:],dtype=np.float32).reshape(texture.size[1],texture.size[0],4)
    mat=material(texture)
    layers={p:make_mesh(p,mat,texture,pixels[:,:,3]) for p in ['body','arm','sword']}
    camera_data=bpy.data.cameras.new('Fixed pixel camera')
    camera=bpy.data.objects.new('Fixed pixel camera',camera_data)
    scene.collection.objects.link(camera)
    camera.location=(SIZE[0]/2,-SIZE[1]/2,1000)
    camera_data.type='ORTHO'
    camera_data.clip_end=2000
    camera_data.ortho_scale=SIZE[0]
    scene.camera=camera
    scene.render.engine='CYCLES'
    scene.cycles.samples=1
    scene.cycles.use_denoising=False
    scene.cycles.pixel_filter_type='BOX'
    scene.cycles.filter_width=.01
    scene.render.resolution_x,scene.render.resolution_y=SIZE
    scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='Standard'
    scene.view_settings.look='None'
    scene.render.fps=12
    scene.frame_start=1
    scene.frame_end=len(POSES)
    scene.frame_set(1)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(motion/'s01-cast-mesh.blend'),compress=True)
    chosen={int(x) for x in args.only.split(',') if x} or set(range(len(POSES)))
    frames=[]
    for i,pose in enumerate(POSES):
        row={'body':f'body-{i:03d}.png','weapon':f'weapon-{i:03d}.png',
             'effect':f'effect-{i:03d}.png','durationMs':pose['ms'],'phase':pose['phase'],
             'finger':output_point(FINGER,'arm',pose),'grip':output_point(GRIP,'body',pose)}
        if i==5:row['event']='release'
        frames.append(row)
        if i not in chosen:continue
        scene.frame_set(i+1)
        for kind in ['body','weapon']:
            for part,obj in layers.items():
                obj.hide_render=(part=='sword') if kind=='body' else (part!='sword')
            scene.render.filepath=str(sprites/row[kind])
            bpy.ops.render.render(write_still=True)
    manifest={'kind':'s01-fixed-view-textured-2d-animation-study','frameCount':len(POSES),'fps':12,
        'frameSize':list(SIZE),'sourceHeight':384,'anchor':ANCHOR.tolist(),'nominalHeight':111,
        'layerOrder':['weapon','body','effect'],'frames':frames,
        'durationMs':sum(p['ms'] for p in POSES),'inputTexture':'../source/casting-master-v1.png',
        'sourceSha256':original_hash,'motionFile':'../motion/s01-cast-mesh.blend',
        'direction':'fixed-front-right','handRoles':{'right':'sword','left':'casting'},
        'alphaMode':{'renderCutoff':.65,'sourcePreserved':True},
        'footAnchors':[[510,980],[1000,930]],'sourceScale':SCALE,
        'sourceAnchor':SOURCE_ANCHOR.tolist(),'sourceJointAnchors':{'shoulder':SHOULDER.tolist(),'elbow':ELBOW.tolist(),'grip':GRIP.tolist()},
        'poses':POSES,'integrationStatus':'offline-art-study'}
    (sprites/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    assert sha(SOURCE)==original_hash
    print('CAST_RENDER_READY '+str(sprites),flush=True)


if __name__=='__main__':
    main()
