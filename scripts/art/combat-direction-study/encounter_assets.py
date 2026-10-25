"""Register complete RGBA connected sprites at one author-specified scale."""
import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--kind',choices=['player','enemy'],required=True);p.add_argument('--roots');p.add_argument('--scale',type=float);args=p.parse_args()
    sys.path.append('/Users/shepard/Library/Python/3.9/lib/python/site-packages')
    import cv2
    out=args.output;repo=Path(__file__).resolve().parents[3];art=repo/'docs/art/combat-encounter-20261026';art.mkdir(parents=True,exist_ok=True)
    saved=art/('source-beast.png' if args.kind=='enemy' else 'source-player.png')
    if saved.exists():assert saved.read_bytes()==args.source.read_bytes(),'Existing source differs'
    else:shutil.copyfile(args.source,saved)
    if (out/f'{args.kind}-00.png').exists():raise RuntimeError('Registered output exists; refusing overwrite')
    im=Image.open(saved).convert('RGBA');rgba=np.array(im)
    n,labels,stats,centers=cv2.connectedComponentsWithStats((rgba[:,:,3]>=8).astype('uint8'),connectivity=8)
    components=[i for i in range(1,n)if stats[i,4]>1500]
    if args.kind=='player':
        assert len(components)==16
        components.sort(key=lambda i:(int(centers[i,1]//300),centers[i,0]))
        roots=[(185,296),(505,296),(830,296),(1165,296),(165,580),(495,580),(825,580),(1155,580),(160,870),(495,870),(825,870),(1155,870),(180,1170),(475,1170),(810,1170),(1190,1170)]
        scale=58/275
    else:
        roots=json.loads(args.roots);scale=args.scale;assert len(components)==len(roots)
        components.sort(key=lambda i:(int(centers[i,1]//(im.height/2)),centers[i,0]))
    frames=[]
    for j,(component,root)in enumerate(zip(components,roots)):
        support=Image.fromarray((labels==component).astype('uint8')*255).filter(ImageFilter.MaxFilter(7))
        pixels=rgba.copy();pixels[:,:,3]=np.where(np.asarray(support)>0,rgba[:,:,3],0)
        x,y,w,h,_=map(int,stats[component]);box=[max(0,x-4),max(0,y-4),min(im.width,x+w+4),min(im.height,y+h+4)]
        file=f'{args.kind}-{j:02}.png';Image.fromarray(pixels).crop(box).save(out/file)
        frames.append({'file':file,'sourceBox':box,'root':[root[0]-box[0],root[1]-box[1]],'scale':scale})
    config=json.loads((out/'config.json').read_text())
    if args.kind=='player':config['directional']={'right':{'attack':frames[:4]},'left':{'attack':frames[:4]},'up':{'run':frames[4:8],'attack':frames[12:14]},'down':{'run':frames[8:12],'attack':frames[14:16]}}
    else:config['enemySupplement']=frames
    (out/'config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')
    page=(out/'index.html').read_text();a=page.index('const config=');b=page.index(';',a);page=page[:a]+'const config='+json.dumps(config,ensure_ascii=False)+page[b:]
    if args.kind=='player':page=page.replace('无声离线候选 · 侧向整帧可镜像','无声离线候选 · 上下攻击各2帧粗样 · 左右整帧镜像')
    (out/'index.html').write_text(page)
    record={'source':str(saved),'sha256':hashlib.sha256(saved.read_bytes()).hexdigest(),'sourceSize':im.size,'scale':scale,'frames':frames}
    (out/f'{args.kind}-registration.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    rows=(len(frames)+3)//4;contact=Image.new('RGB',(1000,rows*180),'#f3f1e8');draw=ImageDraw.Draw(contact)
    for j,a in enumerate(frames):
        pic=Image.open(out/a['file']);s=.45;pic=pic.resize((round(pic.width*s),round(pic.height*s)),Image.Resampling.NEAREST)
        contact.paste(pic,(j%4*250+125-round(a['root'][0]*s),j//4*180+166-round(a['root'][1]*s)),pic);draw.text((j%4*250+8,j//4*180+7),f'{args.kind} {j:02}',fill='#14251b')
    contact.save(out/f'{args.kind}-contact.png')
    print(out/'index.html');print('registered complete components',len(frames),'scale',scale)


if __name__=='__main__':main()
