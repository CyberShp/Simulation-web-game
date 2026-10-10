#!/usr/bin/env python3
"""Export the independent Godot 2D painted courtyard to Web."""
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
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/painted-courtyard/index.html')
    parser.add_argument('--game', action='store_true', help='Export the latest painted courtyard with the shared simulation and game HUD.')
    parser.add_argument('--check', action='store_true', help='Run the focused actor and courtyard checks before export.')
    args = parser.parse_args()
    if args.game and args.output == ROOT / 'dist/painted-courtyard/index.html':
        args.output = ROOT / 'dist/painted-game/index.html'
    version = subprocess.check_output([args.godot, '--version'], text=True).strip()
    if not version.startswith('4.6.3.stable.'):
        raise SystemExit(f'Expected Godot 4.6.3; found {version}')
    assets = ROOT / 'godot/painted_courtyard/assets'
    for name in ['founding-ground-v3.png', 'characters-v2.png', 'characters.json', 'layout.json',
                 'domain-overview-v1.png', 'domain-layout.json']:
        if not (assets / name).is_file():
            raise SystemExit(f'Missing painted courtyard asset: {name}')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='immortal-painted-export-') as folder:
        stage = Path(folder)
        shutil.copytree(ROOT / 'godot/painted_courtyard', stage / 'painted_courtyard',
                        ignore=shutil.ignore_patterns('*.import', '.DS_Store', '*.blend', '*.glb'))
        # Export only active trial assets; source history remains in the workspace.
        active_assets = {'founding-ground-v3.png', 'characters-v2.png', 'characters.json',
                         'layout.json', 'domain-overview-v1.png', 'domain-layout.json'}
        for candidate in (stage / 'painted_courtyard/assets').iterdir():
            if candidate.is_file() and candidate.name not in active_assets:
                candidate.unlink()
        (stage / 'project.godot').write_text('''config_version=5
[application]
config/name="云岫群山 · 开山与远行"
run/main_scene="res://painted_courtyard/courtyard.tscn"
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
textures/default_filters/use_nearest_mipmap_filter=false
[input_devices]
pointing/emulate_mouse_from_touch=true
''', encoding='utf-8')
        (stage / 'export_presets.cfg').write_text('''[preset.0]
name="PaintedWeb"
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
html/custom_html_shell="res://painted_courtyard/web/''' + ('game-shell.html' if args.game else 'shell.html') + '''"
html/canvas_resize_policy=2
html/focus_canvas_on_start=true
progressive_web_app/enabled=false
''', encoding='utf-8')
        run_godot([args.godot, '--headless', '--path', str(stage), '--editor', '--import'])
        run_godot([args.godot, '--headless', '--path', str(stage), '--quit-after', '2'])
        if args.check:
            for name in ['painted-actor-check.gd', 'painted-courtyard-check.gd', 'painted-domain-check.gd']:
                shutil.copy2(ROOT / 'qa' / name, stage / name)
                run_godot([args.godot, '--headless', '--path', str(stage), '--script', name])
                (stage / name).unlink()
        exported = stage / 'exported'
        exported.mkdir()
        run_godot([args.godot, '--headless', '--path', str(stage), '--export-release',
                   'PaintedWeb', str(exported / args.output.name)])
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
        manifest = {'build': 'mountain-domain-v2', 'godot': version, 'mainPack': pack_name,
                    'files': {file.name: hashlib.sha256(file.read_bytes()).hexdigest()
                              for file in sorted(exported.iterdir()) if file.is_file()}}
        (exported / 'build.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
        for artifact in exported.iterdir():
            shutil.copy2(artifact, args.output.parent / artifact.name)
        if args.game:
            for obsolete_pack in args.output.parent.glob('scene-*.pck'):
                if obsolete_pack.name != pack_name:
                    obsolete_pack.unlink()
            web = ROOT / 'godot/painted_courtyard/web'
            for name in ['game-ui.css', 'game-ui.mjs']:
                shutil.copy2(web / name, args.output.parent / name)
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
                'build': 'painted-game-system-preview-v1', 'godot': version, 'mainPack': pack_name,
                'files': files}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            print(f'Packaged {len(copied)} shared-rule modules for the painted game preview', flush=True)
    print(f'Painted courtyard: {args.output.resolve()}')


if __name__ == '__main__':
    main()
