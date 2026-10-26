"""Author the independent qingshan disciple review asset (Blender 5.x, CPU).

Blender -Y faces forward; glTF export maps it to +Z, with Y up.
Run: Blender --background --python archive/prototypes/three_style_showcase/blender/build_asset_character.py
The saved .blend retains separate named clothing, face and hair meshes and a rig.
"""
from pathlib import Path
import math, json
import bpy, bmesh
import numpy as np
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'archive/prototypes/three_style_showcase/assets/asset-review/character'
OUT.mkdir(parents=True, exist_ok=True)
PARTS = []
M = {}
TAU = math.tau


def material(name, color, rough=.75, metal=0, fabric=False):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if bs is None:bs=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    output=next((n for n in m.node_tree.nodes if n.type=='OUTPUT_MATERIAL'),None)
    if output is None:output=m.node_tree.nodes.new('ShaderNodeOutputMaterial')
    m.node_tree.links.new(bs.outputs['BSDF'],output.inputs['Surface'])
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    if fabric:
        bs.inputs['Sheen Weight'].default_value=.035
        bs.inputs['Specular IOR Level'].default_value=.16
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=CLOTH_NORMAL
        normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.075
        m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color'])
        m.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
    return m


def fabric_normal():
    n=512;y,x=np.mgrid[0:n,0:n]
    h=.15*np.sin(x*TAU/8)+.15*np.sin(y*TAU/8)+.045*np.sin((x+y)*TAU/31)
    dx=np.roll(h,-1,1)-np.roll(h,1,1);dy=np.roll(h,-1,0)-np.roll(h,1,0)
    a=np.stack((-dx,-dy,np.ones_like(h)),axis=-1);a/=np.linalg.norm(a,axis=-1,keepdims=True)
    rgba=np.concatenate((a*.5+.5,np.ones((n,n,1))),axis=-1).astype(np.float32)
    image=bpy.data.images.new('Woven thread tangent normal',width=n,height=n,alpha=True)
    image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw=str(OUT/'cloth-normal.png');image.file_format='PNG';image.save();image.pack()
    return image


def bind(obj, weights):
    groups={}
    for v in obj.data.vertices:
        values=weights(v.co) if callable(weights) else {weights:1}
        total=sum(values.values())
        for name,w in values.items():
            if w>1e-5:
                if name not in groups:groups[name]=obj.vertex_groups.new(name=name)
                groups[name].add([v.index],w/total,'REPLACE')
    PARTS.append(obj);return obj


def mesh(name,verts,faces,mat,weights,uvs=None,smooth=True):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    uv=data.uv_layers.new(name='UVMap')
    for p in data.polygons:
        p.use_smooth=smooth
        for li in p.loop_indices:
            vi=data.loops[li].vertex_index;co=data.vertices[vi].co
            uv.data[li].uv=uvs[vi] if uvs else (co.x*2.5+co.y*1.3,co.z*2.5)
    bm=bmesh.new();bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0000003)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    return bind(obj,weights)


def sphere(name,center,scale,mat,weights,segments=24,rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=center)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return bind(o,weights)


def tube(name,centers,radii,mat,weights,sides=12,caps=True):
    vs=[];fs=[];uv=[];length=0
    for i,point in enumerate(centers):
        p=Vector(point)
        if i:length+=(p-Vector(centers[i-1])).length
        tangent=(Vector(centers[min(i+1,len(centers)-1)])-Vector(centers[max(0,i-1)])).normalized()
        a=tangent.cross(Vector((0,1,0)))
        if a.length<.01:a=tangent.cross(Vector((1,0,0)))
        a.normalize();b=tangent.cross(a).normalized()
        rx,ry=radii[i] if isinstance(radii[i],tuple) else (radii[i],radii[i])
        for j in range(sides+1):
            angle=TAU*j/sides
            vs.append(tuple(p+a*math.cos(angle)*rx+b*math.sin(angle)*ry));uv.append((j/sides,length*3))
    n=sides+1
    for i in range(len(centers)-1):
        for j in range(sides):fs.append((i*n+j,i*n+j+1,(i+1)*n+j+1,(i+1)*n+j))
    if caps:fs.extend([tuple(reversed(range(sides))),tuple((len(centers)-1)*n+j for j in range(sides))])
    return mesh(name,vs,fs,mat,weights,uv)


def surface(name,levels,fn,mat,weights,sides=64,angle0=0,angle1=TAU,thickness=0):
    vs=[];fs=[];uv=[]
    for i in range(levels):
        v=i/(levels-1)
        for j in range(sides+1):
            a=angle0+(angle1-angle0)*j/sides
            vs.append(fn(a,v));uv.append((j/sides*2,v*3))
    for i in range(levels-1):
        for j in range(sides):
            a=i*(sides+1)+j;fs.append((a,a+1,a+sides+2,a+sides+1))
    obj=mesh(name,vs,fs,mat,weights,uv)
    if thickness:
        mod=obj.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=thickness;mod.offset=0
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def strip(name,points,width,mat,weights,thickness=.002):
    vs=[]
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
        edge=Vector((tangent.z,0,-tangent.x)).normalized()*width/2
        vs.extend([tuple(Vector(p)-edge),tuple(Vector(p)+edge)])
    fs=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)]
    obj=mesh(name,vs,fs,mat,weights)
    if thickness:
        mod=obj.modifiers.new('Folded seam thickness','SOLIDIFY');mod.thickness=thickness
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def body_weights(co):
    b=max(0,min(1,(co.z-1.03)/.25));return {'hips':1-b,'chest':b}


def skirt_weights(co):
    a=math.atan2(co.x,-co.y)%TAU
    ix=a/TAU*8;lo=int(ix)%8;f=ix-int(ix)
    influence=max(0,min(.96,(1.08-co.z)/.33))
    return {'hips':1-influence,f'skirt.{lo}':influence*(1-f),f'skirt.{(lo+1)%8}':influence*f}


def arm_weights(side):
    def fn(co):
        v=max(0,min(1,(1.21-co.z)/.12));return {'upper_arm.'+side:1-v,'forearm.'+side:v}
    return fn


def leg_weights(side):
    def fn(co):
        v=max(0,min(1,(.58-co.z)/.15));return {'thigh.'+side:1-v,'shin.'+side:v}
    return fn


def profile(z,rows):
    for i in range(len(rows)-1):
        if z<=rows[i+1][0]:
            t=max(0,(z-rows[i][0])/(rows[i+1][0]-rows[i][0]));return [a*(1-t)+b*t for a,b in zip(rows[i][1:],rows[i+1][1:])]
    return rows[-1][1:]


def torso():
    rows=[(1.015,.145,.087),(1.08,.151,.092),(1.22,.178,.105),(1.355,.207,.091),(1.39,.199,.082),(1.418,.145,.068),(1.451,.057,.050)]
    def shape(a,v,offset=0):
        z=1.015+.436*v;rx,ry=profile(z,rows)
        fold=.0035*math.sin(11*a+3*v)*math.sin(math.pi*v)
        return (math.sin(a)*(rx+offset+fold),-math.cos(a)*(ry+offset+fold),z)
    surface('Ivory inner tunic',32,lambda a,v:shape(a,v,-.012),M['ivory'],body_weights)
    surface('Continuous torso shoulders and neck opening',42,shape,M['cloth'],body_weights,thickness=.003)
    tube('Neck',[(0,0,1.397),(0,0,1.455),(0,-.002,1.515)],[.052,.053,.057],M['skin'],'neck',32)
    def front(x,z,lift=.004):
        rx,ry=profile(z,rows)
        a=math.asin(max(-.99,min(.99,x/rx)))
        v=(z-1.015)/.436
        fold=.0035*math.sin(11*a+3*v)*math.sin(math.pi*v)
        return -math.sqrt(max(.00002,1-(x/(rx+fold))**2))*(ry+fold)-lift
    def fitted_strip(name,xz,width,mat,lift):
        dense=[]
        for i in range(len(xz)-1):
            for t in np.linspace(0,1,8,endpoint=False):
                dense.append((xz[i][0]*(1-t)+xz[i+1][0]*t,xz[i][1]*(1-t)+xz[i+1][1]*t))
        dense.append(xz[-1])
        points=[(x,front(x,z,lift),z) for x,z in dense]
        obj=strip(name,points,width,mat,body_weights,0)
        # Project both edges as well as the spine onto the same curved torso.
        for vert in obj.data.vertices:vert.co.y=front(vert.co.x,vert.co.z,lift)
        # Add thickness only after projection so front/back surfaces stay separated.
        mod=obj.modifiers.new('Folded collar thickness','SOLIDIFY');mod.thickness=.0015;mod.offset=0
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
        return obj
    # Visible ivory chest cloth forms a continuous V inset between the two lapels.
    inset=[];faces=[]
    for i in range(27):
        v=i/26;z=1.235+.209*v;width=.004+.043*math.sin(v*math.pi/2)
        for j in range(9):
            x=(j/8*2-1)*width;inset.append((x,front(x,z,.004),z))
    for i in range(26):
        for j in range(8):
            k=i*9+j;faces.append((k,k+1,k+10,k+9))
    mesh('Continuous ivory chest inset',inset,faces,M['ivory'],body_weights)
    # Soft fitted cross collar; the two bands share the actual chest curvature.
    for sign in [-1,1]:
        p=[(sign*.038,1.45),(sign*.059,1.413),(sign*.073,1.373),(sign*.063,1.333),(sign*.026,1.267),(-sign*.040,1.17)]
        fitted_strip('Ivory folded lapel '+str(sign),p,.029,M['ivory'],.010+(.003 if sign==1 else 0))
        p2=[(sign*.061,1.436),(sign*.086,1.404),(sign*.106,1.366),(sign*.095,1.324),(sign*.057,1.255),(-sign*.011,1.144)]
        fitted_strip('Outer collar facing '+str(sign),p2,.026,M['facing'],.007)
        seam=[(x+sign*.011,front(x+sign*.011,z,.009),z) for x,z in p2]
        tube('Facing stitched edge',seam,[.0008]*len(seam),M['thread'],body_weights,6)
    # Woven sash with subtly irregular horizontal wraps.
    def sash(a,v):
        z=1.015+.095*v;ripple=.003*math.sin(v*TAU*4+a*.8)
        return (math.sin(a)*(.155+ripple),-math.cos(a)*(.102+ripple),z)
    surface('Wrapped waist sash',28,sash,M['sash'],'hips',64,thickness=.004)
    for z in [1.02,1.04,1.061,1.08,1.104]:
        tube('Sash folded ridge',[(math.sin(a)*.16,-math.cos(a)*.106,z+.003*math.sin(2*a)) for a in np.linspace(0,TAU,65)],[.0023]*65,M['facing'],'hips',6)
    sphere('Sash knot',(.101,-.096,1.05),(.023,.022,.029),M['facing'],'hips',20,12)
    strip('Hanging sash',[(.103,-.113,1.048),(.116,-.132,.94),(.111,-.147,.83),(.121,-.16,.745)],.047,M['facing'],skirt_weights)
    for dx in [-.019,.019]:tube('Sash edge',[(.103+dx,-.117,1.048),(.116+dx,-.136,.94),(.111+dx,-.151,.83),(.121+dx,-.164,.745)],[.001]*4,M['thread'],skirt_weights,6)


def robe():
    def skirt(a,v,inner=False):
        z=.267+.80*v
        rx=.271*(1-v)+.144*v;ry=.169*(1-v)+.088*v
        folds=(.009*math.cos(12*a+.3*math.sin(v*3))+.004*math.sin(21*a+v))*(1-v)**.75
        if inner:rx-=.018;ry-=.014;z-=.014
        return (math.sin(a)*(rx+folds),-math.cos(a)*(ry+folds)+.007*(1-v),z+.011*math.sin(a*3)*(1-v)**3)
    surface('Ivory split under robe',48,lambda a,v:skirt(a,v,True),M['ivory'],skirt_weights,72,.045,TAU-.045,.003)
    surface('Pleated blue green outer coat',56,skirt,M['cloth'],skirt_weights,96,.23,TAU-.23,.004)
    # Split edging follows the same actual silhouette and folds.
    for a in [.23,TAU-.23]:
        centers=[]
        for v in np.linspace(0,1,45):
            x,y,z=skirt(a,v);centers.append((x,y-.002,z))
        tube('Front opening bound edge',centers,[.0035]*45,M['facing'],skirt_weights,8)
        tube('Front opening stitching',[(x+.002,y-.004,z) for x,y,z in centers],[.0009]*45,M['thread'],skirt_weights,6)
    for v in [.015,.053]:
        centers=[skirt(a,v) for a in np.linspace(.23,TAU-.23,130)]
        tube('Coat hem piping',centers,[.0017]*130,M['thread'],skirt_weights,6)
    # A restrained repeated embroidered cloudline is actual narrow raised geometry.
    for center in [1.0,2.1,3.15,4.15,5.25]:
        centers=[]
        for u in np.linspace(-.32,.32,60):
            a=center+u;v=.08+.022*math.sin(u*14)+.008*math.sin(u*37)
            x,y,z=skirt(a,v);centers.append((x*1.006,y*1.009,z))
        tube('Hem cloud embroidery',centers,[.001]*60,M['thread'],skirt_weights,6)


def limbs():
    for sign,side in [(1,'R'),(-1,'L')]:
        x=sign*.087
        tube('Trousers '+side,[(x,0,.99),(x,-.003,.79),(x,-.007,.56),(x,0,.37),(x,0,.21)],[(.075,.07),(.072,.067),(.057,.055),(.049,.049),(.043,.047)],M['trousers'],leg_weights(side),24)
        tube('Leather boot shaft '+side,[(x,0,.11),(x,0,.24),(x,0,.36)],[.05,.052,.056],M['leather'],'shin.'+side,24)
        # Shoe outlines have flat sole z=0 and a separate stitched welt.
        vs=[];fs=[]
        for y,w,top in [(-.178,.015,.044),(-.16,.041,.066),(-.12,.051,.088),(-.035,.055,.098),(.047,.050,.09),(.07,.028,.061)]:
            for j in range(25):
                a=TAU*j/24;vs.append((x+math.cos(a)*w,y,.014+max(0,math.sin(a))*top))
        for i in range(5):
            for j in range(24):k=i*25+j;fs.append((k,k+1,k+26,k+25))
        mesh('Shaped leather shoe '+side,vs,fs,M['leather'],'foot.'+side)
        sphere('Flat boot sole '+side,(x,-.047,.011),(.056,.119,.011),M['sole'],'foot.'+side,32,10)
        tube('Boot welt '+side,[(x+math.sin(a)*.055,-.047-math.cos(a)*.118,.025) for a in np.linspace(0,TAU,49)],[.0014]*49,M['thread'],'foot.'+side,6)
        for z in [.14,.19,.25,.31]:
            tube('Boot wrapping '+side,[(x-.05,-.010,z-.019),(x,-.055,z),(x+.05,-.010,z+.014)],[.003]*3,M['facing'],'shin.'+side,8)
        shoulder=(sign*.184,0,1.40);elbow=(sign*.292,-.006,1.169);wrist=(sign*.349,-.024,.976)
        centers=[shoulder,(sign*.227,0,1.331),(sign*.265,-.003,1.249),elbow,(sign*.322,-.015,1.065),wrist]
        tube('Sleeve underlayer '+side,centers,[(.059,.063),(.060,.067),(.055,.059),(.045,.048),(.039,.044),(.031,.033)],M['facing'],arm_weights(side),24)
        # Curved sleeve volume begins inside the shoulder and widens with a hanging lower edge.
        path=[(sign*.144,0,1.384),(sign*.185,0,1.398),(sign*.229,-.003,1.337),(sign*.276,-.007,1.245),(sign*.303,-.010,1.157),(sign*.321,-.014,1.095)]
        radii=[(.045,.056),(.068,.071),(.080,.075),(.087,.078),(.095,.080),(.103,.081)]
        def sleeve_surface(inward=0,start_v=0):
            vs=[];fs=[];uv=[];levels=38;sides=48
            for i in range(levels):
                v=start_v+(1-start_v)*i/(levels-1);f=v*(len(path)-1);lo=min(len(path)-2,int(f));mix=f-lo
                p=Vector(path[lo]).lerp(Vector(path[lo+1]),mix)
                tangent=(Vector(path[lo+1])-Vector(path[lo])).normalized()
                a=tangent.cross(Vector((0,1,0))).normalized();b=tangent.cross(a).normalized()
                rx=radii[lo][0]*(1-mix)+radii[lo+1][0]*mix-inward
                ry=radii[lo][1]*(1-mix)+radii[lo+1][1]*mix-inward
                for j in range(sides+1):
                    angle=TAU*j/sides
                    ripple=(.0055*math.sin(angle*7+v*3)+.0025*math.sin(angle*13-v*5))*math.sin(math.pi*v*.85)
                    q=p+a*math.cos(angle)*(rx+ripple)+b*math.sin(angle)*(ry+ripple)
                    q.z-=.012*math.sin(math.pi*v)+.012*(1-math.cos(angle))*v*v
                    vs.append(tuple(q));uv.append((j/sides*1.5,v*1.4))
            for i in range(levels-1):
                for j in range(sides):
                    k=i*(sides+1)+j;fs.append((k,k+1,k+sides+2,k+sides+1))
            if start_v==0:fs.append(tuple(reversed(range(sides))))
            return vs,fs,uv
        verts,faces_,uvs=sleeve_surface()
        mesh('Draped broad sleeve '+side,verts,faces_,M['cloth'],arm_weights(side),uvs)
        iv,ifa,iu=sleeve_surface(.003,.73)
        mesh('Visible sleeve lining '+side,iv,ifa,M['facing'],arm_weights(side),iu)
        outer=verts[-49:];inner=iv[-49:]
        rim=mesh('Folded sleeve cuff '+side,outer+inner,[(j,j+1,50+j,49+j) for j in range(48)],M['facing'],arm_weights(side))
        for z in [1.087,1.060,1.032,1.005,.979]:
            f=(1.169-z)/(.193);cx=elbow[0]*(1-f)+wrist[0]*f;cy=elbow[1]*(1-f)+wrist[1]*f
            tube('Forearm wrap seam '+side,[(cx+.038*math.sin(a),cy-.043*math.cos(a),z+.006*math.sin(a)) for a in np.linspace(0,TAU,33)],[.0015]*33,M['thread'],'forearm.'+side,6)
        palm=(sign*.362,-.024,.934)
        sphere('Palm '+side,palm,(.032,.020,.05),M['skin'],'hand.'+side,24,14)
        for finger in range(4):
            fx=sign*(.339+finger*.015);end=.852+abs(finger-1.35)*.008
            tube('Finger '+side+str(finger),[(fx,-.028,.922),(fx,-.031,.888),(fx,-.026,end+.009),(fx,-.023,end)],[.0085,.008,.0065,.004],M['skin'],'hand.'+side,10)
            sphere('Fingernail '+side+str(finger),(fx,-.030,end+.014),(.005,.0015,.008),M['nail'],'hand.'+side,12,8)
        tube('Thumb '+side,[(sign*.34,-.022,.951),(sign*.321,-.039,.928),(sign*.319,-.043,.908)],[.012,.010,.007],M['skin'],'hand.'+side,12)


def face():
    rows=[(1.487,.032,.038,-.024),(1.508,.058,.054,-.017),(1.54,.078,.065,-.003),(1.575,.086,.074,.003),(1.610,.089,.078,.006),(1.65,.086,.075,.01),(1.684,.071,.065,.013),(1.712,.043,.041,.014),(1.723,.008,.008,.014)]
    def fn(a,v):
        z=1.487+(1.723-1.487)*v;rx,ry,cy=profile(z,rows)
        x=math.sin(a)*rx;y=cy-math.cos(a)*ry
        front=max(0,math.cos(a))**5
        # Smooth cheekbones, jaw, eye sockets, brow, muzzle and chin in one continuous head.
        cheek=.006*math.exp(-((abs(x)-.051)/.025)**2-((z-1.574)/.023)**2)
        socket=.005*math.exp(-((abs(x)-.042)/.025)**2-((z-1.612)/.014)**2)
        brow=.004*math.exp(-((z-1.631)/.012)**2)
        muzzle=.007*math.exp(-(x/.039)**2-((z-1.542)/.016)**2)
        y+=front*(socket-cheek-brow-muzzle)
        return(x,y,z)
    head=surface('Continuous sculpted face',74,fn,M['skin'],'head',80)
    smooth=head.modifiers.new('Smooth cheek and jaw transitions','SUBSURF');smooth.levels=1
    bpy.context.view_layer.objects.active=head;bpy.ops.object.modifier_apply(modifier=smooth.name)
    # Nose surface blends into face at the sides, rounded bridge / tip / alae.
    verts=[];faces=[]
    for i in range(21):
        z=1.563+.069*i/20;w=.010+.007*math.exp(-((z-1.574)/.014)**2)
        protrusion=.019*math.exp(-((z-1.58)/.013)**2)+.010*math.exp(-((z-1.61)/.035)**2)
        for j in range(17):
            u=j/16*2-1;verts.append((u*w,-.073-protrusion*(1-u*u),z))
    for i in range(20):
        for j in range(16):a=i*17+j;faces.append((a,a+1,a+18,a+17))
    mesh('Sculpted nose bridge and tip',verts,faces,M['skin'],'head')
    for sign in [-1,1]:
        sphere('Nose ala',(sign*.011,-.079,1.575),(.008,.008,.006),M['skin'],'head',20,12)
        sphere('Nostril',(sign*.009,-.085,1.571),(.0035,.0015,.0018),M['skinshadow'],'head',12,8)
        sphere('Ear',(sign*.090,.004,1.594),(.014,.014,.03),M['skin'],'head',24,14)
        sphere('Ear inner fold',(sign*.096,-.008,1.595),(.006,.005,.017),M['skinshadow'],'head',16,10)
        tube('Ear helix',[(sign*(.09+.008*math.sin(a)),.002-.013*math.cos(a),1.596+.024*math.cos(a)) for a in np.linspace(-.4,math.pi*1.45,28)],[.003]*28,M['skin'],'head',8)
        ex=sign*.037;ey=-.070;ez=1.612
        sphere('Eye white',(ex,ey,ez),(.020,.006,.0065),M['sclera'],'head',28,14)
        sphere('Iris',(ex,ey-.0056,ez),(.0048,.0015,.005),M['iris'],'head',20,12)
        sphere('Pupil',(ex,ey-.0066,ez),(.0023,.0008,.0027),M['hair'],'head',16,10)
        for up in [-1,1]:
            pts=[]
            for u in np.linspace(-1,1,21):pts.append((ex+u*.021,ey-.002-.004*(1-u*u),ez+up*.0056*(1-u*u)+sign*u*.0015))
            tube('Eyelid rim',pts,[.0018]*21,M['skinshadow'] if up>0 else M['skin'],'head',8)
        pts=[(sign*x,y,z) for x,y,z in [(.014,-.069,1.634),(.030,-.074,1.639),(.047,-.071,1.638),(.061,-.062,1.632)]]
        tube('Eyebrow',pts,[.0022,.0032,.0028,.0009],M['hair'],'head',10)
    for lip in [-1,1]:
        pts=[]
        for u in np.linspace(-1,1,25):
            z=1.543+lip*.0021*(1-u*u)+(.0015*math.exp(-((abs(u)-.28)/.23)**2) if lip>0 else 0)
            pts.append((u*.023,-.067-.008*(1-u*u),z))
        tube('Sculpted lip',pts,[.0018]*25,M['lip'],'head',8)
    tube('Mouth crease',[(-.021,-.069,1.543),(0,-.076,1.5425),(.021,-.069,1.543)],[.0006,.0009,.0006],M['skinshadow'],'head',6)


def hair():
    def scalp(a,v):
        front=max(0,math.cos(a))
        bottom=1.554+.100*front**4
        z=bottom+(1.741-bottom)*v
        # Sphere scalp is slightly larger than the cranial profile, with a combed hairline.
        r=math.sqrt(max(.0001,1-((z-1.623)/.120)**2))
        return(math.sin(a)*(.096*r+.001),.012-math.cos(a)*(.084*r+.001),z)
    surface('Continuous swept hair cap',40,scalp,M['hair'],'head',96)
    # Fine, curved locks follow skull from hairline into crown; geometrical relief gives side-light structure.
    for i in range(54):
        start=TAU*i/54
        pts=[]
        for v in np.linspace(.025,.94,24):
            a=start+.16*math.sin(v*math.pi);x,y,z=scalp(a,v);pts.append((x*1.013,.012+(y-.012)*1.016,z+.0005))
        tube('Combed strand '+str(i),pts,[.0013*(1-v*.55) for v in np.linspace(0,1,24)],M['hairline'],'head',6)
    sphere('Top knot',(0,.009,1.758),(.037,.033,.033),M['hair'],'head',32,20)
    for i in range(16):
        a=TAU*i/16
        pts=[(.039*math.sin(a)*math.sin(v),.009+.034*math.cos(v),1.758+.033*math.cos(a)*math.sin(v)) for v in np.linspace(.07,math.pi-.07,24)]
        tube('Knot lock',pts,[.0014]*24,M['hairline'],'head',6)
    tube('Hairpin',[(-.070,.013,1.746),(.067,.013,1.746)],[.0028,.0019],M['metal'],'head',10)
    sphere('Hairpin jade end',(-.074,.013,1.746),(.006,.005,.005),M['jade'],'head',16,10)
    # Tied rear fall is a flattened volume, with 16 individually swept locks.
    for i in range(16):
        f=(i-7.5)/7.5;x=f*.052
        pts=[(f*.031,.071,1.697),(x,.093,1.568),(x*.95,.101,1.423),(x*.8,.109,1.286),(x*.63,.106,1.228+abs(f)*.05)]
        tube('Rear hair lock '+str(i),pts,[(.010,.006),(.011,.009),(.009,.008),(.007,.006),(.0015,.002)],M['hair'] if i%3 else M['hairline'],'hair',10)
    for sign in [-1,1]:
        tube('Temple lock',[(sign*.074,-.042,1.667),(sign*.084,-.049,1.624),(sign*.086,-.037,1.546),(sign*.080,-.044,1.503)],[.008,.006,.003,.001],M['hair'],'head',10)
    strip('Hair ribbon',[(0,.103,1.707),(.005,.117,1.62),(.003,.12,1.526),(.008,.122,1.47)],.021,M['facing'],'hair',.002)


def ornament():
    tube('Jade pendant cord',[(.105,-.12,1.048),(.115,-.137,.96),(.11,-.149,.931)],[.0018]*3,M['thread'],skirt_weights,8)
    # A true torus pendant with an open centre.
    verts=[];faces=[]
    for i in range(40):
        a=TAU*i/40
        for j in range(12):
            b=TAU*j/12;r=.014+.005*math.cos(b)
            verts.append((.11+r*math.cos(a),-.154+.004*math.sin(b),.912+r*math.sin(a)))
    for i in range(40):
        for j in range(12):faces.append((i*12+j,((i+1)%40)*12+j,((i+1)%40)*12+(j+1)%12,i*12+(j+1)%12))
    mesh('Carved jade ring',verts,faces,M['jade'],skirt_weights)
    tube('Pendant lower cord',[(.11,-.155,.897),(.109,-.16,.86)],[.0015,.0015],M['thread'],skirt_weights,8)
    sphere('Pendant bead',(.109,-.161,.857),(.005,.004,.007),M['metal'],skirt_weights,16,10)
    for i in range(9):
        dx=(i-4)*.0018;tube('Silk tassel',[(.109+dx,-.16,.85),(.112+dx,-.164,.811),(.11+dx,-.162,.787+abs(dx))],[.001,.0009,.0006],M['thread'],skirt_weights,6)


def create_rig():
    data=bpy.data.armatures.new('QingshanSkeleton');rig=bpy.data.objects.new('Disciple',data)
    bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def b(name,head,tail,parent=None):
        bone=data.edit_bones.new(name);bone.head=head;bone.tail=tail
        if parent:bone.parent=data.edit_bones[parent]
    b('root',(0,0,0),(0,0,.15));b('hips',(0,0,.94),(0,0,1.12),'root')
    b('chest',(0,0,1.12),(0,0,1.42),'hips');b('neck',(0,0,1.42),(0,0,1.53),'chest')
    b('head',(0,0,1.53),(0,0,1.73),'neck');b('hair',(0,.09,1.68),(0,.11,1.23),'head')
    for sign,side in [(1,'R'),(-1,'L')]:
        b('upper_arm.'+side,(sign*.184,0,1.40),(sign*.292,-.006,1.169),'chest')
        b('forearm.'+side,(sign*.292,-.006,1.169),(sign*.349,-.024,.976),'upper_arm.'+side)
        b('hand.'+side,(sign*.349,-.024,.976),(sign*.362,-.024,.883),'forearm.'+side)
        b('thigh.'+side,(sign*.087,0,.94),(sign*.087,-.007,.53),'hips')
        b('shin.'+side,(sign*.087,-.007,.53),(sign*.087,0,.115),'thigh.'+side)
        b('foot.'+side,(sign*.087,0,.115),(sign*.087,-.15,.065),'shin.'+side)
    for i in range(8):
        a=i*TAU/8;b('skirt.'+str(i),(.11*math.sin(a),-.075*math.cos(a),1.055),(.22*math.sin(a),-.14*math.cos(a),.29),'hips')
    bpy.ops.object.mode_set(mode='OBJECT')
    # Normalize the actual rest bounds, including the knot and ground soles.
    low=min(v.co.z for o in PARTS for v in o.data.vertices);high=max(v.co.z for o in PARTS for v in o.data.vertices)
    factor=1.75/(high-low)
    for o in PARTS:
        for v in o.data.vertices:v.co.z-=low;v.co*=factor
        mod=o.modifiers.new('Skeletal deformation','ARMATURE');mod.object=rig;o.parent=rig
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for bone in data.edit_bones:
        bone.head.z-=low;bone.tail.z-=low;bone.head*=factor;bone.tail*=factor
    bpy.ops.object.mode_set(mode='OBJECT')
    rig['asset_role']='Generic qingshan disciple review';rig['height_m']=1.75
    rig['forward']='glTF +Z';rig['animation_notes']='In-place idle / walk / cast. Cloth bones are authored secondary motion.'
    return rig


def rotate(rig,name,x=0,y=0,z=0):
    q=Quaternion((1,0,0),x)@Quaternion((0,1,0),y)@Quaternion((0,0,1),z)
    orient=rig.data.bones[name].matrix_local.to_quaternion();rig.pose.bones[name].rotation_quaternion=orient.inverted()@q@orient


def ground(rig):
    bpy.context.view_layer.update();minimum=1e9
    for side in ['L','R']:
        bone=rig.data.bones['foot.'+side];transform=rig.pose.bones[bone.name].matrix@bone.matrix_local.inverted()
        for o in PARTS:
            if len(o.vertex_groups)==1 and o.vertex_groups[0].name==bone.name:
                minimum=min(minimum,min((transform@v.co).z for v in o.data.vertices))
    rig.pose.bones['hips'].location.y-=minimum;bpy.context.view_layer.update()


def animate(rig):
    bpy.context.scene.render.fps=30;rig.animation_data_create()
    for clip,frames in [('idle',90),('walk',36),('cast',66)]:
        act=bpy.data.actions.new(clip);rig.animation_data.action=act
        for frame in range(frames+1):
            t=TAU*frame/frames;v=frame/frames
            for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
            if clip=='idle':
                rotate(rig,'chest',.009*math.sin(t),0,.006*math.sin(t));rotate(rig,'head',-.006*math.sin(t),0,.012*math.sin(t))
                rotate(rig,'hair',.008*math.sin(t+.5))
                for side,sign in [('R',1),('L',-1)]:rotate(rig,'upper_arm.'+side,.012*math.sin(t),0,sign*.01)
            elif clip=='walk':
                rotate(rig,'hips',.012,0,.025*math.sin(t));rotate(rig,'chest',.018,0,-.045*math.sin(t));rotate(rig,'head',-.018,0,.025*math.sin(t));rotate(rig,'hair',.035*math.sin(t-.5))
                for side,offset in [('R',0),('L',math.pi)]:
                    phase=t+offset
                    rotate(rig,'thigh.'+side,-.32*math.cos(phase));rotate(rig,'shin.'+side,.07+.46*max(0,math.sin(phase)))
                    rotate(rig,'foot.'+side,-.07-.11*math.cos(phase));rotate(rig,'upper_arm.'+side,.21*math.cos(phase));rotate(rig,'forearm.'+side,-.04-.07*max(0,-math.cos(phase)))
                for i in range(8):
                    a=i*TAU/8;rotate(rig,'skirt.'+str(i),-.105*math.cos(t)*math.sin(a)+.02*math.sin(2*t+a),.012*math.sin(t+a))
            else:
                # One complete cast: gather, extend forward, recover to the neutral pose.
                ramp=min(1,v/.23)*min(1,(1-v)/.24);ramp=max(0,ramp);ramp=ramp*ramp*(3-2*ramp)
                pulse=math.sin(math.pi*max(0,min(1,(v-.28)/.45)))
                rotate(rig,'chest',-.035*ramp,0,-.12*ramp);rotate(rig,'head',.015*ramp,0,.10*ramp)
                rotate(rig,'upper_arm.R',-1.10*ramp,.20*ramp,-.08*ramp);rotate(rig,'forearm.R',-.18*ramp-.28*ramp*(1-pulse));rotate(rig,'hand.R',.16*ramp,0,-.15*ramp)
                rotate(rig,'upper_arm.L',-.58*ramp,-.28*ramp,.15*ramp);rotate(rig,'forearm.L',-.70*ramp);rotate(rig,'hand.L',-.1*ramp,0,.20*ramp)
                rotate(rig,'hair',.03*ramp)
                for i in range(8):rotate(rig,'skirt.'+str(i),.013*ramp*math.cos(i*TAU/8),.012*ramp*math.sin(i*TAU/8))
            ground(rig)
            for p in rig.pose.bones:
                p.keyframe_insert(data_path='rotation_quaternion',frame=frame);p.keyframe_insert(data_path='location',frame=frame)
        track=rig.animation_data.nla_tracks.new();track.name=clip;strip=track.strips.new(clip,0,act);strip.name=clip;track.mute=True
    rig.animation_data.action=bpy.data.actions.get('idle');bpy.context.scene.frame_set(0)


def main():
    global CLOTH_NORMAL,M
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for a in list(bpy.data.actions):bpy.data.actions.remove(a)
    CLOTH_NORMAL=fabric_normal()
    specs={
      'cloth':((.025,.048,.055),.94,0,True),'facing':((.016,.030,.036),.94,0,True),
      'ivory':((.43,.42,.36),.96,0,True),'sash':((.019,.035,.040),.94,0,True),
      'thread':((.075,.095,.089),.94,0,False),'trousers':((.15,.19,.20),.85,0,True),
      'skin':((.53,.34,.25),.68,0,False),'skinshadow':((.285,.145,.11),.75,0,False),
      'nail':((.56,.40,.32),.52,0,False),'lip':((.39,.19,.155),.68,0,False),
      'sclera':((.54,.53,.46),.34,0,False),'iris':((.045,.027,.017),.30,0,False),
      'hair':((.012,.015,.016),.48,0,False),'hairline':((.020,.025,.025),.50,0,False),
      'leather':((.027,.031,.034),.62,0,False),'sole':((.09,.08,.065),.85,0,False),
      'jade':((.27,.45,.36),.24,.04,False),'metal':((.30,.34,.32),.36,.6,False)}
    M={key:material('qingshan_'+key,*spec) for key,spec in specs.items()}
    torso();robe();limbs();face();hair();ornament();rig=create_rig();animate(rig)
    triangles=0
    for o in PARTS:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
    # Preserve the separate, named construction pieces in the editable authoring source.
    bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=90
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'disciple.blend'))
    # glTF review/runtime mesh shares one skeleton and joins primitives by material.
    bpy.ops.object.select_all(action='DESELECT')
    for o in PARTS:o.select_set(True)
    bpy.context.view_layer.objects.active=PARTS[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='QingshanDiscipleSkin'
    bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(OUT/'disciple.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,export_morph=False,export_materials='EXPORT',export_yup=True,export_extras=True)
    report={'asset':'generic-qingshan-disciple','heightM':1.75,'up':'Y','forward':'+Z','groundY':0,'source':'disciple.blend','model':'disciple.glb','clips':{'idle':3,'walk':1.2,'cast':2.2},'bones':[b.name for b in rig.data.bones],'triangles':triangles,'materials':len(M),'authoringMeshes':len(PARTS),'cloth':'Woven tangent normal plus modelled folds, seams, layered hems; eight authored skirt bones','scope':'Review asset; visual approval and crowd performance remain separate.'}
    (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('CHARACTER_REVIEW_EXPORTED '+json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
