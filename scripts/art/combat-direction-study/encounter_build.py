"""Build the standalone encounter using complete, registered offline source frames."""
import argparse
import json
import shutil
from pathlib import Path


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);parser.add_argument('--refresh-page',action='store_true');args=parser.parse_args()
    out=Path(args.output)
    if args.refresh_page:config=json.loads((out/'config.json').read_text())
    else:
        out.mkdir(parents=True,exist_ok=False)
        previous=Path('/Volumes/Media/immortal-qa/combat-minimum-20261025-v002')
        config=json.loads((previous/'config.json').read_text());config['directional']={}
        files=['background.png','movement-atlas.png']+[a['file'] for key in ['actions','enemyActions','evadeActions'] for a in config[key]]
        for file in files:shutil.copyfile(previous/file,out/file)
    config.update({'speed':132,'range':120,'pixelsPerMeter':40,'enemyHp':200,'walkPolygon':[[300,205],[670,175],[765,285],[700,415],[500,520],[300,485],[150,355],[180,260]]})
    (out/'config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')
    controller=Path(__file__).with_name('encounter_controller.mjs').read_text();(out/'controller.mjs').write_text(controller)
    (out/'index.html').write_text(HTML.replace('__CONFIG__',json.dumps(config,ensure_ascii=False)).replace('__CONTROLLER__',controller.replace('export function','function',1)))
    print(out/'index.html')


HTML=r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>林间遭遇</title><style>*{box-sizing:border-box}body{margin:0;background:#14211c;color:#eee6d0;font:14px system-ui}main{max-width:1400px;margin:auto;padding:16px}header,footer{display:flex;justify-content:space-between;align-items:center;gap:20px}header{margin-bottom:10px}h1{font:600 21px Georgia,serif;margin:0}p{margin:4px 0;color:#bdc8b8;font-size:13px}button{background:#334b3b;border:1px solid #71836b;color:#f7edd2;padding:9px 16px;border-radius:5px;cursor:pointer}canvas{display:block;width:auto;height:auto;max-width:100%;max-height:calc(100vh - 155px);object-fit:contain;margin:auto;image-rendering:pixelated;border:1px solid #647358;outline:none}footer{margin-top:10px}small{color:#a8b6a3}#hud{font-variant-numeric:tabular-nums}</style><main><header><div><h1>林间遭遇</h1><p>WASD 走位 · 鼠标瞄准 · 左键 / J 移动出剑 · Space 闪避 · R 重来</p></div><button id="reset">重新交手 R</button></header><canvas width="880" height="587" tabindex="0" aria-label="林间短战斗离线样板"></canvas><footer><span id="hud">加载素材…</span><small id="scope">移动中可出剑 · 出手时锁定瞄准方向</small></footer></main><script>
const config=__CONFIG__;
__CONTROLLER__
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),hud=document.querySelector('#hud'),game=createEncounter(config);ctx.imageSmoothingEnabled=false;
let ready=false,bg,atlas,assets={},last=performance.now();const names={idle:'待机',run:'走位',attack:'出剑',dodge:'闪避',hurt:'受击',down:'败退',chase:'追近',warning:'预警',recover:'收势',dead:'倒下'};
const load=file=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=file});
function blit(a,pos,mirror){const i=assets[a.file];ctx.save();ctx.translate(pos.x,pos.y);ctx.scale(mirror?-1:1,1);ctx.drawImage(i,-a.root[0]*a.scale,-a.root[1]*a.scale,i.width*a.scale,i.height*a.scale);ctx.restore()}
function runCell(p){const r=config.frames[String(p.frame)].atlasRect;ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.mirror?-1:1,1);ctx.drawImage(atlas,...r,-config.movementRoot[0],-config.movementRoot[1],84,84);ctx.restore()}
function playerArt(p){const d=config.directional[p.direction];
 if(p.phase==='attack'){const list=d?.attack||config.actions.slice(0,4);blit(list[Math.min(list.length-1,Math.floor(p.time/(400/list.length)))],p,p.direction==='left');}
 else if(p.phase==='dodge')blit(config.evadeActions[p.frame],p,p.mirror);
 else if(p.phase==='hurt'||p.phase==='down')blit(config.actions[4+p.frame],p,p.mirror);
 else if(p.phase==='run'&&d?.run){const i=Math.floor((p.runTime%480)/(480/d.run.length));blit(d.run[i],p,false);}
 else if(p.phase==='idle'&&d?.run)blit(d.run[1]||d.run[0],p,false);
 else if(p.phase==='run')runCell(p);else blit(config.actions[3],p,p.mirror);
}
function draw(){if(!ready)return;const s=game.snapshot(),p=s.player,e=s.enemy;ctx.clearRect(0,0,880,587);ctx.drawImage(bg,0,0);
 if(e.stage==='warning'||e.stage==='attack'||e.stage==='hurt'&&e.resume==='warning'){ctx.strokeStyle=e.stage==='attack'?'#fc795a':'#f4bd59';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.lock.x,e.lock.y,32,15,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.textAlign='center';ctx.font='12px system-ui';ctx.fillText('落拳范围',e.lock.x,e.lock.y+30);}
 const enemyArt=()=>blit(e.poseSet==='supplement'&&config.enemySupplement?config.enemySupplement[e.frame]:config.enemyActions[Math.min(3,e.frame)],e,e.mirror);if(e.y<=p.y){enemyArt();playerArt(p)}else{playerArt(p);enemyArt()}
 const bar=(x,y,hp,label,color,max=100)=>{ctx.fillStyle='#15271bd9';ctx.fillRect(x-45,y-18,90,28);ctx.fillStyle='#f4ebcf';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(label,x,y-7);ctx.fillStyle='#34432f';ctx.fillRect(x-35,y,70,5);ctx.fillStyle=color;ctx.fillRect(x-35,y,70*hp/max,5)};
 bar(p.x,p.y-79,p.hp,'掌门','#b7cf8a');bar(e.x,e.y-112,e.hp,'山魈','#d79467',config.enemyHp);
 if(s.outcome==='running'){const a=p.phase==='attack'?p.attackAim:p.aim;ctx.strokeStyle='#f1df9966';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(p.x,p.y-18);ctx.lineTo(p.x+a.x*70,p.y-18+a.y*70);ctx.stroke();ctx.setLineDash([]);}
 if(p.flash>0||e.flash>0){ctx.fillStyle='#ffe1a0';ctx.font='bold 17px system-ui';ctx.textAlign='center';if(p.flash>0)ctx.fillText('−20',p.x,p.y-100);if(e.flash>0)ctx.fillText('−25',e.x,e.y-135)}
 if(s.outcome!=='running'){ctx.fillStyle='#13201dde';ctx.fillRect(285,40,310,90);ctx.textAlign='center';ctx.fillStyle='#f2e2bd';ctx.font='bold 27px Georgia';ctx.fillText(s.outcome==='ready'?'准备交手':s.outcome==='victory'?'山魈已败':'暂且败退',440,77);ctx.font='14px system-ui';ctx.fillText(s.outcome==='ready'?'按 WASD 或出剑开始':'R 重新交手',440,107)}
 const last=s.events.at(-1)?.type;hud.textContent=`你 ${p.hp} / 山魈 ${e.hp}　${names[p.phase]} · ${e.stage==='attack'?'出拳':names[e.stage]||e.stage}　命中 ${p.hits}${last==='evaded'?' · 躲开落拳':''}`;
}
function reset(){game.reset();canvas.focus({preventScroll:true});draw()}document.querySelector('#reset').onclick=reset;
window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','KeyJ','KeyR','Space'].includes(e.code))e.preventDefault();if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code))game.key(e.code,true);if(e.repeat)return;if(e.code==='KeyJ')game.attack();if(e.code==='Space')game.dodge();if(e.code==='KeyR')reset()});
window.addEventListener('keyup',e=>game.key(e.code,false));window.addEventListener('blur',()=>game.blur());
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();game.aim((e.clientX-r.left)*880/r.width,(e.clientY-r.top)*587/r.height)});canvas.addEventListener('pointerdown',e=>{if(e.button===0){const r=canvas.getBoundingClientRect();game.aim((e.clientX-r.left)*880/r.width,(e.clientY-r.top)*587/r.height);game.attack();canvas.focus({preventScroll:true});e.preventDefault()}});
const files=[...new Set([...config.actions,...config.enemyActions,...config.evadeActions,...(config.enemySupplement||[]),...Object.values(config.directional).flatMap(d=>[...(d.run||[]),...(d.attack||[])])].map(a=>a.file))];
Promise.all([load('background.png'),load('movement-atlas.png'),...files.map(load)]).then(x=>{[bg,atlas]=x;files.forEach((f,i)=>assets[f]=x[i+2]);ready=true;canvas.focus({preventScroll:true});draw()}).catch(e=>hud.textContent='素材加载失败：'+e);
function tick(now){const dt=now-last;last=now;game.advance(Math.min(dt,100));draw();requestAnimationFrame(tick)}requestAnimationFrame(tick);window.encounterSample={game,config,draw};
</script></html>'''


if __name__=='__main__':main()
