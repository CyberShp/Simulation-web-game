"""Versioned, silent counter-and-evade extension of the offline minimum sample."""
import argparse
import json
import shutil
from pathlib import Path


def attach(out, source):
    import sys
    import numpy as np
    from PIL import Image, ImageFilter, ImageDraw
    sys.path.append('/Users/shepard/Library/Python/3.9/lib/python/site-packages')
    import cv2
    if (out/'counter-00.png').exists():
        raise RuntimeError('Source already attached; refusing to overwrite frame outputs')
    art = Path(__file__).resolve().parents[3]/'docs/art/combat-minimum-20261025'
    saved = art/'source-counter-evade.png'
    if saved.exists():
        assert saved.read_bytes() == source.read_bytes()
    else:
        shutil.copyfile(source, saved)
    im = Image.open(source).convert('RGBA');rgba = np.array(im)
    n, labels, stats, centers = cv2.connectedComponentsWithStats((rgba[:,:,3]>=8).astype('uint8'),connectivity=8)
    components = [i for i in range(1,n) if stats[i,4]>3000]
    components.sort(key=lambda i:(0 if centers[i,1]<520 else 1,centers[i,0]))
    assert len(components)==8
    roots=[(215,465),(605,465),(985,465),(1375,465),(210,935),(605,935),(990,935),(1390,945)]
    frames=[]
    for j,(component,root) in enumerate(zip(components,roots)):
        mask=Image.fromarray((labels==component).astype('uint8')*255).filter(ImageFilter.MaxFilter(7))
        pixels=rgba.copy();pixels[:,:,3]=np.where(np.asarray(mask)>0,rgba[:,:,3],0)
        x,y,w,h,_=map(int,stats[component]);box=[max(0,x-4),max(0,y-4),min(im.width,x+w+4),min(im.height,y+h+4)]
        file=f'counter-{j:02}.png';Image.fromarray(pixels).crop(box).save(out/file)
        scale=94/220 if j<4 else 58/390
        frames.append({'file':file,'sourceBox':box,'root':[root[0]-box[0],root[1]-box[1]],'scale':scale})
    config=json.loads((out/'config.json').read_text());config['enemyActions']=frames[:4];config['evadeActions']=frames[4:]
    (out/'config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')
    shutil.copyfile(Path('/Volumes/Media/immortal/docs/art/combat-motion-study-20261025/calibration/common-grid-v001/background-logical.png'),out/'background.png')
    page=(out/'index.html').read_text();start=page.index('const config=');end=page.index(';',start)
    page=page[:start]+'const config='+json.dumps(config,ensure_ascii=False)+page[end:]
    start=page.index('function createCombat(config)');end=page.index('const game=createCombat(config)',start)
    controller=Path(__file__).with_name('minimum_combat_counter_controller.mjs').read_text()
    page=page[:start]+controller.replace('export function','function',1)+'\n'+page[end:]
    page=page.replace('let bg,atlas,actions,ready=false','let bg,atlas,actions,enemy,evade,ready=false')
    page=page.replace('ctx.drawImage(bg,0,0);','ctx.drawImage(bg,0,0);\nconst ea=config.enemyActions[s.enemyFrame],ei=enemy[s.enemyFrame];ctx.drawImage(ei,600-ea.root[0]*ea.scale,245-ea.root[1]*ea.scale,ei.width*ea.scale,ei.height*ea.scale);')
    page=page.replace('练习靶（静态）','山魈 · 一轮反击')
    page=page.replace("if(s.phase==='idle'||s.phase==='attack'||s.phase==='hurt'){", "if(s.phase==='dodge'){const a=config.evadeActions[s.frame],i=evade[s.frame];ctx.drawImage(i,s.x-a.root[0]*a.scale,245-a.root[1]*a.scale,i.width*a.scale,i.height*a.scale)}\nelse if(s.phase==='idle'||s.phase==='attack'||s.phase==='hurt'){")
    old="...config.actions.map(a=>load(a.file))]).then(x=>{[bg,atlas,...actions]=x;"
    new="...config.actions.map(a=>load(a.file)),...config.enemyActions.map(a=>load(a.file)),...config.evadeActions.map(a=>load(a.file))]).then(x=>{[bg,atlas]=x;actions=x.slice(2,10);enemy=x.slice(10,14);evade=x.slice(14,18);"
    assert old in page
    page=page.replace(old,new)
    (out/'index.html').write_text(page);(out/'controller.mjs').write_text(controller)
    contact=Image.new('RGB',(1000,380),'#f3f1e8');draw=ImageDraw.Draw(contact)
    for j,a in enumerate(frames):
        pic=Image.open(out/a['file']);scale=.34 if j<4 else .35
        pic=pic.resize((round(pic.width*scale),round(pic.height*scale)),Image.Resampling.NEAREST)
        x=j%4*250+125-round(a['root'][0]*scale);y=j//4*190+175-round(a['root'][1]*scale)
        contact.paste(pic,(x,y),pic);draw.text((j%4*250+10,j//4*190+8),('COUNTER ' if j<4 else 'EVADE ')+str(j%4+1),fill='#182a25')
    contact.save(out/'counter-evade-contact.png')
    print(out/'index.html');print('eight complete components; source alpha',int(rgba[:,:,3].min()),int(rgba[:,:,3].max()))


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--output', required=True)
    p.add_argument('--attach-source', type=Path)
    args = p.parse_args()
    previous = Path('/Volumes/Media/immortal-qa/combat-minimum-20261025-v001')
    out = Path(args.output)
    if args.attach_source:
        attach(out,args.attach_source)
        return
    shutil.copytree(previous, out)
    config = json.loads((out/'config.json').read_text())
    controller = Path(__file__).with_name('minimum_combat_counter_controller.mjs').read_text()
    page = (previous/'index.html').read_text()
    start = page.index('function createCombat(config)')
    end = page.index('const game=createCombat(config)', start)
    page = page[:start] + controller.replace('export function', 'function', 1) + '\n' + page[end:]
    page = page.replace('H 受击 · R 复位','H 受击 · Space 后撤 · R 复位')
    page = page.replace("const names={idle:'待机',run:'跑动',attack:'剑击',hurt:'受击'};", "const names={idle:'待机',run:'跑动',attack:'剑击',hurt:'受击',dodge:'后撤位移'};")
    page = page.replace("if(s.phase==='attack'||s.phase==='hurt'){", "if(s.enemyStage==='warning'||s.enemyStage==='attack'){ctx.strokeStyle=s.enemyStage==='warning'?'#f0b34c':'#ff6c55';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(s.warningX,245,28,10,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.fillText(s.enemyStage==='warning'?'反击预警':'反击',s.warningX,263)}\nif(s.phase==='idle'||s.phase==='attack'||s.phase==='hurt'){")
    page = page.replace("const j=s.frame+(s.phase==='hurt'?4:0)", "const j=s.phase==='idle'?3:s.frame+(s.phase==='hurt'?4:0)")
    page = page.replace("`$\u007bnames[s.phase]} · 距靶", "`$\u007bnames[s.phase]} · 你 ${s.playerHp}/100 · 距靶")
    page = page.replace("if(e.code==='KeyJ')game.attack();", "if(e.code==='Space')game.dodge();if(e.code==='KeyJ')game.attack();")
    page = page.replace('右向离线样板 · 全无声 · 新剑击 / 受击为四帧候选', '无声离线候选 · Space 为后撤位移测试 · R 重置一轮反击')
    (out/'controller.mjs').write_text(controller)
    (out/'index.html').write_text(page)
    print(out/'index.html')


if __name__ == '__main__':
    main()
