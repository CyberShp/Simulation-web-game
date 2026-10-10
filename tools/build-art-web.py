#!/usr/bin/env python3
"""Export the independent, inspectable Godot 3D art courtyard to Web."""
import argparse
from pathlib import Path
import subprocess
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--godot', default='/Applications/Godot.app/Contents/MacOS/Godot')
parser.add_argument('--output', type=Path, default=ROOT/'dist/art-courtyard/index.html')
args = parser.parse_args()
version = subprocess.check_output([args.godot, '--version'], text=True).strip()
if not version.startswith('4.6.3.stable.'):
    raise SystemExit(f'Expected Godot 4.6.3; found {version}')
assets = ROOT/'godot/art/assets'
for name in ['hall.glb', 'landscape.glb', 'disciple_master.glb', 'disciple_worker.glb']:
    if not (assets/name).is_file():
        raise SystemExit(f'Missing authored art asset: {name}')
args.output.parent.mkdir(parents=True, exist_ok=True)
# A clean staging project keeps the art Web pack limited to this scene and its assets.
# The existing game project and its exports remain intact.
with tempfile.TemporaryDirectory(prefix='immortal-art-export-') as folder:
    stage=Path(folder)
    shutil.copytree(ROOT/'godot/art', stage/'art', ignore=shutil.ignore_patterns('*.import'))
    (stage/'project.godot').write_text('''config_version=5
[application]
config/name="云岫山院 · 美术实机小院"
run/main_scene="res://art/art_courtyard.tscn"
config/features=PackedStringArray("4.6", "GL Compatibility")
run/max_fps=60
[display]
window/size/viewport_width=1440
window/size/viewport_height=900
window/stretch/mode="disabled"
[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
anti_aliasing/quality/msaa_3d=1
lights_and_shadows/directional_shadow/size=2048
textures/default_filters/use_nearest_mipmap_filter=false
[input_devices]
pointing/emulate_mouse_from_touch=true
''',encoding='utf-8')
    (stage/'export_presets.cfg').write_text('''[preset.0]
name="ArtWeb"
platform="Web"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter="*-metrics.json,*.blend,*.py"
script_export_mode=2
[preset.0.options]
variant/extensions_support=false
variant/thread_support=false
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=false
html/export_icon=false
html/custom_html_shell="res://art/web/shell.html"
html/canvas_resize_policy=2
html/focus_canvas_on_start=true
progressive_web_app/enabled=false
''',encoding='utf-8')
    subprocess.run([args.godot,'--headless','--path',str(stage),'--editor','--import'],check=True)
    subprocess.run([args.godot,'--headless','--path',str(stage),'--export-release','ArtWeb',str(args.output.resolve())],check=True)
print(f'Art courtyard: {args.output.resolve()}')
