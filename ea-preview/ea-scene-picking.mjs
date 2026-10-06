/** CSS-sized hit targets derived from the same actual actor feet as rendering. */
export function personHitCandidates(point,people,{scale=1,height=58,minCssSize=44}={}){
 const width=Math.max(34,minCssSize/scale),hitHeight=Math.max(height,minCssSize/scale);
 return people.filter(p=>Math.abs(point.x-p.x)<=width/2&&point.y>=p.y-height+(height-hitHeight)/2&&point.y<=p.y+6+(hitHeight-height)/2)
  .sort((a,b)=>b.y-a.y||String(a.id).localeCompare(String(b.id))).map(p=>({id:p.id,name:p.name||p.d?.name||'掌门',activity:p.activity||p.d?.mind?.activity||'rest',x:p.x,y:p.y}));
}
