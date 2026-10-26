"""Construct the v2 disciple's layered garments against the existing review rig.

Public API: build_torso(ctx), build_robe(ctx), build_limbs(ctx).
ctx is the loaded build_asset_character module. Coordinates are metres, Z up,
front -Y, before the host normalizes the character to 1.75 m. No image planes.
New garment pieces have a V2 prefix and garment_region / projection_view extras.
"""
import math
import bpy, bmesh
from mathutils import Vector

TAU = math.tau
BODY = [(1.015,.146,.089),(1.08,.151,.095),(1.21,.175,.105),
        (1.345,.199,.092),(1.39,.192,.081),(1.418,.139,.066),
        (1.453,.058,.049)]


def _tag(obj, region, view='wrap'):
    obj['garment_region']=region
    obj['projection_view']=view
    return obj


def _thickness(obj, amount=.002):
    mod=obj.modifiers.new('Sewn fabric thickness','SOLIDIFY')
    mod.thickness=amount;mod.offset=0
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def _body(ctx,a,z,offset=0):
    rx,ry=ctx.profile(z,BODY)
    v=max(0,min(1,(z-1.015)/.438))
    crease=(.0028*math.sin(9*a+1.1*v)+.0012*math.sin(15*a-2*v))*math.sin(math.pi*v)
    return (math.sin(a)*(rx+offset+crease),-math.cos(a)*(ry+offset+crease),z)


def _front(ctx,x,z,lift):
    rx,ry=ctx.profile(z,BODY)
    a=math.asin(max(-.995,min(.995,x/rx)))
    return _body(ctx,a,z)[1]-lift


def _rows(ctx, rows, z):
    return ctx.profile(z,rows)


def _front_panel(ctx,name,boundaries,mat,depth,region):
    """Sew a real curved cloth panel between inner and outer x boundaries."""
    verts=[];faces=[];uvs=[];levels=45;columns=10
    z0,z1=boundaries[0][0],boundaries[-1][0]
    for i in range(levels):
        v=i/(levels-1);z=z0+(z1-z0)*v
        left,right=_rows(ctx,boundaries,z)
        for j in range(columns+1):
            u=j/columns;x=left*(1-u)+right*u
            # Two broad tension folds remain confined inside the panel.
            fold=.0014*math.sin(u*math.pi)*math.sin(v*9+u*3)
            verts.append((x,_front(ctx,x,z,depth)+fold,z));uvs.append((u,v))
    n=columns+1
    for i in range(levels-1):
        for j in range(columns):
            k=i*n+j;faces.append((k,k+1,k+n+1,k+n))
    obj=ctx.mesh(name,verts,faces,mat,ctx.body_weights,uvs)
    return _tag(_thickness(obj,.002),region,'front')


def _collar(ctx,name,path,width,mat,depth):
    boundaries=[]
    # Width points into the cloth rather than crossing into the exposed V.
    for z,x,sign in path:
        rx,_=ctx.profile(z,BODY)
        w=min(width,max(.006,rx*.985-abs(x)))
        boundaries.append((z,min(x,x+sign*w),max(x,x+sign*w)))
    return _front_panel(ctx,name,boundaries,mat,depth,'collar')


def build_torso(ctx):
    """Complete overlapping chest panels, fitted V collar, back and waist sash."""
    # Ivory is an actual underlying garment, with the front neckline cut as a V.
    def inner(a,v):
        top=1.453-.033*max(0,math.cos(a))**10
        z=1.070+(top-1.070)*v
        return _body(ctx,a,z,-.010)
    _tag(_thickness(ctx.surface('V2 ivory undercross',37,inner,ctx.M['ivory'],ctx.body_weights,72),.002),
         'inner_torso','front')
    # Closed skin under the V also keeps oblique views from seeing through the neck.
    ctx.tube('V2 neck and upper chest',[(0,0,1.345),(0,0,1.395),(0,0,1.455),(0,-.002,1.515)],
             [(.075,.070),(.066,.060),(.053,.050),(.057,.053)],ctx.M['skin'],'neck',32)
    def back(a,v):
        return _body(ctx,a,1.075+.378*v,.001)
    _tag(_thickness(ctx.surface('V2 torso back and side',40,back,ctx.M['cloth'],ctx.body_weights,
                               66,1.405,TAU-1.405),.003),'torso_back','back')
    # The two front pieces are each a full surface; their diagonal edges cross and
    # continue below the belt. The outer left layer has a consistent separation.
    cut=[(1.075,-.071),(1.09,-.064),(1.18,-.023),(1.265,.026),
         (1.34,.063),(1.399,.059),(1.453,.034)]
    for sign,side in [(1,'R'),(-1,'L')]:
        depth=.006 if side=='R' else .011
        boundary=[];edgepath=[]
        for z,innerx in cut:
            rx,_=ctx.profile(z,BODY);outerx=sign*rx*.989;edge=sign*innerx
            boundary.append((z,min(edge,outerx),max(edge,outerx)))
            edgepath.append((z,edge,sign))
        _front_panel(ctx,'V2 torso front overlap '+side,boundary,ctx.M['cloth'],depth,'torso_front')
        _collar(ctx,'V2 collar facing '+side,edgepath,.030,ctx.M['facing'],depth+.0035)
    # One collar edge overlaps the other's end; its lower tip tucks under the robe.
    for sign,side in [(1,'R'),(-1,'L')]:
        lower=[(1.320,-.080,sign),(1.360,-.010,sign)] if side=='R' else [(1.361,.010,sign)]
        path=lower+[(1.395,sign*.021,sign),(1.425,sign*.039,sign),(1.452,sign*.031,sign)]
        _collar(ctx,'V2 ivory folded collar '+side,path,.019,ctx.M['ivory'],.0045 if side=='R' else .002)
    # Broad woven sash conceals all lower front-panel edges.
    def sash(a,v):
        z=1.064+.110*v
        folds=.002*math.sin(v*TAU*3.4+.65*math.sin(a))
        return (math.sin(a)*(.166+folds),-math.cos(a)*(.124+folds),z)
    _tag(_thickness(ctx.surface('V2 wrapped sash',32,sash,ctx.M['sash'],'hips',72),.003),'sash')
    for i,z in enumerate([1.087,1.115,1.143]):
        def wrap(a,v,base=z,phase=i*.9):
            return(math.sin(a)*.170,-math.cos(a)*.129,
                   base+(v-.5)*.017+.012*math.sin(a*2+phase))
        _tag(_thickness(ctx.surface('V2 sash wrap '+str(i),5,wrap,ctx.M['facing'],'hips',80),.0015),'sash')
    _tag(ctx.sphere('V2 sash knot',(.105,-.128,1.114),(.023,.016,.025),ctx.M['facing'],'hips',20,12),'sash','front')
    pts=[(.107,-.135,1.113),(.117,-.141,.98),(.116,-.152,.87),(.126,-.164,.743)]
    _tag(ctx.strip('V2 long sash end',pts,.044,ctx.M['facing'],ctx.skirt_weights,.002),'sash_end','front')


def _skirt_shape(a,v,hem=.267,offset=0,phase=0):
    z=hem+(1.085-hem)*v
    rx=.286*(1-v)+.148*v;ry=.165*(1-v)+.096*v
    # A few broad folds vary between panels and gather at the waist.
    fold=(.007*math.cos(a*5.6+v*.8)+.002*math.sin(a*9.3-v*2)
          +.0008*math.sin(a*3+phase))*(.55+.45*(1-v))
    return (math.sin(a)*(rx+offset+fold),-math.cos(a)*(ry+offset+fold)+.003*(1-v),z)


def _robe_panel(ctx,name,angle_start,angle_end,hem,phase,offset,region):
    verts=[];faces=[];uv=[];levels=43;columns=28
    for i in range(levels):
        v=i/(levels-1)
        a0=angle_start(v) if callable(angle_start) else angle_start
        a1=angle_end(v) if callable(angle_end) else angle_end
        for j in range(columns+1):
            u=j/columns;a=a0+(a1-a0)*u
            x,y,z=_skirt_shape(a,v,hem,offset,phase)
            z+=(.011*math.cos(u*math.pi)+.006*math.sin(u*TAU+phase))*(1-v)**2
            verts.append((x,y,z));uv.append((u,v))
    n=columns+1
    for i in range(levels-1):
        for j in range(columns):
            k=i*n+j;faces.append((k,k+1,k+n+1,k+n))
    obj=ctx.mesh(name,verts,faces,ctx.M['cloth'],ctx.skirt_weights,uv)
    _tag(_thickness(obj,.003),region,'front' if 'front' in region else 'back' if 'back' in region else 'side')
    # Narrow bound edges follow the actual cut edge; no separate floating strips.
    for col,label in [(0,'a'),(columns,'b')]:
        pts=[verts[i*n+col] for i in range(levels)]
        _tag(ctx.tube(name+' bound edge '+label,pts,[.0018]*levels,ctx.M['facing'],ctx.skirt_weights,6),region+'_edge')
    return obj


def build_robe(ctx):
    """Separate front, side and back cut panels over a longer ivory under-robe."""
    def inner(a,v):
        x,y,z=_skirt_shape(a,v,.221,-.020,.9)
        return(x,y,z+.005*math.sin(3*a)*(1-v))
    _tag(_thickness(ctx.surface('V2 ivory under robe',43,inner,ctx.M['ivory'],ctx.skirt_weights,84),.002),
         'inner_robe','wrap')
    # The widening front gap displays the ivory layer from the waist to the hem.
    opening=lambda v:.33*(1-v)+.085*v
    _robe_panel(ctx,'V2 robe front R',opening,1.455,.230,.4,.003,'robe_front')
    _robe_panel(ctx,'V2 robe front L',TAU-1.455,lambda v:TAU-opening(v),.225,1.1,.006,'robe_front')
    _robe_panel(ctx,'V2 robe back',1.50,TAU-1.50,.260,2.0,.001,'robe_back')
    # Side gussets sit under the front/back panels and bridge their overlap.
    _robe_panel(ctx,'V2 robe side R',1.34,1.69,.300,2.7,-.002,'robe_side')
    _robe_panel(ctx,'V2 robe side L',TAU-1.69,TAU-1.34,.309,3.4,-.002,'robe_side')


def _bezier(points,t):
    a,b,c,d=[Vector(p) for p in points]
    return a*(1-t)**3+3*b*(1-t)**2*t+3*c*(1-t)*t*t+d*t**3


def _sleeve(ctx,side,sign):
    path=[(sign*.141,0,1.382),(sign*.230,0,1.415),
          (sign*.299,-.008,1.211),(sign*.334,-.014,1.045)]
    def sample(v,theta,inset=0):
        p=_bezier(path,v)
        tangent=(_bezier(path,min(1,v+.005))-_bezier(path,max(0,v-.005))).normalized()
        transverse=tangent.cross(Vector((0,1,0))).normalized()
        front=tangent.cross(transverse).normalized()
        rx,ry=ctx.profile(v,[(0,.043,.052),(.17,.066,.068),(.48,.079,.072),(.77,.087,.068),(1,.091,.065)])
        # Broad flattened cloth, with a diagonal opening and localized draping.
        c,s=math.cos(theta),math.sin(theta)
        c=math.copysign(abs(c)**.82,c);s=math.copysign(abs(s)**.86,s)
        ripple=(.0045*math.sin(5*theta+v*1.7)+.0025*math.sin(9*theta-v*2.4))*math.sin(math.pi*v*.88)
        q=p+transverse*c*(rx-inset+ripple)+front*s*(ry-inset+ripple)
        q.z+=.050*sign*math.cos(theta)*v**4-.012*math.sin(math.pi*v)
        return tuple(q)
    def grid(v0,v1,inset,name,mat,region):
        levels=35;sides=48;verts=[];faces=[];uv=[]
        for i in range(levels):
            v=v0+(v1-v0)*i/(levels-1)
            for j in range(sides+1):
                verts.append(sample(v,TAU*j/sides,inset));uv.append((j/sides,v))
        n=sides+1
        for i in range(levels-1):
            for j in range(sides):
                k=i*n+j;faces.append((k,k+1,k+n+1,k+n))
        if v0==0:faces.append(tuple(reversed(range(sides))))
        _tag(ctx.mesh(name,verts,faces,mat,ctx.arm_weights(side),uv),region,'side')
        return verts[-n:]
    edge=grid(0,1,0,'V2 sleeve '+side,ctx.M['cloth'],'sleeve')
    inside=grid(.66,1,.0035,'V2 sleeve lining '+side,ctx.M['facing'],'sleeve_lining')
    n=len(edge);verts=edge+inside;faces=[(j,j+1,j+n+1,j+n) for j in range(n-1)]
    _tag(ctx.mesh('V2 sleeve folded cuff '+side,verts,faces,ctx.M['facing'],ctx.arm_weights(side)),
         'sleeve_cuff','side')


def build_limbs(ctx):
    """Reuse rig-compatible hands, boots and under-sleeves; replace outer sleeves."""
    first=len(ctx.PARTS)
    ctx.limbs()
    prefixes=('Draped broad sleeve ','Visible sleeve lining ','Folded sleeve cuff ')
    for obj in list(ctx.PARTS[first:]):
        if obj.name.startswith(prefixes):
            ctx.PARTS.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)
        elif obj.name.startswith('Leather boot shaft '):
            # The shaft overlaps the shoe's upper rather than ending above it.
            for vertex in obj.data.vertices:
                if vertex.co.z<.15:vertex.co.z-=.034
            obj.data.update()
        elif obj.name.startswith('Shaped leather shoe '):
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.holes_fill(bm,edges=[edge for edge in bm.edges if edge.is_boundary],sides=0)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            bm.to_mesh(obj.data);bm.free();obj.data.update()
    for sign,side in [(1,'R'),(-1,'L')]:
        _sleeve(ctx,side,sign)
