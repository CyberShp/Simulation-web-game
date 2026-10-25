#!/usr/bin/env python3
"""Package source-preserving alpha clips and an authored offline action sequence."""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import shutil

import numpy as np
from PIL import Image,ImageDraw
from calibrate_static import nearest_uniform


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def data_image(path):return 'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()


def timeline(clip,name,count=None):
    ids=clip['frames'] if count is None else clip['frames'][:count]
    step=clip['durationMs']/len(clip['frames'])
    return [{'sourceFrameId':f,'phase':name,'durationMs':step} for f in ids]


def boundaries(entries,target):
    total=0
    for e in entries:e['startMs']=total;total+=e['durationMs'];e['endMs']=total
    entries[-1]['endMs']=target
    entries[-1]['durationMs']=target-entries[-1]['startMs']
    return target


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--spec',type=Path,required=True)
    parser.add_argument('--action-matte',type=Path,required=True)
    parser.add_argument('--run-matte',type=Path,required=True)
    parser.add_argument('--contacts',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if args.output.exists():raise FileExistsError('Existing action package is protected: '+str(args.output))
    spec=json.loads(args.spec.read_text());sources={}
    for directory in [args.action_matte,args.run_matte]:
        report=json.loads((directory/'report.json').read_text())
        if report['sourceVideoSha256']!=spec['sourceVideoSha256']:raise ValueError('Video source differs')
        for f in report['frames']:sources[f['frameIndex']]=(directory,f)
    ids=sorted({f for clip in spec['clips'].values() for f in clip['frames']})
    args.output.mkdir(parents=True,exist_ok=False)
    for name in ['frames','native-rgba']:(args.output/name).mkdir()
    shutil.copytree(args.contacts,args.output/'contacts')
    shutil.copyfile(args.spec,args.output/'spec.json')
    protection={}
    for name,directory in [('actions',args.action_matte),('run',args.run_matte)]:
        protection[name]=json.loads((directory/'protection.json').read_text())
    (args.output/'protection.json').write_text(json.dumps(protection,indent=2)+'\n')
    atlas=Image.new('RGBA',(840,math.ceil(len(ids)/10)*84),(0,0,0,0));frames={};actual={};scale=1536/880;foot=[580*58/650,825*58/650]
    for number,f in enumerate(ids):
        directory,record=sources[f];native=next((directory/'rgba').glob(f'frame-{f:06d}-*.png'));original=directory/'originals'/native.name
        if sha(original)!=record['sourceSha256']:raise ValueError('Original PNG hash differs')
        with Image.open(native) as im:rgba=np.asarray(im)
        with Image.open(original) as im:rgb=np.asarray(im)
        if not np.array_equal(rgba[:,:,:3],rgb):raise ValueError('Native RGB differs')
        native_dest=args.output/'native-rgba'/native.name;shutil.copyfile(native,native_dest)
        logical=directory/'logical-box'/native.name;dest=args.output/'frames'/f'frame-{f:06d}.png';shutil.copyfile(logical,dest)
        image=Image.open(dest).convert('RGBA')
        if image.size!=(84,84):raise ValueError('Logical frame size differs')
        a=np.asarray(image)[:,:,3]
        if np.any(a[0]) or np.any(a[-1]) or np.any(a[:,0]) or np.any(a[:,-1]):raise ValueError('Logical alpha touches canvas edge')
        x,y=number%10*84,number//10*84;atlas.paste(image,(x,y))
        frames[str(f)]={'sourceFrameId':f,'sourceTimestampSeconds':record['timestamp'],'sourceRgbSha256':record['sourceSha256'],
            'nativeFile':str(native_dest.relative_to(args.output)),'nativeSha256':sha(native_dest),'file':str(dest.relative_to(args.output)),
            'sha256':sha(dest),'atlasRect':[x,y,84,84]}
        stage=Image.new('RGBA',(440,160),(255,255,255,255));ImageDraw.Draw(stage).rectangle((220,0,439,159),fill=(24,32,43,255))
        sprite=nearest_uniform(image,(147,147),scale)
        for anchor_x in [110,330]:stage.alpha_composite(sprite,(round(anchor_x-foot[0]*scale),round(142-foot[1]*scale)))
        actual[f]=stage.convert('RGB')
    atlas.save(args.output/'atlas.png')
    timelines={name:timeline(clip,name) for name,clip in spec['clips'].items()};combo=[]
    for item in spec['sequence']:
        for _ in range(item.get('repeat',1)):combo.extend(timeline(spec['clips'][item['clip']],item['clip'],item.get('count')))
    timelines['combined']=combo
    durations={name:boundaries(items,spec['clips'][name]['durationMs'] if name!='combined' else math.fsum(e['durationMs'] for e in items)) for name,items in timelines.items()}
    gif_reports={};palette=actual[ids[0]].quantize(colors=256)
    for name,items in timelines.items():
        ticks=[0]+[round(e['endMs']/10)*10 for e in items];delays=[b-a for a,b in zip(ticks,ticks[1:])]
        if min(delays)<10:raise ValueError('GIF timing below 10ms')
        images=[actual[e['sourceFrameId']].quantize(palette=palette,dither=Image.Dither.NONE) for e in items]
        options={'loop':0} if name=='run' else {}
        dest=args.output/f'{name}-white-dark.gif'
        images[0].save(dest,save_all=True,append_images=images[1:],duration=delays,disposal=2,optimize=False,**options)
        with Image.open(dest) as gif:
            encoded=[]
            for i in range(gif.n_frames):gif.seek(i);encoded.append(gif.info['duration'])
            if sum(encoded)!=ticks[-1]:raise ValueError('GIF total duration differs')
            if name!='run' and 'loop' in gif.info:raise ValueError('One-shot GIF unexpectedly loops')
            gif_reports[name]={'timelineFrames':len(items),'encodedFrames':gif.n_frames,'durationMs':sum(encoded),
                'idealDurationMs':durations[name],'quantizationErrorMs':sum(encoded)-durations[name],
                'frameDurationsMs':encoded,'loop':name=='run',
                'note':'GIF may merge identical adjacent palette frames; original PNG timeline entries remain intact'}
    repo=Path(__file__).resolve().parents[3];calibration=repo/'docs/art/combat-motion-study-20261025/calibration/common-grid-v001'
    bg=Image.open(calibration/'background-logical.png').convert('RGBA');beast=Image.open(calibration/'packs/beast-v001/frames/0000.png').convert('RGBA');bg.alpha_composite(beast,(529,145));bg.save(args.output/'scene-base-logical.png')
    manifest={'id':'kling-offline-actions-v001','sourceVideoSha256':spec['sourceVideoSha256'],'sourceHeight':650,'sourceRoot':[580,825],
        'logicalHeight':58,'sourceScale':58/650,'displayScale':scale,'footLogical':foot,'cellSize':[84,84],'atlas':'atlas.png',
        'frames':frames,'clips':spec['clips'],'timelines':timelines,'durationsMs':durations,'gifReports':gif_reports,
        'endBehavior':spec['endBehavior'],'editorialEntrySourceFrame':58,'editorialExitSourceFrame':61,
        'editorialScope':spec['editorialScope'],'nativeRgbExactAllFrames':True,'runtimeIntegration':False,'artReview':'pending-main-agent'}
    (args.output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    payload={'m':manifest,'atlas':data_image(args.output/'atlas.png'),'bg':data_image(args.output/'scene-base-logical.png')}
    html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>待机起跑跑步收步组合候选</title><style>body{font:15px system-ui;background:#202722;color:#eee;margin:20px}button,input,select{font:inherit;padding:5px;margin:6px}canvas{image-rendering:pixelated}#view{overflow:auto;max-width:100%}</style><h1>待机—起跑—跑步—收步—回稳</h1><p id="status">离线动作组合候选 / 待主审 / 待运行验证</p><p>固定H0=650/root[580,825]、BOX58逻辑像素；跑步19帧480ms。入口58、出口61仅为本片离线剪辑。组合末尾停在原frame240，可重播；轻微源浅边保留。</p><button id="prev">上一帧</button><button id="play">播放</button><button id="next">下一帧</button><button id="replay">重播</button><select aria-label="动作段" id="clip"><option value="combined">完整组合（末尾保持）</option><option value="idle">待机625ms</option><option value="start">起跑250ms</option><option value="run">独立跑步480ms循环</option><option value="stop">收步330ms</option><option value="settle">回稳1250ms（末尾保持）</option></select><select aria-label="视图" id="mode"><option value="pair">实际尺寸深浅底</option><option value="scene">校准场景1536画布</option></select><input aria-label="帧时间轴" id="seek" type="range" min="0" step="1" value="0"><p id="readout"></p><div id="view"><canvas id="stage"></canvas></div><script>
const data=@@DATA@@,$=id=>document.getElementById(id),a=new Image(),b=new Image(),c=$('stage'),ctx=c.getContext('2d'),l=document.createElement('canvas'),lc=l.getContext('2d');l.width=880;l.height=587;let i=0,t=0,playing=false,last=null;
function list(){return data.m.timelines[$('clip').value]}function duration(){return data.m.durationsMs[$('clip').value]}function loops(){return $('clip').value==='run'}function stop(){playing=false;last=null;$('play').textContent='播放'}
function paint(){const e=list()[i],f=data.m.frames[e.sourceFrameId],s=data.m.displayScale,p=data.m.footLogical;if($('mode').value==='scene'){c.width=1536;c.height=1024;lc.clearRect(0,0,880,587);lc.imageSmoothingEnabled=false;lc.drawImage(b,0,0);lc.drawImage(a,...f.atlasRect,Math.round(290-p[0]),Math.round(387-p[1]),84,84);ctx.imageSmoothingEnabled=false;ctx.drawImage(l,0,0,880*s,587*s)}else{c.width=440;c.height=160;ctx.imageSmoothingEnabled=false;ctx.fillStyle='white';ctx.fillRect(0,0,220,160);ctx.fillStyle='#18202b';ctx.fillRect(220,0,220,160);for(const x of [110,330])ctx.drawImage(a,...f.atlasRect,Math.round(x-p[0]*s),Math.round(142-p[1]*s),84*s,84*s)}$('seek').max=list().length-1;$('seek').value=i;$('readout').textContent='阶段 '+e.phase+'；帧 '+(i+1)+'/'+list().length+'；原frame '+e.sourceFrameId+'；原时间 '+f.sourceTimestampSeconds.toFixed(3)+'s；区间 '+e.startMs.toFixed(3)+'–'+e.endMs.toFixed(3)+'ms / '+duration().toFixed(3)+'ms';}
function step(n){stop();i=Math.max(0,Math.min(list().length-1,i+n));t=list()[i].startMs;paint()}$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('play').onclick=()=>{if(t>=duration()){t=0;i=0}playing=!playing;last=null;$('play').textContent=playing?'暂停':'播放'};$('replay').onclick=()=>{t=0;i=0;last=null;playing=true;$('play').textContent='暂停';paint()};$('clip').onchange=()=>{stop();i=0;t=0;paint()};$('mode').onchange=paint;$('seek').oninput=()=>{stop();i=Number($('seek').value);t=list()[i].startMs;paint()};function tick(now){if(playing){if(last!==null)t+=now-last;last=now;if(t>=duration()){if(loops())t%=duration();else{t=duration();i=list().length-1;stop()}}if(playing)i=Math.max(0,list().findIndex(e=>t<e.endMs));paint()}requestAnimationFrame(tick)}Promise.all([new Promise(ok=>{a.onload=ok;a.src=data.atlas}),new Promise(ok=>{b.onload=ok;b.src=data.bg})]).then(()=>{paint();requestAnimationFrame(tick)});</script></html>'''.replace('@@DATA@@',json.dumps(payload).replace('<','\\u003c'))
    (args.output/'index.html').write_text(html)
    (args.output/'checksums.json').write_text(json.dumps({str(p.relative_to(args.output)):sha(p) for p in sorted(args.output.rglob('*')) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'html':str(args.output/'index.html'),'gif':str(args.output/'combined-white-dark.gif'),
        'uniqueFrames':len(ids),'combinedTimelineFrames':len(combo),'durationMs':durations['combined'],'gifDurationMs':gif_reports['combined']['durationMs']}))


if __name__=='__main__':main()
