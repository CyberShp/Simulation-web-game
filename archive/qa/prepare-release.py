"""Produce a cache-coherent static release tree for the authorized GitHub publisher.

The caller uploads the returned content with the Git Data API. No credentials,
network access, repository mutation, or deployment side effects occur here.
"""
from pathlib import Path
import argparse,json,re

parser=argparse.ArgumentParser()
parser.add_argument('--tag',required=True)
parser.add_argument('--preview',action='store_true')
args=parser.parse_args()
if not re.fullmatch(r'[a-zA-Z0-9._-]+',args.tag):
    raise SystemExit('Invalid cache tag')
root=Path(__file__).resolve().parents[1]
# Include new renderers/navigation instead of silently publishing an old module list.
files=['index.html']+[p.name for p in sorted((root/'dist').iterdir())
                        if p.is_file() and p.suffix in {'.mjs','.css'}]
entries=[]
for name in files:
    content=(root/'dist'/name).read_text()
    content=re.sub(r'((?:\.\.?/)[\w./-]+\.(?:mjs|css))(?:\?v=[\w.-]+)?',lambda m:m[1]+'?v='+args.tag,content)
    if args.preview:
        content=content.replace('./assets/','../assets/')
        content=content.replace('./yunxiu-courtyard/','../yunxiu-courtyard/')
    entries.append({'path':('ea-preview/' if args.preview else '')+name,
                    'mode':'100644','type':'blob','content':content})
if args.preview:
    entries.append({'path':'ea-preview/mobile.html','mode':'100644','type':'blob','content':'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>仙府 · 窄屏布局验收</title><style>body{margin:0;background:#173e37;color:#f1ecd8;font:14px system-ui;display:grid;place-items:center;gap:8px;padding:12px}p{margin:0}iframe{max-width:100%;border:1px solid #bcb17f;border-radius:12px;background:#e9eddb}</style><p id="label">响应式布局验收 · 独立存档</p><iframe title="仙府窄屏试玩"></iframe><script>const q=new URLSearchParams(location.search),w=Math.max(320,Math.min(760,Number(q.get('width'))||390)),h=Math.max(480,Math.min(1024,Number(q.get('height'))||844)),scope=/^qa-[a-z0-9-]{1,48}$/.test(q.get('acceptance')||'')?q.get('acceptance'):'qa-mobile';document.querySelector('iframe').style.cssText=`width:${w}px;height:${h}px`;document.querySelector('iframe').src='./index.html?v=CACHE_TAG&acceptance='+scope;document.querySelector('#label').textContent=`${w} × ${h} · 独立存档响应式验收`;</script></html>'''.replace('CACHE_TAG',args.tag)})
print(json.dumps(entries,ensure_ascii=False))
