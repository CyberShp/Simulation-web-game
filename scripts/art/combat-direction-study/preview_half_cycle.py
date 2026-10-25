#!/usr/bin/env python3
"""Pack two authored half cycles and preview them on the calibrated offline grid."""
import argparse
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont
from calibrate_static import nearest_uniform


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def data_image(image):
    from io import BytesIO
    data = BytesIO()
    image.save(data, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(data.getvalue()).decode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--first-sheet', type=Path, required=True)
    parser.add_argument('--second-sheet', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--split-x', type=int, default=615, help='Authored vertical sheet partition')
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError('Existing output is protected: ' + str(args.output))
    repo = Path(__file__).resolve().parents[3]
    calibration = repo/'docs/art/combat-motion-study-20261025/calibration/common-grid-v001'
    sources = [args.first_sheet.resolve(), args.second_sheet.resolve()]
    source_hashes = {str(path): sha(path) for path in sources}
    if not 1 <= args.split_x < 1254:
        raise ValueError('split-x must lie inside the source sheet')
    crops = [[0,0,args.split_x,627], [args.split_x,0,1254-args.split_x,627],
             [0,627,args.split_x,627], [args.split_x,627,1254-args.split_x,627]]
    feet = [[380,584], [337+627-args.split_x,584], [400,528], [363+627-args.split_x,528]]
    entries, boundaries = [], []
    for source in sources:
        image = Image.open(source).convert('RGBA')
        if image.size != (1254,1254):
            raise ValueError('Expected measured 1254x1254 sheet: '+str(source))
        for index, (crop, foot) in enumerate(zip(crops, feet)):
            x,y,w,h = crop
            cell = image.crop((x,y,x+w,y+h))
            alpha = cell.getchannel('A')
            bounds = alpha.point(lambda value:255 if value>=8 else 0).getbbox()
            border = [cell.getpixel((xx,yy))[3] for xx in range(w) for yy in (0,h-1)]
            border += [cell.getpixel((xx,yy))[3] for yy in range(1,h-1) for xx in (0,w-1)]
            high = sum(value>=8 for value in border)
            boundaries.append({'source':str(source), 'cell':index, 'crop':crop, 'foot':foot,
                               'boundsAlphaGE8':list(bounds), 'borderAlphaGE8':high, 'borderMaxAlpha':max(border)})
            if high:
                raise ValueError('Visible source content touches crop boundary: '+str(boundaries[-1]))
            entries.append({'file':str(source), 'crop':crop, 'foot':foot, 'durationMs':60, 'phase':'move'})
    args.output.mkdir(parents=True, exist_ok=False)
    spec = {'id':'shen-yan-half-cycle-study', 'visualIdentity':'shen-yan', 'action':'walk',
            'direction':'right', 'sourceHeight':500, 'scale':58/500, 'margin':2,
            'loop':True, 'expectedDurationMs':480, 'previewHeights':[58,116], 'frames':entries,
            'metadata':{'scope':'single direction offline candidate; not art accepted',
                        'frameOrder':'v6 four frames then v5 four frames',
                        'timing':'60ms per frame / 480ms author candidate'}}
    spec_path = args.output/'spec.json'
    spec_path.write_text(json.dumps(spec,indent=2)+'\n')
    environment = dict(os.environ,PYTHONDONTWRITEBYTECODE='1')
    pipeline = repo/'scripts/art/combat-frame-pipeline/pipeline.py'
    command = [sys.executable,str(pipeline),'pack','--spec',str(spec_path.resolve()),
               '--output-root',str((args.output/'packs').resolve()),'--name','half-cycle']
    packed = json.loads(subprocess.check_output(command,text=True,env=environment))
    bundle = Path(packed['output'])
    validation = json.loads(subprocess.check_output([sys.executable,str(pipeline),'validate',str(bundle)],text=True,env=environment))
    manifest = json.loads((bundle/'manifest.json').read_text())
    assert len(manifest['frames'])==8 and manifest['durationMs']==480 and abs(manifest['sourceHeight']-58)<1e-10
    scale = 1536/880
    background = Image.open(calibration/'background-logical.png').convert('RGBA')
    beast = Image.open(calibration/'packs/beast-v001/frames/0000.png').convert('RGBA')
    base = background.copy()
    base.alpha_composite(beast,(529,145))
    frames = [Image.open(bundle/f'frames/{i:04d}.png').convert('RGBA') for i in range(8)]
    actual, scenes = [], []
    contact = Image.new('RGB',(960,480),'white')
    draw = ImageDraw.Draw(contact)
    font = ImageFont.load_default(size=14)
    for index, frame in enumerate(frames):
        logical = base.copy()
        logical.alpha_composite(frame,(290-manifest['foot'][0],387-manifest['foot'][1]))
        scenes.append(nearest_uniform(logical,(1536,1024),scale).convert('RGB'))
        sprite = nearest_uniform(frame,(math.ceil(frame.width*scale),math.ceil(frame.height*scale)),scale)
        stage = Image.new('RGBA',(240,220),(255,255,255,255))
        left = round(120-manifest['foot'][0]*scale)
        top = round(170-manifest['foot'][1]*scale)
        stage.alpha_composite(sprite,(left,top))
        actual.append(stage.convert('RGB'))
        at = (index%4*240,index//4*240)
        contact.paste(stage.convert('RGB'),at)
        draw.line((at[0]+8,at[1]+170,at[0]+232,at[1]+170),fill='#c7c7c7',width=1)
        draw.text((at[0]+8,at[1]+8),f'{index+1} / {index*60}-{(index+1)*60} ms',font=font,fill='#303030')
        draw.text((at[0]+8,at[1]+218),'root baseline; candidate',font=font,fill='#606060')
    contact.save(args.output/'contact-actual-size.png')
    scenes[0].save(args.output/'scene-frame-01.png')
    for name, images in [('actual-size.gif',actual),('scene-cycle.gif',scenes)]:
        palette = images[0].quantize(colors=256)
        converted = [image.quantize(palette=palette,dither=Image.Dither.NONE) for image in images]
        converted[0].save(args.output/name,save_all=True,append_images=converted[1:],duration=60,
                          loop=0,optimize=False,disposal=2)
        with Image.open(args.output/name) as check:
            assert check.n_frames==8
            duration = 0
            for index in range(check.n_frames):
                check.seek(index);duration += check.info['duration']
            assert duration==480
    payload = {'atlas':data_image(Image.open(bundle/'atlas.png').convert('RGBA')),
               'background':data_image(base),'manifest':manifest,'scale':scale}
    html = r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>同标尺跑步候选循环</title>
<style>body{font:15px system-ui;margin:20px;background:#202722;color:#eee}button,input,select{font:inherit;margin:6px;padding:5px}canvas{image-rendering:pixelated}#view{overflow:auto;max-width:100%;max-height:78vh}pre{white-space:pre-wrap}</style>
<h1>同标尺单方向跑步候选</h1><p>v6四帧→v5四帧；固定H0=500、统一58逻辑像素。60ms/帧、480ms一圈为作者候选节拍。未作非刚性变形或逐帧bbox归一化，未接入游戏。</p>
<button id="prev">上一帧</button><button id="play">播放</button><button id="next">下一帧</button><label>模式<select id="mode"><option value="scene">校准背景</option><option value="white">实际尺寸白底</option></select></label><label>速度<select id="speed"><option value="0.25">1/4</option><option value="0.5">1/2</option><option value="1" selected>1x</option></select></label><input id="seek" type="range" min="0" max="479" value="0" step="1"><pre id="readout"></pre><div id="view"><canvas id="stage" width="1536" height="1024"></canvas></div><script>
const data=@@DATA@@,$=id=>document.getElementById(id),atlas=new Image(),background=new Image(),logical=document.createElement('canvas');logical.width=880;logical.height=587;let time=0,playing=false,last=null;
function paint(){const i=Math.min(7,Math.floor(time/60)),f=data.manifest.frames[i],foot=data.manifest.foot,stage=$('stage'),ctx=stage.getContext('2d'),lc=logical.getContext('2d');ctx.imageSmoothingEnabled=false;lc.imageSmoothingEnabled=false;
if($('mode').value==='scene'){stage.width=1536;stage.height=1024;ctx.imageSmoothingEnabled=false;lc.clearRect(0,0,880,587);lc.drawImage(background,0,0);lc.drawImage(atlas,f.x,f.y,f.w,f.h,290-foot[0],387-foot[1],f.w,f.h);ctx.drawImage(logical,0,0,880*data.scale,587*data.scale)}else{stage.width=480;stage.height=260;ctx.imageSmoothingEnabled=false;ctx.fillStyle='white';ctx.fillRect(0,0,480,260);ctx.drawImage(atlas,f.x,f.y,f.w,f.h,240-foot[0]*data.scale,200-foot[1]*data.scale,f.w*data.scale,f.h*data.scale)}
$('seek').value=time;$('readout').textContent='帧 '+(i+1)+' / 8，'+Math.round(time)+'ms / 480ms；区间 ['+(i*60)+','+((i+1)*60)+')ms；身体理论标尺 '+(58*data.scale).toFixed(3)+'px；候选待主Agent连续审看';}
function stop(){playing=false;last=null;$('play').textContent='播放'};$('prev').onclick=()=>{stop();time=(Math.floor(time/60)+7)%8*60;paint()};$('next').onclick=()=>{stop();time=(Math.floor(time/60)+1)%8*60;paint()};$('play').onclick=()=>{playing=!playing;last=null;$('play').textContent=playing?'暂停':'播放'};$('seek').oninput=()=>{stop();time=Number($('seek').value);paint()};$('mode').onchange=paint;
function loop(now){if(playing){if(last!==null)time=(time+(now-last)*Number($('speed').value))%480;last=now;paint()}requestAnimationFrame(loop)}
Promise.all([new Promise(ok=>{atlas.onload=ok;atlas.src=data.atlas}),new Promise(ok=>{background.onload=ok;background.src=data.background})]).then(()=>{paint();requestAnimationFrame(loop)});</script></html>'''.replace('@@DATA@@',json.dumps(payload).replace('<','\\u003c'))
    (args.output/'index.html').write_text(html,encoding='utf-8')
    assert all(sha(path)==digest for path,digest in source_hashes.items())
    report = {'scope':'55 B02 / SR007 and SR013 offline single-direction material candidate',
              'artReview':'pending-main-agent-continuous-review','sourceHashes':source_hashes,'sourceUnchanged':True,
              'sourceStandingReference':500,'logicalStandingReference':58,'scale':58/500,
              'presentationScale':scale,'theoreticalBodyHeight':58*scale,'order':'v6[0..3] then v5[0..3]',
              'frameCount':8,'frameDurationMs':60,'durationMs':480,'feet':feet*2,'boundaries':boundaries,
              'bundle':str(bundle),'pipelineValidation':validation,'command':command,
              'gifFormat':'opaque 256-color diagnostic previews; transparent PNGs remain in bundle',
              'runtimeIntegration':False,'saveLoad':'not-applicable-offline','htmlPlaybackReview':'not-yet-viewed'}
    (args.output/'preview-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    (args.output/'checksums.json').write_text(json.dumps({str(p.relative_to(args.output)):sha(p) for p in sorted(args.output.rglob('*')) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'page':str((args.output/'index.html').resolve()),'contact':str((args.output/'contact-actual-size.png').resolve()),
                      'gif':str((args.output/'actual-size.gif').resolve()),'sceneGif':str((args.output/'scene-cycle.gif').resolve()),
                      'bundle':str(bundle),'sourceUnchanged':True},ensure_ascii=False))


if __name__=='__main__':
    main()
