"""Build editable, metre-scale pines, cliff groups and understory for the D scene.

Run: Blender --background --python blender/build_reference_nature.py
The script reads the existing CC0 GLBs and writes assets/reference/nature* plus
individual pine, cliff and shrub GLBs. It performs no rendering.
"""
import hashlib
import json
import math
import random
import struct
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/nature"
OUT = ROOT / "assets/reference"
TEXTURES = OUT / "nature-textures"
ASSETS = []
TAU = math.tau


def unpack_glb(path):
    data = path.read_bytes()
    n = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:20 + n]), data[28 + n:]


def source_texture(gltf, binary, material_part, channel, name):
    mat = next(m for m in gltf["materials"] if material_part in m["name"])
    info = mat.get(channel) or mat["pbrMetallicRoughness"][channel]
    image = gltf["images"][gltf["textures"][info["index"]]["source"]]
    view = gltf["bufferViews"][image["bufferView"]]
    path = TEXTURES / name
    path.write_bytes(binary[view.get("byteOffset", 0):view.get("byteOffset", 0) + view["byteLength"]])
    return path


def textured_material(name, diffuse, normal=None, alpha=False):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if shader is None:
        shader = nodes.new('ShaderNodeBsdfPrincipled')
        output = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL'), None) or nodes.new('ShaderNodeOutputMaterial')
        links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    shader.inputs["Roughness"].default_value = 0.86
    shader.inputs["Specular IOR Level"].default_value = 0.18
    image = nodes.new("ShaderNodeTexImage")
    image.image = bpy.data.images.load(str(diffuse), check_existing=True)
    image.image.colorspace_settings.name = "sRGB"
    links.new(image.outputs["Color"], shader.inputs["Base Color"])
    if alpha:
        links.new(image.outputs["Alpha"], shader.inputs["Alpha"])
        material.surface_render_method = "DITHERED"
        material.use_backface_culling = False
    if normal:
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = bpy.data.images.load(str(normal), check_existing=True)
        texture.image.colorspace_settings.name = "Non-Color"
        bump = nodes.new("ShaderNodeNormalMap")
        bump.inputs["Strength"].default_value = 0.55 if alpha else 0.85
        links.new(texture.outputs["Color"], bump.inputs["Color"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return material


class Geometry:
    def __init__(self):
        self.vertices, self.faces, self.uvs = [], [], []

    def face(self, vertices, uv):
        start = len(self.vertices)
        self.vertices.extend(tuple(v) for v in vertices)
        self.faces.append(tuple(range(start, start + len(vertices))))
        self.uvs.append(uv)

    def object(self, name, material, collection, smooth=False):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        uv = mesh.uv_layers.new(name="UVMap")
        for polygon, face_uv in zip(mesh.polygons, self.uvs):
            polygon.use_smooth = smooth
            for loop, coord in zip(polygon.loop_indices, face_uv):
                uv.data[loop].uv = coord
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        obj.data.materials.append(material)
        return obj


def curve_sample(points, step=5):
    points = [Vector(p) for p in points]
    result = []
    for i in range(len(points) - 1):
        p0, p1 = points[max(0, i - 1)], points[i]
        p2, p3 = points[i + 1], points[min(len(points) - 1, i + 2)]
        for k in range(step):
            t = k / step
            result.append((2 * p1 + (-p0 + p2) * t + (2*p0 - 5*p1 + 4*p2 - p3) * t*t + (-p0 + 3*p1 - 3*p2 + p3) * t*t*t) * .5)
    result.append(points[-1])
    return result


def branch(geometry, points, radius, tip=0.025, sides=10, seed=1):
    rng = random.Random(seed)
    centres = curve_sample(points, 4)
    rings, distances, distance = [], [], 0.0
    noise = [rng.uniform(.91, 1.09) for _ in range(sides)]
    for index, centre in enumerate(centres):
        tangent = (centres[min(index + 1, len(centres)-1)] - centres[max(0, index-1)]).normalized()
        side = tangent.cross(Vector((0, 1, 0))).normalized()
        if side.length < .1:
            side = tangent.cross(Vector((1, 0, 0))).normalized()
        other = tangent.cross(side).normalized()
        u = index / (len(centres)-1)
        r = tip + (radius - tip) * (1-u)**1.2
        if index:
            distance += (centre - centres[index-1]).length
        distances.append(distance)
        rings.append([centre + (math.cos(TAU*j/sides)*side + math.sin(TAU*j/sides)*other)*r*noise[j] for j in range(sides)])
    for i in range(len(rings)-1):
        for j in range(sides):
            k = (j+1) % sides
            geometry.face([rings[i][j], rings[i][k], rings[i+1][k], rings[i+1][j]],
                          [(j/sides, distances[i]/1.7), ((j+1)/sides, distances[i]/1.7), ((j+1)/sides, distances[i+1]/1.7), (j/sides, distances[i+1]/1.7)])
    geometry.face(list(reversed(rings[0])), [(0, 0)]*sides)
    geometry.face(rings[-1], [(0, 0)]*sides)


def needle_spray(geometry, point, length, angle, pitch, rng):
    # Three photographic sprigs around the twig axis retain volume from above
    # and from the side. The convex outline encloses the complete upper-left
    # sprig while excluding the atlas padding's opaque bark-colored pixels.
    sprig_outline = [(31,210),(36,80),(103,40),(167,50),(230,112),
                     (222,185),(146,457),(131,457),(50,281)]
    direction = Vector((math.cos(angle)*math.cos(pitch), math.sin(angle)*math.cos(pitch), math.sin(pitch)))
    axis = direction.cross(Vector((0, 0, 1))).normalized()
    if axis.length < .01:
        axis = Vector((1, 0, 0))
    other = direction.cross(axis).normalized()
    for roll in [0, math.pi/3, math.pi*2/3]:
        width = length * rng.uniform(.43, .60)
        side = (axis*math.cos(roll) + other*math.sin(roll))*width*.5
        bottom, top = point - direction*length*.16, point + direction*length*.84
        vertices, coordinates = [], []
        for pixel_x,pixel_y in sprig_outline:
            u,v = pixel_x/1024,1-pixel_y/1024
            horizontal,vertical = (u-.028)/.225,(v-.548)/.417
            vertices.append(bottom+direction*length*vertical+side*(2*horizontal-1))
            coordinates.append((u,v))
        geometry.face(vertices,coordinates)


def foliage_pad(geometry, centre, rx, ry, height, count, rng, scale=1.0):
    centre = Vector(centre)
    for i in range(count):
        angle = rng.random()*TAU
        radius = math.sqrt(rng.random())
        ripple = 1 + .11*math.sin(angle*5 + centre.x) + .06*math.cos(angle*9)
        z = (rng.random()-.35)*height + .18*(1-radius*radius)
        point = centre + Vector((math.cos(angle)*rx*radius*ripple, math.sin(angle)*ry*radius*ripple, z))
        needle_spray(geometry, point, rng.uniform(.44, .72)*scale, angle+rng.uniform(-1.1, 1.1), rng.uniform(-.03, .72), rng)


def asset_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def normalize(objects, height, width=None):
    low, high = bounds(objects)
    scale_z = height/(high.z-low.z)
    scale_xy = width/(high.x-low.x) if width else scale_z
    transform = Matrix.Diagonal((scale_xy, scale_xy, scale_z, 1))
    for obj in objects:
        obj.data.transform(transform)
        for vertex in obj.data.vertices:
            vertex.co.z -= low.z*scale_z
        obj.data.update()


def bounds(objects):
    points = [obj.matrix_world @ Vector(v) for obj in objects for v in obj.bound_box]
    return Vector([min(v[i] for v in points) for i in range(3)]), Vector([max(v[i] for v in points) for i in range(3)])


def pine(name, windswept=False):
    rng = random.Random(1821 if windswept else 1107)
    wood, leaves = Geometry(), Geometry()
    col = asset_collection(name)
    trunk = [(0,0,0),(.12,.04,1.2),(.60,.05,2.4),(1.05,.10,3.7),(.72,.22,5.05),(1.10,.32,6.3),(1.45,.40,7.12)]
    pads = [(-3.3,-.25,3.9,1.55,1.1,2),(-2.6,1.4,4.20,1.8,1.3,2),(-1.5,-2.0,4.35,1.65,1.1,2),
            (3.7,.6,4.95,1.7,1.2,3),(3.3,-1.6,5.25,1.8,1.2,3),(2.9,2.0,5.4,1.7,1.2,3),
            (-2.4,.25,5.95,1.7,1.2,4),(-1.8,-1.6,6.22,1.7,1.2,4),(-.6,1.9,6.3,1.7,1.3,4),
            (1.3,.3,7.05,1.9,1.55,5),(1.0,-1.0,6.95,1.45,1.25,5)]
    if windswept:
        trunk = [(0,0,0),(.65,.1,1.25),(1.3,-.1,2.6),(2.3,.1,3.9),(2.15,.2,5.2),(2.7,.25,6.45),(3.0,.3,7.05)]
        pads = [(-1.1,.2,3.0,1.5,1.15,2),(-.5,-1.1,3.35,1.6,1.1,2),
                (4.8,.5,4.40,1.8,1.35,3),(4.5,-1.8,4.8,1.75,1.2,3),(4.4,2.0,4.9,1.6,1.3,3),
                (.25,.4,5.25,1.7,1.25,4),(.5,-1.6,5.6,1.8,1.2,4),(1.0,2.0,5.8,1.7,1.3,4),
                (3.5,.4,6.8,1.85,1.4,5),(4.0,-1.1,6.55,1.6,1.3,5)]
    branch(wood, trunk, .48, .10, 15, 20)
    for index, (x,y,z,rx,ry,anchor) in enumerate(pads):
        start = Vector(trunk[anchor])
        target = Vector((x,y,z-.16))
        delta = target-start
        shoulder = start + Vector((delta.x*.44, delta.y*.44, -.23))
        branch(wood, [start, shoulder, target-Vector((0,0,.26)), target], .20 if anchor<4 else .13, .045, 9, index+90)
        # Visible structural forks carry individual lateral crown lobes.
        for limb in range(3):
            angle = limb*TAU/3 + index*.7
            end = target + Vector((math.cos(angle)*rx*.72, math.sin(angle)*ry*.72, .1))
            branch(wood, [target-delta*.15, target, end], .065, .012, 6, index*3+limb)
        foliage_pad(leaves, (x,y,z), rx, ry, .53, 420, rng)
    for index in range(7):
        angle = index*TAU/7+.15
        branch(wood, [(math.cos(angle)*.9,math.sin(angle)*.9,.035), (math.cos(angle)*.48,math.sin(angle)*.48,.18),(.01,.01,.6)], .12,.18,8,index)
    objects = [wood.object(name+"_Bark", BARK, col, True), leaves.object(name+"_Needles", NEEDLES, col)]
    normalize(objects, 8.0, 10.0)
    register(name, col, objects, "Layered irregular horizontal needle canopies on curved, forked trunks")


def shrub():
    rng = random.Random(439)
    col = asset_collection("shrub")
    wood, leaves = Geometry(), Geometry()
    for i in range(9):
        a = i*2.39996
        r = .15 + .6*math.sqrt(i/9)
        end = Vector((math.cos(a)*r,math.sin(a)*r,.30+rng.random()*.28))
        branch(wood, [(0,0,.02), end*.48, end], .031,.008,6,i)
        foliage_pad(leaves, end, .42,.32,.18, 76, rng, .38)
    objects = [wood.object("shrub_Twigs", BARK, col, True), leaves.object("shrub_Needles", NEEDLES, col)]
    normalize(objects, .8)
    register("shrub", col, objects, "Low spreading evergreen understory with twig and needle detail")


def imported_scan():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / "boulder.glb"))
    bpy.context.view_layer.update()
    created = list(set(bpy.data.objects)-before)
    original = next(o for o in created if o.type == "MESH")
    mesh = original.data.copy()
    mesh.transform(original.matrix_world)
    material = original.data.materials[0].copy()
    material.name = "CliffWeatheredStone"
    for obj in created:
        bpy.data.objects.remove(obj, do_unlink=True)
    # Close the scan's underside and preserve face-corner UV coordinates.
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
    boundary = [edge for edge in bm.edges if edge.is_boundary]
    if boundary:
        bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    temporary = bpy.data.objects.new('ScanReduction', mesh)
    bpy.context.scene.collection.objects.link(temporary)
    bpy.context.view_layer.objects.active = temporary
    bpy.ops.object.select_all(action='DESELECT')
    temporary.select_set(True)
    modifier = temporary.modifiers.new('Shared scan detail', 'DECIMATE')
    modifier.ratio = .28
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    mesh = temporary.data.copy()
    bpy.data.objects.remove(temporary, do_unlink=True)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    boundary = [edge for edge in bm.edges if edge.is_boundary]
    if boundary:
        bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    assert not any(edge.is_boundary for edge in bm.edges), 'Rock source must have a closed underside'
    bm.to_mesh(mesh)
    bm.free()
    mesh.normals_split_custom_set([(0, 0, 0)] * len(mesh.loops))
    mesh.update()
    return mesh, material


def cliff(name, target_height, seed, distant=False):
    col = asset_collection(name)
    rng = random.Random(seed)
    objects = []
    counts = [7, 6, 6, 5, 4, 3, 3, 2, 1] if distant else [8, 7, 6, 5, 4, 3, 1]
    pieces = []
    for level, count in enumerate(counts):
        u = level/(len(counts)-1)
        radius = (4.7 if distant else 6.4)*(1-u)**.8
        for i in range(count):
            angle = i*TAU/count + level*.51
            pieces.append((math.cos(angle)*radius, math.sin(angle)*radius,
                           level*2.8 + (rng.uniform(-.3,.3) if level else 0),
                           rng.uniform(3.1,3.7) if distant else rng.uniform(3.6,4.3),
                           rng.uniform(1.0,1.32),angle+rng.uniform(-.5,.5)))
        if level%2 == 0 and radius>1.5:
            pieces.append((0,0,level*2.8,5.0 if distant else 6.0,1.15,level*.8))
    for i,(x,y,z,size,vertical,yaw) in enumerate(pieces):
        mesh = ROCK_MESH.copy()
        obj = bpy.data.objects.new(name+f"_Rock{i:02}",mesh)
        col.objects.link(obj)
        mesh.transform(Matrix.Rotation(yaw,4,'Z') @ Matrix.Diagonal((size,size,size*vertical,1)))
        min_z = min(v.co.z for v in mesh.vertices)
        mesh.transform(Matrix.Translation((x,y,z-min_z)))
        mesh.normals_split_custom_set([(0, 0, 0)] * len(mesh.loops))
        mesh.update()
        mesh.materials.clear()
        mesh.materials.append(PEAK_MATERIAL if distant else ROCK_MATERIAL)
        objects.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name+"_Stone"
    normalize([joined], target_height)
    register(name, col, [joined], "Closed overlapping scan-rock strata form a grounded volumetric island with a tapering summit")
    ASSETS[-1]['rockPieces'] = len(pieces)
    ASSETS[-1]['maximumPieceVerticalRatio'] = round(max(p[4] for p in pieces),4)


def register(name, collection, objects, description):
    bpy.context.view_layer.update()
    low, high = bounds(objects)
    for obj in objects:
        obj["asset_id"] = name
        obj["units"] = "metres"
    ASSETS.append(dict(name=name, collection=collection, objects=objects, description=description,
                       bounds=[list(low),list(high)], triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)))


def distant_peak(name, variant, seed):
    """Continuous closed limestone buttresses with narrow, uneven summits."""
    rng = random.Random(seed)
    col = asset_collection(name)
    stone = Geometry()
    layouts = [
        [(0,0,28,2.8,2.5),(-3.0,.8,22.5,2.5,2.1),(2.7,1.2,20,2.7,2.4),(.4,-2.6,17,2.8,2.4),(-2.5,-1.8,14,2.8,2.5)],
        [(-2.0,.1,27,2.25,2.4),(2.3,.5,23.8,2.15,2.3),(0,2.6,19,2.9,2.35),(-3.0,-1.8,15,2.4,2.5),(2.8,-1.8,12,2.7,2.5)],
        [(1.2,.5,28,2.0,2.25),(-2.0,.7,19,2.65,2.25),(3.6,1.0,17,2.2,2.0),(-.8,-2.0,22.2,1.65,2.0),(-3.3,-1.6,11,2.8,2.5)],
    ]
    specs = layouts[variant]
    # The low solid mass joins the foot of every vertical ridge.
    specs = [(0,0,5.8,5.8,4.8)] + specs
    for index,(cx,cy,height,rx,ry) in enumerate(specs):
        sides = 32
        levels = [0,.045,.12,.22,.34,.47,.59,.71,.80,.865,.92,.963,.986,1]
        profile = [1.28,1.2,1.06,1.0,.96,.93,.89,.85,.80,.72,.58,.37,.15,.025]
        angles = [j*TAU/sides+rng.uniform(-.018,.018) for j in range(sides)]
        grooves = [rng.uniform(.90,1.08)*(0.64 if j%7==index%7 else .85 if j%7==(index+1)%7 else 1) for j in range(sides)]
        lean = Vector((rng.uniform(-1.15,1.15),rng.uniform(-.65,.65),0))
        rings=[]
        for k,u in enumerate(levels):
            ring=[]
            for j,a in enumerate(angles):
                ledge = 1+.045*math.sin(k*.83+j*.33)+.018*math.sin(k*2.1+j)
                radius = profile[k]*grooves[j]*ledge
                centre=Vector((cx,cy,0))+lean*u
                point=centre+Vector((math.cos(a)*rx*radius,math.sin(a)*ry*radius,height*u))
                # Long fluted creases vary slightly in width along their height.
                point.x += math.sin(u*4+j*.55)*.055*rx*(1-u)
                point.y += math.cos(u*5+j*.61)*.045*ry*(1-u)
                ring.append(point)
            rings.append(ring)
        for k in range(len(rings)-1):
            for j in range(sides):
                q=(j+1)%sides
                stone.face([rings[k][j],rings[k][q],rings[k+1][q],rings[k+1][j]],
                           [(j/sides*5,levels[k]*height/2.4),((j+1)/sides*5,levels[k]*height/2.4),
                            ((j+1)/sides*5,levels[k+1]*height/2.4),(j/sides*5,levels[k+1]*height/2.4)])
        stone.face(list(reversed(rings[0])),[(0,0)]*sides)
        stone.face(rings[-1],[(0,0)]*sides)
    objects=[stone.object(name+'_Ridges',PEAK_MATERIAL,col)]
    # A few partly embedded scans give the foot natural fractured detail.
    for i,(x,y,z,size) in enumerate([(-3.8,-2.0,0,2.4),(3.2,-2.1,.1,2.2),(1.7,2.6,.1,2.0)]):
        mesh=ROCK_MESH.copy()
        mesh.transform(Matrix.Rotation(rng.random()*TAU,4,'Z') @ Matrix.Diagonal((size,size,size,1)))
        low=min(v.co.z for v in mesh.vertices)
        mesh.transform(Matrix.Translation((x,y,z-low)))
        mesh.materials.clear();mesh.materials.append(PEAK_MATERIAL)
        obj=bpy.data.objects.new(name+f'_EmbeddedScan{i}',mesh);col.objects.link(obj);objects.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    joined=bpy.context.object
    joined.name=name+'_Stone'
    normalize([joined],28)
    # Check every closed component after welding face-corner seam duplicates.
    bm=bmesh.new();bm.from_mesh(joined.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    assert not any(e.is_boundary for e in bm.edges),'Distant peak must have closed bases and summits'
    bm.free()
    register(name,col,[joined],'Continuous fluted limestone ridges with asymmetric needle summits, closed solid foot and embedded scan detail')
    assert ASSETS[-1]['triangles']<20000


def fix_leaf_materials(path):
    # The diffuse image already carries the correct alpha and sRGB bytes.
    data = path.read_bytes()
    n = struct.unpack_from('<I',data,12)[0]
    gltf = json.loads(data[20:20+n])
    for material in gltf.get('materials',[]):
        if 'PineNeedles' in material.get('name',''):
            material.update(alphaMode='MASK',alphaCutoff=.32,doubleSided=True)
    packed = json.dumps(gltf,separators=(',',':')).encode()
    packed += b' '*(-len(packed)%4)
    tail = data[20+n:]
    path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(packed)+len(tail))+struct.pack('<II',len(packed),0x4e4f534a)+packed+tail)


def export(objects, path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,
                             export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
    fix_leaf_materials(path)


def main():
    global BARK, NEEDLES, ROCK_MESH, ROCK_MATERIAL, PEAK_MATERIAL
    OUT.mkdir(parents=True,exist_ok=True)
    TEXTURES.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.context.scene.unit_settings.scale_length=1
    gltf,binary=unpack_glb(SOURCE/'pine.glb')
    bark_diff=source_texture(gltf,binary,'_bark','baseColorTexture','pine-bark-color.png')
    bark_normal=source_texture(gltf,binary,'_bark','normalTexture','pine-bark-normal.png')
    needle_diff=source_texture(gltf,binary,'_twig','baseColorTexture','pine-needle-color-alpha.png')
    needle_normal=source_texture(gltf,binary,'_twig','normalTexture','pine-needle-normal.png')
    BARK=textured_material('PineBark',bark_diff,bark_normal)
    NEEDLES=textured_material('PineNeedles',needle_diff,needle_normal,True)
    ROCK_MESH,ROCK_MATERIAL=imported_scan()
    PEAK_MATERIAL=ROCK_MATERIAL.copy()
    PEAK_MATERIAL.name='DistantLimestone'
    shader=next(n for n in PEAK_MATERIAL.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for link in list(shader.inputs['Base Color'].links): PEAK_MATERIAL.node_tree.links.remove(link)
    shader.inputs['Base Color'].default_value=(.145,.18,.215,1)
    shader.inputs['Roughness'].default_value=.95
    for node in PEAK_MATERIAL.node_tree.nodes:
        if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.22
    pine('pine-hero')
    pine('pine-windswept',True)
    shrub()
    cliff('cliff-small',8.0,403)
    cliff('cliff-medium',16.0,512)
    cliff('cliff-tall',28.0,601)
    distant_peak('peak-distant',0,716)
    distant_peak('peak-distant-b',1,928)
    distant_peak('peak-distant-c',2,1057)
    records=[]
    for index,asset in enumerate(ASSETS):
        path=OUT/(asset['name']+'.glb')
        export(asset['objects'],path)
        low,high=(Vector(v) for v in asset['bounds'])
        size=high-low
        records.append({'id':asset['name'],'file':path.name,'description':asset['description'],
                        'units':'metres','upAxis':'Y','groundY':0,
                        'boundsMinXYZ':[round(low.x,4),round(low.z,4),round(-high.y,4)],
                        'boundsMaxXYZ':[round(high.x,4),round(high.z,4),round(-low.y,4)],
                        'dimensionsXYZ':[round(size.x,4),round(size.z,4),round(size.y,4)],
                        'triangles':asset['triangles'],'meshCount':len(asset['objects']),
                        'materials':sorted({m.name for o in asset['objects'] for m in o.data.materials}),
                        'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        if 'rockPieces' in asset:
            records[-1].update(rockPieces=asset['rockPieces'],maximumPieceVerticalRatio=asset['maximumPieceVerticalRatio'],closedScanUndersides=True)
        # The editable catalogue spaces source assets for inspection. Each
        # separate runtime GLB above retains its own root at ground level.
        display=Vector(((index%3)*20,(index//3)*25,0))
        for obj in asset['objects']: obj.location+=display
        records[-1]['cataloguePositionBlenderXYZ']=list(display)
    bpy.context.view_layer.update()
    export([o for a in ASSETS for o in a['objects']],OUT/'nature.glb')
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'nature.blend'))
    manifest={'generator':'blender/build_reference_nature.py','reference':'docs/art/desktop-style-review-20261013/d-realistic-3d.png',
              'coordinateContract':'Individual GLBs: metres, Y up, grounded root; nature.glb and blend contain a spaced editable catalogue.',
              'foliage':'Real pine sprig photographs on three-axis leaf bundles with a nine-point atlas outline; sRGB RGBA, MASK 0.32; source pixels and sprig proportions preserved.',
              'sources':[{'asset':'pine_sapling_medium','url':'https://polyhaven.com/a/pine_sapling_medium','license':'CC0-1.0','licenseUrl':'https://polyhaven.com/license'},
                         {'asset':'boulder_01','url':'https://polyhaven.com/a/boulder_01','license':'CC0-1.0','licenseUrl':'https://polyhaven.com/license'}],
              'assets':records,'validation':'Geometry, dimensions and export checked. Final scene appearance is reviewed in the Three.js runtime.'}
    (OUT/'nature-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    for record in records: print('REFERENCE_NATURE',json.dumps(record),flush=True)


if __name__=='__main__': main()
