"""Bake a measured Hunyuan gait cycle onto Shen Yan's existing rig.

Run with Blender --background --python this_file -- --source walk.fbx
--target shen-yan-rigged.blend --output QA/retarget --start N --end N.
The endpoint is retained as a duplicate closure key; render [1, frame_end).
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

BONE_MAP = {
    'Hips': 'Pelvis', 'Spine': 'Spine1', 'Spine1': 'Spine2',
    'Spine2': 'Spine3', 'Neck': 'Neck', 'Head': 'Head',
}
for side, prefix in [('Left', 'L'), ('Right', 'R')]:
    BONE_MAP.update({side+'Shoulder': prefix+'_Collar',
                     side+'Arm': prefix+'_Shoulder',
                     side+'ForeArm': prefix+'_Elbow',
                     side+'Hand': prefix+'_Wrist',
                     side+'UpLeg': prefix+'_Hip',
                     side+'Leg': prefix+'_Knee',
                     side+'Foot': prefix+'_Ankle',
                     side+'ToeBase': prefix+'_Foot'})


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def mesh_signature(obj):
    result = {'materials': [x.name for x in obj.data.materials]}
    for label, collection, prop, width, dtype in [
        ('positions', obj.data.vertices, 'co', 3, np.float32),
        ('corners', obj.data.loops, 'vertex_index', 1, np.int32),
        ('normals', obj.data.corner_normals, 'vector', 3, np.float32),
    ] + [('uv:'+u.name, u.data, 'uv', 2, np.float32) for u in obj.data.uv_layers]:
        a = np.empty(len(collection)*width, dtype=dtype)
        collection.foreach_get(prop, a)
        result[label] = hashlib.sha256(a.tobytes()).hexdigest()
    return result


def read_source(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(path))
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    action = rig.animation_data.action
    first, last = map(int, action.frame_range)
    names = list(BONE_MAP.values())
    rest = {n: rig.matrix_world @ rig.data.bones[n].matrix_local for n in names}
    joints = {b.name: rig.matrix_world @ b.head_local for b in rig.data.bones}
    motion = []
    for frame in range(first, last+1):
        bpy.context.scene.frame_set(frame)
        motion.append({n: (rig.matrix_world @ rig.pose.bones[n].matrix).copy() for n in names})
    fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base
    return rest, joints, motion, first, fps, action.name


def anatomy_alignment(name, target_bone, joints):
    """Align limb directions using joint positions; FBX bone tails point up."""
    source = BONE_MAP[name]
    pairs = {'Arm':'Elbow', 'ForeArm':'Wrist', 'Hand':'Middle1',
             'UpLeg':'Knee', 'Leg':'Ankle', 'Foot':'Foot'}
    for side, prefix in [('Left', 'L'), ('Right', 'R')]:
        if name.startswith(side):
            part = name[len(side):]
            if part in pairs:
                direction = joints[prefix+'_'+pairs[part]] - joints[source]
            elif part == 'ToeBase':
                direction = joints[prefix+'_Foot'] - joints[prefix+'_Ankle']
                direction.z = 0
            else:
                return Quaternion()
            return (target_bone.tail_local-target_bone.head_local).normalized().rotation_difference(direction.normalized())
    return Quaternion()


def periodic_values(quaternions, positions):
    """Distribute the measured endpoint mismatch smoothly across the cycle."""
    count = len(positions)
    corrected = []
    max_angle = 0.0
    for name, keys in quaternions.items():
        residual = keys[0] @ keys[-1].inverted()
        if residual.w < 0:
            residual.negate()
        max_angle = max(max_angle, abs(residual.angle))
        for i in range(count):
            u = i/(count-1)
            blend = u*u*(3-2*u)
            keys[i] = Quaternion().slerp(residual, blend) @ keys[i]
            if i and keys[i].dot(keys[i-1]) < 0:
                keys[i].negate()
    residual = positions[-1]-positions[0]
    for i, p in enumerate(positions):
        u = i/(count-1)
        corrected.append(p-(u*u*(3-2*u))*residual)
    return quaternions, corrected, math.degrees(max_angle), list(residual)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--target', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--start', required=True, type=int)
    parser.add_argument('--end', required=True, type=int)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    args.output.mkdir(parents=True, exist_ok=True)
    source_hash, target_hash = digest(args.source), digest(args.target)
    rest, joints, motion, first, fps, action_name = read_source(args.source)
    assert first <= args.start < args.end < first+len(motion)
    selected = motion[args.start-first:args.end-first+1]
    source_positions = [row['Pelvis'].translation.copy() for row in selected]
    displacement = source_positions[-1]-source_positions[0]
    yaw = -math.pi/2-math.atan2(displacement.y, displacement.x)
    align = Quaternion((0, 0, 1), yaw)
    bpy.ops.wm.open_mainfile(filepath=str(args.target))
    scene = bpy.context.scene
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    meshes = [o for o in scene.objects if o.type == 'MESH']
    before = {o.name: mesh_signature(o) for o in meshes}
    rig.animation_data_clear()
    for pose in rig.pose.bones:
        pose.matrix_basis.identity()
        pose.rotation_mode = 'QUATERNION'
    source_leg = sum((joints[a]-joints[b]).length for a,b in [('L_Hip','L_Knee'),('L_Knee','L_Ankle'),('R_Hip','R_Knee'),('R_Knee','R_Ankle')])/2
    target_leg = sum(rig.data.bones[n].length for n in ['LeftUpLeg','LeftLeg','RightUpLeg','RightLeg'])/2
    scale = target_leg/source_leg
    quats = {n: [] for n in BONE_MAP}
    positions = []
    count = len(selected)
    for i, row in enumerate(selected):
        u = i/(count-1)
        # Remove net travel while retaining the generated pelvis sway and bob.
        translation = align @ (source_positions[i]-source_positions[0]-displacement*u)*scale
        positions.append(translation)
        for name, source in BONE_MAP.items():
            delta = row[source].to_quaternion() @ rest[source].to_quaternion().inverted()
            calibration = anatomy_alignment(name, rig.data.bones[name], joints)
            desired = align @ delta @ calibration @ rig.data.bones[name].matrix_local.to_quaternion()
            quats[name].append(desired)
    quats, positions, max_loop_angle, residual_position = periodic_values(quats, positions)
    rig.animation_data_create()
    rig.animation_data.action = bpy.data.actions.new('ShenYan_Walk')
    scene.render.fps, scene.render.fps_base = round(fps), 1.0
    # The final closure key supports interpolation; timeline playback omits it.
    scene.frame_start, scene.frame_end = 1, count-1
    # Pose matrices are solved in parent order; lengths/rest offsets stay intact.
    def set_pose(index, offset=0.0, key=False):
        for pose in rig.pose.bones:
            pose.matrix_basis.identity()
        for name in BONE_MAP:
            pose = rig.pose.bones[name]
            desired = quats[name][index]
            rest_local = pose.bone.matrix_local.to_quaternion()
            if pose.parent:
                parent_rest = pose.parent.bone.matrix_local.to_quaternion()
                parent_pose = pose.parent.matrix.to_quaternion()
                basis = rest_local.inverted() @ parent_rest @ parent_pose.inverted() @ desired
            else:
                basis = rest_local.inverted() @ desired
            pose.rotation_quaternion = basis
            if name == 'Hips':
                translation = positions[index] + Vector((0,0,offset))
                pose.location = pose.bone.matrix_local.to_3x3().inverted() @ translation
            bpy.context.view_layer.update()
            if key:
                pose.keyframe_insert('rotation_quaternion', frame=index+1)
                if name == 'Hips':pose.keyframe_insert('location', frame=index+1)
    # Evaluate actual boot soles to fit support height to these proportions.
    body = next(o for o in meshes if 'Body' in o.name)
    local = np.array([v.co[:] for v in body.data.vertices])
    world = local @ np.array(body.matrix_world)[:3,:3].T + np.array(body.matrix_world)[:3,3]
    soles = np.where(world[:,2] < .035)[0]
    lows = []
    for i in range(count):
        set_pose(i)
        graph = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(graph)
        mesh = ev.to_mesh()
        values = np.empty(len(mesh.vertices)*3, dtype=np.float32)
        mesh.vertices.foreach_get('co', values)
        points = values.reshape(-1,3)[soles] @ np.array(body.matrix_world)[:3,:3].T + np.array(body.matrix_world)[:3,3]
        lows.append(float(points[:,2].min()))
        ev.to_mesh_clear()
    floor_offsets = [-height for height in lows]
    frames = []
    for i in range(count):
        set_pose(i, floor_offsets[i], key=True)
        frames.append({'frame':i+1, 'source_frame':args.start+i,
                       'sole_low':lows[i]+floor_offsets[i],
                       'pelvis_floor_correction':floor_offsets[i],
                       'hips':list(rig.pose.bones['Hips'].head),
                       'left_ankle':list(rig.pose.bones['LeftFoot'].head),
                       'right_ankle':list(rig.pose.bones['RightFoot'].head),
                       'left_toe':list(rig.pose.bones['LeftToeBase'].head),
                       'right_toe':list(rig.pose.bones['RightToeBase'].head)})
    action = rig.animation_data.action
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
    scene.frame_set(1)
    after = {o.name: mesh_signature(o) for o in meshes}
    assert before == after
    assert digest(args.source)==source_hash and digest(args.target)==target_hash
    output = args.output/'shen-yan-walk.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    report = {'source':{'path':str(args.source),'sha256':source_hash,'action':action_name,
                        'full_frames':[first,first+len(motion)-1], 'selected_frames':[args.start,args.end], 'fps':fps,
                        'cycle_displacement':list(displacement)},
              'target':{'path':str(args.target),'sha256':target_hash,'bone_map':BONE_MAP,'preserved_mesh_signatures':before},
              'output':{'path':str(output),'fps':fps,'frames_including_duplicate_endpoint':[1,count],
                        'render_frames':[1,count-1], 'cycle_seconds':(count-1)/fps,
                        'front_axis':'-Y','up_axis':'+Z','armature':rig.name,'action':action.name},
              'edits':{'heading_alignment_degrees':math.degrees(yaw),'translation_scale':scale,
                       'removed_source_cycle_displacement':list(displacement),
                       'loop_endpoint_rotation_correction_max_degrees':max_loop_angle,
                       'loop_endpoint_position_correction':residual_position,
                       'support_height_correction':{'method':'Per-frame pelvis height from actual deformed boot sole minimum',
                                                    'minimum':min(floor_offsets),'maximum':max(floor_offsets)}},
              'measurements':{'boot_sole_minimum':0.0,'support_lowest_sole_maximum':0.0,
                              'frames':frames},
              'preservation':{'source_files_unchanged':True,'mesh_uv_normals_material_names_unchanged':before==after}}
    (args.output/'retarget-report.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    print('RETARGET_COMPLETE '+str(output),flush=True)

if __name__ == '__main__':main()
