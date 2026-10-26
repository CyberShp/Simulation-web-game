"""Three-view reference projection on volumetric geometry, baked for glTF."""
from pathlib import Path
import bpy, math

ROOT = Path(__file__).resolve().parents[3]
REFERENCE = ROOT / 'docs/art/asset-review-20261013/character-design-v2.png'
HEAD_REFERENCE = ROOT / 'docs/art/asset-review-20261013/character-head-detail-v2.png'

def face_pixel(z):
    rows=[(1.38,980),(1.45,860),(1.487,734),(1.50,696),(1.54,620),
          (1.579,549),(1.611,443),(1.633,410),(1.655,289),(1.70,150),(1.79,6)]
    for (a,y),(b,yy) in zip(rows,rows[1:]):
        if z<=b:return y+(yy-y)*max(0,(z-a)/(b-a))
    return 6

def project(parts):
    image=bpy.data.images.load(str(REFERENCE),check_existing=True)
    image.pack()
    head_image=bpy.data.images.load(str(HEAD_REFERENCE),check_existing=True);head_image.pack()
    materials={}
    for obj in parts:
        for name in ['ReferenceFront','ReferenceSide','ReferenceBack','ReferenceFace']:
            uv=obj.data.uv_layers.get(name) or obj.data.uv_layers.new(name=name)
            for polygon in obj.data.polygons:
                for li in polygon.loop_indices:
                    p=obj.data.vertices[obj.data.loops[li].vertex_index].co
                    # Source board: 1536x1024. Authoring height is about 1.79 m.
                    px=(278+p.x*515) if name.endswith('Front') else ((1258-p.x*515) if name.endswith('Back') else (776+p.y*515))
                    py=942-p.z*515
                    if name.endswith('Front') and obj.get('garment_region') in ['robe_front','sash','sash_end'] and p.x>.06 and p.z<1.075:
                        px=278-p.x*515
                    if name.endswith('Face'):px=353+p.x*2200;py=face_pixel(p.z)
                    uv.data[li].uv=(px/1536,1-py/1024)
        for slot in obj.material_slots:
            old=slot.material
            role='face' if obj.name.startswith(('V2 continuous facial','V2 fitted eyelid')) else ('scalp' if obj.name.startswith(('V2 parted scalp','V2 gathered top knot')) else '')
            key=old.name+role
            if key not in materials:
                materials[key]=projection_material(old,image,head_image,role)
            slot.material=materials[key]
    return materials

def projection_material(old,image,head_image,role):
    mat=old.copy();mat.name=old.name+'_reference'
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    base=bs.inputs['Base Color'].default_value[:]
    def node(kind):return nodes.new(kind)
    def mathn(operation,a,b=None):
        n=node('ShaderNodeMath');n.operation=operation
        for idx,val in enumerate([a,b]):
            if val is None:continue
            if isinstance(val,(float,int)):n.inputs[idx].default_value=val
            else:links.new(val,n.inputs[idx])
        return n.outputs[0]
    def mix(fac,a,b):
        n=node('ShaderNodeMixRGB');n.blend_type='MIX'
        if isinstance(fac,(int,float)):n.inputs[0].default_value=fac
        else:links.new(fac,n.inputs[0])
        for idx,val in [(1,a),(2,b)]:
            if isinstance(val,(tuple,list)):n.inputs[idx].default_value=val
            else:links.new(val,n.inputs[idx])
        return n.outputs[0]
    geom=node('ShaderNodeNewGeometry');separate=node('ShaderNodeSeparateXYZ');links.new(geom.outputs['Normal'],separate.inputs[0])
    nx=separate.outputs['X'];ny=separate.outputs['Y']
    front=mathn('POWER',mathn('MAXIMUM',mathn('MULTIPLY',ny,-1),0),4)
    back=mathn('POWER',mathn('MAXIMUM',ny,0),4)
    side=mathn('POWER',mathn('ABSOLUTE',nx),4)
    colors=[];weights=[]
    for uvname,weight in [('ReferenceFront',front),('ReferenceSide',side),('ReferenceBack',back)]:
        uv=node('ShaderNodeUVMap');uv.uv_map=uvname
        tex=node('ShaderNodeTexImage');tex.image=image;tex.extension='CLIP'
        links.new(uv.outputs['UV'],tex.inputs['Vector'])
        # Ignore neutral board pixels where a pose silhouette does not overlap.
        rgb=node('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],rgb.inputs[0])
        r,g,b=[rgb.outputs[i] for i in range(3)]
        def saturate(v):return mathn('MINIMUM',mathn('MAXIMUM',v,0),1)
        dark=saturate(mathn('DIVIDE',mathn('SUBTRACT',.16,mathn('MAXIMUM',mathn('MAXIMUM',r,g),b)),.06))
        blue=saturate(mathn('DIVIDE',mathn('SUBTRACT',mathn('SUBTRACT',g,r),.006),.014))
        skin=saturate(mathn('DIVIDE',mathn('SUBTRACT',mathn('SUBTRACT',r,b),.05),.05))
        if any(k in old.name for k in ['cloth','facing','sash','leather','trousers','hair']):
            valid=mathn('MAXIMUM',dark,blue)
        elif old.name.endswith('_skin'):
            valid=skin
        else:
            valid=mathn('MAXIMUM',dark,mathn('MAXIMUM',blue,skin))
        colors.append(tex.outputs['Color']);weights.append(mathn('MULTIPLY',weight,valid))
    total=mathn('ADD',mathn('ADD',weights[0],weights[1]),weights[2])
    # Weighted multi-view blending uses true surface normals, fixed in the rest pose.
    ab=mix(mathn('DIVIDE',weights[1],mathn('MAXIMUM',mathn('ADD',weights[0],weights[1]),.0001)),colors[0],colors[1])
    abc=mix(mathn('DIVIDE',weights[2],mathn('MAXIMUM',total,.0001)),ab,colors[2])
    name=old.name
    strength=.68 if any(k in name for k in ['cloth','facing','sash','leather','trousers']) else 0
    if any(k in name for k in ['ivory','thread','jade','metal','nail','iris','sclera','skinshadow','lip']):strength=0
    if 'hair' in name:strength=.12
    factor=mathn('MULTIPLY',mathn('MINIMUM',mathn('MULTIPLY',total,8),1),strength)
    color=mix(factor,base,abc)
    if role:
        uv=node('ShaderNodeUVMap');uv.uv_map='ReferenceFace'
        tex=node('ShaderNodeTexImage');tex.image=head_image;tex.extension='CLIP';links.new(uv.outputs['UV'],tex.inputs[0])
        rgb=node('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],rgb.inputs[0])
        r,g,b=[rgb.outputs[i] for i in range(3)]
        mask=mathn('MINIMUM',mathn('MAXIMUM',mathn('MULTIPLY',mathn('SUBTRACT',r,b),16),0),1) if role=='face' else mathn('MINIMUM',mathn('MAXIMUM',mathn('DIVIDE',mathn('SUBTRACT',.20,mathn('MAXIMUM',r,g)),.15),0),1)
        face_weight=mathn('MULTIPLY',mask,mathn('MINIMUM',mathn('MAXIMUM',mathn('MULTIPLY',ny,-1.5),0),1))
        if role=='face':
            position=node('ShaderNodeSeparateXYZ');links.new(geom.outputs['Position'],position.inputs[0])
            edge=mathn('MINIMUM',mathn('MAXIMUM',mathn('DIVIDE',mathn('SUBTRACT',.073,mathn('ABSOLUTE',position.outputs['X'])),.020),0),1)
            face_weight=mathn('MULTIPLY',face_weight,edge)
        color=mix(mathn('MULTIPLY',face_weight,.94 if role=='face' else .85),base,tex.outputs['Color'])
    links.new(color,bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value=.9 if any(k in name for k in ['cloth','sash','facing']) else next(n for n in old.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Roughness'].default_value
    return mat

def bake(mesh,output):
    """Bake only base color; light, geometry and roughness remain runtime inputs."""
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
    uv=mesh.data.uv_layers.get('BakedUV') or mesh.data.uv_layers.new(name='BakedUV')
    mesh.data.uv_layers.active=uv;uv.active_render=True
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.004,area_weight=.5)
    bpy.ops.object.mode_set(mode='OBJECT')
    atlas=bpy.data.images.new('Qingshan reference base color',width=4096,height=4096,alpha=False)
    for mat in mesh.data.materials:
        nodes=mat.node_tree.nodes;links=mat.node_tree.links
        bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
        out=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        emission=nodes.new('ShaderNodeEmission')
        links.new(bs.inputs['Base Color'].links[0].from_socket,emission.inputs['Color'])
        links.new(emission.outputs[0],out.inputs['Surface'])
        target=nodes.new('ShaderNodeTexImage');target.image=atlas;nodes.active=target
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
    scene.render.bake.margin=12;scene.render.bake.use_clear=True
    bpy.ops.object.bake(type='EMIT')
    atlas.filepath_raw=str(output/'disciple-basecolor.png');atlas.file_format='PNG';atlas.save();atlas.pack()
    for mat in mesh.data.materials:
        nodes=mat.node_tree.nodes;links=mat.node_tree.links
        bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');out=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        tex=nodes.new('ShaderNodeTexImage');tex.image=atlas
        uvn=nodes.new('ShaderNodeUVMap');uvn.uv_map='BakedUV';links.new(uvn.outputs['UV'],tex.inputs[0])
        links.new(tex.outputs['Color'],bs.inputs['Base Color']);links.new(bs.outputs['BSDF'],out.inputs['Surface'])
        for n in nodes:
            if n.type=='TEX_IMAGE' and n.image and 'normal' in n.image.name.lower():
                normal_uv=nodes.new('ShaderNodeUVMap');normal_uv.uv_map='UVMap'
                links.new(normal_uv.outputs['UV'],n.inputs['Vector'])
    for name in ['ReferenceFront','ReferenceSide','ReferenceBack','ReferenceFace']:
        layer=mesh.data.uv_layers.get(name)
        if layer:mesh.data.uv_layers.remove(layer)
    return atlas
