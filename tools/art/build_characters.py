"""Build the two original courtyard disciples and their skeletal animation clips.

Run with Blender --background --python tools/art/build_characters.py.
The authored scale is metres; Blender -Y becomes Godot +Z at glTF export.
"""
from pathlib import Path
import math
import json
import bpy
from mathutils import Vector, Quaternion, Matrix

OUT = Path(__file__).resolve().parents[2] / 'godot' / 'art' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
TAU = math.tau
PARTS = []
MATS = {}


def material(name, color, roughness=.78, metal=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metal
    return mat


def bind(obj, weights):
    groups = {}
    for v in obj.data.vertices:
        values = weights(v.co) if callable(weights) else {weights: 1}
        for name, value in values.items():
            if value > .0001:
                group = groups.get(name)
                if group is None:
                    group = obj.vertex_groups.new(name=name)
                    groups[name] = group
                group.add([v.index], value, 'REPLACE')
    PARTS.append(obj)
    return obj


def mesh(name, vertices, faces, mat, weights, smooth=True, ids=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    materials = mat if isinstance(mat, list) else [mat]
    for item in materials:
        data.materials.append(item)
    for i, p in enumerate(data.polygons):
        p.use_smooth = smooth
        if ids:
            p.material_index = ids[i % len(ids)]
    return bind(obj, weights)


def sphere(name, center, scale, mat, weights, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return bind(obj, weights)


def loft(name, rings, mat, weights, sides=24, opening=0, ripple=0):
    # rings are (z, width, depth, y_offset); the opening is centred on the front.
    verts, faces, ids = [], [], []
    count = sides + 1 if opening else sides
    for i, (z, rx, ry, cy) in enumerate(rings):
        for j in range(count):
            theta = opening / 2 + (TAU - opening) * j / (count - 1) if opening else TAU * j / sides
            fold = 1 + ripple * math.cos(theta * 10) * (1 - i / max(1, len(rings) - 1))
            verts.append((math.sin(theta) * rx * fold, cy - math.cos(theta) * ry * fold, z))
    for i in range(len(rings) - 1):
        for j in range(count - 1 if opening else count):
            nj = (j + 1) % count
            faces.append((i*count+j, i*count+nj, (i+1)*count+nj, (i+1)*count+j))
            ids.append(1 if isinstance(mat, list) and j % 7 in [1, 2] else 0)
    if not opening:
        faces.extend([tuple(reversed(range(count))), tuple((len(rings)-1)*count+j for j in range(count))])
        ids.extend([0, 0])
    return mesh(name, verts, faces, mat, weights, ids=ids)


def tube(name, centers, radii, mat, weights, sides=12):
    vertices, faces = [], []
    for i, center in enumerate(centers):
        p = Vector(center)
        tangent = Vector(centers[min(i+1, len(centers)-1)]) - Vector(centers[max(0, i-1)])
        tangent.normalize()
        a = tangent.cross(Vector((0, 1, 0)))
        if a.length < .01:
            a = tangent.cross(Vector((1, 0, 0)))
        a.normalize()
        b = tangent.cross(a).normalized()
        radius = radii[i]
        rx, ry = radius if isinstance(radius, tuple) else (radius, radius)
        for j in range(sides):
            theta = TAU*j/sides
            q = p + a*math.cos(theta)*rx + b*math.sin(theta)*ry
            vertices.append(tuple(q))
    for i in range(len(centers)-1):
        for j in range(sides):
            k = (j+1) % sides
            faces.append((i*sides+j, i*sides+k, (i+1)*sides+k, (i+1)*sides+j))
    faces.extend([tuple(reversed(range(sides))), tuple((len(centers)-1)*sides+j for j in range(sides))])
    return mesh(name, vertices, faces, mat, weights)


def ribbon(name, points, width, mat, weights, depth=.002):
    vertices = []
    for x, y, z in points:
        vertices.extend([(x-width/2, y-depth, z), (x+width/2, y-depth, z)])
    faces = [(i*2, i*2+1, i*2+3, i*2+2) for i in range(len(points)-1)]
    # A small solid edge keeps garments readable from oblique camera angles.
    obj = mesh(name, vertices, faces, mat, weights)
    mod = obj.modifiers.new('Woven thickness', 'SOLIDIFY')
    mod.thickness = .004
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def body_weights(co):
    factor = max(0, min(1, (co.z-.95)/.23))
    return {'hips': 1-factor, 'chest': factor}


def garment_weights(co):
    amount = max(0, min(.75, (.97-co.z)/.65))
    thigh = 'thigh.R' if co.x > 0 else 'thigh.L'
    return {'hips': 1-amount, thigh: amount}


def sleeve_weights(side):
    def weights(co):
        value = max(0, min(1, (1.075-co.z)/.085))
        return {f'upper_arm.{side}': 1-value, f'forearm.{side}': value}
    return weights


def limb_weights(side):
    def weights(co):
        value = max(0, min(1, (.56-co.z)/.16))
        return {f'thigh.{side}': 1-value, f'shin.{side}': value}
    return weights


def make_palette(master):
    palette = {
        'skin': ((.69, .46, .30) if not master else (.80, .58, .40), .81, 0),
        'skin_light': ((.80, .56, .38) if not master else (.88, .65, .45), .75, 0),
        'hair': ((.024, .029, .031), .57, 0),
        'hair_light': ((.044, .059, .059), .63, 0),
        'robe': ((.68, .70, .62) if master else (.22, .42, .36), .88, 0),
        'robe_shade': ((.55, .60, .57) if master else (.17, .34, .29), .9, 0),
        'lining': ((.20, .31, .43) if master else (.32, .26, .17), .86, 0),
        'light_cloth': ((.88, .86, .74) if master else (.63, .66, .50), .87, 0),
        'belt': ((.115, .19, .24) if master else (.23, .13, .067), .73, 0),
        'leather': ((.084, .087, .083), .73, 0),
        'sole': ((.045, .045, .037), .87, 0),
        'gold': ((.54, .37, .12), .42, .65),
        'jade': ((.22, .47, .39), .32, .05),
        'eye': ((.028, .02, .016), .3, 0),
        'eye_white': ((.66, .65, .51), .55, 0),
        'lip': ((.41, .23, .17), .78, 0),
        'wood': ((.28, .15, .065), .86, 0),
        'iron': ((.12, .15, .14), .58, .55),
    }
    return {name: material(name, *params) for name, params in palette.items()}


def create_body(master):
    m = MATS
    # Tailored torso, waist and a layered underskirt.
    loft('Inner tunic', [( .86,.147,.089,0),(.97,.15,.095,0),(1.11,.177,.095,0),(1.245,.207,.082,0),(1.30,.15,.071,0)], m['light_cloth'], body_weights, 24)
    loft('Overlapping coat', [(.91,.159,.10,0),(1.02,.164,.104,0),(1.15,.186,.105,0),(1.25,.211,.094,0),(1.30,.16,.074,0)], [m['robe'],m['robe_shade']], body_weights, 28, .53)
    loft('Neck',[(1.28,.064,.052,0),(1.38,.066,.054,0),(1.42,.071,.057,0)], m['skin'], 'neck', 16)
    hem = .32 if master else .48
    loft('Pleated coat tails',[(hem,.255,.145,.015),(hem+.05,.246,.146,.015),(.58,.226,.135,.01),(.78,.19,.116,.002),(.94,.156,.105,0)], [m['robe'],m['robe_shade']], garment_weights,32,.54,.04)
    loft('Indigo underskirt',[(hem+.026,.232,.13,.021),(.59,.19,.10,.012),(.86,.15,.085,0),(.94,.14,.084,0)],m['lining'],garment_weights,24,.16,.025)
    loft('Woven hem border',[(hem,.256,.146,.015),(hem+.032,.25,.148,.015)],m['lining'],garment_weights,32,.54,.04)
    # Folded diagonal lapels have an inner cream edge and a dark outer facing.
    for sign in [-1,1]:
        points = [(sign*.068,-.071,1.32),(sign*.100,-.102,1.28),(sign*.060,-.113,1.20),(-sign*.012,-.119,1.09),(-sign*.070,-.113,1.035)]
        ribbon('Folded collar',points,.036,m['lining'],body_weights)
        edge = [(x+sign*.014,y-.006,z) for x,y,z in points]
        ribbon('Collar piping',edge,.008,m['light_cloth'],body_weights)
    # Dark sash includes several visible wrapped layers and a tied end.
    loft('Waist sash',[(.907,.167,.113,0),(.918,.171,.117,0),(.96,.168,.114,0),(.974,.162,.109,0)],m['belt'],'hips',32)
    for z in [.927,.95]:
        loft('Sash woven edge',[(z,.172,.118,0),(z+.004,.171,.118,0)],m['lining'],'hips',32)
    sphere('Sash knot',(.11,-.11,.936),(.036,.025,.025),m['lining'],'hips',12,8)
    ribbon('Hanging sash',[(.10,-.119,.932),(.13,-.131,.81),(.115,-.143,.70)],.043,m['lining'],garment_weights)
    ribbon('Sash embroidery',[(.10,-.125,.928),(.13,-.137,.81),(.115,-.149,.71)],.006,m['gold'],garment_weights)
    tube('Pendant cord',[(-.10,-.119,.944),(-.11,-.139,.83),(-.085,-.145,.805)],[.004,.004,.004],m['gold'],'hips',6)
    sphere('Jade pendant',(-.085,-.146,.779),(.018,.009,.031),m['jade'],'hips',12,8)
    for sign,side in [(1,'R'),(-1,'L')]:
        x=sign*.095
        tube('Trouser '+side,[(x,0,.87),(x+sign*.009,-.008,.71),(x+sign*.011,-.012,.51),(x+sign*.005,0,.34),(x,0,.20)],[(.091,.079),(.077,.075),(.059,.063),(.054,.059),(.049,.051)],m['lining'],limb_weights(side),16)
        # Boots are sculpted from cross sections, with a separate sole and cuff.
        loft('Boot shaft '+side,[(.10,.056,.062,0),(.20,.056,.058,0),(.34,.061,.058,0)],m['leather'],f'shin.{side}',16)
        obj=PARTS[-1]
        for v in obj.data.vertices:v.co.x += x
        # Forward elongated rounded shoes, flat undersides remain at z=0.
        rows=[(-.185,.027,.045),(-.17,.049,.073),(-.09,.060,.09),(.025,.057,.094),(.061,.038,.074)]
        verts,faces=[],[]
        for y,rx,top in rows:
            for j in range(12):
                theta=TAU*j/12
                verts.append((x+math.cos(theta)*rx,y,.021+max(0,math.sin(theta))*top))
        for i in range(len(rows)-1):
            for j in range(12):faces.append((i*12+j,i*12+(j+1)%12,(i+1)*12+(j+1)%12,(i+1)*12+j))
        faces.extend([tuple(reversed(range(12))),tuple(48+j for j in range(12))])
        mesh('Soft leather shoe '+side,verts,faces,m['leather'],f'foot.{side}')
        sphere('Stitched sole '+side,(x,-.063,.02),(.061,.125,.021),m['sole'],f'foot.{side}',16,6)
        sphere('Boot cuff '+side,(x,0,.327),(.065,.062,.018),m['belt'],f'shin.{side}',16,6)
        # Full upper arm, elbow and forearm; cloth is weighted across the elbow.
        centers=[(sign*.18,0,1.26),(sign*.245,0,1.19),(sign*.295,-.005,1.10),(sign*.322,-.012,1.02),(sign*.345,-.018,.934),(sign*.363,-.024,.86)]
        sphere('Rounded shoulder '+side,(sign*.19,0,1.255),(.071,.074,.065),m['robe'],f'upper_arm.{side}',16,8)
        tube('Flowing sleeve '+side,centers,[(.067,.069),(.077,.076),(.075,.08),(.08,.084),(.083,.09),(.074,.072)],m['robe'],sleeve_weights(side),16)
        tube('Cuff '+side,[(sign*.352,-.021,.893),(sign*.362,-.024,.857)],[(.079,.076),(.076,.074)],m['lining'],f'forearm.{side}',16)
        tube('Cuff ivory seam '+side,[(sign*.361,-.024,.86),(sign*.364,-.024,.85)],[(.077,.075),(.076,.074)],m['light_cloth'],f'forearm.{side}',16)
        sphere('Palm '+side,(sign*.372,-.024,.816),(.036,.026,.058),m['skin_light'],f'hand.{side}',12,8)
        for finger in range(4):
            fx=sign*(.35+finger*.014)
            tube('Finger '+side+str(finger),[(fx,-.027,.80),(fx,-.031,.765+abs(finger-1.5)*.006),(fx,-.022,.755+abs(finger-1.5)*.006)],[.009,.008,.005],m['skin'],f'hand.{side}',6)
        tube('Thumb '+side,[(sign*.347,-.041,.825),(sign*.33,-.05,.798),(sign*.337,-.051,.781)],[.014,.012,.008],m['skin_light'],f'hand.{side}',8)


def create_head(master):
    m=MATS
    loft('Sculpted face',[(1.372,.046,.047,-.021),(1.402,.076,.068,-.012),(1.441,.105,.081,-.005),(1.49,.124,.096,0),(1.55,.13,.102,.007),(1.609,.126,.097,.009),(1.649,.106,.082,.01),(1.677,.064,.055,.012),(1.682,.015,.014,.012)],m['skin_light'],'head',24)
    for sign in [-1,1]:
        sphere('Ear',(sign*.127,.004,1.497),(.025,.021,.045),m['skin'],'head',12,8)
        sphere('Ear concha',(sign*.139,-.010,1.50),(.006,.011,.022),m['skin_light'],'head',8,6)
        # Narrow eye shapes and sculpted brows keep an adult face at this proportion.
        sphere('Eye socket',(sign*.055,-.093,1.533),(.034,.010,.018),m['skin'],'head',12,8)
        sphere('Eye white',(sign*.055,-.1015,1.532),(.027,.008,.010),m['eye_white'],'head',12,8)
        sphere('Dark iris',(sign*.055,-.108,1.532),(.010,.004,.011),m['eye'],'head',12,8)
        sphere('Eye glint',(sign*.052,-.111,1.537),(.003,.002,.003),m['light_cloth'],'head',8,4)
        tube('Upper eyelid',[(sign*.03,-.104,1.537),(sign*.055,-.111,1.543),(sign*.081,-.101,1.537)],[.003,.004,.002],m['hair'],'head',6)
        tube('Eyebrow',[(sign*.027,-.101,1.567),(sign*.053,-.111,1.574),(sign*.087,-.094,1.564)],[.005,.007,.0025],m['hair'],'head',6)
    mesh('Nose bridge',[(-.013,-.096,1.547),(.013,-.096,1.547),(-.018,-.113,1.489),(.018,-.113,1.489),(0,-.137,1.497),(0,-.108,1.479)],[(0,1,4),(0,4,2),(1,3,4),(2,4,5),(4,3,5),(2,5,3)],m['skin_light'],'head')
    tube('Quiet mouth',[(-.029,-.086,1.454),(-.012,-.097,1.452),(0,-.10,1.455),(.014,-.097,1.452),(.029,-.086,1.455)],[.002,.003,.0028,.003,.002],m['lip'],'head',6)
    # Cap follows the skull, with a scalloped temple line and tied crown.
    verts,faces=[],[]
    profile=[(1.47,.127,.103),(1.55,.139,.112),(1.609,.136,.109),(1.649,.116,.094),(1.677,.075,.068),(1.697,.009,.012)]
    def hair_radius(z):
        for j in range(len(profile)-1):
            low,high=profile[j:j+2]
            if z<=high[0]:
                f=max(0,(z-low[0])/(high[0]-low[0]))
                return low[1]*(1-f)+high[1]*f,low[2]*(1-f)+high[2]*f
        return .004,.006
    for i in range(10):
        t=i/9
        for j in range(28):
            a=TAU*j/28
            bottom=1.584 if math.cos(a)>.25 else 1.478
            z=bottom+(1.697-bottom)*t
            rx,ry=hair_radius(z)
            verts.append((math.sin(a)*rx,.009-math.cos(a)*ry,z))
    for i in range(9):
        for j in range(28):faces.append((i*28+j,i*28+(j+1)%28,(i+1)*28+(j+1)%28,(i+1)*28+j))
    mesh('Sleek crown hair',verts,faces,m['hair'],'head')
    for sign in [-1,1]:
        tube('Swept temple lock',[(sign*.076,-.083,1.648),(sign*.11,-.09,1.589),(sign*.123,-.05,1.51),(sign*.11,-.014,1.438)],[.026,.025,.018,.005],m['hair'],'head',10)
        tube('Temple highlight',[(sign*.083,-.103,1.634),(sign*.116,-.105,1.58),(sign*.132,-.06,1.506)],[.0025,.003,.001],m['hair_light'],'head',6)
    for i in range(7):
        x=(i-3)*.026
        tube('Combed crown ridge',[(x,-.093,1.613),(x*.81,-.077,1.663),(x*.37,-.012,1.692)],[.003,.004,.002],m['hair_light'],'head',6)
    sphere('Coiled topknot',(0,.016,1.705),(.071,.064,.048),m['hair'],'head',20,10)
    sphere('Folded topknot',(0,.015,1.741),(.054,.05,.043),m['hair'],'head',16,10)
    loft('Topknot binding',[(1.696,.064,.058,.016),(1.709,.064,.058,.016)],m['lining'] if master else m['belt'],'head',20)
    tube('Hairpin',[(-.092,.017,1.716),(.084,.017,1.716)],[.006,.006],m['gold'] if master else m['wood'],'head',8)
    if master:
        for i in range(7):
            x=(i-3)*.021
            tube('Long tied hair',[(x,.093,1.577),(x*.92,.118,1.421),(x*.72,.12,1.248),(x*.68,.108,1.159+abs(i-3)*.008)],[(.022,.014),(.020,.016),(.019,.014),(.003,.002)],m['hair'] if i%2 else m['hair_light'],lambda co:{'head':max(0,min(1,(co.z-1.28)/.25)),'hair':1-max(0,min(1,(co.z-1.28)/.25))},8)
    else:
        tube('Tied back hair',[(0,.097,1.588),(0,.136,1.491),(.016,.13,1.376)],[(.061,.042),(.046,.04),(.010,.008)],m['hair'],'hair',12)


def create_tool():
    m=MATS
    # Both palms follow the hoe shaft during the work clip.
    tube('Garden hoe handle',[(0,-.215,1.11),(0,-.30,.88),(0,-.56,.10)],[.013,.012,.012],m['wood'],'tool',10)
    tube('Hoe ferrule',[(0,-.543,.15),(0,-.568,.074)],[.018,.018],m['iron'],'tool',10)
    mesh('Forged hoe blade',[(-.088,-.554,.098),(.088,-.554,.098),(.09,-.663,.067),(-.09,-.663,.067),(-.088,-.554,.085),(.088,-.554,.085),(.09,-.663,.056),(-.09,-.663,.056)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],m['iron'],'tool',False)


def create_rig():
    data=bpy.data.armatures.new('DiscipleSkeleton')
    rig=bpy.data.objects.new('Disciple',data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name,head,tail,parent=None):
        b=data.edit_bones.new(name)
        b.head=head;b.tail=tail
        if parent:b.parent=data.edit_bones[parent]
        return b
    bone('root',(0,0,0),(0,0,.15))
    bone('hips',(0,0,.87),(0,0,1.00),'root')
    bone('chest',(0,0,1.00),(0,0,1.30),'hips')
    bone('neck',(0,0,1.30),(0,0,1.41),'chest')
    bone('head',(0,0,1.41),(0,0,1.68),'neck')
    bone('hair',(0,.10,1.55),(0,.12,1.19),'head')
    for sign,side in [(1,'R'),(-1,'L')]:
        bone('upper_arm.'+side,(sign*.19,0,1.26),(sign*.322,-.012,1.02),'chest')
        bone('forearm.'+side,(sign*.322,-.012,1.02),(sign*.363,-.024,.86),'upper_arm.'+side)
        bone('hand.'+side,(sign*.363,-.024,.86),(sign*.372,-.024,.78),'forearm.'+side)
        bone('thigh.'+side,(sign*.095,0,.87),(sign*.104,-.012,.49),'hips')
        bone('shin.'+side,(sign*.104,-.012,.49),(sign*.095,0,.13),'thigh.'+side)
        bone('foot.'+side,(sign*.095,0,.13),(sign*.095,-.16,.067),'shin.'+side)
    bone('tool',(0,-.30,.88),(0,-.36,.70),'root')
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in PARTS:obj.select_set(True)
    bpy.context.view_layer.objects.active=PARTS[0]
    bpy.ops.object.join()
    skin=bpy.context.object;skin.name='DiscipleClothingAndBody'
    mod=skin.modifiers.new('Skeletal deformation','ARMATURE');mod.object=rig
    skin.parent=rig
    # Height including the hair knot is 1.75 m; feet remain on the floor.
    scale=1.75/1.784
    for v in skin.data.vertices:v.co*=scale
    bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    for b in data.edit_bones:b.head*=scale;b.tail*=scale
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig,skin


def world_rotation(rig,name,x=0,y=0,z=0):
    q=Quaternion((1,0,0),x) @ Quaternion((0,1,0),y) @ Quaternion((0,0,1),z)
    orient=rig.data.bones[name].matrix_local.to_quaternion()
    rig.pose.bones[name].rotation_quaternion=orient.inverted() @ q @ orient


def aim_bone(rig,name,start,end):
    bone=rig.data.bones[name]
    rest_direction=(bone.tail_local-bone.head_local).normalized()
    rotation=rest_direction.rotation_difference((end-start).normalized()) @ bone.matrix_local.to_quaternion()
    rig.pose.bones[name].matrix=Matrix.LocRotScale(start,rotation,Vector((1,1,1)))
    bpy.context.view_layer.update()


def work_grips(rig,t):
    scale=1.75/1.784
    pivot=Vector((0,-.30,.88))*scale
    motion=Matrix.Translation((0,.04*math.sin(t),.012*(1+math.sin(t)))) @ Matrix.Translation(pivot) @ Matrix.Rotation(.09*math.sin(t),4,'X') @ Matrix.Translation(-pivot)
    rig.pose.bones['tool'].matrix=motion @ rig.data.bones['tool'].matrix_local
    bpy.context.view_layer.update()
    for side,sign,grip_position in [('R',1,(0,-.26,1.00)),('L',-1,(0,-.31,.85))]:
        grip=motion @ (Vector(grip_position)*scale)
        wrist=grip+Vector((sign*.026,.014,.039))*scale
        upper=rig.pose.bones['upper_arm.'+side]
        shoulder=upper.head.copy()
        a=rig.data.bones['upper_arm.'+side].length
        b=rig.data.bones['forearm.'+side].length
        axis=wrist-shoulder
        length=min(axis.length,a+b-.001)
        direction=axis.normalized()
        wrist=shoulder+direction*length
        offset=(a*a-b*b+length*length)/(2*length)
        height=math.sqrt(max(0,a*a-offset*offset))
        elbow_direction=Vector((sign,0,.12))
        elbow_direction=(elbow_direction-direction*elbow_direction.dot(direction)).normalized()
        elbow=shoulder+direction*offset+elbow_direction*height
        aim_bone(rig,'upper_arm.'+side,shoulder,elbow)
        aim_bone(rig,'forearm.'+side,elbow,wrist)
        aim_bone(rig,'hand.'+side,wrist,grip)


def plant_feet(rig):
    bpy.context.view_layer.update()
    samples=[]
    scale=1.75/1.784
    for side,sign in [('R',1),('L',-1)]:
        bone=rig.data.bones['foot.'+side]
        transform=rig.pose.bones['foot.'+side].matrix @ bone.matrix_local.inverted()
        for y in [-.17,-.07,.035]:
            samples.append((transform @ (Vector((sign*.095,y,0))*scale)).z)
    rig.pose.bones['hips'].location.y-=min(samples)
    bpy.context.view_layer.update()


def animate(rig):
    fps=30
    bpy.context.scene.render.fps=fps
    clips={'idle':72,'walk':28,'work':60}
    for clip,frames in clips.items():
        action=bpy.data.actions.new(clip)
        rig.animation_data_create();rig.animation_data.action=action
        for frame in range(frames+1):
            t=TAU*frame/frames
            for p in rig.pose.bones:
                p.rotation_mode='QUATERNION'
                p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
            rig.pose.bones['tool'].scale=(1,1,1) if clip=='work' else (.001,.001,.001)
            if clip=='idle':
                world_rotation(rig,'chest',.012*math.sin(t),0,.009*math.sin(t))
                world_rotation(rig,'head',-.008*math.sin(t),0,.024*math.sin(t*.5))
                world_rotation(rig,'hair',.02*math.sin(t+.4))
                for side,sign in [('R',1),('L',-1)]:
                    world_rotation(rig,'upper_arm.'+side,.018*math.sin(t+.3),0,sign*.018)
                    world_rotation(rig,'forearm.'+side,-.07-.012*math.sin(t))
            elif clip=='walk':
                rig.pose.bones['hips'].location=(0,.018*(1-math.cos(2*t)),0)
                world_rotation(rig,'hips',.018,0,.042*math.sin(t))
                world_rotation(rig,'chest',.025,0,-.08*math.sin(t))
                world_rotation(rig,'head',-.025,0,.035*math.sin(t))
                world_rotation(rig,'hair',.07*math.sin(t-.5),.025*math.sin(t))
                for side,offset in [('R',0),('L',math.pi)]:
                    p=t+offset
                    world_rotation(rig,'thigh.'+side,-.48*math.cos(p))
                    world_rotation(rig,'shin.'+side,.08+.67*max(0,math.sin(p)))
                    world_rotation(rig,'foot.'+side,-.10-.14*math.cos(p))
                    world_rotation(rig,'upper_arm.'+side,.28*math.cos(p))
                    world_rotation(rig,'forearm.'+side,-.14-.09*max(0,-math.cos(p)))
                    world_rotation(rig,'hand.'+side,.06*math.cos(p))
            else:
                bend=.16+.13*(.5+.5*math.sin(t))
                world_rotation(rig,'hips',.06)
                world_rotation(rig,'chest',bend,0,.035*math.sin(t))
                world_rotation(rig,'neck',.06)
                world_rotation(rig,'head',.10)
                world_rotation(rig,'hair',-.06+.02*math.sin(t))
                for side,sign in [('R',1),('L',-1)]:
                    world_rotation(rig,'thigh.'+side,-.10)
                    world_rotation(rig,'shin.'+side,.19)
                    world_rotation(rig,'foot.'+side,-.09)
                    world_rotation(rig,'upper_arm.'+side,-.54-.16*math.sin(t),sign*.35,sign*.03)
                    world_rotation(rig,'forearm.'+side,-.42-.10*math.sin(t+.4),sign*.12)
                    world_rotation(rig,'hand.'+side,.12)
            if clip in ['walk','work']:
                plant_feet(rig)
            if clip=='work':
                work_grips(rig,t)
            for p in rig.pose.bones:
                p.keyframe_insert(data_path='rotation_quaternion',frame=frame)
                p.keyframe_insert(data_path='location',frame=frame)
                p.keyframe_insert(data_path='scale',frame=frame)
        # NLA tracks keep all clips discoverable across Blender/glTF versions.
        track=rig.animation_data.nla_tracks.new();track.name=clip
        strip=track.strips.new(clip,0,action);strip.name=clip
        track.mute=True
    rig.animation_data.action=bpy.data.actions.get('idle')
    bpy.context.scene.frame_set(0)


def render_preview(rig,skin,name):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.render.resolution_x=840;scene.render.resolution_y=960;scene.render.resolution_percentage=100
    scene.world.color=(.32,.35,.32)
    scene.view_settings.view_transform='AgX'
    floor=material('Preview floor',(.20,.245,.215),.88)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));bpy.context.object.data.materials.append(floor)
    bpy.ops.object.camera_add(location=(2.6,-5,2.4))
    camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.9))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=2.20;scene.camera=camera
    for loc,energy,size in [(( -3,-4,6),650,5),((3,1,4),450,4)]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size
        light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=f'/tmp/{name}.png'
    bpy.ops.render.render(write_still=True)
    if name.endswith('worker'):
        for clip,frame in [('walk',7),('work',15)]:
            rig.animation_data.action=bpy.data.actions.get(clip)
            scene.frame_set(frame)
            scene.render.filepath=f'/tmp/{name}_{clip}.png'
            bpy.ops.render.render(write_still=True)


def build(master):
    global PARTS,MATS
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)
    PARTS=[];MATS=make_palette(master)
    create_body(master);create_head(master);create_tool()
    rig,skin=create_rig();animate(rig)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);skin.select_set(True)
    bpy.context.view_layer.objects.active=rig
    name='disciple_master' if master else 'disciple_worker'
    skin.data.calc_loop_triangles()
    triangles=len(skin.data.loop_triangles)
    assert triangles <= 15000, triangles
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,
        export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,
        export_anim_slide_to_zero=True,export_skins=True,export_morph=False,
        export_materials='EXPORT',export_yup=True,export_extras=True)
    print('CHARACTER_REPORT '+json.dumps({'name':name,'triangles':triangles,'bones':len(rig.data.bones),'animations':['idle','walk','work'],'height':1.75}))
    render_preview(rig,skin,name)


if __name__=='__main__':
    build(True)
    build(False)
