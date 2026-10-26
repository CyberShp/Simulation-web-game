#!/usr/bin/env python3
"""Create a self-contained, locally signed macOS autoplay sample."""
import argparse
import json
import plistlib
import shutil
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("destination", type=Path)
parser.add_argument("--reference", action="store_true", help="Package the main-hall reference scene")
parser.add_argument("--assets", action="store_true", help="Package the model inspection gallery")
args = parser.parse_args()
root = Path(__file__).resolve().parent
bundle = args.destination.resolve()
if bundle.exists():
    raise SystemExit(f"Destination already exists: {bundle}")
shutil.copytree(root / "node_modules/electron/dist/Electron.app", bundle, symlinks=True)
app = bundle / "Contents/Resources/app"
app.mkdir()
for name in ["desktop.cjs", "preload.cjs", "index.html", "reference.html", "asset-review.html", "package.json"]:
    shutil.copy2(root / name, app / name)
for source in root.glob("*.mjs"):
    shutil.copy2(source, app / source.name)
if args.assets:
    shutil.copytree(root / "assets/asset-review", app / "assets/asset-review", ignore=shutil.ignore_patterns("*.blend", "*.blend1"))
else:
    shutil.copytree(root / "assets", app / "assets", ignore=shutil.ignore_patterns("*.blend", "*.blend1"))
shutil.copytree(root / "node_modules/three", app / "node_modules/three")
if args.assets:
    (app / "showcase-config.json").write_text(json.dumps({"scene": "assets"}) + "\n", encoding="utf-8")
elif args.reference:
    (app / "showcase-config.json").write_text(json.dumps({"scene": "reference"}) + "\n", encoding="utf-8")
plist_path = bundle / "Contents/Info.plist"
with plist_path.open("rb") as f:
    plist = plistlib.load(f)
if args.assets:
    plist.update(CFBundleName="云岫·资产图鉴", CFBundleDisplayName="云岫·资产图鉴", CFBundleIdentifier="games.xianfu.asset-review")
elif args.reference:
    plist.update(CFBundleName="云岫山院-主殿场景样板", CFBundleDisplayName="云岫山院-主殿场景样板", CFBundleIdentifier="games.xianfu.reference-showcase")
else:
    plist.update(CFBundleName="云岫山院", CFBundleDisplayName="云岫山院 · 双画风样板", CFBundleIdentifier="games.xianfu.style-showcase")
with plist_path.open("wb") as f:
    plistlib.dump(plist, f)
subprocess.run(["codesign", "--force", "--deep", "--sign", "-", str(bundle)], check=True)
print(bundle)
