import { rng, day, log, pay, canPay, grant, capacity } from './ea-data.mjs?v=ea-140-release-20261005';
import { EXPEDITIONS as LEGACY_ROUTES } from './world.mjs?v=ea-140-release-20261005';
import { combatField, combatGeometryId, combatCanStand, combatClearLine, combatPath, moveCombatActor, dodgeEndpoint } from './ea-combat-geometry.mjs?v=ea-140-release-20261005';
import { appearance } from './ea-scenic.mjs?v=ea-140-release-20261005';

// Campaign state is deliberately plain data. Every choice, weather roll and reward
// is committed to the save before the next tick; loading never repeats a roll.
let hooks = {};
export function configureCampaign(next = {}) { hooks = { ...hooks, ...next }; }
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const prepCount = s => Object.keys(PREPARATIONS).filter(id => s.story.preparations[id]).length;
const book = (s, id) => { if (!s.doctrine.books.includes(id)) s.doctrine.books.push(id); };
const xpLimit = m => m.realm <= 9 ? m.realm * 100 : 1200 + (m.realm - 10) * 600;

export const STORY = [
  { title:'雨夜余烬', text:'双亲护你逃出栖霞。先在母亲的旧别院治好逃亡伤势，根骨与天资不会因此受损。', action:'确认伤势已愈' },
  { title:'一剂生机', text:'采药人陆知微为家人求药。赠出十份灵草，结下一段有来由的善缘。', action:'赠药救人' },
  { title:'孤客来投', text:'恢复灵草田与伐木场，让愿意留下的人有自己的生活。林长风正寻找安身和求道之处。', action:'接纳来客' },
  { title:'旧卷余温', text:'建成藏经阁，整理母亲的药理札记与旧商路信笺。往来账册与被收买的阵匠，是两条可靠线索。', action:'整理遗卷' },
  { title:'旧账新证', text:'亲往青溪坊市查账、石桥驿询问阵匠，或听雨遗址核对阵纹。任取两份证据，就能拼合家传筑基篇；关键线索不会随机消失。', action:'校勘证据与筑基篇' },
  { title:'道基初成', text:'筑基篇已取回。备足材料、修满炼气九层并理解传承后，由掌门自主决定何时筑基。先把山院经营稳妥。', action:'立下归乡之约' },
  { title:'削羽断援', text:'救出证人、截断补给、拆解护山阵或公开夺脉证据，至少完成两项。粮药、阵法与信用都能成为复仇的筹码。', action:'整备重返栖霞' },
  { title:'重返栖霞', text:'前往栖霞故地，解除外阵。提前拆解过阵法，可携灵木与青石稳妥开路；也可亲自击败守阵者。', action:'穿过旧山门' },
  { title:'了却旧仇', text:'韩厉川就在被夺的灵脉前。亲自迎战，留意落点预警、调息与退路。同行者自主作战，失败后仍可养伤再来。', action:'取回双亲遗物' },
  { title:'余烬新生', text:'韩厉川伏诛，伪证与夺脉旧案已澄清。没有无尽的幕后黑手。选择重建栖霞，或把传承带回云岫，往后的门派由你和门人共同经营。', action:'决定传承的归处' },
  { title:'山河仍待经营', text:'《余烬立山》已完成。故人得以安息；山院的衣食、传承、门规与分峰仍会继续生长。', action:'第一大篇章已完成' }
];

export const CLUES = { ledger:'青溪往来账册', testimony:'阵匠亲笔证词', seal:'栖霞阵纹拓本' };
export const PREPARATIONS = { witness:'救出知情者', supply:'截断敌方补给', array:'拆解护脉阵', public:'公开夺脉罪证' };
export const WEATHER = {
  clear:{ name:'晴岚', text:'道路明朗，行旅平稳。', production:{}, risk:0, travel:1 },
  rain:{ name:'春霖', text:'灵草与田粮得雨，林道泥泞。', production:{ herb:1.25, food:1.15, wood:.9 }, risk:.12, travel:.9 },
  mist:{ name:'山雾', text:'林路视野有限，阵纹灵息更易感知。', production:{ insight:1.18, stone:.9 }, risk:.18, travel:.85 },
  wind:{ name:'长风', text:'风干土壤，采石与伐木需要更多照应。', production:{ food:.9, wood:.92, stone:.95 }, risk:.1, travel:1 },
  dew:{ name:'灵露', text:'灵气凝露，药圃与悟道均受滋养。', production:{ herb:1.18, insight:1.15 }, risk:0, travel:1.05 }
};

export const REGIONS = {
  valley:{ name:'云岫山谷', text:'采药、寻粮、照应山民。事件随行程与天气变化。', step:2, realm:1, duration:12, energy:6, cost:{}, landmark:'溪边药径', risk:.1 },
  market:{ name:'青溪坊市', text:'查清旧商路与借贷账册；也可帮商队修栈道换取账目。', step:4, realm:1, duration:16, energy:8, cost:{}, landmark:'旧商号', risk:0 },
  quarry:{ name:'石桥驿', text:'找到被韩厉川胁迫的外聘阵匠。赠药询问，或击退追兵。', step:4, realm:4, duration:18, energy:10, cost:{}, landmark:'阵匠歇脚处', risk:.2 },
  ruins:{ name:'听雨遗址', text:'以阵纹交叉印证灭门夜的破阵手法，安静参悟也能获得可靠证据。', step:4, realm:4, duration:20, energy:10, cost:{}, landmark:'残阵石碑', risk:.15 },
  prison:{ name:'赤嶂偏牢', text:'掌握证据后，可以周旋赎人，也可以亲自救出证人。', step:6, realm:10, duration:20, energy:12, cost:{}, landmark:'偏牢门楼', risk:.45 },
  supply:{ name:'赤嶂粮道', text:'以物资安顿运粮人，迫使敌方失去补给；或迎战押运者。', step:6, realm:10, duration:20, energy:12, cost:{}, landmark:'运粮渡口', risk:.4 },
  ward:{ name:'栖霞外阵', text:'家传阵术与营造材料能解除阵势，削弱最终决战中的敌方术法。', step:6, realm:10, duration:20, energy:10, cost:{}, landmark:'护脉阵眼', risk:.25 },
  council:{ name:'南渡公议', text:'将交叉验证的证据交给各地同道，截断赤嶂门的声援。', step:6, realm:10, duration:18, energy:8, cost:{}, landmark:'公议石台', risk:0 },
  qixia:{ name:'栖霞故地', text:'旧家山门、被夺灵脉与最后的清算。准备不足可以随时归山。', step:7, realm:10, duration:24, energy:14, cost:{}, landmark:'栖霞旧山门', risk:.55 }
};

const record = (s, text, kind = 'world') => {
  s.world.reactions.unshift({ time:s.time, text, kind });
  s.world.reactions.length = Math.min(20, s.world.reactions.length);
  log(s, text);
};
function once(s, key, effect) {
  if (s.story.claimed.includes(key)) return false;
  effect();
  s.story.claimed.push(key);
  return true;
}
function milestone(s, id, text) {
  if (!s.story.milestones.some(m => m.id === id)) s.story.milestones.push({ id, time:s.time, text });
}
function addClue(s, id) {
  if (!s.story.clues.includes(id)) {
    s.story.clues.push(id);
    record(s, `取得「${CLUES[id]}」。即使撤离或受伤，这份证据仍会保留。`, 'clue');
  }
}
function preparation(s, id) {
  if (s.story.preparations[id]) return;
  s.story.preparations[id] = true;
  s.world.hostility = clamp(s.world.hostility + 12, 0, 100);
  s.sect.reputation += 8;
  milestone(s, `prepare:${id}`, PREPARATIONS[id]);
  record(s, `「${PREPARATIONS[id]}」已成。韩厉川察觉你的行动，但无法越过山路直接攻入别院。`, 'enemy');
}

export function initCampaign(s, options = {}) {
  const old = s.story || { step:0, intro:false };
  if (!Array.isArray(old.clues)) {
    s.story = { ...old, step:clamp(old.step || 0, 0, 4), clues:[], preparations:{ witness:false, supply:false, array:false, public:false }, claimed:[], milestones:[], gateCleared:false, revengeDone:false, completed:false, ending:null };
    // Old openings already paid their rewards. Migration records them without
    // replaying recruitment, costs, knowledge or insight.
    for (let n = 0; n < s.story.step; n++) s.story.claimed.push(`story:${n}`);
  }
  if (!s.world) s.world = { weather:{ id:'clear', remaining:120, cycle:0 }, hostility:0, exploration:null, nextJourneyId:1, visits:{}, visitors:[], nextVisitorDay:day(s) + 2, visitorSequence:0, reactions:[], legacyJourney:null };
  if (s.combat === undefined) s.combat = null;
  if (s.master.journey && s.master.journey.kind !== 'campaign' && !s.world.legacyJourney) {
    s.world.legacyJourney = { ...s.master.journey };
    record(s, '旧行程已保留，继续原定游历与途中选择；新篇章不会提前结算这次收获。', 'migration');
  }
  if (options.legacy && !s.story.intro) s.story.intro = true;
  return s;
}

export function campaignSummary(s) {
  const n = s.story.step, m = s.master, has = type => s.buildings.some(b => b.type === type&&b.enabled!==false&&b.condition>0);
  const requirements = [
    [{ label:'治愈逃亡伤势', met:m.wound === 0 }],
    [{ label:'灵草 10 份', met:s.resources.herb >= 10 }, { label:'有可用居所', met:roomForFollower(s) }],
    [{ label:'灵草田可运行', met:has('farm') }, { label:'伐木场可运行', met:has('lumber') }, { label:'有可用居所', met:roomForFollower(s) }],
    [{ label:'藏经阁可运行', met:has('library') }],
    [{ label:`可靠证据 ${s.story.clues.length}/2（坊市、驿站、遗址三选二）`, met:s.story.clues.length >= 2 }],
    [{ label:'掌门突破筑基', met:m.realm >= 10 }],
    [{ label:`削弱敌方 ${prepCount(s)}/2`, met:prepCount(s) >= 2 }, { label:'掌门筑基', met:m.realm >= 10 }],
    [{ label:'解除栖霞外层山阵', met:s.story.gateCleared }],
    [{ label:'击败韩厉川', met:s.story.revengeDone }],
    [{ label:'选择重建栖霞或回归云岫', met:true }],
    [{ label:'第一大篇章已经完成', met:true }]
  ][n] || [];
  return { step:n, ...STORY[n], ready:n < 10 && requirements.every(r => r.met), requirements, clues:s.story.clues.map(id => ({ id, name:CLUES[id] })), preparations:Object.entries(PREPARATIONS).map(([id, name]) => ({ id, name, done:s.story.preparations[id] })), completed:s.story.completed, ending:s.story.ending };
}
export function storyReady(s) { return campaignSummary(s).ready; }
export function acknowledgeIntro(s){s.story.intro=true;return true;}
function roomForFollower(s) {
  return s.disciples.length < (hooks.capacity || capacity)(s);
}
export function advanceStory(s, choice) {
  const n = s.story.step;
  if(n<4&&(s.world.exploration||s.master.journey))throw Error('先返回山院，再与来客交谈或整理院中遗卷。');
  if (!storyReady(s)) throw Error(campaignSummary(s).requirements.filter(r => !r.met).map(r => r.label).join('；') || '篇章已经完成。');
  if (s.world.exploration?.status === 'combat' || s.combat?.status === 'active') throw Error('先结束当前战斗。');
  if (n === 9 && !['rebuild', 'return'].includes(choice)) throw Error('请选择重建栖霞，或将传承带回云岫。');
  if ((n === 1 || n === 2) && typeof hooks.addDisciple !== 'function') throw Error('人物初始化尚未连接，请重新载入游戏。');
  once(s, `story:${n}`, () => {
    if (n === 0) log(s, '伤势渐平，根基未损。母亲留下的药理仍能救人。');
    if (n === 1) {
      pay(s, { herb:10 });
      hooks.addDisciple(s, { name:'陆知微', root:'木灵根', portrait:1, talent:1.15, goal:'精研草木', traits:[82,44,78,68,62], reason:'掌门赠药救下我的亲人，我愿留下照看药圃；归乡复仇仍须由我自己决定。', memory:'掌门赠药救下我的亲人，我愿留下照看药圃；归乡复仇仍须由我自己决定。' });
      log(s, '陆知微因赠药之恩留下。她愿经营药圃，并不因此承诺参与复仇。');
    }
    if (n === 2) {
      hooks.addDisciple(s, { name:'林长风', root:'土灵根', portrait:2, talent:1.08, goal:'求取长生', traits:[45,88,36,57,80], reason:'山院给了我安身与传承的机会，我愿靠自己的选择求道。', memory:'山院给了我安身与传承的机会，我愿靠自己的选择求道。' });
      log(s, '林长风来到山院，希望在这里得到安身与求道的机会。');
    }
    if (n === 3) { book(s, 'spring'); grant(s, { insight:8 }); log(s, '整理出《春雨养脉法》与旧商路信笺。青溪坊市、石桥驿与听雨遗址均有可追查之处。'); }
    if (n === 4) { book(s, 'foundation'); book(s, 'array'); grant(s, { insight:12, crystal:3 }); milestone(s, 'foundation', '证据相互印证，家传筑基篇得到补全。'); log(s, '账目、证词或阵纹相互印证，韩厉川夺脉的手段已清楚。家传《青岚筑基篇》与《护脉阵诀》收入藏书。'); }
    if (n === 5) { milestone(s, 'return-vow', '道基初成，开始筹备重返栖霞。'); record(s, '筑基消息传出，周边同道开始认真对待山院。复仇将有准备、有退路，也尊重门人的选择。'); }
    if (n === 6) { milestone(s, 'prepared', '经营与人情化作重返故地的筹码。'); log(s, '敌方支援已被削弱，重返栖霞的时机已至。剩余准备仍可继续完成。'); }
    if (n === 7) log(s, '旧山门重开。沿灵脉向前，韩厉川无法再以外阵避战。');
    if (n === 8) { grant(s, { jade:180, wood:60, stone:60, herb:40, insight:25, crystal:8 }); book(s, 'alchemy'); s.sect.reputation += 35; milestone(s, 'revenge', '韩厉川伏诛，夺脉旧案昭雪，取回双亲遗物。'); record(s, '取回父亲阵笔、母亲药匣与沈氏族谱。直接责任者已清算，赤嶂门残部解散，旧案至此了结。', 'ending'); }
    if (n === 9) { s.story.ending = choice; s.story.completed = true; milestone(s, 'ending', choice === 'rebuild' ? '重建栖霞故地，云岫仍为根基。' : '带传承归云岫，为故人留一方静碑。'); record(s, choice === 'rebuild' ? '你决定重建栖霞。云岫与故地彼此照应，成熟传承与愿意主持的门人可开拓新峰。' : '你将传承带回云岫，在故地立碑。接下来的日子，仍要与门人共同经营山院。', 'ending'); }
  });
  s.story.step = n + 1;
  return campaignSummary(s);
}

export function weatherEffects(s) {
  const w = WEATHER[s.world?.weather?.id] || WEATHER.clear;
  return { ...w, production:{ jade:1, wood:1, stone:1, herb:1, crystal:1, insight:1, food:1, ...w.production } };
}
export function explorationLock(s, id) {
  const r = REGIONS[id];
  if (!r) return '此地尚未记入舆图';
  if (s.story.step < r.step) return `完成「${STORY[r.step - 1].title}」后开放`;
  if (s.master.realm < r.realm) return r.realm === 10 ? '需掌门筑基' : `需炼气${r.realm}层`;
  if (s.master.wound > 0) return '先在院中疗伤';
  if (s.master.journey || s.world.exploration || s.combat?.status === 'active') return '先结束当前行程';
  if (s.master.energy < r.energy) return `需精力 ${r.energy}`;
  if (!canPay(s, r.cost)) return '出行物资不足';
  return '';
}
export function companionOptions(s, regionId) {
  const r = REGIONS[regionId];
  if (!r) return [];
  return s.disciples.map(d => ({ id:d.id, name:d.name, ...(hooks.canAccompany ? hooks.canAccompany(s, d, { revenge:r.step >= 6, risk:r.risk }) : { willing:false, reason:'愿意同行的人选将在院中商议。' }) }));
}
export function startExploration(s, regionId, options = {}) {
  const lock = explorationLock(s, regionId);
  if (lock) throw Error(lock);
  const r = REGIONS[regionId], ids = options.companionIds || [];
  if (!Array.isArray(ids) || ids.length > 2 || new Set(ids).size !== ids.length) throw Error('每次最多邀请两位不同的门人同行。');
  for (const id of ids) {
    const o = companionOptions(s, regionId).find(d => d.id === id);
    if (!o?.willing) throw Error(`${o?.name || '此人'}不愿同行：${o?.reason || '未在院中'}`);
  }
  pay(s, r.cost);
  s.master.energy = Math.max(0, s.master.energy - r.energy);
  s.master.action = 'travel'; s.master.learning = null; s.master.path = [];
  const index = s.world.visits[regionId] || 0;
  const eventId = regionId === 'valley' ? ['herbs', 'traveler', 'stream', 'cache'][Math.floor(rng(s) * 4)] : 'mission';
  const total = Math.ceil(r.duration / weatherEffects(s).travel);
  const e = { id:s.world.nextJourneyId++, regionId, status:'traveling', total, remaining:total, position:{x:1.3,y:4}, target:null, eventId, visit:index, resolved:false, companionIds:[...ids], companionInjuries:{}, weather:s.world.weather.id, outcome:null };
  s.world.exploration = e; s.world.visits[regionId] = index + 1;
  s.master.journey = { kind:'campaign', routeId:regionId, total, remaining:total, status:'traveling' };
  if (s.combat?.status !== 'active') s.combat = null;
  for (const id of ids) { const d = s.disciples.find(d => d.id === id); d.mind.away = { kind:'campaign', id:regionId }; d.mind.activity='travel';d.mind.reason=`认可此行目的，自愿与掌门同往${r.name}。`;d.energy=Math.max(0,d.energy-r.energy*.7);d.job = null; }
  log(s, `掌门亲往「${r.name}」${ids.length ? '，同行者已自愿应邀' : ''}。`);
  return e;
}
export function moveExploration(s, x, y) {
  const e = s.world.exploration;
  if (!e || e.status !== 'exploring') throw Error('抵达地区后才能行走。');
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('行走目的地无效。');
  // Exploration is registered to one road spine. Combat has its own 2D plane.
  // Keeping the logical coordinate on that spine avoids invisible lateral moves.
  e.target = { x:clamp(x, .6, 11.4), y:4 };
  return true;
}
function choice(s, id, label, description, cost = {}, reason = '') {
  return { id, label, description, cost, disabled:!!reason || !canPay(s, cost), reason:reason || (!canPay(s, cost) ? '府库物资不足' : '') };
}
function regionChoices(s, e) {
  const c = (id, label, description, cost, reason) => choice(s, id, label, description, cost, reason);
  if (e.resolved && !(e.regionId === 'qixia' && s.story.step === 8 && !s.story.revengeDone)) return [];
  switch (e.regionId) {
    case 'market': return s.story.clues.includes('ledger') ? [c('trade', '出售山货', '交灵木 20，换灵石 32 与口粮 8。', {wood:20})] : [c('ledger', '核对旧账', '支付抄录与查档费用，固定获得往来账册。', {jade:35}), c('repair', '修栈道换账', '为商队修复栈道，用经营材料换得同一份可靠证据。', {wood:20, stone:10})];
    case 'quarry': return s.story.clues.includes('testimony') ? [c('visit', '探望阵匠', '带药看望，交流阵法心得。', {herb:6})] : [c('treat', '赠药询问', '救治阵匠的旧伤，他自愿写下证词。', {herb:16}), c('defend', '挡住追兵', '击退小股追兵，护住阵匠后取得证词。')];
    case 'ruins': return s.story.clues.includes('seal') ? [c('meditate', '静参灵纹', '消耗十点精力，取得道韵与灵晶。', {}, s.master.energy < 10 ? '需精力 10' : '')] : [c('trace', '以学识拓阵', '耗道韵校验残阵，可靠获得阵纹拓本。', {insight:8}), c('observe', '耐心辨认', '消耗十五点精力，以家传手札逐条核对，同样取得拓本。', {}, s.master.energy < 15 ? '需精力 15' : '')];
    case 'prison': return s.story.preparations.witness ? [] : [c('ransom', '赎救知情者', '以灵石与药材安顿狱卒、救回证人，降低决战中的敌人出手速度。', {jade:75, herb:10}), c('rescue', '破牢救人', '与守牢者交战；救出的证人将指出韩厉川招式破绽。')];
    case 'supply': return s.story.preparations.supply ? [] : [c('settle', '安置运粮人', '提供粮食、修桥材料，让受胁迫的运粮人安全离开，削减敌方兵力。', {food:20, wood:30}), c('intercept', '截断押运', '击败押运者，敌方失去补给，最终敌人生命降低。')];
    case 'ward': return s.story.preparations.array ? [] : [c('unweave', '拆解阵眼', '使用道韵与青石稳妥拆阵，最终敌方术法伤害降低。', {insight:18, stone:25}), c('arraycraft', '施展护脉阵诀', '已掌握阵诀者可凭技艺节省材料。', {stone:12}, (s.master.knowledge.array || 0) < 20 ? '掌门需初步掌握护脉阵诀（理解 20）' : '')];
    case 'council': return s.story.preparations.public ? [] : [c('testify', '向同道出示证据', '公开交叉验证的账册、证词或阵纹，敌方援手不再参战。', {jade:35, food:10}, s.story.clues.length < 2 ? '需两份可靠证据' : '')];
    case 'qixia':
      if (s.story.completed || s.story.revengeDone) return [c('memorial', '祭扫故人', '留一束药花，平复心绪。故地可以继续作为经营的一部分。', {herb:3})];
      if (!s.story.gateCleared) return [c('open', '依阵图开路', '已拆解阵眼后，用营造材料打开山门。', {wood:20, stone:20}, !s.story.preparations.array ? '先去栖霞外阵拆解阵眼' : ''), c('gatebattle', '迎战守阵者', '亲自击败守阵者，解除外层山阵。')];
      return [c('challenge', '迎战韩厉川', '战斗使用掌门位置、攻击和术法冷却。队友自主行动；可沿左侧退路撤离。', {}, s.story.step < 8 ? '先在主线中确认穿过旧山门' : '')];
    default:
      if (e.eventId === 'herbs') return [c('gather', '顺时采药', '按本次出行天气收获灵草与口粮。'), c('care', '护住幼苗', '少取眼前收成，获得道韵与山民声望。')];
      if (e.eventId === 'traveler') return [c('help', '照应迷路行人', '交出口粮，结下善缘并获赠实用药材。', {food:4}), c('guide', '指路后采集', '不耗口粮，取得较少草药。')];
      if (e.eventId === 'stream') return [c('bridge', '修复溪桥', '花费灵木换来稳定收成和声望。', {wood:8}), c('ford', '谨慎绕行', '耗五点精力走安全路，固定带回口粮。', {}, s.master.energy < 5 ? '需精力 5' : '')];
      return [c('share', '与山民分取旧藏', '收获石材、灵草与道韵，山民记得这份公平。'), c('salvage', '独自清理旧藏', '多取石材，但额外消耗八点精力。', {}, s.master.energy < 8 ? '需精力 8' : '')];
  }
}
const EVENT_TEXT = {
  herbs:['药径新芽', '药径尚有成片草药。留意本次出行的天气，它决定采集收益。'],
  traveler:['山雾来客', '一位迷路行人在溪畔歇脚，需要食物和指路。'],
  stream:['溪水涨落', '旧木桥损坏。修桥可安全运回物资，也能选择绕行。'],
  cache:['石下旧藏', '山民发现一处旧药篓与石料，一起清理可以各得所需。'],
  mission:['查访与行动', '走近标记地点，与当地人物、证据或阵眼交互。']
};
export function explorationOptions(s) {
  const e = s.world.exploration;
  let active = null;
  if (e) {
    const r = REGIONS[e.regionId], landmark = { id:'objective', x:8, y:4, name:r.landmark, radius:2.2 };
    const [eventTitle, eventText] = EVENT_TEXT[e.eventId];
    active = { ...e, regionName:r.name, eventTitle, eventText, choices:e.status === 'exploring' ? regionChoices(s, e) : [], canInteract:e.status === 'exploring' && distance(e.position, landmark) <= landmark.radius, landmark, weather:WEATHER[e.weather].name };
  }
  const all=Object.entries(REGIONS),known=all.filter(([id,r])=>s.story.step>=r.step||s.world.visits[id]>0||e?.regionId===id);
  return { regions:known.map(([id, r]) => { const reason = explorationLock(s, id); return { id, ...r, discovered:true, locked:!!reason, reason }; }), undiscovered:all.length-known.length, active };
}

function finishVisit(s, e, text) {
  e.resolved = true; e.outcome = text;
  s.stats.expeditions = (s.stats.expeditions || 0) + 1;
  s.master.xp = Math.min(xpLimit(s.master), s.master.xp + 18);
  log(s, text);
}
export function resolveExploration(s, id) {
  const e = s.world.exploration;
  if (!e || e.status !== 'exploring') throw Error('先抵达地区，并走近交互地点。');
  if (distance(e.position, {x:8,y:4}) > 2.2) throw Error(`请在地图中走近「${REGIONS[e.regionId].landmark}」。`);
  const c = regionChoices(s, e).find(c => c.id === id);
  if (!c) throw Error('此行动已完成，或当前并无这个选择。');
  if (c.disabled) throw Error(c.reason);
  pay(s, c.cost);
  if (['defend','rescue','intercept','gatebattle','challenge'].includes(id)) return startCombat(s, id);
  let result = '此次查访结束，可以沿原路归山。';
  if (['ledger','repair'].includes(id)) { addClue(s, 'ledger'); result = '旧商号账册记下借贷渗透与夺脉前的转账。证据已誊录带走。'; }
  if (id === 'trade') { grant(s, {jade:32, food:8}); result = '山货换来灵石与口粮，商路仍可继续经营。'; }
  if (id === 'treat') { addClue(s, 'testimony'); grant(s, {insight:3}); result = '阵匠承认受胁迫破坏阵眼，愿将当夜所见写成证词。'; }
  if (id === 'visit') { grant(s, {insight:6, stone:10}); result = '阵匠将修阵心得与青石相赠，旧谊继续。'; }
  if (id === 'trace' || id === 'observe') { if (id === 'observe') s.master.energy -= 15; addClue(s, 'seal'); result = '拓本证实外阵从内部被定向破坏，与家传手札相互印证。'; }
  if (id === 'meditate') { s.master.energy -= 10; grant(s, {insight:8, crystal:2}); result = '听雨静参，取得八点道韵与两枚灵晶。'; }
  if (id === 'ransom') { preparation(s, 'witness'); result = '知情者获救，交代韩厉川蓄势施法的习惯；最终战预警时间延长。'; }
  if (id === 'settle') { preparation(s, 'supply'); result = '运粮人得到退路，赤嶂门补给线中断。'; }
  if (['unweave','arraycraft'].includes(id)) { preparation(s, 'array'); result = '外阵灵流被逐一疏解，韩厉川无法再借阵势强催术法。'; }
  if (id === 'testify') { preparation(s, 'public'); result = '同道见证夺脉罪证，赤嶂门的援手决定退去。'; }
  if (id === 'open') { s.story.gateCleared = true; milestone(s, 'gate', '以家传阵图重开栖霞山门。'); result = '依父亲手札重开山门，昔日护家之阵终于不再为仇敌所用。'; }
  if (id === 'memorial') { s.master.energy = Math.min(100, s.master.energy + 12); result = '药花落在碑前。仇怨已经结束，余生仍有许多值得守护的人。'; }
  if (e.regionId === 'valley') {
    const weather = WEATHER[e.weather], herbFactor = weather.production.herb || 1;
    if (id === 'gather') grant(s, {herb:Math.round(16 * herbFactor), food:8});
    if (id === 'care') { grant(s, {herb:Math.round(8 * herbFactor), insight:4}); s.sect.reputation += 3; }
    if (id === 'help') { grant(s, {herb:18, insight:2}); s.sect.reputation += 4; }
    if (id === 'guide') grant(s, {herb:10, food:3});
    if (id === 'bridge') { grant(s, {food:18, herb:8}); s.sect.reputation += 3; }
    if (id === 'ford') { s.master.energy -= 5; grant(s, {food:10, herb:5}); }
    if (id === 'share') { grant(s, {stone:12, herb:8, insight:3}); s.sect.reputation += 2; }
    if (id === 'salvage') { s.master.energy -= 8; grant(s, {stone:22, herb:6}); }
    result = `${c.label}已完成：${c.description} 本次${WEATHER[e.weather].name}的收获已经带在身上。`;
  }
  finishVisit(s, e, result);
  return result;
}

function returnCompanions(s, e, outcome) {
  for (const id of e.companionIds) {
    const d = s.disciples.find(d => d.id === id);
    if (!d) continue;
    d.mind.away=null;d.mind.activity='rest';d.mind.commitUntil=0;
    const ally=s.combat?.journeyId===e.id?s.combat.allies.find(a=>a.id===id):null;
    const injury=Math.max(outcome.injury||0,e.companionInjuries?.[id]||0,ally?.knockedOut?20:ally&&ally.hp<ally.maxHp*.5?8:0);
    if(ally||Object.hasOwn(e.companionInjuries,id))d.energy=Math.max(0,d.energy-8);
    d.mind.reason=outcome.success?'共同出行已有结果，先归院休整。':'此行暂退，先恢复身心，再自行安排生活。';
    if (hooks.campaignOutcome) hooks.campaignOutcome(s, d, { kind:REGIONS[e.regionId].name, revenge:REGIONS[e.regionId].step >= 6, ...outcome, injury });
  }
}
export function leaveRegion(s) {
  const e = s.world.exploration;
  if (!e) { if (s.world.legacyJourney) return cancelMasterTravel(s); throw Error('掌门已在院中。'); }
  if (s.combat?.status === 'active') throw Error('战斗中请先选择撤离，沿左侧退路归山。');
  returnCompanions(s, e, {success:e.resolved, injury:0});
  s.world.exploration = null; s.master.journey = null; s.master.action = 'rest';
  if (s.combat?.status === 'won') s.combat = null;
  log(s, `掌门从${REGIONS[e.regionId].name}归来。已取得的证据与收获均保留。`);
}

const ENCOUNTERS = {
  defend:{ name:'石桥追兵', hp:88, damage:13, count:1, clue:'testimony' },
  rescue:{ name:'守牢者', hp:115, damage:16, count:2, preparation:'witness' },
  intercept:{ name:'押运执事', hp:135, damage:18, count:1, preparation:'supply' },
  gatebattle:{ name:'守阵者', hp:165, damage:19, count:1, gate:true },
  challenge:{ name:'韩厉川', hp:420, damage:30, count:1, final:true }
};
function startCombat(s, encounterId) {
  const e = s.world.exploration, def = ENCOUNTERS[encounterId], p = s.story.preparations;
  if (!e || !def || s.combat?.status === 'active') throw Error('当前无法开始战斗。');
  const m = s.master, maxHp = 95 + m.realm * 8, maxQi = 60 + m.realm * 4;
  const enemies = [], count = def.count + (def.final && !p.public && !p.supply ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const isBoss = !!def.final && i === 0;
    const hp = Math.round((i === 0 ? def.hp : def.hp * .62) * (def.final && p.supply ? .76 : 1));
    enemies.push({ id:`enemy-${i + 1}`, name:isBoss ? '韩厉川 · 筑基后期' : def.final ? '赤嶂护卫' : `${def.name}${count > 1 ? i + 1 : ''}`, x:8.5 + i, y:3 + i * 2, facing:{x:-1,y:0},hp, maxHp:hp, damage:Math.round((i === 0 ? def.damage : def.damage * .7) * (def.final && p.array ? .7 : 1) * (1 + WEATHER[e.weather].risk * .5)), speed:isBoss ? 1.1 : 1.3, cooldown:1.6 + i, windup:0, telegraph:null, strikes:0, boss:isBoss });
  }
  const allies = e.companionIds.map((id, i) => { const d = s.disciples.find(d => d.id === id), hp = 55 + d.realm * 5; return { id:d.id, name:d.name, x:2, y:2 + i * 3, facing:{x:1,y:0},hp, maxHp:hp, damage:8 + d.realm, cooldown:.8 + i, knockedOut:false }; });
  s.combat = { status:'active', geometryVersion:1, encounterId, regionId:e.regionId, journeyId:e.id, arena:{width:12,height:8}, player:{ x:e.position.x, y:e.position.y, target:null, hp:maxHp * (.72 + m.energy / 360), maxHp, qi:maxQi, maxQi, cooldowns:{attack:0,spell:0,dodge:0,guard:0}, guard:0, evade:0, facing:{x:1,y:0} }, enemies, allies, effects:[],nextEffectId:1,elapsed:0, retreatRequested:false, result:null, rewardApplied:false, message:`移动躲开红色落点；近身攻击或施展远程术法。货箱和碎石阻挡通行与直线攻击，可绕行；左侧可撤离。${WEATHER[e.weather].risk ? '风雨视线不利，敌方命中伤害略增。' : ''}`, prepared:{...p} };
  s.combat.player.hp = Math.min(maxHp, Math.round(s.combat.player.hp));
  e.status = 'combat'; e.target = null;
  s.master.journey.status = 'combat';
  log(s, `${def.name}迎面而来。掌门亲自应战，同行者将自主行动。`);
  return s.combat;
}
function nearestEnemy(c, target) {
  const alive = c.enemies.filter(e => e.hp > 0);
  if (typeof target === 'string') return alive.find(e => e.id === target);
  return alive.sort((a,b) => distance(a, c.player) - distance(b, c.player))[0];
}
function effect(c,kind,source,target,amount=0){
  c.effects??=[];c.nextEffectId??=1;
  c.effects.push({id:c.nextEffectId++,kind,sourceId:source?.id??'master',targetId:target?.id??'master',from:{x:source.x,y:source.y},to:{x:target.x,y:target.y},amount,remaining:kind==='down'?1.2:.75,total:kind==='down'?1.2:.75});
  c.effects=c.effects.slice(-24);
}
function damageActor(c,source,target,amount,kind){
  const applied=Math.min(target.hp,amount);target.hp=Math.max(0,target.hp-amount);
  effect(c,kind,source,target,applied);effect(c,'hit',source,target,applied);
  if(target.hp===0){if(Object.hasOwn(target,'knockedOut'))target.knockedOut=true;if(Object.hasOwn(target,'telegraph')){target.telegraph=null;target.windup=0;}effect(c,'down',source,target,0);}
}
export function combatOptions(s) {
  const c = s.combat;
  if (!c || c.status !== 'active') return [];
  const p = c.player, enemy = nearestEnemy(c);
  return [
    {id:'attack',label:'攻击',range:1.9,cost:0}, {id:'spell',label:'青岚术',range:6,cost:16},
    {id:'dodge',label:'闪避',cost:8}, {id:'guard',label:'守御',cost:4}, {id:'retreat',label:'沿退路撤离',cost:0}
  ].map(a => {
    const cooldown = p.cooldowns[a.id] || 0;
    const reason = cooldown > .001 ? `调息 ${cooldown.toFixed(1)} 秒` : p.qi < a.cost ? `需灵力 ${a.cost}` : a.range && (!enemy || distance(p, enemy) > a.range) ? `需目标在 ${a.range} 步内` : a.range&&!combatClearLine(p,enemy,combatGeometryId(c))?'目标被货箱或碎石遮挡，请绕行':'';
    return {...a, cooldown, disabled:!!reason, reason};
  });
}
export function combatAction(s, kind, target) {
  const c = s.combat;
  if (!c || c.status !== 'active') throw Error('当前没有需要掌门操作的战斗。');
  const p = c.player;
  if (kind === 'move') {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) throw Error('移动目的地无效。');
    const destination={x:clamp(target.x,.6,11.4),y:clamp(target.y,.6,7.4)};
    if(!combatPath(p,destination,combatGeometryId(c)))throw Error('此处有货箱或碎石，选择旁边的可通行地面。');
    p.target = destination;
    c.retreatRequested = false;
    return true;
  }
  const option = combatOptions(s).find(o => o.id === kind);
  if (!option) throw Error('战斗行动不存在。');
  const enemy = nearestEnemy(c, target);
  if (kind === 'attack' || kind === 'spell') {
    if (!enemy) throw Error('目标已经倒下或不存在。');
    if (distance(p, enemy) > option.range) throw Error(`目标超出${kind === 'attack' ? '攻击' : '术法'}范围，请先靠近。`);
    if(!combatClearLine(p,enemy,combatGeometryId(c)))throw Error('目标被货箱或碎石遮挡，请绕行。');
  }
  // An explicitly selected enemy may be in range even if the default nearest
  // target changed during a render, but cooldown and qi are always authoritative.
  if ((p.cooldowns[kind] || 0) > .001) throw Error(option.reason || '尚未调息完毕。');
  if (p.qi < option.cost) throw Error(`灵力不足，需要 ${option.cost}。`);
  p.qi -= option.cost;
  if(['attack','spell'].includes(kind)){const length=distance(p,enemy);if(length>.001)p.facing={x:(enemy.x-p.x)/length,y:(enemy.y-p.y)/length};}
  if (kind === 'attack') { damageActor(c,p,enemy,13 + s.master.realm * 2,'attack'); p.cooldowns.attack = 1.15; c.message = `攻击命中${enemy.name}。`; }
  if (kind === 'spell') { damageActor(c,p,enemy,25 + s.master.realm * 2 + (s.master.knowledge.sword || 0) * .1,'spell'); p.cooldowns.spell = 4.5; c.message = `青岚术命中${enemy.name}。`; }
  if (kind === 'guard') { p.guard = 2.2; p.cooldowns.guard = 5; effect(c,'guard',p,p);c.message = '守御两秒，伤害减少七成。'; }
  if (kind === 'dodge') {
    let dx = target && Number.isFinite(target.x) ? target.x - p.x : -p.facing.x;
    let dy = target && Number.isFinite(target.y) ? target.y - p.y : -p.facing.y;
    if (Math.hypot(dx,dy) < .01) { dx = -1; dy = 0; }
    const length = Math.hypot(dx,dy), step = Math.min(2.8,length < 1 ? 2.8 : length);
    const from={...p},end=dodgeEndpoint(p,{x:clamp(p.x + dx / length * step,.6,11.4),y:clamp(p.y + dy / length * step,.6,7.4)},combatGeometryId(c));
    p.x=end.x;p.y=end.y;effect(c,'dodge',from,p);
    p.target = null; p.evade = .65; p.cooldowns.dodge = 3.2; c.message = '闪避展开，短暂避开伤害。';
  }
  if (kind === 'retreat') { c.retreatRequested = true; p.target = {x:.7,y:4}; c.message = '正沿左侧退路撤离，抵达出口后回山。'; }
  if (c.enemies.every(e => e.hp <= 0)) finishCombat(s, 'won');
  return true;
}
function moveToward(p, target, speed, dt) {
  const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx,dy);
  if (d <= speed * dt) { p.x = target.x; p.y = target.y; return true; }
  p.x += dx / d * speed * dt; p.y += dy / d * speed * dt;
  if (p.facing) p.facing = {x:dx/d,y:dy/d};
  return false;
}
function finishCombat(s, status) {
  const c = s.combat, e = s.world.exploration;
  if (!c || c.status !== 'active' || !e) return;
  c.status = status; c.player.target = null;
  for(const ally of c.allies) e.companionInjuries[ally.id]=Math.max(e.companionInjuries[ally.id]||0,ally.knockedOut?20:ally.hp<ally.maxHp*.5?8:0);
  const def = ENCOUNTERS[c.encounterId];
  if (status === 'won') {
    const key = `battle:${c.encounterId}`;
    once(s, key, () => {
      if (def.clue) addClue(s, def.clue);
      if (def.preparation) preparation(s, def.preparation);
      if (def.gate) { s.story.gateCleared = true; milestone(s, 'gate', '击败守阵者，解除栖霞外阵。'); }
      if (def.final) { s.story.revengeDone = true; s.world.hostility = 0; milestone(s, 'han-defeated', '亲手击败韩厉川。'); }
      grant(s, {jade:def.final ? 40 : 22, insight:def.final ? 10 : 4});
    });
    c.rewardApplied = true;
    const text = def.final ? '韩厉川倒下，夺脉仇怨至此清算。取回遗物后，选择传承的归处。' : `${def.name}已被击败，行动结果已记录。`;
    c.result = {title:'胜利',text,injury:0};
    e.status = 'exploring'; e.position = {x:c.player.x,y:4}; s.master.journey.status = 'exploring';
    finishVisit(s,e,text);
    s.master.energy = Math.max(0,s.master.energy-8);
  } else {
    const injury = status === 'lost' ? 35 : Math.max(0, Math.round((1 - c.player.hp / c.player.maxHp) * 18));
    s.master.wound = clamp(s.master.wound + injury,0,100);
    s.master.energy = Math.max(5,s.master.energy - (status === 'lost' ? 18 : 8));
    const text = status === 'lost' ? '伤重退回云岫，掌门根基未损。线索与既有准备保留；在院中疗伤后可再次出发。' : '已沿退路撤回云岫，线索与既有准备保留。';
    c.result = {title:status === 'lost' ? '暂退养伤' : '平安撤离',text,injury};
    returnCompanions(s,e,{success:false,injury:status === 'lost' ? 15 : 0});
    s.world.exploration = null; s.master.journey = null; s.master.action = 'rest';
    log(s,text);
  }
}
export function acknowledgeCombat(s) {
  if (!s.combat || s.combat.status === 'active') throw Error('战斗尚未结束。');
  s.combat = null;
}
function tickCombat(s, dt) {
  const c = s.combat;
  if (!c || c.status !== 'active') return;
  const p = c.player;
  c.elapsed += dt;
  if(c.effects)c.effects=c.effects.map(v=>({...v,remaining:Math.max(0,v.remaining-dt)})).filter(v=>v.remaining>0);
  for (const id of Object.keys(p.cooldowns)) p.cooldowns[id] = Math.max(0,p.cooldowns[id]-dt);
  p.guard = Math.max(0,p.guard-dt); p.evade = Math.max(0,p.evade-dt); p.qi = Math.min(p.maxQi,p.qi + dt * 3.2);
  const geometryId=combatGeometryId(c);
  if (p.target && moveCombatActor(p,p.target,3.3,dt,geometryId)) p.target = null;
  if (c.retreatRequested && p.x <= 1 && Math.abs(p.y-4) < .5) return finishCombat(s,'retreated');
  for (const enemy of c.enemies.filter(e => e.hp > 0)) {
    enemy.cooldown = Math.max(0,enemy.cooldown-dt);
    if (enemy.telegraph) {
      enemy.telegraph.remaining = Math.max(0,enemy.telegraph.remaining-dt); enemy.windup = enemy.telegraph.remaining;
      if (enemy.windup <= .001) {
        const t = enemy.telegraph;
        effect(c,'impact',enemy,t,t.damage);
        if (distance(p,t) <= t.radius && p.evade <= 0 && combatClearLine(t,p,geometryId)) {
          const damage = Math.round(t.damage * (p.guard > 0 ? .3 : 1));
          damageActor(c,enemy,p,damage,'strike'); c.message = `受到 ${damage} 伤害。${p.guard > 0 ? '守御抵消了大部分冲击。' : '移动或闪避可离开预警圈。'}`;
        }
        for (const ally of c.allies) if (ally.hp > 0 && distance(ally,t) <= t.radius&&combatClearLine(t,ally,geometryId)) damageActor(c,enemy,ally,t.damage*.55,'strike');
        enemy.telegraph = null; enemy.cooldown = enemy.boss ? 1.9 : 2.1;
      }
    } else if (distance(enemy,p) > (enemy.boss ? 3.3 : 1.7)||!combatClearLine(enemy,p,geometryId)) moveCombatActor(enemy,p,enemy.speed,dt,geometryId);
    else if (enemy.cooldown <= .001) {
      enemy.strikes++;
      const heavy = enemy.boss && enemy.strikes % 3 === 0, duration = (heavy ? 1.8 : 1.25) + (c.prepared.witness ? .5 : 0);
      enemy.windup = duration;
      enemy.telegraph = {x:p.x,y:p.y,radius:heavy ? 2.15 : 1.35,remaining:duration,total:duration,damage:Math.round(enemy.damage*(heavy?1.4:1)),kind:heavy?'裂山术':'震脉击'};
    }
  }
  for (const ally of c.allies.filter(a => a.hp > 0)) {
    ally.cooldown = Math.max(0,ally.cooldown-dt);
    const target = c.enemies.filter(e=>e.hp>0).sort((a,b)=>distance(a,ally)-distance(b,ally))[0];
    if (!target) break;
    const danger = c.enemies.find(e=>e.telegraph && distance(ally,e.telegraph)<e.telegraph.radius+.3);
    if (danger){const direction={x:ally.x-danger.telegraph.x,y:ally.y-danger.telegraph.y},length=Math.hypot(direction.x,direction.y)||1,destination={x:clamp(ally.x+(length===1&&direction.x===0?-1.5:direction.x/length*1.5),.6,11.4),y:clamp(ally.y+(length===1&&direction.y===0?(ally.y<4?-1:1):direction.y/length),.6,7.4)};moveCombatActor(ally,dodgeEndpoint(ally,destination,geometryId),2.5,dt,geometryId);}
    else if (distance(ally,target)>2||!combatClearLine(ally,target,geometryId)) moveCombatActor(ally,target,2,dt,geometryId);
    else if (ally.cooldown<=.001) { damageActor(c,ally,target,ally.damage,'attack'); ally.cooldown = 2.1; }
  }
  if (p.hp <= 0) finishCombat(s,'lost');
  else if (c.enemies.every(e=>e.hp<=0)) finishCombat(s,'won');
}

const VISITORS = {
  herbalist:{name:'行脚药师',text:'药师受山中善名吸引，愿按平价交换灵草和口粮。'},
  caravan:{name:'青溪货郎',text:'商队沿已修好的山路来访，愿收山货并留下灵晶。'},
  neighbor:{name:'栖霞旧邻',text:'旧邻听到调查的消息，送来故地近况，也盼你谨慎行事。'}
};
export function visitorOptions(s) {
  return s.world.visitors.filter(v=>!v.resolved).map(v=>({...v,...VISITORS[v.kind],choices:v.kind==='herbalist' ? [choice(s,'exchange','以木换药','交灵木 12，换灵草 16、口粮 8。',{wood:12}),choice(s,'welcome','留客歇脚','款待不收费，提升声望。',{food:4})] : v.kind==='caravan' ? [choice(s,'exchange','山货换灵晶','交灵木 18、青石 12，换灵晶 3、灵石 20。',{wood:18,stone:12}),choice(s,'welcome','通报山路','彼此交换近况，无须花费。')] : [choice(s,'listen','听故地近况','获得道韵，旧邻不会替掌门完成复仇。'),choice(s,'welcome','赠药宽慰','以药材安顿旧邻，获得声望。',{herb:5})]}));
}
export function resolveVisitor(s,id,choiceId) {
  const v = s.world.visitors.find(v=>v.id===id&&!v.resolved), option = visitorOptions(s).find(v=>v.id===id)?.choices.find(c=>c.id===choiceId);
  if (!v || !option) throw Error('这位来客已经离开，或没有此项回应。');
  if (option.disabled) throw Error(option.reason);
  pay(s,option.cost);
  if (choiceId==='exchange') grant(s,v.kind==='herbalist'?{herb:16,food:8}:{crystal:3,jade:20});
  if (choiceId==='listen') grant(s,{insight:4});
  if (choiceId==='welcome') s.sect.reputation += v.kind==='neighbor'?5:2;
  v.resolved = true;
  record(s, `${VISITORS[v.kind].name}来访已回应：${option.label}。`, 'visitor');
}
export function worldSummary(s) {
  return {weather:{...s.world.weather,...WEATHER[s.world.weather.id]},hostility:s.world.hostility,visitors:visitorOptions(s),reactions:s.world.reactions};
}
function tickLegacy(s,dt) {
  const e = s.world.legacyJourney;
  if (!e || e.status!=='traveling') return;
  e.remaining = Math.max(0,e.remaining-dt);
  if (!e.encounterResolved && e.remaining<=e.total/2) { e.remaining=e.total/2;e.status='encounter'; }
  else if (!e.remaining) {
    const r = LEGACY_ROUTES[e.routeId];
    if (r) { grant(s,Object.fromEntries(Object.entries(r.reward).map(([k,v])=>[k,Math.floor(v*e.multiplier)]))); s.sect.reputation+=r.reputation;s.stats.expeditions++; }
    s.world.legacyJourney=null;s.master.journey=null;s.master.action='rest';
    log(s,'升级前的掌门行程已经完成，原定收获已带回。');
  }
  if (s.world.legacyJourney) s.master.journey={...e};
}
export function resolveMasterEncounter(s,choiceId) {
  const e=s.world.legacyJourney;
  if (!e || e.status!=='encounter' || !['careful','bold'].includes(choiceId)) throw Error('当前没有待选择的旧行程奇遇。');
  if (choiceId==='bold') { if(s.master.energy<10)throw Error('需额外十点精力。');s.master.energy-=10;e.multiplier=1.5; }
  e.encounterResolved=true;e.status='traveling';s.master.journey={...e};
}
export function cancelMasterTravel(s) {
  if (s.world.exploration) return leaveRegion(s);
  if (!s.world.legacyJourney) throw Error('掌门未在游历。');
  s.world.legacyJourney=null;s.master.journey=null;s.master.action='rest';log(s,'掌门提前结束旧行程，本次未完成的出行不结算奖励。');
}
export function startMasterTravel(s,id,options) {
  if(['lake_shore','lake_depths'].includes(id))throw Error('寒潭差事由门人自主接取；掌门请从山外舆图选择已发现的调查地点。');
  const region=REGIONS[id]?id:({valley_path:'valley',valley_ruins:'ruins'}[id]);
  if(!region)throw Error('游历地点不存在。');
  return startExploration(s,region,options);
}

export function tickCampaign(s, dt = 1, runtimeHooks = {}) {
  if (!Number.isFinite(dt)||dt<=0) return;
  if (Object.keys(runtimeHooks).length) configureCampaign(runtimeHooks);
  const w=s.world.weather;
  w.remaining-=dt;
  while(w.remaining<=0) { const ids=Object.keys(WEATHER);w.id=ids[Math.floor(rng(s)*ids.length)];w.remaining+=120;w.cycle++;record(s,`山中转为${WEATHER[w.id].name}：${WEATHER[w.id].text}`,'weather'); }
  if (day(s)>=s.world.nextVisitorDay) {
    s.world.nextVisitorDay=day(s)+2;
    if (s.story.step>=2 && s.world.visitors.filter(v=>!v.resolved).length<3) {
      const kind=s.story.step>=4&&s.world.visitorSequence%3===2?'neighbor':s.world.visitorSequence%2?'caravan':'herbalist';
      s.world.visitors.push({id:++s.world.visitorSequence,kind,arrived:s.time,resolved:false});
      s.world.visitors=s.world.visitors.slice(-8);record(s,`${VISITORS[kind].name}来到山门，等待你的回应。`,'visitor');
    }
  }
  tickLegacy(s,dt);
  const e=s.world.exploration;
  if (e?.status==='traveling') {
    e.remaining=Math.max(0,e.remaining-dt);s.master.journey.remaining=e.remaining;
    if (!e.remaining) { e.status='exploring';s.master.journey.status='exploring';log(s,`抵达${REGIONS[e.regionId].name}。在地图中走近${REGIONS[e.regionId].landmark}，再选择查访行动。`); }
  } else if(e?.status==='exploring' && e.target && moveToward(e.position,e.target,2.7,dt)) e.target=null;
  let remaining=Math.min(dt,3600);
  while(remaining>0 && s.combat?.status==='active') {const slice=Math.min(.1,remaining);tickCombat(s,slice);remaining-=slice;}
}
export function getCampaignScene(s) {
  const c=s.combat,e=s.world.exploration;
  if(c?.status==='active'||c?.status==='won'&&e) {const geometryId=combatGeometryId(c),arena=combatField(geometryId);return {type:'combat',status:c.status,interactive:c.status==='active',name:ENCOUNTERS[c.encounterId].name,regionId:c.regionId,geometryId,background:c.geometryVersion===1?'region':'arena',width:12,height:8,arena,player:{...c.player,id:'master',appearance:appearance('master')},enemies:c.enemies.map(v=>({...v,appearance:4})),allies:c.allies.map(a=>({...a,appearance:appearance(a.id)})),effects:c.effects||[],actionRanges:combatOptions(s).filter(a=>a.range).map(a=>({id:a.id,range:a.range,available:!a.disabled})),obstacles:arena.obstacles,landmarks:[{id:'exit',name:'撤离出口',x:.7,y:4,radius:.7}],weather:e?.weather||s.world.weather.id};}
  if(!e || e.status==='traveling') return null;
  return {type:'region',name:REGIONS[e.regionId].name,regionId:e.regionId,background:e.regionId==='ruins'?'lake':e.regionId==='qixia'?'map':'valley',width:12,height:8,player:{...e.position,id:'master',appearance:appearance('master'),target:e.target},enemies:[],allies:e.companionIds.map((id,i)=>({id,appearance:appearance(id),name:s.disciples.find(d=>d.id===id)?.name||'同行者',x:Math.max(.2,e.position.x-.45*(i+1)),y:e.position.y})),obstacles:[],landmarks:[{id:'objective',name:REGIONS[e.regionId].landmark,x:8,y:4,radius:2.2},{id:'exit',name:'归山路',x:.7,y:4,radius:.7}],weather:e.weather};
}

export function validateCampaign(s) {
  const bad=message=>{throw Error(`篇章存档异常：${message}`);},num=(v,min=0,max=1e12)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,int=(v,min=0,max=1e12)=>Number.isSafeInteger(v)&&num(v,min,max),str=(v,max=400)=>typeof v==='string'&&v.length<=max,unique=a=>Array.isArray(a)&&new Set(a).size===a.length,point=p=>p&&num(p.x,.5,11.5)&&num(p.y,.5,7.5);
  const st=s.story,w=s.world,c=s.combat;
  if(!st||!int(st.step,0,10)||typeof st.intro!=='boolean'||!unique(st.clues)||!st.clues.every(id=>CLUES[id])||!unique(st.claimed)||st.claimed.length>40||!st.claimed.every(id=>/^story:[0-9]$/.test(id)||Object.keys(ENCOUNTERS).some(e=>id===`battle:${e}`))||!st.preparations||!Object.keys(PREPARATIONS).every(k=>typeof st.preparations[k]==='boolean')||['gateCleared','revengeDone','completed'].some(k=>typeof st[k]!=='boolean')||![null,'rebuild','return'].includes(st.ending))bad('主线进度');
  if(st.completed!==(st.step===10)||st.completed!==!!st.ending||(st.step>=9&&!st.revengeDone)||(st.step>=8&&!st.gateCleared)||!Array.isArray(st.milestones)||st.milestones.length>30||!st.milestones.every(m=>str(m.id,80)&&str(m.text)&&num(m.time)))bad('章节结果');
  if(Array.from({length:10},(_,i)=>i).some(i=>st.claimed.includes(`story:${i}`)!==(i<st.step))||(st.step>=5&&(st.clues.length<2||!s.doctrine.books.includes('foundation')))||(st.step>=6&&s.master.realm<10)||(st.step>=7&&prepCount(s)<2)||st.revengeDone!==st.claimed.includes('battle:challenge')||Object.keys(st.preparations).length!==4)bad('章节前置或一次性结果');
  if(!w||!WEATHER[w.weather?.id]||!num(w.weather.remaining,0,120)||!int(w.weather.cycle)||!num(w.hostility,0,100)||!int(w.nextJourneyId,1)||!int(w.nextVisitorDay)||!int(w.visitorSequence)||!w.visits||Object.entries(w.visits).some(([id,n])=>!REGIONS[id]||!int(n))||!Array.isArray(w.reactions)||w.reactions.length>20||!w.reactions.every(r=>num(r.time)&&str(r.text)&&str(r.kind,40)))bad('天气与世界');
  if(!Array.isArray(w.visitors)||w.visitors.length>8||!unique(w.visitors.map(v=>v.id))||!w.visitors.every(v=>int(v.id,1,w.visitorSequence)&&VISITORS[v.kind]&&num(v.arrived)&&typeof v.resolved==='boolean'))bad('来访者');
  const e=w.exploration;
  if(e!==null) {
    if(!e||!REGIONS[e.regionId]||!int(e.id,1,w.nextJourneyId-1)||!['traveling','exploring','combat'].includes(e.status)||!num(e.total,1,100)||!num(e.remaining,0,e.total)||!point(e.position)||(e.target!==null&&!point(e.target))||!EVENT_TEXT[e.eventId]||!WEATHER[e.weather]||!int(e.visit)||typeof e.resolved!=='boolean'||!unique(e.companionIds)||e.companionIds.length>2||!e.companionIds.every(id=>s.disciples.some(d=>d.id===id))||(e.outcome!==null&&!str(e.outcome)))bad('探索行程');
    if(s.master.journey?.kind!=='campaign'||s.master.journey.routeId!==e.regionId||s.master.journey.status!==e.status||s.master.journey.remaining!==e.remaining||s.master.journey.total!==e.total)bad('掌门行程不一致');
    if(e.status!=='traveling'&&e.remaining!==0)bad('地区到达状态');
    if(e.companionIds.some(id=>s.disciples.find(d=>d.id===id)?.mind.away?.kind!=='campaign')||!e.companionInjuries||Object.entries(e.companionInjuries).some(([id,injury])=>!e.companionIds.includes(Number(id))||!num(injury,0,100)))bad('同行者状态');
  } else if(s.master.journey?.kind==='campaign')bad('缺少探索记录');
  if(w.legacyJourney!==null) {
    const l=w.legacyJourney,r=LEGACY_ROUTES[l?.routeId];
    if(!r||e||l.total!==r.duration||!num(l.remaining,0,l.total)||!['traveling','encounter'].includes(l.status)||typeof l.encounterResolved!=='boolean'||![1,1.5].includes(l.multiplier)||(l.status==='encounter'&&(l.encounterResolved||l.remaining!==l.total/2)))bad('旧版游历');
    if(!s.master.journey||s.master.journey.routeId!==l.routeId||s.master.journey.remaining!==l.remaining||s.master.journey.status!==l.status)bad('旧版行程不同步');
  }
  if(c!==null) {
    if(!c||!ENCOUNTERS[c.encounterId]||!REGIONS[c.regionId]||!['active','won','lost','retreated'].includes(c.status)||!int(c.journeyId,1)||c.arena?.width!==12||c.arena?.height!==8||!num(c.elapsed)||typeof c.retreatRequested!=='boolean'||typeof c.rewardApplied!=='boolean'||!str(c.message)||!c.prepared||!Object.keys(PREPARATIONS).every(k=>typeof c.prepared[k]==='boolean'))bad('战斗结构');
    if(c.geometryVersion!==undefined&&c.geometryVersion!==1)bad('战场版本');
    const p=c.player;
    if(!point(p)||(p.target!==null&&!point(p.target))||!num(p.maxHp,1,1000)||!num(p.hp,0,p.maxHp)||!num(p.maxQi,1,1000)||!num(p.qi,0,p.maxQi)||!num(p.guard,0,3)||!num(p.evade,0,1)||!p.cooldowns||!['attack','spell','dodge','guard'].every(k=>num(p.cooldowns[k],0,6))||!num(p.facing?.x,-1,1)||!num(p.facing?.y,-1,1))bad('掌门战斗状态');
    if(!Array.isArray(c.enemies)||c.enemies.length<1||c.enemies.length>3||!unique(c.enemies.map(e=>e.id)))bad('敌方人数');
    for(const foe of c.enemies) {if(!point(foe)||!str(foe.id,40)||!str(foe.name,60)||!num(foe.maxHp,1,1000)||!num(foe.hp,0,foe.maxHp)||!num(foe.damage,1,100)||!num(foe.speed,.1,5)||!num(foe.cooldown,0,5)||!num(foe.windup,0,3)||!int(foe.strikes)||typeof foe.boss!=='boolean')bad('敌方状态');const t=foe.telegraph;if(t!==null&&(!point(t)||!num(t.radius,.1,4)||!num(t.total,.1,3)||!num(t.remaining,0,t.total)||!num(t.damage,1,150)||!str(t.kind,30)))bad('攻击预警');}
    if(!Array.isArray(c.allies)||c.allies.length>2||!unique(c.allies.map(a=>a.id))||!c.allies.every(a=>(c.status!=='active'||s.disciples.some(d=>d.id===a.id))&&point(a)&&str(a.name,30)&&num(a.maxHp,1,1000)&&num(a.hp,0,a.maxHp)&&num(a.damage,1,100)&&num(a.cooldown,0,4)&&typeof a.knockedOut==='boolean'))bad('同行战斗状态');
    if([...c.allies,...c.enemies].some(a=>a.facing!==undefined&&(!num(a.facing?.x,-1,1)||!num(a.facing?.y,-1,1))))bad('人物战斗朝向');
    if(c.allies.some(a=>a.knockedOut!==(a.hp===0)))bad('同行者倒地状态');
    if(c.geometryVersion===1&&[p,...c.allies,...c.enemies].some(actor=>!combatCanStand(actor,c.regionId)))bad('人物越过战场通行边界');
    if(c.effects!==undefined&&(!Array.isArray(c.effects)||c.effects.length>24||!int(c.nextEffectId,1)||!unique(c.effects.map(v=>v.id))||!c.effects.every(v=>int(v.id,1,c.nextEffectId-1)&&['attack','spell','guard','dodge','impact','strike','hit','down'].includes(v.kind)&&['master',...c.enemies.map(v=>v.id),...c.allies.map(v=>v.id)].includes(v.sourceId)&&['master',...c.enemies.map(v=>v.id),...c.allies.map(v=>v.id)].includes(v.targetId)&&point(v.from)&&point(v.to)&&num(v.amount,0,150)&&num(v.total,.1,1.2)&&num(v.remaining,0,v.total))))bad('战斗表现事件');
    if(c.status==='active'&&(!e||e.status!=='combat'||e.id!==c.journeyId||e.regionId!==c.regionId||c.rewardApplied||c.result!==null||p.hp<=0||c.allies.length!==e.companionIds.length||c.allies.some((a,i)=>a.id!==e.companionIds[i])))bad('战斗与探索关联');
    if(c.status!=='active'&&(!c.result||!str(c.result.title,40)||!str(c.result.text)||!num(c.result.injury,0,100)))bad('战斗结果');
    if(c.status==='won'&&(!c.rewardApplied||c.enemies.some(e=>e.hp>0)))bad('战斗奖励');
  }
  if(e?.status==='combat'&&c?.status!=='active')bad('缺少未结束战斗');
  return s;
}
