"""Build editable courtyard architecture from the D composition, then export glTF.

Run: Blender --background --python archive/prototypes/three_style_showcase/blender/build_reference_architecture.py
Authoring coordinates are (x, depth_toward_viewer, height), in metres.
"""
from pathlib import Path
from collections import defaultdict
import bpy
import math
import json
import hashlib
import random
import struct
import zlib
import tempfile
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'reference'
OUT.mkdir(parents=True, exist_ok=True)
RNG = random.Random(130131)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
    for data in list(datablocks):
        if not data.users:
            datablocks.remove(data)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1
bpy.context.preferences.filepaths.save_version = 0

def srgb_linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def color(hex_value):
    return tuple(srgb_linear(((hex_value >> shift) & 255) / 255) for shift in (16, 8, 0)) + (1,)

def image_texture(name, kind, base):
    n = 512
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    r = np.random.default_rng(113 + len(name))
    noise = r.normal(0, 1, (n, n))
    if kind == 'wood':
        grain = np.sin(x * .29 + np.sin(y * .012) * 2.4 + np.sin(y * .041) * .45)
        fine = np.sin(x * 1.04 + np.sin(y * .018) * 4.1)
        knots = np.sin(x * .075 + y * .006)
        field = grain * .075 + fine * .025 + knots * .033 + noise * .014
    elif kind == 'stone':
        field = noise * .024 + np.sin(x * .06 + np.sin(y * .027)) * .025 + np.cos(y * .017) * .014
    else:
        field = noise * .018 + np.sin(x * .045 + y * .071) * .018
    rgba = np.ones((n, n, 4), dtype=np.float32)
    # Pack ordinary sRGB PNG bytes so both Blender and glTF interpret colour identically.
    for c, channel in enumerate(base):
        rgb = np.clip(channel * (1 + field), .001, .95)
        rgba[:, :, c] = rgb
    pixels=(rgba*255).astype(np.uint8)
    def chunk(kind, data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',n,n,8,6,0,0,0))
    data+=chunk(b'IDAT',zlib.compress(b''.join(b'\x00'+row.tobytes() for row in pixels)))+chunk(b'IEND',b'')
    path=Path(tempfile.gettempdir())/(name+'.png')
    path.write_bytes(data)
    img=bpy.data.images.load(str(path),check_existing=False)
    img.name=name
    img.colorspace_settings.name='sRGB'
    img.pack()
    return img

WOOD_IMAGE = image_texture('CedarGrain_Embedded', 'wood', (.24, .20, .155))
STONE_IMAGE = image_texture('Limestone_Embedded', 'stone', (.57, .565, .52))
SLATE_IMAGE = image_texture('FiredSlate_Embedded', 'tile', (.245, .265, .265))

def material(name, hex_value, roughness=.85, metallic=0, texture=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = next((node for node in m.node_tree.nodes if node.type=='BSDF_PRINCIPLED'),None)
    if bs is None:
        bs = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    output = next((node for node in m.node_tree.nodes if node.type=='OUTPUT_MATERIAL'),None)
    if output is None:
        output = m.node_tree.nodes.new('ShaderNodeOutputMaterial')
    m.node_tree.links.new(bs.outputs['BSDF'],output.inputs['Surface'])
    bs.inputs['Base Color'].default_value = color(hex_value)
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Specular IOR Level'].default_value = .24
    if texture:
        node = m.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = texture
        m.node_tree.links.new(node.outputs['Color'], bs.inputs['Base Color'])
    m.diffuse_color = color(hex_value)
    return m

M = {
    'wood': material('Aged_Cedar', 0x3d3328, .86, texture=WOOD_IMAGE),
    'dark': material('Deep_Wood_Recess', 0x24221d, .92),
    'woodlight': material('Exposed_Wood_Edges', 0x716149, .84),
    'plaster': material('Warm_Old_Limewash', 0xa6a496, .97),
    'stone': material('Weathered_Limestone', 0x919085, .96, texture=STONE_IMAGE),
    'stonedark': material('Stone_Recess', 0x666a62, .98),
    'tile': material('Dark_Grey_Fired_Tiles', 0x3e4444, .87, texture=SLATE_IMAGE),
    'tileedge': material('Tile_Worn_Edges', 0x59605b, .91),
    'gold': material('Muted_Antique_Brass', 0x9d8653, .65, .55),
    'paper': material('Window_Closed_Backpanel', 0x6b6a55, .93),
}

def xyz(p):
    return (p[0], -p[1], p[2])

class Part:
    def __init__(self, name, mat, parent):
        self.name, self.mat, self.parent = name, M[mat], parent
        self.vertices, self.faces, self.uvs, self.shades = [], [], [], []

    def face(self, points, uv=None, shade=1):
        index = len(self.vertices)
        self.vertices.extend(xyz(p) for p in points)
        self.faces.append(tuple(reversed(range(index, index + len(points)))))
        self.uvs.extend(uv or [(0, 0), (1, 0), (1, 1), (0, 1)][:len(points)])
        self.shades.extend([shade] * len(points))

    def box(self, c, d, shade=1):
        x, z, h = c; a, b, v = (s / 2 for s in d)
        ps = [(x-a,z-b,h-v), (x+a,z-b,h-v), (x+a,z+b,h-v), (x-a,z+b,h-v),
              (x-a,z-b,h+v), (x+a,z-b,h+v), (x+a,z+b,h+v), (x-a,z+b,h+v)]
        for ids in ((0,3,2,1), (4,5,6,7), (0,1,5,4), (1,2,6,5), (2,3,7,6), (3,0,4,7)):
            p = [ps[i] for i in ids]
            la = (Vector(p[1])-Vector(p[0])).length
            lb = (Vector(p[3])-Vector(p[0])).length
            uv = [(0,0),(la*.65,0),(la*.65,lb*.65),(0,lb*.65)]
            if la > lb * 2:
                uv = [(0,0),(0,la*.65),(lb*.65,la*.65),(lb*.65,0)]
            self.face(p, uv, shade)

    def rod(self, a, b, radius, sides=8, shade=1, end_radius=None):
        a, b = Vector(a), Vector(b)
        axis = (b-a).normalized()
        helper = Vector((0,0,1)) if abs(axis.z) < .9 else Vector((1,0,0))
        u = axis.cross(helper).normalized(); v = axis.cross(u).normalized()
        end_radius = radius if end_radius is None else end_radius
        r0 = [a + radius*(u*math.cos(i*math.tau/sides)+v*math.sin(i*math.tau/sides)) for i in range(sides)]
        r1 = [b + end_radius*(u*math.cos(i*math.tau/sides)+v*math.sin(i*math.tau/sides)) for i in range(sides)]
        self.face(list(reversed(r0)), [(0,0)]*sides, shade)
        self.face(r1, [(0,0)]*sides, shade)
        for i in range(sides):
            j = (i+1)%sides
            self.face([r0[i],r0[j],r1[j],r1[i]],[(i/sides,0),(j/sides,0),(j/sides,(b-a).length),(i/sides,(b-a).length)],shade)

    def path(self, points, radius, sides=6, shade=1):
        for a,b in zip(points,points[1:]):
            self.rod(a,b,radius,sides,shade)

    def finish(self):
        if not self.faces:
            return None
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.append(self.mat)
        mesh.update()
        # Winding compensates for the authoring depth axis pointing toward the viewer.
        uv = mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            for loop_index in poly.loop_indices:
                uv.data[loop_index].uv = self.uvs[mesh.loops[loop_index].vertex_index]
        attr = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
        for i, value in enumerate(self.shades):
            attr.data[i].color = (value,value,value,1)
        ob = bpy.data.objects.new(self.name, mesh)
        self.parent.users_collection[0].objects.link(ob)
        ob.parent = self.parent
        return ob

def root_object(name):
    collection = bpy.data.collections.new(name + '_Editable')
    bpy.context.scene.collection.children.link(collection)
    ob = bpy.data.objects.new(name, None)
    collection.objects.link(ob)
    return ob

def box_part(name, mat, parent, boxes):
    part = Part(name,mat,parent)
    for c,d in boxes:
        part.box(c,d,.96+RNG.random()*.08)
    return part.finish()

def foundation(parent, w, d, h):
    stone = Part('Foundation_Courses','stone',parent)
    stone.box((0,0,.14),(w,d,.28))
    stone.box((0,0,h-.12),(w-.10,d-.10,.24))
    stone.box((0,0,h-.39),(w-.34,d-.34,.24),.94)
    dark = Part('Foundation_Joints','stonedark',parent)
    dark.box((0,0,h*.50),(w-.42,d-.42,h-.5))
    for level in range(3):
        y = .38 + level*(h-.68)/3
        block_h = (h-.68)/3-.035
        for side in (-1,1):
            n = round(w/1.55)
            for i in range(n):
                x = -w/2+(i+.5)*w/n
                stone.box((x,side*(d/2-.27),y+block_h/2),(w/n-.025,.36,block_h),.91+RNG.random()*.15)
            n = round(d/1.55)
            for i in range(n):
                z = -d/2+(i+.5)*d/n
                stone.box((side*(w/2-.27),z,y+block_h/2),(.36,d/n-.025,block_h),.91+RNG.random()*.15)
    stone.finish();dark.finish()

def column(parent,x,z,bottom,top,radius,label):
    p=Part(label+'_Shaft','wood',parent)
    p.rod((x,z,bottom+.26),(x,z,top),radius,14,end_radius=radius*.89)
    p.finish()
    p=Part(label+'_StoneBase','stone',parent)
    p.box((x,z,bottom+.11),(radius*2.65,radius*2.65,.22))
    p.rod((x,z,bottom+.2),(x,z,bottom+.38),radius*1.2,12)
    p.finish()

def brackets(parent,x,z,h,scale=1):
    p=Part('Dougong_Bracket','wood',parent)
    for level in range(3):
        length=(.8+level*.28)*scale
        yy=h+level*.16*scale
        p.box((x,z,yy),(length,.25*scale,.20*scale))
        p.box((x,z,yy+.09*scale),(.26*scale,length,.16*scale))
        for side in (-1,1):
            p.box((x+side*length*.36,z,yy+.14*scale),(.19*scale,.38*scale,.25*scale))
            p.box((x,z+side*length*.36,yy+.19*scale),(.32*scale,.18*scale,.21*scale))
    p.finish()
    trim=Part('Dougong_Edge','woodlight',parent)
    trim.box((x,z,h+.53*scale),(1.6*scale,.44*scale,.085*scale))
    trim.finish()

def facade_bay(parent,cx,z,bottom,width,height,label,central=False):
    p=Part(label+'_ClosedBacking','dark',parent)
    p.box((cx,z-.10,bottom+height/2),(width,.24,height))
    p.finish()
    p=Part(label+'_Joinery','wood',parent)
    for side in (-1,1):
        p.box((cx+side*(width/2-.10),z+.05,bottom+height/2),(.18,.23,height))
    for yy in (bottom+.14,bottom+height-.15):
        p.box((cx,z+.06,yy),(width,.24,.22))
    if central:
        planks=12
        for i in range(planks):
            x=cx-width/2+(i+.5)*width/planks
            p.box((x,z+.03,bottom+height/2),(width/planks-.024,.10,height-.40),.90+RNG.random()*.18)
        p.box((cx,z+.11,bottom+height/2),(.045,.10,height-.3),.7)
    else:
        for x in (cx-width*.25,cx,cx+width*.25):
            p.box((x,z+.12,bottom+height*.52),(.085,.16,height-.35))
        p.box((cx,z+.10,bottom+height*.31),(width-.20,.19,.18))
        for i in range(4):
            xx=cx-width*.375+i*width*.25
            p.box((xx,z+.015,bottom+height*.17),(width*.215,.12,height*.22),.91+RNG.random()*.15)
        row0=bottom+height*.35; row1=bottom+height-.31
        for yy in np.arange(row0,row1,.36):
            p.box((cx,z+.13,float(yy)),(width-.27,.075,.045),1.13)
        for xx in np.arange(cx-width/2+.29,cx+width/2-.18,.27):
            p.box((float(xx),z+.135,(row0+row1)/2),(.046,.07,row1-row0),1.12)
    p.finish()
    if not central:
        backing=Part(label+'_WindowPanels','paper',parent)
        backing.box((cx,z+.055,bottom+height*.65),(width-.31,.018,height*.54))
        backing.finish()

def medallion(parent,z,h,radius):
    p=Part('Central_Door_Brass_Medallion','gold',parent)
    for r in (radius,radius*.90,radius*.48):
        points=[(math.cos(t)*r,z,h+math.sin(t)*r) for t in np.linspace(0,math.tau,97)]
        p.path(points,.026 if r<radius else .043,6)
    for petal in range(8):
        a=petal*math.tau/8
        points=[]
        for t in np.linspace(0,math.tau,32):
            rr=radius*(.53+.26*math.cos(t))
            aa=a+.24*math.sin(t)
            points.append((rr*math.cos(aa),z+.006,h+rr*math.sin(aa)))
        p.path(points,.022,5)
    for a in np.linspace(0,math.tau,25)[:-1]:
        x=radius*.947*math.cos(a);y=h+radius*.947*math.sin(a)
        p.rod((x,z-.025,y),(x,z+.035,y),.033,8)
    p.finish()

def railing(parent,width,depth,h):
    p=Part('Upper_Balcony_Railing','wood',parent)
    edge=Part('Balcony_Rail_Edge','woodlight',parent)
    for side in (-1,1):
        z=side*depth/2
        for y in (.14,.80,1.10):
            p.box((0,z,h+y),(width,.13,.13))
        count=round(width/.45)
        for i in range(count+1):
            x=-width/2+i*width/count
            p.box((x,z,h+.48),(.065,.10,.62))
        for i in range(8):
            x=-width/2+i*width/7
            p.box((x,z,h+.62),(.18,.20,1.25))
            edge.box((x,z,h+1.25),(.23,.23,.075))
    for side in (-1,1):
        x=side*width/2
        for y in (.14,.80,1.10):
            p.box((x,0,h+y),(.13,depth,.13))
        for z in np.arange(-depth/2,depth/2,.45):
            p.box((x,float(z),h+.48),(.1,.065,.62))
    p.finish();edge.finish()

def roof(parent,name,halfwidth,halfdepth,eave,ridge,ridgehalf, tile_width=.30,skirt=False,inner=None):
    surface=Part(name+'_RoofBed','dark',parent)
    tiles=Part(name+'_Individual_Tiles','tile',parent)
    edge=Part(name+'_Tile_Edges','tileedge',parent)
    timber=Part(name+'_Eave_Timber','wood',parent)
    ridge_part=Part(name+'_Ridge_Ceramics','tileedge',parent)
    gold=Part(name+'_Ridge_Accents','gold',parent)

    def point(face,u,t):
        if skirt:
            iw,idp=inner
            hx=iw+(halfwidth-iw)*t; hz=idp+(halfdepth-idp)*t
            if face<2:
                x=u*hx;z=(1 if face==0 else -1)*hz
            else:
                x=(1 if face==2 else -1)*hx;z=u*hz
            height=eave+(ridge-eave)*(1-t)**1.4+.24*t**7+.46*abs(u)**8*t**5
        else:
            if face<2:
                x=u*(ridgehalf+(halfwidth-ridgehalf)*t);z=(1 if face==0 else -1)*halfdepth*t
            else:
                x=(1 if face==2 else -1)*(ridgehalf+(halfwidth-ridgehalf)*t);z=u*halfdepth*t
            height=eave+(ridge-eave)*(1-t)**1.65+.38*t**8+.85*abs(u)**8*t**5
        return (x,z,height)

    for face in range(4):
        cols=max(8,round((halfwidth if face<2 else halfdepth)*2/tile_width))
        rows=7 if skirt else 28
        start=.005 if not skirt else 0
        # Closed underside, tessellated to follow the concave eaves.
        for r in range(12):
            for c in range(32):
                u0=-1+c/16;u1=u0+1/16
                t0=start+(1-start)*r/12;t1=start+(1-start)*(r+1)/12
                ps=[point(face,u0,t0),point(face,u1,t0),point(face,u1,t1),point(face,u0,t1)]
                if face in (1,2):ps.reverse()
                surface.face(ps,shade=.88)
        # Raised cylindrical tile courses with shallow overlap at each horizontal joint.
        for c in range(cols):
            u0=-1+2*c/cols;u1=-1+2*(c+1)/cols
            for r in range(rows):
                t0=start+(1-start)*r/rows+.001
                t1=min(1,start+(1-start)*(r+1)/rows+.002)
                shade=.90+RNG.random()*.20
                for arc in range(4):
                    aa=arc/4;bb=(arc+1)/4
                    ua=u0+(u1-u0)*(.05+.90*aa);ub=u0+(u1-u0)*(.05+.90*bb)
                    ps=[]
                    for u,t,v in ((ua,t0,aa),(ub,t0,bb),(ub,t1,bb),(ua,t1,aa)):
                        x,z,h=point(face,u,t)
                        ps.append((x,z,h+.035+.065*math.sin(v*math.pi)))
                    uv=[(aa,0),(bb,0),(bb,.6),(aa,.6)]
                    if face in (1,2):ps.reverse();uv.reverse()
                    tiles.face(ps,uv,shade)
                if r==rows-1:
                    mid=(u0+u1)/2;x,z,h=point(face,mid,1)
                    direction=Vector((x,z,0)).normalized()
                    edge.rod((x,z,h+.035),(x+direction.x*.08,z+direction.y*.08,h+.035),.080,8,shade)
        points=[point(face,float(u),1) for u in np.linspace(-1,1,65)]
        timber.path([(x,z,h-.16) for x,z,h in points],.14,8)
        edge.path([(x,z,h+.035) for x,z,h in points],.044,6)
        # Eave rafter ends and corner hip seams.
        for u in np.linspace(-.98,.98,max(12,cols//2)):
            a=point(face,float(u),.89);b=point(face,float(u),1)
            timber.rod((a[0],a[1],a[2]-.24),(b[0],b[1],b[2]-.24),.069,6)
        if face<2:
            for side in (-1,1):
                points=[point(face,side,float(t)) for t in np.linspace(start,1,36)]
                ridge_part.path([(x,z,h+.15) for x,z,h in points],.13,9)

    if not skirt:
        # Ridge tiles have a substantial silhouette and upward terminal ornaments.
        for i in range(round(ridgehalf*2/.36)):
            x=-ridgehalf+i*.36
            ridge_part.rod((x,0,ridge+.12),(min(ridgehalf,x+.35),0,ridge+.12),.20,10,.92+RNG.random()*.1)
        for side in (-1,1):
            points=[(side*(ridgehalf-.35),0,ridge+.17),(side*(ridgehalf+.18),0,ridge+.30),
                    (side*(ridgehalf+.48),0,ridge+.70),(side*(ridgehalf+.47),0,ridge+1.0),
                    (side*(ridgehalf+.26),0,ridge+1.07)]
            ridge_part.path(points,.17,9)
            gold.rod((side*(ridgehalf+.47),-.13,ridge+.77),(side*(ridgehalf+.47),.13,ridge+.77),.07,10)
    surface.finish();tiles.finish();edge.finish();timber.finish();ridge_part.finish();gold.finish()

def create_main_hall():
    parent=root_object('MainHall')
    foundation(parent,29.6,16,1.8)
    # Closed facades and recessed upper volume create two clearly separated storeys.
    box_part('Ground_Floor_Walls','plaster',parent,[((0,-.25,4.14),(25.6,11.9,4.68))])
    box_part('Upper_Floor_Walls','dark',parent,[((0,-.3,10.10),(24.8,10.9,4.8))])
    box_part('Storey_Separation','wood',parent,[((0,0,7.57),(27.0,13.8,.40)),((0,0,7.25),(26.5,13.4,.24))])
    # The face has seven bays, with the principal door centred on the axial approach.
    bay=25.2/7
    for i in range(7):
        cx=(i-3)*bay
        facade_bay(parent,cx,6.03,1.90,bay-.20,4.53,'Lower_Bay_%02d'%i,central=i==3)
        facade_bay(parent,cx,5.30,8.0,bay-.23,3.68,'Upper_Bay_%02d'%i)
        facade_bay(parent,cx,-6.13,1.9,bay-.20,4.53,'Rear_Lower_Bay_%02d'%i)
    for i in range(8):
        x=-12.6+i*bay
        for side in (-1,1):
            column(parent,x,side*6.48,1.80,6.92,.28,'Lower_Column')
            brackets(parent,x,side*6.48,6.55,.95)
            column(parent,x*.957,side*5.74,7.80,12.34,.225,'Upper_Column')
            brackets(parent,x*.957,side*5.74,11.91,.86)
    for side in (-1,1):
        for z in (-3.5,0,3.5):
            column(parent,side*12.75,z,1.8,6.92,.27,'Side_Lower_Column')
            brackets(parent,side*12.75,z,6.55,.9)
            column(parent,side*12.0,z,7.8,12.34,.22,'Side_Upper_Column')
            brackets(parent,side*12.0,z,11.91,.85)
        # Side walls keep complete exterior faces with inset framed panels.
        p=Part('Side_Wall_Joinery','wood',parent)
        for z in np.arange(-5.7,5.71,1.4):
            p.box((side*12.84,float(z),4.17),(.17,.12,4.35))
            p.box((side*12.47,float(z),10.02),(.13,.12,3.53))
        for h in (2.15,3.4,6.22,8.25,9.0,11.66):
            p.box((side*(12.85 if h<7 else 12.48),0,h),(.19,11.9,.14))
        p.finish()
    beams=Part('Horizontal_Tie_Beams','wood',parent)
    trims=Part('Beam_Edge_Bands','woodlight',parent)
    for side in (-1,1):
        for h,z,w in ((6.55,6.49,26.4),(7.01,6.65,27),(11.94,5.8,25.4),(12.30,5.88,25.8)):
            beams.box((0,side*z,h),(w,.36,.35))
            trims.box((0,side*(z+.19),h-.05),(w,.035,.05))
    beams.finish();trims.finish()
    railing(parent,26.4,13.35,7.78)
    roof(parent,'Lower_Eave',14.65,7.82,6.95,8.67,0,skirt=True,inner=(12.3,5.43))
    roof(parent,'Great_Upper_Roof',15,8.15,12.30,17.82,10.15)
    medallion(parent,6.195,4.19,1.45)
    plaque=Part('Entrance_Plaque','dark',parent)
    plaque.box((0,6.73,6.47),(3.4,.20,.54));plaque.finish()
    edge=Part('Entrance_Plaque_Border','gold',parent)
    for h in (6.22,6.72):edge.box((0,6.847,h),(3.4,.022,.030))
    for x in (-1.68,1.68):edge.box((x,6.847,6.47),(.035,.022,.51))
    edge.finish()
    return parent

def create_pavilion():
    parent=root_object('SidePavilion')
    foundation(parent,12.2,10.2,1.30)
    box_part('Pavilion_Lower_Walls','plaster',parent,[((0,0,3.20),(9.0,7.3,3.8))])
    box_part('Pavilion_Upper_Walls','dark',parent,[((0,0,6.52),(7.55,5.7,2.6))])
    box_part('Pavilion_Upper_Floor','wood',parent,[((0,0,5.23),(9.6,8.0,.30))])
    for i in range(3):
        facade_bay(parent,(i-1)*2.75,3.77,1.4,2.61,3.20,'Pavilion_Lower_Bay',central=i==1)
        facade_bay(parent,(i-1)*2.38,2.94,5.60,2.2,1.92,'Pavilion_Upper_Bay')
    for x in (-4.5,-1.5,1.5,4.5):
        for side in (-1,1):
            column(parent,x,side*4.03,1.3,4.82,.19,'Pavilion_Lower_Column')
            brackets(parent,x,side*4.03,4.47,.70)
    for x in (-3.80,-1.27,1.27,3.80):
        for side in (-1,1):
            column(parent,x,side*3.11,5.4,7.82,.15,'Pavilion_Upper_Column')
            brackets(parent,x,side*3.11,7.51,.62)
    railing(parent,9.30,7.75,5.35)
    roof(parent,'Pavilion_Lower_Eave',6.05,5.10,4.66,5.89,0,tile_width=.29,skirt=True,inner=(3.75,2.78))
    roof(parent,'Pavilion_Upper_Roof',5.55,4.44,7.86,10.7,2.65,tile_width=.29)
    return parent

hall=create_main_hall()
pavilion=create_pavilion()
pavilion.location.x=42

# Improve bevel highlights on stone plinths and broad structural members in the editable file.
for ob in list(bpy.data.objects):
    if ob.type=='MESH' and any(k in ob.name for k in ('Foundation_Courses','Storey_Separation','Horizontal_Tie_Beams')):
        bevel=ob.modifiers.new('Worn_Edge_Bevel','BEVEL')
        bevel.width=.025;bevel.segments=1
        bevel.affect='EDGES'
        bevel.limit_method='ANGLE'

# Store descriptive data in the native asset, not in scene UI.
bpy.context.scene['reference_image']='docs/art/desktop-style-review-20261013/d-realistic-3d.png'
bpy.context.scene['units']='metres; Three.js +Y up and +Z entrance'
bpy.context.scene['editable_parts']='MainHall and SidePavilion collections; mesh parts retain semantic names'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'architecture.blend'))

def merged_export_asset(source):
    """Create runtime meshes grouped by material while leaving the editable source intact."""
    parent=bpy.data.objects.new(source.name+'_Export',None)
    bpy.context.scene.collection.objects.link(parent)
    parent['assetName']=source.name
    groups=defaultdict(list)
    for ob in source.children_recursive:
        if ob.type=='MESH':groups[ob.data.materials[0].name].append(ob)
    depsgraph=bpy.context.evaluated_depsgraph_get()
    triangles=0;bounds=[]
    for name,objects in groups.items():
        verts=[];faces=[];uvs=[];shades=[]
        for ob in objects:
            evaluated=ob.evaluated_get(depsgraph)
            mesh=evaluated.to_mesh()
            transform=source.matrix_world.inverted() @ ob.matrix_world
            offset=len(verts)
            verts.extend(transform @ v.co for v in mesh.vertices)
            layer=mesh.uv_layers.active
            attr=mesh.color_attributes.get('Color')
            for poly in mesh.polygons:
                faces.append(tuple(offset+v for v in poly.vertices))
                triangles+=len(poly.vertices)-2
                uvs.extend(tuple(layer.data[i].uv) if layer else (0,0) for i in poly.loop_indices)
            for v in mesh.vertices:
                shades.append(tuple(attr.data[v.index].color) if attr and attr.domain=='POINT' else (1,1,1,1))
            evaluated.to_mesh_clear()
        mesh=bpy.data.meshes.new(source.name+'_'+name)
        mesh.from_pydata(verts,[],faces)
        mesh.materials.append(bpy.data.materials[name])
        mesh.update()
        layer=mesh.uv_layers.new(name='UVMap')
        for i,uv in enumerate(uvs):layer.data[i].uv=uv
        attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
        for i,c in enumerate(shades):attr.data[i].color=c
        ob=bpy.data.objects.new(mesh.name,mesh)
        bpy.context.scene.collection.objects.link(ob);ob.parent=parent
        bounds.extend(verts)
    xs=[v.x for v in bounds];ys=[v.y for v in bounds];zs=[v.z for v in bounds]
    metrics={'name':source.name,'triangles':triangles,'drawPrimitives':len(groups),
             'dimensionsXYZ':[max(xs)-min(xs),max(zs)-min(zs),max(ys)-min(ys)],
             'boundsMinXYZ':[min(xs),min(zs),-max(ys)],'boundsMaxXYZ':[max(xs),max(zs),-min(ys)],
             'editableMeshParts':len([o for o in source.children_recursive if o.type=='MESH']),
             'materials':sorted(groups)}
    return parent,metrics

hall_export,hall_metrics=merged_export_asset(hall)
pavilion_export,pavilion_metrics=merged_export_asset(pavilion)
# Hide source data from selection-based runtime export.
hall.name='MainHall_Editable';pavilion.name='SidePavilion_Editable'
hall_export.name='MainHall';pavilion_export.name='SidePavilion'

def export(path,roots):
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots:
        root.select_set(True)
        for child in root.children_recursive:child.select_set(True)
    bpy.context.view_layer.objects.active=roots[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,
        export_materials='EXPORT',export_vertex_color='NAME',export_vertex_color_name='Color',
        export_cameras=False,export_lights=False,export_animations=False,
        export_extras=True)

export(OUT/'main-hall.glb',[hall_export])
export(OUT/'pavilion.glb',[pavilion_export])
export(OUT/'architecture.glb',[hall_export,pavilion_export])
manifest={'schema':1,'reference':'docs/art/desktop-style-review-20261013/d-realistic-3d.png',
          'units':'metres','axes':{'up':'+Y','front':'+Z'},
          'assets':[hall_metrics,pavilion_metrics],
          'files':{},'verification':{'structure':'pending independent GLB readback','render':'root capture pending'}}
for filename in ('architecture.blend','architecture.glb','main-hall.glb','pavilion.glb'):
    path=OUT/filename
    manifest['files'][filename]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(OUT/'architecture-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('ARCHITECTURE_COMPLETE '+json.dumps(manifest['assets']))
