"""Build metre-scale natural assets for the desktop asset review turntable.

Run with Blender --background --python blender/build_asset_nature.py.
Geometry helpers and original CC0 source assets are shared with the reference
catalogue. This script writes only assets/asset-review/nature/ and does no render.
"""
import hashlib
import importlib.util
import json
import math
import random
import shutil
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / 'assets/asset-review/nature'
TEXTURES = OUT / 'textures'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('nature_geometry', HERE/'build_reference_nature.py')
G = importlib.util.module_from_spec(spec)
spec.loader.exec_module(G)
TAU = math.tau
ASSETS = []
OUTLINE = [(31,210),(36,80),(103,40),(167,50),(230,112),
           (222,185),(146,457),(131,457),(50,281)]


def textured(name, color, normal, roughness=None, alpha=False):
    mat = G.textured_material(name, color, normal, alpha)
    if roughness:
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(roughness), check_existing=True)
        tex.image.colorspace_settings.name = 'Non-Color'
        links.new(tex.outputs['Color'], shader.inputs['Roughness'])
    return mat


def tint_material(material, tint):
    nodes,links=material.node_tree.nodes,material.node_tree.links
    shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    source=shader.inputs['Base Color'].links[0].from_socket
    multiply=nodes.new('ShaderNodeMix');multiply.data_type='RGBA';multiply.blend_type='MULTIPLY'
    multiply.inputs[0].default_value=1
    colors=[s for s in multiply.inputs if s.type=='RGBA']
    links.new(source,colors[0]);colors[1].default_value=(*tint,1)
    links.new(next(s for s in multiply.outputs if s.type=='RGBA'),shader.inputs['Base Color'])


def sprig(geo, start, end, width, roll=0):
    """Two crossed photographic sprigs follow a single supported branchlet."""
    start, end = Vector(start), Vector(end)
    direction = end-start
    side = direction.normalized().cross(Vector((0,0,1))).normalized()
    if side.length < .01:
        side = Vector((1,0,0))
    vertical = direction.normalized().cross(side)
    for twist in [roll, roll+math.pi*.44]:
        across = (side*math.cos(twist)+vertical*math.sin(twist))*width
        vertices, uv = [], []
        for px,py in OUTLINE:
            u,v = px/1024, 1-py/1024
            horizontal,along = (u-.028)/.225, (v-.548)/.417
            vertices.append(start+direction*along+across*(horizontal-.5))
            uv.append((u,v))
        geo.face(vertices,uv)


def foliage_bough(wood, leaves, centre, rx, ry, seed, density=1.0):
    rng = random.Random(seed)
    centre = Vector(centre)
    # Each crown is a flat, irregular fan of structural twigs. The sprigs lie
    # along those twigs and alternate left/right into overlapping branch fans.
    for spoke in range(11):
        angle = spoke*TAU/11+rng.uniform(-.24,.24)
        extent = rng.uniform(.73,1.06)
        shoulder_height = .16*math.sin(spoke*1.74+seed*.1)
        tip = centre+Vector((math.cos(angle)*rx*extent, math.sin(angle)*ry*extent,
                             rng.uniform(-.27,.29)))
        G.branch(wood,[centre-Vector((0,0,.17)),centre+(tip-centre)*.55+Vector((0,0,shoulder_height)),tip],
                 .043,.008,6,seed+spoke)
        count = int(6*density)
        for step in range(count):
            u=(step+.45)/count
            axis=tip-centre
            point=centre+axis*u+Vector((0,0,(.14+shoulder_height)*math.sin(u*math.pi)))
            a=angle+(.56 if step%2 else -.56)+.18*math.sin(step*1.3+spoke)
            length=rng.uniform(.73,1.02)*(1-.14*u)
            rise=.13+.23*math.sin(spoke*1.71+step*.90)+rng.uniform(-.04,.10)
            end=point+Vector((math.cos(a)*length,math.sin(a)*length,rise))
            sprig(leaves,point,end,length*.50,rng.uniform(-.45,.45))
    # Central fans bridge the lateral boughs into one canopy without altering
    # the natural photo's original transparent boundary.
    for i in range(int(12*density)):
        angle=i*2.39996
        point=centre+Vector((math.cos(angle)*.23,math.sin(angle)*.23,.19+.09*math.sin(i*1.7)))
        sprig(leaves,point,point+Vector((math.cos(angle)*.90,math.sin(angle)*.90,.28+.12*math.sin(i))),.47,.25)


def record(name, objects, description, **extra):
    bpy.context.view_layer.update()
    low,high=G.bounds(objects)
    ASSETS.append(dict(name=name,objects=objects,description=description,low=low,high=high,**extra))


def make_pine(name='pine', density=1):
    col=G.asset_collection(name)
    wood,leaves=G.Geometry(),G.Geometry()
    trunk=[(0,0,0),(.36,-.10,.68),(.93,-.34,1.48),(1.30,-.18,2.40),
           (.87,.37,3.42),(.48,.76,4.57),(.88,.55,5.70),(1.23,.35,6.68)]
    G.branch(wood,trunk,.44,.072,14,772)
    pads=[(-1.87,-.48,3.53,1.46,1.23,3),
          (3.00,.68,4.41,1.52,1.39,4),
          (.10,2.10,5.13,1.50,1.31,5),
          (-1.46,.25,5.64,1.63,1.37,5),
          (2.69,-.68,5.72,1.49,1.35,6),
          (.31,-1.62,6.01,1.47,1.22,6),
          (1.29,.42,6.67,1.70,1.42,7)]
    for index,(x,y,z,rx,ry,anchor) in enumerate(pads):
        origin=Vector(trunk[anchor]);centre=Vector((x,y,z))
        elbow=origin+(centre-origin)*.43-Vector((0,0,.22))
        G.branch(wood,[origin,elbow,centre-Vector((0,0,.1)),centre],.145 if anchor<5 else .103,.026,9,index+33)
        foliage_bough(wood,leaves,centre,rx,ry,211+index*29,density)
    # The broad collar and tapered roots terminate on the same ground plane.
    for i in range(8):
        a=i*TAU/8+.23
        endpoint=Vector((math.cos(a)*(1.08+.12*math.sin(i)),math.sin(a)*.89,.04))
        G.branch(wood,[(.12,0,.64),(.10+endpoint.x*.38,endpoint.y*.38,.17),endpoint],.22,.022,8,620+i)
    objects=[wood.object(name+'_CurvedTrunk',BARK,col,True),leaves.object(name+'_BranchFans',NEEDLES,col)]
    G.normalize(objects,8.0,9.2)
    # A flat rooted underside gives every turntable view an unambiguous anchor.
    for obj in objects:
        for v in obj.data.vertices:
            if v.co.z<.045:v.co.z=0
    record(name,objects,'Curved pine with seven supported horizontal branch fans and spreading surface roots',
           groundY=0,canopyFans=7,sprigPlanesPerBranchlet=2,lodOf='pine' if density<1 else None)


def make_shrub():
    col=G.asset_collection('shrub');wood,leaves=G.Geometry(),G.Geometry()
    rng=random.Random(548)
    for arm in range(6):
        angle=arm*TAU/6+.28
        end=Vector((math.cos(angle)*.64,math.sin(angle)*.51,.28+rng.random()*.13))
        G.branch(wood,[(0,0,.015),end*.45+Vector((0,0,.10)),end],.042,.009,6,arm)
        for j in range(8):
            a=angle+(j%2-.5)*.8
            start=end*(.4+.65*j/8)
            target=start+Vector((math.cos(a)*.42,math.sin(a)*.42,.12))
            sprig(leaves,start,target,.24,.13)
    objects=[wood.object('shrub_WoodyStems',BARK,col,True),leaves.object('shrub_EvergreenFans',NEEDLES,col)]
    G.normalize(objects,.68)
    record('shrub',objects,'Low spreading evergreen shrub with connected woody stems',groundY=0)


def scan_piece(name,col,position,width,yaw=0,shape=(1,1,1)):
    mesh=ROCK.copy()
    mesh.transform(Matrix.Translation(Vector(position)) @ Matrix.Rotation(yaw,4,'Z') @
                   Matrix.Diagonal((width*shape[0],width*shape[1],width*shape[2],1)))
    mesh.materials.clear();mesh.materials.append(STONE)
    obj=bpy.data.objects.new(name,mesh);col.objects.link(obj)
    return obj


def join(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join();bpy.context.object.name=name
    return bpy.context.object


def make_rock():
    col=G.asset_collection('rock')
    objects=[scan_piece('StoneMain',col,(0,0,0),2.5,.32,(1,.92,1.18)),
             scan_piece('StoneFoot',col,(.75,-.55,0),.97,2.9,(1,1,.82))]
    obj=join(objects,'rock_WeatheredLimestone')
    record('rock',[obj],'Closed weathered scan rock with a naturally fractured lower shoulder',groundY=0)


def terrain_height(x,y):
    slope=max(0,min(1,(y+3.6)/7.2))
    path_x=.50+.72*math.sin(y*.85)+.10*y
    return (.10+1.90*(slope*slope*(3-2*slope))
            +.56*math.exp(-((x+2.6)**2/5+(y-.6)**2/7))
            +.37*math.exp(-((x-3.7)**2/4+(y-1.8)**2/5))
            -.16*math.exp(-((x-path_x)/.85)**2)
            +.065*math.sin(x*1.7+y*.6)+.032*math.sin(x*3.2-y*2.3))


def bake_terrain_surface(objects):
    """Bake continuous land-cover and metre-scale box mapping for GLB use."""
    body=join(objects,'terrain_ContinuousBakedSurface')
    bm=bmesh.new();bm.from_mesh(body.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(body.data);bm.free()
    for polygon in body.data.polygons:polygon.use_smooth=True
    body.data.update()
    def smooth(a,b,value):
        u=max(0,min(1,(value-a)/(b-a)));return u*u*(3-2*u)
    layer=body.data.color_attributes.new(name='TerrainWeights',type='FLOAT_COLOR',domain='POINT')
    for vertex in body.data.vertices:
        x,y,z=vertex.co
        radius=math.sqrt((x/5.72)**2+(y/3.75)**2)
        angle=math.atan2(y/3.75,x/5.72)
        texture_noise=.022*math.sin(x*5.3+y*2.8)+.012*math.sin(y*8.1-x*3.7)
        rock_line=.80+.10*math.sin(angle*4+.8)+.065*math.sin(angle*9)
        up=smooth(.32,.82,vertex.normal.z)
        grass=up*(1-smooth(rock_line-.055,rock_line+.045,radius+texture_noise))
        path_x=.50+.72*math.sin(y*.85)+.10*y
        path=up*(1-smooth(.50,.84,abs(x-path_x)+texture_noise*2))
        layer.data[vertex.index].color=(grass,path,0,1)
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.10,island_margin=.016,area_weight=.5)
    bpy.ops.object.mode_set(mode='OBJECT')
    body.data.uv_layers.active.name='TerrainBakeUV'
    mat=bpy.data.materials.new('TerrainBakeSource');mat.use_nodes=True;mat.use_fake_user=True
    nodes,links=mat.node_tree.nodes,mat.node_tree.links;nodes.clear()
    output=nodes.new('ShaderNodeOutputMaterial')
    texcoord=nodes.new('ShaderNodeTexCoord')
    mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs['Scale'].default_value=.31
    links.new(texcoord.outputs['Object'],mapping.inputs[0])
    weights=nodes.new('ShaderNodeVertexColor');weights.layer_name='TerrainWeights'
    split=nodes.new('ShaderNodeSeparateColor');links.new(weights.outputs['Color'],split.inputs[0])
    def texture(filename,color=False):
        node=nodes.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(TEXTURES/filename),check_existing=True)
        node.image.colorspace_settings.name='sRGB' if color else 'Non-Color'
        node.projection='BOX';node.projection_blend=.28
        links.new(mapping.outputs['Vector'],node.inputs['Vector'])
        return node.outputs['Color']
    def multiply(socket,color):
        node=nodes.new('ShaderNodeMixRGB');node.blend_type='MULTIPLY';node.inputs[0].default_value=1
        links.new(socket,node.inputs[1]);node.inputs[2].default_value=(*color,1)
        return node.outputs[0]
    def blend(stone,grass,soil):
        first=nodes.new('ShaderNodeMixRGB');links.new(split.outputs['Red'],first.inputs[0]);links.new(stone,first.inputs[1]);links.new(grass,first.inputs[2])
        second=nodes.new('ShaderNodeMixRGB');links.new(split.outputs['Green'],second.inputs[0]);links.new(first.outputs[0],second.inputs[1]);links.new(soil,second.inputs[2])
        return second.outputs[0]
    color=blend(multiply(texture('strata-color.jpg',True),(.67,.76,.84)),
                multiply(texture('grass-rock-color.jpg',True),(.46,.68,.51)),texture('forest-color.jpg',True))
    rough=blend(texture('strata-roughness.jpg'),texture('grass-rock-roughness.jpg'),texture('forest-roughness.jpg'))
    height=blend(texture('strata-height.jpg'),texture('grass-rock-height.jpg'),texture('forest-height.jpg'))
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.45;bump.inputs['Distance'].default_value=.075
    links.new(height,bump.inputs['Height'])
    emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=1
    shader=nodes.new('ShaderNodeBsdfPrincipled');links.new(color,shader.inputs['Base Color']);links.new(rough,shader.inputs['Roughness']);links.new(bump.outputs['Normal'],shader.inputs['Normal'])
    body.data.materials.clear();body.data.materials.append(mat)
    for polygon in body.data.polygons:polygon.material_index=0
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1
    scene.render.threads_mode='FIXED';scene.render.threads=6
    scene.render.bake.use_selected_to_active=False;scene.render.bake.margin=16
    baked={}
    for channel,socket in [('color',color),('roughness',rough),('normal',None)]:
        image=bpy.data.images.new('terrain-baked-'+channel,width=2048,height=2048,alpha=False)
        image.colorspace_settings.name='sRGB' if channel=='color' else 'Non-Color'
        target=nodes.new('ShaderNodeTexImage');target.image=image
        for node in nodes:node.select=False
        target.select=True;nodes.active=target
        if channel=='normal':
            links.new(shader.outputs['BSDF'],output.inputs['Surface'])
            bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT',margin=16,use_clear=True)
        else:
            links.new(socket,emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface'])
            bpy.ops.object.bake(type='EMIT',margin=16,use_clear=True)
        image.filepath_raw=str(TEXTURES/('terrain-baked-'+channel+'.png'));image.file_format='PNG';image.save()
        baked[channel]=image.filepath_raw
        print('TERRAIN_CPU_BAKE',channel,image.size[:],flush=True)
    final=textured('TerrainBakedSurface',baked['color'],baked['normal'],baked['roughness'])
    for node in final.node_tree.nodes:
        if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=1
    body.data.materials.clear();body.data.materials.append(final)
    return body


def make_terrain():
    col=G.asset_collection('terrain')
    turf,earth,path=G.Geometry(),G.Geometry(),G.Geometry()
    angular,radial=96,32
    def edge(a,r=1):
        ripple=1+.045*math.sin(a*5+.3)+.027*math.sin(a*9)
        return Vector((math.cos(a)*5.72*r*ripple,math.sin(a)*3.75*r*ripple,0))
    rings=[]
    for j in range(1,radial+1):
        ring=[]
        for k in range(angular):
            a=k*TAU/angular;p=edge(a,j/radial);p.z=terrain_height(p.x,p.y)
            # Turf rolls into the upper rock edge as a coherent thin bank.
            p.z-=.15*(j/radial)**12
            ring.append(p)
        rings.append(ring)
    center=Vector((0,0,terrain_height(0,0)))
    def uv(p):return(p.x/3.4,p.y/3.4)
    def top_face(verts):
        middle=sum(verts,Vector())/len(verts)
        path_x=.50+.72*math.sin(middle.y*.85)+.10*middle.y
        radius=math.sqrt((middle.x/5.72)**2+(middle.y/3.75)**2)
        angle=math.atan2(middle.y/3.75,middle.x/5.72)
        rock_line=.79+.10*math.sin(angle*4+.8)+.07*math.sin(angle*9)
        target=path if abs(middle.x-path_x)<(.66+.06*math.sin(middle.y*2.7)) else earth if radius>rock_line else turf
        target.face(verts,[uv(p) for p in verts])
    for k in range(angular):
        q=(k+1)%angular;top_face([center,rings[0][k],rings[0][q]])
    for j in range(radial-1):
        for k in range(angular):
            q=(k+1)%angular;verts=[rings[j][k],rings[j+1][k],rings[j+1][q],rings[j][q]]
            top_face(verts)
    side_rings=[rings[-1]]
    for level in range(1,10):
        u=level/9;ring=[]
        for k,p in enumerate(rings[-1]):
            a=k*TAU/angular
            # Cross-cut rock shelves vary in both length and depth around the
            # bank; the base stays solid under every surface patch.
            shelf=.06*math.sin(a*7+level*1.28)+.055*math.sin(a*13-level*.72)
            xy=p.xy*(1-.13*u+shelf*math.sin(math.pi*u))
            z=p.z*(1-u)-2.15*u+.085*math.sin(a*9+level*2.1)*math.sin(math.pi*u)
            ring.append(Vector((xy.x,xy.y,z)))
        side_rings.append(ring)
    for level in range(9):
        for k in range(angular):
            q=(k+1)%angular
            verts=[side_rings[level][q],side_rings[level][k],side_rings[level+1][k],side_rings[level+1][q]]
            angle=k*TAU/angular
            turf_depth=.11+.37*(.5+.5*math.sin(angle*4+.8))+.13*math.sin(angle*9)
            target=turf if (verts[0].z+verts[3].z)/2 > rings[-1][k].z-turf_depth else earth
            target.face(verts,[(q/angular*12,side_rings[level][q].z/2),(k/angular*12,side_rings[level][k].z/2),
                               (k/angular*12,side_rings[level+1][k].z/2),(q/angular*12,side_rings[level+1][q].z/2)])
    earth.face(list(reversed(side_rings[-1])),[(p.x/3,p.y/3) for p in reversed(side_rings[-1])])
    objects=[turf.object('terrain_ContinuousTurf',GRASS,col,True),earth.object('terrain_ClosedBedrock',STRATA,col),
             path.object('terrain_ClimbingEarthPath',PATH_SOIL,col,True)]
    objects=[bake_terrain_surface(objects)]
    # Scanned fracture shapes are partially embedded in the same continuous
    # base. Their original proportions and UVs provide nearby rock detail.
    stones=[]
    for i in range(9):
        x=-4.8+i*1.13;y=-3.16+abs(x)*.095
        stones.append(scan_piece(f'BankStone{i:02}',col,(x,y,-1.78),1.55+.26*math.sin(i*1.7),i*.97,(1,.87,1.24)))
    for i,(x,y,s) in enumerate([(-4.7,.9,1.42),(4.8,.55,1.7),(3.8,2.62,1.2),(-3.7,-2.45,.86),
                                (-2.8,.8,2.10),(2.8,1.7,1.8),(-3.8,-.3,1.5)]):
        stones.append(scan_piece(f'EmbeddedStone{i:02}',col,(x,y,terrain_height(x,y)-.64),s,i*1.8,(1,.92,.75)))
    objects.append(join(stones,'terrain_EmbeddedScanStone'))
    anchor=(-2.0,terrain_height(-2.0,.55),-.55)
    record('terrain',objects,'Rising grass and stone slope with a winding earth path, rock outcrops and closed front bank',
           groundY=0,frontAxis='+Z',pineAnchorXYZ=[round(v,4) for v in anchor],
           pineRootInsetMetres=.10,continuousSurface=True,surfaceRiseMetres=round(terrain_height(0,3.2)-terrain_height(0,-3.2),3))


def initialize():
    global BARK,NEEDLES,ROCK,STONE,GRASS,STRATA,PATH_SOIL
    OUT.mkdir(parents=True,exist_ok=True);TEXTURES.mkdir(exist_ok=True)
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
    # Texture copies make the editable file and exported asset directory a
    # self-contained review package while preserving the source image bytes.
    for filename in ['pine-bark-color.png','pine-bark-normal.png','pine-needle-color-alpha.png','pine-needle-normal.png']:
        shutil.copyfile(ROOT/'assets/reference/nature-textures'/filename,TEXTURES/filename)
    BARK=textured('PineBark',TEXTURES/'pine-bark-color.png',TEXTURES/'pine-bark-normal.png')
    NEEDLES=textured('PineNeedles',TEXTURES/'pine-needle-color-alpha.png',TEXTURES/'pine-needle-normal.png',alpha=True)
    for node in NEEDLES.node_tree.nodes:
        if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.35
    ROCK,STONE=G.imported_scan()
    STONE.name='WeatheredScanStone'
    xs=[v.co.x for v in ROCK.vertices];ys=[v.co.y for v in ROCK.vertices];zs=[v.co.z for v in ROCK.vertices]
    width=max(xs)-min(xs)
    ROCK.transform(Matrix.Diagonal((1/width,1/width,1/width,1)) @
                   Matrix.Translation((-(min(xs)+max(xs))/2,-(min(ys)+max(ys))/2,-min(zs))))
    GRASS=textured('ContinuousGrassAndRock',TEXTURES/'grass-rock-color.jpg',TEXTURES/'grass-rock-normal.jpg',TEXTURES/'grass-rock-roughness.jpg')
    tint_material(GRASS,(.46,.68,.51))
    STRATA=textured('RockBankStrata',TEXTURES/'strata-color.jpg',TEXTURES/'strata-normal.jpg',TEXTURES/'strata-roughness.jpg')
    tint_material(STRATA,(.67,.76,.84))
    for filename in ['forest-color.jpg','forest-normal.jpg','forest-roughness.jpg']:
        shutil.copyfile(ROOT/'assets/surfaces'/filename,TEXTURES/filename)
    source_path=OUT/'texture-sources.json'
    source_records=[r for r in json.loads(source_path.read_text()) if r['asset']!='forest_ground_04' or r['channel']=='Displacement']
    for item in json.loads((ROOT/'assets/surfaces/SOURCES.json').read_text())['files']:
        if item['asset']=='forest_ground_04':
            source_records.append({'file':'textures/'+item['file'],'asset':item['asset'],'channel':item['channel'],
                                   'source':item['url'],'license':item['license'],'sha256':item['sha256']})
    source_path.write_text(json.dumps(source_records,indent=2)+'\n')
    PATH_SOIL=textured('EarthPath',TEXTURES/'forest-color.jpg',TEXTURES/'forest-normal.jpg',TEXTURES/'forest-roughness.jpg')


def main():
    initialize();make_pine();make_pine('pine-lod',.5);make_rock();make_shrub();make_terrain()
    records=[]
    for index,asset in enumerate(ASSETS):
        name=asset['name'];path=OUT/(name+'.glb');G.export(asset['objects'],path)
        lo,hi=asset['low'],asset['high'];size=hi-lo
        entry={'id':name,'file':path.name,'description':asset['description'],'units':'metres','upAxis':'Y','frontAxis':'+Z',
               'boundsMinXYZ':[round(lo.x,4),round(lo.z,4),round(-hi.y,4)],
               'boundsMaxXYZ':[round(hi.x,4),round(hi.z,4),round(-lo.y,4)],
               'dimensionsXYZ':[round(size.x,4),round(size.z,4),round(size.y,4)],
               'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in asset['objects']),
               'meshCount':len(asset['objects']),'materials':sorted({m.name for o in asset['objects'] for m in o.data.materials}),
               'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        for key in ['groundY','canopyFans','sprigPlanesPerBranchlet','lodOf','pineAnchorXYZ','pineRootInsetMetres','continuousSurface','surfaceRiseMetres']:
            if asset.get(key) is not None:entry[key]=asset[key]
        records.append(entry)
        for obj in asset['objects']:obj.location+=Vector(((index%3)*15,(index//3)*15,0))
    bpy.context.view_layer.update();bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'nature.blend'))
    manifest={'generator':'blender/build_asset_nature.py','reference':'docs/art/desktop-style-review-20261013/d-realistic-3d.png',
              'coordinateContract':'Metres, Y up, front +Z. Pine, shrub and rock rest at Y=0. Terrain groundY=0 with a closed bank extending below ground.',
              'foliage':{'alphaMode':'MASK','alphaCutoff':.32,'doubleSided':True,'sourceColor':'Unchanged source sRGB RGBA','planesPerSprig':2},
              'terrainSurface':{'blend':'Continuous slope, edge and path weights','mapping':'Metre-scale box projection baked to UVs',
                                'bakeDevice':'Cycles CPU','mapResolution':[2048,2048],'maps':['color','normal','roughness']},
              'sources':[{'asset':a,'url':'https://polyhaven.com/a/'+a,'license':'CC0-1.0','licenseUrl':'https://polyhaven.com/license'}
                         for a in ['pine_sapling_medium','boulder_01','aerial_grass_rock','marble_cliff_02','forest_ground_04']],
              'assets':records,'reviewStatus':'Model geometry and GLB export checks; turntable and multi-view appearance review pending.'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    for row in records:print('ASSET_NATURE',json.dumps(row),flush=True)


if __name__=='__main__':main()
