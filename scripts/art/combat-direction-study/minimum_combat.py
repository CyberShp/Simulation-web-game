"""Build a bounded, silent, offline four-action sample from complete source frames."""
import argparse
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=False)
    repo = Path(__file__).resolve().parents[3]
    sheet = Path('/Users/shepard/.codex/generated_images/01a171b0-eee9-7701-bd4a-61dcb2b0b53b/exec-2bc9ddf4-dd65-40e4-8390-ebe1b628cf76.png')
    package = Path('/Volumes/Media/immortal-qa/kling-actions-20261025-v001/action-package-v002')
    srcdir = repo / 'docs/art/combat-minimum-20261025'
    srcdir.mkdir(parents=True, exist_ok=True)
    saved = srcdir / 'source-actions.png'
    if saved.exists():
        if saved.read_bytes() != sheet.read_bytes():
            raise RuntimeError('Existing source differs; refusing overwrite')
    else:
        shutil.copyfile(sheet, saved)
    shutil.copyfile(package / 'atlas.png', out / 'movement-atlas.png')
    shutil.copyfile(package / 'scene-base-logical.png', out / 'background.png')
    data = json.loads((package / 'manifest.json').read_text())
    timing = json.loads(Path('/Volumes/Media/immortal-qa/kling-movement-20261025-v001/timing-compare-v001/config.json').read_text())
    import sys
    sys.path.append('/Users/shepard/Library/Python/3.9/lib/python/site-packages')
    import cv2
    im = Image.open(sheet).convert('RGBA')
    rgba = np.asarray(im)
    n, labels, stats, centers = cv2.connectedComponentsWithStats((rgba[:, :, 3] >= 8).astype('uint8'), connectivity=8)
    components = [i for i in range(1, n) if stats[i, 4] > 3000]
    components.sort(key=lambda i: (0 if centers[i, 1] < 520 else 1, centers[i, 0]))
    if len(components) != 8:
        raise RuntimeError(f'Expected eight full components, got {len(components)}')
    roots = [(205,490),(590,490),(930,490),(1390,490),(210,950),(600,950),(980,950),(1400,960)]
    actions = []
    for j, (component, root) in enumerate(zip(components, roots)):
        mask = Image.fromarray((labels == component).astype('uint8') * 255).filter(ImageFilter.MaxFilter(7))
        pixel = rgba.copy()
        pixel[:, :, 3] = np.where(np.asarray(mask) > 0, rgba[:, :, 3], 0)
        x,y,w,h,_ = map(int, stats[component])
        box = [max(0,x-4), max(0,y-4), min(im.width,x+w+4), min(im.height,y+h+4)]
        name = f'action-{j:02}.png'
        Image.fromarray(pixel).crop(box).save(out / name)
        actions.append({'file':name,'sourceBox':box,'root':[root[0]-box[0],root[1]-box[1]],'sourceHeight':390,'scale':58/390})
    config = {'startX':420,'targetX':600,'groundY':245,'speed':132,'range':120,
              'runOrder':list(range(58,67))+list(range(48,58)), 'runTiming':timing['timingsMs']['contact'],
              'frames':data['frames'],'movementRoot':[580*58/650,825*58/650],'actions':actions}
    (out / 'config.json').write_text(json.dumps(config, ensure_ascii=False, indent=2)+'\n')
    controller = Path(__file__).with_name('minimum_combat_controller.mjs').read_text()
    (out / 'controller.mjs').write_text(controller)
    page = HTML.replace('__CONFIG__',json.dumps(config,ensure_ascii=False)).replace('__CONTROLLER__',controller.replace('export function','function',1))
    (out / 'index.html').write_text(page)
    print(out / 'index.html')
    print('alpha range', int(rgba[:,:,3].min()), int(rgba[:,:,3].max()), 'components',len(components))
    print('action boxes', [a['sourceBox'] for a in actions])


HTML = r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>山林练剑 · 最小动作样板</title>
<style>*{box-sizing:border-box}body{margin:0;background:#15211e;color:#e7e4d3;font:15px system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:16px}header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:12px}h1{font:600 20px Georgia,serif;margin:0}p{margin:5px 0;color:#b9c5b9;font-size:13px}button{background:#31473d;color:#f7eed6;border:1px solid #708573;border-radius:5px;padding:8px 14px;cursor:pointer}canvas{display:block;width:auto;max-width:100%;max-height:calc(100vh - 150px);height:auto;margin:auto;object-fit:contain;image-rendering:pixelated;border:1px solid #60705a;outline:none}footer{display:flex;justify-content:space-between;gap:12px;align-items:center;padding-top:10px}#hud{font-variant-numeric:tabular-nums}small{color:#a4b5a6}</style>
<main><header><div><h1>山林练剑</h1><p>D 前进 · 松键停步 · 鼠标 / J 出剑 · H 受击 · R 复位</p></div><button id="reset">复位 R</button></header><canvas id="scene" width="880" height="587" tabindex="0" aria-label="仅右向四动作离线样板"></canvas><footer><span id="hud">加载素材…</span><small>右向离线样板 · 全无声 · 新剑击 / 受击为四帧候选</small></footer></main>
<script>
const config=__CONFIG__;
__CONTROLLER__
const game=createCombat(config),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const hud=document.querySelector('#hud');ctx.imageSmoothingEnabled=false;
const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src});
let bg,atlas,actions,ready=false,last=performance.now();
const names={idle:'待机',run:'跑动',attack:'剑击',hurt:'受击'};
function draw(){if(!ready)return;const s=game.snapshot();ctx.clearRect(0,0,880,587);ctx.drawImage(bg,0,0);
ctx.fillStyle='#17291edb';ctx.fillRect(551,124,98,34);ctx.fillStyle='#f4ebce';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('练习靶（静态）',600,138);ctx.fillStyle='#374838';ctx.fillRect(560,145,80,5);ctx.fillStyle='#d1af65';ctx.fillRect(560,145,80*s.hp/100,5);
ctx.strokeStyle='#d7c89555';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(480,253);ctx.lineTo(600,253);ctx.stroke();ctx.setLineDash([]);
ctx.save();ctx.globalAlpha=.23;ctx.fillStyle='#0a1712';ctx.beginPath();ctx.ellipse(s.x,245,12,4,0,0,Math.PI*2);ctx.fill();ctx.restore();
if(s.phase==='attack'||s.phase==='hurt'){const j=s.frame+(s.phase==='hurt'?4:0),a=config.actions[j],i=actions[j];ctx.drawImage(i,s.x-a.root[0]*a.scale,245-a.root[1]*a.scale,i.width*a.scale,i.height*a.scale)}
else{const r=config.frames[String(s.frame)].atlasRect;ctx.drawImage(atlas,...r,s.x-config.movementRoot[0],245-config.movementRoot[1],84,84)}
if(s.flash>0){ctx.fillStyle='#fff5c255';ctx.beginPath();ctx.ellipse(600,211,22,33,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffe4a7';ctx.font='bold 18px system-ui';ctx.fillText('−25',600,112)}
hud.textContent=`${names[s.phase]} · 距靶 ${(s.distance/40).toFixed(2)} m · 靶 ${s.hp}/100 · 命中 ${s.hits}　${s.feedback}`;
}
document.querySelector('#reset').onclick=()=>{game.reset();draw();canvas.focus({preventScroll:true})};
window.addEventListener('keydown',e=>{if(['KeyD','KeyJ','KeyH','KeyR','KeyA','KeyW','KeyS','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyD'&&!e.repeat)game.move(true);if(e.repeat)return;if(e.code==='KeyJ')game.attack();if(e.code==='KeyH')game.hurt();if(e.code==='KeyR')game.reset()});
window.addEventListener('keyup',e=>{if(e.code==='KeyD')game.move(false)});window.addEventListener('blur',()=>game.blur());
canvas.addEventListener('pointerdown',e=>{if(e.button===0){game.attack();canvas.focus({preventScroll:true});e.preventDefault()}});
Promise.all([load('background.png'),load('movement-atlas.png'),...config.actions.map(a=>load(a.file))]).then(x=>{[bg,atlas,...actions]=x;ready=true;canvas.focus({preventScroll:true});draw()}).catch(e=>hud.textContent='素材加载失败：'+e);
function tick(now){const dt=now-last;last=now;game.advance(Math.min(dt,100));draw();requestAnimationFrame(tick)}requestAnimationFrame(tick);
window.combatSample={game,config,draw};
</script></html>'''


if __name__ == '__main__':
    main()
