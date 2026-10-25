#!/usr/bin/env python3
"""Deterministic gray-background alpha trials; native source RGB stays unchanged."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checker(size, unit=20):
    y,x=np.indices((size[1],size[0]));v=np.where(((x//unit+y//unit)%2)[...,None],185,235)
    return Image.fromarray(np.repeat(v,3,axis=2).astype('uint8'),'RGB')


def composite(image, background):
    if background=='checker':base=checker(image.size)
    else:base=Image.new('RGB',image.size,background)
    base.paste(image,mask=image.getchannel('A'))
    return base


def matte(rgb, roi, low, high, legacy=False):
    h,w=rgb.shape[:2];y,x=np.mgrid[:h,:w];xn=(x-w/2)/w;yn=(y-h/2)/h
    basis=np.stack([np.ones((h,w)),xn,yn,xn*xn,xn*yn,yn*yn],axis=-1)
    left,top,right,bottom=roi
    safe=((x<left)|(x>=right)|(y<top))&(y<bottom)
    coef=np.linalg.lstsq(basis[safe][::8],rgb[safe][::8].astype('float64'),rcond=None)[0]
    model=np.einsum('ijk,kc->ijc',basis,coef,optimize=False)
    residual=np.max(np.abs(rgb.astype('float64')-model),axis=2)
    chroma=np.max(rgb,axis=2).astype('int16')-np.min(rgb,axis=2)
    inside=(x>=left)&(x<right)&(y>=top)&(y<bottom)
    red,green,blue=[rgb[:,:,i].astype('int16') for i in range(3)]
    protected_color=((red-blue>=14)&(red-green>=3))|((blue-red>=16)&(blue-green>=3))
    # Connectivity may cross a compression halo without declaring it opaque.
    # Warm cloth and cool steel/blue pigment retain their source color coverage.
    possible=((residual<high)&(chroma<12)&inside) if legacy else ((residual<90)&(chroma<18)&~protected_color&inside)
    count,labels,stats,_=cv2.connectedComponentsWithStats(possible.astype('uint8'),connectivity=4)
    edge_labels=np.unique(np.concatenate([labels[top,left:right],labels[bottom-1,left:right],
                                         labels[top:bottom,left],labels[top:bottom,right-1]]))
    exterior=np.isin(labels,edge_labels[edge_labels!=0])
    alpha=np.full((h,w),255,dtype='uint8')
    ramp=np.clip((residual-low)/(high-low),0,1)**(1 if legacy else 1.5)
    alpha[exterior]=np.rint(ramp[exterior]*255).astype('uint8')
    # Clear the entire enclosed neutral component when it contains confirmed
    # background seeds; a two-pixel seed border left visible gray islands.
    seeds=((residual<=low)&(chroma<=6)&inside&~exterior) if legacy else ((residual<=low)&(chroma<=8)&inside&~exterior&possible)
    holes,hole_labels,hole_stats,_=cv2.connectedComponentsWithStats(seeds.astype('uint8'),connectivity=4)
    hole_ids=[i for i in range(1,holes) if hole_stats[i,cv2.CC_STAT_AREA]>=12]
    hole_mask=np.isin(hole_labels,hole_ids)
    enclosed_labels=np.unique(labels[hole_mask]);enclosed_labels=enclosed_labels[enclosed_labels!=0]
    hole_band=(cv2.dilate(hole_mask.astype('uint8'),np.ones((3,3),'uint8'),iterations=2).astype(bool)&possible) if legacy else np.isin(labels,enclosed_labels)
    alpha[hole_band]=np.rint(ramp[hole_band]*255).astype('uint8')
    alpha[hole_mask]=0
    alpha[~inside]=0
    rgba=np.dstack([rgb,alpha])
    assert np.array_equal(rgba[:,:,:3],rgb)
    report={'backgroundModel':'per-channel quadratic fit from safe pixels outside the fixed character ROI',
            'backgroundFitCoefficients':coef.tolist(),'safeFitResidualPercentiles':np.percentile(residual[safe],[50,99,99.9,100]).tolist(),
            'alphaProfile':'conservative-v1' if legacy else 'connected-v2',
            'alphaThresholds':[low,high],'alphaRampExponent':1 if legacy else 1.5,
            'connectivityMaxResidualExclusive':high if legacy else 90,'possibleBackgroundMaxChromaExclusive':12 if legacy else 18,
            'protectedColor':'closed contours' if legacy else 'warm R-B>=14/R-G>=3; cool B-R>=16/B-G>=3',
            'enclosedBackgroundSeedMaxChroma':6 if legacy else 8,'minimumHoleSeedPixels':12,
            'enclosedBackgroundSeedComponents':len(hole_ids),
            'enclosedBackgroundSeedAreas':[int(hole_stats[i,cv2.CC_STAT_AREA]) for i in hole_ids],
            'alphaPixels':{'zero':int(np.sum(alpha==0)),'partial':int(np.sum((alpha>0)&(alpha<255))),'opaque':int(np.sum(alpha==255))},
            'rgbPreserved':True,'alphaSupportRoi':roi,
            'supportTouchesRoi':bool(np.any(alpha[top,left:right]) or np.any(alpha[bottom-1,left:right]) or
                                         np.any(alpha[top:bottom,left]) or np.any(alpha[top:bottom,right-1]))}
    if report['supportTouchesRoi']:raise ValueError('Nonzero alpha touches fixed ROI boundary; review required')
    return Image.fromarray(rgba,'RGBA'),report


def logical_frame(image, method, scale):
    # Padding permits an exact scale instead of per-frame integer-size fitting.
    width=math.ceil(image.width*scale);height=math.ceil(image.height*scale)
    extent=(0,0,width/scale,height/scale)
    pad=Image.new('RGBA',(math.ceil(extent[2]),math.ceil(extent[3])),(0,0,0,0));pad.paste(image)
    if method=='nearest':return pad.resize((width,height),Image.Resampling.NEAREST,box=extent)
    # Premultiplied area filtering avoids mixing invisible gray RGB into samples.
    return pad.convert('RGBa').resize((width,height),Image.Resampling.BOX,box=extent).convert('RGBA')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--frames',type=int,nargs='+',default=[48,54,60])
    parser.add_argument('--roi',type=int,nargs=4,default=[16,150,800,875])
    parser.add_argument('--low',type=float)
    parser.add_argument('--high',type=float)
    parser.add_argument('--alpha-profile',choices=['connected-v2','conservative-v1'],default='connected-v2')
    parser.add_argument('--no-preview',action='store_true',help='Write alpha/RGBA/logical frames without large contact composites')
    parser.add_argument('--protect-from',type=Path,help='Prior native RGBA directory with reviewed opaque clothing')
    parser.add_argument('--protection-json',type=Path,help='Explicit source-coordinate per-frame protection polygons')
    args=parser.parse_args()
    legacy=args.alpha_profile=='conservative-v1'
    if args.low is None:args.low=6 if legacy else 18
    if args.high is None:args.high=20 if legacy else 60
    if args.output.exists():raise FileExistsError('Existing evidence directory is protected: '+str(args.output))
    if not 0<=args.low<args.high:raise ValueError('Invalid alpha thresholds')
    if bool(args.protect_from)!=bool(args.protection_json):raise ValueError('Both protection inputs are required together')
    protection=json.loads(args.protection_json.read_text()) if args.protection_json else None
    data=json.loads(args.metadata.read_text());samples={s['frameIndex']:s for s in data['samples']}
    inputs=[]
    for frame in args.frames:
        s=samples[frame];path=args.metadata.parent/s['file']
        if sha(path)!=s['sha256']:raise ValueError('Source PNG hash mismatch')
        inputs.append((frame,path,s))
    args.output.mkdir(parents=True,exist_ok=False)
    for sub in ['originals','rgba','alpha','logical-nearest','logical-box','native-composites']:(args.output/sub).mkdir()
    if protection:
        (args.output/'protection-masks').mkdir()
        shutil.copyfile(args.protection_json,args.output/'protection.json')
    font=ImageFont.load_default(size=18);small=ImageFont.load_default(size=14)
    native_contact=None if args.no_preview else Image.new('RGB',(1410,len(inputs)*510),(238,238,238))
    sampling_contact=None if args.no_preview else Image.new('RGB',(1440,len(inputs)*280),(238,238,238))
    backgrounds=[('white',(255,255,255)),('dark',(24,32,43)),('checker','checker')]
    reports=[]
    for row,(frame,path,sample) in enumerate(inputs):
        shutil.copyfile(path,args.output/'originals'/path.name)
        with Image.open(path) as source:rgb=np.asarray(source.convert('RGB')).copy()
        if rgb.shape!=(940,940,3):raise ValueError('Expected native 940x940 RGB frame')
        image,report=matte(rgb,args.roi,args.low,args.high,legacy)
        if protection:
            regions=protection['frames'].get(str(frame),[])
            mask=Image.new('L',image.size,0)
            for region in regions:ImageDraw.Draw(mask).polygon([tuple(p) for p in region['polygon']],fill=255)
            old_path=args.protect_from/path.name
            with Image.open(old_path) as old_image:old=np.asarray(old_image)
            if old.shape!=(940,940,4) or not np.array_equal(old[:,:,:3],rgb):raise ValueError('Protection reference RGB differs')
            current=np.asarray(image).copy();restore=(np.asarray(mask)>0)&(old[:,:,3]==255)
            changed=restore&(current[:,:,3]<255);current[:,:,3][restore]=255
            image=Image.fromarray(current)
            mask.save(args.output/'protection-masks'/path.name)
            report['localForegroundProtection']={'regions':regions,'source':str(old_path),'sourceSha256':sha(old_path),
                'rule':'restore alpha=255 only where prior reviewed trial was opaque, within explicit polygons',
                'restoredPixels':int(np.sum(changed))}
            alpha=current[:,:,3]
            report['alphaPixels']={'zero':int(np.sum(alpha==0)),'partial':int(np.sum((alpha>0)&(alpha<255))),'opaque':int(np.sum(alpha==255))}
        dest=args.output/'rgba'/path.name;image.save(dest);image.getchannel('A').save(args.output/'alpha'/path.name)
        with Image.open(dest) as check:
            if not np.array_equal(np.asarray(check)[:,:,:3],rgb):raise ValueError('Native RGB changed')
        report.update(frameIndex=frame,sourceSha256=sample['sha256'],timestamp=sample['actualTimestampSeconds'],rgbaSha256=sha(dest))
        for col,(name,bg) in enumerate([] if args.no_preview else backgrounds):
            display=composite(image,bg);display.save(args.output/'native-composites'/f'frame-{frame:06d}-{name}.png')
            native_contact.paste(display.resize((470,470),Image.Resampling.LANCZOS),(col*470,row*510+40))
            ImageDraw.Draw(native_contact).text((col*470+8,row*510+10),f'frame {frame} / {name} / native alpha trial',font=font,fill=(25,25,25))
        for method_id,method in enumerate(['nearest','box']):
            logical=logical_frame(image,method,58/650)
            logical.save(args.output/f'logical-{method}'/path.name)
            if args.no_preview:continue
            canvas=Image.new('RGBA',(136,120),(0,0,0,0))
            origin=(round(68-580*58/650),round(95-825*58/650))
            canvas.paste(logical,origin)
            screen=canvas.transform((238,210),Image.Transform.AFFINE,(880/1536,0,0,0,880/1536,0),resample=Image.Resampling.NEAREST)
            for bg_id,(name,bg) in enumerate(backgrounds):
                col=method_id*3+bg_id;x=col*240;y=row*280
                sampling_contact.paste(composite(screen,bg),(x,y+50))
                d=ImageDraw.Draw(sampling_contact)
                d.text((x+7,y+8),f'frame {frame} / {method.upper()}',font=small,fill=(25,25,25))
                d.text((x+7,y+28),name+' / 58 logical / common scale',font=small,fill=(25,25,25))
        if sha(path)!=sample['sha256']:raise ValueError('Source changed during processing')
        reports.append(report)
    if not args.no_preview:
        native_contact.save(args.output/'contact-native-three-backgrounds.png')
        sampling_contact.save(args.output/'contact-sampling-nearest-vs-box.png')
    report={'sourceVideoSha256':data['sourceSha256'],'frames':reports,
            'fixedCalibration':{'sourceHeight':650,'root':[580,825],'logicalBodyHeight':58,'displayScale':1536/880},
            'processing':'native RGB preserved; alpha-only gray color model and connected-region separation; no edge recoloring',
            'samplingComparison':'exact common 58/650 scale; nearest versus premultiplied BOX area reduction; shared nearest display enlargement',
            'selectedSampling':'BOX per main-agent decision; nearest retained only for comparison',
            'status':f'{len(reports)}-frame alpha candidate pending main-agent review'}
    (args.output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    (args.output/'checksums.json').write_text(json.dumps({str(p.relative_to(args.output)):sha(p) for p in sorted(args.output.rglob('*')) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'nativeContact':None if args.no_preview else str(args.output/'contact-native-three-backgrounds.png'),
                      'samplingContact':None if args.no_preview else str(args.output/'contact-sampling-nearest-vs-box.png'),
                      'frames':[r['frameIndex'] for r in reports],'rgbPreserved':True},ensure_ascii=False))


if __name__=='__main__':main()
