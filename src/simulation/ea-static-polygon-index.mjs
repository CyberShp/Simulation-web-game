/** Candidate selection only: every surviving edge keeps the original predicate. */
const compiled=new WeakMap(),MAX_INDEX_CELLS=65536;
export const immutablePolygon=polygon=>Array.isArray(polygon)&&Object.isFrozen(polygon)&&polygon.length>=3&&polygon.every(p=>Array.isArray(p)&&Object.isFrozen(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
export function compileStaticPolygon(polygon,{cellSize=2}={}){
 if(!immutablePolygon(polygon))throw TypeError('Static polygon coordinates must be immutable finite arrays.');
 if(!Number.isFinite(cellSize)||cellSize<=0)throw TypeError('Polygon index cell size must be positive and finite.');
 let sizes=compiled.get(polygon);if(!sizes){sizes=new Map();compiled.set(polygon,sizes);}if(sizes.has(cellSize))return sizes.get(cellSize);
 const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),bounds=Object.freeze({left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)});
 const first=Math.floor(bounds.top/cellSize),last=Math.floor(bounds.bottom/cellSize),indexed=Number.isSafeInteger(first)&&Number.isSafeInteger(last)&&last-first<MAX_INDEX_CELLS,bands=indexed?new Map():null;
 if(bands)for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const lo=Math.floor(Math.min(polygon[i][1],polygon[j][1])/cellSize),hi=Math.floor(Math.max(polygon[i][1],polygon[j][1])/cellSize);
  for(let row=lo;row<=hi;row++){if(!bands.has(row))bands.set(row,[]);bands.get(row).push(i);}
 }
 const every=Array.from({length:polygon.length},(_,i)=>i);
 const contains=point=>{
  if(point.x<bounds.left||point.x>bounds.right||point.y<bounds.top||point.y>bounds.bottom)return false;
  const edges=bands?bands.get(Math.floor(point.y/cellSize))||[]:every;let inside=false;
  for(const i of edges){const a=polygon[i],b=polygon[(i+polygon.length-1)%polygon.length];if((a[1]>point.y)!==(b[1]>point.y)&&point.x<(b[0]-a[0])*(point.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}
  return inside;
 };
 // Conservative interior proof: if no boundary edge's bounding box touches
 // the rectangle, parity is constant throughout it. Ambiguous boxes fall back.
 const edgeBounds=polygon.map((a,i)=>{const b=polygon[(i+polygon.length-1)%polygon.length];return {left:Math.min(a[0],b[0]),right:Math.max(a[0],b[0]),top:Math.min(a[1],b[1]),bottom:Math.max(a[1],b[1])};});
 const coversBox=box=>{
  if(![box?.left,box?.right,box?.top,box?.bottom].every(Number.isFinite)||box.left>box.right||box.top>box.bottom||box.left<=bounds.left||box.right>=bounds.right||box.top<=bounds.top||box.bottom>=bounds.bottom)return false;
  if(edgeBounds.some(e=>e.left<=box.right&&e.right>=box.left&&e.top<=box.bottom&&e.bottom>=box.top))return false;
  return contains({x:(box.left+box.right)/2,y:(box.top+box.bottom)/2});
 };
 const query=Object.freeze({bounds,contains,coversBox,indexed});sizes.set(cellSize,query);return query;
}

/** The list and every coordinate are frozen; world/entity changes are irrelevant. */
export function compileStaticPolygonUnion(polygons,{cellSize=2}={}){
 if(!Array.isArray(polygons)||!Object.isFrozen(polygons)||!polygons.every(immutablePolygon))throw TypeError('Static polygon union inputs must be immutable.');
 const queries=polygons.map(p=>compileStaticPolygon(p,{cellSize})),cells=new Map();let entries=0,indexed=true;
 for(const query of queries){const b=query.bounds,left=Math.floor(b.left/cellSize),right=Math.floor(b.right/cellSize),top=Math.floor(b.top/cellSize),bottom=Math.floor(b.bottom/cellSize),size=(right-left+1)*(bottom-top+1);
  if(![left,right,top,bottom,size].every(Number.isSafeInteger)||size<0||entries+size>MAX_INDEX_CELLS){indexed=false;break;}entries+=size;
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const key=x+'/'+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(query);}
 }
 if(!indexed)cells.clear();
 const contains=point=>(indexed?cells.get(Math.floor(point.x/cellSize)+'/'+Math.floor(point.y/cellSize))||[]:queries).some(query=>query.contains(point));
 return Object.freeze({contains,indexed,polygonCount:polygons.length});
}
