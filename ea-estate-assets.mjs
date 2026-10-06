/** SR-XF-004: versioned, individually registered transparent estate sprites.
 * Geometry is always supplied by the existing metre prefab, never this atlas.
 * Rectangles are source-pixel crops; no decorative world is baked into them.
 */
export const ESTATE_ART_VERSION='yunxiu-modular-20261006-v1';
export const ESTATE_ART_URLS={core:'./assets/estate-v1/core.webp',life:'./assets/estate-v1/life.webp',outdoor:'./assets/estate-v1/outdoor.webp',terrain:'./assets/map.webp',nature:'./assets/estate-v1/nature-20261007.webp',meadow:'./assets/estate-v1/meadow-20261007.webp'};
export const ESTATE_SPRITES=Object.freeze({
 hall:{atlas:'core',rect:[31,52,730,621],door:[.48,.87],rise:3.2},
 library:{atlas:'core',rect:[764,44,468,627],door:[.35,.86],rise:5.0},
 alchemy:{atlas:'core',rect:[34,687,602,508],door:[.44,.88],rise:3.2},
 workshop:{atlas:'core',rect:[645,713,596,519],door:[.36,.86],rise:2.8},
 house:{atlas:'life',rect:[42,44,605,592],door:[.37,.86],rise:2.8},
 kitchen:{atlas:'life',rect:[660,91,577,550],door:[.34,.86],rise:2.8},
 clinic:{atlas:'life',rect:[43,655,595,562],door:[.38,.86],rise:2.8},
 watchtower:{atlas:'life',rect:[663,623,554,600],door:[.35,.89],rise:3.1},
 meditation:{atlas:'outdoor',rect:[40,25,747,465],door:[.42,.91],rise:.3},
 well:{atlas:'outdoor',rect:[831,68,682,421],door:[.48,.89],rise:.6},
 lumber:{atlas:'outdoor',rect:[25,494,757,503],door:[.44,.89],rise:2.0},
 quarry:{atlas:'outdoor',rect:[782,498,745,502],door:[.47,.9],rise:1.8}
});

export function estateSpriteBounds(b,c,{project,prefab,transform}){
 const art=ESTATE_SPRITES[b.type];if(!art)return null;
 const d=typeof prefab==='function'?prefab(b):prefab,t=typeof transform==='function'?transform(b):transform;
 if(!d||!t)return null;
 const corners=[[0,0],[d.width,0],[d.width,d.height],[0,d.height]].map(([x,y])=>project({x:t.x+x,y:t.y+y},c));
 const centre=project({x:t.x+d.width/2,y:t.y+d.height/2},c),front=project({x:t.x+d.width,y:t.y+d.height},c);
 const footprintWidth=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x));
 const width=footprintWidth*1.06,height=width*art.rect[3]/art.rect[2],bottom=front.y+.12*c.scale;
 return {art,x:centre.x-width/2,y:bottom-height,width,height,bottom,corners,depth:t.x+t.y+d.width+d.height,door:project({x:t.x+(d.door?.x??d.width/2),y:t.y+d.height},c)};
}

export function drawEstateExterior(ctx,b,c,images,options={}){
 const box=estateSpriteBounds(b,c,options),im=box&&images?.[box.art.atlas];if(!box||!im||!im.width)return false;
 ctx.save();ctx.globalAlpha=options.alpha??1;
 const [sx,sy,sw,sh]=box.art.rect;ctx.drawImage(im,sx,sy,sw,sh,box.x,box.y,box.width,box.height);ctx.restore();return true;
}

/** Alpha-aware picking uses the exact rendered source pixels, including roofs.
 * A failed/tainted image falls back to the prefab; transparent corners never
 * become a huge rectangle that steals clicks from nearby people or buildings.
 */
const alphaCache=new WeakMap();
export function estateSpriteContains(q,b,c,images,options={}){
 const box=estateSpriteBounds(b,c,options),im=box&&images?.[box.art.atlas];if(!box||!im||!im.width||q.x<box.x||q.x>box.x+box.width||q.y<box.y||q.y>box.y+box.height)return false;
 let data=alphaCache.get(im);if(data===undefined){data=null;try{const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(im.width,im.height):typeof document!=='undefined'?document.createElement('canvas'):null;if(canvas){canvas.width=im.width;canvas.height=im.height;const cx=canvas.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0);data={width:im.width,pixels:cx.getImageData(0,0,im.width,im.height).data};}}catch{}alphaCache.set(im,data);}
 if(!data)return false;
 const [sx,sy,sw,sh]=box.art.rect,x=Math.min(im.width-1,Math.max(0,Math.floor(sx+(q.x-box.x)/box.width*sw))),y=Math.min(im.height-1,Math.max(0,Math.floor(sy+(q.y-box.y)/box.height*sh)));
 return data.pixels[(y*data.width+x)*4+3]>96;
}
