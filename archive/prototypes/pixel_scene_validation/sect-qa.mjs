// Owned desktop instrumentation: real wall time and native window lifecycle.
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
export async function runSectQA(api, settings) {
  const host = window.sceneHost, checks = [], checkpoints = [];
  const startedAt = new Date().toISOString(), startWall = performance.now();
  const check = (name, ok, evidence = {}) => { checks.push({name,ok:!!ok,evidence}); if (!ok) throw Error('验证未通过：'+name); };
  const capture = name => host.capture(name+'.png');
  const point = label => {
    const v=api.view();
    checkpoints.push({label,wallSeconds:(performance.now()-startWall)/1000,tick:v.tick,resources:v.resources,
      people:v.people.map(p=>({id:p.id,x:p.x,y:p.y,activity:p.activity,indoor:p.indoor,energy:p.energy,realm:p.realm})),
      crop:v.crop,transports:v.transports,control:v.control,budget:v.budget,activity:api.activity(),
      construction:v.construction,sites:v.domain?.sites,buildings:v.buildings});
  };
  const report = async (phase, extra={}) => host.metrics({scenario:settings.qaScenario,phase,startedAt,
    wallSeconds:(performance.now()-startWall)/1000,checks,checkpoints,...api.metrics(),...extra});
  const until = async (predicate, timeout, label) => {
    const deadline=performance.now()+timeout;
    while(!predicate()) { if(performance.now()>deadline) throw Error('等待超时：'+label); await wait(100); }
  };
  let recorder=null, chunks=[], enduranceOrigin=0;
  async function startRecording() {
    const stream=api.canvas.captureStream(12);
    recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2500000});
    recorder.ondataavailable=e=>{if(e.data.size) chunks.push(e.data);}; recorder.start(1000);
  }
  async function stopRecording(name) {
    if(!recorder) return;
    const stopped=new Promise(resolve=>recorder.addEventListener('stop',resolve,{once:true}));
    recorder.stop(); await stopped;
    const bytes=await new Blob(chunks,{type:'video/webm'}).arrayBuffer();
    await host.recording({filename:name+'.webm',bytes});
    recorder.stream.getTracks().forEach(t=>t.stop()); recorder=null;chunks=[];
  }
  async function resume() {
    const saved=api.restored();
    check('关闭后保存可读',!!saved,{tick:saved?.state.worldTick});
    const before=JSON.stringify(saved);
    await wait(5000);
    check('重新打开停留入口不补离线时间',JSON.stringify(api.restored())===before,{tick:saved.state.worldTick});
    document.getElementById('continue').click();
    const resumed=api.snapshot();
    check('恢复同一人物与资源',JSON.stringify(resumed.state.personsById)===JSON.stringify(saved.state.personsById)
      &&JSON.stringify(resumed.state.stockpilesById)===JSON.stringify(saved.state.stockpilesById),{tick:resumed.state.worldTick});
    check('恢复原时钟与策略',resumed.state.worldTick===saved.state.worldTick&&JSON.stringify(resumed.policy)===JSON.stringify(saved.policy));
    check('恢复同一工程与建筑',JSON.stringify(resumed.state.workOrdersById)===JSON.stringify(saved.state.workOrdersById)
      &&JSON.stringify(resumed.state.buildingsById)===JSON.stringify(saved.state.buildingsById));
    return saved;
  }
  try {
    if(settings.qaScenario==='resume') {
      const saved=await resume();
      await wait(1200);
      check('继续后由实际经过时间推进',api.view().tick>saved.state.worldTick&&api.view().tick<=saved.state.worldTick+20);
      await capture('resume-live'); point('resumed'); await report('passed');
      await host.finish({});return;
    }
    if(settings.qaScenario==='domain-start') {
      document.getElementById('start').click();
      check('真实开局来源和两位院中人',api.view().provenance.kind==='normal-public-command-checkpoint'&&api.view().people.filter(p=>p.resident).length===2);
      check('旧院与东路处于同一场景',api.view().domain.enabled&&api.view().width===160&&api.view().sceneId==='scene:yunxiu-courtyard');
      api.issue({type:'rest'});
      api.renderer.showCourtyard();await wait(500);await capture('01-courtyard-scale');
      const stock=()=>api.view().stockpiles.find(s=>s.id==='stockpile:carried:master')?.resources||{};
      const master=()=>api.view().people.find(p=>p.id==='person:master');
      api.openBuilding();
      check('不足木材时营造入口显示缺口',document.getElementById('site-build').disabled&&api.view().resources.wood===25);
      await capture('02-build-materials');api.closeModal();
      await startRecording();
      for(let batch=1;batch<=2;batch++) {
        api.openBuilding();document.getElementById('gather-wood').click();
        check('第'+batch+'次采木进入真实活动',master().activityDetail?.kind==='sr-harvest');
        await until(()=>master().activityDetail?.kind!=='sr-harvest',120000,'采木完成');
        check('第'+batch+'批木材留在掌门随身库存',stock().wood===batch*12,{carried:stock().wood});
        point('wood-batch-'+batch);await report('collecting');
      }
      api.openBuilding();document.getElementById('deliver-materials').click();
      check('实物搬运接通公库',master().activityDetail?.kind==='sr-transport');
      await until(()=>master().activityDetail?.kind!=='sr-transport',120000,'木材入库');
      check('旧院木材实际入公库',api.view().resources.wood===49,{wood:api.view().resources.wood});
      api.openBuilding();check('材料足够后营造按钮可用',!document.getElementById('site-build').disabled);
      document.getElementById('site-build').click();
      check('东台工程开始真实运料',!!api.view().construction);
      await until(()=>master().x>98&&master().x<120&&api.view().construction?.materialFlow?.phase==='carrying',120000,'穿过旧院边界');
      const v=api.view();
      check('跨区携料先于施工',v.construction.progressTicks===0&&Object.values(v.construction.materialFlow.cargo).some(n=>n>0),{x:master().x,cargo:v.construction.materialFlow.cargo});
      point('east-road-carrying');await capture('03-crossing-east-road');
      await stopRecording('01-gather-deliver-build');
      check('运料途中手动保存完成',(await api.save()).ok);
      await report('passed',{closeExpectedTick:api.view().tick,construction:api.view().construction});
      await host.finish({});return;
    }
    if(settings.qaScenario==='domain-resume') {
      await resume();
      const initial=api.view(), activityId=initial.construction?.activityId;
      check('跨进程恢复途中同一份材料',!!activityId&&initial.construction.materialFlow.phase==='carrying'&&Object.values(initial.construction.materialFlow.cargo).some(n=>n>0));
      api.renderer.followPerson('person:master');await startRecording();
      point('construction-resumed');await capture('04-construction-resumed');
      await until(()=>api.view().domain.sites[0].status==='complete',240000,'东台门人居落成');
      const completed=api.view(), house=completed.buildings.find(b=>'building:yunxiu:'+b.id===completed.domain.sites[0].buildingId);
      check('同一工程落成实际门人居',!!house&&house.type==='house'&&house.capacity>0&&completed.construction===null,{house});
      const receipt=api.snapshot().state.spatial.completedOrders.find(w=>w.id===initial.construction.workOrderId);
      check('实际多趟运料完整交付',receipt?.materialTrips?.length===2&&receipt.materialTrips.every(t=>t.phase==='delivered'),{receipt});
      api.renderer.followPoint(135,46);await wait(700);await capture('05-east-residence');
      point('east-residence-complete');await report('construction-complete');await stopRecording('02-resume-to-residence');
      enduranceOrigin=api.metrics().runtimeSeconds;
    } else {
      document.getElementById('start').click();
    }
    await wait(1000);
    check('真实开局来源和两位院中人',api.view().provenance.kind==='normal-public-command-checkpoint'&&api.view().people.filter(p=>p.resident).length===2);
    await capture('01-entered'); point('entered');
    api.openPolicy();
    const pausedTick=api.view().tick; await wait(1000);
    check('阅读方略暂停同一世界',api.view().tick===pausedTick);
    document.getElementById('herb-target').value='30';
    document.getElementById('spending-cap').value='12';
    document.querySelector('input[name="risk"][value="cautious"]').checked=true;
    document.getElementById('policy-form').requestSubmit();
    check('设置保存并恢复运行',api.view().policy.herbTarget===30&&!api.view().paused);
    document.getElementById('control-toggle').click();
    check('随时接管掌门',api.view().control.mode==='manual');
    const move=api.issue({type:'move',x:20,y:30});
    check('手动行走接受实际路径',move.ok,{result:move});
    const beforeMove=api.view().people.find(p=>p.id==='person:master');
    await wait(2000);
    const afterMove=api.view().people.find(p=>p.id==='person:master');
    check('人物沿路径实际移动',Math.hypot(afterMove.x-beforeMove.x,afterMove.y-beforeMove.y)>.1);
    check('亲控宽限期保持',api.view().control.mode==='manual');
    document.getElementById('control-toggle').click();
    check('主动交回自主',api.view().control.mode==='auto');
    await startRecording();
    await host.windowControl('minimize');
    await until(()=>api.activity().minimized,5000,'实际最小化');
    const backTick=api.view().tick,backStart=performance.now();
    await wait(settings.qaScenario==='smoke'?6000:60000);
    const advanced=api.view().tick-backTick,wall=(performance.now()-backStart)/1000;
    check('原生最小化后台继续同一时钟',advanced>=Math.floor(wall*9)&&advanced<=Math.ceil(wall*11),{ticks:advanced,wallSeconds:wall});
    await host.windowControl('restore');
    await until(()=>!api.activity().minimized&&api.activity().visible,5000,'实际恢复窗口');
    point('background-return'); await capture('02-background-return');
    await stopRecording('01-start-and-background');
    if(settings.qaScenario==='smoke') {
      check('手动保存完成',(await api.save()).ok);
      const manualSavedTick=api.view().tick;await wait(2200);
      check('运行错误为零',api.metrics().errors.length===0);
      await report('passed',{manualSavedTick,closeExpectedTick:api.view().tick}); await host.finish({});return;
    }
    // Allow the same session to run unaccelerated for at least 1,200 seconds.
    let nextRecord=120, nextCapture=130, hasMinimized=false, restoredLong=false;
    while(api.metrics().runtimeSeconds-enduranceOrigin<1200) {
      const seconds=api.metrics().runtimeSeconds-enduranceOrigin;
      if(seconds>=nextRecord) { point('elapsed-'+Math.floor(seconds)); await report('running'); nextRecord+=60; }
      if(seconds>=nextCapture) { await capture('03-production'); nextCapture=Infinity; }
      if(seconds>=150&&!hasMinimized) { await host.windowControl('minimize'); await until(()=>api.activity().minimized,5000,'长时后台');hasMinimized=true; }
      if(seconds>=1050&&!restoredLong) { await host.windowControl('restore');await until(()=>!api.activity().minimized,5000,'长时后台返回');restoredLong=true;point('long-background-return'); }
      await wait(500);
    }
    const v=api.view();
    check('扩建后至少20分钟实际运行',api.metrics().runtimeSeconds-enduranceOrigin>=1200,{enduranceSeconds:api.metrics().runtimeSeconds-enduranceOrigin,runtimeSeconds:api.metrics().runtimeSeconds,wallSeconds:(performance.now()-startWall)/1000});
    check('长时间原生后台持续推进',api.metrics().backgroundSeconds>=850,{backgroundSeconds:api.metrics().backgroundSeconds});
    check('种苗实际送达',v.transports.some(t=>t.phase==='delivered'&&t.targetStockpileId===v.crop.stockpileId));
    check('收成实际搬回公库',v.transports.some(t=>t.phase==='delivered'&&t.sourceStockpileId===v.crop.stockpileId&&t.targetStockpileId==='stockpile:yunxiu'));
    check('公库灵草目标达到',v.resources.herb>=v.policy.herbTarget,{herb:v.resources.herb,target:v.policy.herbTarget});
    check('达标后人物自行安排修炼休整',v.people.filter(p=>p.resident).every(p=>['cultivate','rest','groundRest','learn','study'].includes(p.activity)),{people:v.people.filter(p=>p.resident).map(p=>({name:p.name,activity:p.activity}))});
    check('谨慎偏好守住采集许可',!v.ledger.some(e=>e.autonomous&&e.action==='startMasterHarvest'));
    check('自主整备没有超额度',v.budget.spent<=v.policy.spendingCap);
    check('运行错误为零',api.metrics().errors.length===0);
    api.renderer.showOverview();await wait(500);await capture('04-twenty-minutes');
    api.showJournal();await capture('05-results');api.closeModal();
    check('手动保存完成',(await api.save()).ok);
    const manualSavedTick=api.view().tick;await wait(2200);
    point('completed');await report('passed',{ledger:api.view().ledger,manualSavedTick,closeExpectedTick:api.view().tick});
    await host.finish({});
  } catch(error) {
    await stopRecording('failure-recording');
    checks.push({name:error.message,ok:false});await capture('failure');
    await report('failed',{failure:error.stack});
    await host.finish({failed:true});
  }
}
