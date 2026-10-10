#!/usr/bin/env python3
"""Prepare existing authored assets and export the pinned Godot Web project."""
import argparse
import json
import os
import re
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'godot'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--godot', default=os.environ.get('GODOT_BIN', shutil.which('godot') or '/Applications/Godot.app/Contents/MacOS/Godot'))
parser.add_argument('--node', default=shutil.which('node') or 'node')
parser.add_argument('--prepare-only', action='store_true')
parser.add_argument('--output', type=Path, default=ROOT / 'dist/godot/index.html')
args = parser.parse_args()
version = subprocess.check_output([args.godot, '--version'], text=True).strip()
if not version.startswith('4.6.3.stable.'):
    raise SystemExit(f'Expected Godot 4.6.3 stable; found {version}')

query = """
import {ESTATE_ART_URLS} from './dist/ea-estate-assets.mjs';
import {createGodotBridge} from './dist/ea-godot-bridge.mjs';
console.log(JSON.stringify({assets:[...Object.values(ESTATE_ART_URLS),'./yunxiu-courtyard/assets/characters.webp','./assets/fonts/xianfu-brush.woff2','./assets/fonts/OFL-MaShanZheng.txt'],snapshot:createGodotBridge().snapshot()}));
"""
data = json.loads(subprocess.check_output([args.node, '--input-type=module', '-e', query], cwd=ROOT, text=True))
assets_root = PROJECT / 'assets'
for relative in data['assets']:
    source = ROOT / 'dist' / relative
    target = assets_root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or source.read_bytes() != target.read_bytes():
        shutil.copy2(source, target)
(assets_root / 'initial_snapshot.json').write_text(json.dumps(data['snapshot'], ensure_ascii=False), encoding='utf-8')
print(f'Prepared {len(data["assets"])} assets from the existing game; Godot {version}', flush=True)
if args.prepare_only:
    raise SystemExit(0)
args.output.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([args.godot, '--headless', '--path', str(PROJECT), '--editor', '--import'], check=True)
subprocess.run([args.godot, '--headless', '--path', str(PROJECT), '--export-release', 'Web', str(args.output.resolve())], check=True)
runtime = args.output.parent / 'runtime'
runtime.mkdir(exist_ok=True)
pending, copied = ['ea-godot-host.mjs'], set()
while pending:
    relative = pending.pop()
    if relative in copied:
        continue
    source = ROOT / 'dist' / relative
    content = source.read_text(encoding='utf-8')
    target = runtime / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')
    copied.add(relative)
    for dependency in re.findall(r'''["']\./([^"']+\.mjs)["']''', content):
        pending.append(str(Path(relative).parent / dependency))
print(f'Packaged {len(copied)} shared-rule modules inside the preview runtime', flush=True)
print(f'Web export: {args.output.resolve()}', flush=True)
