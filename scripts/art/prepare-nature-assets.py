#!/usr/bin/env python3
"""Download CC0 Poly Haven sources to an external cache and export reduced GLBs.

Run with system Python. Blender executes this same file for the geometry step.
"""
import argparse
import concurrent.futures
import hashlib
import json
import subprocess
import struct
import sys
import urllib.request
from pathlib import Path

USER_AGENT = "immortal-showcase/0.1"
ASSETS = {
    "pine_sapling_medium": ("pine.glb", 2, 48000),
    "rock_face_01": ("rock-face.glb", 0, 6000),
    "boulder_01": ("boulder.glb", 0, 6000),
}


def request(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=120)


def download_file(destination, info):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size == info["size"]:
        return
    temporary = destination.with_suffix(destination.suffix + ".part")
    with request(info["url"]) as source, temporary.open("wb") as target:
        while chunk := source.read(1024 * 1024):
            target.write(chunk)
    if temporary.stat().st_size != info["size"]:
        raise RuntimeError(f"Incomplete download: {destination}")
    if hashlib.md5(temporary.read_bytes()).hexdigest() != info["md5"]:
        raise RuntimeError(f"Source checksum mismatch: {destination}")
    temporary.replace(destination)


def acquire(cache):
    jobs = []
    for asset in ASSETS:
        metadata_path = cache / f"{asset}-files.json"
        if metadata_path.exists():
            metadata = json.loads(metadata_path.read_text())
        else:
            with request(f"https://api.polyhaven.com/files/{asset}") as response:
                metadata = json.load(response)
            metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
        model = metadata["blend"]["1k"]["blend"] if asset.startswith("pine") else metadata["gltf"]["1k"]["gltf"]
        model_filename = "source.blend" if asset.startswith("pine") else f"{asset}.gltf"
        jobs.append((cache / asset / model_filename, model))
        jobs.extend((cache / asset / name, info) for name, info in model["include"].items())
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda pair: download_file(*pair), jobs))


def preserve_pine_diffuse(destination, source_diffuse):
    """Embed the source RGBA PNG byte-for-byte and preserve its sRGB encoding.

    The source already includes opacity. Blender's separate alpha-channel merge
    can encode linear RGB values into its sRGB output image, darkening needles.
    """
    binary = destination.read_bytes()
    json_length = struct.unpack_from("<I", binary, 12)[0]
    gltf = json.loads(binary[20:20 + json_length])
    binary_start = 28 + json_length
    payload = binary[binary_start:]
    twig = next(material for material in gltf["materials"] if "twig" in material.get("name", ""))
    twig.update(alphaMode="MASK", alphaCutoff=0.45, doubleSided=True)
    texture_index = twig["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    image = gltf["images"][gltf["textures"][texture_index]["source"]]
    replace_view = image["bufferView"]
    image.update(name="pine_sapling_medium_twig_diff_1k", mimeType="image/png")
    repacked = bytearray()
    for index, view in enumerate(gltf["bufferViews"]):
        repacked.extend(b"\0" * (-len(repacked) % 4))
        start = view.get("byteOffset", 0)
        data = source_diffuse.read_bytes() if index == replace_view else payload[start:start + view["byteLength"]]
        view.update(byteOffset=len(repacked), byteLength=len(data))
        repacked.extend(data)
    gltf["buffers"][0]["byteLength"] = len(repacked)
    repacked.extend(b"\0" * (-len(repacked) % 4))
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode()
    json_bytes += b" " * (-len(json_bytes) % 4)
    destination.write_bytes(struct.pack("<III", 0x46546C67, 2, 28 + len(json_bytes) + len(repacked))
                            + struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
                            + struct.pack("<II", len(repacked), 0x004E4942) + repacked)


def reduce_models(cache, output):
    import bpy
    from mathutils import Vector

    output.mkdir(parents=True, exist_ok=True)
    records = []
    for asset, (filename, variant, target) in ASSETS.items():
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete(use_global=False)
        source = cache / asset / f"{asset}.gltf"
        # Use the authored Blender LOD2 with its textured twig surfaces.
        if asset.startswith("pine"):
            with bpy.data.libraries.load(str(cache / asset / "source.blend"), link=False) as (_library, selected):
                selected.objects = ["pine_sapling_medium_c_LOD2"]
            for obj in selected.objects:
                bpy.context.collection.objects.link(obj)
                obj.hide_set(False)
            for image in bpy.data.images:
                candidate = cache / asset / "textures" / Path(image.filepath).name
                if candidate.exists():
                    image.filepath = str(candidate)
                    image.reload()
            for material in bpy.data.materials:
                if material.name.startswith(asset) and "twig" in material.name:
                    nodes = material.node_tree.nodes
                    links = material.node_tree.links
                    bsdf = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
                    output_node = next(node for node in nodes if node.type == "OUTPUT_MATERIAL")
                    alpha = next(node for node in nodes if node.type == "TEX_IMAGE" and node.image and "alpha" in node.image.name)
                    links.new(bsdf.outputs["BSDF"], output_node.inputs["Surface"])
                    links.new(alpha.outputs["Color"], bsdf.inputs["Alpha"])
                    material.use_backface_culling = False
        else:
            bpy.ops.import_scene.gltf(filepath=str(source))
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        before = sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes)
        if asset.startswith("pine"):
            bpy.ops.object.select_all(action="DESELECT")
            for obj in meshes:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = meshes[0]
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.mesh.separate(type="MATERIAL")
            bpy.ops.object.mode_set(mode="OBJECT")
            meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        for obj in meshes:
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            if not asset.startswith("pine"):
                # glTF splits vertices at UV seams; weld spatial duplicates while
                # leaving UVs on face corners so collapse can simplify the scan.
                bpy.ops.object.mode_set(mode="EDIT")
                bpy.ops.mesh.select_all(action="SELECT")
                bpy.ops.mesh.remove_doubles(threshold=0.00001)
                bpy.ops.object.mode_set(mode="OBJECT")
            triangles = sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
            material_name = next((mat.name for mat in obj.data.materials if mat), "")
            limit = target if "twig" in material_name else (6000 if asset.startswith("pine") else target)
            if triangles > limit:
                modifier = obj.modifiers.new("Runtime triangle budget", "DECIMATE")
                modifier.ratio = limit / triangles
                modifier.use_collapse_triangulate = True
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            for polygon in obj.data.polygons:
                polygon.use_smooth = True
        bpy.context.view_layer.update()
        corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
        low = Vector(tuple(min(point[i] for point in corners) for i in range(3)))
        high = Vector(tuple(max(point[i] for point in corners) for i in range(3)))
        ground_z = low.z
        if asset.startswith("pine"):
            bark = next(obj for obj in meshes if any(mat and mat.name.endswith("_bark") for mat in obj.data.materials))
            ground_z = min((bark.matrix_world @ Vector(corner)).z for corner in bark.bound_box)
        offset = Vector((-(low.x + high.x) / 2, -(low.y + high.y) / 2, -ground_z))
        for obj in meshes:
            obj.location += offset
        bpy.context.view_layer.update()
        # Blender is Z-up; the standard glTF exporter maps the grounded model to Y-up.
        dimensions = high - low
        triangle_count = sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes)
        destination = output / filename
        bpy.ops.object.select_all(action="DESELECT")
        for obj in meshes:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(destination), export_format="GLB", use_selection=True, export_yup=True, export_animations=False, export_cameras=False, export_lights=False)
        if asset.startswith("pine"):
            preserve_pine_diffuse(destination, cache / asset / "textures" / f"{asset}_twig_diff_1k.png")
        record = {
            "file": filename, "asset": asset, "source": f"https://polyhaven.com/a/{asset}",
            "api": f"https://api.polyhaven.com/files/{asset}",
            "license": "CC0-1.0", "licenseUrl": "https://polyhaven.com/license",
            "cc0Url": "https://creativecommons.org/publicdomain/zero/1.0/",
            "sourceVariant": variant, "sourceTriangles": before, "triangles": triangle_count,
            "sourceLOD": "authored LOD2" if asset.startswith("pine") else "source glTF",
            "dimensionsMetersXYZ": [round(dimensions.x, 5), round(dimensions.z, 5), round(dimensions.y, 5)],
            "upAxis": "Y", "groundY": 0,
            "pivot": "XZ centered; trunk base grounded" if asset.startswith("pine") else "XZ centered; lowest point grounded",
            "verticalBoundsMeters": [round(low.z - ground_z, 5), round(high.z - ground_z, 5)],
            "meshCount": len(meshes), "materials": sorted({mat.name for obj in meshes for mat in obj.data.materials if mat}),
            "textureResolutionSet": "Poly Haven 1k; source UVs and PBR textures embedded",
            "bytes": destination.stat().st_size,
            "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
            "processing": "Select authored variant; per-material decimation; preserve UVs and PBR; rebase ground and center",
        }
        if asset.startswith("pine"):
            record["foliageTexture"] = "Official diffuse RGBA PNG embedded byte-for-byte; sRGB; MASK 0.45; double sided"
        records.append(record)
        print("ASSET_COMPLETE", json.dumps(record), flush=True)
    (output / "manifest.json").write_text(json.dumps({"generator": "scripts/art/prepare-nature-assets.py", "assets": records}, indent=2) + "\n")
    (output / "SOURCE.md").write_text("# Nature model sources\n\nThese models and embedded PBR textures originate from Poly Haven and are provided under [CC0](https://polyhaven.com/license).\n\n" + "\n".join(f"- [{record['asset']}]({record['source']}) → `{record['file']}`; {record['triangles']:,} triangles; grounded Y-up; dimensions {record['dimensionsMetersXYZ']} metres." for record in records) + "\n\nThe preparation script retains an external source cache, verifies downloaded file checksums, selects one authored pine variant, reduces triangles per material, preserves source UVs and textures, and exports embedded GLB files. Pine foliage uses the official diffuse RGBA PNG byte-for-byte, with sRGB color and a 0.45 opacity cutoff. Exact output hashes and dimensions are in `manifest.json`.\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("/Volumes/Media/immortal-qa/three-nature-source"))
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[2] / "archive/prototypes/three_style_showcase/assets/nature")
    parser.add_argument("--blender", default="/Applications/Blender.app/Contents/MacOS/Blender")
    parser.add_argument("--blender-stage", action="store_true")
    parser.add_argument("--skip-download", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None)
    args.cache.mkdir(parents=True, exist_ok=True)
    if args.blender_stage:
        reduce_models(args.cache, args.output)
    else:
        if not args.skip_download:
            acquire(args.cache)
        subprocess.run([args.blender, "--background", "--python", str(Path(__file__).resolve()), "--", "--blender-stage", "--cache", str(args.cache), "--output", str(args.output)], check=True)


if __name__ == "__main__":
    main()
