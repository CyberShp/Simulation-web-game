/** Isolated continuous speed ruler and interruptible frame selector; no game state. */
export function createStudyController(config,{timing='equal'}={}){
 const clips=config.clips,run=config.runOrder,maps=config.phaseMap;
 let phase='idle',elapsed=0,x=0,held=false;
 const frames=()=>phase==='run'?run:clips[phase].frames;
 const durations=()=>phase==='run'?run.map(f=>config.timingsMs[timing][f]):frames().map(()=>clips[phase].durationMs/frames().length);
 const total=()=>phase==='run'?480:clips[phase].durationMs;
 function frameInfo(){
  const list=frames(),times=durations();let at=0;
  for(let i=0;i<list.length;i++){const end=at+times[i];if(elapsed<end-1e-9||i===list.length-1)return {sourceFrame:list[i],index:i,frameStart:at,frameDuration:times[i]};at=end;}
 }
 function snapshot(){return {phase,elapsedMs:elapsed,xMetres:x,heldD:held,speedMetresPerSecond:held?config.speedMetresPerSecond:0,timing,...frameInfo()};}
 function enter(name,source){phase=name;elapsed=0;const list=frames(),times=durations(),index=list.indexOf(source);if(index<0)throw Error('Unknown original pose');for(let i=0;i<index;i++)elapsed+=times[i];}
 function advance(dtMs){
  if(!Number.isFinite(dtMs)||dtMs<0)throw Error('Invalid study elapsed time');
  if(held)x+=config.speedMetresPerSecond*dtMs/1000;
  elapsed+=dtMs;
  if(phase==='start'&&elapsed>=total()){const rest=elapsed-total();phase='run';elapsed=rest;}
  if(phase==='run')elapsed%=480;
  if(phase==='stop'&&elapsed>=total()){const rest=elapsed-total();phase='settle';elapsed=rest;}
  if(phase==='idle'||phase==='settle')elapsed=Math.min(elapsed,total());
  return snapshot();
 }
 function keyDown(code){
  if(code!=='KeyD'||held)return snapshot();
  const prior=snapshot();held=true;
  if(phase==='idle'||phase==='settle'&&elapsed>=total())enter('start',clips.start.frames[0]);
  else if(phase==='stop'||phase==='settle'){
   const next=maps.restartEntryMap[prior.sourceFrame];enter(next.clip,next.sourceFrame);
  }
  return snapshot();
 }
 function keyUp(code){
  if(code!=='KeyD'||!held)return snapshot();
  const prior=snapshot();held=false;enter('stop',maps.stopEntryMap[prior.sourceFrame]);return snapshot();
 }
 function fixtureRun(source){x=0;held=true;enter('run',source);return snapshot();}
 function reset(){phase='idle';elapsed=0;x=0;held=false;return snapshot();}
 return {snapshot,advance,keyDown,keyUp,blur:()=>keyUp('KeyD'),fixtureRun,reset};
}

/** Public-event requirement checks. These are configured offline cases, not gameplay. */
export function responseMatrix(config){
 const rows=[];
 for(const timing of ['equal','contact'])for(const source of config.runOrder){
  const cases=[];
  for(const delay of [0,50,150]){
   const c=createStudyController(config,{timing});c.fixtureRun(source);
   const before=c.snapshot(),stopped=c.keyUp('KeyD'),after=c.advance(delay),restarted=c.keyDown('KeyD'),moved=c.advance(10);
   const pass=stopped.xMetres===before.xMetres&&after.xMetres===before.xMetres&&!stopped.heldD&&
    stopped.phase==='stop'&&restarted.heldD&&['start','run'].includes(restarted.phase)&&
    Math.abs(moved.xMetres-after.xMetres-config.speedMetresPerSecond*.01)<1e-10;
   if(!pass)throw Error('Immediate input requirement failed for source '+source);
   cases.push({restartDelayMs:delay,stopSourceFrame:stopped.sourceFrame,stoppedDeltaMetres:after.xMetres-before.xMetres,
    restartSourceFrame:restarted.sourceFrame,restartClip:restarted.phase,movedIn10ms:moved.xMetres-after.xMetres,pass});
  }
  rows.push({timing,runSourceFrame:source,cases});
 }
 return {scope:'continuous offline ruler controller; event mutation is synchronous, visible paint follows RAF; not formal runtime latency',rows,caseCount:rows.reduce((n,r)=>n+r.cases.length,0),allPassed:true};
}
