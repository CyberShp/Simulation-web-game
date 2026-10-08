import {spatialEnabled,viewSpatial} from './ea-sr-spatial.mjs?v=ea-160-courtyard-20261008-r36';
import {buildingVisual,buildingAccess} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r36';

/** Read-only projection; never completes work or reserves another material. */
export function constructionView(s){if(spatialEnabled(s))return viewSpatial(s);
 const a=s.activitiesById?.[s.master.activityId];if(a?.kind!=='construction')return null;
 const work=s.workOrdersById[a.workOrderId];if(!work)return null;
 const progress=Math.min(1,work.progressTicks/work.durationTicks),building={type:a.type,x:a.x,y:a.y,level:1};
 return {building,...buildingVisual(building),access:buildingAccess(s,building),progress,
  stage:progress<1/3?'foundation':progress<2/3?'structure':'finishing',
  label:a.reason|| (a.phase==='moving'?'前往工地':a.phase==='blocked'?'等待场地安全':progress<1/3?'清理与地基':progress<2/3?'主体施工':'屋顶与整理')};
}
