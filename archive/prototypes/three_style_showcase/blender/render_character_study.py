"""Actual Blender model renders, orthographic front/side/back and close view."""
from pathlib import Path
import bpy, math, sys
from mathutils import Vector

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
out=Path(args[0] if args else '/Volumes/Media/immortal-qa/character-study-20261014/render')
out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
for ob in bpy.data.objects:
    if ob.type=='ARMATURE':
        if ob.animation_data:
            ob.animation_data.action=None
            for track in ob.animation_data.nla_tracks:track.mute=True
        for bone in ob.pose.bones:bone.rotation_quaternion=(1,0,0,0);bone.location=(0,0,0)
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.world.use_nodes=True
background=next((n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND'),None)
if background:
    background.inputs['Color'].default_value=(.45,.47,.48,1)
    background.inputs['Strength'].default_value=.65
scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200)
floor=bpy.context.object;floor.name='Studio floor';floor.location.z=-.004
mat=bpy.data.materials.new('Warm grey studio');mat.diffuse_color=(.30,.31,.30,1);mat.use_nodes=True
bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(.30,.31,.30,1);bs.inputs['Roughness'].default_value=1
floor.data.materials.append(mat)
def light(name,loc,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((0,0,.9))-ob.location).to_track_quat('-Z','Y').to_euler()
light('Key',(-3,-4,5),300,4);light('Fill',(3,-1,3),180,4);light('Edge',(0,3,3),250,3)
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO'
def render(name,position,target,scale,w,h):
    camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
    scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
for name,p in [('front',(0,-5,.88)),('side',(5,0,.88)),('back',(0,5,.88))]:render(name,p,(0,0,.88),2.02,640,960)
render('portrait',(1.4,-3,1.57),(0,0,1.50),.60,960,960)
render('hero',(2.5,-5,2.15),(0,0,.91),2.08,960,960)
subjects=[o for o in scene.objects if o.type=='MESH' and o!=floor]
graph=bpy.context.evaluated_depsgraph_get()
for obj in subjects:
    evaluated=obj.evaluated_get(graph)
    mesh=bpy.data.meshes.new_from_object(evaluated)
    for x,angle in [(-1.02,0),(0,math.pi/2),(1.02,math.pi)]:
        copy=bpy.data.objects.new('Orthographic study '+str(angle),mesh)
        scene.collection.objects.link(copy);copy.location=(x,0,0);copy.rotation_euler.z=angle
    obj.hide_render=True
render('model-three-views',(0,-6,.90),(0,0,.90),3.40,1536,1024)
