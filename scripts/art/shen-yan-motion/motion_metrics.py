"""Raw motion measurements. No Blender dependency and no pose correction."""
import math

BONE_MAP = {'Hips': 'Pelvis', 'Spine': 'Spine1', 'Spine1': 'Spine2',
            'Spine2': 'Spine3', 'Neck': 'Neck', 'Head': 'Head'}
for side, prefix in [('Left', 'L'), ('Right', 'R')]:
    BONE_MAP.update({side+'Shoulder': prefix+'_Collar', side+'Arm': prefix+'_Shoulder',
                     side+'ForeArm': prefix+'_Elbow', side+'Hand': prefix+'_Wrist',
                     side+'UpLeg': prefix+'_Hip', side+'Leg': prefix+'_Knee',
                     side+'Foot': prefix+'_Ankle', side+'ToeBase': prefix+'_Foot'})


def distance(a, b):
    return math.sqrt(sum((x-y)**2 for x, y in zip(a, b)))


def quaternion_angle_degrees(a, b):
    na = math.sqrt(sum(x*x for x in a))
    nb = math.sqrt(sum(x*x for x in b))
    if min(na, nb) <= 1e-12:
        raise ValueError('Zero quaternion in source motion')
    dot = abs(sum(x*y for x, y in zip(a, b))/(na*nb))
    return math.degrees(2*math.acos(min(1.0, dot)))


def endpoint_error(first, last, root_name, names, scale=1.0):
    angles, joints = {}, {}
    for name in names:
        angles[name] = quaternion_angle_degrees(first['rotations'][name], last['rotations'][name])
        a = [x-y for x, y in zip(first['positions'][name], first['positions'][root_name])]
        b = [x-y for x, y in zip(last['positions'][name], last['positions'][root_name])]
        joints[name] = distance(a, b)*scale
    return {'rotationDegreesByBone': angles, 'rootRelativeJointDistanceByBone': joints,
            'maximumRotationDegrees': max(angles.values()),
            'maximumRootRelativeJointDistance': max(joints.values())}


def ground_offsets(heights, mode):
    if not heights or any(not math.isfinite(x) for x in heights):
        raise ValueError('Finite sole measurements are required')
    if mode == 'per-frame':
        return [-x for x in heights]
    if mode == 'constant':
        return [-min(heights)]*len(heights)
    if mode == 'none':
        return [0.0]*len(heights)
    raise ValueError('Unknown ground mode: '+mode)


def loop_refusal_reasons(error, max_angle=None, max_joint=None):
    reasons = []
    for bound in [max_angle, max_joint]:
        if bound is not None and (not math.isfinite(bound) or bound < 0):
            raise ValueError('Loop refusal limits must be finite and nonnegative')
    if max_angle is not None and error['maximumRotationDegrees'] > max_angle:
        reasons.append('Original endpoint rotation exceeds --max-loop-angle-degrees')
    if max_joint is not None and error['maximumRootRelativeJointDistance'] > max_joint:
        reasons.append('Original root-relative endpoint distance exceeds --max-loop-joint-error (source scene units)')
    return reasons


def analyse_motion(samples, fps, root_name, pose_names, feet, leg_length,
                   min_period=.35, max_period=1.5, candidate_count=12):
    if fps <= 0 or len(samples) < 3 or leg_length <= 1e-12:
        raise ValueError('Need positive FPS, nonzero leg length and at least three samples')
    if not 0 < min_period <= max_period or candidate_count < 1:
        raise ValueError('Invalid candidate period/count')
    roots = [s['positions'][root_name] for s in samples]
    frame_seconds = [(s['frame']-samples[0]['frame'])/fps for s in samples]
    if any(b <= a for a, b in zip(frame_seconds, frame_seconds[1:])):
        raise ValueError('Source frames must increase strictly')
    velocities, foot_rows = [], []
    proxy_floor = min(s['positions'][n][2] for s in samples for pair in feet.values() for n in pair)
    for i, s in enumerate(samples):
        lo, hi = max(0, i-1), min(len(samples)-1, i+1)
        dt = frame_seconds[hi]-frame_seconds[lo]
        velocities.append([(b-a)/dt for a, b in zip(roots[lo], roots[hi])])
        row = {'frame': s['frame'], 'seconds': frame_seconds[i], 'root': roots[i], 'feet': {}}
        for side, (ankle, toe) in feet.items():
            velocity = [(b-a)/dt for a, b in zip(samples[lo]['positions'][toe], samples[hi]['positions'][toe])]
            height = min(s['positions'][ankle][2], s['positions'][toe][2])
            row['feet'][side] = {'ankle': s['positions'][ankle], 'toe': s['positions'][toe],
                                 'proxyHeight': height, 'heightAboveObservedProxyFloor': height-proxy_floor,
                                 'toeVelocity': velocity, 'toeHorizontalSpeed': math.hypot(*velocity[:2]),
                                 'toeSpeed': math.sqrt(sum(x*x for x in velocity))}
        row['bothFeetElevatedProxy'] = all(f['heightAboveObservedProxyFloor'] > leg_length*.04 for f in row['feet'].values())
        foot_rows.append(row)
    candidates = []
    for i, first in enumerate(samples):
        for j in range(i+1, len(samples)):
            seconds = frame_seconds[j]-frame_seconds[i]
            if seconds > max_period:
                break
            if seconds < min_period:
                continue
            error = endpoint_error(first, samples[j], root_name, pose_names)
            angle_rms = math.sqrt(sum(x*x for x in error['rotationDegreesByBone'].values())/len(pose_names))
            joint_rms = math.sqrt(sum(x*x for x in error['rootRelativeJointDistanceByBone'].values())/len(pose_names))
            displacement = [b-a for a, b in zip(roots[i], roots[j])]
            horizontal = math.hypot(*displacement[:2])
            velocity_error = distance(velocities[i], velocities[j])
            candidates.append({'start': first['frame'], 'end': samples[j]['frame'],
                               'periodSeconds': seconds, 'horizontalStrideSourceUnits': horizontal,
                               'rootDisplacement': displacement, 'meanHorizontalSpeed': horizontal/seconds,
                               'poseAngularRmsDegrees': angle_rms, 'maximumRotationDegrees': error['maximumRotationDegrees'],
                               'rootRelativeJointRms': joint_rms, 'maximumRootRelativeJointDistance': error['maximumRootRelativeJointDistance'],
                               'rootEndpointVelocityDifference': velocity_error,
                               'score': angle_rms+90*joint_rms/leg_length+15*velocity_error*seconds/leg_length})
    candidates.sort(key=lambda c: (c['score'], c['start'], c['end']))
    distinct = []
    for c in candidates:
        if any(abs(c['start']-p['start'])/fps < min_period/2 and abs(c['periodSeconds']-p['periodSeconds']) < min_period/4 for p in distinct):
            continue
        distinct.append(c)
        if len(distinct) == candidate_count:
            break
    displacement = [b-a for a, b in zip(roots[0], roots[-1])]
    return {'measurementUnits': 'Blender imported scene units; speeds are scene units/second',
            'root': {'bone': root_name, 'displacement': displacement,
                     'horizontalDisplacement': math.hypot(*displacement[:2]),
                     'verticalRange': [min(p[2] for p in roots), max(p[2] for p in roots)],
                     'horizontalPathLength': sum(math.hypot(b[0]-a[0], b[1]-a[1]) for a, b in zip(roots, roots[1:]))},
            'feet': {'measurement': 'Ankle/toe bone-height proxy; not evaluated mesh soles or proven contacts',
                     'observedProxyFloor': proxy_floor, 'bothFeetElevatedThreshold': leg_length*.04,
                     'bothFeetElevatedProxySamples': sum(r['bothFeetElevatedProxy'] for r in foot_rows), 'samples': foot_rows},
            'candidateRules': {'periodSeconds': [min_period, max_period],
                               'ranking': 'Raw angular, root-relative joint and root-velocity endpoint differences',
                               'automaticSelection': False, 'closureCorrectionApplied': False},
            'candidates': distinct}
