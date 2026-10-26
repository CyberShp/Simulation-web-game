"""Register the approved wide painting and three complete, separate props."""
import json
import shutil
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'assets/courtyard/combat-sword-study-v1'
GEN=Path('/Users/shepard/.codex/generated_images/01a171b0-eee9-7701-bd4a-61dcb2b0b53b')

def main():
    (OUT/'source').mkdir(parents=True,exist_ok=True)
    ground=GEN/'exec-51b08f53-0630-4da1-833e-2732da4e4f40.png';props=GEN/'exec-2eddc0f4-1874-42af-97a6-d44947d64675.png'
    shutil.copyfile(ground,OUT/'source/background.png');shutil.copyfile(props,OUT/'source/props.png')
    im=Image.open(ground);w,h=im.size;yscale=(992/1585)*(.33/.56)*(10.8/6.8);rh=.55*h;rw=rh*48/(32*yscale);rect=[.17*w,.20*h,rw,rh];assert rect[0]+rw<=.88*w
    data={'profile':'sword-study-v1','ground':{'file':'combat-sword-study-v1/source/background.png','sourceSize':[w,h],'registeredRect':rect,'worldRect':[0,0,48,32],'imageWorldRect':[-rect[0]*48/rw,-rect[1]*32/rh,w*48/rw,h*32/rh]},'props':{}}
    rgba=Image.open(props).convert('RGBA');a=np.array(rgba);columns=(a[:,:,3]>=8).sum(axis=0)>4;edges=np.flatnonzero(np.diff(np.r_[False,columns,False])).tolist();groups=[(l,r)for l,r in zip(edges[::2],edges[1::2])if r-l>100];assert len(groups)==3,groups
    for (left,right),(name,width)in zip(groups,[('herbs',4),('bridge',7),('cave',6)]):
        active=np.argwhere(a[:,left:right,3]>=8);top=int(active[:,0].min());bottom=int(active[:,0].max())+1;box=[max(0,left-4),max(0,top-4),min(rgba.width,right+4),min(rgba.height,bottom+4)];image=rgba.crop(box);file='prop-'+name+'.png';image.save(OUT/file)
        data['props']['object:valley:'+name]={'file':'combat-sword-study-v1/'+file,'root':[image.width/2,bottom-box[1]-1],'width':image.width,'height':image.height,'worldWidth':width,'sourceBox':box}
    (OUT/'ground-registration.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'apps/courtyard/courtyard-combat-sword-study-ground-data.mjs').write_text('export const SWORD_STUDY_GROUND = '+json.dumps(data,separators=(',',':'))+';\n')
    (OUT/'CREDITS.txt').write_text('剑修与山魈：2026-10-25/26整帧图像生成及用户提供Kling原片选帧。\n林地与独立地物：2026-10-26图像生成，注册到48×32米同源场地。\n音效：本地确定性合成，制作记录见docs/art/combat-ranged-20261026/audio。\n提示词与来源：docs/art/combat-encounter-20261026、combat-ranged-20261026及本包source。\n')
    print('wide ground registered',im.size,'rect',rect,'props',list(data['props']))

if __name__=='__main__':main()
