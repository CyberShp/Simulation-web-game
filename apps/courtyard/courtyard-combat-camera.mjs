/** Read-only metre-to-CSS-pixel transforms; camera work never advances combat. */
export const OPEN_COMBAT_GEOMETRY='valley-open-v2';
export const COMBAT_CAMERA_VIEW_METRES=22;
// Preserve the approved forest painting's ground compression independently of
// the dimensions of a replacement ground texture.
export const COMBAT_GROUND_Y_SCALE=(992/1585)*(.33/.56)*(10.8/6.8);
export const COMBAT_CAMERA_TOP_APRON=2.5;
export const COMBAT_CAMERA_BOTTOM_APRON=5;
export const COMBAT_CAMERA_HUD_GAP=12;
const legacyBounds=Object.freeze({left:.6,right:11.4,top:.6,bottom:7.4});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const validBounds=b=>b&&['left','right','top','bottom'].every(k=>Number.isFinite(b[k]))&&b.left<b.right&&b.top<b.bottom;
export const usesCombatCamera=scene=>scene?.geometryId===OPEN_COMBAT_GEOMETRY;

export function combatSceneBounds(scene){
 const bounds=scene?.arena?.bounds;
 if(validBounds(bounds))return bounds;
 if(usesCombatCamera(scene))throw Error('新林间战场缺少权威 arena.bounds。');
 return legacyBounds;
}
export function combatExitLandmark(scene){return scene?.landmarks?.find(p=>p.id==='exit')||scene?.arena?.exit||(usesCombatCamera(scene)?null:{id:'exit',x:.7,y:4,radius:.7});}
export function legacyCombatTransform({width,height,image=null,inset}={}){
 const ratio=image?image.width/image.height:1.5,imageWidth=Math.max(width,height*ratio),imageHeight=imageWidth/ratio;
 const sx=imageWidth*(inset.right-inset.left)/10.8,sy=imageHeight*(inset.bottom-inset.top)/6.8;
 return {mode:'legacy',width,height,sx,sy,ox:(width-imageWidth)/2+imageWidth*inset.left-.6*sx,oy:(height-imageHeight)/2+imageHeight*inset.top-.6*sy,imageX:(width-imageWidth)/2,imageY:(height-imageHeight)/2,imageWidth,imageHeight};
}
/** Return a safe foot row in canvas CSS pixels from the actual HUD rectangle. */
export function combatHudSafeBottom(canvasRect,panelRect,height=canvasRect?.height){
 if(!panelRect||![canvasRect?.left,canvasRect?.top,canvasRect?.width,canvasRect?.height,panelRect.left,panelRect.top,panelRect.width,panelRect.height,height].every(Number.isFinite)||canvasRect.width<=0||canvasRect.height<=0||panelRect.width<=0||panelRect.height<=0)return height;
 if(panelRect.left+panelRect.width<=canvasRect.left||panelRect.left>=canvasRect.left+canvasRect.width||panelRect.top+panelRect.height<=canvasRect.top||panelRect.top>=canvasRect.top+canvasRect.height)return height;
 return clamp((panelRect.top-canvasRect.top-COMBAT_CAMERA_HUD_GAP)*height/canvasRect.height,0,height);
}
export function combatCameraTransform(scene,{width,height,focus=scene?.player,viewMetres=COMBAT_CAMERA_VIEW_METRES,safeBottom=height}={}){
 if(!usesCombatCamera(scene))throw Error('跟随镜头只用于已登记的新林间战场。');
 const walkBounds=combatSceneBounds(scene);
 const fieldWidth=scene.arena.width,fieldHeight=scene.arena.height;
 if(![width,height,fieldWidth,fieldHeight,viewMetres].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(focus?.x)||!Number.isFinite(focus?.y)||!Number.isFinite(safeBottom))throw Error('战场镜头尺寸或脚点无效。');
 const sx=width/viewMetres,sy=sx*COMBAT_GROUND_Y_SCALE,viewHeight=height/sy;
 safeBottom=clamp(safeBottom,0,height);
 // The apron is display-only. Extend it when a narrow viewport or a taller HUD
 // would otherwise put the authoritative bottom-edge foot behind the panel.
 const bottomApron=Math.max(COMBAT_CAMERA_BOTTOM_APRON,walkBounds.bottom-fieldHeight+(height-safeBottom)/sy),anchorY=Math.min(height/2,safeBottom);
 const displayBounds={left:0,right:fieldWidth,top:-COMBAT_CAMERA_TOP_APRON,bottom:fieldHeight+bottomApron};
 const axis=(at,lo,hi,extent)=>extent>=hi-lo?(lo+hi)/2:clamp(at,lo+extent/2,hi-extent/2);
 const center={x:axis(focus.x,displayBounds.left,displayBounds.right,viewMetres),y:viewHeight>=displayBounds.bottom-displayBounds.top?(displayBounds.top+displayBounds.bottom)/2+(anchorY-height/2)/sy:clamp(focus.y,displayBounds.top+anchorY/sy,displayBounds.bottom-(height-anchorY)/sy)};
 return {mode:'follow',width,height,sx,sy,ox:width/2-center.x*sx,oy:anchorY-center.y*sy,center,viewMetres,viewHeight,displayBounds,safeBottom,anchorY,bottomApron,visibleWorld:{left:center.x-viewMetres/2,right:center.x+viewMetres/2,top:center.y-anchorY/sy,bottom:center.y+(height-anchorY)/sy}};
}
export const combatWorldToScreen=(transform,x,y)=>({x:transform.ox+x*transform.sx,y:transform.oy+y*transform.sy});
export const combatScreenToWorld=(transform,x,y)=>({x:(x-transform.ox)/transform.sx,y:(y-transform.oy)/transform.sy});
/** A retained browser pointer is reprojected against the last painted frame.
 * The scale also handles a CSS resize before the next canvas paint. */
export function combatPointerScreenPoint(pointer,rect,transform){
 if(!pointer||!rect?.width||!rect?.height||!transform)return null;
 return {x:(pointer.clientX-rect.left)*transform.width/rect.width,y:(pointer.clientY-rect.top)*transform.height/rect.height};
}
export function combatPointerWorldPoint(pointer,rect,transform){const at=combatPointerScreenPoint(pointer,rect,transform);return at?combatScreenToWorld(transform,at.x,at.y):null;}
