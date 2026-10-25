/** Surfaces registered to authoritative metre coordinates. */
import {combatWorldToScreen,COMBAT_GROUND_Y_SCALE} from './courtyard-combat-camera.mjs';
const clearGround=Object.freeze({left:.22,right:.78,top:.32,bottom:.65});
const edgeTrees=Object.freeze([
 ...[[0,5],[0,17],[0,29],[48,8],[48,22],[8,32],[24,32],[40,32]].map(([x,y],i)=>Object.freeze({id:'valley-edge-tree:'+i,kind:'prop',x,y,worldWidth:2.85,sourceRect:Object.freeze([128,0,96,128]),foot:Object.freeze([176,110])})),
]);
export const COMBAT_BACKDROPS=Object.freeze({
 forest:Object.freeze({id:'forest',image:'valley-battlefield-v2.png',title:'林间交锋',exitLabel:'← 撤离山道',clearGround}),
 'prison-forecourt':Object.freeze({id:'prison-forecourt',image:'prison-forecourt-v1.png',title:'偏牢前场',exitLabel:'← 西侧退路',clearGround}),
 'valley-open-v2':Object.freeze({id:'valley-open-v2',mode:'tiled',image:'combat-pixel-v1/environment/grass.png',propsImage:'combat-pixel-v1/environment/atlas.png',title:'云岫山谷交锋',exitLabel:'← 归院山道',tileMetres:Object.freeze([4,4/COMBAT_GROUND_Y_SCALE]),decorations:edgeTrees,props:Object.freeze({
  'object:valley:herbs':Object.freeze({sourceRect:Object.freeze([224,0,128,64]),foot:Object.freeze([288,58])}),
  'object:valley:bridge':Object.freeze({sourceRect:Object.freeze([0,128,224,80]),foot:Object.freeze([112,208])}),
  'object:valley:cave':Object.freeze({sourceRect:Object.freeze([224,128,192,64]),foot:Object.freeze([320,192])}),
 })}),
});
export function combatBackdrop(scene){return COMBAT_BACKDROPS[scene?.geometryId]||COMBAT_BACKDROPS[scene?.sceneFrame?.geometryId]||COMBAT_BACKDROPS.forest;}

/** Only visible, world-anchored tiles are submitted; no full-map canvas exists. */
export function combatGroundTiles(config,transform){
 if(config.mode!=='tiled'||!transform.visibleWorld)return [];
 const [w,h]=config.tileMetres,b=transform.visibleWorld,tiles=[];
 for(let y=Math.floor(b.top/h);y<Math.ceil(b.bottom/h);y++)for(let x=Math.floor(b.left/w);x<Math.ceil(b.right/w);x++){
  const a=combatWorldToScreen(transform,x*w,y*h),z=combatWorldToScreen(transform,(x+1)*w,(y+1)*h),left=Math.round(a.x),top=Math.round(a.y);
  tiles.push({worldX:x*w,worldY:y*h,x:left,y:top,width:Math.round(z.x)-left,height:Math.round(z.y)-top});
 }
 return tiles;
}
/** Object position and collision size come from the shared obstacle record.
 * The root-owned atlas supplies only source pixels and their front ground foot. */
export function combatBackdropProps(config,scene){
 if(config.mode!=='tiled')return [];
 return (scene.obstacles||[]).flatMap(obstacle=>{
  const art=config.props[obstacle.id];if(!art)return [];
  return [{id:obstacle.id,kind:'prop',x:obstacle.x+obstacle.w/2,y:obstacle.y+obstacle.h,worldWidth:obstacle.w,sourceRect:art.sourceRect,foot:art.foot}];
 });
}
export function drawCombatBackdropProp(ctx,image,prop,transform){
 const [x,y,w,h]=prop.sourceRect,k=prop.worldWidth*transform.sx/w,p=combatWorldToScreen(transform,prop.x,prop.y);
 ctx.drawImage(image,x,y,w,h,p.x-(prop.foot[0]-x)*k,p.y-(prop.foot[1]-y)*k,w*k,h*k);
}
export function combatBackdropDecorations(config,transform){
 return (config.decorations||[]).filter(prop=>{
  const [x,y,w,h]=prop.sourceRect,k=prop.worldWidth*transform.sx/w,p=combatWorldToScreen(transform,prop.x,prop.y),left=p.x-(prop.foot[0]-x)*k,top=p.y-(prop.foot[1]-y)*k;
  return left+w*k>=0&&left<=transform.width&&top+h*k>=0&&top<=transform.height;
 });
}
