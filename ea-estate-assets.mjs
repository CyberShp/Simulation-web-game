/** SR-XF-004: versioned, individually registered transparent estate sprites.
 * Geometry is always supplied by the existing metre prefab, never this atlas.
 * Rectangles are source-pixel crops; no decorative world is baked into them.
 */
export const ESTATE_ART_VERSION='yunxiu-modular-20261006-v1';
export const ESTATE_ART_URLS={core:'./assets/estate-v1/core.webp',life:'./assets/estate-v1/life.webp',outdoor:'./assets/estate-v1/outdoor.webp',terrain:'./assets/map.webp',nature:'./assets/estate-v1/nature-20261007.webp',meadow:'./assets/estate-v1/meadow-20261007.webp',houseStages:'./assets/estate-v1/house-stages-v2.png',hallStages:'./assets/estate-v1/hall-stages-v2.png',clinicStages:'./assets/estate-v1/clinic-stages-v2.png',libraryStages:'./assets/estate-v1/library-stages-v3.png',farmStages:'./assets/estate-v1/farm-stages-v1.png',lumberStages:'./assets/estate-v1/lumber-stages-v1.png',quarryStages:'./assets/estate-v1/quarry-stages-v1.png',meditationStages:'./assets/estate-v1/meditation-stages-v1.png',alchemyStages:'./assets/estate-v1/alchemy-stages-v3.png',wellStages:'./assets/estate-v1/well-stages-v1.png',granaryStages:'./assets/estate-v1/granary-stages-v1.png',kitchenStages:'./assets/estate-v1/kitchen-stages-v3.png',workshopStages:'./assets/estate-v1/workshop-stages-v3.png',watchtowerStages:'./assets/estate-v1/watchtower-stages-v1.png'};
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

/** SR-XF-004: one house footprint, seven authored exterior appearances.
 * The prefab still owns size, door, navigation and construction progress.
 */
export const HOUSE_STAGE_ART=Object.freeze(Object.fromEntries(Object.entries({
 preview:[20,25,437,420],foundation:[472,183,405,262],
 structure:[900,54,413,391],finishing:[1336,41,427,404],
 complete:[25,445,421,411],upgrade:[466,445,449,409],
 damaged:[926,445,419,413],
}).map(([stage,rect])=>[stage,Object.freeze({atlas:'houseStages',rect:Object.freeze(rect),door:[.37,.86],rise:2.8})])));

/** SR-XF-004-AC-01: seven authored hall appearances use the same metre prefab.
 * Equal crop dimensions and normalized visible base keep every stage anchored.
 */
export const HALL_STAGE_ART=Object.freeze(Object.fromEntries(Object.entries({
 preview:[13,35,420,400],foundation:[467,14,420,400],
 structure:[903,27,420,400],finishing:[1346,30,420,400],
 complete:[20,444,420,400],upgrade:[462,444,420,400],
 damaged:[900,443,420,400],
}).map(([stage,rect])=>[stage,Object.freeze({atlas:'hallStages',rect:Object.freeze(rect),door:[.48,.87],rise:3.2})])));

/** Adult healing beds remain owned by spatialPrefab; this is the clinic shell. */
export const CLINIC_STAGE_ART=Object.freeze(Object.fromEntries(Object.entries({
 preview:[43,45,400,400],foundation:[458,55,400,400],
 structure:[898,54,400,400],finishing:[1356,53,400,400],
 complete:[43,450,400,400],upgrade:[479,449,400,400],
 damaged:[922,450,400,400],
}).map(([stage,rect])=>[stage,Object.freeze({atlas:'clinicStages',rect:Object.freeze(rect),door:[.38,.86],rise:2.8})])));

/** Book seats and their capacity remain in the library metre prefab. */
export const LIBRARY_STAGE_ART=Object.freeze(Object.fromEntries(Object.entries({
 preview:[43,63,380,380],foundation:[472,53,380,380],
 structure:[919,52,380,380],finishing:[1357,61,380,380],
 complete:[46,475,380,380],upgrade:[482,474,380,380],
 damaged:[921,475,380,380],
}).map(([stage,rect])=>[stage,Object.freeze({atlas:'libraryStages',rect:Object.freeze(rect),door:[.35,.86],rise:5.0})])));

/** Further stage atlases share the authoritative spatialPrefab slots and access. */
const stageSprites=(atlas,rects,door,rise,aspect)=>Object.freeze(Object.fromEntries(Object.entries(rects).map(([stage,rect])=>[
 stage,Object.freeze({atlas,rect:Object.freeze(rect),door,rise,heightScale:aspect*rect[2]/rect[3]})
])));
export const FARM_STAGE_ART=stageSprites('farmStages',{
 preview:[0,45,443,345],foundation:[443,75,443,368],structure:[886,40,443,360],finishing:[1329,25,443,372],
 complete:[0,453,443,386],upgrade:[443,443,443,396],damaged:[886,478,443,365],
},[.5,1],.3,.65);
export const LUMBER_STAGE_ART=stageSprites('lumberStages',{
 preview:[0,40,443,400],foundation:[443,40,443,400],structure:[886,40,443,400],finishing:[1329,40,443,400],
 complete:[0,468,443,400],upgrade:[443,468,443,400],damaged:[886,468,443,400],
},[.44,.89],2,503/757);
export const QUARRY_STAGE_ART=stageSprites('quarryStages',{
 preview:[0,15,443,425],foundation:[443,15,443,425],structure:[886,15,443,425],finishing:[1329,15,443,425],
 complete:[0,448,443,425],upgrade:[443,448,443,425],damaged:[886,448,443,425],
},[.47,.9],1.8,502/745);
export const MEDITATION_STAGE_ART=stageSprites('meditationStages',{
 preview:[0,45,443,385],foundation:[443,45,443,385],structure:[886,45,443,385],finishing:[1329,45,443,385],
 complete:[0,455,443,385],upgrade:[443,455,443,385],damaged:[886,455,443,385],
},[.42,.91],.3,465/747);

export const ALCHEMY_STAGE_ART=stageSprites('alchemyStages',{
 preview:[0,0,443,443],foundation:[443,0,443,443],structure:[886,0,443,443],finishing:[1329,0,443,443],
 complete:[0,443,443,430],upgrade:[443,443,443,430],damaged:[886,443,443,430],
},[.44,.88],3.2,508/602);
export const WELL_STAGE_ART=stageSprites('wellStages',{
 preview:[0,65,443,360],foundation:[443,65,443,360],structure:[886,65,443,360],finishing:[1329,65,443,360],
 complete:[0,473,443,370],upgrade:[443,473,443,370],damaged:[886,473,443,370],
},[.48,.89],.6,421/682);
export const GRANARY_STAGE_ART=stageSprites('granaryStages',{
 preview:[0,0,443,410],foundation:[443,0,443,410],structure:[886,0,443,410],finishing:[1329,0,443,410],
 complete:[0,443,443,412],upgrade:[443,443,443,412],damaged:[886,443,443,412],
},[.5,1],.3,.65);
export const KITCHEN_STAGE_ART=stageSprites('kitchenStages',{
 preview:[0,0,443,443],foundation:[443,0,443,443],structure:[886,0,443,443],finishing:[1329,0,443,443],
 complete:[0,443,443,443],upgrade:[443,443,443,443],damaged:[886,443,443,443],
},[.34,.86],2.8,550/577);
export const WORKSHOP_STAGE_ART=stageSprites('workshopStages',{
 preview:[0,0,443,443],foundation:[443,0,443,443],structure:[886,0,443,443],finishing:[1329,0,443,443],
 complete:[0,443,443,420],upgrade:[443,443,443,420],damaged:[886,443,443,420],
},[.36,.86],2.8,519/596);
export const WATCHTOWER_STAGE_ART=stageSprites('watchtowerStages',{
 preview:[0,0,443,443],foundation:[443,0,443,443],structure:[886,0,443,443],finishing:[1329,0,443,443],
 complete:[0,443,443,443],upgrade:[443,443,443,443],damaged:[886,443,443,443],
},[.35,.89],3.1,600/554);

const STAGE_ART=Object.freeze({house:HOUSE_STAGE_ART,hall:HALL_STAGE_ART,clinic:CLINIC_STAGE_ART,library:LIBRARY_STAGE_ART,farm:FARM_STAGE_ART,lumber:LUMBER_STAGE_ART,quarry:QUARRY_STAGE_ART,meditation:MEDITATION_STAGE_ART,alchemy:ALCHEMY_STAGE_ART,well:WELL_STAGE_ART,granary:GRANARY_STAGE_ART,kitchen:KITCHEN_STAGE_ART,workshop:WORKSHOP_STAGE_ART,watchtower:WATCHTOWER_STAGE_ART});
/** A current-art pixel distinguishes a same-sized historical atlas; inspect once per loaded image. */
const CLOSED_STAGE_SIGNATURE=Object.freeze({
 hall:[165,715,87,49,11],house:[255,715,246,202,140],clinic:[180,685,220,181,138],
 library:[720,320,89,75,90],alchemy:[590,240,159,134,118],
 kitchen:[790,290,48,41,35],workshop:[780,310,58,25,13],
});
const stageSignatureCache=new WeakMap();
export function estateStageImageReady(type,image,canvasFactory){
 if(!STAGE_ART[type]||!image||image.width!==1774||image.height!==887)return false;
 const mark=CLOSED_STAGE_SIGNATURE[type];if(!mark)return true;
 let result=stageSignatureCache.get(image);if(result?.has(type))return result.get(type);
 const canvas=canvasFactory?.()||(typeof OffscreenCanvas==='function'?new OffscreenCanvas(1,1):typeof document!=='undefined'?document.createElement('canvas'):null);
 if(!canvas)return true; // Non-browser image inspection is supplied by the caller's canvasFactory.
 let valid=false;
 try{
  canvas.width=1;canvas.height=1;const cx=canvas.getContext('2d',{willReadFrequently:true});
  cx.drawImage(image,mark[0],mark[1],1,1,0,0,1,1);
  const pixel=cx.getImageData(0,0,1,1).data;
  valid=pixel[3]>240&&[0,1,2].every(i=>Math.abs(pixel[i]-mark[i+2])<=18);
 }catch{}
 if(!result){result=new Map();stageSignatureCache.set(image,result);}result.set(type,valid);
 return valid;
}
export function houseStageImageReady(image){return estateStageImageReady('house',image);}

function exteriorArt(b,visualStage,stageImageAvailable=true){
 const stageArt=STAGE_ART[b.type];
 if(stageArt&&stageImageAvailable)return stageArt[visualStage||'complete']||stageArt.complete;
 if(CLOSED_STAGE_SIGNATURE[b.type])return null;
 return ESTATE_SPRITES[b.type];
}

export function estateSpriteBounds(b,c,{project,prefab,transform,visualStage,stageImageAvailable=true}){
 const art=exteriorArt(b,visualStage,stageImageAvailable);if(!art)return null;
 const d=typeof prefab==='function'?prefab(b):prefab,t=typeof transform==='function'?transform(b):transform;
 if(!d||!t)return null;
 const corners=[[0,0],[d.width,0],[d.width,d.height],[0,d.height]].map(([x,y])=>project({x:t.x+x,y:t.y+y},c));
 const centre=project({x:t.x+d.width/2,y:t.y+d.height/2},c),front=project({x:t.x+d.width,y:t.y+d.height},c);
 const footprintWidth=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x));
 const width=footprintWidth*1.06*(art.widthScale||1),height=width*art.rect[3]/art.rect[2]*(art.heightScale||1),bottom=front.y+.12*c.scale;
 return {art,x:centre.x-width/2,y:bottom-height,width,height,bottom,corners,depth:t.x+t.y+d.width+d.height,door:project({x:t.x+(d.door?.x??d.width/2),y:t.y+d.height},c)};
}

function drawableBox(b,c,images,options){
 let box=estateSpriteBounds(b,c,options),im=box&&images?.[box.art.atlas];
 if(STAGE_ART[b.type]&&box?.art.atlas===STAGE_ART[b.type].complete.atlas&&!estateStageImageReady(b.type,im)){
  box=estateSpriteBounds(b,c,{...options,stageImageAvailable:false});im=box&&images?.[box.art.atlas];
 }
 if(box&&im){const [x,y,w,h]=box.art.rect;if(!im.width||!im.height||x+w>im.width||y+h>im.height)im=null;}
 return {box,im};
}

/** Keep finished stage art at its current screen resolution while the camera is stable.
 * Entries belong to one renderer and are bounded so repeated zooms cannot retain
 * every full-resolution size. The destination and the source art remain unchanged.
 */
export function createEstateExteriorRasterCache({maxBytes=32*1024*1024}={}){
 const entries=new Map(),imageIds=new WeakMap();
 let nextImageId=0,bytes=0,buildsRemaining=Infinity;
 return {
  beginFrame(){buildsRemaining=1;},
  draw(ctx,image,rect,box){
   if(typeof globalThis.OffscreenCanvas!=='function'||typeof ctx.getTransform!=='function')return false;
   let matrix;try{matrix=ctx.getTransform();}catch{return false;}
   if(!matrix||matrix.a<=0||matrix.d<=0||Math.abs(matrix.b)>1e-8||Math.abs(matrix.c)>1e-8)return false;
   const width=Math.max(1,Math.round(box.width*matrix.a)),height=Math.max(1,Math.round(box.height*matrix.d)),size=width*height*4;
   if(!Number.isFinite(size)||size>maxBytes||width>4096||height>4096)return false;
   let id=imageIds.get(image);if(id===undefined){id=++nextImageId;imageIds.set(image,id);}
   const key=[id,...rect,width,height,ctx.imageSmoothingEnabled,ctx.imageSmoothingQuality].join(':');
   let entry=entries.get(key);
   if(entry){entries.delete(key);entries.set(key,entry);}
   else{
    if(buildsRemaining<=0)return false;
    try{
     const surface=new OffscreenCanvas(width,height),surfaceCtx=surface.getContext('2d');
     if(!surfaceCtx)return false;
     surfaceCtx.imageSmoothingEnabled=ctx.imageSmoothingEnabled;
     surfaceCtx.imageSmoothingQuality=ctx.imageSmoothingQuality;
     surfaceCtx.drawImage(image,...rect,0,0,width,height);
     while(entries.size&&bytes+size>maxBytes){const oldest=entries.keys().next().value;bytes-=entries.get(oldest).size;entries.delete(oldest);}
     entry={surface,size};entries.set(key,entry);bytes+=size;
     buildsRemaining--;
    }catch{return false;}
   }
   ctx.drawImage(entry.surface,box.x,box.y,box.width,box.height);
   return true;
  },
  clear(){entries.clear();bytes=0;},
  snapshot(){return{entries:entries.size,bytes};},
 };
}

export function drawEstateExterior(ctx,b,c,images,options={}){
 const {box,im}=drawableBox(b,c,images,options);if(!box||!im||!im.width)return false;
 ctx.save();ctx.globalAlpha=options.alpha??1;
 const [sx,sy,sw,sh]=box.art.rect;
 if(!box.art.atlas.endsWith('Stages')||!options.rasterCache?.draw(ctx,im,box.art.rect,box))ctx.drawImage(im,sx,sy,sw,sh,box.x,box.y,box.width,box.height);
 ctx.restore();return true;
}

/** Alpha-aware picking uses the exact rendered source pixels, including roofs.
 * A failed/tainted image falls back to the prefab; transparent corners never
 * become a huge rectangle that steals clicks from nearby people or buildings.
 */
const alphaCache=new WeakMap();
export function estateSpriteContains(q,b,c,images,options={}){
 const {box,im}=drawableBox(b,c,images,options);if(!box||!im||!im.width||q.x<box.x||q.x>box.x+box.width||q.y<box.y||q.y>box.y+box.height)return false;
 let data=alphaCache.get(im);if(data===undefined){data=null;try{const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(im.width,im.height):typeof document!=='undefined'?document.createElement('canvas'):null;if(canvas){canvas.width=im.width;canvas.height=im.height;const cx=canvas.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0);data={width:im.width,pixels:cx.getImageData(0,0,im.width,im.height).data};}}catch{}alphaCache.set(im,data);}
 if(!data)return false;
 const [sx,sy,sw,sh]=box.art.rect,x=Math.min(im.width-1,Math.max(0,Math.floor(sx+(q.x-box.x)/box.width*sw))),y=Math.min(im.height-1,Math.max(0,Math.floor(sy+(q.y-box.y)/box.height*sh)));
 return data.pixels[(y*data.width+x)*4+3]>96;
}
