import fs from 'node:fs';import crypto from 'node:crypto';
import {toArt,toWorld} from '../../../apps/courtyard/courtyard-space.mjs';
import {NORTH_LIBRARY_LAYOUT as OLD_LAYOUT,NORTH_LIBRARY_SITE as OLD_SITE} from '../../../apps/courtyard/courtyard-north-library-layout.mjs';
const dir=new URL('./',import.meta.url),L={x:836,y:-1848,width:1672,height:941},J={x:836,y:-1100,width:1672,height:941};
const world=(p,origin=L)=>toWorld(origin.x+p[0],origin.y+p[1]);
const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
const feet=[['cultivate','mat:1',632,605],['cultivate','mat:2',747,605],['cultivate','mat:3',866,605],['cultivate','mat:4',982,605],['work','work:1',635,540],['work','work:2',980,540]].map(([kind,suffix,x,y])=>({kind,suffix,native:[x,y],world:world([x,y]),bodyRadiusMetres:.26,bodyRadiiPixels:[20.8,7.8325]}));
const solids=[
 ['rear-west-post',rect(554,500,583,517),[[554,494],[564,485],[575,486],[582,496],[583,517],[554,517]],517],
 ['rear-east-post',rect(1033,500,1065,517),[[1035,494],[1042,485],[1055,486],[1064,496],[1065,517],[1033,517]],517],
 ['front-west-post',rect(522,643,555,667),[[525,616],[534,607],[544,607],[553,617],[555,667],[522,667]],667],
 ['front-east-post',rect(1065,643,1098,667),[[1067,615],[1076,607],[1086,608],[1097,618],[1098,667],[1065,667]],667],
 ['stair-west-post',rect(717,648,746,674),[[720,633],[727,624],[738,624],[745,634],[746,674],[717,674]],674],
 ['stair-east-post',rect(868,648,898,674),[[871,633],[879,623],[890,625],[897,635],[898,674],[868,674]],674],
 ['west-supply-base',rect(610,493,660,515),[[610,463],[618,452],[645,450],[658,460],[660,515],[610,515]],515],
 ['east-supply-base',rect(954,493,1005,515),[[954,463],[964,451],[993,452],[1005,463],[1005,515],[954,515]],515]
].map(([id,ground,occlusion,feetY])=>({id,nativeGround:ground,worldGround:ground.map(p=>world(p)),occlusion,feetY,condition:'complete level 1'}));
const stagePatches={
 complete:[[554,485],[582,485],[584,503],[609,503],[609,463],[618,449],[647,448],[661,460],[662,502],[952,502],[953,462],[963,449],[995,450],[1008,462],[1008,502],[1033,501],[1033,484],[1066,484],[1068,511],[1100,613],[1100,669],[900,677],[715,677],[519,669],[520,613],[548,511]],
 foundation:[[519,488],[558,485],[630,485],[630,457],[655,457],[656,478],[693,478],[693,466],[823,466],[839,484],[955,483],[956,457],[977,457],[978,483],[1046,484],[1070,500],[1103,670],[900,679],[712,679],[518,669]],
 construction:[[510,439],[549,439],[550,426],[646,426],[650,438],[1005,438],[1007,426],[1040,426],[1045,438],[1102,438],[1136,669],[901,680],[713,680],[510,669]]
};
const ground=rect(465,430,1400,810);
const road=[ [220,822],[1672,822],[1672,868],[359,868],[358,941],[262,941],[262,885],[220,858] ];
const approach=rect(755,672,846,835);
const entry3Ground=rect(914,794,972,838);
const entry3Patch=[[902,774],[980,774],[990,800],[992,836],[898,836],[899,801]];
const entry3Centre=[[940,844],[940,804.575]];
const southCentre=[[300,844],[800,844],[1415,844]];
const entryCentre=[[800,844],[800,710],[780,684.075]];
const joinCentre=[[416,889],[416,844],[416,795],[412,757],[386,727],[382,684],[377,645],[368,618],[359,598],[360,555],[363,515],[375,487],[400,467],[410,430],[420,399],[414,377],[389,355],[380,324],[373,294],[369,266],[346,242],[331,217],[311,196],[307,163],[306,129],[300,96]];
const joinWalk=[[266,90],[350,90],[352,117],[353,177],[367,208],[385,229],[401,249],[418,275],[419,320],[434,348],[455,368],[466,399],[463,443],[443,480],[414,503],[410,532],[409,581],[414,603],[428,624],[429,670],[433,719],[460,752],[460,861],[453,906],[378,906],[373,842],[373,758],[355,736],[346,708],[342,669],[338,622],[326,600],[320,560],[320,510],[326,484],[348,466],[354,441],[371,402],[365,375],[345,348],[338,315],[336,267],[317,236],[298,211],[274,178],[270,118]];
const joinMask=[[-32,45],[1704,45],[1704,650],[485,650],[485,742],[515,850],[515,925],[240,925],[205,730],[-32,650]];
const joinExclusions=[OLD_SITE.buildingPolygon.map(([x,y])=>[x+OLD_LAYOUT.x,y+OLD_LAYOUT.y])];
const sample=(pts,origin,step=4)=>{const out=[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let k=i===1?0:1;k<=n;k++){const p=[a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n];out.push(world(p,origin));}}return out;};
const roads=[{id:'library-west-ascent',origin:J,native:joinCentre,world:sample(joinCentre,J),endpointWorld:joinCentre.map(p=>world(p,J)),halfWidthMetres:.6},{id:'meditation-south-road',origin:L,native:southCentre,world:sample(southCentre,L),halfWidthMetres:.6},{id:'meditation-entry-1',origin:L,native:entryCentre,world:sample(entryCentre,L),halfWidthMetres:.6}];
roads.push({id:'meditation-entry-3-ground',origin:L,native:entry3Centre,world:sample(entry3Centre,L),halfWidthMetres:.36});
const notes=['Survey coordinates refer to normalized 1672x941 rendering. Source widths are 1671/1670; always draw assets with explicit layout width/height.','Visible L1 paving exceeds the 6m reservation on the east; exterior posts are separately solid. Final legal terrain must combine surveyed ground and solids.','Upper level platform visual assets are future work. Maximum10m ground is clear. The shared entry3 ground layer opens the south curb for the default L3 entrance.','Measured source tolerance is about4px. Core circle and collision tests are separate from this image survey.'];
const survey={version:'north-meditation-ground-survey-1',date:'2026-10-18',source:'complete-v4 / empty-v1 / foundation-v1 / construction-v1 / join-v2',status:'pixel-survey and Canvas candidate',tile:L,join:J,worldAnchor:{x:44,y:-46},worldNorth:-52,feet,defaultEntrance:{world:{x:47,y:-39.4},native:[780,684.075]},solids,stagePatches,visiblePaving:[[559,508],[1056,508],[1080,638],[536,638]],stairs:[[744,638],[868,638],[863,674],[746,674]],ground:{native:ground,world:ground.map(p=>world(p))},roads,walkPolygons:[{id:'maximum-clear-ground',origin:L,native:ground,world:ground.map(p=>world(p))},{id:'south-public-road',origin:L,native:road,world:sample([...road,road[0]],L)},{id:'private-approach',origin:L,native:approach,world:approach.map(p=>world(p))},{id:'library-west-ascent',origin:J,native:joinWalk,world:sample([...joinWalk,joinWalk[0]],J)}],joinMask:{native:joinMask,global:joinMask.map(([x,y])=>[x+J.x,y+J.y]),feather:24},notes};
survey.joinMask.excludeGlobal=joinExclusions;
survey.version='north-meditation-ground-survey-2';
survey.walkPolygons.push({id:'entry-3-shared-ground',origin:L,native:entry3Ground,world:entry3Ground.map(p=>world(p))});
survey.sharedGround={image:'north-meditation-entry3-ground-v3.png',x:L.x+880,y:L.y+750,width:130,height:120,sourceWidth:1305,sourceHeight:1205,polygon:entry3Patch.map(([x,y])=>[L.x+x,L.y+y]),nativePolygon:entry3Patch,feather:3,allStages:true,entrance:{world:{x:49,y:-35.4},native:[940,804.575]}};
fs.writeFileSync(new URL('ground-and-join-survey.json',dir),JSON.stringify(survey,null,2)+'\n');
const layout={...L,sourceWidths:{complete:1671,empty:1671,foundation:1671,construction:1670}},images={complete:'north-meditation-complete-v4.png',empty:'north-meditation-empty-v1.png',foundation:'north-meditation-foundation-v1.png',construction:'north-meditation-construction-v1.png'},site={id:'site:domain:gc-03',planId:'GC-03',type:'meditation',world:{x:44,y:-46},indoor:false,entrance:[780,684.075],footprint:rect(540,485.25,1020,666),standingPolygon:rect(755,674,846,708),selectionPolygon:stagePatches.complete,patch:rect(510,426,1138,680),stagePatches,feetY:674,maximumReserve:rect(540,485.25,1340,786.5),feet,solids};
fs.writeFileSync(new URL('../../../apps/courtyard/courtyard-north-meditation-layout.mjs',dir),`/** U-167 / GC03: surveyed fixed-camera outdoor meditation platform. */\nexport const NORTH_MEDITATION_LAYOUT=Object.freeze(${JSON.stringify(layout)});\nexport const NORTH_MEDITATION_IMAGES=Object.freeze(${JSON.stringify(images)});\nexport const NORTH_MEDITATION_SITE=Object.freeze(${JSON.stringify(site)});\nexport const NORTH_MEDITATION_ROADS=Object.freeze(${JSON.stringify(roads)});\nexport const NORTH_MEDITATION_WALK_POLYGONS=Object.freeze(${JSON.stringify(survey.walkPolygons)});\nexport const NORTH_MEDITATION_JOIN=Object.freeze(${JSON.stringify({...J,image:'north-meditation-join-v2.png',polygons:[survey.joinMask.global],excludePolygons:joinExclusions,feather:24})});\n`);
fs.appendFileSync(new URL('../../../apps/courtyard/courtyard-north-meditation-layout.mjs',dir),`export const NORTH_MEDITATION_SHARED_GROUND=Object.freeze(${JSON.stringify(survey.sharedGround)});\n`);
console.log(JSON.stringify({feet,joinEnds:roads[0].endpointWorld.filter((_,i)=>i===0||i===joinCentre.length-1),survey:new URL('ground-and-join-survey.json',dir).pathname}));
