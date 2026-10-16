/** U-99 / SR-XF-003–006: one construction cell; navigation stays in metres. */
export const BUILDING_GRID=Object.freeze({version:'building-units-1',metres:2,columns:32,rows:32});
// Level-one footprints. Sizes are author defaults, not newly confirmed balance.
export const BUILDING_CELLS=Object.freeze(Object.fromEntries(Object.entries({
 hall:[4,4],farm:[2,2],lumber:[2,2],quarry:[2,2],house:[3,3],
 meditation:[3,3],alchemy:[3,3],library:[3,3],well:[1,1],granary:[2,2],
 kitchen:[3,3],clinic:[3,3],workshop:[3,3],watchtower:[2,2]
}).map(([type,[columns,rows]])=>[type,Object.freeze({columns,rows})])));
export const buildingGridEnabled=s=>s?.spatial?.buildingGridVersion===BUILDING_GRID.version;
export function buildingCellSize(type,level=1){
 const base=BUILDING_CELLS[type];if(!base)return null;
 const extra=Math.max(1,level||1)-1,columns=base.columns+extra,rows=base.rows+extra;
 return {columns,rows,count:columns*rows,width:columns*BUILDING_GRID.metres,height:rows*BUILDING_GRID.metres};
}
export function buildingCellLabel(type,level=1){const d=buildingCellSize(type,level);return d?`${d.columns}×${d.rows} 格 · 共 ${d.count} 格`:'';}
export function snapBuildingPoint(s,p){
 const step=buildingGridEnabled(s)?BUILDING_GRID.metres:.5;
 const snap=buildingGridEnabled(s)?n=>Math.floor((n+1e-8)/step)*step:n=>Math.round(n/step)*step;
 return {x:snap(p.x),y:snap(p.y)};
}
export const onBuildingGrid=n=>Number.isFinite(n)&&Math.abs(n/BUILDING_GRID.metres-Math.round(n/BUILDING_GRID.metres))<1e-8;
