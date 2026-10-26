"""Blender-only FBX inspection; writes measurements without retargeting/rendering.

blender --background --python inspect_motion.py -- --source SOURCE.fbx --output NEW_DIR
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from motion_metrics import BONE_MAP, analyse_motion, distance


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--expected-sha256')
    parser.add_argument('--rig')
    parser.add_argument('--action')
    parser.add_argument('--start', type=float)
    parser.add_argument('--end', type=float)
    parser.add_argument('--sample-step', type=float, default=1)
    parser.add_argument('--max-samples', type=int, default=5000)
    parser.add_argument('--min-period', type=float, default=.35)
    parser.add_argument('--max-period', type=float, default=1.5)
    parser.add_argument('--candidates', type=int, default=12)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    source, out = args.source.resolve(strict=True), args.output.resolve()
    repository = Path(__file__).resolve().parents[3]
    if out == repository or repository in out.parents:
        raise ValueError('Inspection output must be outside the repository')
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if args.expected_sha256 and args.expected_sha256.lower() != source_hash:
        raise ValueError('Source SHA-256 differs from the supplied expected hash')
    if args.sample_step <= 0 or args.max_samples < 3:
        raise ValueError('Need a positive sampling step and at least three allowed samples')
    out.mkdir(parents=True, exist_ok=False)
    report = {'kind': 'raw-fbx-motion-inspection/v1', 'source': {'path': str(source), 'sha256': source_hash},
              'status': 'inspecting', 'errors': [], 'artApproval': 'not-assessed',
              'sourceCorrectionApplied': False}
    try:
        import bpy
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=str(source))
        rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
        report['rigs'] = [{'name': o.name, 'boneCount': len(o.data.bones),
                           'activeAction': o.animation_data.action.name if o.animation_data and o.animation_data.action else None} for o in rigs]
        report['actions'] = [{'name': a.name, 'frameRange': list(a.frame_range)} for a in bpy.data.actions]
        rig = bpy.data.objects.get(args.rig) if args.rig else rigs[0] if len(rigs) == 1 else None
        if not rig or rig.type != 'ARMATURE':
            raise ValueError('Choose --rig explicitly when FBX has zero or multiple armatures')
        action = bpy.data.actions.get(args.action) if args.action else rig.animation_data.action if rig.animation_data else None
        required = sorted(set(BONE_MAP.values()) | {'L_Middle1', 'R_Middle1'})
        missing = [n for n in required if n not in rig.data.bones]
        report['skeleton'] = {'rig': rig.name, 'scale': list(rig.scale), 'requiredForRetarget': required,
                              'missingForRetarget': missing, 'bones': [
                                  {'name': b.name, 'parent': b.parent.name if b.parent else None,
                                   'headWorld': list(rig.matrix_world @ b.head_local),
                                   'tailWorld': list(rig.matrix_world @ b.tail_local), 'length': b.length}
                                  for b in rig.data.bones]}
        if missing:
            raise ValueError('Missing source bones: '+', '.join(missing))
        if not action:
            raise ValueError('No selected active action; choose --action from the reported actions')
        rig.animation_data_create()
        rig.animation_data.action = action
        scene = bpy.context.scene
        fps = scene.render.fps/scene.render.fps_base
        first, last = map(float, action.frame_range)
        start, end = first if args.start is None else args.start, last if args.end is None else args.end
        if not first <= start < end <= last:
            raise ValueError('Requested frame range must lie inside the original action')
        count = int(math.floor((end-start)/args.sample_step))+1
        if count > args.max_samples:
            raise ValueError(f'{count} source samples exceed --max-samples={args.max_samples}')
        frames = [start+i*args.sample_step for i in range(count)]
        if frames[-1] < end-1e-8:
            frames.append(end)
        if len(frames) > args.max_samples:
            raise ValueError('Including the exact end frame exceeds --max-samples')
        report['timing'] = {'action': action.name, 'actionFrameRange': [first, last],
                            'sampleFrameRange': [start, end], 'sampleStep': args.sample_step,
                            'sampleCount': len(frames), 'fps': fps, 'fpsNumerator': scene.render.fps,
                            'fpsBase': scene.render.fps_base, 'durationSeconds': (end-start)/fps}
        report['sceneUnits'] = {'system': scene.unit_settings.system, 'scaleLength': scene.unit_settings.scale_length}
        names, samples = sorted(set(BONE_MAP.values())), []
        for frame in frames:
            scene.frame_set(math.floor(frame), subframe=frame % 1)
            matrices = {n: rig.matrix_world @ rig.pose.bones[n].matrix for n in names}
            samples.append({'frame': frame, 'positions': {n: list(m.translation) for n, m in matrices.items()},
                            'rotations': {n: list(m.to_quaternion()) for n, m in matrices.items()}})
        joints = {b.name: list(rig.matrix_world @ b.head_local) for b in rig.data.bones}
        leg = sum(distance(joints[a], joints[b]) for a, b in [('L_Hip', 'L_Knee'), ('L_Knee', 'L_Ankle'),
                                                              ('R_Hip', 'R_Knee'), ('R_Knee', 'R_Ankle')])/2
        report['legLengthSourceUnits'] = leg
        report['measurements'] = analyse_motion(samples, fps, 'Pelvis', names,
                                                {'left': ('L_Ankle', 'L_Foot'), 'right': ('R_Ankle', 'R_Foot')},
                                                leg, args.min_period, args.max_period, args.candidates)
        report['status'] = 'measured'
    except Exception as exc:
        report['status'] = 'rejected'
        report['errors'].append(str(exc))
    report['sourceUnchanged'] = hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
    if not report['sourceUnchanged']:
        report['status'] = 'rejected'
        report['errors'].append('Input file changed during inspection')
    destination = out/'inspect-report.json'
    destination.write_text(json.dumps(report, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'status': report['status'], 'report': str(destination), 'errors': report['errors']}))
    if report['status'] != 'measured':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
