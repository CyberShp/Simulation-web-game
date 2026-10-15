#!/usr/bin/env python3
"""Package the courtyard scene with the shared official simulation modules."""

import argparse
import json
import plistlib
import shutil
import subprocess
from pathlib import Path


TITLE = "云岫山院·山院实景"
APP_SOURCE_FILES = (
    "courtyard-host.cjs", "courtyard-preload.cjs", "courtyard.html",
    "courtyard-main.mjs", "courtyard.css", "courtyard-renderer.mjs",
    "courtyard-space.mjs", "courtyard-layers.mjs", "courtyard-qa.mjs",
    "courtyard-panels.mjs", "courtyard-inspection.mjs",
    "courtyard-persistence.mjs", "courtyard-recovery.cjs",
    "sect-storage.cjs", "sect-sim.mjs", "sect-seed.mjs",
)
ASSET_FILES = (
    "courtyard-master-v2.png", "courtyard-clean-v2.png",
    "courtyard-fallow-v2.png", "courtyard-domain-v1.png",
    "cultivator-v1.png", "disciples-v1.png",
)
# These are the nested module/data dependencies of the official top-level modules.
NESTED_DIST_FILES = (
    "vendor/pako.mjs",
    "vendor/PAKO-LICENSE",
    "yunxiu-courtyard/navigation.mjs",
    "yunxiu-courtyard/assets/character-frames.json",
)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "destination", nargs="?", type=Path,
        default=Path("/Volumes/Media/immortal-qa/courtyard-master-20261015") / f"{TITLE}.app",
        help="New macOS .app destination",
    )
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    dist = root.parent.parent / "dist"
    runtimes = (
        root.parent / "three_style_showcase/node_modules/electron/dist/Electron.app",
        root / "node_modules/electron/dist/Electron.app",
    )
    runtime = next((candidate for candidate in runtimes if candidate.is_dir()), None)
    destination = args.destination.expanduser().absolute()

    if destination.suffix != ".app":
        raise SystemExit("Destination must end in .app")
    if destination.exists() or destination.is_symlink():
        raise SystemExit(f"Destination already exists: {destination}")
    if runtime is None:
        raise SystemExit("Electron runtime not found: " + ", ".join(map(str, runtimes)))
    for name in APP_SOURCE_FILES:
        if not (root / name).is_file():
            raise SystemExit(f"App file missing: {root / name}")
    for name in ASSET_FILES:
        if not (root / "assets" / name).is_file():
            raise SystemExit(f"App asset missing: {root / 'assets' / name}")
    if not dist.is_dir() or not (dist / "ea-runtime.mjs").is_file():
        raise SystemExit(f"Official simulation missing: {dist}")
    for name in NESTED_DIST_FILES:
        if not (dist / name).is_file():
            raise SystemExit(f"Official dependency missing: {dist / name}")

    app_sources = [root / name for name in APP_SOURCE_FILES]
    dist_sources = sorted(source for source in dist.iterdir()
                          if source.is_file() and source.suffix in {".mjs", ".json"})
    bundle = destination.resolve()
    shutil.copytree(runtime, bundle, symlinks=True)
    app = bundle / "Contents/Resources/app"
    sample = app / "prototypes/pixel_scene_validation"
    sample.mkdir(parents=True)
    for source in app_sources:
        shutil.copy2(source, sample / source.name)
    (sample / "assets").mkdir()
    for name in ASSET_FILES:
        shutil.copy2(root / "assets" / name, sample / "assets" / name)
    (app / "dist").mkdir()
    for source in dist_sources:
        shutil.copy2(source, app / "dist" / source.name)
    for name in NESTED_DIST_FILES:
        target = app / "dist" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(dist / name, target)

    package = {
        "name": "yunxiu-courtyard-master", "private": True, "version": "0.1.0",
        "description": TITLE, "type": "module",
        "main": "prototypes/pixel_scene_validation/courtyard-host.cjs",
    }
    (app / "package.json").write_text(
        json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    plist_path = bundle / "Contents/Info.plist"
    with plist_path.open("rb") as handle:
        plist = plistlib.load(handle)
    plist.update(CFBundleName=TITLE, CFBundleDisplayName=TITLE,
                 CFBundleIdentifier="games.xianfu.courtyard-master")
    with plist_path.open("wb") as handle:
        plistlib.dump(plist, handle)
    subprocess.run(["codesign", "--force", "--deep", "--sign", "-", str(bundle)], check=True)
    print(bundle)
    print(f"Sample sources: {len(app_sources)}; assets: {len(ASSET_FILES)}; "
          f"official top-level dependencies: {len(dist_sources)}; "
          f"official nested modules/data/licenses: {len(NESTED_DIST_FILES)}")


if __name__ == "__main__":
    main()
