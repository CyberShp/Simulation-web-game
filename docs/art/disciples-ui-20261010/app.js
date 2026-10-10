const people = [
  {id:'master',name:'沈砚',rank:'掌门',peak:'主峰',realm:'炼气六层',portrait:0,mentor:'家传自修',office:'掌门',place:'主屋前庭',action:'料理旧院',reason:'伤势尚在恢复，今日先料理旧院事务。',art:'青岚养元诀',understanding:40,mastery:0,body:'需调养',goal:'重立山门，续回家传',memory:'抵达母亲留下的旧别院，在此落脚。',phase:'opening'},
  {id:'lu',name:'陆知微',rank:'内门',peak:'主峰',realm:'炼气三层',portrait:1,mentor:'沈砚',office:'药圃照料',place:'旧院药圃',action:'照看灵草',reason:'愿意照料药圃，也想继续研习草木之道。',art:'青木调息法',understanding:68,mastery:42,body:'无明显伤势',goal:'帮山院养出稳定药源',memory:'曾受赠药，后来选择与山院一同求道。',phase:'opening'},
  {id:'lin',name:'林长风',rank:'外门',peak:'主峰',realm:'炼气二层',portrait:2,mentor:'尚未定师',office:'暂无',place:'西侧居舍',action:'修整',reason:'完成晨间搬运后，正在居舍休息。',art:'青岚养元诀',understanding:31,mastery:12,body:'无明显伤势',goal:'踏实修行，寻一条长远的路',memory:'见旧院有人相助，自愿留下共建山门。',phase:'opening'},
  {id:'wen',name:'温照雪',rank:'亲传',peak:'主峰',realm:'炼气八层',portrait:4,mentor:'沈砚',office:'传功协助',place:'主峰藏经阁',action:'研习',reason:'正在校对基础心法的授课札记。',art:'青岚养元诀',understanding:86,mastery:73,body:'无明显伤势',goal:'守住宗门传承',memory:'与师父商议后，正式承担亲授传承。',phase:'peaks'},
  {id:'gu',name:'顾闻舟',rank:'内门',peak:'丹霞峰',realm:'炼气七层',portrait:3,mentor:'柳观澜',office:'丹师',place:'丹霞峰丹房',action:'炼丹',reason:'今日承接一炉养气丹，需先确认药材到位。',art:'丹霞药理经',understanding:75,mastery:61,body:'无明显伤势',goal:'把药理做成可传的本事',memory:'归峰后继续承担丹房事务。',phase:'peaks'},
  {id:'yan',name:'晏清禾',rank:'外门',peak:'丹霞峰',realm:'炼气一层',portrait:5,mentor:'尚未定师',office:'暂无',place:'丹霞峰住居',action:'用膳',reason:'今日先安顿住居，再看是否愿意参加药理课。',art:'青岚养元诀',understanding:22,mastery:4,body:'无明显伤势',goal:'求一门适合自己的修行路',memory:'拜山求见后正式入门，选择到丹霞峰生活。',phase:'peaks'}
];
const ui={view:'person',phase:'opening',person:'lu',detail:'status',rank:'outer',peak:'主峰',mentor:'沈砚'};
const game=document.querySelector('.game'),panel=document.querySelector('#scroll-panel'),content=document.querySelector('#scroll-content'),modal=document.querySelector('#modal-root'),toast=document.querySelector('#toast');
const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const portrait=index=>`style="--px:${index%3*50}%;--py:${Math.floor(index/3)*100}%"`;
const members=()=>people.filter(p=>ui.phase==='peaks'||p.phase==='opening');
const person=()=>members().find(p=>p.id===ui.person)||members()[0];
let toastTimer;
function notice(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3400)}
function folios(){return `<div class="folio-tabs"><button type="button" class="folio-tab" data-view="person" aria-current="${ui.view==='person'}">门籍</button><button type="button" class="folio-tab" data-view="petition" aria-current="${ui.view==='petition'}">求见</button></div>`}
function personDetails(p){
  if(ui.detail==='cultivation')return `<h3 class="ink-section">所习功法</h3><p class="ink-paragraph">${safe(p.art)} · 本人正在研习</p><div class="meter-row"><span>理解</span><div class="meter"><i style="width:${p.understanding}%"></i></div><b>${p.understanding}%</b></div><div class="meter-row"><span>熟练</span><div class="meter gold"><i style="width:${p.mastery}%"></i></div><b>${p.mastery}%</b></div><p class="brush-quote">典籍接触、师父授业与实际练习，决定接下来的修习。</p>`;
  if(ui.detail==='history')return `<h3 class="ink-section">行事纪事</h3><p class="brush-quote">${safe(p.memory)}</p><div class="ink-row"><span>近期去向</span><strong>${safe(p.place)}</strong></div><p class="ink-paragraph">入门、归峰、师承与重要经历随人物身份留存。</p>`;
  return `<h3 class="ink-section">此刻所见</h3><p class="brush-quote">${safe(p.reason)}</p><div class="ink-row"><span>当前</span><strong>${safe(p.action)}</strong></div><div class="ink-row"><span>身体</span><strong>${safe(p.body)}</strong></div><div class="ink-row"><span>志向</span><strong>${safe(p.goal)}</strong></div>`;
}
function personPage(){const p=person();return `${folios()}<div class="paper-kicker">${safe(p.peak)} · ${safe(p.rank)} · 门籍在卷</div><div class="member-strip" aria-label="选择门人">${members().map(m=>`<button type="button" class="member-seal" data-person="${m.id}" aria-label="${safe(m.name)}，${safe(m.peak)}${safe(m.rank)}" aria-current="${m.id===p.id}" ${portrait(m.portrait)}></button>`).join('')}</div><div class="hero-portrait" role="img" aria-label="${safe(p.name)}演示肖像" ${portrait(p.portrait)}></div><h2 class="person-name">${safe(p.name)}</h2><p class="person-sub">${safe(p.realm)} · ${safe(p.action)}</p><div class="identity-line"><b>${safe(p.rank)}</b><b>${safe(p.peak)}</b></div><div class="ink-row"><span>师承</span><strong>${safe(p.mentor)}</strong></div><div class="ink-row"><span>职事</span><strong>${safe(p.office)}</strong></div><div class="ink-row"><span>所在</span><strong>${safe(p.place)}</strong></div>${personDetails(p)}<div class="scroll-actions"><button type="button" class="minor-button" data-detail="${ui.detail==='status'?'cultivation':'status'}">${ui.detail==='status'?'看修习':'看近况'}</button><button type="button" class="minor-button" data-detail="history">看经历</button><button type="button" class="game-button" data-action="locate">山院定位</button></div><p class="sample-line">人物与数值为界面演示 · 正式版读取同一人物存档</p>`}
function petitionPage(){const rank={outer:'外门',inner:'内门',direct:'亲传'}[ui.rank];return `${folios()}<div class="paper-kicker">山门 · 求入门记录</div><h2 class="paper-title">秦溪求见</h2><div class="hero-portrait visitor" role="img" aria-label="秦溪演示肖像" ${portrait(5)}></div><p class="person-sub">候在山门石阶 · 尚待当面询问</p><div class="ink-row"><span>自报年岁</span><strong>十六</strong></div><div class="ink-row"><span>初看灵根</span><strong>木灵根</strong></div><p class="brush-quote">自青木镇而来，曾照料药圃，想求一门可修之法。</p><p class="ink-paragraph">此前师承与来历细节仍待核实；掌门只据已知信息判断。</p><h3 class="ink-section">拟授门籍</h3><div class="rank-choices" role="group" aria-label="拟授身份"><button type="button" class="seal-choice" data-rank="outer" aria-pressed="${ui.rank==='outer'}">外门</button><button type="button" class="seal-choice" data-rank="inner" aria-pressed="${ui.rank==='inner'}">内门</button><button type="button" class="seal-choice" data-rank="direct" aria-pressed="${ui.rank==='direct'}">亲传</button></div><div class="ink-row"><span>归属</span><button type="button" class="minor-button" data-action="peak">${safe(ui.peak)} ${ui.phase==='peaks'?'↻':''}</button></div><div class="ink-row"><span>本峰收徒</span><strong>${ui.peak==='主峰'?'掌门主持':'丹霞峰已获权限'}</strong></div>${ui.rank==='direct'?`<div class="ink-row"><span>亲授师父</span><button type="button" class="minor-button" data-action="mentor">${safe(ui.mentor)} ${ui.phase==='peaks'?'↻':''}</button></div>`:''}<p class="ink-paragraph">正式收下时，一次确定${rank}身份、归峰${ui.rank==='direct'?'和师父':''}。</p><div class="scroll-actions"><button type="button" class="minor-button" data-action="decline">婉谢</button><button type="button" class="game-button" data-action="admit">核对收录</button></div><p class="sample-line">本页只演示决定流程，不写入游戏存档</p>`}
function render(resetScroll=true){
  if(!members().some(p=>p.id===ui.person))ui.person=members()[0].id;
  game.dataset.stage=ui.phase;
  document.querySelector('.world-label').textContent=ui.phase==='opening'?'云岫旧别院 · 画面与人物为界面演示':'分峰阶段 · 山域概念画面与人物为界面演示';
  document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stage===ui.phase)));
  document.querySelectorAll('.world-person').forEach(b=>b.setAttribute('aria-current',String(b.dataset.person===ui.person&&ui.view==='person')));
  content.innerHTML=ui.view==='petition'?petitionPage():personPage();
  panel.hidden=false;
  if(resetScroll)document.querySelector('.scroll-body').scrollTop=0;
}
function openModal(title,description){modal.innerHTML=`<div class="modal-backdrop" data-backdrop><section class="modal-scroll" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">${safe(title)}</h2><div class="modal-stamp">印</div><p>${description}</p><div class="scroll-actions"><button type="button" class="minor-button" data-action="modal-close">返回</button><button type="button" class="game-button" data-action="demo-done">看完演示</button></div></section></div>`;modal.querySelector('[data-action="modal-close"]').focus()}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b){if(event.target.matches('[data-backdrop]'))modal.innerHTML='';return}
  if(b.dataset.person){ui.person=b.dataset.person;ui.view='person';ui.detail='status';render();return}
  if(b.dataset.view){ui.view=b.dataset.view;render();return}
  if(b.dataset.detail){ui.detail=b.dataset.detail;render(false);return}
  if(b.dataset.rank){ui.rank=b.dataset.rank;render(false);return}
  if(b.dataset.stage){ui.phase=b.dataset.stage;ui.peak='主峰';ui.mentor='沈砚';render();return}
  if(b.dataset.rail){if(b.dataset.rail==='people'){ui.view='person';render()}else notice('此稿聚焦门人系统；山院、功法与行囊沿用游戏界面方向。');return}
  const action=b.dataset.action;
  if(action==='close'){panel.hidden=true;return}
  if(action==='modal-close'){modal.innerHTML='';return}
  if(action==='demo-done'){modal.innerHTML='';notice('确认层级已演示；正式门籍将在规则接入后结算。');return}
  if(action==='peak'){if(ui.phase==='peaks')ui.peak=ui.peak==='主峰'?'丹霞峰':'主峰';render(false);return}
  if(action==='mentor'){if(ui.phase==='peaks')ui.mentor=ui.mentor==='沈砚'?'柳观澜':'沈砚';render(false);return}
  if(action==='admit'){const rank={outer:'外门',inner:'内门',direct:'亲传'}[ui.rank];openModal('核对门籍',`拟收秦溪为<strong>${safe(ui.peak)}${rank}</strong>${ui.rank==='direct'?`，由<strong>${safe(ui.mentor)}</strong>亲授`:''}。正式结算须核对本峰收徒权限、宗门容量、培养承载与当事人意愿。本稿不改变存档。`);return}
  if(action==='decline'){openModal('婉谢求见','掌门说明本次未收录的缘由，求见记录保留处理结果。本稿只演示界面。');return}
  if(action==='locate'){panel.hidden=true;notice(`${person().name}此刻在${person().place}。`);return}
  if(action==='scene')notice('场景控制为界面示意；本稿的演示画面不会推进时间。');
});
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(modal.firstChild){modal.innerHTML='';return}if(!panel.hidden)panel.hidden=true;else{ui.view='person';render()}});
render();
