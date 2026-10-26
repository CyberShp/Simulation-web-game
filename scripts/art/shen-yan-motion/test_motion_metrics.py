import math
import unittest

from motion_metrics import analyse_motion, endpoint_error, ground_offsets, loop_refusal_reasons, quaternion_angle_degrees


def periodic_samples():
    samples = []
    for frame in range(41):
        phase = frame/20*2*math.pi
        root = [frame*.04, 0, 1+.08*math.sin(phase)**2]
        feet = {'L': [-.2, 0, .12*max(0, math.sin(phase))],
                'R': [.2, 0, .12*max(0, -math.sin(phase))]}
        samples.append({'frame': frame, 'positions': {'root': root, **{
            name: [root[0]+pos[0], pos[1], pos[2]] for name, pos in feet.items()}},
                        'rotations': {'root': [1, 0, 0, 0],
                                      'L': [math.cos(.3*math.sin(phase)), math.sin(.3*math.sin(phase)), 0, 0],
                                      'R': [math.cos(-.3*math.sin(phase)), math.sin(-.3*math.sin(phase)), 0, 0]}})
    return samples


class MotionMetricsTest(unittest.TestCase):
    def test_quaternion_sign_is_the_same_rotation(self):
        self.assertEqual(quaternion_angle_degrees([1, 0, 0, 0], [-1, 0, 0, 0]), 0)

    def test_endpoint_uses_root_relative_pose_but_keeps_true_difference(self):
        samples = periodic_samples()
        error = endpoint_error(samples[0], samples[20], 'root', ['root', 'L', 'R'])
        self.assertLess(error['maximumRootRelativeJointDistance'], 1e-10)
        changed = endpoint_error(samples[0], samples[5], 'root', ['root', 'L', 'R'])
        self.assertGreater(changed['maximumRotationDegrees'], 20)
        self.assertGreater(changed['maximumRootRelativeJointDistance'], .03)

    def test_candidate_reports_raw_period_and_stride_without_correction(self):
        samples = periodic_samples()
        before = repr(samples)
        result = analyse_motion(samples, 20, 'root', ['root', 'L', 'R'],
                                {'left': ('L', 'L'), 'right': ('R', 'R')}, 1, .8, 1.2, 4)
        first = result['candidates'][0]
        self.assertAlmostEqual(first['periodSeconds'], 1)
        self.assertAlmostEqual(first['horizontalStrideSourceUnits'], .8)
        self.assertFalse(result['candidateRules']['closureCorrectionApplied'])
        self.assertEqual(repr(samples), before)

    def test_constant_ground_keeps_flight_height_variation(self):
        heights = [.1, .15, .3, .15, .1]
        constant = ground_offsets(heights, 'constant')
        self.assertEqual(constant, [-.1]*5)
        self.assertAlmostEqual(max(h+o for h, o in zip(heights, constant)), .2)
        self.assertEqual([h+o for h, o in zip(heights, ground_offsets(heights, 'per-frame'))], [0]*5)
        self.assertEqual(ground_offsets(heights, 'none'), [0]*5)

    def test_zero_displacement_remains_explicit(self):
        samples = periodic_samples()
        for s in samples:
            x = s['positions']['root'][0]
            for p in s['positions'].values():
                p[0] -= x
        result = analyse_motion(samples, 20, 'root', ['root', 'L', 'R'],
                                {'left': ('L', 'L'), 'right': ('R', 'R')}, 1, .8, 1.2)
        self.assertEqual(result['root']['horizontalDisplacement'], 0)
        self.assertEqual(result['candidates'][0]['horizontalStrideSourceUnits'], 0)

    def test_original_loop_limits_are_checked_before_any_correction(self):
        error = {'maximumRotationDegrees': 8.91357, 'maximumRootRelativeJointDistance': .06321}
        self.assertEqual(loop_refusal_reasons(error, 12, .08), [])
        self.assertEqual(len(loop_refusal_reasons(error, 8, .08)), 1)
        self.assertEqual(len(loop_refusal_reasons(error, 12, .06)), 1)
        self.assertEqual(error['maximumRotationDegrees'], 8.91357)

    def test_limit_boundaries_are_inclusive_and_invalid_bounds_fail(self):
        error = {'maximumRotationDegrees': 12, 'maximumRootRelativeJointDistance': .08}
        self.assertEqual(loop_refusal_reasons(error, 12, .08), [])
        with self.assertRaises(ValueError):
            loop_refusal_reasons(error, -1, .08)

    def test_invalid_sampling_and_nonfinite_ground_are_rejected(self):
        with self.assertRaises(ValueError):
            ground_offsets([float('nan')], 'constant')
        with self.assertRaises(ValueError):
            analyse_motion(periodic_samples(), 0, 'root', ['root'], {}, 1)


if __name__ == '__main__':
    unittest.main()
