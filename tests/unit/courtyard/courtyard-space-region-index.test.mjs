/** Original linear ground predicate retained as an independent parity oracle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {isArtWalkable,toArt,toWorld,ART_WIDTH,ART_HEIGHT,DOMAIN_ART_LEFT,DOMAIN_ART_WIDTH,VALLEY_ART_LEFT,RESIDENCES_ART_RIGHT,SERVICES_ART_RIGHT,NORTH_LIBRARY_ART_TOP,NORTH_MEDITATION_ART_TOP} from '../../../apps/courtyard/courtyard-space.mjs';
import {courtyardMainArtWalkable} from '../../../src/simulation/ea-courtyard-visible-ground.mjs';
import {courtyardTerrainPointClear} from '../../../src/simulation/ea-courtyard-master-terrain.mjs';
import {domainContains,DOMAIN_VALLEY_EXTENT_VERSION,DOMAIN_EXTENT_VERSION,DOMAIN_EAST_EXTENT_VERSION,EAST_RESIDENCES_VERSION,EAST_SERVICES_VERSION,EAST_RESIDENCES_WALK_POLYGONS,EAST_SERVICES_WALK_POLYGONS,WEST_VALLEY_WALK_POLYGONS,NORTH_LIBRARY_VERSION,NORTH_LIBRARY_WALK_POLYGONS,NORTH_MEDITATION_VERSION,NORTH_MEDITATION_WALK_POLYGONS} from '../../../src/simulation/ea-sect-domain.mjs';
import {WEST_WORKSHOPS_VERSION,WEST_WORKSHOPS_WALK_POLYGONS} from '../../../src/simulation/ea-west-workshops-geometry.mjs';
import {WEST_WORKSHOPS_ART_LEFT,WEST_WORKSHOPS_ART_TOP} from '../../../apps/courtyard/courtyard-west-workshops-layout.mjs';
import {joinDepthShift,eastVisibleRoadInterior,eastRoadArtGroundPoint} from '../../../src/simulation/ea-courtyard-east-visible-geometry.mjs';
import {EAST_LAYOUT,EAST_TERRACE_WALK} from '../../../apps/courtyard/courtyard-east-layout.mjs';
import {WEST_LAYOUT,WEST_PATH_CENTER,WEST_WALK_POLYGONS} from '../../../apps/courtyard/courtyard-west-layout.mjs';
const inPolygon = (x,y,points) => {
  let inside = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if ((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
};
const segmentDistance = (x,y,a,b) => {
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
};

function legacyWalkable(x,y,{terrain=true,domain=true,west=true,valley=false,residences=false,services=false,northLibrary=false,northMeditation=false,westWorkshops=false}={}) {
  if(!domain&&(x<0||x>ART_WIDTH)||!west&&x<0)return false;
  if (!Number.isFinite(x)||!Number.isFinite(y)||x<(westWorkshops?WEST_WORKSHOPS_ART_LEFT:valley?VALLEY_ART_LEFT:DOMAIN_ART_LEFT)||y<(northMeditation?NORTH_MEDITATION_ART_TOP:northLibrary?NORTH_LIBRARY_ART_TOP:westWorkshops?WEST_WORKSHOPS_ART_TOP:0)||x>(services?SERVICES_ART_RIGHT:residences?RESIDENCES_ART_RIGHT:DOMAIN_ART_WIDTH)||y>ART_HEIGHT) return false;
  const artY=y;y-=joinDepthShift(x);
  const world=toWorld(x,artY),extent=valley?DOMAIN_VALLEY_EXTENT_VERSION:west?DOMAIN_EXTENT_VERSION:DOMAIN_EAST_EXTENT_VERSION,residenceVersion=residences?EAST_RESIDENCES_VERSION:null,serviceVersion=services?EAST_SERVICES_VERSION:null,northVersion=northLibrary?NORTH_LIBRARY_VERSION:null,meditationVersion=northMeditation?NORTH_MEDITATION_VERSION:null,workshopsVersion=westWorkshops?WEST_WORKSHOPS_VERSION:null;
  if(westWorkshops&&WEST_WORKSHOPS_WALK_POLYGONS.some(p=>inPolygon(world.x,world.y,p)))return domainContains(world,.26,extent,residenceVersion,serviceVersion,northVersion,meditationVersion,workshopsVersion)&&(!terrain||courtyardTerrainPointClear(world));
  if(northMeditation&&NORTH_MEDITATION_WALK_POLYGONS.some(p=>inPolygon(world.x,world.y,p)))return domainContains(world,.26,extent,residenceVersion,serviceVersion,northVersion,meditationVersion)&&(!terrain||courtyardTerrainPointClear(world));
  if(northLibrary&&NORTH_LIBRARY_WALK_POLYGONS.some(p=>inPolygon(world.x,world.y,p)))return domainContains(world,.26,extent,residenceVersion,serviceVersion,northVersion,meditationVersion)&&(!terrain||courtyardTerrainPointClear(world));
  if(services&&(x>=RESIDENCES_ART_RIGHT||EAST_SERVICES_WALK_POLYGONS.some(p=>inPolygon(world.x,world.y,p))))return domainContains(world,.26,extent,residenceVersion,serviceVersion);
  if(residences&&(x>=6688||x>=6312&&inPolygon(world.x,world.y,EAST_RESIDENCES_WALK_POLYGONS.at(-1))))return domainContains(world,.26,extent,residenceVersion,serviceVersion);
  if(valley&&west&&x<0&&WEST_VALLEY_WALK_POLYGONS.some(p=>inPolygon(world.x,world.y,p)))return domainContains(world,.26,extent);
  if(west&&x<78){const local=x-WEST_LAYOUT.x;return (WEST_WALK_POLYGONS.some(p=>inPolygon(local,y,p))||WEST_PATH_CENTER.slice(1).some((b,i)=>segmentDistance(local,y,WEST_PATH_CENTER[i],b)<=24))&&domainContains(toWorld(x,artY),.26,extent,residenceVersion,serviceVersion);}
  if(x>1440&&eastRoadArtGroundPoint(x,y))return domainContains(toWorld(x,artY),.26,extent,residenceVersion,serviceVersion);
  if(x>=EAST_LAYOUT.terraceX)return EAST_TERRACE_WALK.some(p=>inPolygon(x-EAST_LAYOUT.terraceX,y,p))&&domainContains(toWorld(x,artY),.26,extent,residenceVersion,serviceVersion);
  if (terrain&&!courtyardTerrainPointClear(toWorld(x,artY))) return false;
  return courtyardMainArtWalkable(x,y);
}

const all={terrain:true,domain:true,west:true,valley:true,residences:true,services:true,northLibrary:true,northMeditation:true,westWorkshops:true};
const regions=[['westWorkshops',WEST_WORKSHOPS_WALK_POLYGONS],['northMeditation',NORTH_MEDITATION_WALK_POLYGONS],['northLibrary',NORTH_LIBRARY_WALK_POLYGONS],['services',EAST_SERVICES_WALK_POLYGONS],['residences',EAST_RESIDENCES_WALK_POLYGONS],['valley',WEST_VALLEY_WALK_POLYGONS]];
test('indexed authored ground keeps the original linear parity at region edges and enable changes',()=>{
 let checked=0;
 for(const [flag,polygons] of regions){assert(Object.isFrozen(polygons));for(const polygon of polygons){assert(Object.isFrozen(polygon)&&polygon.every(Object.isFrozen));
  for(const i of new Set([0,Math.floor(polygon.length/2),polygon.length-1])){
   const a=polygon[i],b=polygon[(i+1)%polygon.length];
   for(const t of [0,.5])for(const [dx,dy]of [[0,0],[1e-9,0],[-1e-9,0],[0,1e-9],[0,-1e-9]]){
    const p=toArt(a[0]+(b[0]-a[0])*t+dx,a[1]+(b[1]-a[1])*t+dy);
    for(const options of [all,{...all,[flag]:false},{...all,terrain:false}]){assert.equal(isArtWalkable(p.x,p.y,options),legacyWalkable(p.x,p.y,options),JSON.stringify({flag,p,options}));checked++;}
   }
  }
 }}
 assert(checked>10000);
});
test('repeated coordinates retain current region flags and precise subpixel boundaries',()=>{
 for(const p of [{x:34.018181818181816,y:.8},{x:47.426675463145095,y:12.922794800859787},{x:47.4266754831451,y:12.922794820859789},{x:149.64443102284392,y:66.85593171062435},{x:62.3979275102822,y:31}]){
  const a=toArt(p.x,p.y);for(let i=0;i<3;i++)for(const [flag]of regions)for(const value of [false,true]){const options={...all,[flag]:value};assert.equal(isArtWalkable(a.x,a.y,options),legacyWalkable(a.x,a.y,options));}
 }
 for(const p of [{x:NaN,y:1},{x:Infinity,y:1},{x:1,y:-Infinity}])assert.equal(isArtWalkable(p.x,p.y,all),legacyWalkable(p.x,p.y,all));
});
