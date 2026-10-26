#!/usr/bin/env python3
"""Package authored whole-frame PNGs or decoded video into a fixed-foot atlas."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from fractions import Fraction
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, __version__ as pillow_version

SCHEMA = "combat-frame-atlas/v1"
FORGE_REVISION = "5324342fdfab72430f4e9604f3fe427009f8596d"
MAX_PIXELS = 160_000_000


class PipelineError(ValueError):
    pass


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def positive(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise PipelineError(f"{label} must be finite and positive")
    return value


def integers(value, count, label):
    if not isinstance(value, (list, tuple)) or len(value) != count or any(type(v) is not int for v in value):
        raise PipelineError(f"{label} must contain {count} integers")
    return list(value)


def pixel_hash(image):
    return hashlib.sha256(image.tobytes()).hexdigest()


def validate_polygon(value, size, label):
    if not isinstance(value, list) or len(value) < 3:
        raise PipelineError(f"{label} needs at least three crop-local integer vertices")
    points = [integers(point, 2, label) for point in value]
    if points[0] == points[-1]:
        points.pop()
    if len(points) < 3 or len({tuple(point) for point in points}) != len(points):
        raise PipelineError(f"{label} has repeated or insufficient vertices")
    if any(not (0 <= x <= size[0] and 0 <= y <= size[1]) for x, y in points):
        raise PipelineError(f"{label} lies outside the crop")
    area = sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1]
               for i in range(len(points)))
    if area == 0:
        raise PipelineError(f"{label} is degenerate")

    def orientation(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    def on_segment(a, b, p):
        return orientation(a, b, p) == 0 and min(a[0], b[0]) <= p[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= p[1] <= max(a[1], b[1])

    def intersects(a, b, c, d):
        values = [orientation(a, b, c), orientation(a, b, d), orientation(c, d, a), orientation(c, d, b)]
        return ((values[0] * values[1] < 0 and values[2] * values[3] < 0)
                or on_segment(a, b, c) or on_segment(a, b, d) or on_segment(c, d, a) or on_segment(c, d, b))

    for i in range(len(points)):
        for j in range(i + 1, len(points)):
            if j == i + 1 or (i == 0 and j == len(points) - 1):
                continue
            if intersects(points[i], points[(i + 1) % len(points)], points[j], points[(j + 1) % len(points)]):
                raise PipelineError(f"{label} is self-intersecting")
    return points


def clip_authored_polygon(image, polygon, label):
    points = validate_polygon(polygon, image.size, label)
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).polygon([tuple(point) for point in points], fill=255)
    original_alpha = image.getchannel("A")
    result = image.copy()
    result.putalpha(ImageChops.multiply(original_alpha, mask))
    changed = ImageChops.difference(original_alpha, result.getchannel("A")).histogram()
    return result, {"clipPolygon": points, "coordinateSpace": "source-crop-local",
                    "inputPixelSha256": pixel_hash(image), "outputPixelSha256": pixel_hash(result),
                    "removedVisiblePixels": image.width * image.height - changed[0],
                    "insideRgbaPreserved": True, "outsideRgbPreserved": True}


def image_metrics(image):
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    bbox = alpha.getbbox()
    return {
        "bounds": list(bbox) if bbox else None,  # exclusive right/bottom
        "visiblePixels": image.width * image.height - histogram[0],
        "transparentPixels": histogram[0],
        "partialAlphaPixels": sum(histogram[1:255]),
        "alphaRange": list(alpha.getextrema()),
        "pixelSha256": pixel_hash(image),
        "alphaSha256": hashlib.sha256(alpha.tobytes()).hexdigest(),
    }


def ffmpeg_binary(explicit=None):
    if explicit:
        candidate = Path(explicit).expanduser().resolve()
        if not candidate.is_file():
            raise PipelineError(f"ffmpeg does not exist: {candidate}")
        return str(candidate)
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as exc:
        raise PipelineError("Video input needs --ffmpeg PATH or optional imageio-ffmpeg==0.6.0") from exc


def reserve_output(root, name):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,95}", name):
        raise PipelineError("--name must be a short filename using letters, numbers, '.', '_' or '-'")
    root = Path(root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    for version in range(1, 100_000):
        output = root / f"{name}-v{version:03d}"
        try:
            output.mkdir()
            return output
        except FileExistsError:
            continue
    raise PipelineError("Version range exhausted")


def load_authored_frames(entries, base, default_foot, default_height, default_duration, default_phase, max_frames):
    if not entries or len(entries) > max_frames:
        raise PipelineError(f"Frame count must be between 1 and {max_frames}")
    frames, sources, total_pixels = [], {}, 0
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or not isinstance(entry.get("file"), str):
            raise PipelineError(f"Frame {index} needs a file")
        if "scale" in entry:
            raise PipelineError("Per-frame scale is unsupported; declare one clip-level scale")
        path = (base / entry["file"]).expanduser().resolve()
        if not path.is_file() or path.suffix.lower() != ".png":
            raise PipelineError(f"Frame source must be an existing PNG: {path}")
        with Image.open(path) as source:
            if getattr(source, "n_frames", 1) != 1:
                raise PipelineError("Animated PNG input must be split into explicit frames first")
            source.load()
            had_alpha = "A" in source.getbands() or "transparency" in source.info
            image = source.convert("RGBA")
        crop = integers(entry.get("crop", [0, 0, image.width, image.height]), 4, f"frame {index} crop")
        x, y, w, h = crop
        if min(x, y) < 0 or min(w, h) <= 0 or x + w > image.width or y + h > image.height:
            raise PipelineError(f"Frame {index} crop exceeds its source PNG")
        image = image.crop((x, y, x + w, y + h))
        source_alpha_opaque = image.getchannel("A").getextrema() == (255, 255)
        alpha_clip = None
        if "clipPolygon" in entry:
            image, alpha_clip = clip_authored_polygon(image, entry["clipPolygon"], f"frame {index} clipPolygon")
        total_pixels += w * h
        if total_pixels > MAX_PIXELS:
            raise PipelineError(f"Decoded input exceeds {MAX_PIXELS} pixel budget")
        foot = integers(entry.get("foot", default_foot), 2, f"frame {index} foot")
        if not (0 <= foot[0] <= w and 0 <= foot[1] <= h):
            raise PipelineError(f"Frame {index} foot lies outside the crop")
        height = positive(entry.get("sourceHeight", default_height), f"frame {index} sourceHeight")
        duration = positive(entry.get("durationMs", default_duration), f"frame {index} durationMs")
        if type(duration) is not int:
            raise PipelineError("durationMs must be integer milliseconds")
        phase = entry.get("phase", default_phase)
        if not isinstance(phase, str) or not phase.strip():
            raise PipelineError(f"Frame {index} needs a nonempty phase")
        event = entry.get("event")
        if event is not None and (not isinstance(event, str) or not event.strip()):
            raise PipelineError(f"Frame {index} event must be a nonempty string")
        anchors = entry.get("anchors", {})
        if not isinstance(anchors, dict) or any(key not in {"hand", "grip", "tip"} for key in anchors):
            raise PipelineError(f"Frame {index} anchors support hand, grip and tip")
        for key, point in anchors.items():
            if not isinstance(point, (list, tuple)) or len(point) != 2 or any(type(value) not in (int, float) or not math.isfinite(value) for value in point):
                raise PipelineError(f"Frame {index} anchor {key} needs two finite pixel coordinates")
            if not (0 <= point[0] <= w and 0 <= point[1] <= h):
                raise PipelineError(f"Frame {index} anchor {key} is outside the crop")
        if path not in sources:
            sources[path] = {"file": f"inputs/{len(sources):03d}-{path.name}", "sha256": sha256(path)}
        frames.append({"image": image, "source": path, "crop": crop, "inputFoot": foot,
                       "sourceHeight": height, "durationMs": duration, "phase": phase,
                       "event": event, "hadAlpha": had_alpha, "sourceAlphaOpaque": source_alpha_opaque,
                       "anchors": anchors, "alphaClip": alpha_clip})
    if len({frame["sourceHeight"] for frame in frames}) != 1:
        raise PipelineError("All sourceHeight values must match; use one standing reference for the clip")
    return frames, sources


def normalize(frames, canvas=None, target_foot=None, margin=2, scale=1):
    positive(scale, "scale")
    left = math.ceil(max(frame["inputFoot"][0] * scale for frame in frames))
    top = math.ceil(max(frame["inputFoot"][1] * scale for frame in frames))
    right = math.ceil(max((frame["image"].width - frame["inputFoot"][0]) * scale for frame in frames))
    bottom = math.ceil(max((frame["image"].height - frame["inputFoot"][1]) * scale for frame in frames))
    foot = integers(target_foot, 2, "target foot") if target_foot else [left + margin, top + margin]
    size = integers(canvas, 2, "canvas") if canvas else [foot[0] + right + margin, foot[1] + bottom + margin]
    if min(size) <= 0 or not (0 <= foot[0] <= size[0] and 0 <= foot[1] <= size[1]):
        raise PipelineError("Invalid canvas or target foot")
    if size[0] * size[1] * len(frames) > MAX_PIXELS:
        raise PipelineError("Normalized output exceeds pixel budget")
    for index, frame in enumerate(frames):
        image = frame["image"]
        offset = [foot[i] - frame["inputFoot"][i] * scale for i in range(2)]
        if min(offset) < -1e-9 or offset[0] + image.width * scale > size[0] + 1e-9 or offset[1] + image.height * scale > size[1] + 1e-9:
            raise PipelineError(f"Canvas would clip frame {index}; enlarge it or change target foot")
        if scale == 1:
            offset = [int(value) for value in offset]
            normalized = Image.new("RGBA", size, (0, 0, 0, 0))
            normalized.paste(image, tuple(offset))  # no mask: retain source RGBA bytes exactly
            if normalized.crop((offset[0], offset[1], offset[0] + image.width, offset[1] + image.height)).tobytes() != image.tobytes():
                raise PipelineError(f"Frame {index} pixel preservation failed")
        else:
            normalized = image.transform(tuple(size), Image.Transform.AFFINE,
                                         (1 / scale, 0, -offset[0] / scale, 0, 1 / scale, -offset[1] / scale),
                                         resample=Image.Resampling.NEAREST, fillcolor=(0, 0, 0, 0))
        frame.update({"normalized": normalized, "offset": offset})
    return size, foot


def preview_images(images, durations, foot, output, columns, max_side, source_height=None, target_height=None):
    width, height = images[0].size
    scale = target_height / source_height if target_height else min(1, max_side / max(width, height))
    suffix = f"-{target_height}" if target_height else ""
    size = [max(1, round(width * scale)), max(1, round(height * scale))]
    previews = []
    for image in images:
        bg = Image.new("RGBA", image.size, (38, 41, 46, 255))
        bg.alpha_composite(image)
        previews.append(bg.convert("RGB").resize(size, Image.Resampling.NEAREST))
    gap, caption = 8, 24
    cols = min(columns, len(images))
    sheet = Image.new("RGB", (cols * (size[0] + gap) + gap,
                              math.ceil(len(images) / cols) * (size[1] + caption + gap) + gap), (22, 24, 28))
    draw = ImageDraw.Draw(sheet)
    for index, image in enumerate(previews):
        x, y = gap + index % cols * (size[0] + gap), gap + index // cols * (size[1] + caption + gap)
        sheet.paste(image, (x, y))
        fx, fy = x + round(foot[0] * scale), y + round(foot[1] * scale)
        draw.line((fx - 4, fy, fx + 4, fy), fill=(100, 220, 185))
        draw.line((fx, fy - 4, fx, fy + 4), fill=(100, 220, 185))
        draw.text((x, y + size[1] + 3), f"{index:03d} | {durations[index]} ms", fill=(230, 232, 235))
    sheet.save(output / f"contact-sheet{suffix}.png")
    # Opaque, palette-limited review GIF; runtime PNGs retain the original alpha.
    gif_frames = [image.quantize(colors=256) for image in previews]
    cumulative, previous, gif_durations = 0, 0, []
    for duration in durations:
        cumulative += duration
        endpoint = round(cumulative / 10) * 10
        gif_durations.append(max(10, endpoint - previous))
        previous = endpoint
    gif_frames[0].save(output / f"preview{suffix}.gif", save_all=True, append_images=gif_frames[1:],
                       duration=gif_durations, loop=0, optimize=False, disposal=2)
    with Image.open(output / f"preview{suffix}.gif") as gif:
        gif_duration = 0
        for index in range(gif.n_frames):
            gif.seek(index)
            gif_duration += gif.info.get("duration", 0)
    return {"size": size, "targetBodyHeight": target_height, "sampling": "nearest", "gifDurationMs": gif_duration,
            "gifTimingQuantizationMs": 10, "background": "#26292e"}


def package(frames, sources, output, settings, video=None, spec_path=None):
    scale = settings.get("scale", 1)
    size, foot = normalize(frames, settings.get("canvas"), settings.get("targetFoot"), settings.get("margin", 2), scale)
    source_height = frames[0]["sourceHeight"] * scale
    (output / "inputs").mkdir()
    (output / "frames").mkdir()
    for path, info in sources.items():
        shutil.copyfile(path, output / info["file"])
        if sha256(output / info["file"]) != info["sha256"]:
            raise PipelineError("Source changed while being preserved")
    if spec_path:
        shutil.copyfile(spec_path, output / "inputs" / "source-spec.json")
    cols = min(settings.get("columns", 4), len(frames))
    atlas = Image.new("RGBA", (size[0] * cols, size[1] * math.ceil(len(frames) / cols)), (0, 0, 0, 0))
    records, metrics, warnings, hashes = [], [], [], {}
    for index, frame in enumerate(frames):
        image = frame["normalized"]
        name = f"frames/{index:04d}.png"
        image.save(output / name)
        x, y = index % cols * size[0], index // cols * size[1]
        atlas.paste(image, (x, y))
        record = {"index": index, "file": name, "x": x, "y": y, "w": size[0], "h": size[1],
                  "sourceHeight": source_height, "foot": foot[:], "durationMs": frame["durationMs"], "phase": frame["phase"]}
        if frame["event"] is not None:
            record["event"] = frame["event"]
        if frame["anchors"]:
            record["anchors"] = {key: [point[axis] * scale + frame["offset"][axis] for axis in range(2)]
                                 for key, point in frame["anchors"].items()}
        if frame["alphaClip"]:
            record["source"] = {"file": sources[frame["source"]]["file"], "crop": frame["crop"],
                                "clipPolygon": frame["alphaClip"]["clipPolygon"]}
        records.append(record)
        info = image_metrics(image)
        raw = image_metrics(frame["image"])
        bounds = info["bounds"]
        if bounds is None:
            raise PipelineError(f"Frame {index} is empty")
        if not frame["hadAlpha"] or frame["sourceAlphaOpaque"]:
            warnings.append({"code": "opaque-source", "frame": index})
        if raw["bounds"] and (raw["bounds"][0] == 0 or raw["bounds"][1] == 0 or raw["bounds"][2] == frame["image"].width or raw["bounds"][3] == frame["image"].height):
            warnings.append({"code": "source-content-touches-edge", "frame": index})
        hashes.setdefault(info["pixelSha256"], []).append(index)
        metrics.append({"index": index, **info, "inputBounds": raw["bounds"], "inputFoot": frame["inputFoot"],
                        "translation": frame["offset"], "foot": foot[:], "bottomFromFoot": bounds[3] - foot[1],
                        "source": sources[frame["source"]]["file"], "sourceCrop": frame["crop"],
                        "rgbaPreserved": scale == 1 and frame["alphaClip"] is None, "uniformScale": scale,
                        "alphaClip": frame["alphaClip"]})
    duplicate_groups = [indices for indices in hashes.values() if len(indices) > 1]
    if duplicate_groups:
        warnings.append({"code": "duplicate-frames", "groups": duplicate_groups})
    if duplicate_groups and settings.get("rejectDuplicates"):
        raise PipelineError(f"Exact duplicate frames rejected: {duplicate_groups}")
    total = sum(frame["durationMs"] for frame in frames)
    expected = settings.get("expectedDurationMs")
    if expected is not None and total != expected:
        raise PipelineError(f"Duration {total} ms does not match expected {expected} ms")
    atlas.save(output / "atlas.png")
    preview = preview_images([frame["normalized"] for frame in frames], [frame["durationMs"] for frame in frames], foot,
                             output, settings.get("columns", 4), settings.get("previewMaxSide", 320))
    height_previews = [preview_images([frame["normalized"] for frame in frames], [frame["durationMs"] for frame in frames], foot,
                                     output, settings.get("columns", 4), settings.get("previewMaxSide", 320), source_height, height)
                       for height in settings.get("previewHeights", [111, 150, 222])]
    if preview["gifDurationMs"] != total:
        warnings.append({"code": "gif-duration-quantized", "runtimeDurationMs": total, "gifDurationMs": preview["gifDurationMs"]})
    source_info = [{"file": info["file"], "sha256": info["sha256"]} for info in sources.values()]
    manifest = {"schema": SCHEMA, "atlas": "atlas.png", "frameSize": size, "sourceHeight": source_height,
                "foot": foot, "durationMs": total, "loop": bool(settings.get("loop", False)), "frames": records,
                "metadata": settings.get("metadata", {}), "sources": source_info,
                "provenance": {"pipeline": "combat-frame-pipeline/1", "python": sys.version.split()[0], "pillow": pillow_version,
                               "scriptSha256": sha256(Path(__file__)),
                               "workflowReference": {"repository": "https://github.com/0x0funky/agent-sprite-forge", "revision": FORGE_REVISION},
                               "sourceHeightBeforeScale": frames[0]["sourceHeight"], "uniformScale": scale,
                               "pixelOperations": ["explicit-crop", "fixed-foot-translation", "whole-frame-pack"]}}
    if scale != 1:
        manifest["provenance"]["pixelOperations"].insert(1, "uniform-nearest-scale")
    if any(frame["alphaClip"] for frame in frames):
        manifest["provenance"]["pixelOperations"].insert(1, "authored-polygon-alpha-clip")
    for key in ("id", "visualIdentity", "action", "direction", "phase"):
        if settings.get(key) is not None:
            manifest[key] = settings[key]
    if video:
        manifest["provenance"]["video"] = video
    write_json(output / "manifest.json", manifest)
    qc = {"schema": "combat-frame-qc/v1", "algorithmStatus": "passed", "artReview": "not-reviewed",
          "frameCount": len(frames), "distinctFrames": len(hashes), "duplicateGroups": duplicate_groups,
          "durationMs": total, "expectedDurationMs": expected, "frameSize": size, "foot": foot,
          "footRange": {"x": [foot[0], foot[0]], "y": [foot[1], foot[1]]},
          "sourceHeight": source_height, "uniformScale": scale, "preview": preview, "heightPreviews": height_previews,
          "warnings": warnings, "frames": metrics,
          "notProven": ["anatomy", "identity", "gait", "anatomical foot placement", "motion continuity", "contact geometry", "art approval", "runtime integration"]}
    write_json(output / "qc.json", qc)
    files = sorted(path for path in output.rglob("*") if path.is_file())
    write_json(output / "checksums.json", {str(path.relative_to(output)): sha256(path) for path in files})
    validate_bundle(output)
    return {"output": str(output), "frameCount": len(frames), "distinctFrames": len(hashes), "durationMs": total,
            "algorithmStatus": "passed", "artReview": "not-reviewed", "warnings": warnings}


def safe_member(root, name):
    path = (root / name).resolve()
    if not path.is_relative_to(root):
        raise PipelineError("Bundle path escapes its directory")
    return path


def validate_bundle(directory):
    root = Path(directory).resolve()
    if (root / "failure.json").exists():
        raise PipelineError("Bundle has a failure.json marker; generate a new output version")
    manifest = read_json(root / "manifest.json")
    if manifest.get("schema") != SCHEMA or not manifest.get("frames"):
        raise PipelineError("Unsupported or empty manifest")
    size = integers(manifest["frameSize"], 2, "frameSize")
    foot = integers(manifest["foot"], 2, "foot")
    if min(size) <= 0 or not (0 <= foot[0] <= size[0] and 0 <= foot[1] <= size[1]):
        raise PipelineError("Invalid manifest frameSize or foot")
    positive(manifest["sourceHeight"], "sourceHeight")
    checksums = read_json(root / "checksums.json")
    required = {"manifest.json", "qc.json", manifest["atlas"]}
    required.update(frame["file"] for frame in manifest["frames"])
    required.update(source["file"] for source in manifest["sources"])
    if not required.issubset(checksums):
        raise PipelineError("Checksums do not cover all runtime frames and preserved sources")
    for name, digest in checksums.items():
        if sha256(safe_member(root, name)) != digest:
            raise PipelineError(f"Checksum mismatch: {name}")
    atlas = Image.open(safe_member(root, manifest["atlas"])).convert("RGBA")
    for index, frame in enumerate(manifest["frames"]):
        if frame["index"] != index or [frame["w"], frame["h"]] != manifest["frameSize"] or frame["foot"] != manifest["foot"] or frame["sourceHeight"] != manifest["sourceHeight"]:
            raise PipelineError(f"Frame {index} metadata is inconsistent")
        rect = integers([frame["x"], frame["y"], frame["w"], frame["h"]], 4, "frame rectangle")
        if min(rect) < 0 or rect[0] + rect[2] > atlas.width or rect[1] + rect[3] > atlas.height:
            raise PipelineError(f"Frame {index} exceeds atlas bounds")
        image = Image.open(safe_member(root, frame["file"])).convert("RGBA")
        region = atlas.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))
        if image.size != tuple(manifest["frameSize"]) or region.tobytes() != image.tobytes():
            raise PipelineError(f"Frame {index} differs from atlas")
    if sum(positive(frame["durationMs"], "durationMs") for frame in manifest["frames"]) != manifest["durationMs"]:
        raise PipelineError("Manifest duration sum is inconsistent")
    return {"output": str(root), "algorithmStatus": "passed", "artReview": "not-reviewed", "frameCount": len(manifest["frames"])}


def run(args):
    settings = {"canvas": args.canvas, "targetFoot": args.target_foot, "margin": args.margin, "columns": args.columns,
                "previewMaxSide": args.preview_max_side, "expectedDurationMs": args.expected_duration_ms,
                "rejectDuplicates": args.reject_duplicates, "loop": args.loop, "metadata": {},
                "id": args.id, "visualIdentity": args.visual_identity, "action": args.action, "direction": args.direction, "phase": args.phase,
                "scale": args.scale, "previewHeights": args.preview_heights}
    spec_path, video = None, None
    with tempfile.TemporaryDirectory(prefix="combat-frame-input-") as temporary:
        temp = Path(temporary)
        if args.spec:
            spec_path = Path(args.spec).expanduser().resolve()
            spec = read_json(spec_path)
            entries, base = spec.get("frames"), spec_path.parent
            defaults = spec
            for key in settings:
                if key in spec:
                    settings[key] = spec[key]
        elif args.video:
            path = Path(args.video).expanduser().resolve()
            if not path.is_file():
                raise PipelineError("Video input does not exist")
            rate = Fraction(args.fps)
            if not 0 < rate <= 120:
                raise PipelineError("--fps must be between 0 and 120")
            binary = ffmpeg_binary(args.ffmpeg)
            version = subprocess.check_output([binary, "-version"], text=True).splitlines()[0]
            command = [binary, "-nostdin", "-hide_banner", "-loglevel", "error", "-ss", str(args.start)]
            if args.video_decoder:
                command += ["-c:v", args.video_decoder]
            command += ["-i", str(path)]
            if args.seconds is not None:
                command += ["-t", str(args.seconds)]
            command += ["-vf", f"fps={rate}", "-frames:v", str(args.max_frames + 1), "-pix_fmt", "rgba", str(temp / "%06d.png")]
            process = subprocess.run(command, capture_output=True, text=True)
            if process.returncode:
                raise PipelineError(f"ffmpeg decode failed: {process.stderr[-2000:]}")
            files = sorted(temp.glob("*.png"))
            entries = [{"file": str(file), "durationMs": round((i + 1) * 1000 / rate) - round(i * 1000 / rate)} for i, file in enumerate(files)]
            base, defaults = temp, {}
            video = {"ffmpeg": version, "fps": str(rate), "startSeconds": args.start, "limitSeconds": args.seconds,
                     "decoder": args.video_decoder or "ffmpeg default", "sampling": "ffmpeg fps filter",
                     "sourceDurationProbed": False, "sourceSha256": sha256(path)}
        elif args.sheet:
            if not args.tile:
                raise PipelineError("--sheet requires --tile WIDTH HEIGHT")
            path = Path(args.sheet).expanduser().resolve()
            with Image.open(path) as sheet:
                w, h = args.tile
                if w <= 0 or h <= 0 or sheet.width % w or sheet.height % h:
                    raise PipelineError("Sheet dimensions must be exact multiples of --tile")
                entries = [{"file": str(path), "crop": [x, y, w, h]} for y in range(0, sheet.height, h) for x in range(0, sheet.width, w)]
            base, defaults = Path.cwd(), {}
        else:
            entries = [{"file": str(Path(path).expanduser().resolve())} for path in args.inputs]
            base, defaults = Path.cwd(), {}
        for key in ("columns", "previewMaxSide"):
            if type(settings[key]) is not int or settings[key] <= 0:
                raise PipelineError(f"{key} must be a positive integer")
        for key in ("id", "visualIdentity", "action", "direction"):
            if settings[key] is not None and (not isinstance(settings[key], str) or not settings[key].strip()):
                raise PipelineError(f"{key} must be a nonempty string")
        if settings["expectedDurationMs"] is not None:
            positive(settings["expectedDurationMs"], "expectedDurationMs")
        if not isinstance(settings["metadata"], dict):
            raise PipelineError("metadata must be an object")
        positive(settings["scale"], "scale")
        if not isinstance(settings["previewHeights"], list) or any(type(height) is not int or not 1 <= height <= 1024 for height in settings["previewHeights"]):
            raise PipelineError("previewHeights must be integer body heights between 1 and 1024")
        if type(settings["margin"]) is not int or settings["margin"] < 0:
            raise PipelineError("margin must be a nonnegative integer")
        frames, sources = load_authored_frames(entries, base, defaults.get("foot", args.foot), defaults.get("sourceHeight", args.source_height),
                                              defaults.get("durationMs", args.duration_ms), defaults.get("phase", args.phase), args.max_frames)
        if args.video:
            path = Path(args.video).expanduser().resolve()
            sources[path] = {"file": f"inputs/{len(sources):03d}-{path.name}", "sha256": sha256(path)}
        normalize(frames, settings["canvas"], settings["targetFoot"], settings["margin"], settings["scale"])
        output = reserve_output(args.output_root, args.name)
        try:
            return package(frames, sources, output, settings, video, spec_path)
        except Exception as exc:
            write_json(output / "failure.json", {"algorithmStatus": "failed", "error": str(exc)})
            raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    pack = sub.add_parser("pack", help="Import PNG frames, an atlas, a JSON spec, or existing video")
    source = pack.add_mutually_exclusive_group(required=True)
    source.add_argument("--inputs", nargs="+")
    source.add_argument("--sheet")
    source.add_argument("--spec")
    source.add_argument("--video")
    pack.add_argument("--tile", type=int, nargs=2)
    pack.add_argument("--output-root", required=True)
    pack.add_argument("--name", required=True)
    pack.add_argument("--foot", type=int, nargs=2, help="Input crop-local foot coordinate")
    pack.add_argument("--source-height", type=float, help="Standing body reference height in source pixels")
    pack.add_argument("--scale", type=float, default=1, help="One explicit uniform scale for the entire clip")
    pack.add_argument("--duration-ms", type=int, default=100)
    pack.add_argument("--phase", default="idle")
    pack.add_argument("--id")
    pack.add_argument("--visual-identity")
    pack.add_argument("--action")
    pack.add_argument("--direction")
    pack.add_argument("--canvas", type=int, nargs=2)
    pack.add_argument("--target-foot", type=int, nargs=2)
    pack.add_argument("--margin", type=int, default=2)
    pack.add_argument("--columns", type=int, default=4)
    pack.add_argument("--preview-max-side", type=int, default=320)
    pack.add_argument("--preview-heights", type=int, nargs="*", default=[111, 150, 222])
    pack.add_argument("--expected-duration-ms", type=int)
    pack.add_argument("--reject-duplicates", action="store_true")
    pack.add_argument("--loop", action="store_true")
    pack.add_argument("--max-frames", type=int, default=256)
    pack.add_argument("--ffmpeg")
    pack.add_argument("--video-decoder", help="Explicit ffmpeg input decoder, e.g. libvpx-vp9 for alpha WebM")
    pack.add_argument("--fps", default="10")
    pack.add_argument("--start", type=float, default=0)
    pack.add_argument("--seconds", type=float)
    check = sub.add_parser("validate", help="Read back checksums and decoded atlas/frame equality")
    check.add_argument("directory")
    args = parser.parse_args(argv)
    try:
        if args.command == "pack" and (args.start < 0 or not math.isfinite(args.start) or (args.seconds is not None and (not math.isfinite(args.seconds) or args.seconds <= 0))):
            raise PipelineError("Video start must be nonnegative and seconds positive")
        result = validate_bundle(args.directory) if args.command == "validate" else run(args)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (PipelineError, OSError, ValueError, TypeError, KeyError, ArithmeticError) as exc:
        print(json.dumps({"algorithmStatus": "failed", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
