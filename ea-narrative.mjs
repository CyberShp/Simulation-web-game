import { CLUES, PREPARATIONS, campaignSummary, explorationOptions } from './ea-campaign.mjs?v=ea-160-courtyard-20261008-r4';
import {capacity} from './ea-data.mjs?v=ea-160-courtyard-20261008-r4';

// Narrative is a projection of committed campaign facts, never a second quest
// engine. Reading acknowledges prose only: costs, rewards and progress continue
// to belong to advanceStory / resolveExploration / combatAction.
const page = (speaker, text) => ({ speaker, text });
const scene = (id, title, place, pages) => ({ id, title, scene:place, pages });
const chapters = [
  null,
  scene('chapter:1','药匣尚温','home',[
    page('掌门','雨声终于远了。父亲守住山门，母亲把我推入逃生阵。他们以性命换来的，不应只是下一场逃亡。'),
    page('母亲的药理札记','根骨未损，天资仍在。先让自己活下来，再让这份传承能够救人。院外有人求药，你可以先听听她的来意。')]),
  scene('chapter:2','留下的理由','home',[
    page('陆知微','这十份药救了我的家人。我想留下照看药圃，把药理学扎实。'),
    page('掌门','你留下，是为了自己的路。我的家仇不会成为你的债。先把药田和伐木场恢复起来，山院才养得起愿意留下的人。')]),
  scene('chapter:3','同院而居','home',[
    page('林长风','外面的门派只问我能交多少灵石。我想找个能安身、也能学真本事的地方。差事我愿做，路也想自己选。'),
    page('掌门','山院还小，能给你的是住处、传承和公道。下一步整理藏经阁，母亲的旧信或许能把我带回灭门夜留下的线索。')]),
  scene('chapter:4','两条旧信，一道阵痕','home',[
    page('掌门','商路信笺提到青溪的借贷，父亲手札记着外聘阵匠的落脚处。听雨遗址还留着同式阵纹，能校验当夜外阵为何从内破开。'),
    page('母亲的旧信','不要只听一人的说法。账册说明钱去了哪里，阵匠能说清谁下了命令，阵纹留下破阵的手法。三处任取两份可靠证据，互相印证。')]),
  scene('chapter:5','旧案有了姓名','home',[
    page('掌门','这些记载能互相印证：韩厉川借债务渗透栖霞，胁迫阵匠从内毁阵，再以伪证夺走灵脉。杀害双亲、谋夺家业的责任，不再是一团山雾。'),
    page('家传手札','证据中的阵纹补全了《青岚筑基篇》与《护脉阵诀》。复仇须靠自己的修为，也须有能安置门人、补充粮药的根基。修足炼气九层，研习传承，再由你决定筑基。')]),
  scene('chapter:6','归乡之前','home',[
    page('掌门','道基已成，我终于能重返栖霞。但让所有人随着我的怒火上山，只会重演当年的失守。'),
    page('父亲的阵图','先救证人、断补给、疏解阵眼，或把证据交给公议。至少落实两项，再商议归乡。愿意同行的门人自愿应邀，留在院中的人同样值得照应。')]),
  scene('chapter:7','经营也是筹码','home',[
    page('掌门','药草、粮食、营造材料和同道的信用，已经改变了战局。准备有了结果，栖霞旧山门就在前方。'),
    page('归乡行记','提前拆阵者可以按父亲的阵图开路；也可迎战守阵者。其余准备仍能补做。若身体或物资不足，归院休整不会丢失任何证据。')]),
  scene('chapter:8','山门重开','qixia',[
    page('掌门','这道门曾替我们挡风，也替仇敌挡住追问。现在它打开了。再向前，便是被夺的灵脉。'),
    page('韩厉川','沈家的余烬，竟还敢回来。'),
    page('掌门','账册、证词与阵痕已经把旧案说清。今日我为双亲与族人而来，也为让活着的人不再被你胁迫。')]),
  scene('chapter:9','药匣、阵笔与族谱','qixia',[
    page('掌门','父亲的阵笔已经折断，母亲的药匣还合着。我终于能把它们带回去，而不是再追着一条没有尽头的仇线。'),
    page('栖霞旧案','韩厉川已伏诛，夺脉伪证得以澄清，赤嶂门残部解散。直接责任者已清算，这场复仇到此收束。'),
    page('掌门','接下来，要重建栖霞，让云岫与故地彼此照应；或把传承带回云岫，为故人留一方静碑。这是往后的生活，不是另一场复仇。')])
];

const clueDetails = {
  ledger:{ regionId:'market', source:'青溪旧商号留存的往来账册', tells:'灭门前的借贷、异常转账与赤嶂门收款记录。', limit:'账册证明利益往来，仍需证词或阵纹验证破阵过程。', speaker:'旧商号掌柜', text:'这些页有商号的原戳，账期也对得上。你带走誊本，我们留存原册，不能让旧账再被一个人改掉。' },
  testimony:{ regionId:'quarry', source:'石桥驿阵匠自愿写下的亲笔证词', tells:'韩厉川胁迫阵匠破坏栖霞阵眼，以及灭门夜所见。', limit:'证词应与账册或实际阵痕交叉印证。', speaker:'阵匠', text:'当夜的命令来自韩厉川。我受了胁迫，也确实动过阵眼。这张纸上写的是我亲眼见过、亲手做过的事，我愿署名。' },
  seal:{ regionId:'ruins', source:'听雨遗址残阵与家传手札核对后的拓本', tells:'外阵曾从内部被定向破坏，残痕吻合家传阵法。', limit:'阵纹说明破阵手法，仍需账册或证词指向具体责任人。', speaker:'掌门', text:'裂纹不是外敌强攻留下的。灵流在同一处被反转，和父亲手札的阵眼次序吻合。把拓本带回去，再和另一份证据核对。' }
};
const preparationDetails = {
  witness:{ regionId:'prison', speaker:'获救的知情者', text:'韩厉川每次强催术法前都会先收拢灵流。我把蓄势的征兆画给你，临敌时能早一点看出落点。', result:'最终战的落点预警延长，给你更多避让时间。' },
  supply:{ regionId:'supply', speaker:'运粮人', text:'我们也有家人。既然退路已经安顿，就不再替他运粮了。', result:'敌方失去补给，最终敌人生命降低；与公议行动一起影响援兵。' },
  array:{ regionId:'ward', speaker:'掌门', text:'阵眼逐一疏解，灵脉不再替韩厉川强催术法。父亲留下的技艺，终于在护住活着的人。', result:'最终战敌方术法伤害降低；可按阵图用材料重开山门。' },
  public:{ regionId:'council', speaker:'公议见证人', text:'证据相互印证，夺脉旧案应当昭雪。愿意为你见证的人，不再为赤嶂门助阵。', result:'最终战赤嶂援手不再参战。' }
};

const localDialogue = {
  market:['旧商号掌柜','母亲旧信中的商号还在。核对原册要付抄录费用；商队的栈道缺人修，也可用营造材料换同一份账册。'],
  quarry:['阵匠','我曾替栖霞修过阵，也受韩厉川胁迫毁过阵。可以先治伤让我写下证词；追兵就在附近，你也可以先护住我。'],
  ruins:['掌门','用家传手札逐条核对残阵。可以耗道韵校验，也可以用精力耐心辨认。证据不会因为没有选择战斗而消失。'],
  prison:['牢中的知情者','我知道韩厉川蓄势施法的习惯。赎救或破牢都能把我救出去，选你能承担的办法。'],
  supply:['受胁迫的运粮人','粮道另一端是韩厉川的驻地。给我们粮食和修桥材料，便能安置家人离开；也可以迎战押运者截断补给。'],
  ward:['掌门','护脉阵仍在替仇敌供给灵流。按阵图疏解阵眼，材料和道韵都能派上用场；阵诀理解足够，也可凭技艺节省材料。'],
  council:['公议见证人','公议只接受互相印证的证据。把已经取得的账册、证词或拓本公开，让同道自己判断旧案。'],
  qixia:['栖霞旧山门','先解除外阵，再循灵脉找到韩厉川。准备不足就归院休整，山门进度、证据与既有准备都不会消失。']
};

function endingScene(s) {
  const rebuild = s.story.ending === 'rebuild';
  return scene(`ending:${s.story.ending}`,rebuild?'故山重新有人烟':'传承随人归山',rebuild?'qixia':'home',[
    page('掌门',rebuild?'我要让故地重新有人烟。云岫仍是根基，栖霞不必再成为封闭的孤城。愿意主持新峰的门人，可以在这里继续自己的道。':'传承从来不只在一座山上。带回云岫，让药匣中的方子继续救人，让阵笔留下的技艺继续护院。栖霞留碑，故人长眠。'),
    page('山院回响',choiceResponses(s).map(r=>r.text).join('\n')),
    page('余烬立山','复仇大篇章已经结束。往后仍有衣食、授业、门规与分峰，也有与你并肩生活的人。故人不再等待清算，活着的人开始拥有明日。')]);
}

export function choiceResponses(s) {
  const st=s.story, p=st.preparations, claimed=st.claimed || [], responses=[];
  for(const id of Object.keys(PREPARATIONS)) if(p[id]) {
    const method=id==='witness'?(claimed.includes('battle:rescue')?'你亲自破牢护住了证人。':'你用经营所得赎救、安顿了证人。'):id==='supply'?(claimed.includes('battle:intercept')?'你亲自截断押运，为运粮人留下退路。':'你以粮食和修桥材料给运粮人一条退路。'):id==='array'?'你解开护脉阵，让家传技艺重新护人。':'你公开交叉验证的证据，让旧案在同道面前昭雪。';
    responses.push({id,text:method});
  }
  if(s.disciples.some(d=>d.name==='陆知微'))responses.push({id:'zhivei',text:'赠药结下的善缘仍在。陆知微留下学习药理；她的求道不必成为你的家仇。'});
  if(s.disciples.some(d=>d.name==='林长风'))responses.push({id:'changfeng',text:'林长风因安身与传承留下。往后的山门，仍要为这样的选择留一席。'});
  if(st.ending)responses.push({id:'home',text:st.ending==='rebuild'?'你选择重建栖霞，云岫与故地彼此照应。':'你选择带传承回云岫，在故地留下静碑。'});
  return responses;
}

function earnedScenes(s) {
  const st=s.story, out=[];
  for(let n=1;n<=Math.min(9,st.step);n++)out.push(chapters[n]);
  if(st.opening&&st.step>=2){const declined=st.opening.invitation==='declined';out[1]=scene('chapter:2',declined?'善缘不系去留':'留下的理由','home',[
    page('陆知微',declined?'药已送达，我先回去照应家人。救命之情会记着，却不能因此许下追随的承诺。':'这些药能帮家人调养，亲人还有亲友照应。这里有住处、也有药理可学，我愿留下求道。同行与家仇，我仍会自己决定。'),
    page('掌门',declined?'先照应好家人。山院还要自己恢复药田与木料供给，往后也有别的同道可以结识。':'你留下，是为了自己的路。先恢复药田与木料供给，让愿意留下的人有自己的生活。')]);}
  for(const id of st.clues) {
    const d=clueDetails[id];
    if(d)out.push(scene(`clue:${id}`,CLUES[id],d.regionId,[page(d.speaker,d.text),page('证据留档',`${d.source}：${d.tells}\n${d.limit}\n证据已经记入旧案，即使撤离、受伤或关闭网页也会保留。`)]));
  }
  for(const [id,d] of Object.entries(preparationDetails))if(st.preparations[id])out.push(scene(`prepare:${id}`,PREPARATIONS[id],d.regionId,[page(d.speaker,d.text),page('战局变化',d.result)]));
  if(st.gateCleared)out.push(scene('gate:cleared','旧山门不再闭锁','qixia',[page('掌门','外层山阵已经解除。先确认穿过旧山门，再向灵脉深处与韩厉川对阵；无须再付一次开门材料。')]));
  if(st.revengeDone)out.push(scene('revenge:won','清算至此','qixia',[page('掌门','韩厉川倒下了。所有证据与准备都有了结果。取回双亲遗物，再决定传承的归处。'),page('归乡行记','这不是新的幕后开端。直接责任者已被击败，旧案将在取回遗物后正式收束。')]));
  if(st.completed&&st.ending)out.push(endingScene(s));
  const c=s.combat;
  if(c&&['lost','retreated'].includes(c.status))out.push(scene(`recovery:${c.journeyId}:${c.status}`,c.status==='lost'?'先活着回去':'退路仍在','home',[
    page('院中休整',(c.status==='lost'?'这一次败了，根基没有受损。已取得的证据、拆解的阵眼和救出的人，都不会因为这次失利而消失。':'撤离是为了下一次有把握地回来。证据与已经落实的准备仍在，今天的退路没有白留。')+'\n'+(s.master.wound>0?'先用灵草调息；材料不足可以在院中采集。恢复伤势与精力后重新启程，同行者也需要休整。':'先恢复精力，再商议重新启程。同行者保留自己的意愿，不能因为曾经同行就强迫他们再去。'))]));
  return out;
}

/** Call once when creating a world, or with legacy:true after loading a world
 * without narrative metadata. Existing saves never replay their old chapters. */
export function initNarrative(s,{legacy=false}={}) {
  if(s.story.narrative!==undefined) { validateNarrative(s); return s; }
  s.story.narrative={version:1,acknowledged:legacy?earnedScenes(s).map(x=>x.id):[],cursor:null};
  return s;
}

const validId=id=>typeof id==='string'&&/^(chapter:[1-9]|clue:(ledger|testimony|seal)|prepare:(witness|supply|array|public)|gate:cleared|revenge:won|ending:(rebuild|return)|recovery:[1-9][0-9]*:(lost|retreated))$/.test(id)&&id.length<=80;
export function validateNarrative(s) {
  const value=s.story?.narrative;
  if(value===undefined)return true;
  const fail=()=>{throw Error('剧情阅读记录异常。');};
  if(!value||value.version!==1||!Array.isArray(value.acknowledged)||value.acknowledged.length>10000||new Set(value.acknowledged).size!==value.acknowledged.length||!value.acknowledged.every(validId))fail();
  const earned=new Set(earnedScenes(s).map(x=>x.id));
  if(value.acknowledged.some(id=>id.startsWith('recovery:')?!(Number.isSafeInteger(Number(id.split(':')[1]))&&Number(id.split(':')[1])<s.world.nextJourneyId):!earned.has(id)))fail();
  if(value.cursor!==null) {
    const c=value.cursor, candidate=earnedScenes(s).find(x=>x.id===c?.id);
    if(!c||!validId(c.id)||!Number.isInteger(c.page)||c.page<0||!candidate||c.page>=candidate.pages.length||value.acknowledged.includes(c.id))fail();
  }
  return true;
}

export function sceneDialogue(s,id) {
  const candidate=earnedScenes(s).find(x=>x.id===id);
  if(!candidate)return null;
  const cursor=s.story.narrative?.cursor;
  return {...candidate,pages:candidate.pages.map(p=>({...p})),cursor:cursor?.id===id?cursor.page:0,acknowledged:s.story.narrative?.acknowledged.includes(id)||false};
}

export function setNarrativePage(s,id,index) {
  const candidate=sceneDialogue(s,id);
  if(!candidate||candidate.acknowledged)throw Error('这段剧情已读完，或尚未发生。');
  if(!Number.isInteger(index)||index<0||index>=candidate.pages.length)throw Error('剧情幕次不存在。');
  // Failure is a single-page supplement to combat.result; it has no resumable
  // cursor because acknowledgeCombat legitimately removes that transient object.
  if(id.startsWith('recovery:'))return true;
  initNarrative(s);s.story.narrative.cursor={id,page:index};return true;
}

export function acknowledgeNarrative(s,id) {
  if(!sceneDialogue(s,id))throw Error('这段剧情尚未发生。');
  initNarrative(s);
  const metadata=s.story.narrative;
  if(metadata.acknowledged.includes(id))return false;
  metadata.acknowledged.push(id);
  if(metadata.cursor?.id===id)metadata.cursor=null;
  return true;
}

/** Pure read. Missing metadata means an older world, so no automatic replay. */
export function narrativeForState(s) {
  const metadata=s.story.narrative, candidates=earnedScenes(s), acknowledged=new Set(metadata?.acknowledged||[]);
  // The opening owns its own three pages. Combat owns its result/retreat UI;
  // narrative must never hide those controls, even when a reward just committed.
  const mayOpen=metadata&&s.story.intro&&!s.combat;
  const pending=mayOpen?(candidates.find(x=>x.id===metadata.cursor?.id)||candidates.find(x=>!acknowledged.has(x.id)&&!x.id.startsWith('recovery:'))):null;
  const q=campaignSummary(s);
  const clues=s.story.clues.map(id=>({id,name:CLUES[id],...clueDetails[id]}));
  return {
    pending:pending?sceneDialogue(s,pending.id):null,
    chapter:{step:q.step,title:q.title,text:q.text,ready:q.ready,completed:q.completed,requirements:q.requirements.map(r=>({...r}))},
    clues,preparations:Object.entries(preparationDetails).filter(([id])=>s.story.preparations[id]).map(([id,d])=>({id,name:PREPARATIONS[id],...d})),
    recovery:s.master.wound>0&&s.story.step>0?{title:'归院休整后可以重来',text:'已取得的证据与准备不会消失。先疗伤，再恢复精力；物资不足可采集或交换。',command:'masterAction',args:['heal']}:null,
    responses:s.story.completed?choiceResponses(s):[],
    archive:candidates.map(x=>({id:x.id,title:x.title,scene:x.scene,acknowledged:acknowledged.has(x.id)}))
  };
}

/** NPC / object interactions are attached to the campaign's actual landmark.
 * Disabled conditions and commands always come from the campaign projection. */
export function regionInteractions(s) {
  const active=explorationOptions(s).active;
  if(!active||active.status==='traveling'||active.status==='combat')return [];
  let [speaker,text]=localDialogue[active.regionId]||['山谷行人',active.eventText];
  if(active.regionId==='market'&&s.story.clues.includes('ledger'))text='原册仍留在商号，誊本已经收入你的证据。旧商路也可以继续交换山货。';
  if(active.regionId==='quarry'&&s.story.clues.includes('testimony'))text='我的证词已经署名留档。带药来探望时，我们也能继续交流修阵心得。';
  if(active.regionId==='ruins'&&s.story.clues.includes('seal'))text='阵纹拓本已经收入旧案。残阵仍可静参，不会再收取一次取证的代价。';
  if(active.regionId==='qixia'&&(s.story.revengeDone||s.story.completed)){speaker='栖霞静碑';text=s.story.ending==='rebuild'?'故山将重新有人烟。祭扫旧人后，仍有愿意相伴的人等你归院。':'清算已经结束。祭扫故人，带着传承与新生活继续向前。';}
  const kind=active.regionId==='ward'?'array':active.regionId==='ruins'?'evidence':active.regionId==='qixia'?(s.story.revengeDone?'memorial':s.story.gateCleared?'person':'gate'):active.regionId==='valley'?(active.eventId==='traveler'?'person':active.eventId==='herbs'?'resource':'object'):'person';
  const completed=active.resolved&&!active.choices.length;
  return [{
    id:`region:${active.id}:objective`,regionId:active.regionId,kind,name:speaker,title:active.landmark.name,
    position:{x:active.landmark.x,y:active.landmark.y},radius:active.landmark.radius,
    canInteract:active.canInteract,pages:[page(speaker,completed?active.outcome||'此行已有结果，沿原路归院。':text)],
    outcome:active.outcome,completed,
    choices:active.choices.map(c=>({...c,cost:{...c.cost},disabled:c.disabled||!active.canInteract,reason:!active.canInteract?'先走近交互地点':c.reason,command:'resolveExploration',args:[c.id]})),
    returnAction:{label:'返回山院',command:'leaveRegion',args:[],disabled:false}
  }];
}

export function homeInteractions(s) {
  if(s.world.exploration||s.master.journey)return [];
  if(s.story.step===1&&s.story.opening){
    const o=s.story.opening,p=s.personsById[o.visitorId],gifted=o.gifted;
    const choices=gifted?[
      {label:'商议入院 · 提供住处与药理',command:'advanceStory',args:['invite'],disabled:s.disciples.length>=capacity(s),reason:s.disciples.length>=capacity(s)?'准备可用居所后再商议':''},
      {label:'让她先回去照应家人',command:'advanceStory',args:['decline'],disabled:false}
    ]:[{label:'赠出十份灵草',command:'advanceStory',args:['gift'],disabled:s.resources.herb<10,reason:s.resources.herb<10?'需灵草 10 份':''}];
    return [{id:'home:chapter:1',name:p.name,personId:p.id,kind:'person',type:'visitor',buildingId:s.buildings.find(b=>b.type==='hall').id,title:gifted?'药已送达 · 去留另议':'一剂生机',pages:[page(p.name,gifted?'这份药能帮家人调养，我会记着。若山院有住处、也愿意让我继续学药理，我愿留下求道。随你外出或参与家仇，还需另行商议。':'家人旧疾缠身，我循旧药方来求十份灵草。此时只为求药，尚未决定去留。')],choices,requirements:[],scene:'home'}];
  }
  const q=campaignSummary(s), arrival=q.step===0&&q.ready, role=arrival?{name:'院外来客',type:'visitor',text:'经脉渐渐安稳，主屋外传来叩门声。来人攥着一张泛黄的药方，轻声问：「这里……还能求药吗？」'}:q.step===1?{name:'陆知微',type:'visitor',text:'家人病重，我循旧药方来到这里。若你愿赠十份灵草，我想把这份药理继续学下去。'}:q.step===2?{name:'林长风',type:'visitor',text:'我想找个安身与求道的地方。先恢复能运行的药田与伐木场，再商议留下。'}:{name:q.step>=9?'双亲遗物':'家传手札',type:'object',text:q.text};
  const action=q.completed?null:q.step===9?[{label:'重建栖霞故地',command:'advanceStory',args:['rebuild'],disabled:!q.ready},{label:'带传承回云岫',command:'advanceStory',args:['return'],disabled:!q.ready}]:[{label:q.action,command:'advanceStory',args:[],disabled:!q.ready,reason:q.requirements.filter(r=>!r.met).map(r=>r.label).join('；')}];
  const building=s.buildings.find(b=>b.type===(q.step===3||q.step===4||q.step===5?'library':'hall'))||s.buildings.find(b=>b.type==='hall');
  if(arrival)action[0].label='听来客说说缘由';
  return [{id:`home:chapter:${q.step}`,...role,...(s.story.opening&&q.step===2?{personId:s.personsById[s.story.opening.secondVisitorId].id}:{}),kind:role.type==='visitor'?'person':'object',buildingId:building?.id||null,title:arrival?'主屋前 · 叩门声':q.title,pages:[page(role.name,role.text)],choices:action||[],requirements:q.requirements.map(r=>({...r})),scene:'home'}];
}
