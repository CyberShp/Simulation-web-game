#!/usr/bin/env python3
"""Make fixed original-coordinate lower-body grids for author foot annotations."""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image,ImageDraw,ImageFont


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if args.output.exists():raise FileExistsError('Existing author guides are protected: '+str(args.output))
    data=json.loads(args.metadata.read_text());samples={s['frameIndex']:s for s in data['samples']}
    args.output.mkdir(parents=True,exist_ok=False);(args.output/'guides').mkdir()
    frames=[];records=[];font=ImageFont.load_default(size=16);small=ImageFont.load_default(size=12)
    for frame in range(48,67):
        sample=samples[frame];path=args.metadata.parent/sample['file']
        if sha(path)!=sample['sha256']:raise ValueError('Original frame differs')
        with Image.open(path) as image:crop=image.convert('RGB').crop((250,520,800,850))
        draw=ImageDraw.Draw(crop,'RGBA')
        for x in range(250,800,50):
            draw.line((x-250,0,x-250,329),fill=(0,205,230,110),width=1)
            draw.text((x-250+3,3),str(x),font=small,fill=(0,105,125,255))
        for y in range(550,850,50):
            draw.line((0,y-520,549,y-520),fill=(0,205,230,110),width=1)
            draw.text((3,y-520+3),str(y),font=small,fill=(0,105,125,255))
        crop.save(args.output/'guides'/f'frame-{frame:06d}.png');frames.append(crop)
        records.append({'frame':frame,'source':str(path),'sourceSha256':sample['sha256'],
            'sourceTimestampSeconds':sample['actualTimestampSeconds'],'crop':[250,520,800,850]})
    pages=[]
    for start in range(0,19,5):
        count=min(5,19-start);page=Image.new('RGB',(1100,math.ceil(count/2)*374),(238,238,238));draw=ImageDraw.Draw(page)
        for n,index in enumerate(range(start,start+count)):
            x=n%2*550;y=n//2*374;page.paste(frames[index],(x,y+44))
            draw.text((x+8,y+10),f'original frame {48+index} | source x250..800 y520..850',font=font,fill=(25,25,25))
        name=f'foot-page-{start//5+1:02d}.png';page.save(args.output/name);pages.append(str(args.output/name))
    (args.output/'sources.json').write_text(json.dumps({'sourceVideoSha256':data['sourceSha256'],
        'gridStepSourcePixels':50,'sourceFrames':records,'contactLabels':'pending author heel/toe and support-phase annotations; lowest pixel is not a contact detector'},indent=2)+'\n')
    (args.output/'checksums.json').write_text(json.dumps({str(p.relative_to(args.output)):sha(p) for p in sorted(args.output.rglob('*')) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'pages':pages}))


if __name__=='__main__':main()
