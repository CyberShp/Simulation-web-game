"""Derive collision rows and a review overlay from the exact rendered RGBA files."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image,ImageDraw


def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);a=p.parse_args();out=a.output
    c=json.loads((out/'config.json').read_text());shapes={};threshold=64
    for sprite in [*c['enemyActions'],*c['enemySupplement']]:
        name=sprite['file'];im=Image.open(out/name).convert('RGBA');alpha=np.array(im)[:,:,3];rows=[]
        for y,line in enumerate(alpha>=threshold):
            edges=np.flatnonzero(np.diff(np.r_[False,line,False])).tolist()
            if edges:rows.append([y,*edges])
        shapes[name]={'width':im.width,'height':im.height,'threshold':threshold,'rows':rows,'sha256':hashlib.sha256((out/name).read_bytes()).hexdigest()}
    c['hitShapes']=shapes;c['lightMuzzleOffset']=[0,-24];c['lightCoreLength']=28;c['lightCoreWidth']=4
    (out/'config.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
    (out/'hit-shapes.json').write_text(json.dumps({'alphaThreshold':threshold,'space':'native sprite pixels; exact root/scale and inverse mirror','shapes':shapes},separators=(',',':'))+'\n')
    contact=Image.new('RGB',(1280,440),'#13201c');draw=ImageDraw.Draw(contact);samples=[]
    definitions=[(0,{'head':(170,320),'torso':(240,375),'foot':(245,462),'nearby clear':(205,235)}),(1,{'head':(575,265),'torso':(600,350),'arm gap':(575,120)})]
    for column,(index,mirror)in enumerate([(0,False),(0,True),(1,False),(1,True)]):
        sprite=c['enemyActions'][index];im=Image.open(out/sprite['file']).convert('RGBA');rgba=np.array(im);mask=rgba[:,:,3]>=threshold
        overlay=rgba.copy();overlay[mask,:3]=(np.array([55,220,175])*.5+rgba[mask,:3]*.5).astype('uint8');overlay=Image.fromarray(overlay)
        scale=sprite['scale']*2;overlay=overlay.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.NEAREST)
        rootx=sprite['root'][0]*scale;rooty=sprite['root'][1]*scale
        if mirror:overlay=overlay.transpose(Image.Transpose.FLIP_LEFT_RIGHT);rootx=overlay.width-rootx
        foot=(column*320+160,360);contact.paste(overlay,(round(foot[0]-rootx),round(foot[1]-rooty)),overlay)
        draw.text((column*320+12,16),('CROUCH' if index==0 else 'RAISED ARMS')+(' MIRROR' if mirror else ' SOURCE'),fill='#f4ebcf')
        draw.text((column*320+12,35),'cyan: native alpha >= 64; view 2x',fill='#9bc1ad')
        for label,point in definitions[index][1].items():
            sx=point[0]-sprite['sourceBox'][0];sy=point[1]-sprite['sourceBox'][1]
            alpha=int(rgba[sy,sx,3])if 0<=sx<im.width and 0<=sy<im.height else 0
            dx=(sx-sprite['root'][0])*sprite['scale']*(-1 if mirror else 1);dy=(sy-sprite['root'][1])*sprite['scale']
            x=foot[0]+dx*2;y=foot[1]+dy*2;color='#ffdc76'if alpha>=64 else '#ff8b9c'
            draw.ellipse((x-3,y-3,x+3,y+3),fill=color);draw.text((x+5,y-7),label,fill=color)
            samples.append({'file':sprite['file'],'mirror':mirror,'label':label,'source':[sx,sy],'offset':[dx,dy],'alpha':alpha,'body':alpha>=64})
    draw.text((12,414),'Coverage evidence only. Projectile core 28 x 4; transparent gaps and trails do not become body.',fill='#bfccbf')
    contact.save(out/'body-hit-coverage.png');(out/'hit-samples.json').write_text(json.dumps(samples,indent=2)+'\n')
    print(out/'body-hit-coverage.png');print('native masks',len(shapes),'alpha >=',threshold)


if __name__=='__main__':main()
