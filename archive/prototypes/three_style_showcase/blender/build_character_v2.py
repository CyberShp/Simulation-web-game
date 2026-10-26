"""Build the reference-led disciple study and an embedded-texture glTF."""
from pathlib import Path
import sys, json, math
import bpy

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import build_asset_character as ctx
import character_v2_garments as garments
import character_v2_head as head
import character_v2_materials as materials

OUT=HERE.parent/'assets/asset-review/character-v2'
OUT.mkdir(parents=True,exist_ok=True)

def main():
    ctx.OUT=OUT
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for a in list(bpy.data.actions):bpy.data.actions.remove(a)
    ctx.PARTS.clear();ctx.CLOTH_NORMAL=ctx.fabric_normal()
    specs={
      'cloth':((.065,.088,.095),.94,0,True),'facing':((.04,.06,.07),.94,0,True),
      'ivory':((.60,.57,.51),.97,0,True),'sash':((.045,.065,.075),.95,0,True),
      'thread':((.17,.19,.17),.93,0,False),'trousers':((.07,.075,.08),.95,0,True),
      'skin':((.50,.31,.22),.78,0,False),'skinshadow':((.22,.10,.07),.8,0,False),
      'nail':((.47,.29,.23),.68,0,False),'lip':((.31,.135,.105),.76,0,False),
      'sclera':((.26,.245,.22),.45,0,False),'iris':((.025,.016,.009),.35,0,False),
      'hair':((.009,.010,.012),.64,0,False),'hairline':((.015,.016,.019),.68,0,False),
      'leather':((.022,.025,.028),.85,0,False),'sole':((.10,.085,.066),.94,0,False),
      'jade':((.26,.40,.32),.42,0,False),'metal':((.25,.28,.26),.46,.45,False)}
    ctx.M={k:ctx.material('qingshan_'+k,*v) for k,v in specs.items()}
    garments.build_torso(ctx);garments.build_robe(ctx);garments.build_limbs(ctx)
    head.build_head(ctx);head.build_hair(ctx);ctx.ornament()
    materials.project(ctx.PARTS)
    rig=ctx.create_rig();ctx.animate(rig)
    # Rest pose is used for projection baking and comparable render views.
    rig.animation_data.action=None
    for p in rig.pose.bones:p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0)
    bpy.context.view_layer.update()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'disciple-editable.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for o in ctx.PARTS:o.select_set(True)
    bpy.context.view_layer.objects.active=ctx.PARTS[0];bpy.ops.object.join()
    skin=bpy.context.object;skin.name='QingshanReferenceStudy'
    materials.bake(skin,OUT)
    rig.animation_data.action=bpy.data.actions.get('idle');bpy.context.scene.frame_set(0)
    bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=90
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'disciple.blend'))
    bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(OUT/'disciple.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,export_morph=False,export_materials='EXPORT',export_yup=True,export_extras=True)
    skin.data.calc_loop_triangles()
    report={'asset':'qingshan-reference-study-v2','heightM':1.75,'triangles':len(skin.data.loop_triangles),'bones':len(rig.data.bones),'clips':[a.name for a in bpy.data.actions], 'reference':str(materials.REFERENCE.relative_to(ctx.ROOT)), 'texture':'4K baked clothing reference base color; roughness and normal are separately lit', 'source':'disciple-editable.blend','bakedSource':'disciple.blend','model':'disciple.glb','scope':'Local character modeling study; visual review, crowd optimization and Windows pending.'}
    (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('CHARACTER_V2_EXPORTED',json.dumps(report))

if __name__=='__main__':main()
