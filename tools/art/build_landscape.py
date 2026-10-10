"""Author the mountain courtyard landscape as a reproducible glTF mesh asset."""
import bpy
import math
import random
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'godot/art/assets'
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(10309)
shape_rng = random.Random(10310)
GROUP = 'LandscapeDetails'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, rgb, roughness=.91):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if p is None:
        p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        output=m.node_tree.nodes.new('ShaderNodeOutputMaterial')
        m.node_tree.links.new(p.outputs['BSDF'],output.inputs['Surface'])
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = roughness
    return m

stone = [material('Warm limestone %d' % i, (.39+i*.024, .405+i*.023, .35+i*.020)) for i in range(5)]
grass = [material('Mountain meadow %d' % i, (.22+i*.023, .30+i*.022, .125+i*.012)) for i in range(5)]
earth = [material('Courtyard earth %d' % i, (.40+i*.022, .335+i*.020, .225+i*.016)) for i in range(4)]
wood = material('Weathered timber', (.265, .16, .079))
wood_light = material('Timber endgrain', (.38, .26, .13))
leaves = [material('Pine foliage %d' % i, (.09+i*.035, .20+i*.045, .085+i*.010)) for i in range(5)]
bamboo = material('Bamboo stems', (.34, .40, .15))
soil = material('Herb bed soil', (.20, .16, .09))
flower = material('Small ivory blossoms', (.85, .80, .57))
pine_leaves = [material('Mountain pine needle shade %d' % i,
              (.047+i*.025,.105+i*.033,.039+i*.009)) for i in range(5)]
rock_mats = [material('Mountain grey stone %d' % i,
             (.205+i*.034,.235+i*.030,.220+i*.022)) for i in range(4)]
moss = material('Rock moss',(.15,.21,.071))

def point(x, z, h):
    return Vector((x, -z, h))

def mesh_object(name, verts, faces, mats, indices=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj['asset_group']=GROUP
    bpy.context.collection.objects.link(obj)
    for mat in mats:
        mesh.materials.append(mat)
    for i, poly in enumerate(mesh.polygons):
        poly.material_index = indices[i] if indices else 0
        poly.use_smooth = smooth
    return obj

def box(name, x, z, h, sx, sz, sh, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(x,z,h))
    obj=bpy.context.object
    obj.name=name
    obj['asset_group']=GROUP
    obj.scale=(sx,sz,sh)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Soft worn corners','BEVEL')
        mod.width=bevel
        mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        normal=obj.modifiers.new('Corner normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=normal.name)
    return obj

def branch(name, a, b, radius, mat, taper=.72, sides=7):
    a,b=Vector(a),Vector(b)
    d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius, radius2=radius*taper, depth=d.length, location=(a+b)/2)
    obj=bpy.context.object
    obj.name=name
    obj['asset_group']=GROUP
    obj.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons: poly.use_smooth=True
    return obj

def rock(x,z,h,size, name='Mountain rock'):
    # Consume the original layout generator's shape draws, so later placements
    # retain their recorded seed sequence while shape detail has its own seed.
    for _ in range(12): rng.uniform(.78,1.18)
    for _ in range(20): rng.randrange(5)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=point(x,z,h))
    obj=bpy.context.object
    obj.name=name
    obj['asset_group']=GROUP
    obj['rock_surface']=True
    lean_x=shape_rng.uniform(-.20,.20)
    lean_y=shape_rng.uniform(-.17,.17)
    for v in obj.data.vertices:
        q=v.co.copy()
        radial=1+.11*math.sin(q.x*6.1+q.z*3.2)+shape_rng.uniform(-.045,.045)
        q.x=(q.x*radial+q.z*lean_x)*size[0]
        q.y=(q.y*radial+q.z*lean_y)*size[1]
        # Broad fracture planes alternate with worn convex stone surfaces.
        q.z=min(q.z,.78+.10*q.x/max(.1,size[0]))
        q.z=max(q.z,-.74)
        q.z*=size[2]
        v.co=q
    for mat in rock_mats: obj.data.materials.append(mat)
    obj.data.update()
    for p in obj.data.polygons:
        zshade=max(0,min(3,int((p.normal.z+1)*1.65)))
        p.material_index=zshade
    bevel=obj.modifiers.new('Weathered edges','BEVEL')
    bevel.width=.035*min(size)
    bevel.segments=1
    bevel.angle_limit=.36
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return obj

def tuft(x,z,h,scale=.3, mat=None):
    verts=[]
    faces=[]
    for j in range(6):
        ang=j*math.tau/6+rng.random()*.3
        length=scale*rng.uniform(.65,1.4)
        direction=Vector((math.cos(ang), math.sin(ang),0))
        tangent=Vector((-direction.y,direction.x,0))*length*.16
        base=point(x,z,h)
        mid=base+direction*length*.45+Vector((0,0,length*.52))
        end=base+direction*length+Vector((0,0,length*.4))
        n=len(verts)
        verts.extend([base,mid-tangent,mid+Vector((0,0,.025)),mid+tangent,end])
        faces.extend([(n,n+1,n+2),(n,n+2,n+3),(n+1,n+4,n+2),(n+2,n+4,n+3)])
    return mesh_object('Lanceolate leaves',verts,faces,[mat or rng.choice(leaves[2:])])

def canopy(x,z,h,sx,sz,sh):
    for _ in range(13*46): rng.random()
    # Each branch carries an asymmetric horizontal crown. The outer ring is
    # broken by projecting needle sprays; no image planes are used.
    for j in range(7):
        a=j*2.399
        rr=0 if j==0 else shape_rng.uniform(.36,.82)
        cx=x+math.cos(a)*sx*rr
        cz=z+math.sin(a)*sz*rr
        ch=h+shape_rng.uniform(-.14,.10)
        rx=sx*shape_rng.uniform(.43,.64)
        rz=sz*shape_rng.uniform(.36,.56)
        height=sh*shape_rng.uniform(.28,.43)
        n=14
        verts=[]
        phase=shape_rng.uniform(0,math.tau)
        ring=[]
        for i in range(n):
            t=math.tau*i/n+phase
            radius=shape_rng.uniform(.81,1.16)
            ring.append((math.cos(t)*rx*radius,math.sin(t)*rz*radius))
        for scale,dh in [(.62,-height*.57),(1,0),(.65,height)]:
            for dx,dz in ring:
                verts.append(point(cx+dx*scale,cz+dz*scale,ch+dh+shape_rng.uniform(-.025,.025)))
        verts.extend([point(cx,cz,ch+height*1.15),point(cx,cz,ch-height*.72)])
        faces=[];idx=[]
        for i in range(n):
            k=(i+1)%n
            faces += [(i,k,n+k,n+i),(n+i,n+k,2*n+k,2*n+i),(2*n+i,2*n+k,3*n),(i,3*n+1,k)]
            idx += [0,shape_rng.randrange(1,3),shape_rng.randrange(2,5),0]
        mesh_object('Layered pine needle crown',verts,[tuple(reversed(f)) for f in faces],pine_leaves,idx,False)
        # Fine, folded lanceolate sprays form a readable needle silhouette.
        spray_v=[];spray_f=[];spray_i=[]
        for k in range(14):
            theta=math.tau*k/14+phase
            bx=cx+math.cos(theta)*rx*.8
            bz=cz+math.sin(theta)*rz*.8
            for s in (-1,0,1):
                angle=theta+s*.25
                length=shape_rng.uniform(.14,.31)*sx
                direction=Vector((math.cos(angle),-math.sin(angle),0))
                across=Vector((-direction.y,direction.x,0))*length*.13
                base=point(bx,bz,ch+height*.32)
                mid=base+direction*length*.5+Vector((0,0,.027))
                tip=base+direction*length+Vector((0,0,shape_rng.uniform(-.04,.07)))
                q=len(spray_v)
                spray_v.extend([base,mid-across,mid+Vector((0,0,.035)),mid+across,tip])
                spray_f.extend([(q,q+1,q+2),(q,q+2,q+3),(q+1,q+4,q+2),(q+2,q+4,q+3)])
                spray_i.extend([shape_rng.randrange(1,5)]*4)
        mesh_object('Projecting pine needle sprays',spray_v,spray_f,pine_leaves,spray_i)

def curved_branch(name, points, radius, taper=.18, sides=7):
    verts=[];faces=[]
    for j,p in enumerate(points):
        tangent=(Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])).normalized()
        ref=Vector((0,0,1)) if abs(tangent.z)<.95 else Vector((1,0,0))
        a=tangent.cross(ref).normalized();b=tangent.cross(a).normalized()
        r=radius*(1-(1-taper)*j/(len(points)-1))
        for k in range(sides):
            verts.append(Vector(p)+r*(a*math.cos(k*math.tau/sides)+b*math.sin(k*math.tau/sides)))
    for j in range(len(points)-1):
        for k in range(sides):
            faces.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
    faces += [tuple(reversed(range(sides))),tuple((len(points)-1)*sides+k for k in range(sides))]
    return mesh_object(name,verts,faces,[wood],smooth=True)

def pine(x,z,height, spread=1):
    nodes=[point(x,z,0),point(x+.2,z-.08,height*.37),point(x-.12,z+.18,height*.72),point(x+.22,z,height)]
    curved_branch('Bent mountain pine trunk',nodes,.24*spread,.29,9)
    for angle in (0,1.9,3.5,4.9):
        a=point(x,z,.25);b=point(x+math.cos(angle)*.58*spread,z+math.sin(angle)*.58*spread,.015)
        curved_branch('Pine exposed root',[a,(a+b)*.5+Vector((0,0,.05)),b],.11*spread,.05,6)
    for j in range(6):
        a=j*2.3
        level=height*(.47+j*.068)
        r=(1.95-j*.13)*spread
        p=point(x,z,level-.35)
        q=point(x+math.cos(a)*r,z+math.sin(a)*r,level+.15)
        delta=q-p
        curved_branch('Outstretched pine branch',[p,p+delta*.35+Vector((0,0,-.15)),p+delta*.7+Vector((0,0,-.13)),q],.095*spread,.15)
        fork=q+Vector((math.cos(a+.8)*.5*spread,math.sin(a+.8)*.5*spread,.14))
        curved_branch('Pine branch fork',[p+delta*.55,p+delta*.80+Vector((0,0,.06)),fork],.036*spread,.12,6)
        canopy(q.x,-q.y,q.z+.12,1.25*spread,1.0*spread,.40*spread)
    canopy(x+.22,z,height,1.05*spread,.9*spread,.38*spread)

def ground_height(x,z):
    if x < -9.0: return -.78 + .10*math.sin(z*.7)+.08*math.cos(x*2)
    if z < -9.6: return min(2.6,(-z-9.6)*.46)+.13*math.sin(x*.6)
    return -.07+.027*math.sin(x*.9)*math.sin(z*.7)

def ground_colour(x,z):
    """Continuous pigments in world space, shared by every adjacent face."""
    courtyard=min(6.8-abs(x),z+1.5,6-z)
    path=min(2.6-abs(x-.4*math.sin(z*.4)),z)
    distance=max(courtyard,path)
    blend=max(0,min(1,(distance+.18)/.36))
    blend=blend*blend*(3-2*blend)
    broad=.048*math.sin(x*.31+z*.08)*math.sin(z*.28-x*.13)
    fine=.006*math.sin(x*2.1+z*1.7)*math.sin(z*1.37-x*.71)
    light=1+broad+fine
    meadow=(.266,.344,.148)
    path_earth=(.437,.368,.249)
    return tuple((meadow[k]*(1-blend)+path_earth[k]*blend)*light for k in range(3))+(1,)

def flagstone(x,z,h,sx,sz,mat):
    # Three rings give each slab worn chamfers and individually chipped corners.
    cut=shape_rng.uniform(.085,.19)
    outline=[(-.5+cut,-.5),(.5-cut,-.5),(.5,-.5+cut),(.5,.5-cut),
             (.5-cut,.5),(-.5+cut,.5),(-.5,.5-cut),(-.5,-.5+cut)]
    outline=[(a*sx*shape_rng.uniform(.97,1.04),b*sz*shape_rng.uniform(.95,1.05)) for a,b in outline]
    verts=[]
    for scale,dh in [(.90,-.0525),(1,.027),(.925,.0525)]:
        verts.extend(point(a*scale,b*scale,dh) for a,b in outline)
    faces=[tuple(reversed(range(8))),tuple(range(16,24))]
    for j in range(2):
        for i in range(8):
            faces.append((j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i))
    ob=mesh_object('Weathered courtyard flagstone',verts,faces,[mat])
    ob.location=point(x,z,h)
    return ob

# One gently varying terrain mesh, with uninterrupted playable courtyard.
GROUP='TerrainSurface'
verts=[];faces=[];indices=[]
nx,nz=64,70
for iz in range(nz+1):
    z=-15+iz*.5
    for ix in range(nx+1):
        x=-16+ix*.5
        verts.append(point(x,z,ground_height(x,z)))
for iz in range(nz):
    for ix in range(nx):
        p=iz*(nx+1)+ix
        x=-16+ix*.5;z=-15+iz*.5
        faces.append((p,p+nx+1,p+nx+2,p+1))
        courtyard=abs(x)<6.8 and -1.5<z<6
        path=abs(x-.4*math.sin(z*.4))<2.6 and z>0
        # Keep the layout RNG sequence stable, with broad pigment patches.
        value=rng.randrange(4) if courtyard or path else 4+rng.randrange(5)
        patch=.5+.22*math.sin(x*.39+z*.12)+.20*math.sin(z*.35-x*.17)
        value=max(0,min(3,int(patch*4))) if courtyard or path else 4+max(0,min(4,int(patch*5)))
        indices.append(value)
mesh_object('Meadow and earthen paths',verts,faces,earth+grass,indices,True)

# Worn, individually shaped flagstones laid in connected circulation space.
GROUP='CourtyardPaving'
for row in range(19):
    z=-.75+row*.73
    width=6 if z<4.9 else 3
    for col in range(-width,width+1):
        if abs(col)==width and rng.random()<.22:continue
        x=col*.96+(.42 if row%2 else 0)+rng.uniform(-.045,.045)
        if z>4.9:x+=.33*math.sin(z*.5)
        h=.005+rng.uniform(-.005,.005)
        sx=rng.uniform(.83,.91);sz=rng.uniform(.59,.68);mat=rng.choice(stone)
        ob=flagstone(x,z,h,sx,sz,mat)
        ob.rotation_euler.z=rng.uniform(-.022,.022)

# Contoured stream bed, rock ledges and natural boulder groups.
GROUP='LandscapeDetails'
for j in range(30):
    z=-13+j*1.1
    x=-9.15+.25*math.sin(z*.6)
    rock(x,z,-.22,(rng.uniform(.42,.82),rng.uniform(.6,1.0),rng.uniform(.45,.8)),'Stream bank')
for j in range(24):
    x=rng.uniform(-14,14);z=rng.uniform(-15,-10)
    rock(x,z,ground_height(x,z)+.8,(rng.uniform(.8,1.8),rng.uniform(.65,1.5),rng.uniform(1.2,2.8)))
for x,z in [(-7.8,2.3),(-8.1,7.8),(9.4,3.0),(9.5,11),(7.8,-6.5),(-8.6,-6.5)]:
    rock(x,z,.28,(1.0,.8,.75))
    for j in range(3): rock(x+rng.uniform(-1,1),z+rng.uniform(-1,1),.05,(.4,.3,.32))

for x,z,h,s in [(-8,-5.3,6.7,1.05),(9,-6.8,6.4,1.05),(-8.3,10.8,4.8,.75),(14.8,10.2,5.4,.85),(-12,-12,7.2,1.2),(7,-13,8,1.1)]:
    pine(x,z,h,s)

# Medicinal plants and low timber edging. Worker stands on the adjacent path.
box('Medicinal herb bed',7.05,7.0,-.005,3.1,4.2,.10,soil,.06)
for z in [4.85,9.15]:
    branch('Garden border',point(5.45,z,.06),point(8.65,z,.06),.065,wood_light,1)
for x in [5.45,8.65]:
    branch('Garden border',point(x,4.85,.06),point(x,9.15,.06),.065,wood_light,1)
for row in range(7):
    for col in range(5):
        tuft(5.8+col*.57,5.2+row*.56,.06,.32,leaves[3])
for z in [4.5,6,7.5,9.5]:
    branch('Garden fence post',point(9.2,z,-.06),point(9.2,z,.80),.07,wood,.8)
for h in [.28,.62]:branch('Garden fence rail',point(9.2,4.5,h),point(9.2,9.5,h),.045,wood_light,1)

# Sparse ground foliage keeps walking surfaces clear.
for j in range(460):
    x=rng.uniform(-8.8,12);z=rng.uniform(-10,18)
    if abs(x)<6.8 and z<5:continue
    if abs(x)<3.9 and z>=5:continue
    if 4.7<x<9.3 and 4<z<10:continue
    tuft(x,z,ground_height(x,z),rng.uniform(.1,.29))

for j in range(16):
    x=10.2+rng.uniform(-.6,.6);z=1+rng.uniform(-2.3,2.3);h=rng.uniform(2.9,4.6)
    for k in range(6):
        lo=k*h/6;hi=(k+1)*h/6
        branch('Bamboo culm',point(x,z,lo),point(x+.035,z,hi),.032,bamboo,.98,6)
        if k>2:
            for sign in [-1,1]:
                q=point(x+sign*.6,z+.12,hi+.12)
                branch('Bamboo twig',point(x,z,hi),q,.013,bamboo,.3,5)
                tuft(q.x,-q.y,q.z,.48,leaves[2])

# A rocky perimeter gives the mountain shelf visible depth. All new geometry
# is confined to its outer margin, below or beyond the existing walking area.
perimeter=[]
perimeter += [(-16+i*.5,20) for i in range(64)]
perimeter += [(16,20-i*.5) for i in range(70)]
perimeter += [(16-i*.5,-15) for i in range(64)]
perimeter += [(-16,-15+i*.5) for i in range(70)]
count=len(perimeter)
cliff_verts=[]
for layer in range(4):
    for i,(x,z) in enumerate(perimeter):
        nx_edge=-1 if x==-16 else 1 if x==16 else 0
        nz_edge=-1 if z==-15 else 1 if z==20 else 0
        variation=.24*math.sin(i*.43)+.14*math.sin(i*1.07)
        base=ground_height(x,z)
        if layer==0:
            outward=0;h=base-.025
        elif layer==1:
            outward=.32+variation;h=base-.20-.10*math.sin(i*.31)
        elif layer==2:
            outward=.22+variation*1.7;h=-1.75+.34*math.sin(i*.27)
        else:
            outward=-.32+variation;h=-3.15+.36*math.sin(i*.21)+.12*math.sin(i*.83)
        cliff_verts.append(point(x+nx_edge*outward,z+nz_edge*outward,h))
cliff_faces=[];cliff_indices=[]
for layer in range(3):
    for i in range(count):
        j=(i+1)%count
        cliff_faces.append((layer*count+i,layer*count+j,(layer+1)*count+j,(layer+1)*count+i))
        cliff_indices.append(3 if layer==0 else (1+int((1+math.sin(i*.41))*.8)))
cliff=mesh_object('Mountain shelf rock face',cliff_verts,[tuple(reversed(f)) for f in cliff_faces],rock_mats,cliff_indices)
# Broad ledges and occasional outcrops break the border's long silhouette.
edge_rng=random.Random(10311)
for x,z in [(15.7,v) for v in (-12,-7,-2,4,15,19)]+[(v,19.9) for v in (-13,-8,-4,5,10,14)]+[(-15.8,v) for v in (-10,-3,4,11,17)]:
    rock(x,z,ground_height(x,z)-.38,
         (edge_rng.uniform(.60,1.04),edge_rng.uniform(.80,1.35),edge_rng.uniform(.55,.88)),
         'Outer mountain ledge')

# Bake the palette into standard glTF vertex colors. Each semantic surface is
# one material/mesh, so terrain shadow settings remain independently editable.
reports=[]
for group in ('TerrainSurface','CourtyardPaving','LandscapeDetails'):
    paint_mat=material(group+' painted surface',(1,1,1),.92)
    bs=next(n for n in paint_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    attr=paint_mat.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name='Paint'
    paint_mat.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('asset_group')==group]
    for ob in objects:
        col=ob.data.color_attributes.new(name='Paint',type='FLOAT_COLOR',domain='CORNER')
        palette=[tuple(m.diffuse_color) for m in ob.data.materials]
        for poly in ob.data.polygons:
            colour=palette[poly.material_index]
            for li in poly.loop_indices:
                if group=='TerrainSurface':
                    p=ob.data.vertices[ob.data.loops[li].vertex_index].co
                    col.data[li].color=ground_colour(p.x,-p.y)
                elif ob.get('rock_surface'):
                    p=ob.data.vertices[ob.data.loops[li].vertex_index].co
                    weight=max(0,min(.34,(p.z+.35)*.22))*max(0,.35+.65*math.sin(p.x*3.1+p.y*2.7+p.z*4.3))
                    col.data[li].color=tuple(colour[k]*(1-weight)+moss.diffuse_color[k]*weight for k in range(3))+(1,)
                else:
                    col.data[li].color=colour
            poly.material_index=0
        ob.data.materials.clear()
        ob.data.materials.append(paint_mat)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects: ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    landscape=bpy.context.object
    landscape.name=group
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if group=='CourtyardPaving':
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    landscape.data.calc_loop_triangles()
    reports.append({'node':group,'triangles':len(landscape.data.loop_triangles),
                    'vertices':len(landscape.data.vertices),'material_surfaces':len(landscape.data.materials)})
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'landscape.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
report={'asset':'landscape.glb','triangles':sum(r['triangles'] for r in reports),
        'vertices':sum(r['vertices'] for r in reports),'material_surfaces':sum(r['material_surfaces'] for r in reports),
        'seed':10309,'shape_seed':10310,'terrain_colour':'continuous world-space vertex pigment',
        'foreground_pine_xz':[14.8,10.2],'boundary':'rock shelf skirt below perimeter','nodes':reports}
(OUT/'landscape-metrics.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))

# Actual model render for inspection, kept outside the publishable asset tree.
world=bpy.data.worlds.new('Mountain daylight')
bpy.context.scene.world=world;world.use_nodes=True
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs[0].default_value=(.61,.69,.75,1)
background.inputs[1].default_value=.40
bpy.ops.object.light_add(type='AREA',location=(-7,-6,17))
bpy.context.object.data.energy=2200;bpy.context.object.data.size=10
bpy.ops.object.camera_add(location=(23,-29,25))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,-1,2))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=40
scene=bpy.context.scene;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath='/tmp/immortal-art-landscape-preview.png'
bpy.ops.render.render(write_still=True)
