#!/usr/bin/env python3
"""Expose fixed-coordinate nearest-pose candidates for interruptible offline clips."""
import argparse,hashlib,json,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from matte_frames import composite


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--package',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--restart-only',action='store_true');a=p.parse_args()
    if a.output.exists():raise FileExistsError('Existing phase mapping is protected: '+str(a.output))
    m=json.loads((a.package/'manifest.json').read_text());order=m['clips']['run']['frames'];stop=m['clips']['stop']['frames'];restart=m['clips']['start']['frames']+order
    images={};features={};hashes={}
    weights=np.ones((47,47,4),dtype='float64');weights[25:43,12:40,:]*=4
    for key,f in m['frames'].items():
        path=a.package/f['nativeFile'];hashes[str(path)]=sha(path)
        if hashes[str(path)]!=f['nativeSha256']:raise ValueError('Approved native PNG hash differs')
        with Image.open(path) as image:images[int(key)]=image.convert('RGBA')
        features[int(key)]=np.asarray(images[int(key)].convert('RGBa').resize((47,47),Image.Resampling.BOX)).astype('float64')
    def ranked(source,candidates):return sorted([{'sourceFrame':c,'score':float(np.mean((features[source]-features[c])**2*weights))} for c in candidates],key=lambda x:(x['score'],x['sourceFrame']))
    stop_rank={str(f):ranked(f,stop) for f in images};restart_rank={str(f):ranked(f,restart) for f in images}
    stop_map={f:values[0]['sourceFrame'] for f,values in stop_rank.items()}
    restart_map={f:{'clip':'start' if values[0]['sourceFrame'] in m['clips']['start']['frames'] else 'run','sourceFrame':values[0]['sourceFrame']} for f,values in restart_rank.items()}
    a.output.mkdir(parents=True,exist_ok=False);font=ImageFont.load_default(size=17);pages=[]
    pairs=[(f,restart_map[str(f)]['sourceFrame']) for f in stop] if a.restart_only else [(f,stop_map[str(f)]) for f in order]
    for start in range(0,len(pairs),6):
        count=min(6,len(pairs)-start);page=Image.new('RGB',(1080,math.ceil(count/2)*310),(238,238,238));draw=ImageDraw.Draw(page)
        for n,(f,dest) in enumerate(pairs[start:start+6]):
            x=n%2*540;y=n//2*310
            for col,i in enumerate([f,dest]):page.paste(composite(images[i],(24,32,43)).resize((270,270),Image.Resampling.LANCZOS),(x+col*270,y+40))
            label=f'stop {f} -> restart {restart_map[str(f)]["clip"]} {dest}' if a.restart_only else f'run {f} -> stop {dest} | immediate candidate'
            draw.text((x+7,y+10),label,font=font,fill=(25,25,25))
        prefix='stop-restart' if a.restart_only else 'run-stop'
        name=f'{prefix}-page-{start//6+1:02d}.png';page.save(a.output/name);pages.append(str(a.output/name))
    mapping={'status':'heuristic candidates pending main-agent leg-phase and visual-jump review',
        'method':'fixed 940 canvas, 47x47 premultiplied RGBA descriptor; fixed lower-body region x250..800/y500..860 weighted4; no image normalization or pose modification',
        'limits':'distance ranks candidates only; not a support-foot classifier or proof of seamless transition; one stop chain may lack the other support leg',
        'runOrder':order,'stopFrames':stop,'restartCandidates':{'start':m['clips']['start']['frames'],'run':order},
        'stopEntryMap':stop_map,'restartEntryMap':restart_map,
        'runPhaseRows':[{'runSourceFrame':f,'stopEntrySourceFrame':stop_map[str(f)],'topStopCandidates':stop_rank[str(f)][:3],
            'restartFromEntry':restart_map[str(stop_map[str(f)])]} for f in order],
        'stopRestartRows':[{'stopSourceFrame':f,**restart_map[str(f)]} for f in stop],
        'sourceNativeHashes':hashes,'responseContract':'release freezes study displacement and immediately selects stop; new D interrupts without waiting for stop/loop completion'}
    (a.output/'phase-map.json').write_text(json.dumps(mapping,indent=2)+'\n')
    (a.output/'checksums.json').write_text(json.dumps({p.name:sha(p) for p in sorted(a.output.iterdir()) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'pages':pages,'map':str(a.output/'phase-map.json'),'rows':mapping['runPhaseRows']}))


if __name__=='__main__':main()
