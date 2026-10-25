/** Pure route planning over the caller's independently cloned world snapshot. */
import {routeArt} from './courtyard-space.mjs';
import {residentialMovementWaypoints} from './courtyard-navigation.mjs';
import {hydrateState} from '../../src/simulation/ea-state-v6.mjs';

export function planCourtyardRoute({state,from,to,options}){
 // Structured cloning intentionally carries canonical entities, not hydration getters.
 hydrateState(state);
 const samples=routeArt(from,to,options);
 const route=samples&&residentialMovementWaypoints(state,from,samples,options);
 return route?.length?{ok:true,samples,route}:{ok:false,error:'这里是屋墙、山石或未接通的地面，请选择院内道路。'};
}
if(typeof self!=='undefined')self.onmessage=event=>{
 const {requestId,payload}=event.data||{},started=performance.now();
 try{self.postMessage({requestId,...planCourtyardRoute(payload),workerDurationMs:performance.now()-started});}
 catch(error){self.postMessage({requestId,ok:false,error:'路线规划未完成：'+(error?.message||String(error)),workerDurationMs:performance.now()-started});}
};
