#!/usr/bin/env python3
"""Compare equal/contact-weighted original-frame timing on a 3.3 m/s grid."""
import argparse,base64,hashlib,json,math,re,shutil,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from calibrate_static import nearest_uniform


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--package',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    if a.output.exists():raise FileExistsError('Existing timing study is protected: '+str(a.output))
    repo=Path(__file__).resolve().parents[3];campaign=repo/'src/simulation/ea-campaign.mjs';text=campaign.read_text()
    speed=float(re.search(r'p\.x\+input\.move\.x\*([0-9.]+)\*dt',text).group(1))
    if float(re.search(r'moveCombatActor\(p,p\.target,([0-9.]+),dt',text).group(1))!=speed:raise ValueError('Formal free-movement speed paths disagree')
    node='/Users/shepard/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
    constants=json.loads(subprocess.check_output([node,'--input-type=module','-e','import {COMBAT_CAMERA_VIEW_METRES,COMBAT_GROUND_Y_SCALE} from "./apps/courtyard/courtyard-combat-camera.mjs";import {COMBAT_ACTOR_HEIGHT_PER_SX} from "./apps/courtyard/courtyard-combat-dimensions.mjs";process.stdout.write(JSON.stringify({viewMetres:COMBAT_CAMERA_VIEW_METRES,groundYScale:COMBAT_GROUND_Y_SCALE,bodyMetres:COMBAT_ACTOR_HEIGHT_PER_SX}));'],cwd=repo,text=True))
    m=json.loads((a.package/'manifest.json').read_text());order=m['clips']['run']['frames'];assert len(order)==19 and set(order)==set(range(48,67))
    source_scale=58/650;logical_speed=speed*40;duration=480;equal={f:duration/19 for f in order}
    heels={51:[565,800],52:[500,800],53:[435,795],60:[570,810],61:[515,810],62:[455,805],63:[390,800]}
    pairs=[(51,52),(52,53),(60,61),(61,62),(62,63)];fit={}
    for first,last in pairs:fit[first]=(heels[first][0]-heels[last][0])*source_scale/logical_speed*1000
    remainder=(duration-math.fsum(fit.values()))/(19-len(fit));fit.update({f:remainder for f in order if f not in fit})
    variants={'equal':equal,'contact':fit};rows=[];sx=1536/constants['viewMetres'];sy=sx*constants['groundYScale']
    for first,last in pairs:
        dx=(heels[last][0]-heels[first][0])*source_scale;dy=(heels[last][1]-heels[first][1])*source_scale
        rows.append({'from':first,'to':last,'sourceDeltaX':heels[last][0]-heels[first][0],
            'equalDurationMs':equal[first],'contactDurationMs':fit[first],
            'equalResidualLogicalPx':logical_speed*equal[first]/1000+dx,
            'contactResidualLogicalPx':logical_speed*fit[first]/1000+dx,
            'verticalDeltaLogicalPx':dy,'pairUncertaintyLogicalPx':10*source_scale,
            'timeUncertaintyMs':10*source_scale/logical_speed*1000})
    paths=['src/simulation/ea-campaign.mjs','src/simulation/ea-opening-sim.mjs','src/simulation/ea-sr-combat.mjs',
           'apps/courtyard/courtyard-combat-camera.mjs','apps/courtyard/courtyard-combat-dimensions.mjs','apps/courtyard/courtyard-combat-presentation.mjs']
    config={'sourceVideoSha256':m['sourceVideoSha256'],'formalSpeedMetresPerSecond':speed,'formalViewMetres':constants['viewMetres'],
        'formalGroundYScale':constants['groundYScale'],'sxAt1536':sx,'syAt1536':sy,'logicalGridPerMetreX':40,
        'logicalGridPerMetreY':40*constants['groundYScale'],'logicalSpeedPxPerSecondX':logical_speed,
        'metresPer480ms':speed*.48,'displayPxPer480ms':speed*.48*sx,'sourceHeight':650,'root':[580,825],
        'footLogical':m['footLogical'],'displayScale':1536/880,'order':order,'durationMs':480,
        'timingsMs':variants,'unconstrainedFrameDurationMs':remainder,'heelAnnotations':heels,'heelPointUncertaintySourcePx':5,
        'fitScope':'horizontal annotated frame-boundary displacement only; not strict contact or continuous foot locking',
        'verticalUnits':'logical px only; ground metre conversion would divide by logicalGridPerMetreY',
        'formalVsStudy':'A continuous free-plane 3.3m/s ruler; B formal 100ms world steps and presentation remain unchanged',
        'formalPresentationSource':{'previewMetres':.045,'releaseConvergenceMs':[35,100],
            'independentMemoryProbe':{'releaseMs':243,'authorityX':20.66,'renderXAtRelease':20.511686,'renderXAt293ms':20.66,'scope':'parent-relayed independent in-memory presentation probe; not this page input latency'}},
        'sourceHashes':{str(repo/name):sha(repo/name) for name in paths},'frames':m['frames']}
    a.output.mkdir(parents=True,exist_ok=False);shutil.copyfile(a.package/'atlas.png',a.output/'atlas.png')
    (a.output/'config.json').write_text(json.dumps(config,indent=2)+'\n');(a.output/'residuals.json').write_text(json.dumps(rows,indent=2)+'\n')
    images={};font=ImageFont.load_default(size=17)
    for f in order:
        record=m['frames'][str(f)];path=a.package/record['file']
        if sha(path)!=record['sha256']:raise ValueError('Approved frame differs')
        with Image.open(path) as im:images[f]=nearest_uniform(im.convert('RGBA'),(147,147),1536/880)
    def frame_at(mode,t):
        total=0
        for f in order:
            total+=variants[mode][f]
            if t<total-1e-9:return f
        return order[-1]
    rendered=[];samples=[]
    for t in range(0,480,10):
        canvas=Image.new('RGBA',(1536,480),(235,235,230,255));draw=ImageDraw.Draw(canvas);sample={'timeMs':t}
        for lane,mode in enumerate(['equal','contact']):
            y=lane*240;ground=y+215;x_world=speed*t/1000;f=frame_at(mode,t);sample[mode]=f
            for metre in range(-12,14):
                x=round(768+(metre-x_world)*sx);draw.line((x,y+55,x,y+235),fill=(188,193,185,255));draw.text((x+3,y+218),f'{metre}m',font=font,fill=(70,80,70,255))
            for row in range(4):draw.line((0,ground-row*sy,1536,ground-row*sy),fill=(188,193,185,255))
            draw.line((0,ground,1536,ground),fill=(95,115,85,255),width=2)
            canvas.alpha_composite(images[f],(768-round(m['footLogical'][0]*1536/880),ground-round(m['footLogical'][1]*1536/880)))
            draw.text((12,y+10),f'{mode}: original frame {f}; t={t}ms /480; speed={speed}m/s; x={x_world:.3f}m',font=font,fill=(25,35,25,255))
            if f in heels:
                hx=768+(heels[f][0]-580)*source_scale*1536/880;hy=ground+(heels[f][1]-825)*source_scale*1536/880
                draw.ellipse((hx-3,hy-3,hx+3,hy+3),outline=(220,120,0,255),width=2)
        rendered.append(canvas.convert('RGB'));samples.append(sample)
    palette=rendered[0].quantize(colors=256);indexed=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in rendered]
    indexed[0].save(a.output/'equal-vs-contact.gif',save_all=True,append_images=indexed[1:],duration=10,disposal=2,optimize=False)
    rendered[0].save(a.output/'frame-000.png')
    with Image.open(a.output/'equal-vs-contact.gif') as gif:
        assert gif.n_frames==48;times=[]
        for i in range(48):gif.seek(i);times.append(gif.info['duration'])
        assert sum(times)==480 and 'loop' not in gif.info
    payload={'c':config,'atlas':'data:image/png;base64,'+base64.b64encode((a.output/'atlas.png').read_bytes()).decode(),'rows':rows}
    html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>480ms接地时长候选对照</title><style>body{font:15px system-ui;background:#202722;color:#eee;margin:20px}button,input{font:inherit;margin:6px;padding:6px}canvas{max-width:100%;image-rendering:pixelated}table{border-collapse:collapse}td,th{padding:6px 12px;border:1px solid #687269}</style><h1>等时与接地时长候选</h1><p>A：连续3.3m/s离线标尺，22m/1536画布，480ms走1.584m。40px/m仅素材逻辑网格。人物整帧固定root/scale，地面滚动；无插帧、肢体变形或逐帧偏移锁脚。</p><p>B：正式100ms世界步、.045m预显和松键35–100ms收敛仍保持；本页不是正式输入/呈现。黄色点是人工heel估计±5源px。仅水平端点拟合；纵向以逻辑px列示，持帧期间仍可滑动。</p><button id="play">播放</button><button id="reset">回到开头</button><input id="seek" aria-label="毫秒时间轴" type="range" min="0" max="479.999" step="0.1" value="0"><span id="readout"></span><canvas id="view" width="1536" height="480"></canvas><table><thead><tr><th>间隔</th><th>等时ms</th><th>候选ms</th><th>等时残差logicalpx</th><th>候选残差</th><th>纵向Δlogicalpx</th></tr></thead><tbody id="rows"></tbody></table><script>const data=@@DATA@@,$=id=>document.getElementById(id),a=new Image(),ctx=$('view').getContext('2d');let t=0,playing=false,last=null;const c=data.c;function at(mode){let sum=0;for(const f of c.order){sum+=c.timingsMs[mode][f];if(t<sum)return f}return c.order.at(-1)}function paint(){ctx.fillStyle='#ebebe6';ctx.fillRect(0,0,1536,480);ctx.imageSmoothingEnabled=false;for(const [j,mode]of ['equal','contact'].entries()){let y=j*240,g=y+215,f=at(mode),r=c.frames[f].atlasRect;ctx.strokeStyle='#bcbfb9';ctx.fillStyle='#465046';ctx.font='17px system-ui';for(let n=-12;n<14;n++){let x=768+(n-c.formalSpeedMetresPerSecond*t/1000)*c.sxAt1536;ctx.beginPath();ctx.moveTo(x,y+55);ctx.lineTo(x,y+235);ctx.stroke();ctx.fillText(n+'m',x+3,y+231)}for(let q=0;q<4;q++){ctx.beginPath();ctx.moveTo(0,g-q*c.syAt1536);ctx.lineTo(1536,g-q*c.syAt1536);ctx.stroke()}ctx.drawImage(a,...r,768-Math.round(c.footLogical[0]*c.displayScale),g-Math.round(c.footLogical[1]*c.displayScale),84*c.displayScale,84*c.displayScale);ctx.fillStyle='#192319';ctx.fillText(mode+'；原frame '+f+'；3.3m/s',12,y+28);if(c.heelAnnotations[f]){let p=c.heelAnnotations[f];ctx.strokeStyle='#dc7800';ctx.beginPath();ctx.arc(768+(p[0]-580)*58/650*c.displayScale,g+(p[1]-825)*58/650*c.displayScale,3,0,Math.PI*2);ctx.stroke()}}$('seek').value=t;$('readout').textContent=t.toFixed(1)+' /480ms'}$('rows').innerHTML=data.rows.map(r=>'<tr><td>'+r.from+'→'+r.to+'</td><td>'+r.equalDurationMs.toFixed(3)+'</td><td>'+r.contactDurationMs.toFixed(3)+'</td><td>'+r.equalResidualLogicalPx.toFixed(3)+'</td><td>'+r.contactResidualLogicalPx.toFixed(3)+'</td><td>'+r.verticalDeltaLogicalPx.toFixed(3)+'</td></tr>').join('');$('play').onclick=()=>{playing=!playing;last=null;$('play').textContent=playing?'暂停':'播放'};$('reset').onclick=()=>{t=0;playing=false;last=null;$('play').textContent='播放';paint()};$('seek').oninput=()=>{t=Number($('seek').value);playing=false;last=null;paint()};function tick(now){if(playing){if(last!==null)t=(t+now-last)%480;last=now;paint()}requestAnimationFrame(tick)}a.onload=()=>{paint();requestAnimationFrame(tick)};a.src=data.atlas;</script></html>'''.replace('@@DATA@@',json.dumps(payload).replace('<','\\u003c'))
    (a.output/'index.html').write_text(html);(a.output/'gif-samples.json').write_text(json.dumps(samples,indent=2)+'\n')
    (a.output/'checksums.json').write_text(json.dumps({p.name:sha(p) for p in sorted(a.output.iterdir()) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'gif':str(a.output/'equal-vs-contact.gif'),'html':str(a.output/'index.html'),'residuals':str(a.output/'residuals.json'),'fixedContactIntervalsMs':{str(f):fit[f] for f,_ in pairs},'other14FramesMs':remainder,'totalMs':math.fsum(fit.values())}))


if __name__=='__main__':main()
