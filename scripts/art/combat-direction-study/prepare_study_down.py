"""Inspect/crop three existing RGBA poses; explicit shared adult ruler and roots.

Run without --spec for connected-component inventory. A spec supplies one
sourceHeight and three semantic global roots; it never scales by pose bbox.
This tool produces review candidates only and does not register runtime data.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--spec',type=Path);args=p.parse_args()
    sys.path.append('/Users/shepard/Library/Python/3.9/lib/python/site-packages')
    import cv2
    cv2.setNumThreads(1)
    if args.output.exists():raise RuntimeError('Existing output; choose a new review directory')
    args.output.mkdir(parents=True)
    image=Image.open(args.source).convert('RGBA');rgba=np.array(image);alpha=rgba[:,:,3]
    count,labels,stats,centres=cv2.connectedComponentsWithStats((alpha>=8).astype('uint8'),connectivity=8)
    components=sorted(range(1,count),key=lambda i:int(stats[i,4]),reverse=True)
    inventory=[{'component':i,'box':list(map(int,stats[i,:4])),'area':int(stats[i,4]),'centre':list(map(float,centres[i]))}for i in components if stats[i,4]>=16]
    record={'source':str(args.source.resolve()),'sha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),'sourceSize':image.size,'alphaRange':[int(alpha.min()),int(alpha.max())],'components':inventory}
    (args.output/'components.json').write_text(json.dumps(record,indent=2)+'\n')
    annotated=Image.new('RGBA',image.size,'#e9e8e2');annotated.alpha_composite(image);draw=ImageDraw.Draw(annotated)
    for entry in inventory[:12]:
        x,y,w,h=entry['box'];draw.rectangle((x,y,x+w,y+h),outline='#c34b37',width=2);draw.text((x,y),str(entry['component']),fill='#c34b37')
    annotated.convert('RGB').save(args.output/'components.png')
    if not args.spec:print(args.output/'components.png');return
    spec=json.loads(args.spec.read_text());source_height=spec['sourceHeight'];poses=spec['frames']
    if not source_height>0 or len(poses)!=3:raise ValueError('One positive adult sourceHeight and three semantic roots required')
    primary=[]
    for pose in poses:
        sx,sy=pose['bodySeed'];component=int(labels[sy,sx])
        if component==0 or component in primary:raise ValueError('Each bodySeed must lie in a different complete primary component')
        primary.append(component)
    # Whole connected components retain ownership even when a sword crosses a
    # nominal cell. Small detached components go to their nearest primary body.
    distances=np.stack([cv2.distanceTransform((labels!=i).astype('uint8'),cv2.DIST_L2,cv2.DIST_MASK_PRECISE)for i in primary])
    ownership=np.full(alpha.shape,-1,dtype='int8')
    for component in components:
        x,y,w,h=map(int,stats[component,:4]);region=np.s_[y:y+h,x:x+w];mask=labels[region]==component
        owner=primary.index(component)if component in primary else int(np.argmin([d[region][mask].min()for d in distances]))
        ownership[region][mask]=owner
    # Preserve original faint boundary pixels; the alpha8 threshold only finds
    # groups. No retained source RGB or alpha is recoloured or thresholded.
    group_dist=np.stack([cv2.distanceTransform((ownership!=i).astype('uint8'),cv2.DIST_L2,cv2.DIST_MASK_PRECISE)for i in range(3)])
    faint=(alpha>0)&(alpha<8);ownership[faint]=np.argmin(group_dist,axis=0)[faint]
    frames=[]
    for i,pose in enumerate(poses):
        keep=(ownership==i)&(alpha>0);ys,xs=np.where(keep);box=[int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1]
        x0,y0,x1,y1=box;pixels=rgba[y0:y1,x0:x1].copy();pixels[:,:,3]=np.where(keep[y0:y1,x0:x1],pixels[:,:,3],0)
        if not np.array_equal(pixels[:,:,:3],rgba[y0:y1,x0:x1,:3]):raise AssertionError('Source RGB changed')
        native=Image.fromarray(pixels);name=f'down-{i:02}.png';native.save(args.output/name);root=[pose['root'][0]-x0,pose['root'][1]-y0]
        scale=58/source_height;logical=native.resize((max(1,round(native.width*scale)),max(1,round(native.height*scale))),Image.Resampling.BOX);logical_name=f'down-{i:02}-logical.png';logical.save(args.output/logical_name)
        frames.append({'label':pose['label'],'file':name,'logicalFile':logical_name,'sourceBox':box,'sourceRoot':pose['root'],'root':root,'logicalRoot':[v*scale for v in root],'primaryComponent':primary[i],'nativeRgbExact':True,'sha256':hashlib.sha256((args.output/name).read_bytes()).hexdigest(),'logicalSha256':hashlib.sha256((args.output/logical_name).read_bytes()).hexdigest()})
    repo=Path(__file__).resolve().parents[3];data=json.loads((repo/'src/simulation/ea-combat-sword-study-data.mjs').read_text().split('=',1)[1].strip().removesuffix(';'));idle=data['frames']['action-03']
    font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16);contact=Image.new('RGB',(1536,730),'#22332b');draw=ImageDraw.Draw(contact)
    draw.text((12,8),f'1.45m adult ruler, fixed source H={source_height}; semantic roots; native row / common BOX58 row (2x)',font=font,fill='white')
    for row in range(2):
        foot=265 if row==0 else 680;multiple=1 if row==0 else 2
        for col,frame in enumerate([None,*frames]):
            if frame is None:pic=Image.open(repo/'assets/courtyard'/idle['file']);root=idle['root'];height=idle['sourceHeight'];label='current action-03 (unchanged)'
            else:pic=Image.open(args.output/(frame['file']if row==0 else frame['logicalFile']));root=frame['root']if row==0 else frame['logicalRoot'];height=source_height if row==0 else 58;label=frame['label']
            k=101.23636363636363*multiple/height;pic=pic.resize((round(pic.width*k),round(pic.height*k)),Image.Resampling.NEAREST);x=col*384;contact.paste(pic,(round(x+192-root[0]*k),round(foot-root[1]*k)),pic);draw.line((x+8,foot,x+376,foot),fill='#bf9252');draw.text((x+8,45 if row==0 else 365),label,font=font,fill='white');draw.ellipse((x+189,foot-3,x+195,foot+3),fill='#ea6657')
    contact.save(args.output/'down-scale-contact.png');record.update({'status':'author-review-candidate','registered':False,'sourceHeight':source_height,'logicalHeight':58,'bodyHeightMeters':1.45,'spec':spec,'frames':frames});(args.output/'registration.json').write_text(json.dumps(record,indent=2)+'\n');print(args.output/'down-scale-contact.png')


if __name__=='__main__':main()
