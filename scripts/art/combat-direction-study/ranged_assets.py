"""Complete-component registration for the cast and diagonal attack source sheet."""
import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image,ImageDraw,ImageFilter


def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    sys.path.append('/Users/shepard/Library/Python/3.9/lib/python/site-packages');import cv2
    out=a.output;art=Path(__file__).resolve().parents[3]/'docs/art/combat-ranged-20261026';art.mkdir(parents=True,exist_ok=True);saved=art/'source-cast.png'
    if saved.exists():assert saved.read_bytes()==a.source.read_bytes()
    else:shutil.copyfile(a.source,saved)
    if (out/'cast-00.png').exists():raise RuntimeError('Registered output exists')
    im=Image.open(saved).convert('RGBA');rgba=np.array(im);n,labels,stats,centers=cv2.connectedComponentsWithStats((rgba[:,:,3]>=8).astype('uint8'),connectivity=8)
    components=[i for i in range(1,n)if stats[i,4]>1500];assert len(components)==16;components.sort(key=lambda i:(int(centers[i,1]//300),centers[i,0]))
    roots=[(180,315),(500,315),(810,315),(1160,315),(160,620),(500,620),(810,620),(1160,620),(160,910),(495,910),(805,910),(1160,910),(160,1180),(490,1180),(805,1180),(1180,1180)];frames=[]
    for j,(component,root)in enumerate(zip(components,roots)):
        support=Image.fromarray((labels==component).astype('uint8')*255).filter(ImageFilter.MaxFilter(7));pixels=rgba.copy();pixels[:,:,3]=np.where(np.array(support)>0,rgba[:,:,3],0)
        x,y,w,h,_=map(int,stats[component]);box=[max(0,x-4),max(0,y-4),min(im.width,x+w+4),min(im.height,y+h+4)];file=f'cast-{j:02}.png';Image.fromarray(pixels).crop(box).save(out/file)
        frames.append({'file':file,'sourceBox':box,'root':[root[0]-box[0],root[1]-box[1]],'scale':58/275})
    c=json.loads((out/'config.json').read_text());c['heavyDirectional']={'right':frames[:4],'left':frames[:4],'up':frames[4:8],'down':frames[8:12]}
    for key,group in [('ne',frames[12:14]),('nw',frames[12:14]),('se',frames[14:16]),('sw',frames[14:16])]:c['directional'][key]={'attack':group}
    (out/'config.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
    record={'source':str(saved),'sha256':hashlib.sha256(saved.read_bytes()).hexdigest(),'scale':58/275,'frames':frames};(out/'cast-registration.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    contact=Image.new('RGB',(1000,720),'#f3f1e8');draw=ImageDraw.Draw(contact)
    for j,f in enumerate(frames):
        pic=Image.open(out/f['file']);s=.45;pic=pic.resize((round(pic.width*s),round(pic.height*s)),Image.Resampling.NEAREST);contact.paste(pic,(j%4*250+125-round(f['root'][0]*s),j//4*180+166-round(f['root'][1]*s)),pic);draw.text((j%4*250+8,j//4*180+7),f'cast {j:02}',fill='#14251b')
    contact.save(out/'cast-contact.png');print(out/'cast-contact.png')


if __name__=='__main__':main()
