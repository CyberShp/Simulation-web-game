"""Register approved whole frames for the creation-only formal sword-study profile."""
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image
import numpy as np


ROOT=Path(__file__).resolve().parents[3]
SOURCE=Path('/Volumes/Media/immortal-qa/combat-ranged-20261026-v002')
STOP_SOURCE=Path('/Volumes/Media/immortal-qa/kling-actions-20261025-v001/action-package-v002')
DOWN_SOURCE=Path('/Volumes/Media/immortal-qa/combat-sword-study-motion-20261027-v001/down-scale-v001')
OUTPUT=ROOT/'assets/courtyard/combat-sword-study-v1'


def main():
    c=json.loads((SOURCE/'config.json').read_text());(OUTPUT/'frames').mkdir(parents=True,exist_ok=True)
    frames={}
    def register(a,source_height,body_height):
        key=Path(a['file']).stem
        if key in frames:return key
        src=SOURCE/a['file'];dst=OUTPUT/'frames'/Path(a['file']).name;shutil.copyfile(src,dst)
        im=Image.open(dst);shape=c.get('hitShapes',{}).get(a['file'],{})
        samples={}
        if shape.get('rows'):
            rgba=np.array(im.convert('RGBA'));occupied=np.argwhere(rgba[:,:,3]>=64);white=np.argwhere((rgba[:,:,3]>=64)&(rgba[:,:,:3].min(axis=2)>170)&(rgba[:,:,:3].max(axis=2)-rgba[:,:,:3].min(axis=2)<70))
            points=white if len(white) else occupied;centre=points.mean(axis=0);head=points[((points-centre)**2).sum(axis=1).argmin()]
            target=np.array([a['root'][1]-source_height*.4,a['root'][0]]);torso=occupied[((occupied-target)**2).sum(axis=1).argmin()]
            samples={'head':[int(head[1]),int(head[0])],'torso':[int(torso[1]),int(torso[0])],'above':[int(head[1]),int(occupied[:,0].min())-12]}
        frames[key]={'key':key,'file':'combat-sword-study-v1/frames/'+dst.name,'root':a['root'],'scale':body_height/source_height,'sourceHeight':source_height,'bodyHeightMeters':body_height,'width':im.width,'height':im.height,'rows':shape.get('rows',[]),'alphaThreshold':64,'samples':samples,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest()}
        return key
    actions=[register(a,390,1.45)for a in c['actions']]
    counter=[register(a,220,2.35)for a in c['enemyActions']]
    evade=[register(a,390,1.45)for a in c['evadeActions']]
    beast=[register(a,280,2.35)for a in c['enemySupplement']]
    attack={k:[register(a,275,1.45)for a in d['attack']]for k,d in c['directional'].items()if d.get('attack')}
    move={k:[register(a,275,1.45)for a in d['run']]for k,d in c['directional'].items()if d.get('run')}
    heavy={k:[register(a,275,1.45)for a in d]for k,d in c['heavyDirectional'].items()}
    atlas=Image.open(SOURCE/'movement-atlas.png');run=[]
    for ident in c['runOrder']:
        x,y,w,h=c['frames'][str(ident)]['atlasRect'];key=f'run-{ident:03}';dst=OUTPUT/'frames'/f'{key}.png';atlas.crop((x,y,x+w,y+h)).save(dst)
        frames[key]={'key':key,'file':'combat-sword-study-v1/frames/'+dst.name,'root':c['movementRoot'],'scale':1.45/58,'sourceHeight':58,'bodyHeightMeters':1.45,'width':w,'height':h,'rows':[],'alphaThreshold':64,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest()};run.append(key)
    move.update({'right':run,'left':run})
    stop_manifest_path=STOP_SOURCE/'manifest.json';stop_manifest=json.loads(stop_manifest_path.read_text());stops=[];stop_sources=[]
    for ident in [203,206,209]:
        source_frame=stop_manifest['frames'][str(ident)];src=STOP_SOURCE/source_frame['file'];sha=hashlib.sha256(src.read_bytes()).hexdigest()
        if sha!=source_frame['sha256']:raise ValueError(f'Stop source checksum mismatch: {src}')
        key=f'stop-{ident}';dst=OUTPUT/'frames'/f'{key}.png';shutil.copyfile(src,dst)
        frames[key]={**frames[run[0]],'key':key,'file':'combat-sword-study-v1/frames/'+dst.name,'sha256':sha};stops.append(key)
        stop_sources.append({'sourceFrameId':ident,'sourceFile':str(src),'sourceSha256':sha,'file':frames[key]['file'],'sha256':sha,'sourceRoot':stop_manifest['sourceRoot'],'sourceHeight':stop_manifest['sourceHeight'],'logicalRoot':stop_manifest['footLogical'],'logicalHeight':stop_manifest['logicalHeight'],'originalSourceRgbSha256':source_frame['sourceRgbSha256']})
    (OUTPUT/'stopping-sources.json').write_text(json.dumps({'scope':'three existing complete logical frames for confirmed display-position stopping; side views only','sourceManifest':str(stop_manifest_path),'sourceManifestSha256':hashlib.sha256(stop_manifest_path.read_bytes()).hexdigest(),'sourceVideoSha256':stop_manifest['sourceVideoSha256'],'pixelOperations':['byte-exact copy of pre-existing 84x84 BOX58 logical RGBA PNG'],'frames':stop_sources},ensure_ascii=False,indent=2)+'\n')
    data={'schema':'combat-sword-study-assets/v1','profile':'sword-study-v1','frames':frames,'player':{'idle':actions[3],'attack':attack,'heavy':heavy,'move':move,'runDurationMs':[c['runTiming'][str(i)]for i in c['runOrder']],'hit':actions[4:8],'evade':evade,'down':actions[7],'stop':stops},'beast':{'idle':counter[0],'move':beast[:4],'windup':counter[1],'release':counter[2],'recovery':counter[3],'hit':beast[4:6],'down':beast[4:8]}}
    down_registration_path=DOWN_SOURCE/'registration.json';down_registration=json.loads(down_registration_path.read_text());down=[];down_sources=[]
    for index,source_frame in enumerate(down_registration['frames']):
        key=f'down-{index:02}';src=DOWN_SOURCE/source_frame['file'];sha=hashlib.sha256(src.read_bytes()).hexdigest()
        if sha!=source_frame['sha256']:raise ValueError(f'Down source checksum mismatch: {src}')
        dst=OUTPUT/'frames'/f'{key}.png';shutil.copyfile(src,dst);x0,y0,x1,y1=source_frame['sourceBox'];source_height=down_registration['sourceHeight']
        frames[key]={'key':key,'file':'combat-sword-study-v1/frames/'+dst.name,'root':source_frame['root'],'scale':1.45/source_height,'sourceHeight':source_height,'bodyHeightMeters':1.45,'width':x1-x0,'height':y1-y0,'rows':[],'alphaThreshold':64,'sha256':sha};down.append(key)
        down_sources.append({'file':frames[key]['file'],'sha256':sha,'sourceFile':str(src),'sourceBox':source_frame['sourceBox'],'sourceRoot':source_frame['sourceRoot'],'root':source_frame['root'],'sourceHeight':source_height,'nativeRgbExact':source_frame['nativeRgbExact']})
    data['player'].update(down=down,downFrameBoundariesMs=[150,300],idleByDirection={'up':heavy['up'][-1],'down':heavy['down'][-1]})
    (OUTPUT/'down-sources.json').write_text(json.dumps({'scope':'author-approved right-side whole-frame down; left is mirrored','source':down_registration['source'],'sourceSha256':down_registration['sha256'],'sourceRegistration':str(down_registration_path),'sourceRegistrationSha256':hashlib.sha256(down_registration_path.read_bytes()).hexdigest(),'promptReference':'docs/art/combat-response-goal-20261027/player-down-prompt.md','pixelOperations':['alpha connected-component ownership','crop preserving native RGB and retained alpha','byte-exact native PNG copy'],'sourceHeight':down_registration['sourceHeight'],'bodyHeightMeters':1.45,'downFrameBoundariesMs':[150,300],'clock':'actor.downedTick; missing tick holds last frame','frames':down_sources},ensure_ascii=False,indent=2)+'\n')
    serialized=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    (ROOT/'src/simulation/ea-combat-sword-study-data.mjs').write_text('export const SWORD_STUDY_METADATA = '+serialized+';\n')
    (OUTPUT/'registry.json').write_text(json.dumps({'schema':data['schema'],'profile':data['profile'],'sharedMetadata':'src/simulation/ea-combat-sword-study-data.mjs','images':[{k:v for k,v in f.items()if k in ['key','file','width','height','sha256']}for f in frames.values()]},ensure_ascii=False,indent=2)+'\n')
    stale=OUTPUT/'metadata.mjs'
    if stale.exists():stale.unlink()
    print('registered',len(frames),'whole frames and',sum(bool(f['rows'])for f in frames.values()),'body masks')


if __name__=='__main__':main()
