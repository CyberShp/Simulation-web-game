#!/usr/bin/env python3
"""Make explicit original-frame seam comparisons across existing video extracts."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata',type=Path,action='append',required=True)
    parser.add_argument('--group',type=int,nargs='+',action='append',required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if args.output.exists():raise FileExistsError('Existing comparison directory is protected: '+str(args.output))
    sources={};video_hashes=set()
    for path in args.metadata:
        data=json.loads(path.read_text());video_hashes.add(data['sourceSha256'])
        for sample in data['samples']:sources[sample['frameIndex']]=(path.parent/sample['file'],sample)
    if len(video_hashes)!=1:raise ValueError('Extracts are not from the same video')
    images={};records={}
    for index in {i for g in args.group for i in g}:
        path,sample=sources[index]
        if sha(path)!=sample['sha256']:raise ValueError('Original frame hash differs')
        with Image.open(path) as image:
            if image.size!=(940,940):raise ValueError('Expected original 940x940 frame')
            images[index]=image.convert('RGB')
        records[index]={'source':str(path),'sha256':sample['sha256'],'timestampSeconds':sample['actualTimestampSeconds']}
    args.output.mkdir(parents=True,exist_ok=False);font=ImageFont.load_default(size=19)
    outputs=[]
    for group in args.group:
        native=Image.new('RGB',(940*len(group),990),(238,238,238))
        thumb=Image.new('RGB',(320*len(group),360),(238,238,238))
        for col,index in enumerate(group):
            text=f'original frame {index} / {records[index]["timestampSeconds"]:.3f}s'
            native.paste(images[index],(col*940,50));ImageDraw.Draw(native).text((col*940+8,12),text,font=font,fill=(25,25,25))
            thumb.paste(images[index].resize((320,320),Image.Resampling.LANCZOS),(col*320,40))
            ImageDraw.Draw(thumb).text((col*320+8,10),text,font=font,fill=(25,25,25))
        suffix='-'.join(map(str,group));native.save(args.output/f'native-{suffix}.png');thumb.save(args.output/f'contact-{suffix}.png')
        with Image.open(args.output/f'native-{suffix}.png') as check:
            for col,index in enumerate(group):
                if check.crop((col*940,50,(col+1)*940,990)).tobytes()!=images[index].tobytes():raise ValueError('Original comparison pixels changed')
        outputs.append(str(args.output/f'contact-{suffix}.png'))
    (args.output/'sources.json').write_text(json.dumps({'sourceVideoSha256':next(iter(video_hashes)),
        'frames':records,'groups':args.group,'nativeReadbackPixelsEqual':True,'artReview':'pending-main-agent'},indent=2)+'\n')
    (args.output/'checksums.json').write_text(json.dumps({p.name:sha(p) for p in sorted(args.output.iterdir()) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'contacts':outputs}))


if __name__=='__main__':main()
