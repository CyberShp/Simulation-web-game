#!/usr/bin/env python3
"""Inspect a complete PNG sheet by compositing its actual alpha on review backgrounds."""

import argparse
import json
import sys
from pathlib import Path
from shutil import copyfile

from PIL import Image, ImageOps

from pipeline import PipelineError, reserve_output, sha256, write_json


def alpha_histogram(image):
    histogram = image.getchannel("A").histogram()
    return {"0": histogram[0], "1..31": sum(histogram[1:32]), "32..63": sum(histogram[32:64]),
            "64..127": sum(histogram[64:128]), "128..191": sum(histogram[128:192]),
            "192..253": sum(histogram[192:254]), "254": histogram[254], "255": histogram[255]}


def inspect(source_path, output_root, name, background_path=None, fit="cover", samples=None):
    source_path = Path(source_path).expanduser().resolve()
    if source_path.suffix.lower() != ".png":
        raise PipelineError("Inspection source must be a PNG")
    before = sha256(source_path)
    with Image.open(source_path) as source:
        source.load()
        original_mode = source.mode
        image = source.convert("RGBA")
    points = samples if samples is not None else [(10, 10), (512, 500), (1024, 500)]
    point_values = {}
    for point in points:
        if len(point) != 2 or any(type(value) is not int for value in point):
            raise PipelineError("Sample points need integer X Y coordinates")
        if not (0 <= point[0] < image.width and 0 <= point[1] < image.height):
            raise PipelineError(f"Sample point is outside source PNG: {point}")
        point_values[f"{point[0]},{point[1]}"] = list(image.getpixel(tuple(point)))
    background, background_info = None, None
    if background_path:
        background_path = Path(background_path).expanduser().resolve()
        with Image.open(background_path) as source_background:
            source_background.load()
            raw_background = source_background.convert("RGBA")
        if fit == "cover":
            background = ImageOps.fit(raw_background, image.size, method=Image.Resampling.LANCZOS)
        elif fit == "stretch":
            background = raw_background.resize(image.size, Image.Resampling.LANCZOS)
        else:
            raise PipelineError("Scene fit must be cover or stretch")
        flattened = Image.new("RGBA", image.size, (255, 255, 255, 255))
        flattened.alpha_composite(background)
        background = flattened
        background_info = {"source": "inputs/scene" + background_path.suffix.lower(), "sha256": sha256(background_path),
                           "sourceSize": list(raw_background.size), "outputSize": list(image.size),
                           "fit": fit, "sampling": "lanczos", "transparentBackgroundBase": "white"}
    output = reserve_output(output_root, name)
    try:
        (output / "inputs").mkdir()
        copyfile(source_path, output / "inputs/source.png")
        white = Image.new("RGBA", image.size, (255, 255, 255, 255))
        white.alpha_composite(image)
        white.save(output / "on-white.png")
        if background is not None:
            copyfile(background_path, output / background_info["source"])
            background.alpha_composite(image)
            background.save(output / "on-scene.png")
        if sha256(source_path) != before or sha256(output / "inputs/source.png") != before:
            raise PipelineError("Source changed during inspection")
        if background_info and sha256(output / background_info["source"]) != background_info["sha256"]:
            raise PipelineError("Scene background changed during inspection")
        report = {"schema": "combat-alpha-inspection/v1", "algorithmStatus": "passed", "artReview": "not-reviewed",
                  "source": {"file": "inputs/source.png", "sha256": before, "mode": original_mode, "size": list(image.size)},
                  "alphaRange": list(image.getchannel("A").getextrema()), "alphaHistogramBins": alpha_histogram(image),
                  "sampleRGBA": point_values, "sourcePixelTransform": "identity", "sourceAlphaTransform": "identity",
                  "composition": "Pillow RGBA alpha_composite", "background": background_info,
                  "outputs": {"white": "on-white.png", "scene": "on-scene.png" if background_info else None},
                  "notProven": ["halo visual acceptability", "anatomy", "motion quality", "runtime integration"]}
        write_json(output / "inspection.json", report)
        write_json(output / "checksums.json", {str(path.relative_to(output)): sha256(path)
                                               for path in sorted(output.rglob("*")) if path.is_file()})
        return {"output": str(output), "size": list(image.size), "alphaRange": report["alphaRange"],
                "alphaHistogramBins": report["alphaHistogramBins"], "sampleRGBA": point_values,
                "algorithmStatus": "passed", "artReview": "not-reviewed"}
    except Exception as exc:
        write_json(output / "failure.json", {"algorithmStatus": "failed", "error": str(exc)})
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("--background", help="Scene image to scale behind the complete source sheet")
    parser.add_argument("--scene-fit", choices=["cover", "stretch"], default="cover")
    parser.add_argument("--sample", type=int, nargs=2, action="append", help="Repeat for source-pixel RGBA samples")
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args(argv)
    try:
        print(json.dumps(inspect(args.source, args.output_root, args.name, args.background, args.scene_fit, args.sample)))
        return 0
    except (PipelineError, ValueError, OSError, TypeError) as exc:
        print(json.dumps({"algorithmStatus": "failed", "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
