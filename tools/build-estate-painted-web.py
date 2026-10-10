#!/usr/bin/env python3
"""Export the layered 2D old estate preview with the shared simulation."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def run_godot(command):
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, check=False)
    print(result.stdout, end='')
    if result.returncode or 'SCRIPT ERROR:' in result.stdout or '\nERROR:' in result.stdout:
        raise SystemExit('Godot reported an error; see the diagnostic above.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--godot', default='/Applications/Godot.app/Contents/MacOS/Godot')
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/painted-game/index.html')
    args = parser.parse_args()
    version = subprocess.check_output([args.godot, '--version'], text=True).strip()
    if not version.startswith('4.6.3.stable.'):
        raise SystemExit(f'Expected Godot 4.6.3; found {version}')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='immortal-painted-estate-export-') as folder:
        stage = Path(folder)
        shutil.copytree(ROOT / 'godot/estate_2d', stage / 'estate_2d',
                        ignore=shutil.ignore_patterns('*.import', '.DS_Store',
                                                      'estate-ground-v1.png', 'hall-damaged-v1.png', 'PROMPTS.md'))
        # HUD bitmaps are copied beside the exported page below; Godot does not use them in the scene pack.
        shutil.copytree(ROOT / 'godot/estate_3d/web', stage / 'estate_2d/web',
                        ignore=shutil.ignore_patterns('*.png'))
        character = stage / 'painted_courtyard'
        (character / 'assets').mkdir(parents=True)
        shutil.copy2(ROOT / 'godot/painted_courtyard/actor_2d.gd', character / 'actor_2d.gd')
        for name in ['characters-v2.png', 'characters.json']:
            shutil.copy2(ROOT / 'godot/painted_courtyard/assets' / name, character / 'assets' / name)
        (stage / 'project.godot').write_text('''config_version=5
[application]
config/name="余烬立山 · 绘画旧别院"
run/main_scene="res://estate_2d/estate.tscn"
config/features=PackedStringArray("4.6", "GL Compatibility")
run/max_fps=60
[display]
window/size/viewport_width=1440
window/size/viewport_height=900
window/stretch/mode="disabled"
[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
environment/defaults/default_clear_color=Color(0.608,0.663,0.565,1)
[input_devices]
pointing/emulate_mouse_from_touch=true
''', encoding='utf-8')
        (stage / 'export_presets.cfg').write_text('''[preset.0]
name="EstateWeb"
platform="Web"
runnable=true
export_filter="all_resources"
include_filter="*.json"
exclude_filter="*.py"
script_export_mode=2
[preset.0.options]
variant/extensions_support=false
variant/thread_support=false
vram_texture_compression/for_desktop=false
vram_texture_compression/for_mobile=false
html/export_icon=false
html/custom_html_shell="res://estate_2d/web/game-shell.html"
html/canvas_resize_policy=2
html/focus_canvas_on_start=true
progressive_web_app/enabled=false
''', encoding='utf-8')
        run_godot([args.godot, '--headless', '--path', str(stage), '--editor', '--import'])
        run_godot([args.godot, '--headless', '--path', str(stage), '--quit-after', '2'])
        exported = stage / 'exported'
        exported.mkdir()
        run_godot([args.godot, '--headless', '--path', str(stage), '--export-release',
                   'EstateWeb', str(exported / args.output.name)])
        pack = exported / (args.output.stem + '.pck')
        pack_name = 'scene-' + hashlib.sha256(pack.read_bytes()).hexdigest()[:12] + '.pck'
        pack.rename(exported / pack_name)
        html_path = exported / args.output.name
        html = html_path.read_text(encoding='utf-8')
        match = re.search(r'const configuration=(\{[^\n]+\});', html)
        if not match:
            raise SystemExit('Exported HTML is missing its engine configuration.')
        configuration = json.loads(match.group(1))
        configuration['mainPack'] = pack_name
        sizes = configuration.get('fileSizes', {})
        sizes[pack_name] = sizes.pop(args.output.stem + '.pck', (exported / pack_name).stat().st_size)
        html = html[:match.start(1)] + json.dumps(configuration, ensure_ascii=False) + html[match.end(1):]
        html_path.write_text(html, encoding='utf-8')
        for artifact in exported.iterdir():
            shutil.copy2(artifact, args.output.parent / artifact.name)
        for obsolete_pack in args.output.parent.glob('scene-*.pck'):
            if obsolete_pack.name != pack_name:
                obsolete_pack.unlink()
        web = ROOT / 'godot/estate_3d/web'
        for name in ['game-ui.css', 'game-ui.mjs', 'base-ui.mjs', 'plaque-frame.svg',
                     'scroll-panel.svg', 'crest.svg', 'title-painted.png', 'topbar-painted.png',
                     'rail-painted.png', 'scroll-painted.png', 'manual-painted.png',
                     'resource-jade.png', 'resource-wood.png', 'resource-stone.png',
                     'resource-herb.png', 'resource-food.png']:
            shutil.copy2(web / name, args.output.parent / name)
        shutil.copy2(ROOT / 'godot/estate_2d/estate-sites.json', args.output.parent / 'estate-sites.json')
        shutil.copy2(ROOT / 'dist/assets/fonts/xianfu-brush.woff2', args.output.parent / 'xianfu-brush.woff2')
        shutil.copy2(ROOT / 'dist/assets/ea-portraits.jpg', args.output.parent / 'ea-portraits.jpg')
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
        files = {file.relative_to(args.output.parent).as_posix(): hashlib.sha256(file.read_bytes()).hexdigest()
                 for file in args.output.parent.rglob('*') if file.is_file() and file.name != 'build.json'}
        (args.output.parent / 'build.json').write_text(json.dumps({
            'build': 'yunxiu-old-estate-painted-v1', 'godot': version, 'mainPack': pack_name,
            'files': files}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'Packaged {len(copied)} shared-rule modules for the estate preview', flush=True)
    print(f'Painted old estate preview: {args.output.resolve()}')


if __name__ == '__main__':
    main()
