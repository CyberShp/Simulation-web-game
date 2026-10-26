#!/usr/bin/env python3
"""Small synthetic pixel fixtures; these tests make no animation-quality claim."""

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

import pipeline
import inspect_alpha


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.outputs = self.root / "outputs"

    def tearDown(self):
        self.temporary.cleanup()

    def make_frame(self, name, size=(8, 8), color=(200, 60, 30, 127), shift=0):
        image = Image.new("RGBA", size, (9, 8, 7, 0))
        image.putpixel((2 + shift, 2), color)
        image.putpixel((3 + shift, 5), (30, 100, 200, 255))
        path = self.root / name
        image.save(path)
        return path

    def pack(self, *options, name="sample", success=True):
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = pipeline.main(["pack", "--output-root", str(self.outputs), "--name", name, *map(str, options)])
        self.assertEqual(code, 0 if success else 1, stderr.getvalue())
        return json.loads(stdout.getvalue() if success else stderr.getvalue())

    def test_rgba_foot_registration_atlas_and_repeated_run(self):
        first = self.make_frame("a.png")
        second = self.make_frame("b.png", shift=1)
        before = [pipeline.sha256(first), pipeline.sha256(second)]
        spec = self.root / "source.json"
        spec.write_text(json.dumps({"id": "fixture-walk-right", "visualIdentity": "fixture", "action": "walk", "direction": "right",
                                    "foot": [4, 7], "sourceHeight": 6, "expectedDurationMs": 200,
                                    "frames": [{"file": "a.png", "durationMs": 80, "phase": "move", "anchors": {"hand": [2.5, 2]}},
                                               {"file": "b.png", "foot": [5, 7], "durationMs": 120, "phase": "move"}]}))
        result = self.pack("--spec", spec)
        output = Path(result["output"])
        manifest = pipeline.read_json(output / "manifest.json")
        self.assertEqual(manifest["frameSize"], [13, 12])
        self.assertEqual(manifest["foot"], [7, 9])
        self.assertEqual(manifest["frames"][0]["anchors"]["hand"], [5.5, 4])
        self.assertEqual(manifest["action"], "walk")
        self.assertEqual(manifest["durationMs"], 200)
        for index, path in enumerate([first, second]):
            frame = Image.open(output / manifest["frames"][index]["file"]).convert("RGBA")
            offset = [3 - index, 2]
            self.assertEqual(frame.crop((offset[0], offset[1], offset[0] + 8, offset[1] + 8)).tobytes(), Image.open(path).convert("RGBA").tobytes())
            self.assertEqual(frame.getpixel((2 + index + offset[0], 4))[3], 127)
        self.assertEqual(before, [pipeline.sha256(first), pipeline.sha256(second)])
        self.assertEqual(pipeline.validate_bundle(output)["algorithmStatus"], "passed")
        old_hashes = pipeline.read_json(output / "checksums.json")
        second_output = Path(self.pack("--spec", spec)["output"])
        self.assertNotEqual(output, second_output)
        self.assertEqual(pipeline.read_json(second_output / "checksums.json"), old_hashes)
        self.assertEqual(pipeline.read_json(output / "checksums.json"), old_hashes)

    def test_sheet_row_major_crops_keep_alpha(self):
        image = Image.new("RGBA", (8, 4), (0, 0, 0, 0))
        image.putpixel((1, 1), (20, 50, 90, 33))
        image.putpixel((6, 2), (90, 10, 40, 201))
        path = self.root / "sheet.png"
        image.save(path)
        output = Path(self.pack("--sheet", path, "--tile", 4, 4, "--foot", 2, 3, "--source-height", 3)["output"])
        first = Image.open(output / "frames/0000.png")
        second = Image.open(output / "frames/0001.png")
        self.assertEqual(first.getpixel((3, 3)), (20, 50, 90, 33))
        self.assertEqual(second.getpixel((4, 4)), (90, 10, 40, 201))
        self.assertEqual(len(list((output / "inputs").glob("*.png"))), 1)

    def test_duplicate_warning_and_strict_rejection(self):
        path = self.make_frame("same.png")
        options = ["--inputs", path, path, "--foot", 4, 7, "--source-height", 6]
        result = self.pack(*options)
        self.assertEqual(result["distinctFrames"], 1)
        self.assertIn("duplicate-frames", [warning["code"] for warning in result["warnings"]])
        failed = self.pack(*options, "--reject-duplicates", success=False)
        self.assertIn("duplicate", failed["error"])
        self.assertTrue((self.outputs / "sample-v002/failure.json").is_file())

    def test_bad_crop_and_clipping_fail_before_output(self):
        path = self.make_frame("a.png")
        spec = self.root / "bad.json"
        spec.write_text(json.dumps({"foot": [4, 7], "sourceHeight": 6, "frames": [{"file": "a.png", "crop": [0, 0, 9, 8]}]}))
        self.assertIn("crop", self.pack("--spec", spec, success=False)["error"])
        self.assertIn("clip", self.pack("--inputs", path, "--foot", 4, 7, "--source-height", 6, "--canvas", 5, 8, "--target-foot", 4, 7, success=False)["error"])
        self.assertFalse(self.outputs.exists())

    def test_duration_mismatch_and_source_height_mismatch_fail(self):
        path = self.make_frame("a.png")
        self.assertIn("Duration", self.pack("--inputs", path, "--foot", 4, 7, "--source-height", 6, "--expected-duration-ms", 101, success=False)["error"])
        spec = self.root / "bad-height.json"
        spec.write_text(json.dumps({"foot": [4, 7], "sourceHeight": 6, "frames": [{"file": "a.png"}, {"file": "a.png", "sourceHeight": 7}]}))
        self.assertIn("sourceHeight", self.pack("--spec", spec, success=False)["error"])

    def test_empty_and_opaque_sources_are_distinguished(self):
        empty = self.root / "empty.png"
        Image.new("RGBA", (8, 8)).save(empty)
        self.assertIn("empty", self.pack("--inputs", empty, "--foot", 4, 7, "--source-height", 6, success=False)["error"])
        opaque = self.root / "opaque.png"
        Image.new("RGB", (8, 8), (50, 70, 90)).save(opaque)
        result = self.pack("--inputs", opaque, "--foot", 4, 7, "--source-height", 6)
        self.assertIn("opaque-source", [warning["code"] for warning in result["warnings"]])
        output = Path(result["output"])
        qc = pipeline.read_json(output / "qc.json")
        self.assertEqual(qc["artReview"], "not-reviewed")
        self.assertEqual(Image.open(output / "frames/0000.png").getpixel((3, 3)), (50, 70, 90, 255))

    def test_saved_pixel_tampering_is_detected(self):
        path = self.make_frame("a.png")
        output = Path(self.pack("--inputs", path, "--foot", 4, 7, "--source-height", 6)["output"])
        frame_path = output / "frames/0000.png"
        image = Image.open(frame_path)
        image.putpixel((0, 0), (1, 2, 3, 4))
        image.save(frame_path)
        with self.assertRaisesRegex(pipeline.PipelineError, "Checksum mismatch"):
            pipeline.validate_bundle(output)

    def test_input_anchors_require_crop_local_valid_points(self):
        self.make_frame("a.png")
        spec = self.root / "bad-anchor.json"
        spec.write_text(json.dumps({"foot": [4, 7], "sourceHeight": 6, "frames": [{"file": "a.png", "anchors": {"hand": [20, 2]}}]}))
        self.assertIn("outside the crop", self.pack("--spec", spec, success=False)["error"])

    def test_fractional_frame_timing_remains_exact_in_runtime_manifest(self):
        path = self.make_frame("a.png")
        result = self.pack("--inputs", path, "--foot", 4, 7, "--source-height", 6, "--duration-ms", 83)
        output = Path(result["output"])
        self.assertEqual(pipeline.read_json(output / "manifest.json")["durationMs"], 83)
        self.assertEqual(pipeline.read_json(output / "qc.json")["preview"]["gifDurationMs"], 80)
        self.assertIn("gif-duration-quantized", [warning["code"] for warning in result["warnings"]])

    def test_one_uniform_scale_preserves_sampled_alpha_and_reference_height(self):
        path = self.make_frame("a.png")
        output = Path(self.pack("--inputs", path, "--foot", 4, 7, "--source-height", 6, "--scale", 2)["output"])
        manifest = pipeline.read_json(output / "manifest.json")
        self.assertEqual(manifest["frameSize"], [20, 20])
        self.assertEqual(manifest["foot"], [10, 16])
        self.assertEqual(manifest["sourceHeight"], 12)
        self.assertEqual(manifest["provenance"]["uniformScale"], 2)
        frame = Image.open(output / "frames/0000.png")
        original = Image.open(path).convert("RGBA")
        for y in range(8):
            for x in range(8):
                for dy in range(2):
                    for dx in range(2):
                        self.assertEqual(frame.getpixel((2 + 2 * x + dx, 2 + 2 * y + dy)), original.getpixel((x, y)))
        qc = pipeline.read_json(output / "qc.json")
        self.assertEqual([item["targetBodyHeight"] for item in qc["heightPreviews"]], [111, 150, 222])
        self.assertTrue(all((output / f"contact-sheet-{height}.png").is_file() for height in [111, 150, 222]))

    def test_per_frame_scale_is_rejected(self):
        self.make_frame("a.png")
        spec = self.root / "per-frame-scale.json"
        spec.write_text(json.dumps({"foot": [4, 7], "sourceHeight": 6, "frames": [{"file": "a.png", "scale": 2}]}))
        self.assertIn("clip-level scale", self.pack("--spec", spec, success=False)["error"])

    def test_gif_uses_cumulative_timing_grid_for_twelve_fps(self):
        self.make_frame("a.png")
        spec = self.root / "twelve-fps.json"
        spec.write_text(json.dumps({"foot": [4, 7], "sourceHeight": 6, "expectedDurationMs": 1000,
                                    "frames": [{"file": "a.png", "durationMs": round((i + 1) * 1000 / 12) - round(i * 1000 / 12)} for i in range(12)]}))
        output = Path(self.pack("--spec", spec)["output"])
        self.assertEqual(pipeline.read_json(output / "qc.json")["preview"]["gifDurationMs"], 1000)

    def test_rehashed_invalid_geometry_and_incomplete_checksums_are_rejected(self):
        path = self.make_frame("a.png")
        output = Path(self.pack("--inputs", path, "--foot", 4, 7, "--source-height", 6)["output"])
        manifest = pipeline.read_json(output / "manifest.json")
        manifest["frames"][0]["x"] = -1
        pipeline.write_json(output / "manifest.json", manifest)
        checksums = pipeline.read_json(output / "checksums.json")
        checksums["manifest.json"] = pipeline.sha256(output / "manifest.json")
        pipeline.write_json(output / "checksums.json", checksums)
        with self.assertRaisesRegex(pipeline.PipelineError, "atlas bounds"):
            pipeline.validate_bundle(output)
        checksums.pop("frames/0000.png")
        pipeline.write_json(output / "checksums.json", checksums)
        with self.assertRaisesRegex(pipeline.PipelineError, "cover all"):
            pipeline.validate_bundle(output)

    def test_failure_marker_prevents_loading_a_partial_bundle(self):
        path = self.make_frame("a.png")
        output = Path(self.pack("--inputs", path, "--foot", 4, 7, "--source-height", 6)["output"])
        pipeline.write_json(output / "failure.json", {"algorithmStatus": "failed"})
        with self.assertRaisesRegex(pipeline.PipelineError, "failure.json"):
            pipeline.validate_bundle(output)

    def test_alpha_inspection_composites_whole_sheet_without_mutating_source(self):
        image = Image.new("RGBA", (4, 2), (32, 26, 20, 0))
        image.putpixel((2, 1), (200, 60, 30, 127))
        source = self.root / "sheet.png"
        image.save(source)
        background = self.root / "scene.png"
        Image.new("RGB", (8, 4), (10, 20, 40)).save(background)
        before = pipeline.sha256(source)
        output = Path(inspect_alpha.inspect(source, self.outputs, "alpha", background, samples=[(0, 0), (2, 1)])["output"])
        white = Image.open(output / "on-white.png")
        scene = Image.open(output / "on-scene.png")
        self.assertEqual(white.size, (4, 2))
        self.assertEqual(white.getpixel((0, 0)), (255, 255, 255, 255))
        self.assertEqual(scene.getpixel((0, 0)), (10, 20, 40, 255))
        self.assertEqual(white.getpixel((2, 1)), (228, 158, 143, 255))
        self.assertEqual(scene.getpixel((2, 1)), (105, 40, 35, 255))
        self.assertEqual(pipeline.sha256(source), before)
        self.assertEqual(pipeline.sha256(output / "inputs/source.png"), before)
        report = pipeline.read_json(output / "inspection.json")
        self.assertEqual(report["alphaHistogramBins"]["0"], 7)
        self.assertEqual(report["alphaHistogramBins"]["64..127"], 1)
        self.assertEqual(report["sourceAlphaTransform"], "identity")

    def test_authored_concave_polygon_keeps_inside_rgba_and_outside_rgb(self):
        image = Image.new("RGBA", (8, 8), (20, 30, 40, 127))
        image.putpixel((0, 0), (11, 22, 33, 0))
        path = self.root / "sheet.png"
        image.save(path)
        before = pipeline.sha256(path)
        polygon = [[0, 0], [8, 0], [8, 3], [4, 3], [4, 8], [0, 8]]
        spec = self.root / "clip.json"
        spec.write_text(json.dumps({"foot": [4, 7], "sourceHeight": 6,
                                    "frames": [{"file": "sheet.png", "clipPolygon": polygon}]}))
        output = Path(self.pack("--spec", spec)["output"])
        frame = Image.open(output / "frames/0000.png")
        self.assertEqual(frame.getpixel((9, 3)), image.getpixel((7, 1)))
        self.assertEqual(frame.getpixel((4, 9)), image.getpixel((2, 7)))
        self.assertEqual(frame.getpixel((6, 9)), image.getpixel((4, 7)))  # included polygon edge
        self.assertEqual(frame.getpixel((9, 9)), (20, 30, 40, 0))
        self.assertEqual(frame.getpixel((2, 2)), (11, 22, 33, 0))
        self.assertEqual(pipeline.sha256(path), before)
        self.assertEqual(pipeline.sha256(output / "inputs/000-sheet.png"), before)
        manifest = pipeline.read_json(output / "manifest.json")
        self.assertEqual(manifest["frames"][0]["source"]["clipPolygon"], polygon)
        self.assertIn("authored-polygon-alpha-clip", manifest["provenance"]["pixelOperations"])
        clip_qc = pipeline.read_json(output / "qc.json")["frames"][0]["alphaClip"]
        self.assertEqual(clip_qc["removedVisiblePixels"], 12)
        self.assertTrue(clip_qc["insideRgbaPreserved"])
        self.assertTrue(clip_qc["outsideRgbPreserved"])

    def test_polygon_input_rejects_invalid_boundaries_and_shapes(self):
        self.make_frame("a.png")
        polygons = [([[0, 0], [9, 0], [0, 7]], "outside"),
                    ([[0, 0], [1, 1], [2, 2]], "degenerate"),
                    ([[0, 0], [7, 0]], "three"),
                    ([[0, 0], [7, 0], [7, 7], [0, 7], [7, 3]], "self-intersecting"),
                    ([[0, 0], [7.5, 0], [0, 7]], "integers")]
        for index, (polygon, error) in enumerate(polygons):
            with self.subTest(index=index):
                spec = self.root / f"bad-polygon-{index}.json"
                spec.write_text(json.dumps({"foot": [4, 7], "sourceHeight": 6,
                                            "frames": [{"file": "a.png", "clipPolygon": polygon}]}))
                self.assertIn(error, self.pack("--spec", spec, success=False)["error"])

    def test_full_boundary_polygon_and_closed_endpoint_keep_all_pixels(self):
        path = self.make_frame("a.png")
        image = Image.open(path).convert("RGBA")
        polygon = [[0, 0], [8, 0], [8, 8], [0, 8], [0, 0]]
        result, qc = pipeline.clip_authored_polygon(image, polygon, "fixture polygon")
        self.assertEqual(result.tobytes(), image.tobytes())
        self.assertEqual(qc["removedVisiblePixels"], 0)
        self.assertEqual(qc["clipPolygon"], polygon[:-1])


if __name__ == "__main__":
    unittest.main()
