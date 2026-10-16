/** Visible desktop integration exercise. Uses the same commands and clock as play. */
export async function createArenaQA({scenario,sceneSettings,host,api}) {
  const checks=[],captures=[],timeline=[];let phase='begin',busy=false,start=performance.now(),phaseAt=start,finished=false;
  let frozen=null,saved=null,firstOutcome=null,recording=null;
  const p=()=>api.getState().actors.find(a=>a.id==='master');
  const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)console.error('ARENA_QA_FAIL',name,JSON.stringify(detail));};
  const go=name=>{phase=name;phaseAt=performance.now();timeline.push({phase:name,tick:api.getState().tick});};
  const capture=async name=>{await host.capture(name);captures.push(name);};
  const act=action=>api.issue(action,{silent:true,automated:true});
  if(sceneSettings.record){const stream=api.canvas.captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:7500000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(1000);recording={stream,chunks,recorder};}
  async function finish(){
    if(finished)return;finished=true;api.setPaused(true);
    if(recording){await new Promise(resolve=>{recording.recorder.onstop=resolve;recording.recorder.stop();});await host.recording({filename:'arena-playthrough.webm',bytes:await new Blob(recording.chunks,{type:'video/webm'}).arrayBuffer()});recording.stream.getTracks().forEach(t=>t.stop());}
    const metrics={scenario,checks,captures,timeline,durationSeconds:(performance.now()-start)/1000,final:api.getState(),...api.getMetrics()};
    await host.metrics(metrics);await host.finish({failed:checks.some(c=>!c.ok)||metrics.errors.length>0});
  }
  async function step(now){
    const s=api.getState();
    if(now-start>180000){check('integration_finished_in_180_seconds',false,{phase});await finish();return;}
    if(!api.getActive()||now-start<350)return;
    if(scenario==='restart-write'){
      if(phase==='begin'){api.newBattle('duel');act({type:'cast',skill:'fire',targetId:'red-1'});go('writing-flight');}
      else if(phase==='writing-flight'&&p().action?.released){api.setPaused(true);check('unresolved_flight_saved_before_process_exit',!p().action.impacted&&await api.saveGame(true));await capture('restart-write.png');await finish();}return;
    }
    if(scenario==='restart-read'){
      if(phase==='begin'){const file=await api.readSaved();check('prior_process_file_found',file.ok&&file.found);saved=file.data;const ok=await api.loadGame();check('cross_process_snapshot_exact',ok&&JSON.stringify(saved)===JSON.stringify(api.getState()));await capture('restart-read.png');api.setPaused(false);go('restart-resolved');}
      else if(phase==='restart-resolved'&&s.tick>saved.tick+10){check('cross_process_cast_resolves_once',s.events.filter(e=>e.kind==='release'&&e.sourceId==='master'&&e.skill==='fire').length===1&&s.events.filter(e=>['hit','miss'].includes(e.kind)&&e.sourceId==='master'&&e.skill==='fire').length===1);await finish();}return;
    }
    if(phase==='begin'){
      await capture('01-ready.png');api.newBattle('duel');api.setPaused(true);const before=p();act({type:'cast',skill:'ward'});frozen=api.getState();
      check('paused_plan_has_no_cost',p().qi===before.qi&&p().cooldowns.ward===before.cooldowns.ward&&frozen.plannedCommand?.skill==='ward');go('paused');
    }else if(phase==='paused'&&now-phaseAt>1000){
      check('pause_freezes_rule_snapshot',JSON.stringify(s)===JSON.stringify(frozen));await capture('02-paused-plan.png');api.setPaused(false);go('ward');
    }else if(phase==='ward'&&s.tick>=4){
      check('resume_executes_planned_ward',p().shield>0&&p().qi<p().maxQi&&s.events.some(e=>e.kind==='ward'&&e.sourceId==='master'));
      const before=p();const rejected=act({type:'cast',skill:'fire',targetId:'red-1'});check('busy_reject_no_extra_cost',!rejected.ok&&p().qi===before.qi&&p().cooldowns.fire===before.cooldowns.fire);
      await capture('03-ward.png');go('prepare-save');
    }else if(phase==='prepare-save'&&!p().action){
      act({type:'select',targetId:'red-1'});const result=act({type:'cast',skill:'fire',targetId:'red-1'});if(!result.ok)act({type:'attack',targetId:'red-1'});else go('save-flight');
    }else if(phase==='save-flight'&&p().action?.released){
      api.setPaused(true);saved=api.getState();check('flight_snapshot_has_unresolved_action',saved.actors.find(a=>a.id==='master').action?.released&&!saved.actors.find(a=>a.id==='master').action?.impacted);
      const savedOk=await api.saveGame(true);const readOk=await api.loadGame();check('file_save_load_exact_snapshot',savedOk&&readOk&&JSON.stringify(saved)===JSON.stringify(api.getState()));await capture('04-restored-flight.png');api.setPaused(false);go('resolved');
    }else if(phase==='resolved'&&s.tick>saved.tick+8){
      const releases=s.events.filter(e=>e.kind==='release'&&e.sourceId==='master'&&e.skill==='fire');const outcomes=s.events.filter(e=>['hit','miss'].includes(e.kind)&&e.sourceId==='master'&&e.skill==='fire');
      check('restored_cast_resolves_once',releases.length===1&&outcomes.length===1,{releases:releases.length,outcomes:outcomes.length});api.newBattle('team',true);go('team');
    }else if(phase==='team'){
      if(s.tick>=40&&!captures.includes('05-team.png'))await capture('05-team.png');
      if(s.tick>=90&&!captures.includes('06-team-skills.png'))await capture('06-team-skills.png');
      if(s.tick>=170&&!captures.includes('07-team-result-near.png'))await capture('07-team-result-near.png');
      if(s.status!=='active'){
        firstOutcome=s;check('team_reaches_victory',s.status==='victory',{status:s.status,tick:s.tick});
        check('actual_player_and_both_teams_hit',s.events.some(e=>e.kind==='hit'&&e.sourceId==='master'&&e.amount>0)&&s.events.some(e=>e.kind==='hit'&&e.sourceId?.startsWith('blue-'))&&s.events.some(e=>e.kind==='hit'&&e.sourceId?.startsWith('red-')));
        check('all_three_skills_released', ['sword','fire','ward'].every(skill=>s.events.some(e=>e.kind==='release'&&e.skill===skill&&e.sourceId==='master')));
        await capture('08-victory.png');go('result-hold');
      }
    }else if(phase==='result-hold'&&now-phaseAt>1000){
      check('terminal_snapshot_frozen',JSON.stringify(s)===JSON.stringify(firstOutcome));api.newBattle('duel',false);go('defeat');
    }else if(phase==='defeat'&&s.status!=='active'){
      check('idle_duel_reaches_defeat',s.status==='defeat',{tick:s.tick,status:s.status});await capture('09-defeat.png');api.newBattle('duel');act({type:'retreat'});go('retreat');
    }else if(phase==='retreat'&&now-phaseAt>500){
      check('new_bout_and_retreat',s.status==='retreated'&&s.tick<5&&s.events.filter(e=>e.kind==='result').length===1);await capture('10-retreat.png');await finish();
    }
  }
  return {update(now){if(busy||finished)return;busy=true;step(now).catch(async error=>{check('integration_exception',false,{message:error.stack});await finish();}).finally(()=>{busy=false;});}};
}
