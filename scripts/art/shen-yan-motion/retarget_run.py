"""Run-only heading adapter for the preserved retarget_walk implementation.

Blender --background --python retarget_run.py -- --source SOURCE.fbx
--target RIG.blend --output NEW_QA_DIR --start 63 --end 87
"""
import argparse
import json
import math
import sys
from pathlib import Path


def retained_heading(angles, retain):
    """Center a closed heading cycle, retaining its authored timing and variation."""
    if not angles or not 0 <= retain <= 1 or any(not math.isfinite(a) for a in angles):
        raise ValueError('Need finite heading samples and a retention in [0, 1]')
    unwrapped = [angles[0]]
    for a, b in zip(angles, angles[1:]):
        unwrapped.append(unwrapped[-1] + math.atan2(math.sin(b-a), math.cos(b-a)))
    if abs(unwrapped[-1]-unwrapped[0]) > 1e-5:
        raise ValueError('Heading stabilization requires the closed cycle from retarget_walk')
    center = sum(unwrapped[:-1])/max(1, len(unwrapped)-1)
    result = [(a-center)*retain for a in unwrapped]
    result[-1] = result[0]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source', 'target', 'output']:
        parser.add_argument('--'+name, required=True, type=Path)
    parser.add_argument('--start', required=True, type=int)
    parser.add_argument('--end', required=True, type=int)
    parser.add_argument('--heading-retain', type=float, default=.25)
    parser.add_argument('--heading-mode', choices=['body', 'none'], default='body')
    parser.add_argument('--max-heading-correction-degrees', type=float, default=45)
    parser.add_argument('--max-loop-angle-degrees', type=float, default=12)
    parser.add_argument('--max-loop-joint-error', type=float, default=.08)
    parser.add_argument('--expected-source-sha256')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if not math.isfinite(args.heading_retain) or not 0 <= args.heading_retain <= 1:
        raise ValueError('heading-retain must be in [0, 1]')
    if not math.isfinite(args.max_heading_correction_degrees) or args.max_heading_correction_degrees < 0:
        raise ValueError('Need a finite nonnegative heading correction limit')
    out = args.output.resolve()
    repository = Path(__file__).resolve().parents[3]
    if out == repository or repository in out.parents or out.exists():
        raise ValueError('Use a new output directory outside the repository')
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import bpy
    from mathutils import Quaternion, Vector
    import retarget_walk as original

    # The existing endpoint refusal runs before this one narrow adapter hook.
    periodic = original.periodic_values
    def stable_periodic(quaternions, positions):
        quaternions, positions, angle, residual = periodic(quaternions, positions)
        if args.heading_mode == 'none':
            return quaternions, positions, angle, residual
        rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
        rest = {n: rig.data.bones[n].matrix_local.to_quaternion() for n in quaternions}
        trunk = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']
        forward = Vector((0, -1, 0))
        def heading(q, name):
            v = (q @ rest[name].inverted()) @ forward
            if math.hypot(v.x, v.y) < 1e-6:
                raise ValueError('Cannot establish horizontal heading for '+name)
            return math.atan2(v.x, -v.y)
        before = {n: [heading(q, n) for q in quaternions[n]] for n in trunk}
        targets = {n: retained_heading(before[n], args.heading_retain) for n in trunk}
        fixed = {n: [] for n in quaternions}
        maximum = 0.0
        for i in range(len(positions)):
            root_yaw = targets['Hips'][i]-before['Hips'][i]
            root = Quaternion((0, 0, 1), root_yaw)
            row = {n: root @ keys[i] for n, keys in quaternions.items()}
            chest_yaw = 0.0
            for n in trunk[1:]:
                yaw = targets[n][i]-heading(row[n], n)
                row[n] = Quaternion((0, 0, 1), yaw) @ row[n]
                if n == 'Spine2':
                    chest_yaw = yaw
            # Both arms retain their relative swing against the chest.
            chest = Quaternion((0, 0, 1), chest_yaw)
            for n in quaternions:
                if any(n == side+part for side in ['Left', 'Right']
                       for part in ['Shoulder', 'Arm', 'ForeArm', 'Hand']):
                    row[n] = chest @ row[n]
                maximum = max(maximum, math.degrees(row[n].rotation_difference(quaternions[n][i]).angle))
                fixed[n].append(row[n])
        leg_change = 0.0
        for side in ['Left', 'Right']:
            chain = ['Hips']+[side+p for p in ['UpLeg', 'Leg', 'Foot', 'ToeBase']]
            for parent, child in zip(chain, chain[1:]):
                for i in range(len(positions)):
                    a = quaternions[parent][i].inverted() @ quaternions[child][i]
                    b = fixed[parent][i].inverted() @ fixed[child][i]
                    difference = a.rotation_difference(b)
                    leg_change = max(leg_change, math.degrees(2*math.atan2(
                        math.sqrt(difference.x**2+difference.y**2+difference.z**2), abs(difference.w))))
        summary = {'headingRetain': args.heading_retain,
                   'headingSpanDegrees': {n: {'before': math.degrees(max(before[n])-min(before[n])),
                                              'after': math.degrees(max(targets[n])-min(targets[n]))} for n in trunk},
                   'maximumCorrectionDegrees': maximum,
                   'maximumLowerBodyRelativeRotationChangeDegrees': leg_change,
                   'baseline': 'the existing endpoint-corrected retarget cycle',
                   'rootTranslationAndFrameTimingPreserved': True,
                   'artApproval': 'not-assessed'}
        refused = maximum > args.max_heading_correction_degrees or leg_change > .001
        summary['status'] = 'rejected' if refused else 'prepared'
        (out/'heading-stabilization.json').write_text(json.dumps(summary, indent=2)+'\n')
        if refused:
            raise ValueError('Heading correction or lower-body preservation limit exceeded; see heading-stabilization.json')
        return fixed, positions, angle, residual

    forwarded = ['--source', str(args.source), '--target', str(args.target), '--output', str(out),
                 '--start', str(args.start), '--end', str(args.end), '--motion-id', 'run',
                 '--ground-mode', 'constant', '--loop-mode', 'correct',
                 '--max-loop-angle-degrees', str(args.max_loop_angle_degrees),
                 '--max-loop-joint-error', str(args.max_loop_joint_error)]
    if args.expected_source_sha256:
        forwarded += ['--expected-source-sha256', args.expected_source_sha256]
    previous_argv = sys.argv
    original.periodic_values = stable_periodic
    try:
        sys.argv = [__file__, '--']+forwarded
        original.main()
    finally:
        original.periodic_values, sys.argv = periodic, previous_argv


if __name__ == '__main__':
    main()
