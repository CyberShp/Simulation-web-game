"""Build the asset-review architecture from the main-hall five-view design board.

Run: Blender --background --python archive/prototypes/three_style_showcase/blender/build_asset_architecture.py
Authoring coordinates are (x, depth_toward_viewer, height), in metres.
"""
from pathlib import Path
from collections import defaultdict
import bpy
import bmesh
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
OUT = ROOT / 'assets' / 'asset-review' / 'architecture'
TEXTURES = OUT / 'textures'
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

def texture_image(family, channel):
    path=TEXTURES/(family+'-'+channel+'.jpg')
    image=bpy.data.images.load(str(path),check_existing=True)
    image.colorspace_settings.name='sRGB' if channel=='color' else 'Non-Color'
    image.pack()
    return image


def material(name, hex_value, roughness=.85, metallic=0, family=None, normal_strength=.45):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    nodes=m.node_tree.nodes;links=m.node_tree.links
    bs=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None) or nodes.new('ShaderNodeBsdfPrincipled')
    output=next((n for n in nodes if n.type=='OUTPUT_MATERIAL'),None) or nodes.new('ShaderNodeOutputMaterial')
    links.new(bs.outputs['BSDF'],output.inputs['Surface'])
    bs.inputs['Base Color'].default_value=color(hex_value)
    bs.inputs['Roughness'].default_value=roughness
    bs.inputs['Metallic'].default_value=metallic
    bs.inputs['Specular IOR Level'].default_value=.3
    if family:
        tex=nodes.new('ShaderNodeTexImage');tex.image=texture_image(family,'color')
        tint_value={'stone':(.93,.97,1.0,1),'roof':(.52,.55,.59,1)}.get(family)
        if tint_value:
            tint=nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1
            tint.inputs[2].default_value=tint_value
            links.new(tex.outputs['Color'],tint.inputs[1]);links.new(tint.outputs[0],bs.inputs['Base Color'])
            m['assetBaseColorFactor']=tint_value
        else:
            links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        normal=nodes.new('ShaderNodeTexImage');normal.image=texture_image(family,'normal')
        tangent=nodes.new('ShaderNodeNormalMap');tangent.inputs['Strength'].default_value=normal_strength
        links.new(normal.outputs['Color'],tangent.inputs['Color']);links.new(tangent.outputs['Normal'],bs.inputs['Normal'])
        arm=nodes.new('ShaderNodeTexImage');arm.image=texture_image(family,'arm')
        split=nodes.new('ShaderNodeSeparateColor');links.new(arm.outputs['Color'],split.inputs[0])
        links.new(split.outputs['Green'],bs.inputs['Roughness'])
        # AO is encoded in the source map and kept with the editable material.
        occlusion=nodes.new('ShaderNodeGroup')
        group=bpy.data.node_groups.get('glTF Material Output')
        if group is None:
            group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
            group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
        occlusion.node_tree=group
        links.new(split.outputs['Red'],occlusion.inputs['Occlusion'])
    m.diffuse_color=color(hex_value)
    return m

M={
 'wood':material('Cedar_Scanned_PBR',0x5b4733,family='wood',normal_strength=.32),
 'dark':material('Deep_Cedar_Panels',0x343028,.9),
 'woodlight':material('Cedar_Edge_Joinery',0x78664c,.79),
 'plaster':material('Aged_Gray_Limewash',0x999a90,family='plaster',normal_strength=.30),
 'stone':material('Carved_Gray_Stone_PBR',0x8e8d82,family='stone',normal_strength=.32),
 'stonedark':material('Stone_Deep_Recess',0x5d635e,.97),
 'tile':material('Fired_Gray_Roof_PBR',0x575b58,family='roof',normal_strength=.16),
 'tileedge':material('Roof_Ceramic_Edge',0x535956,.80),
 'gold':material('Aged_Brass_Inlay',0x9c895c,.58,.62),
 'paper':material('Opaque_Window_Wood_Panels',0x8c836e,.93),
 'lamp':material('Lamp_Warm_Glass',0xd8bd82,.72),
 'banner':material('Ivory_Heavy_Linen',0xbfc0ad,.97),
 'ink':material('Banner_Blue_Gray_Embroidery',0x4b5d65,.9),
}

def xyz(p):
    return (p[0], -p[1], p[2])

class Part:
    def __init__(self, name, mat, parent):
        self.name, self.mat, self.parent = name, M[mat], parent
        self.vertices, self.faces, self.uvs, self.shades, self.smooth = [], [], [], [], []

    def face(self, points, uv=None, shade=1, smooth=False):
        index = len(self.vertices)
        self.vertices.extend(xyz(p) for p in points)
        self.faces.append(tuple(reversed(range(index, index + len(points)))))
        self.smooth.append(smooth)
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
        cap_uv=[(.5+.45*math.cos(i*math.tau/sides),.5+.45*math.sin(i*math.tau/sides)) for i in range(sides)]
        self.face(list(reversed(r0)), list(reversed(cap_uv)), shade)
        self.face(r1, cap_uv, shade)
        for i in range(sides):
            j = (i+1)%sides
            self.face([r0[i],r0[j],r1[j],r1[i]],[(i/sides,0),(j/sides,0),(j/sides,(b-a).length),(i/sides,(b-a).length)],shade,smooth=True)

    def path(self, points, radius, sides=6, shade=1):
        for a,b in zip(points,points[1:]):
            self.rod(a,b,radius,sides,shade)

    def profile(self, points, depth, thickness, shade=1, turn=False):
        """Extrude a counterclockwise x/height profile for shaped carved members."""
        area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))
        if area<0:points=list(reversed(points))
        front=[(x,depth+thickness/2,h) for x,h in points]
        back=[(x,depth-thickness/2,h) for x,h in points]
        def orient(ps):return [(p[1],p[0],p[2]) for p in reversed(ps)] if turn else ps
        uv=[(x*.45,h*.45) for x,h in points]
        self.face(orient(list(reversed(front))),uv if turn else list(reversed(uv)),shade)
        self.face(orient(back),list(reversed(uv)) if turn else uv,shade)
        for i in range(len(points)):
            j=(i+1)%len(points)
            self.face(orient([back[i],front[i],front[j],back[j]]),shade=shade)

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
            poly.use_smooth=self.smooth[poly.index]
            for loop_index in poly.loop_indices:
                uv.data[loop_index].uv = self.uvs[mesh.loops[loop_index].vertex_index]
        attr = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
        for i, value in enumerate(self.shades):
            attr.data[i].color = (value,value,value,1)
        bm=bmesh.new();bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
        bm.to_mesh(mesh);bm.free();mesh.update()
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
        length=(.94+level*.38)*scale
        yy=h+level*.16*scale
        # Broad bow-shaped arms carry the roof load, with visible stepped ends.
        shape=[(-.5,-.12),(-.39,-.13),(-.24,-.02),(.24,-.02),(.39,-.13),(.5,-.12),
               (.5,.06),(.32,.075),(.22,.18),(-.22,.18),(-.32,.075),(-.5,.06)]
        p.profile([(x+u*length,yy+v*scale) for u,v in shape],z,.29*scale,.96+level*.035)
        p.profile([(z+u*length,yy+.09*scale+v*scale) for u,v in shape],x,.27*scale,1.0,turn=True)
        for side in (-1,1):
            p.box((x+side*length*.36,z,yy+.14*scale),(.19*scale,.38*scale,.25*scale))
            p.box((x,z+side*length*.36,yy+.19*scale),(.32*scale,.18*scale,.21*scale))
    p.finish()
    trim=Part('Dougong_Edge','woodlight',parent)
    trim.box((x,z,h+.53*scale),(1.86*scale,.48*scale,.085*scale))
    for side in (-1,1):
        trim.box((x+side*.66*scale,z,h+.44*scale),(.20*scale,.37*scale,.085*scale))
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
        for yy in (row0,row0+(row1-row0)*.24,row0+(row1-row0)*.76,row1):
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
    detail_scale=min(1.0,halfwidth/3.5)
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
            height=eave+(ridge-eave)*(1-t)**1.65+detail_scale*(.38*t**8+.85*abs(u)**8*t**5)
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
                shade=.96+RNG.random()*.07
                for arc in range(4):
                    aa=arc/4;bb=(arc+1)/4
                    ua=u0+(u1-u0)*(.05+.90*aa);ub=u0+(u1-u0)*(.05+.90*bb)
                    ps=[]
                    for u,t,v in ((ua,t0,aa),(ub,t0,bb),(ub,t1,bb),(ua,t1,aa)):
                        x,z,h=point(face,u,t)
                        camber=.065*(max(.05,t) if face>=2 and not skirt else 1)
                        ps.append((x,z,h+.035+camber*math.sin(v*math.pi)))
                    # Sample the worn middle of a scanned tile; mesh edges define the joints.
                    tu=.200+(c%4)*.023;tv=.059+(r%5)*.040
                    uv=[(tu+aa*.010,tv),(tu+bb*.010,tv),(tu+bb*.010,tv+.020),(tu+aa*.010,tv+.020)]
                    if face in (1,2):ps.reverse();uv.reverse()
                    tiles.face(ps,uv,shade,smooth=True)
                if r==rows-1:
                    mid=(u0+u1)/2;x,z,h=point(face,mid,1)
                    direction=Vector((x,z,0)).normalized()
                    edge.rod((x,z,h+.035),(x+direction.x*.08,z+direction.y*.08,h+.035),.080,8,shade)
        points=[point(face,float(u),1) for u in np.linspace(-1,1,65)]
        timber.path([(x,z,h-.16*detail_scale) for x,z,h in points],.14*detail_scale,8)
        edge.path([(x,z,h+.035) for x,z,h in points],.044,6)
        # Eave rafter ends and corner hip seams.
        for u in np.linspace(-.98,.98,max(12,cols//2)):
            a=point(face,float(u),.89);b=point(face,float(u),1)
            timber.rod((a[0],a[1],a[2]-.24),(b[0],b[1],b[2]-.24),.069,6)
        if face<2:
            for side in (-1,1):
                points=[point(face,side,float(t)) for t in np.linspace(start,1,36)]
                ridge_part.path([(x,z,h+.15) for x,z,h in points],.13,9)

    if not skirt and halfwidth>2:
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
        # A solid ridge plaque and three carved silhouettes read at the review distance.
        crest_scale=min(1.0,halfwidth/10.0)
        ridge_part.box((0,0,ridge+.18),(max(.2,ridgehalf*2),.34,.35))
        for z in (-.19,.19):
            gold.path([(-ridgehalf+.15,z,ridge+.34),(ridgehalf-.15,z,ridge+.34)],.025,6)
        def crest(cx,base,s):
            outline=[(-.55,0),(-.54,.22),(-.35,.27),(-.46,.49),(-.43,.69),(-.28,.55),
                     (-.23,.88),(-.12,.78),(0,1.14),(.12,.78),(.23,.88),(.28,.55),
                     (.43,.69),(.46,.49),(.35,.27),(.54,.22),(.55,0)]
            # Reverse into a counterclockwise profile before extrusion.
            ridge_part.profile([(cx+x*s,base+h*s) for x,h in reversed(outline)],0,.24*s)
            for z in (-.145*s,.145*s):
                gold.path([(cx+x*s,z,base+h*s) for x,h in outline],.035*s,6)
                gold.path([(cx+.18*s*math.cos(t),z,base+.36*s+.22*s*math.sin(t)) for t in np.linspace(0,math.tau,29)],.03*s,6)
        crest(0,ridge+.33,1.28*crest_scale)
        for side in (-1,1):
            # Sweeping end scrolls carry a broader carved cheek than the ridge tube.
            cx=side*(ridgehalf+.16)
            profile=[(cx+side*u*crest_scale,ridge+.19+v*crest_scale) for u,v in
                     ((-.36,0),(.08,.10),(.39,.38),(.51,.82),(.36,1.17),(.12,1.28),(-.10,1.14),(.08,1.03),(.12,.83),(-.05,.63),(-.30,.49))]
            if side>0:profile.reverse()
            ridge_part.profile(profile,0,.30*crest_scale)
            for z in (-.17,.17):gold.path([(px,z,ph) for px,ph in profile],.023*crest_scale,6)
    surface.finish();tiles.finish();edge.finish();timber.finish();ridge_part.finish();gold.finish()


def oriented_bay(parent, centre, yaw, bottom, width, height, label, central=False):
    before=set(parent.children)
    facade_bay(parent,0,0,bottom,width,height,label,central)
    for ob in set(parent.children)-before:
        ob.rotation_euler.z=yaw
        ob.location=(centre[0],-centre[1],0)


def inset_panel(parent, cx, z, h, width, height, mat='stone', name='Carved_Panel'):
    face=Part(name,mat,parent)
    # Raised frame around the recessed carved field.
    for xx in (cx-width/2,cx+width/2):face.box((xx,z,h),(.10,.12,height))
    for yy in (h-height/2,h+height/2):face.box((cx,z,yy),(width,.12,.10))
    a=min(width,height)*.34
    points=[]
    for t in np.linspace(0,math.tau,49):
        radius=a*(.82+.13*math.cos(t*4))
        points.append((cx+radius*math.cos(t),z+.072,h+radius*math.sin(t)))
    face.path(points,.032,6)
    for sign in (-1,1):
        face.path([(cx+sign*width*.31,z+.074,h-height*.22),(cx+sign*width*.39,z+.074,h),
                   (cx+sign*width*.31,z+.074,h+height*.22)],.028,5)
    face.finish()


def stone_balustrade(parent, points, base_height, name='Platform_Balustrade'):
    stone=Part(name,'stone',parent)
    recess=Part(name+'_Recess','stonedark',parent)
    for x,z in points:
        stone.box((x,z,base_height+.10),(.55,.55,.20))
        stone.box((x,z,base_height+.68),(.28,.28,1.15))
        stone.box((x,z,base_height+1.27),(.46,.46,.16))
        stone.rod((x,z,base_height+1.34),(x,z,base_height+1.48),.16,8,end_radius=.055)
    for a,b in zip(points,points[1:]):
        for h in (.29,.91,1.12):
            stone.rod((a[0],a[1],base_height+h),(b[0],b[1],base_height+h),.075,6)
        for f in (.25,.50,.75):
            x=a[0]+(b[0]-a[0])*f;z=a[1]+(b[1]-a[1])*f
            stone.box((x,z,base_height+.60),(.08,.08,.52))
    stone.finish();recess.finish()


def platform(parent,w,d,height,stair_width,step_count):
    foundation(parent,w,d,height)
    stair=Part('Wide_Entrance_Steps','stone',parent)
    tread=.43
    for i in range(step_count):
        h=height*(i+1)/step_count
        z=d/2+(step_count-i-.5)*tread
        stair.box((0,z,h/2),(stair_width,tread+.015,h),.96+RNG.random()*.07)
        stair.box((0,z+tread*.39,h-.024),(stair_width+.06,.075,.075),1.02)
    stair.finish()
    cheeks=Part('Stair_Cheek_Stones','stone',parent)
    for sign in (-1,1):
        x=sign*(stair_width/2+.28)
        for i in range(step_count):
            h=height*(i+1)/step_count+.30;z=d/2+(step_count-i-.5)*tread
            cheeks.box((x,z,h/2),(.48,tread+.025,h))
        cheeks.box((x,d/2-.10,height+.31),(.75,.80,.62))
    cheeks.finish()
    # The long outer gallery has a clear central stair opening.
    for sign in (-1,1):
        start=stair_width/2+.8;stop=w/2-.4
        xs=np.linspace(start,stop,max(2,round((stop-start)/2.2)+1))
        stone_balustrade(parent,[(sign*float(x),d/2-.55) for x in xs],height)
        zs=np.linspace(-d/2+.55,d/2-.55,max(3,round(d/2.3)))
        stone_balustrade(parent,[(sign*(w/2-.5),float(z)) for z in zs],height)
    stone_balustrade(parent,[(float(x),-d/2+.55) for x in np.linspace(-w/2+.5,w/2-.5,max(4,round(w/2.3)))],height)
    for side in (-1,1):
        for x in np.linspace(-w/2+1.5,w/2-1.5,round(w/3)):
            if side>0 and abs(x)<stair_width/2+.6:continue
            inset_panel(parent,float(x),side*(d/2+.015),height*.50,2.35,height*.59)


def beam_reliefs(parent, x, z, h, width):
    trim=Part('Beam_Carved_Clouds','gold',parent)
    for sign in (-1,1):
        points=[]
        for t in np.linspace(0,math.pi*1.7,22):
            r=.20*(1-t/(math.pi*2.3))
            points.append((x+sign*(width*.26+r*math.cos(t)),z,h+r*math.sin(t)))
        trim.path(points,.023,5)
    trim.path([(x-width*.39,z,h-.10),(x-width*.1,z,h-.08),(x,z,h+.065),
               (x+width*.1,z,h-.08),(x+width*.39,z,h-.10)],.021,5)
    trim.finish()


def hanging_banner(parent,x,z,top):
    p=Part('Hanging_Linen_Banner','banner',parent)
    width=1.10;height=3.68
    for i in range(14):
        for j in range(5):
            def point(k,t):
                u=-.5+k/5;v=t/14
                return (x+u*width,z+.045*math.sin(u*9+v*4),top-v*height)
            p.face([point(j,i),point(j+1,i),point(j+1,i+1),point(j,i+1)],shade=.98+RNG.random()*.04)
    p.finish()
    bar=Part('Banner_Timber_Bars','dark',parent)
    bar.rod((x-.66,z,top+.02),(x+.66,z,top+.02),.045,8)
    bar.rod((x-.52,z,top-height),(x+.52,z,top-height),.035,8)
    bar.finish()
    ink=Part('Banner_Embroidered_Emblem','ink',parent)
    h=top-1.75
    for r in (.29,.34):ink.path([(x+r*math.cos(t),z+.075,h+r*math.sin(t)) for t in np.linspace(0,math.tau,49)],.014,5)
    for i in range(6):
        a=i*math.tau/6
        ink.path([(x,z+.08,h),(x+.24*math.cos(a),z+.08,h+.24*math.sin(a)),
                  (x+.14*math.cos(a+.5),z+.08,h+.14*math.sin(a+.5))],.014,5)
    ink.finish()


def build_hall():
    parent=root_object('MainHall')
    platform(parent,33.8,21.0,2.2,11.0,13)
    box_part('Lower_Closed_Walls','plaster',parent,[((0,-.2,4.62),(25.6,12.0,4.84))])
    box_part('Upper_Closed_Walls','dark',parent,[((0,-.2,10.43),(25.0,11.7,4.66))])
    box_part('Upper_Gallery_Floor','wood',parent,[((0,0,8.13),(28.0,15.0,.42)),((0,0,7.81),(27.6,14.5,.20))])
    bay=25.2/7
    for i in range(7):
        cx=(i-3)*bay
        oriented_bay(parent,(cx,5.93),0,2.31,bay-.20,4.64,'Front_Lower_%02d'%i,central=i==3)
        oriented_bay(parent,(cx,-6.28),math.pi,2.31,bay-.20,4.64,'Back_Lower_%02d'%i)
        oriented_bay(parent,(cx,5.84),0,8.46,bay-.24,3.51,'Front_Upper_%02d'%i)
        oriented_bay(parent,(cx,-6.13),math.pi,8.46,bay-.24,3.51,'Back_Upper_%02d'%i)
    for side in (-1,1):
        for i in range(4):
            zz=-4.55+i*3.0
            oriented_bay(parent,(side*12.91,zz),side*math.pi/2,2.31,2.80,4.64,'Side_Lower')
            oriented_bay(parent,(side*12.62,zz),side*math.pi/2,8.46,2.8,3.51,'Side_Upper')
    for i in range(8):
        x=-13.50+i*27/7
        for side in (-1,1):
            column(parent,x,side*8.20,2.2,7.38,.31,'Lower_Colonnade_Column')
            brackets(parent,x,side*8.20,6.97,1.05)
            column(parent,x*.963,side*6.78,8.34,12.72,.25,'Upper_Gallery_Column')
            brackets(parent,x*.963,side*6.78,12.25,.99)
        if i<7:
            beam_reliefs(parent,x+27/14,8.41,7.27,3.45)
            beam_reliefs(parent,x+27/14,6.98,12.53,3.38)
    for side in (-1,1):
        for z in (-5.47,-2.73,0,2.73,5.47):
            column(parent,side*13.5,z,2.2,7.38,.30,'Side_Colonnade_Column')
            brackets(parent,side*13.5,z,6.97,1.05)
            column(parent,side*13.0,z,8.34,12.72,.245,'Side_Upper_Column')
            brackets(parent,side*13.0,z,12.25,.98)
    beam=Part('Gallery_Structural_Beams','wood',parent)
    trim=Part('Carved_Beam_Moldings','woodlight',parent)
    for h,z,w in ((7.19,8.22,28.2),(7.63,8.28,28.4),(12.47,6.81,27.6),(12.87,6.89,27.8)):
        for side in (-1,1):
            beam.box((0,side*z,h),(w,.42,.37))
            trim.box((0,side*(z+.22),h+.08),(w,.034,.048))
    for side in (-1,1):
        for h,x,d in ((7.19,13.52,17),(7.63,13.58,17.2),(12.47,13.02,14.2)):
            beam.box((side*x,0,h),(.42,d,.37))
    beam.finish();trim.finish()
    railing(parent,27.8,14.65,8.38)
    roof(parent,'Broad_Lower_Eave',15.65,9.78,7.14,9.18,0,skirt=True,inner=(12.5,5.8))
    roof(parent,'Great_Upper_Roof',15.15,8.45,12.82,18.61,10.8)
    medallion(parent,6.17,4.56,1.52)
    for x in (-9.64,-3.86,3.86,9.64):hanging_banner(parent,x,8.40,7.24)
    plaque=Part('Main_Entrance_Plaque','dark',parent);plaque.box((0,8.26,7.22),(3.4,.20,.5));plaque.finish()
    for i in range(7):
        x=(i-3)*3.6
        inset_panel(parent,x,5.995,3.0,2.9,.73,'woodlight','Lower_Door_Reliefs')
    return parent


def build_pavilion():
    parent=root_object('SidePavilion')
    platform(parent,13.4,11.6,1.55,5.0,8)
    box_part('Pavilion_Closed_Lower','plaster',parent,[((0,-.2,3.55),(9.1,7.4,4.0))])
    box_part('Pavilion_Closed_Upper','dark',parent,[((0,-.10,7.0),(7.65,6.0,2.8))])
    box_part('Pavilion_Gallery_Floor','wood',parent,[((0,0,5.60),(10.6,8.9,.33))])
    for i in range(3):
        x=(i-1)*2.84
        for side in (-1,1):
            oriented_bay(parent,(x,side*3.66),0 if side>0 else math.pi,1.65,2.65,3.45,'Pavilion_Lower',central=i==1 and side>0)
            oriented_bay(parent,(x*.80,side*3.02),0 if side>0 else math.pi,5.89,2.10,2.08,'Pavilion_Upper')
    for side in (-1,1):
        for z in (-2.4,0,2.4):oriented_bay(parent,(side*4.62,z),side*math.pi/2,1.65,2.22,3.45,'Pavilion_Side')
    for x in (-4.68,-1.56,1.56,4.68):
        for side in (-1,1):
            column(parent,x,side*4.69,1.55,5.35,.21,'Pavilion_Lower_Column');brackets(parent,x,side*4.69,5.0,.74)
            column(parent,x*.84,side*3.48,5.82,8.32,.17,'Pavilion_Upper_Column');brackets(parent,x*.84,side*3.48,7.94,.69)
    railing(parent,10.05,8.44,5.84)
    roof(parent,'Pavilion_Lower_Roof',6.30,5.28,5.05,6.45,0,tile_width=.28,skirt=True,inner=(3.89,2.94))
    roof(parent,'Pavilion_Upper_Roof',5.73,4.80,8.34,11.50,2.85,tile_width=.28)
    return parent


def build_bridge():
    parent=root_object('StoneBridge')
    def deck(z):return 1.30+3.65*max(0,1-(z/11.5)**2)
    # Segmental stone arch, with a genuine passage under the middle span.
    wall=Part('Arch_Voussoirs','stone',parent)
    for side in (-1,1):
        x0,x1=sorted((side*3.15,side*3.75))
        for i in range(36):
            z0=-11.5+i*23/36+.018;z1=-11.5+(i+1)*23/36-.018
            def inner(z):return .30 if abs(z)>9.7 else .75+3.25*math.sqrt(max(0,1-(z/9.7)**2))
            ring=[(z0,inner(z0)),(z1,inner(z1)),(z1,deck(z1)-.18),(z0,deck(z0)-.18)]
            vs=[(x,z,h) for x in (x0,x1) for z,h in ring]
            for ids in ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)):
                wall.face([vs[i] for i in ids],shade=.91+RNG.random()*.16)
    wall.finish()
    stones=Part('Bridge_Deck_Pavers','stone',parent)
    for i in range(46):
        z0=-11.5+i*.5;z1=z0+.49
        for j in range(7):
            x0=-3.5+j; x1=x0+.97
            a=(x0,z0,deck(z0));b=(x1,z0,deck(z0));c=(x1,z1,deck(z1));d=(x0,z1,deck(z1))
            stones.face([a,b,c,d],shade=.92+RNG.random()*.15)
            stones.face([(a[0],a[1],a[2]-.28),(b[0],b[1],b[2]-.28),b,a])
    for side in (-1,1):
        for z in (-10.9,10.9):stones.box((side*3.43,z,.45),(1.05,1.6,.9))
    stones.finish()
    vault=Part('Bridge_Arch_Vault','stone',parent)
    for i in range(48):
        za=-9.7+i*19.4/48;zb=za+19.4/48
        ha=.75+3.25*math.sqrt(max(0,1-(za/9.7)**2))
        hb=.75+3.25*math.sqrt(max(0,1-(zb/9.7)**2))
        vault.face([(-3.15,za,ha),(-3.15,zb,hb),(3.15,zb,hb),(3.15,za,ha)],
                   [(0,za*.5),(0,zb*.5),(3.15,zb*.5),(3.15,za*.5)])
    vault.finish()
    rails=Part('Bridge_Stone_Balustrades','stone',parent)
    for side in (-1,1):
        x=side*3.57
        zs=np.linspace(-11.2,11.2,11)
        for z in zs:
            h=deck(float(z));rails.box((x,float(z),h+.63),(.31,.35,1.26));rails.box((x,float(z),h+1.30),(.52,.55,.14))
            rails.rod((x,float(z),h+1.40),(x,float(z),h+1.54),.15,10,end_radius=.055)
        for za,zb in zip(zs,zs[1:]):
            for dh in (.33,1.15):rails.path([(x,float(z),deck(float(z))+dh) for z in np.linspace(za,zb,8)],.095,8)
            for f in (.25,.5,.75):
                z=za+(zb-za)*f;h=deck(float(z));rails.box((x,float(z),h+.72),(.09,.085,.69))
    rails.finish()
    return parent


def build_lantern():
    parent=root_object('StoneLantern')
    p=Part('Lantern_Carved_Base','stone',parent)
    for z,h,w,d in ((0,.12,1.10,.24),(0,.31,.83,.14),(0,.47,.66,.18),(0,1.05,.46,1.0),(0,1.62,.80,.20),(0,1.79,1.0,.14)):
        p.box((0,z,h),(w,w,d))
    p.finish()
    for side in (-1,1):inset_panel(parent,0,side*.235,1.07,.31,.68,'stonedark','Lantern_Pedestal_Relief')
    body=Part('Lantern_Housing','stone',parent)
    for x in (-.39,.39):
        for z in (-.39,.39):body.box((x,z,2.13),(.12,.12,.65))
    body.box((0,0,2.48),(1.0,1.0,.18));body.finish()
    glass=Part('Lantern_Inset_Glass','lamp',parent);glass.box((0,0,2.13),(.63,.63,.55));glass.finish()
    roof(parent,'Lantern_Pagoda_Cap',.79,.79,2.55,3.05,0,tile_width=.14)
    finial=Part('Lantern_Crown','stone',parent)
    finial.rod((0,0,3.05),(0,0,3.26),.13,12,end_radius=.025);finial.finish()
    return parent



# Native authoring file: each asset has its own collection and separate construction parts.
assets=[('hall',build_hall()),('pavilion',build_pavilion()),('bridge',build_bridge()),('lantern',build_lantern())]
for index,(_,root) in enumerate(assets):root.location.x=index*48
bpy.context.view_layer.update()
for ob in list(bpy.data.objects):
    if ob.type=='MESH' and any(k in ob.name for k in ('Foundation_Courses','Entrance_Steps','Carved_Base','Stair_Cheek','Tie_Beams','Structural_Beams')):
        bevel=ob.modifiers.new('Worn_Small_Edge','BEVEL');bevel.width=.022;bevel.segments=2;bevel.limit_method='ANGLE'
bpy.context.scene['design_board']='docs/art/asset-review-20261013/main-hall-design.png'
bpy.context.scene['units']='metres; +Y up and +Z entrance after GLB export'
bpy.context.scene['layout']='Seven front bays, symmetric side galleries, closed exterior on all four sides'
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
        verts=[];faces=[];uvs=[];shades=[];smooth=[]
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
                smooth.append(poly.use_smooth)
                uvs.extend(tuple(layer.data[i].uv) if layer else (0,0) for i in poly.loop_indices)
            for v in mesh.vertices:
                shades.append(tuple(attr.data[v.index].color) if attr and attr.domain=='POINT' else (1,1,1,1))
            evaluated.to_mesh_clear()
        mesh=bpy.data.meshes.new(source.name+'_'+name)
        mesh.from_pydata(verts,[],faces)
        mesh.materials.append(bpy.data.materials[name])
        mesh.update()
        for i,poly in enumerate(mesh.polygons):poly.use_smooth=smooth[i]
        layer=mesh.uv_layers.new(name='UVMap')
        for i,uv in enumerate(uvs):layer.data[i].uv=uv
        attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
        for i,c in enumerate(shades):attr.data[i].color=c
        # glTF tangent generation requires triangles for concave carved profiles and caps.
        bm=bmesh.new();bm.from_mesh(mesh)
        bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY')
        bm.to_mesh(mesh);bm.free();mesh.update()
        # Tiny bevel faces inherit coincident UVs at sharp corners. Give those faces
        # a local planar projection so the exported normal-map frame is defined.
        layer=mesh.uv_layers.active
        for poly in mesh.polygons:
            loops=list(poly.loop_indices)
            a,b,c=[layer.data[i].uv.copy() for i in loops]
            signed=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
            if abs(signed)<1e-9:
                axis=max(range(3),key=lambda i:abs(poly.normal[i]))
                axes=[i for i in range(3) if i!=axis]
                for loop in loops:
                    point=mesh.vertices[mesh.loops[loop].vertex_index].co
                    layer.data[loop].uv=(point[axes[0]]*.65,point[axes[1]]*.65)
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



def export_asset(path,root):
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:child.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=True,
        export_materials='EXPORT',export_vertex_color='NAME',export_vertex_color_name='Color',
        export_cameras=False,export_lights=False,export_animations=False,export_extras=True)
    # Keep the simple PBR tint shared by Blender and glTF, including exporters that
    # serialize the linked image but omit the multiply node's constant factor.
    data=path.read_bytes();json_length=struct.unpack_from('<I',data,12)[0]
    document=json.loads(data[20:20+json_length]);binary=data[28+json_length:]
    for item in document.get('materials',[]):
        material=bpy.data.materials.get(item['name'])
        if material and 'assetBaseColorFactor' in material:
            item.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=list(material['assetBaseColorFactor'])
    packed=json.dumps(document,separators=(',',':')).encode();packed+=b' '*((-len(packed))%4)
    path.write_bytes(struct.pack('<III',0x46546C67,2,28+len(packed)+len(binary))+
                     struct.pack('<II',len(packed),0x4E4F534A)+packed+
                     struct.pack('<II',len(binary),0x004E4942)+binary)

results=[]
for filename,source in assets:
    runtime,metrics=merged_export_asset(source)
    name=source.name;source.name=name+'_Editable';runtime.name=name
    export_asset(OUT/(filename+'.glb'),runtime)
    metrics['file']=filename+'.glb';results.append(metrics)
manifest={'schema':1,'reference':'docs/art/asset-review-20261013/main-hall-design.png',
          'units':'metres','axes':{'up':'+Y','front':'+Z'},'assets':results,
          'files':{},'verification':{'structure':'pending readback','visual':'viewer inspection pending'},
          'textureSources':'textures/sources.json'}
for path in [OUT/'architecture.blend']+[OUT/(name+'.glb') for name,_ in assets]:
    manifest['files'][path.name]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('ASSET_ARCHITECTURE_COMPLETE '+json.dumps(results))
