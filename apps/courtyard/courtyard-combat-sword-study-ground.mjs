import {SWORD_STUDY_GROUND as DATA} from './courtyard-combat-sword-study-ground-data.mjs';
export {SWORD_STUDY_GROUND} from './courtyard-combat-sword-study-ground-data.mjs';
export async function loadSwordStudyGround(loadImage){return Object.fromEntries(await Promise.all([DATA.ground,...Object.values(DATA.props)].map(async a=>[a.file,await loadImage(a.file)])));}
export function drawSwordStudyGround(ctx,images,transform){const g=DATA.ground,[x,y,w,h]=g.imageWorldRect,image=images?.[g.file];if(image)ctx.drawImage(image,transform.ox+x*transform.sx,transform.oy+y*transform.sy,w*transform.sx,h*transform.sy);}
export function swordStudyProps(scene){return (scene.obstacles||[]).flatMap(o=>{const a=DATA.props[o.id];return a?[{...a,id:o.id,kind:'study-prop',x:o.x+o.w/2,y:o.y+o.h,worldWidth:o.w}]:[];});}
export function drawSwordStudyProp(ctx,images,p,t){const im=images?.[p.file];if(!im)return;const k=p.worldWidth*t.sx/p.width;ctx.drawImage(im,t.ox+p.x*t.sx-p.root[0]*k,t.oy+p.y*t.sy-p.root[1]*k,p.width*k,p.height*k);}
