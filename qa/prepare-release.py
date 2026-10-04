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
files=['index.html','ea.css','ea-game.mjs','ea-ui.mjs','ea-renderer.mjs',
       'ea-persistence.mjs','ea-data.mjs','ea-sim.mjs','ea-society.mjs',
       'ea-campaign.mjs','map-input.mjs','model.mjs','world.mjs',
       'living-world.mjs','sect-sim.mjs']
entries=[]
for name in files:
    content=(root/'dist'/name).read_text()
    content=re.sub(r'(\./[\w-]+\.mjs)(?:\?v=[\w.-]+)?',lambda m:m[1]+'?v='+args.tag,content)
    content=content.replace('./ea.css','./ea.css?v='+args.tag)
    if args.preview:
        content=content.replace('./assets/','../assets/')
    entries.append({'path':('ea-preview/' if args.preview else '')+name,
                    'mode':'100644','type':'blob','content':content})
if args.preview:
    entries.append({'path':'ea-preview/mobile.html','mode':'100644','type':'blob','content':'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>仙府 · 390px 布局验收</title><style>body{margin:0;background:#173e37;color:#f1ecd8;font:14px system-ui;display:grid;place-items:center;gap:8px;padding:12px}p{margin:0}iframe{width:390px;max-width:100%;height:844px;border:1px solid #bcb17f;border-radius:12px;background:#e9eddb}</style><p>390 × 844 · 响应式布局验收</p><iframe title="仙府窄屏试玩" src="./index.html"></iframe></html>'''.replace('src="./index.html"',f'src="./index.html?v={args.tag}"')})
print(json.dumps(entries,ensure_ascii=False))
