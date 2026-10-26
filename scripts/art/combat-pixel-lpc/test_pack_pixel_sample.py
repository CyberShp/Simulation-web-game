import unittest
from PIL import Image
from pack_pixel_sample import compose_cell, crop_cell, action_frames, HAND


class WholeFramePacking(unittest.TestCase):
    def test_oversize_sword_uses_its_same_frame_and_body_center(self):
        body = Image.new('RGBA', (384, 1024))
        body.putpixel((2 * 64 + 3, 15 * 64 + 5), (7, 11, 13, 255))
        back = Image.new('RGBA', (1152, 768))
        front = back.copy()
        back.putpixel((2 * 192, 3 * 192), (17, 19, 23, 255))
        front.putpixel((2 * 192 + 191, 3 * 192 + 191), (29, 31, 37, 255))
        before = body.tobytes()
        out = compose_cell([body], 2, 15, {'slashBack': back, 'slashFront': front}, 3)
        self.assertEqual(out.getpixel((67, 69)), (7, 11, 13, 255))
        self.assertEqual(out.getpixel((0, 0)), (17, 19, 23, 255))
        self.assertEqual(out.getpixel((191, 191)), (29, 31, 37, 255))
        self.assertEqual(body.tobytes(), before)

    def test_out_of_bounds_crop_is_rejected(self):
        with self.assertRaises(ValueError): crop_cell(Image.new('RGBA', (64, 64)), 1, 0, 64)

    def test_author_mapping_and_exact_move_period(self):
        self.assertEqual(sum(x[3] for x in action_frames('move', 'right')), 460)
        self.assertEqual([(x[1], x[2]) for x in action_frames('guard', 'down')],
                         [(1, 'windup'), (2, 'windup'), (3, 'release'), (4, 'recovery'), (6, 'recovery'), (3, 'guard')])
        self.assertEqual([x[1] for x in action_frames('hit', 'down')], [1])
        self.assertEqual([x[1] for x in action_frames('down', 'down')], [2, 3, 4, 5])
        self.assertEqual([(x[1], x[2], x[3]) for x in action_frames('dodge', 'right')],
                         [(4, 'windup', 100), (5, 'release', 100), (5, 'recovery', 100), (5, 'evade', 500)])
        self.assertEqual([x[2] for x in action_frames('attack', 'right')], ['windup', 'windup', 'windup', 'release', 'release', 'recovery'])

    def test_author_release_anchors_are_column_specific(self):
        self.assertEqual(HAND['up']['3'], [111, 107])
        self.assertEqual(HAND['up']['4'], [119, 98])
        self.assertEqual(HAND['right']['3'], [106, 106])
        self.assertEqual(HAND['right']['4'], [107, 100])


if __name__ == '__main__': unittest.main()
