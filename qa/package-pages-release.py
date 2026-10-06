"""Package text modules for the existing GitHub Pages tree; no deployment here."""
import argparse
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--tag', required=True)
parser.add_argument('--preview-only', action='store_true')
parser.add_argument('--output', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
entries = []
for file in sorted((root / 'dist').iterdir()):
    if not file.is_file() or file.suffix not in {'.mjs', '.css', '.html'}:
        continue
    content = file.read_text()
    content = re.sub(r'(\.mjs)\?v=[^\s\'"<>]+', r'\1?v=' + args.tag, content)
    content = re.sub(r'(\.mjs)(?=[\'\"])', r'\1?v=' + args.tag, content)
    content = re.sub(r'(\.css)\?v=[^\s\'"<>]+', r'\1?v=' + args.tag, content)
    for prefix in (['ea-preview/'] if args.preview_only else ['', 'ea-preview/']):
        # Preview modules are one directory below the shared art/prototype
        # assets. Root modules keep their original relative paths.
        output_content = content
        if prefix:
            output_content = output_content.replace('./assets/', '../assets/').replace('./yunxiu-courtyard/', '../yunxiu-courtyard/')
        entries.append({'path': prefix + file.name, 'mode': '100644', 'type': 'blob', 'content': output_content})
mobile = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>仙府 · 网页视口验收</title><style>body{margin:0;background:#173e37;color:#f1ecd8;font:14px system-ui;display:grid;place-items:center;gap:8px;padding:12px}p{margin:0}iframe{border:1px solid #bcb17f;border-radius:12px;background:#e9eddb}</style><p id="label">网页视口验收 · 独立存档</p><iframe title="仙府网页视口试玩"></iframe><script>const q=new URLSearchParams(location.search),w=Math.max(320,Math.min(2560,Number(q.get('width'))||820)),h=Math.max(240,Math.min(1600,Number(q.get('height'))||1180)),scope=/^qa-[a-z0-9-]{1,48}$/.test(q.get('acceptance')||'')?q.get('acceptance'):'qa-viewport';document.querySelector('iframe').style.cssText=`width:${w}px;height:${h}px`;document.querySelector('iframe').src='./index.html?v=TAG&acceptance='+scope;document.querySelector('#label').textContent=`${w} × ${h} · 独立存档网页视口验收`;</script></html>'''
entries.append({'path': 'ea-preview/mobile.html', 'mode': '100644', 'type': 'blob', 'content': mobile.replace('TAG', args.tag)})
entries.append({'path': 'ea-preview/viewport.html', 'mode': '100644', 'type': 'blob', 'content': mobile.replace('TAG', args.tag)})
output = Path(args.output)
output.write_text(json.dumps(entries, ensure_ascii=False))
print(json.dumps({'entries': len(entries), 'bytes': output.stat().st_size, 'tag': args.tag}))
