"""Build the ranged fixture from the preserved encounter assets and frame renderer."""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--refresh-page',action='store_true');a=p.parse_args()
    previous=Path('/Volumes/Media/immortal-qa/combat-encounter-20261026-v001');out=a.output
    if a.refresh_page:config=json.loads((out/'config.json').read_text())
    else:
        base=Path('/Volumes/Media/immortal-qa/combat-ranged-20261026-v001')
        if not base.exists():base=previous
        out.mkdir(parents=True,exist_ok=False);config=json.loads((base/'config.json').read_text())
        frames=[*config['actions'],*config['enemyActions'],*config['evadeActions'],*config['enemySupplement']]
        frames.extend(f for d in config['directional'].values() for group in d.values() for f in group)
        frames.extend(f for group in config.get('heavyDirectional',{}).values() for f in group)
        for file in {'background.png','movement-atlas.png',*(f['file'] for f in frames)}:shutil.copyfile(base/file,out/file)
    config.update({'projectileSpeed':480,'projectileRange':320})
    config.pop('enemyHitRadius',None)
    (out/'config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')
    if not config.get('hitShapes'):
        subprocess.run([sys.executable,str(Path(__file__).with_name('ranged_hit_shapes.py')),'--output',str(out)],check=True)
        config=json.loads((out/'config.json').read_text())
    page=(previous/'index.html').read_text();start=page.index('const config=');end=page.index(';',start);page=page[:start]+'const config='+json.dumps(config,ensure_ascii=False)+page[end:]
    start=page.index('const unit =');end=page.index('const canvas=document',start)
    controller=Path(__file__).with_name('ranged_controller.mjs').read_text()
    geometry=Path(__file__).with_name('ranged_hit_shapes.mjs').read_text()
    inline='\n'.join(line for line in controller.splitlines() if not line.startswith('import '))
    page=page[:start]+geometry.replace('export ','')+'\n'+inline.replace('export ','')+'\n'+page[end:]
    (out/'ranged_hit_shapes.mjs').write_text(geometry)
    page=page.replace('createEncounter(config)','createRanged(config)').replace('window.encounterSample','window.rangedSample')
    page=page.replace('林间遭遇','剑气交手').replace('左键 / J 移动出剑 · Space 闪避','左键 / J 剑气 · Q 落剑 · Space 闪避')
    page=page.replace("attack:'出剑',dodge", "attack:'出剑',heavy:'Q蓄势',dodge")
    page=page.replace("if(p.phase==='attack'){", "if(p.phase==='heavy'||p.releasePoseMs>0&&p.phase==='idle'){const key=Math.abs(p.heavyAim.x)>=Math.abs(p.heavyAim.y)?(p.heavyAim.x>=0?'right':'left'):(p.heavyAim.y>=0?'down':'up');const list=config.heavyDirectional?.[key]||config.directional[key]?.attack||config.actions.slice(0,4);const i=p.phase==='heavy'?Math.min(1,Math.floor(p.time/130)):2+Math.min(1,Math.floor((80-p.releasePoseMs)/40));blit(list[Math.min(list.length-1,i)],p,key==='left');}\n else if(p.phase==='attack'){")
    page=page.replace("p,p.direction==='left');", "p,['left','nw','sw'].includes(p.direction));")
    page=page.replace("ctx.drawImage(bg,0,0);", "ctx.save();if(s.shakeMs>0)ctx.translate(Math.sin((80-s.shakeMs)*.5)*2,Math.cos((80-s.shakeMs)*.7));ctx.drawImage(bg,0,0);")
    page=page.replace("const enemyArt=()=>blit(", "const enemyArt=()=>{ctx.save();if(e.flash>0)ctx.filter=e.hitKind==='heavy'?'brightness(1.9) saturate(.75)':'brightness(1.55) saturate(.8)';blit(")
    page=page.replace("e,e.mirror);if(e.y<=p.y)", "e,e.mirror);ctx.restore()};if(e.y<=p.y)")
    page=page.replace("const bar=(x,y,hp,label,color,max=100)=>", "drawEffects(s);const bar=(x,y,hp,label,color,max=100)=>")
    page=page.replace("p.phase==='attack'?p.attackAim:p.aim", "p.phase==='attack'?p.attackAim:p.phase==='heavy'?p.heavyAim:p.aim")
    page=page.replace("ctx.moveTo(p.x,p.y-18);ctx.lineTo(p.x+a.x*70,p.y-18+a.y*70)", "const o=p.phase==='heavy'?p:s.muzzle;ctx.moveTo(o.x,o.y);ctx.lineTo(o.x+a.x*70,o.y+a.y*70)")
    page=page.replace("ctx.fillText('−25',e.x,e.y-135)", "ctx.fillText(e.hitKind==='heavy'?'−55':'−25',e.x,e.y-135)")
    page=page.replace("const last=s.events.at(-1)?.type;", "ctx.restore();const last=s.events.at(-1)?.type;")
    page=page.replace("命中 ${p.hits}", "命中 ${p.hits} · Q ${p.heavyCooldown>0?(p.heavyCooldown/1000).toFixed(1)+'s':'可用'}")
    page=page.replace("'KeyJ','KeyR','Space'", "'KeyJ','KeyQ','KeyR','Space'")
    page=page.replace("if(e.code==='KeyJ')game.attack();", "if(e.code==='KeyJ')game.attack();if(e.code==='KeyQ')game.heavy();")
    page=page.replace("...config.evadeActions,...(config.enemySupplement||[]),", "...config.evadeActions,...(config.enemySupplement||[]),...Object.values(config.heavyDirectional||{}).flat(),")
    page=page.replace("移动中可出剑 · 出手时锁定瞄准方向", "剑气可移动 · Q蓄力260ms · Space可接续")
    page=page.replace("function reset(){", EFFECTS+'\nfunction reset(){')
    audio_path=Path(__file__).with_name('ranged_audio.mjs')
    data_path=Path(__file__).resolve().parents[3]/'docs/art/combat-ranged-20261026/audio/audio-data.json'
    if audio_path.exists() and data_path.exists():
        audio_source=audio_path.read_text();audio_data=json.loads(data_path.read_text())
        code='const AUDIO_DATA='+json.dumps(audio_data,separators=(',',':'))+';\n'+audio_source.replace('export ','')+'\nconst audio=createRangedAudio({assets:AUDIO_DATA,volume:.35});\n'
        page=page.replace('const canvas=document',code+'const canvas=document',1)
        page=page.replace('ctx.imageSmoothingEnabled=false;','ctx.imageSmoothingEnabled=false;audio.sync(game.snapshot());',1)
        page=page.replace('function reset(){game.reset();','function reset(){void audio.unlock();game.reset();audio.reset(game.snapshot().epoch);')
        page=page.replace("window.addEventListener('keydown',e=>{", "window.addEventListener('keydown',e=>{void audio.unlock();",1)
        page=page.replace("canvas.addEventListener('pointerdown',e=>{if(e.button===0){", "canvas.addEventListener('pointerdown',e=>{if(e.button===0){void audio.unlock();",1)
        page=page.replace('game.advance(Math.min(dt,100));draw();','game.advance(Math.min(dt,100));audio.sync(game.snapshot());draw();')
        page=page.replace('<button id="reset">重新交手 R</button>','<div style="display:flex;align-items:center;gap:10px"><button id="mute" aria-pressed="false">音效 开</button><input id="volume" type="range" min="0" max="100" value="35" aria-label="音量" style="width:80px"><button id="reset">重新交手 R</button></div>')
        controls="const mute=document.querySelector('#mute');mute.onclick=()=>{void audio.unlock();const s=audio.setMuted(!audio.status().muted);mute.textContent=s.muted?'音效 关':'音效 开';mute.setAttribute('aria-pressed',String(s.muted))};document.querySelector('#volume').oninput=e=>{void audio.unlock();audio.setVolume(Number(e.target.value)/100)};\n"
        page=page.replace('function tick(now){',controls+'function tick(now){')
        page=page.replace('window.rangedSample={game,config,draw};','window.rangedSample={game,config,draw,audio};')
        (out/'ranged_audio.mjs').write_text(audio_source);(out/'audio-data.json').write_text(json.dumps(audio_data,separators=(',',':'))+'\n')
    (out/'controller.mjs').write_text(controller);(out/'index.html').write_text(page);print(out/'index.html')


EFFECTS=r'''function drawEffects(s){
 const p=s.player;const target=(t,alpha=1)=>{ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#77dfd1';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(t.x,t.y,44,22,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#e6cd77';ctx.beginPath();ctx.moveTo(t.x-7,t.y);ctx.lineTo(t.x+7,t.y);ctx.moveTo(t.x,t.y-4);ctx.lineTo(t.x,t.y+4);ctx.stroke();ctx.restore()};
 if(p.phase==='heavy'&&p.heavyTarget)target(p.heavyTarget);
 for(const q of s.groundStrikes){target(q.target,.8);const bottom=q.target.y-(q.remainingMs/120)*70;ctx.strokeStyle='#f2da87';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(q.target.x,bottom-27);ctx.lineTo(q.target.x,bottom);ctx.stroke();ctx.strokeStyle='#8cf5e5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(q.target.x-5,bottom-20);ctx.lineTo(q.target.x+5,bottom-20);ctx.stroke()}
 for(const q of s.projectiles){ctx.save();ctx.translate(q.x,q.y);ctx.rotate(Math.atan2(q.dy,q.dx));ctx.strokeStyle='#5ce5e077';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-25,0);ctx.lineTo(-15,0);ctx.stroke();ctx.strokeStyle='#b9fff1';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(12,0);ctx.stroke();ctx.strokeStyle='#f4fff0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(12,0);ctx.stroke();ctx.restore()}
 for(const b of s.groundBursts){ctx.save();ctx.globalAlpha=b.remainingMs/140;ctx.strokeStyle=b.hit?'#edce72':'#72b7ab';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(b.x,b.y,15,7,0,0,Math.PI*2);ctx.moveTo(b.x,b.y-23);ctx.lineTo(b.x,b.y);ctx.moveTo(b.x-6,b.y-17);ctx.lineTo(b.x+6,b.y-17);ctx.stroke();for(let j=0;j<4;j++){const a=j*Math.PI/2;ctx.fillStyle='#b8c9a1';ctx.fillRect(b.x+Math.cos(a)*20,b.y+Math.sin(a)*7,2,1)}ctx.restore()}
 for(const i of s.impacts){const big=i.kind==='heavy',life=big?120:80,alpha=i.remainingMs/life,r=big?21:12;ctx.save();ctx.translate(i.x,i.visiblePoint?i.y:i.y-34);ctx.globalAlpha=alpha;ctx.strokeStyle=big?'#f8df8a':'#aaf9e6';ctx.lineWidth=big?2:1;for(let j=0;j<(big?8:5);j++){const a=j*Math.PI*2/(big?8:5);ctx.beginPath();ctx.moveTo(Math.cos(a)*3,Math.sin(a)*3);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r*.75);ctx.stroke()}ctx.fillStyle='#fff7d4';ctx.fillRect(-2,-2,4,4);ctx.restore()}
}'''


if __name__=='__main__':main()
