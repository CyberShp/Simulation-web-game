#!/usr/bin/env python3
"""Package reviewed alpha candidates into an offline BOX-grid cycle and previews."""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import shutil

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from calibrate_static import nearest_uniform
from matte_frames import composite


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def data_image(path):return 'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--matte',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--duration-ms',type=float,default=19/24*1000,help='Author cycle duration, preserving all original frames')
    args=parser.parse_args()
    if args.output.exists():raise FileExistsError('Existing package is protected: '+str(args.output))
    if args.duration_ms/19<10:raise ValueError('Cycle duration is below GIF frame-time resolution')
    frame_duration=args.duration_ms/19
    report=json.loads((args.matte/'report.json').read_text())
    if [r['frameIndex'] for r in report['frames']]!=list(range(48,67)):raise ValueError('Expected original frames 48..66')
    repo=Path(__file__).resolve().parents[3]
    calibration=repo/'docs/art/combat-motion-study-20261025/calibration/common-grid-v001'
    args.output.mkdir(parents=True,exist_ok=False)
    for sub in ['frames','contacts']:(args.output/sub).mkdir()
    scale=1536/880;foot=[580*58/650,825*58/650];font=ImageFont.load_default(size=17)
    atlas=Image.new('RGBA',(420,336),(0,0,0,0));frames=[];entries=[];actual=[];scenes=[]
    background=Image.open(calibration/'background-logical.png').convert('RGBA')
    beast=Image.open(calibration/'packs/beast-v001/frames/0000.png').convert('RGBA')
    background.alpha_composite(beast,(529,145));background.save(args.output/'scene-base-logical.png')
    native=[]
    for number,r in enumerate(report['frames']):
        source=next((args.matte/'rgba').glob(f'frame-{r["frameIndex"]:06d}-*.png'))
        original=args.matte/'originals'/source.name
        with Image.open(source) as im:rgba=np.asarray(im)
        with Image.open(original) as im:rgb=np.asarray(im)
        if not np.array_equal(rgba[:,:,:3],rgb):raise ValueError('Native RGB differs')
        if sha(original)!=r['sourceSha256']:raise ValueError('Original frame hash differs')
        logical=args.matte/'logical-box'/source.name;dest=args.output/'frames'/f'{number:04d}.png'
        shutil.copyfile(logical,dest)
        image=Image.open(dest).convert('RGBA')
        if image.size!=(84,84):raise ValueError('Expected common 84x84 frame canvas')
        border=[image.getpixel((x,y))[3] for x in range(84) for y in [0,83]]+[image.getpixel((x,y))[3] for y in range(84) for x in [0,83]]
        if max(border)>0:raise ValueError('Normalized frame touches canvas edge')
        rect=[number%5*84,number//5*84,84,84];atlas.paste(image,rect[:2]);frames.append(image)
        native.append(Image.fromarray(rgba))
        entries.append({'index':number,'sourceFrameId':r['frameIndex'],'sourceTimestampSeconds':r['timestamp'],
            'sourceRgbSha256':r['sourceSha256'],'nativeRgbaSha256':sha(source),'file':f'frames/{number:04d}.png',
            'sha256':sha(dest),'atlasRect':rect,'durationMs':frame_duration})
        stage=Image.new('RGBA',(440,160),(255,255,255,255));ImageDraw.Draw(stage).rectangle((220,0,439,159),fill=(24,32,43,255))
        sprite=nearest_uniform(image,(147,147),scale)
        for anchor_x in [110,330]:stage.alpha_composite(sprite,(round(anchor_x-foot[0]*scale),round(142-foot[1]*scale)))
        actual.append(stage.convert('RGB'))
        scene=background.copy();scene.alpha_composite(image,(round(290-foot[0]),round(387-foot[1])))
        scenes.append(nearest_uniform(scene,(1536,1024),scale).convert('RGB'))
    atlas.save(args.output/'atlas.png')
    for page in range(4):
        start=page*6;stop=min(start+6,19)
        for name,bg in [('white','white'),('dark',(24,32,43)),('checker','checker')]:
            sheet=Image.new('RGB',(960,704),(238,238,238));draw=ImageDraw.Draw(sheet)
            for position,index in enumerate(range(start,stop)):
                x=position%3*320;y=position//3*352
                tile=composite(native[index],bg).resize((320,320),Image.Resampling.LANCZOS)
                sheet.paste(tile,(x,y+32));draw.text((x+7,y+7),f'frame {index+48} / {entries[index]["sourceTimestampSeconds"]:.3f}s',font=font,fill=(25,25,25))
            sheet.save(args.output/'contacts'/f'native-{name}-{page+1:02d}.png')
    contact=Image.new('RGB',(1320,math.ceil(19/3)*192),(238,238,238));draw=ImageDraw.Draw(contact)
    for i,frame in enumerate(actual):
        x=i%3*440;y=i//3*192;contact.paste(frame,(x,y+32))
        draw.text((x+7,y+7),f'{i+1}/19 original {i+48}: white / dark',font=font,fill=(25,25,25))
    contact.save(args.output/'contact-actual-size.png')
    durations=[round((i+1)*frame_duration/10)*10-round(i*frame_duration/10)*10 for i in range(19)]
    for filename,images in [('white-dark-cycle.gif',actual),('scene-cycle.gif',scenes)]:
        palette=images[0].quantize(colors=256)
        indexed=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in images]
        indexed[0].save(args.output/filename,save_all=True,append_images=indexed[1:],duration=durations,loop=0,disposal=2,optimize=False)
        with Image.open(args.output/filename) as gif:
            if gif.n_frames!=19:raise ValueError('GIF frame count changed')
            times=[]
            for i in range(gif.n_frames):gif.seek(i);times.append(gif.info['duration'])
            if times!=durations:raise ValueError('GIF durations changed')
    scenes[0].save(args.output/'scene-frame-01.png')
    manifest={'id':'shen-yan-kling-run-cycle-candidate-v001','scope':'offline single-direction alpha and scale candidate; runtime validation pending',
        'sourceVideoSha256':report['sourceVideoSha256'],'originalFrames':[48,66],'frameCount':19,'direction':'right',
        'cellSize':[84,84],'atlas':'atlas.png','sourceHeight':650,'targetLogicalHeight':58,'sourceScale':58/650,
        'sourceRoot':[580,825],'footLogical':foot,'sampling':'premultiplied BOX downsample, shared nearest enlargement',
        'displayScale':scale,'standingBodyTheoreticalDisplayPx':58*scale,'sourceFps':24,'playbackFps':1000/frame_duration,
        'frameDurationMs':frame_duration,'durationMs':args.duration_ms,
        'gifDurationMs':sum(durations),'gifQuantizationErrorMs':sum(durations)-args.duration_ms,'gifFrameDurationsMs':durations,
        'retiming':'author duration; all 19 original frames retained; no interpolation or reversal',
        'nativeMatteReference':str(args.matte.resolve()),'protectionRecord':str((args.matte/'protection.json').resolve()),
        'nativeRgbExactAll19':True,'normalizedBorderAlphaMaxAll19':0,'runtimeIntegration':False,'frames':entries}
    (args.output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    payload={'manifest':manifest,'atlas':data_image(args.output/'atlas.png'),'background':data_image(args.output/'scene-base-logical.png')}
    html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Kling透明跑步候选</title>
<style>body{background:#202722;color:#eee;font:15px system-ui;margin:20px}button,select,input{font:inherit;margin:6px;padding:5px}canvas{image-rendering:pixelated}#view{max-width:100%;overflow:auto}#readout{font-variant-numeric:tabular-nums}</style>
<h1>Kling透明跑步候选</h1><p id="status">离线候选待主审 / 待运行验证</p><p>原frame48–66；固定H0=650、root[580,825]，统一58逻辑像素，BOX缩小后nearest呈现；保留轻微源混色浅边。全部19帧作者周期@@DURATION@@ms，GIF量化@@GIF@@ms。校准场景仅作离线对照。</p>
<button id="prev">上一帧</button><button id="play">播放</button><button id="next">下一帧</button><label>模式<select id="mode"><option value="pair">实际尺寸深浅底</option><option value="scene">校准场景1536画布</option></select></label><input aria-label="原帧时间轴" id="seek" type="range" min="0" max="18" step="1" value="0"><p id="readout"></p><div id="view"><canvas id="stage"></canvas></div>
<script>const data=@@DATA@@,$=id=>document.getElementById(id),atlas=new Image(),bg=new Image(),stage=$('stage'),ctx=stage.getContext('2d'),logical=document.createElement('canvas'),lc=logical.getContext('2d');logical.width=880;logical.height=587;let i=0,playing=false,last=null,elapsed=0;
function paint(){const m=data.manifest,f=m.frames[i],s=m.displayScale,p=m.footLogical;if($('mode').value==='scene'){stage.width=1536;stage.height=1024;lc.clearRect(0,0,880,587);lc.imageSmoothingEnabled=false;lc.drawImage(bg,0,0);lc.drawImage(atlas,...f.atlasRect,Math.round(290-p[0]),Math.round(387-p[1]),84,84);ctx.imageSmoothingEnabled=false;ctx.drawImage(logical,0,0,880*s,587*s)}else{stage.width=440;stage.height=160;ctx.imageSmoothingEnabled=false;ctx.fillStyle='white';ctx.fillRect(0,0,220,160);ctx.fillStyle='#18202b';ctx.fillRect(220,0,220,160);for(const x of [110,330])ctx.drawImage(atlas,...f.atlasRect,Math.round(x-p[0]*s),Math.round(142-p[1]*s),84*s,84*s)}$('seek').value=i;$('readout').textContent='帧 '+(i+1)+' /19；原frame '+f.sourceFrameId+'，原时间 '+f.sourceTimestampSeconds.toFixed(3)+'s；周期 '+m.durationMs.toFixed(3)+'ms';}
function stop(){playing=false;last=null;$('play').textContent='播放'}function step(delta){stop();i=(i+delta+19)%19;elapsed=i*data.manifest.frameDurationMs;paint()}$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('play').onclick=()=>{playing=!playing;last=null;$('play').textContent=playing?'暂停':'播放'};$('seek').oninput=()=>{stop();i=Number($('seek').value);elapsed=i*data.manifest.frameDurationMs;paint()};$('mode').onchange=paint;function loop(now){if(playing){if(last!==null)elapsed=(elapsed+now-last)%data.manifest.durationMs;last=now;i=Math.floor(elapsed/data.manifest.frameDurationMs);paint()}requestAnimationFrame(loop)}Promise.all([new Promise(ok=>{atlas.onload=ok;atlas.src=data.atlas}),new Promise(ok=>{bg.onload=ok;bg.src=data.background})]).then(()=>{paint();requestAnimationFrame(loop)});</script></html>'''.replace('@@DATA@@',json.dumps(payload).replace('<','\\u003c')).replace('@@DURATION@@',str(args.duration_ms)).replace('@@GIF@@',str(sum(durations)))
    (args.output/'index.html').write_text(html)
    (args.output/'checksums.json').write_text(json.dumps({str(p.relative_to(args.output)):sha(p) for p in sorted(args.output.rglob('*')) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'gif':str(args.output/'white-dark-cycle.gif'),'html':str(args.output/'index.html'),
        'contactPages':str(args.output/'contacts/native-dark-01.png'),'manifest':str(args.output/'manifest.json')},ensure_ascii=False))


if __name__=='__main__':main()
