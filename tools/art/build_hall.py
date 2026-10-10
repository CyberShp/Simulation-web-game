"""Build the Yunxiu hall as a metrically scaled, closed exterior GLB.

Run: Blender --background --python tools/art/build_hall.py
Blender coordinates are Z-up, with the entrance facing -Y. All textures and
shading use glTF standard PBR inputs and vertex colours. Geometry is original.
"""
import bpy
import math
import random
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "godot/art/assets"
OUT.mkdir(parents=True, exist_ok=True)
random.seed(3109)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
MATS = {}


def material(name, colour, rough=0.83, metal=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1)
    mat.use_nodes = True
    bs = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bs is None:
        bs = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
        mat.node_tree.links.new(bs.outputs['BSDF'], output.inputs['Surface'])
    bs.inputs['Base Color'].default_value = (*colour, 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    attr = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Paint'
    mat.node_tree.links.new(attr.outputs['Color'], bs.inputs['Base Color'])
    MATS[name] = (mat, colour)
    return name


STONE = material('Pale mountain limestone', (0.49, 0.47, 0.38))
WOOD = material('Oiled cedar timber', (0.29, 0.14, 0.068))
EDGE = material('Honey cedar cut edges', (0.43, 0.25, 0.12))
DARK = material('Deep timber and tile joints', (0.11, 0.075, 0.049))
WALL = material('Warm lime plaster', (0.67, 0.61, 0.47))
TILE = material('Blue grey fired tiles', (0.24, 0.34, 0.34), 0.78)
RIDGE = material('Weathered celadon ridges', (0.37, 0.43, 0.40), 0.76)
GOLD = material('Antique brass fittings', (0.50, 0.32, 0.105), 0.52, 0.35)
RED = material('Faded vermilion banner', (0.43, 0.16, 0.095))


def paint(obj, mat, variation=0.06):
    m, base = MATS[mat]
    obj.data.materials.append(m)
    col = obj.data.color_attributes.new(name='Paint', type='FLOAT_COLOR', domain='CORNER')
    tint = random.uniform(1-variation, 1+variation)
    for poly in obj.data.polygons:
        # Small pigment changes stay coherent across each object and face.
        v = tint * random.uniform(.98, 1.02)
        for li in poly.loop_indices:
            col.data[li].color = (*[min(1, c*v) for c in base], 1)
    return obj


def mesh(name, verts, faces, mat, smooth=False, variation=.06):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    paint(obj, mat, variation)
    for p in data.polygons:
        p.use_smooth = smooth
    return obj


def box(name, loc, size, mat, bevel=.025, rotation=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    obj.rotation_euler.z = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel >= .018:
        mod = obj.modifiers.new('Soft worn edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        mod.affect = 'EDGES'
        bpy.ops.object.modifier_apply(modifier=mod.name)
        norm = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=norm.name)
    return paint(obj, mat)


def cylinder(name, a, b, radius, mat, sides=10, r2=None):
    vec = Vector(b)-Vector(a)
    centre = (Vector(a)+Vector(b))*.5
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius,
                                  radius2=radius if r2 is None else r2,
                                  depth=vec.length, location=centre)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = vec.to_track_quat('Z','Y').to_euler()
    return paint(obj, mat)


def tube(name, points, radius, mat, sides=6):
    verts=[]
    for i, p in enumerate(points):
        tang = Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        tang.normalize()
        up=Vector((0,0,1))
        if abs(tang.dot(up))>.95: up=Vector((0,1,0))
        a=tang.cross(up).normalized(); b=tang.cross(a).normalized()
        for k in range(sides):
            q=Vector(p)+radius*(a*math.cos(2*math.pi*k/sides)+b*math.sin(2*math.pi*k/sides))
            verts.append(q)
    faces=[]
    for j in range(len(points)-1):
        for k in range(sides):
            faces.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
    faces += [tuple(reversed(range(sides))),tuple((len(points)-1)*sides+k for k in range(sides))]
    return mesh(name, verts, faces, mat, True)


def prism_xz(name, profile, y, thickness, mat):
    verts=[(x,y-thickness/2,z) for x,z in profile]+[(x,y+thickness/2,z) for x,z in profile]
    n=len(profile)
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return mesh(name, verts, faces, mat)


# Three masonry courses, with staggered mortar lines and a projecting cap.
box('Foundation core', (0,0,.29), (9.65,6.65,.58), STONE, .075)
for z in (.16,.43):
    for side in (-1,1):
        for j in range(12):
            x=-4.42+j*.8+(0.18 if z>.3 else 0)
            if abs(x)>4.55: continue
            box('Dressed front and back stone', (x,side*3.345,z), (.77,.15,.25), STONE,.035)
        for j in range(8):
            box('Dressed side stone', (side*4.84,-2.88+j*.82,z), (.15,.79,.25), STONE,.035)
box('Broad limestone platform cap', (0,0,.665), (10.0,6.92,.19), STONE,.055)
for x in range(-4,5):
    for y in (-3,-2,-1,0,1,2,3):
        box('Platform paving', (x+.04*math.sin(y),y,.772), (.974,.976,.035), STONE,.014)
# Six low, wide steps; each tread consists of individual stone blocks.
for i in range(6):
    y=-5.5+i*.345
    h=.126*(i+1)
    for j in range(5):
        box('Stair tread', ((j-2)*.81,y+.18,h/2), (.79,.40,h), STONE,.025)
for side in (-1,1):
    for i in range(6):
        h=.126*(i+1)+.12
        box('Stepped stair cheek', (side*2.17,-5.30+i*.345,h/2), (.27,.40,h), STONE,.045)

# Sealed plaster and stone envelope.
box('Closed hall envelope', (0,.12,2.28), (8.45,5.28,3.03), WALL,.055)
box('Dark cedar sill', (0,.12,.96), (8.63,5.44,.20), WOOD,.025)
for side in (-1,1):
    for k in range(10):
        box('Low front masonry', (-3.84+k*.85,side*2.8,1.02), (.82,.20,.46), STONE,.024)
    for k in range(6):
        box('Low side masonry', (side*4.32,-2.32+k*.9,1.02), (.20,.86,.46), STONE,.024)

# Structural columns, carved bases, lintels and layered corbels.
for y in (-2.91,2.91):
    for x in (-4.30,-2.82,-1.35,1.35,2.82,4.30):
        box('Square column plinth', (x,y,.88), (.48,.48,.22), STONE,.045)
        cylinder('Carved column foot',(x,y,.96),(x,y,1.17),.245,STONE,10,.185)
        cylinder('Cedar pillar',(x,y,1.13),(x,y,3.92),.16,WOOD,12,.145)
        cylinder('Pillar collar',(x,y,1.18),(x,y,1.30),.176,EDGE,12)
        box('Pillar capital',(x,y,3.74),(.43,.43,.20),EDGE,.026)
        box('Corbel lower arm',(x,y,3.9),(.79,.27,.13),WOOD,.025)
        box('Corbel crossing arm',(x,y,4.02),(.28,.79,.13),EDGE,.025)
        for dx in (-.3,.3):
            box('Corbel rising block',(x+dx,y,4.02),(.16,.32,.20),EDGE,.02)
        for dy in (-.28,.28):
            box('Corbel bracket cap',(x,y+dy,4.11),(.49,.17,.10),WOOD,.018)
        # Braces describe a curved shoulder under each lintel.
        for s in (-1,1):
            profile=[(x+s*.1,3.57),(x+s*.16,3.84),(x+s*.72,3.84),
                     (x+s*.58,3.75),(x+s*.4,3.69),(x+s*.24,3.58)]
            prism_xz('Carved shoulder brace',profile,y,.16,EDGE)
for y in (-2.9,2.9):
    box('Long primary lintel',(0,y,3.62),(8.92,.23,.29),WOOD,.025)
    box('Lintel raised edge',(0,y-.025,3.78),(8.95,.30,.06),EDGE,.012)
    box('Cedar transom band',(0,y,3.29),(8.88,.18,.17),EDGE,.022)
for x in (-4.3,4.3):
    box('Side tie beam',(x,0,3.61),(.24,5.9,.29),WOOD,.025)
    box('Side lower band',(x,0,1.34),(.19,5.58,.16),WOOD,.022)
    for y in (-1.43,0,1.43):
        box('Side wall timber',(x,y,2.35),(.19,.19,2.61),WOOD,.022)


def window(cx, cy, angle=0, width=1.09):
    # Local front lies at negative Y, with opaque warm paper behind the lattice.
    def p(x,y,z):
        return (cx+x*math.cos(angle)-y*math.sin(angle), cy+x*math.sin(angle)+y*math.cos(angle),z)
    def b(name,x,y,z,sx,sy,sz,mat,bv=.014):
        return box(name,p(x,y,z),(sx,sy,sz),mat,bv,angle)
    b('Window dark inset',0,0,2.35,width+.21,.12,1.58,DARK)
    b('Opaque paper window',0,-.075,2.35,width,.045,1.39,WALL)
    for x in (-width/2-.035,width/2+.035): b('Window jamb',x,-.14,2.35,.09,.10,1.62,WOOD)
    for z in (1.55,3.15): b('Window frame',0,-.15,z,width+.24,.13,.09,EDGE)
    for j in range(6):
        b('Window vertical lattice',-width/2+(j+.5)*width/6,-.13,2.35,.033,.043,1.39,WOOD,.006)
    for j in range(7):
        b('Window horizontal lattice',0,-.14,1.75+j*.2,width,.045,.030,WOOD,.004)
    b('Stone window sill',0,-.17,1.49,width+.29,.28,.11,STONE,.02)


for x in (-3.53,-2.08,2.08,3.53):
    window(x,-2.55,width=.90)
    window(x,2.79,math.pi,width=.90)
for side in (-1,1):
    for y in (-1.4,1.4): window(side*4.27,y,side*math.pi/2,width=1.05)
# Solid carved twin doors, 2.4 m high over the platform.
for side in (-1,1):
    cx=side*.56
    box('Closed door leaf',(cx,-2.63,1.98),(1.095,.19,2.40),WOOD,.028)
    for j in range(6):
        box('Door vertical boards',(cx-.44+j*.176,-2.744,1.40),(.16,.025,1.06),EDGE,.01)
    box('Door opaque upper panel',(cx,-2.742,2.55),(.89,.035,.85),WALL,.008)
    for k in range(5):
        box('Door upper lattice',(cx-.38+k*.19,-2.779,2.55),(.03,.028,.85),WOOD,.004)
    for k in range(5):
        box('Door upper lattice',(cx,-2.784,2.19+k*.18),(.91,.028,.03),WOOD,.004)
    for z in (1.85,3.07): box('Door carved crossrail',(cx,-2.79,z),(.94,.08,.10),EDGE,.014)
    cylinder('Door brass boss',(side*.18,-2.82,1.87),(side*.18,-2.86,1.87),.073,GOLD,10)
    pts=[(side*.18+.07*math.cos(k*math.tau/12),-2.89,1.80+.09*math.sin(k*math.tau/12)) for k in range(13)]
    tube('Door ring handle',pts,.011,GOLD,5)
for x in (-1.17,1.17): box('Door portal',(x,-2.76,2.02),(.15,.22,2.60),EDGE,.025)
box('Door threshold',(0,-2.8,.82),(2.42,.37,.13),STONE,.022)
box('Door portal lintel',(0,-2.75,3.30),(2.62,.24,.17),WOOD,.025)
box('Hall nameboard',(0,-2.98,3.56),(1.69,.13,.37),DARK,.045)
for z in (3.41,3.71): box('Nameboard gold border',(0,-3.065,z),(1.58,.022,.025),GOLD,.005)
for x in (-.78,.78): box('Nameboard gold border',(x,-3.065,3.56),(.025,.022,.30),GOLD,.005)
# Three abstract mountain glyphs are modeled strokes, readable at game distance.
for cx in (-.42,0,.42):
    for dx in (-.09,0,.09):
        box('Mountain nameboard stroke',(cx+dx,-3.08,3.56),(.026,.02,.14 if dx else .21),GOLD,.002)
    box('Mountain nameboard stroke',(cx,-3.08,3.485),(.205,.02,.023),GOLD,.002)

# Cloth banners and lightly raised cream trim use closed meshes.
for side in (-1,1):
    x=side*2.82
    cylinder('Banner crossbar',(x-.41,-3.12,3.33),(x+.41,-3.12,3.33),.035,EDGE,8)
    profile=[(x-.34,3.29),(x+.34,3.29),(x+.32,1.59),(x,1.38),(x-.32,1.59)]
    prism_xz('Hanging vermilion banner',profile,-3.16,.027,RED)
    for sx in (-1,1):
        tube('Banner woven trim',[(x+sx*.30,-3.19,3.22),(x+sx*.28,-3.19,1.62),(x,-3.19,1.45)],.012,EDGE,4)
    # Lotus-shaped sect ornament.
    for s in (-1,1):
        tube('Banner lotus emblem',[(x,-3.193,2.20),(x+s*.17,-3.193,2.34),(x+s*.13,-3.193,2.52),(x,-3.193,2.70)],.016,WALL,5)
    tube('Banner central emblem',[(x,-3.193,2.13),(x,-3.193,2.66)],.017,WALL,5)


def roof_z(t,u):
    t=max(0,min(1,t))
    return 6.07-2.11*(1-(1-t)**1.70)+.24*t**8+.36*(abs(u)**9)*(t**4)


def roof_point(side,u,t):
    return (u*(3.35+2.13*t),side*3.77*t,roof_z(t,u))


def hip_point(side,u,t):
    return (side*(3.35+2.13*t),u*3.77*t,roof_z(t,u))


def roof_surface(name,fn,mat):
    nu,nt=16,10
    verts=[fn(-1+2*i/nu,j/nt) for j in range(nt+1) for i in range(nu+1)]
    faces=[]
    for j in range(nt):
        for i in range(nu):
            a=j*(nu+1)+i
            faces.append((a,a+1,a+nu+2,a+nu+1))
    obj=mesh(name,verts,faces,mat,True)
    for polygon in obj.data.polygons:
        if polygon.normal.z < 0:
            polygon.flip()
    obj.data.update()
    # Explicit back faces make the eave underside opaque in glTF.
    mod=obj.modifiers.new('Roof clay thickness','SOLIDIFY'); mod.thickness=.075
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


for side in (-1,1):
    roof_surface('Curved main roof deck',lambda u,t,s=side:roof_point(s,u,t),TILE)
    roof_surface('Curved hipped roof deck',lambda u,t,s=side:hip_point(s,u,t),TILE)

# Curved barrel tiles: individually lapped sections with actual round profiles.
def tile_strip(name,p0,p1,width,mat):
    v0,v1=Vector(p0),Vector(p1)
    tangent=(v1-v0).normalized()
    across=tangent.cross(Vector((0,0,1))).normalized()
    normal=across.cross(tangent).normalized()
    verts=[]
    for p in (v0,v1):
        for k in range(5):
            ang=math.pi*k/4
            q=p+across*(math.cos(ang)*width)+normal*(math.sin(ang)*width*.58+.024)
            verts.append(q)
    faces=[(k,k+5,k+6,k+1) for k in range(4)]
    return mesh(name,verts,faces,mat,True,variation=.13)


for side in (-1,1):
    # Parallel front roof courses broaden only in the hip corner zones.
    for ci in range(41):
        x=-5.36+ci*.268
        tmin=max(.012,(abs(x)-3.34)/2.13)
        for j in range(10):
            ta=max(tmin,j*.10)
            tb=min(1.006,(j+1)*.10+.009)
            if ta>=tb or ta>1: continue
            def pt(t):
                u=x/(3.35+2.13*min(1,t))
                return (x,side*3.77*t,roof_z(min(1,t),u))
            tile_strip('Lapped round roof tile',pt(ta),pt(tb),.078,TILE)
    # The two hip slopes fan out from each ridge end.
    for ui in range(27):
        u=-.96+1.92*ui/26
        for j in range(2,10):
            a=j*.10; b=min(1.006,(j+1)*.10+.009)
            tile_strip('Hipped roof tile',hip_point(side,u,a),hip_point(side,u,b),.067,TILE)
    # Segmented fascia follows the lifted eave and emphasizes its thickness.
    pts=[roof_point(side,-1+2*j/48,1) for j in range(49)]
    tube('Main eave glazed rim',[(x,y,z+.019) for x,y,z in pts],.081,RIDGE,6)
    tube('Dark eave fascia',[(x,y*.986,z-.14) for x,y,z in pts],.10,WOOD,6)
    pts=[hip_point(side,-1+2*j/32,1) for j in range(33)]
    tube('Hip eave glazed rim',[(x,y,z+.019) for x,y,z in pts],.081,RIDGE,6)
    tube('Hip timber fascia',[(x*.99,y,z-.14) for x,y,z in pts],.10,WOOD,6)
    for ci in range(41):
        x=-5.36+ci*.268
        z=roof_z(1,x/5.48)
        cylinder('Front round tile end',(x,side*3.77,z+.017),(x,side*3.85,z+.017),.085,RIDGE,6)
        cylinder('Golden rafter end',(x,side*3.39,z-.22),(x,side*3.69,z-.19),.048,EDGE,6)
    for j in range(24):
        y=-3.60+j*.31
        z=roof_z(1,y/3.77)
        cylinder('Hip round tile end',(side*5.46,y,z),(side*5.54,y,z),.074,RIDGE,6)
    for sy in (-1,1):
        pts=[roof_point(sy,side,t/20) for t in range(21)]
        tube('Sculpted descending hip ridge',[(x,y,z+.095) for x,y,z in pts],.118,RIDGE,8)
        # Swept corner horns continue the hip curve beyond the eave.
        base=roof_point(sy,side,1)
        pts=[(base[0]+side*.54*t,base[1]+sy*.39*t,base[2]+.10+.59*t*t) for t in [i/10 for i in range(11)]]
        tube('Rising corner finial',pts,.095,RIDGE,7)

# Layered ridge cap with curled ends, small ceramic lotus centre and ridge beads.
tube('Main ridge beam',[(x,0,6.15+.09*(abs(x)/3.5)**5) for x in [-3.5+i*7/40 for i in range(41)]],.14,RIDGE,8)
for x in [-3.15+i*.35 for i in range(19)]:
    cylinder('Ridge cap joint',(x-.014,0,6.17),(x+.014,0,6.17),.151,RIDGE,8)
for side in (-1,1):
    pts=[(side*(3.3+.66*t),0,6.24+.51*t*t) for t in [i/12 for i in range(13)]]
    tube('Cloud ridge finial',pts,.13,RIDGE,8)
    pts=[(side*(3.81+.13*math.cos(a)),0,6.65+.13*math.sin(a)) for a in [i*math.pi/12 for i in range(17)]]
    tube('Finial curled lip',pts,.058,RIDGE,6)
cylinder('Centre ridge lotus base',(0,0,6.19),(0,0,6.34),.20,RIDGE,10,.15)
for a in range(6):
    theta=math.tau*a/6
    cylinder('Lotus ceramic petal',(.09*math.cos(theta),.09*math.sin(theta),6.27),(.14*math.cos(theta),.14*math.sin(theta),6.48),.09,RIDGE,5,.015)

# Merge by material to keep renderer submissions compact.
for matname in MATS:
    group=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0].name==matname]
    if not group: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group: o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name='Hall • '+matname
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    # Consistent outward normals for closed components and curved surfaces.
    if matname != TILE:
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')

objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
verts=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
mins=[min(v[i] for v in verts) for i in range(3)]
maxs=[max(v[i] for v in verts) for i in range(3)]
triangles=0
for o in objects:
    o.data.calc_loop_triangles()
    triangles+=len(o.data.loop_triangles)
print('HALL_STATS '+json.dumps({'min':mins,'max':maxs,'triangles':triangles,'meshes':len(objects),'materials':len(MATS),'entrance_blender':[0,-2.8,.82],'stairs_base_blender':[0,-5.5,0]}))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'hall.glb'),export_format='GLB',use_selection=True,
                          export_yup=True,export_apply=True,export_attributes=True,
                          export_extras=False,export_cameras=False,export_lights=False)

# Render an actual model inspection outside the runtime scene.
world=bpy.data.worlds.new('Mountain daylight')
bpy.context.scene.world=world
world.use_nodes=True
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs[0].default_value=(.65,.74,.80,1)
background.inputs[1].default_value=.55
bpy.ops.object.light_add(type='AREA',location=(-6,-8,14))
bpy.context.object.data.energy=1900
bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=8
bpy.ops.object.light_add(type='AREA',location=(5,2,10))
bpy.context.object.data.energy=900; bpy.context.object.data.size=7
bpy.ops.object.camera_add(location=(13,-17,11))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,-.3,2.6))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=17.5
scene=bpy.context.scene
scene.camera=camera
scene.render.engine='CYCLES'; scene.cycles.samples=48
scene.render.resolution_x=1400; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.filepath='/tmp/immortal-art-hall-preview.png'
bpy.ops.render.render(write_still=True)
