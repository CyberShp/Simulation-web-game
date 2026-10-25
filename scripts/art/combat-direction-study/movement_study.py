#!/usr/bin/env python3
"""Build the bounded D-only offline controller using reviewed frames and timing."""
import argparse,base64,hashlib,json,shutil,subprocess
from pathlib import Path


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--package',type=Path,required=True);p.add_argument('--timing',type=Path,required=True);p.add_argument('--phase-map',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    if a.output.exists():raise FileExistsError('Existing movement study is protected: '+str(a.output))
    m=json.loads((a.package/'manifest.json').read_text());timing=json.loads((a.timing/'config.json').read_text());mapping=json.loads((a.phase_map/'phase-map.json').read_text())
    module=Path(__file__).with_name('movement_study_controller.mjs');source=module.read_text();browser_source=source.replace('export function ','function ')
    config={'scope':'A continuous offline speed ruler; not formal 100ms physics/presentation',
        'speedMetresPerSecond':timing['formalSpeedMetresPerSecond'],'clips':m['clips'],'runOrder':timing['order'],
        'timingsMs':timing['timingsMs'],'phaseMap':{k:mapping[k] for k in ['stopEntryMap','restartEntryMap']},
        'sx':timing['sxAt1536'],'sy':timing['syAt1536'],'scale':1536/880,'footLogical':m['footLogical'],'frames':m['frames'],
        'controllerSource':str(module.resolve()),'controllerSha256':sha(module),'sourcePackageManifestSha256':sha(a.package/'manifest.json'),
        'sourceVideoSha256':m['sourceVideoSha256'],'rightDirectionOnly':True,'disabledKeys':['KeyA','KeyW','KeyS'],
        'visualGaps':{'largeJump':[58,59,48,49,50],'legRetraction':[64,65,66,56,57],'upperBodySwordChange':[51,52]},
        'formalResponseReference':timing['formalPresentationSource'],'contactFitScope':timing['fitScope']}
    a.output.mkdir(parents=True,exist_ok=False);(a.output/'config.json').write_text(json.dumps(config,indent=2)+'\n')
    shutil.copyfile(a.package/'atlas.png',a.output/'atlas.png');shutil.copyfile(a.phase_map/'phase-map.json',a.output/'phase-map.json');shutil.copyfile(a.timing/'residuals.json',a.output/'timing-residuals.json');shutil.copyfile(module,a.output/'controller.mjs')
    node='/Users/shepard/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
    js='import fs from "node:fs";import {responseMatrix,createStudyController} from '+json.dumps(module.resolve().as_uri())+';let c=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));let matrix=responseMatrix(c);let p=createStudyController(c,{timing:"contact"});p.keyDown("KeyA");p.advance(100);if(p.snapshot().xMetres!==0)throw Error("disabled direction moved");p.keyDown("KeyD");p.advance(1000);if(Math.abs(p.snapshot().xMetres-3.3)>1e-9)throw Error("speed mismatch");let x=p.snapshot().xMetres;p.blur();p.advance(200);if(p.snapshot().xMetres!==x||p.snapshot().heldD)throw Error("blur did not freeze");process.stdout.write(JSON.stringify({...matrix,disabledDirectionNoMovement:true,oneSecondDistanceMetres:3.3,blurFreezes:true}));'
    matrix=json.loads(subprocess.check_output([node,'--input-type=module','-e',js,str(a.output/'config.json')],text=True))
    (a.output/'response-matrix.json').write_text(json.dumps(matrix,indent=2)+'\n')
    payload={'c':config,'atlas':'data:image/png;base64,'+base64.b64encode((a.output/'atlas.png').read_bytes()).decode()}
    html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>D右向移动校准样板</title><style>body{font:15px system-ui;background:#202722;color:#eee;margin:20px}button,select{font:inherit;padding:6px;margin:5px}canvas{max-width:100%;image-rendering:pixelated}table{border-collapse:collapse}td,th{padding:6px 9px;border:1px solid #647266}#events{white-space:pre-wrap;max-height:180px;overflow:auto}</style><h1>D右向移动校准样板</h1><p id="status">离线可操作候选 / 待D输入UI主审；未替换正式运行</p><p>A：只启用D向右，A/W/S禁用且不镜像剑手。3.3m/s连续地面标尺，按下D立即产生位移，松开D本页位置立即冻结并切入stop；重按D可打断stop，显示在下一次RAF。无碰撞/伤害/AI模拟。</p><p>B：正式100ms世界步、.045m预显及35–100ms松键收敛仍在，本页不代表正式输入延迟。contact仅拟合5个人工水平端点，±5源px；不保证连续锁脚。19相位均立即响应，部分姿势切换有明显跳变。</p><button id="down">按下D</button><button id="up">松开D</button><button id="reset">复位</button><label>480ms时长<select id="timing"><option value="contact">contact候选（主审采用）</option><option value="equal">equal等时对照</option></select></label><p id="readout"></p><canvas id="view" width="1536" height="480"></canvas><pre id="events"></pre><h2>19相位配置检查</h2><p>每个按钮从指定原run帧即时松键，属于显式配置的离线场景；可随后重按D。程序矩阵另覆盖0/50/150ms重按，逻辑检查不等于视觉无缝。</p><table><thead><tr><th>原run</th><th>stop入口候选</th><th>入口重启候选</th><th>主审视觉边界</th><th>配置操作</th></tr></thead><tbody id="rows"></tbody></table><script>
@@CONTROLLER@@
const data=@@DATA@@,c=data.c,$=id=>document.getElementById(id),atlas=new Image(),ctx=$('view').getContext('2d');let model=createStudyController(c,{timing:'contact'}),last=performance.now(),log=[];
function advanceNow(){const now=performance.now();model.advance(Math.max(0,now-last));last=now}
function event(kind,fn){advanceNow();const before=model.snapshot(),after=fn();log.unshift(kind+': source '+before.sourceFrame+'→'+after.sourceFrame+' / '+before.phase+'→'+after.phase+' / x '+before.xMetres.toFixed(6)+'→'+after.xMetres.toFixed(6));log=log.slice(0,8);$('events').textContent=log.join('\\n');paint()}
function paint(){const s=model.snapshot(),f=c.frames[s.sourceFrame],g=360;ctx.fillStyle='#ebebe6';ctx.fillRect(0,0,1536,480);ctx.font='18px system-ui';ctx.fillStyle='#465046';ctx.strokeStyle='#bfc6bd';for(let n=Math.floor(s.xMetres)-12;n<=Math.floor(s.xMetres)+12;n++){let x=768+(n-s.xMetres)*c.sx;ctx.beginPath();ctx.moveTo(x,100);ctx.lineTo(x,440);ctx.stroke();ctx.fillText(n+'m',x+4,435)}for(let q=-1;q<7;q++){ctx.beginPath();ctx.moveTo(0,g-q*c.sy);ctx.lineTo(1536,g-q*c.sy);ctx.stroke()}ctx.imageSmoothingEnabled=false;ctx.drawImage(atlas,...f.atlasRect,768-Math.round(c.footLogical[0]*c.scale),g-Math.round(c.footLogical[1]*c.scale),84*c.scale,84*c.scale);ctx.strokeStyle='#b26b16';ctx.beginPath();ctx.moveTo(768,100);ctx.lineTo(768,445);ctx.stroke();ctx.fillStyle='#192319';ctx.fillText('1536画布/22m；root标尺线；仅右向；相机跟随标尺',16,40);$('readout').textContent='D='+s.heldD+'；'+s.phase+' / source '+s.sourceFrame+'；x='+s.xMetres.toFixed(6)+'m；标尺速度='+s.speedMetresPerSecond.toFixed(1)+'m/s；'+s.timing;}
function down(){event('keydown D',()=>model.keyDown('KeyD'))}function up(){event('keyup D',()=>model.keyUp('KeyD'))}$('down').onclick=down;$('up').onclick=up;$('reset').onclick=()=>event('reset',()=>model.reset());$('timing').onchange=()=>{model=createStudyController(c,{timing:$('timing').value});last=performance.now();event('timing reset',()=>model.snapshot())};window.addEventListener('keydown',e=>{if(e.code==='KeyD'){e.preventDefault();down()}else if(['KeyA','KeyW','KeyS'].includes(e.code)){e.preventDefault();event('disabled '+e.code,()=>model.keyDown(e.code))}});window.addEventListener('keyup',e=>{if(e.code==='KeyD'){e.preventDefault();up()}});window.addEventListener('blur',()=>event('blur',()=>model.blur()));
function note(f){if(c.visualGaps.largeJump.includes(f))return '腾空/大跨步→站腿明显跳变';if(c.visualGaps.legRetraction.includes(f))return '腿位收缩可见';if(c.visualGaps.upperBodySwordChange.includes(f))return '上身/剑角变化可见';return [60,61,62,63].includes(f)?'双帧较近，动态仍需看':'动态仍需看'}
$('rows').innerHTML=c.runOrder.map(f=>{let stop=c.phaseMap.stopEntryMap[f],r=c.phaseMap.restartEntryMap[stop];return '<tr><td>'+f+'</td><td>'+stop+'</td><td>'+r.clip+' '+r.sourceFrame+'</td><td>'+note(f)+'</td><td><button data-source="'+f+'">从'+f+'即时松键</button></td></tr>'}).join('');for(const button of document.querySelectorAll('[data-source]'))button.onclick=()=>event('configured run '+button.dataset.source+' release',()=>{model.fixtureRun(Number(button.dataset.source));return model.keyUp('KeyD')});function tick(){advanceNow();paint();requestAnimationFrame(tick)}atlas.onload=()=>{paint();requestAnimationFrame(tick)};atlas.src=data.atlas;
</script></html>'''.replace('@@CONTROLLER@@',browser_source).replace('@@DATA@@',json.dumps(payload).replace('<','\\u003c'))
    (a.output/'index.html').write_text(html)
    (a.output/'source-evidence.json').write_text(json.dumps({'formalParameterSnapshot':timing,
        'sourcePackage':str(a.package),'sourcePackageManifestSha256':sha(a.package/'manifest.json'),
        'scope':'55 B03/B04 and SR007/013 local offline study; no runtime registry, world or save change'},indent=2)+'\n')
    (a.output/'checksums.json').write_text(json.dumps({p.name:sha(p) for p in sorted(a.output.iterdir()) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'html':str(a.output/'index.html'),'pureController':str(a.output/'controller.mjs'),
        'config':str(a.output/'config.json'),'matrix':str(a.output/'response-matrix.json'),'cases':matrix['caseCount'],'allPassed':matrix['allPassed']}))


if __name__=='__main__':main()
