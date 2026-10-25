#!/usr/bin/env python3
"""Place authored whole sprites and a plate on one offline nearest-sampled grid."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageDraw, __version__ as pillow_version


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def alpha_metrics(image):
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    bounds = {}
    for threshold in (1, 8, 32, 128, 255):
        box = alpha.point(lambda value: 255 if value >= threshold else 0).getbbox()
        bounds[str(threshold)] = list(box) if box else None
    return {"size": list(image.size), "alphaRange": list(alpha.getextrema()),
            "visiblePixels": sum(histogram[1:]), "opaquePixels": histogram[255],
            "semiTransparentPixels": sum(histogram[1:255]), "boundsExclusive": bounds}


def nearest_uniform(image, size, scale):
    return image.transform(size, Image.Transform.AFFINE,
                           (1 / scale, 0, 0, 0, 1 / scale, 0),
                           resample=Image.Resampling.NEAREST, fillcolor=(0, 0, 0, 0))


def checker(image, unit=8):
    background = Image.new("RGBA", image.size, (215, 215, 215, 255))
    draw = ImageDraw.Draw(background)
    for y in range(0, image.height, unit):
        for x in range(0, image.width, unit):
            if (x // unit + y // unit) % 2:
                draw.rectangle((x, y, x + unit - 1, y + unit - 1), fill=(165, 165, 165, 255))
    background.alpha_composite(image)
    return background.convert("RGB")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-masters", type=Path, required=True)
    parser.add_argument("--background", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--qa-root", type=Path, required=True)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    pipeline = repo / "scripts/art/combat-frame-pipeline/pipeline.py"
    args.output_root.mkdir(parents=True, exist_ok=True)
    for version in range(1, 10000):
        output = args.output_root / f"common-grid-v{version:03d}"
        try:
            output.mkdir()
            break
        except FileExistsError:
            continue
    else:
        raise RuntimeError("No unused calibration version")
    (output / "specs").mkdir()
    source_hashes = {str(path.resolve()): sha(path) for path in (args.source_masters, args.background)}
    masters = Image.open(args.source_masters).convert("RGBA")
    plate = Image.open(args.background).convert("RGBA")
    if masters.size != (1774, 887) or plate.size != (1536, 1024):
        raise ValueError("This authored calibration expects 1774x887 masters and a 1536x1024 plate")
    logical_width = 880
    background_scale = logical_width / plate.width
    logical_height_float = plate.height * background_scale
    logical_size = (logical_width, round(logical_height_float))
    presentation_scale = plate.width / logical_width
    scene = nearest_uniform(plate, logical_size, background_scale)
    scene.save(output / "background-logical.png")
    sprite_scale = 58 / 414
    definitions = {
        "human": {"crop": [80, 350, 700, 500], "domain": [0, 0, 780, 887],
                  "footGlobal": [310, 804], "requestedScreenFoot": [507, 676],
                  "identity": "shen-yan", "direction": "right"},
        "beast": {"crop": [780, 120, 980, 750], "domain": [780, 0, 994, 887],
                  "footGlobal": [1255, 823], "requestedScreenFoot": [1044, 430],
                  "identity": "shanxiao", "direction": "left"},
    }
    report = {"scope": "offline common-grid static calibration only", "algorithmStatus": "passed",
              "artReview": "pending-root", "spatialCollisionValidation": "not-run",
              "python": sys.version.split()[0], "pillow": pillow_version,
              "scriptSha256": sha(__file__), "sourceHashes": source_hashes,
              "logicalPixelsPerMetre": 40, "viewWidthMetres": 22,
              "standingReferenceMetres": 1.45, "sourceStandingReference": 414,
              "logicalStandingReference": 58, "commonSpriteScale": sprite_scale,
              "commonSpriteScaleFraction": "58/414", "logicalSize": list(logical_size),
              "presentationScale": presentation_scale, "presentationSize": list(plate.size),
              "theoreticalScreenStandingReference": 1.45 * 1536 / 22,
              "logicalBackgroundHeightBeforeRounding": logical_height_float,
              "logicalBackgroundHeightRoundingError": logical_size[1] - logical_height_float,
              "uniformPresentedBackgroundHeight": logical_size[1] * presentation_scale,
              "bottomViewportCropPixels": logical_size[1] * presentation_scale - plate.height,
              "pixelOperations": ["explicit-crop", "common-nearest-scale", "integer-whole-frame-placement",
                                  "alpha-composite", "uniform-nearest-presentation", "viewport-bottom-crop"],
              "actors": {}, "commands": []}
    contacts = []
    for name, definition in definitions.items():
        x, y, width, height = definition["crop"]
        crop = masters.crop((x, y, x + width, y + height))
        dx, dy, dw, dh = definition["domain"]
        domain = masters.crop((dx, dy, dx + dw, dy + dh))
        crop_metrics, domain_metrics = alpha_metrics(crop), alpha_metrics(domain)
        local_foot = [definition["footGlobal"][0] - x, definition["footGlobal"][1] - y]
        spec = {"id": f"common-grid-{name}", "visualIdentity": definition["identity"],
                "action": "idle", "direction": definition["direction"], "sourceHeight": 414,
                "scale": sprite_scale, "foot": local_foot, "margin": 2,
                "previewHeights": [58, 116], "loop": True,
                "metadata": {"scope": "offline static calibration", "authorStandingReference": 414},
                "frames": [{"file": str(args.source_masters.resolve()), "crop": definition["crop"],
                            "durationMs": 1000, "phase": "idle"}]}
        spec_path = output / "specs" / f"{name}.json"
        save_json(spec_path, spec)
        command = [sys.executable, str(pipeline), "pack", "--spec", str(spec_path.resolve()),
                   "--output-root", str((output / "packs").resolve()), "--name", name]
        environment = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
        result = subprocess.run(command, check=True, text=True, capture_output=True, env=environment)
        packed = json.loads(result.stdout)
        bundle = Path(packed["output"])
        validate_command = [sys.executable, str(pipeline), "validate", str(bundle)]
        validation = json.loads(subprocess.check_output(validate_command, text=True, env=environment))
        report["commands"].extend([command, validate_command])
        manifest = json.loads((bundle / "manifest.json").read_text())
        if abs(manifest["sourceHeight"] - 58) > 1e-10:
            raise ValueError("Common source scale changed")
        frame = Image.open(bundle / "frames/0000.png").convert("RGBA")
        logical_foot_float = [value / presentation_scale for value in definition["requestedScreenFoot"]]
        logical_foot = [round(value) for value in logical_foot_float]
        position = [logical_foot[i] - manifest["foot"][i] for i in range(2)]
        isolated = Image.new("RGBA", logical_size, (0, 0, 0, 0))
        isolated.alpha_composite(frame, tuple(position))
        if alpha_metrics(isolated)["visiblePixels"] != alpha_metrics(frame)["visiblePixels"]:
            raise ValueError(f"Viewport would clip {name}")
        scene.alpha_composite(frame, tuple(position))
        presented = nearest_uniform(isolated, plate.size, presentation_scale)
        presented.save(output / f"{name}-presented-alpha.png")
        frame_presented = nearest_uniform(frame,
                                         (math.ceil(frame.width * presentation_scale),
                                          math.ceil(frame.height * presentation_scale)), presentation_scale)
        contacts.append((name, frame, frame_presented))
        actual_foot = [value * presentation_scale for value in logical_foot]
        report["actors"][name] = {**definition, "sourceFootCropLocal": local_foot,
                                  "sourceCropMetrics": crop_metrics,
                                  "outsideCropNonzeroPixelsWithinDomain": domain_metrics["visiblePixels"] - crop_metrics["visiblePixels"],
                                  "logicalFrameMetrics": alpha_metrics(frame),
                                  "presentedMetrics": alpha_metrics(presented),
                                  "manifest": str((bundle / "manifest.json").relative_to(output)),
                                  "outputSourceHeight": manifest["sourceHeight"],
                                  "outputFrameFoot": manifest["foot"], "logicalPlacement": position,
                                  "requestedLogicalFoot": logical_foot_float, "actualLogicalFoot": logical_foot,
                                  "actualScreenFootContinuous": actual_foot,
                                  "screenFootRoundingError": [actual_foot[i] - definition["requestedScreenFoot"][i] for i in range(2)],
                                  "pipelineValidation": validation,
                                  "anatomicalHeightReestimatedFromBounds": False}
    scene.save(output / "scene-logical.png")
    nearest_uniform(scene, plate.size, presentation_scale).save(output / "calibrated-scene.png")
    panel_width, row_height = 560, 440
    contact = Image.new("RGB", (panel_width * 3, row_height * 2), (32, 35, 39))
    draw = ImageDraw.Draw(contact)
    for row, (name, frame, presented_frame) in enumerate(contacts):
        for column, (label, image) in enumerate((("logical 1x", frame), ("1536-view size", presented_frame),
                                                ("1536-view size 2x", presented_frame.resize((presented_frame.width * 2, presented_frame.height * 2), Image.Resampling.NEAREST)))):
            at = (column * panel_width, row * row_height)
            draw.text((at[0] + 12, at[1] + 12), f"{name} / {label}", fill=(235, 235, 235))
            contact.paste(checker(image), (at[0] + (panel_width - image.width) // 2,
                                         at[1] + 32 + (row_height - 40 - image.height) // 2))
    contact.save(output / "contact-sheet.png")
    report["sourceUnchanged"] = all(sha(path) == digest for path, digest in source_hashes.items())
    if not report["sourceUnchanged"]:
        raise ValueError("Source file changed during calibration")
    save_json(output / "calibration.json", report)
    checksums = {str(path.relative_to(output)): sha(path) for path in sorted(output.rglob("*")) if path.is_file()}
    save_json(output / "checksums.json", checksums)
    args.qa_root.mkdir(parents=True, exist_ok=True)
    save_json(args.qa_root / f"{output.name}-calibration.json", report)
    print(json.dumps({"output": str(output.resolve()), "scene": str((output / "calibrated-scene.png").resolve()),
                      "contact": str((output / "contact-sheet.png").resolve()), "sourceUnchanged": True,
                      "actors": {name: {"logicalBounds": actor["logicalFrameMetrics"]["boundsExclusive"],
                                        "presentedBounds": actor["presentedMetrics"]["boundsExclusive"],
                                        "screenFootRoundingError": actor["screenFootRoundingError"]}
                                 for name, actor in report["actors"].items()}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
