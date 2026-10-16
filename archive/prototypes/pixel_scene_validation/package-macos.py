#!/usr/bin/env python3
"""Package Yunxiu Trail with its local Electron runtime and 2D assets."""
import argparse
import plistlib
import shutil
import subprocess
from pathlib import Path


parser = argparse.ArgumentParser()
parser.add_argument("destination", nargs="?", type=Path,
                    default=Path("/Volumes/Media/immortal-qa/pixel-trail-20261014/云岫山院·近山试行.app"),
                    help="New macOS .app destination")
args = parser.parse_args()
root = Path(__file__).resolve().parent
runtime = root / "node_modules/electron/dist/Electron.app"
if not runtime.is_dir():
    runtime = root.parent / "three_style_showcase/node_modules/electron/dist/Electron.app"
bundle = args.destination.resolve()

if bundle.suffix != ".app":
    raise SystemExit("Destination must end in .app")
if bundle.exists():
    raise SystemExit(f"Destination already exists: {bundle}")
if not runtime.is_dir():
    raise SystemExit(f"Electron runtime not found: {runtime}")
for name in ("desktop.cjs", "preload.cjs", "arena-storage.cjs", "package.json", "arena.html",
             "arena-main.mjs", "arena-renderer.mjs", "arena-sim.mjs", "index.html", "main.mjs", "assets"):
    if not (root / name).exists():
        raise SystemExit(f"App file missing: {root / name}")
shared_runtime = root.parent.parent / "src/simulation/ea-runtime.mjs"
if not shared_runtime.is_file():
    raise SystemExit(f"Shared runtime missing: {shared_runtime}")

shutil.copytree(runtime, bundle, symlinks=True)
app_files = bundle / "Contents/Resources/app"
app_files.mkdir()
for source in root.iterdir():
    if source.is_file() and source.suffix in {".cjs", ".mjs", ".js", ".json", ".html", ".css"}:
        shutil.copy2(source, app_files / source.name)
shutil.copytree(root / "assets", app_files / "assets")
(app_files / "shared").mkdir()
shutil.copy2(shared_runtime, app_files / "shared/ea-runtime.mjs")

plist_path = bundle / "Contents/Info.plist"
with plist_path.open("rb") as handle:
    plist = plistlib.load(handle)
plist.update(
    CFBundleName="云岫山院·近山试行",
    CFBundleDisplayName="云岫山院·近山试行",
    CFBundleIdentifier="games.xianfu.pixel-arena",
)
with plist_path.open("wb") as handle:
    plistlib.dump(plist, handle)
subprocess.run(["codesign", "--force", "--deep", "--sign", "-", str(bundle)], check=True)
print(bundle)
