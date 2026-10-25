import {nearestVisibleBodyTarget,visibleBodyRouteClear} from './ea-sr-spatial.mjs';
import {companionInTalkingReach,attachExpeditionCompanions,expeditionPeer,expeditionPartySnapshot,waitForExpeditionPeer,waitDuringExpedition,relayExpeditionWarnings,validateExpeditionCooperation} from './ea-disciple-expedition-cooperation.mjs';
import {newExpeditionMedicine,prepareExpeditionMedicine,advanceExpeditionMedicine,finishExpeditionMedicine,validateExpeditionMedicine} from "./ea-disciple-expedition-medicine.mjs";
import {
  avatarObservationPlanSR,
  recordFactSR,
  personLocalPathSR,
  sceneExitPointSR,
} from "./ea-sr-world.mjs";
import {
  scenicFindPath,
  scenicNearest,
  advanceScenic,
  geometryRevision,
} from "./ea-scenic.mjs";
import { releaseBodyActivity } from "./ea-facility-activities.mjs";
import { addAmounts, subtractAmounts } from "./ea-resource-amounts.mjs";
import { xpNeed, log, BUILDINGS } from "./ea-data.mjs";
import { stockpileReceiptPreview } from "./ea-sr-economy.mjs";
const HOME = "scene:yunxiu-courtyard",
  VALLEY = "scene:valley",
  PATCH = "object:valley:herbs";
// T-DISCIPLE-EXPEDITION-20261024: one voluntary outing; two food, eight energy,
// 40 preparation ticks, 60 gathering ticks, at most six herbs and eight experience.
const T = {
  food: 2,
  energy: 8,
  prepare: 40,
  gather: 60,
  herbs: 6,
  xp: 8,
  cooldown: 1200,
};
// U-63, T-EXPEDITION-PURPOSE-20261025: departure uses public home supply
// and the traveller's own completed observations, never remote live entities.
const SCOUT_POINT = Object.freeze({ x: 27, y: 30.5 });
const PURPOSE_LABELS = Object.freeze({ supply: "采药补给", explore: "探索修行" });
function purposeScores(i) {
  const shortage = Math.max(0, Math.min(1, (i.herbTarget - i.homeHerb) / i.herbTarget));
  return {
    supply: 20 + shortage * 40 + i.kindness * .1 + i.plant * .05 + (/草木|药/.test(i.goal) ? 20 : 0),
    explore: 20 + i.ambition * .2 + i.curiosity * .3 + (/奇法|长生|见闻|探索/.test(i.goal) ? 20 : 0) - (i.knownRisk === "high" ? 40 : i.knownRisk === "avoidable" ? 20 : 0),
  };
}
function purposeReason(purpose, i) {
  if (purpose === "supply") return i.knownRisk
    ? "记得上次亲见的山谷风险，先沿已知道路采药补给，暂缓深入探索。"
    : i.homeHerb < i.herbTarget
      ? "院中药草有缺口，愿沿已知道路采药，带回实际所得。"
      : "结合自己的志向与所长，愿沿已知道路采药补给。";
  return i.homeHerb >= i.herbTarget
    ? "院中药草已有储备，愿沿已知山路探索修行，遇险仍会退避。"
    : "结合自己的修行志向与已有准备，愿沿已知山路探索修行，遇险仍会退避。";
}
function knownRiskJourney(s, personId, atTick = s.worldTick) {
  return (s.discipleExpeditions?.journeys || [])
    .filter(j => j.personId === personId && j.phase === "returned" && j.completedTick <= atTick && j.encounter?.lastObservedTick <= atTick)
    .sort((a, b) => b.encounter.lastObservedTick - a.encounter.lastObservedTick || b.startedTick - a.startedTick)[0];
}
/** Read-only choice; the formal departure records this exact source snapshot. */
export function expeditionPurposeDecision(s, p) {
  const homeResidents = s.disciples.filter(x => x.lifeStatus !== "dead" && !x.mind?.away && x.location?.sceneId === HOME).length;
  const prior = knownRiskJourney(s, p.personId);
  const inputs = {
    herbTarget: Math.max(45, homeResidents * 8),
    homeHerb: s.stockpilesById?.["stockpile:yunxiu"]?.resources?.herb ?? s.resources.herb ?? 0,
    homeResidents,
    kindness: p.mind.traits[0], plant: p.mind.skills.plant || 0,
    ambition: p.mind.traits[1], curiosity: p.mind.traits[4],
    goal: p.mind.goal || p.goal || "修行与生活", knownRisk: prior?.encounter.risk || null,
  };
  const scores = purposeScores(inputs), purpose = scores.supply >= scores.explore ? "supply" : "explore";
  return { purpose, purposeDecision: { version: 1, inputs, scores, riskSourceJourneyId: prior?.id || null, reason: purposeReason(purpose, inputs) } };
}
let encounterStep = null;
export function configureDiscipleExpeditions(hooks = {}) {
  encounterStep = hooks.encounterStep || null;
}
export function setDiscipleExpeditions(s, { enabled, allowCompanions } = {}) {
  if (allowCompanions !== undefined && typeof allowCompanions !== "boolean") throw Error("结伴机会需明确开启或关闭");
  if (typeof enabled !== "boolean") throw Error("历练政策需明确开启或关闭");
  s.discipleExpeditions ??= {
    version: 1,
    enabled: false,
    lastTick: s.worldTick,
    nextId: 1,
    nextOpportunityTick: s.worldTick,
    journeys: [],
  };
  s.discipleExpeditions.enabled = enabled;
  if(allowCompanions!==undefined)s.discipleExpeditions.allowCompanions=allowCompanions;
  return discipleExpeditionsView(s);
}
const active = (r) =>
  r.journeys.find((j) => !["returned", "cancelled", "dead"].includes(j.phase));
function departureBlockReason(s, p) {
  if (p.lifeStatus === "dead") return "此人已经身故";
  if (p.mind?.away) return "已有外出安排";
  if(p.mind?.recovering || p.mind?.satiety<22)return "先完成养伤与生活补给，再权衡出行";
  if (
    p.mind?.office ||
    (p.job && !["study", "cultivate"].includes(p.mind?.activity))
  )
    return "已有留守职责，先履行当前承诺";
  if (p.mind?.learning) return "已有未完成的功课，先完成当前研习";
  if (
    p.mind?.commitUntil > s.time ||
    p.schedule?.commitUntilTick > s.worldTick ||
    Object.values(p.schedule?.commitmentsById || {}).some(c => c.status === "active" && c.endTick > s.worldTick)
  ) return "已有尚未到期的承诺，先履行当前安排";
  if (p.activityId && s.activitiesById?.[p.activityId]?.kind !== "facility") return "已有身体活动，先完成当前事务";
  if (p.location?.kind !== "local" || p.location.sceneId !== HOME) return "本人尚未归院";
  if ((p.wound || 0) > 5) return "伤势未愈，先在院调养";
  if (p.energy < 75) return "精力不足，先休息";
  if (!p.mind?.main) return "尚需先掌握立身功法";
  if ((p.mind.traits?.[1] || 0) + (p.mind.traits?.[4] || 0) <= 75)
    return "暂时更愿留院修行";
  return null;
}
function refusal(s, p) {
  const blocked = departureBlockReason(s, p);
  if (blocked) return blocked;
  if ((s.resources.food || 0) < T.food + s.disciples.length * 2)
    return "先保留宗门口粮";
  return "愿意考虑，仍需留守和通路条件成立";
}
function eligible(s, p) {
  return departureBlockReason(s, p) === null;
}
function homePath(s, p, goal) {
  const a = p.mind.scenic;
  if (!a) return null;
  const exact = scenicFindPath(s, a, goal);
  if (exact) return exact;
  const near = scenicNearest(s, goal, { maxDistance: goal.radius || 1.8 });
  return near && scenicFindPath(s, a, near);
}
// Distinct real standing points inside the original handover/exit range.
function partyStop(s,p,j,center,radius,kind){
 if(!j.party)return {x:center.x,y:center.y};
 const peer=expeditionPeer(s,j),occupied=Object.values(s.personsById).filter(x=>x!==p&&x.lifeStatus!=='dead'&&x.location?.kind==='local'&&x.location.sceneId===HOME).map(x=>x.location);
 const reserved=kind==='supply'?peer?.supplyGoal:kind==='delivery'?peer?.deliveryGoal:peer?.exit;if(reserved)occupied.push(reserved);
 const sign=j.party.role==='leader'?-1:1;
 for(const [x,y] of [[sign*.9,.9],[sign*1.2,0],[sign*.9,-.9],[0,1.2],[0,-1.2]]){
  const point=nearestVisibleBodyTarget(s,p.mind.scenic,{x:center.x+x,y:center.y+y},occupied,{maxDistance:.25,step:.25});
  if(!point||Math.hypot(point.x-center.x,point.y-center.y)>radius)continue;
  const path=homePath(s,p,point);if(path&&visibleBodyRouteClear(s,p.mind.scenic,path))return point;
 }
 return null;
}
function planPartyScout(s,p,j){
 if(!j.party)return personLocalPathSR(s,p.personId,{...SCOUT_POINT});
 const peer=expeditionPeer(s,j),offsets=j.party.role==='leader'?[[0,0],[-1.2,0],[1.2,0]]:[[-1.2,0],[1.2,0],[0,-1.2]];
 for(const [dx,dy] of offsets){const target={x:SCOUT_POINT.x+dx,y:SCOUT_POINT.y+dy};if(peer?.scoutGoal&&Math.hypot(target.x-peer.scoutGoal.x,target.y-peer.scoutGoal.y)<.6)continue;const path=personLocalPathSR(s,p.personId,target);if(path){j.scoutGoal={version:1,...target};return path;}}
 return null;
}
function lock(s, p, j) {
  const id = `activity:sr:disciple-expedition:${j.id}`;
  s.activitiesById ??= {};
  s.activitiesById[id] = {
    id,
    kind: "sr-disciple-expedition",
    personId: p.personId,
    startedTick: s.worldTick,
    status: "executing",
  };
  p.activityId = id;
  p.job = null;
  p.mind.activity = "walk";
  p.mind.away = null;
}
function unlock(s, p, j) {
  if (j) {finishExpeditionMedicine(s, p, j);delete j.partyWait;}
  delete s.activitiesById[p.activityId];
  p.activityId = null;
  p.mind.away = null;
  p.mind.activity = "rest";
  p.mind.lastDecision = s.time;
  p.mind.commitUntil = s.time + 8;
}
const valleyArrival=j=>({x:7+(j.party?.role==='companion'?1.2:0),y:27});
function travel(s, p, j, returning = false) {
  delete j.partyWait;
  const id = `travel:disciple:${j.id}:${returning ? "home" : "valley"}`,
    r = s.routesById["route:home-valley"];
  const t = {
    id,
    from: returning ? VALLEY : HOME,
    destination: returning ? HOME : VALLEY,
    participantIds: [p.personId],
    routeIds: [r.id],
    routeRevisions: [r.revision],
    startedTick: s.worldTick,
    lastTick: s.worldTick,
    durationTicks: r.ticks || 80,
    progressTicks: 0,
    status: "traveling",
  };
  s.travelsById[id] = t;
  p.mind.activity = "travel";
  j.travelId = id;
  j.phase = returning ? "returning" : "outbound";
  p.location = { kind: "travel", travelId: id };
  p.position = { kind: "worldTravel", travelId: id };
  s.activitiesById[p.activityId].kind = "sr-travel";
  p.mind.away = { kind: "sr", id };
}
function finish(s, p, j) {
  const home = s.stockpilesById?.["stockpile:yunxiu"], herbs = j.cargo.herb || 0;
  if (herbs > 0) {
    const b = home?.buildingId && s.buildingsById[home.buildingId];
    if (!home || home.access !== "public" || home.ownerId !== s.master.personId ||
        home.carrierId || home.position?.sceneId !== HOME ||
        home.buildingId && (!b || b.enabled === false || b.disabled || b.condition <= 0 || b.spatialLock)) {
      p.mind.reason = "公库的公共产权、所在地或设施暂不可用，药草仍由本人携带，等待实际交库。";
      return;
    }
    if (p.position?.sceneId !== HOME || p.location?.kind !== "local" ||
        Math.hypot(p.mind.scenic.x - home.position.x, p.mind.scenic.y - home.position.y) >= 2) {
      p.mind.reason = "尚未实际到达当前公库交接位置，药草仍由本人携带。";
      return;
    }
  }
  if (!finishExpeditionMedicine(s, p, j)) return;
  if (herbs > 0) {
    // Returning an unused public pill can use storage first; quote the herbs
    // afterwards so the two real handovers cannot overflow the same space.
    const receipt = stockpileReceiptPreview(s, home.id, { herb: herbs });
    if (!receipt.available) {
      p.mind.reason = `${receipt.reason}药草仍由本人携带，等待腾出库位后交付。`;
      return;
    }
  }
  j.phase = "returned";
  j.completedTick = s.worldTick;
  s.discipleExpeditions.nextOpportunityTick = s.worldTick + T.cooldown;
  j.report = j.retreated
    ? j.encounter ? `山谷见险后主动撤回，带回药草${j.cargo.herb || 0}份。${j.encounter.injury > 0 ? `途中近身受伤${j.encounter.injury}。` : "亲眼发现风险后折返。"}`
      : j.partyWarning ? `收到近处同伴亲见风险的提醒后主动撤回，带回药草${j.cargo.herb||0}份。`
      : `未能继续结伴，按约主动撤回，带回药草${j.cargo.herb||0}份。`
    : j.purpose === "explore"
      ? (s.factsById[`fact:disciple:${j.id}:exploration`] ? "沿已知路线完成山谷探索修行，没有采集药草。" : "探索路线未能完成，已沿来路归院。")
      : `完成山谷采寻，带回药草${j.cargo.herb || 0}份。`;
  const stock =
    s.stockpilesById?.["stockpile:yunxiu"]?.resources || s.resources;
  stock.herb = addAmounts(stock.herb || 0, j.cargo.herb || 0);
  j.delivered = { ...j.cargo };
  recordFactSR(s, `fact:disciple:${j.id}:delivery`, {
    kind: "cargo-transfer",
    personId: p.personId,
    targetStockpileId: "stockpile:yunxiu",
    cargo: { ...j.cargo },
    text: "本人实际回到交库地点，交付个人携带药草",
  });
  j.cargo.herb = 0;
  const previousXp = p.xp;
  const gathered = s.factsById[`fact:disciple:${j.id}:gather`];
  const earned = j.purpose === "explore"
    ? !!s.factsById[`fact:disciple:${j.id}:exploration`]
    : j.purpose === "supply" ? gathered?.amount > 0 : !!gathered;
  if (earned) p.xp = Math.min(xpNeed(p.realm), p.xp + T.xp);
  j.growth = { experience: p.xp - previousXp, wound: p.wound || 0 };
  if(j.partyWarning)j.report += "途中听到近处同伴亲见风险的提醒，共同沿来路撤回。";
  if(j.partySupport)j.report += "曾在安全退路等候同伴调药后继续归院。";
  if(j.partySeparated)j.report += j.partySeparated.reason;
  j.report += `见闻积累${j.growth.experience}，离院伤势${j.departedWound || 0}，归来伤势${j.growth.wound}。`;
  if (j.medicine) j.report += `本趟实际服药${j.medicine.use?.status === "consumed" ? 1 : 0}份，未用公药归还${j.medicine.returned}份。`;
  unlock(s, p, j);
  if (p.wound > 5) {
    p.mind.recovering = true;
    p.mind.activity = "heal";
    p.mind.commitUntil = s.time;
  }
  p.mind.reason = p.wound > 5
    ? `${j.report}${stock.herb >= 1 ? "伤势需要照料，自行取用草药调养。" : "伤势未愈且缺少草药，先自然调养，暂缓差事与出行。"}`
    : j.report;
  log(s, `${p.name}归院：${j.report}`);
}
// A due resident may consider a new outing before renewing a daily task.
// Existing journeys stay with the regular owner; this entry only creates one.
export function considerDiscipleExpeditionDeparture(s, personId) {
  const r = s.discipleExpeditions, p = s.personsById?.[personId];
  if (!r?.enabled || r.lastTick >= s.worldTick || active(r) || !p ||
      p.mind?.satiety < 22 || p.mind?.recovering || departureBlockReason(s, p)) return false;
  step(s, r, personId);
  if (!active(r)) return false;
  r.lastTick = s.worldTick;
  return true;
}
function step(s, r, departurePersonId = null, journeyId = null, snapshot = null) {
  let j = journeyId ? r.journeys.find(x=>x.id===journeyId) : active(r);
  if(j&&["returned","cancelled","dead"].includes(j.phase))return;
  if (!j) {
    if (!r.enabled || s.worldTick < r.nextOpportunityTick) return;
    const residents = s.disciples.filter(
      (p) =>
        p.lifeStatus !== "dead" &&
        !p.mind?.away &&
        p.location?.sceneId === HOME,
    );
    if (
      residents.length < 2 ||
      (s.resources.food || 0) < T.food + residents.length * 2
    )
      return;
    const route = s.routesById?.["route:home-valley"];
    if (!route || route.condition !== "open") return;
    const candidates = residents
      .filter((p) => (!departurePersonId || p.personId === departurePersonId) && eligible(s, p))
      .sort(
        (a, b) =>
          b.mind.traits[1] +
          b.mind.traits[4] -
          (a.mind.traits[1] + a.mind.traits[4]),
      );
    const exit = sceneExitPointSR(s, "exit:yunxiu-valley"),
      candidate = candidates
        .map((p) => ({ p, path: homePath(s, p, exit) }))
        .find((c) => c.path),
      p = candidate?.p,
      path = candidate?.path;
    if (!p) return;
    const makeJourney=(member,personPath)=>{
      const created = {
      id: `outing:${r.nextId++}`,
      personId: member.personId,
      ...expeditionPurposeDecision(s, member),
      medicine: newExpeditionMedicine(),
      phase: "preparing",
      startedTick: s.worldTick,
      progress: 0,
      cargo: { herb: 0 },
      home: { x: member.mind.scenic.x, y: member.mind.scenic.y },
      departedWound: member.wound || 0,
      exit: { x: exit.x, y: exit.y },
      path: personPath,
      goal: member.mind.goal || member.goal || "采寻药草，增长见闻",
    };
      r.journeys.push(created);return created;
    };
    const purpose=expeditionPurposeDecision(s,p).purpose;
    const companion=r.allowCompanions&&residents.length>=3&&s.resources.food>=T.food*2+residents.length*2 ? residents.filter(x=>x!==p&&eligible(s,x)&&companionInTalkingReach(p,x)&&expeditionPurposeDecision(s,x).purpose===purpose).sort((a,b)=>a.personId.localeCompare(b.personId)).map(member=>({member,path:homePath(s,member,exit)})).find(x=>x.path):null;
    j=makeJourney(p,path);
    const peer=companion?makeJourney(companion.member,companion.path):null;
    if(peer){attachExpeditionCompanions(s,j,peer);
      for(const outing of [j,peer]){const member=s.personsById[outing.personId],goal=partyStop(s,member,outing,exit,1.5,'exit');if(goal){outing.exit=goal;outing.path=homePath(s,member,goal);}}
    }
    r.nextOpportunityTick=s.worldTick+T.cooldown;
    for(const outing of [j,peer].filter(Boolean)){const member=s.personsById[outing.personId];releaseBodyActivity(s,member);lock(s,member,outing);member.mind.reason=outing.purposeDecision.reason;}
    return;
  }
  const p = s.personsById[j.personId];
  if (p.lifeStatus === "dead") {
    j.phase = "dead";
    j.completedTick = s.worldTick;
    finishExpeditionMedicine(s, p, j);delete j.partyWait;
    return;
  }
  if (j.phase === "preparing") {
    if (!j.supplyArrived) {
      const stock = s.stockpilesById["stockpile:yunxiu"];
      if(!j.supplyGoal){const goal=partyStop(s,p,j,stock.position,1.5,'supply');if(!goal){p.mind.reason='公库交接范围暂没有合法空位，等待真实通路。';return;}j.supplyGoal=goal;}
      if (!j.supplyStarted) {
        const path = homePath(s, p, j.supplyGoal);
        if (!path) {
          j.phase = "cancelled";
          unlock(s, p, j);
          return;
        }
        Object.assign(p.mind.scenic, {
          path,
          goal: j.supplyGoal,
          revision: geometryRevision(s),
        });
        j.supplyStarted = true;
      }
      advanceScenic(p.mind.scenic, 3.6, s);
      p.location = {
        kind: "local",
        sceneId: HOME,
        x: p.mind.scenic.x,
        y: p.mind.scenic.y,
      };
      p.position = {
        kind: "scene",
        sceneId: HOME,
        x: p.location.x,
        y: p.location.y,
      };
      if (p.mind.scenic.path.length) return;
      if (
        Math.hypot(
          p.location.x - j.supplyGoal.x,
          p.location.y - j.supplyGoal.y,
        ) > 2
      ) {
        j.phase = "cancelled";
        unlock(s, p, j);
        return;
      }
      j.supplyArrived = true;
      j.path = homePath(s, p, j.exit);
      if (!j.path) {
        j.phase = "cancelled";
        unlock(s, p, j);
        return;
      }
    }
    if (j.progress<T.prepare)j.progress++;
    if(j.progress<T.prepare)return;
    const preparingPeer=expeditionPeer(s,j);
    if(preparingPeer&&!j.partySeparated&&!['cancelled','dead','returned'].includes(preparingPeer.phase)){
      const other=s.personsById[preparingPeer.personId],near=other.location?.kind==='local'&&other.location.sceneId===HOME&&Math.hypot(other.location.x-p.location.x,other.location.y-p.location.y)<=6;
      if(!(near&&preparingPeer.supplyArrived)&&waitForExpeditionPeer(s,p,j,'在公库按约等候同伴实际到场备粮。',{kind:'supply'}))return;
    }
    delete j.partyWait;
    if (!r.enabled || s.resources.food < T.food) {
      j.phase = "cancelled";
      unlock(s, p, j);
      return;
    }
    prepareExpeditionMedicine(s, p, j);
    s.resources.food = subtractAmounts(s.resources.food, T.food);
    p.energy -= T.energy;
    j.cost = { food: T.food, energy: T.energy };
    recordFactSR(s, `fact:disciple:${j.id}:supply`, {
      kind: "cargo-transfer",
      personId: p.personId,
      cost: j.cost,
      text: "本人准备并实际消耗往返口粮与精力",
    });
    j.phase = "approach";
    Object.assign(p.mind.scenic, {
      path: j.path,
      goal: j.exit,
      revision: geometryRevision(s),
    });
  }
  if (j.phase === "approach") {
    advanceScenic(p.mind.scenic, 3.6, s);
    p.location = {
      kind: "local",
      sceneId: HOME,
      x: p.mind.scenic.x,
      y: p.mind.scenic.y,
    };
    p.position = {
      kind: "scene",
      sceneId: HOME,
      x: p.location.x,
      y: p.location.y,
    };
    if (p.mind.scenic.path.length) return;
    if (
      Math.hypot(p.mind.scenic.x - j.exit.x, p.mind.scenic.y - j.exit.y) > 2
    ) {
      j.phase = "cancelled";
      s.resources.food = addAmounts(s.resources.food, j.cost.food);
      p.energy += j.cost.energy;
      j.refunded = true;
      recordFactSR(s, `fact:disciple:${j.id}:refund`, {
        kind: "cargo-transfer",
        personId: p.personId,
        cost: j.cost,
        text: "山门通路中断，未出行口粮与预留精力归还",
      });
      unlock(s, p, j);
      return;
    }
    const peer=expeditionPeer(s,j);
    j.exitArrived=true;
    if(peer&&!j.partySeparated&&!['cancelled','dead','returned'].includes(peer.phase)){
      const other=s.personsById[peer.personId];
      const together=peer.phase==='approach'&&peer.exitArrived&&other.location?.kind==='local'&&other.location.sceneId===HOME&&Math.hypot(other.location.x-p.location.x,other.location.y-p.location.y)<=6;
      if(!together&&waitForExpeditionPeer(s,p,j,'在山门按约等候同伴实际到场。',{kind:'exit-out'}))return;
      if(together)travel(s,other,peer);
    }
    travel(s, p, j);
    return;
  }
  if (["outbound", "returning"].includes(j.phase)) {
    const t = s.travelsById[j.travelId];
    if(t.lastTick===s.worldTick)return;
    if (s.routesById["route:home-valley"].condition !== "open") {
      t.status = "blocked";
      return;
    }
    t.status = "traveling";
    t.lastTick = s.worldTick;
    if (++t.progressTicks < t.durationTicks) return;
    t.status = "arrived";
    t.completedTick = s.worldTick;
    const returning = j.phase === "returning";
    p.location = {
      kind: "local",
      sceneId: returning ? HOME : VALLEY,
      x: returning ? j.exit.x : valleyArrival(j).x,
      y: returning ? j.exit.y : valleyArrival(j).y,
    };
    p.position = {
      kind: "scene",
      sceneId: p.location.sceneId,
      x: p.location.x,
      y: p.location.y,
    };
    if (returning) {
      Object.assign(p.mind.scenic, {
        x: j.exit.x,
        y: j.exit.y,
        path: [],
        goal: null,
      });
      j.phase = "delivery";
      p.mind.away = null;
      p.mind.activity = "walk";
      s.activitiesById[p.activityId].kind = "sr-disciple-expedition";
      const stock = s.stockpilesById["stockpile:yunxiu"],
        goal = stock.position || j.home;
      const deliveryPoint={x:goal.x??j.home.x,y:goal.y??j.home.y},availablePoint=partyStop(s,p,j,deliveryPoint,1.5,'delivery');
      j.deliveryGoal=availablePoint||deliveryPoint;
      if(!availablePoint){j.deliveryBlocked=true;return;}
      const path = homePath(s, p, j.deliveryGoal);
      if (path)
        Object.assign(p.mind.scenic, {
          path,
          goal: j.deliveryGoal,
          revision: geometryRevision(s),
        });
      else j.deliveryBlocked = true;
    } else {
      j.phase = "exploring";
      j.progress = 0;
      j.valleyTrail = [{ x: p.location.x, y: p.location.y }];
      if (j.purpose === "explore") {
        j.valleyPath = [];
        j.scoutPath = planPartyScout(s,p,j);
        j.phase = j.scoutPath ? "scouting" : "valley-return";
        if (!j.scoutPath) j.scoutReason = "探索道路不通，沿实际来路返回";
      } else {
        const plan = avatarObservationPlanSR(s, VALLEY, p.location, PATCH);
        j.valleyPath = plan.path;
      }
      s.activitiesById[p.activityId].kind = "sr-disciple-expedition";
    }
    return;
  }
  if (j.phase === "delivery") {
    if (advanceExpeditionMedicine(s, p, j)) return;
    if(j.party&&j.deliveryBlocked){
      const center=s.stockpilesById['stockpile:yunxiu'].position,goal=partyStop(s,p,j,center,1.5,'delivery'),path=goal&&homePath(s,p,goal);
      if(!goal||!path){p.mind.reason='公库交接站位暂不可达，仍携带本人物资，等待实际空位。';return;}
      j.deliveryGoal=goal;j.deliveryBlocked=false;Object.assign(p.mind.scenic,{path,goal,revision:geometryRevision(s)});
    }
    if (j.deliveryBlocked) return;
    advanceScenic(p.mind.scenic, 3.6, s);
    p.location = {
      kind: "local",
      sceneId: HOME,
      x: p.mind.scenic.x,
      y: p.mind.scenic.y,
    };
    p.position = {
      kind: "scene",
      sceneId: HOME,
      x: p.location.x,
      y: p.location.y,
    };
    if (
      !p.mind.scenic.path.length &&
      Math.hypot(
        p.location.x - j.deliveryGoal.x,
        p.location.y - j.deliveryGoal.y,
      ) < 2
    )
      finish(s, p, j);
    return;
  }
  if (j.phase === "valley-return") {
    if (advanceExpeditionMedicine(s, p, j)) return;
    if(waitDuringExpedition(s,p,j,snapshot))return;
    const l = p.location,
      target = j.valleyTrail?.at(-1) || valleyArrival(j),
      dx = target.x - l.x,
      dy = target.y - l.y,
      dist = Math.hypot(dx, dy);
    if (dist > 0.01) {
      const n = Math.min(0.12, dist);
      l.x += (dx * n) / dist;
      l.y += (dy * n) / dist;
      p.position = { kind: "scene", sceneId: VALLEY, x: l.x, y: l.y };
      return;
    }
    if (j.valleyTrail?.length) {
      j.valleyTrail.pop();
      return;
    }
    const peer=expeditionPeer(s,j);j.returnExitArrived=true;
    if(peer&&!j.partySeparated&&!['cancelled','dead','returned'].includes(peer.phase)){
      const other=s.personsById[peer.personId],together=peer.phase==='valley-return'&&peer.returnExitArrived&&other.location?.kind==='local'&&other.location.sceneId===VALLEY&&Math.hypot(other.location.x-p.location.x,other.location.y-p.location.y)<=6;
      if(!together&&waitForExpeditionPeer(s,p,j,'在山口等候同伴沿自己的来路返回。',{kind:'exit-home'}))return;
      if(together)travel(s,other,peer,true);
    }
    travel(s, p, j, true);
    return;
  }
  if (j.phase === "exploring") {
    if (encounterStep) {
      const outcome = encounterStep(s, p, j);
      if (p.lifeStatus === "dead") {
        j.phase = "dead";
        j.completedTick = s.worldTick;
        finishExpeditionMedicine(s, p, j);delete j.partyWait;
        return;
      }
      if (outcome?.retreat || outcome?.status === "retreat") {
        j.retreated = true;
        j.phase = "valley-return";
        return;
      }
      if (outcome?.busy) return;
    }
    if(waitDuringExpedition(s,p,j,snapshot)||j.phase!=="exploring")return;
    const l = p.location;
    if (j.valleyPath.length) {
      const target = j.valleyPath[0],
        dist = Math.hypot(target.x - l.x, target.y - l.y),
        n = Math.min(0.12, dist);
      if (dist > 0) {
        l.x += ((target.x - l.x) * n) / dist;
        l.y += ((target.y - l.y) * n) / dist;
      }
      j.valleyTrail.push({ x: l.x, y: l.y });
      if (dist <= 0.12) j.valleyPath.shift();
      p.position = { kind: "scene", sceneId: VALLEY, x: l.x, y: l.y };
      return;
    }
    if (++j.progress < T.gather) return;
    const patches = (s.srWorld.resourcePatches ??= {}),
      left = patches[PATCH] ?? 18,
      take = Math.min(T.herbs, left);
    patches[PATCH] = subtractAmounts(left, take);
    j.cargo.herb = take;
    recordFactSR(s, `fact:disciple:${j.id}:gather`, {
      kind: "resource-transfer",
      personId: p.personId,
      objectId: PATCH,
      amount: take,
      text: "从同一有限药丛实际采入个人携带",
    });
    if (j.purpose === "supply") j.phase = "valley-return";
    else {
      j.scoutPath = planPartyScout(s,p,j);
      j.phase = j.scoutPath ? "scouting" : "valley-return";
      if (!j.scoutPath) j.scoutReason = "侦察道路不通，沿实际来路返回";
    }
  }
  if (j.phase === "scouting") {
    if (encounterStep) {
      const o = encounterStep(s, p, j);
      if (p.lifeStatus === "dead") {
        j.phase = "dead";
        j.completedTick = s.worldTick;
        finishExpeditionMedicine(s, p, j);delete j.partyWait;
        return;
      }
      if (o?.retreat || o?.status === "retreat") {
        j.retreated = true;
        j.phase = "valley-return";
        return;
      }
      if (o?.busy) return;
    }
    if(waitDuringExpedition(s,p,j,snapshot)||j.phase!=="scouting")return;
    const l = p.location,
      target = j.scoutPath[0];
    if (!target) {
      if (j.purpose === "explore") {
        if (Math.hypot(l.x - (j.scoutGoal?.x??SCOUT_POINT.x), l.y - (j.scoutGoal?.y??SCOUT_POINT.y)) > .01) {
          j.scoutReason = "尚未实际到达探索位置，沿来路返回";
          j.phase = "valley-return";
          return;
        }
        if (++j.progress < T.gather) return;
        recordFactSR(s, `fact:disciple:${j.id}:exploration`, {
          kind: "disciple-exploration", personId: p.personId, journeyId: j.id,
          sceneId: VALLEY, position: {x:j.scoutGoal?.x??SCOUT_POINT.x,y:j.scoutGoal?.y??SCOUT_POINT.y}, observationTicks: T.gather,
          observationStartedTick: s.worldTick - T.gather + 1,
          text: "本人沿已知路线实际到达侦察位置，完成观察与修行见闻",
        });
      }
      j.phase = "valley-return";
      return;
    }
    const d = Math.hypot(target.x - l.x, target.y - l.y),
      n = Math.min(0.12, d);
    if (d > 0) {
      l.x += ((target.x - l.x) * n) / d;
      l.y += ((target.y - l.y) * n) / d;
    }
    j.valleyTrail.push({ x: l.x, y: l.y });
    p.position = { kind: "scene", sceneId: VALLEY, x: l.x, y: l.y };
    if (d <= 0.12) j.scoutPath.shift();
  }
}
export function advanceDiscipleExpeditions(s) {
  const r = s.discipleExpeditions;
  if (!r || r.lastTick >= s.worldTick) return;
  r.lastTick = s.worldTick;
  const current=r.journeys.filter(j=>!["returned","cancelled","dead"].includes(j.phase));
  if(!current.length)step(s,r);
  else{const snapshot=expeditionPartySnapshot(s);for(const j of current)step(s,r,null,j.id,snapshot);relayExpeditionWarnings(s,snapshot);}
}
function validatePurpose(s, j, fail) {
  if (j.purpose === undefined) {
    if (j.purposeDecision !== undefined || s.factsById[`fact:disciple:${j.id}:exploration`]) fail("目的决策缺少行程目的");
    return;
  }
  const exact = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
  const d = j.purposeDecision, i = d?.inputs;
  const range = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
  if (!Object.hasOwn(PURPOSE_LABELS, j.purpose) || !exact(d, ["version", "inputs", "scores", "riskSourceJourneyId", "reason"]) || d.version !== 1 ||
      !exact(i, ["herbTarget", "homeHerb", "homeResidents", "kindness", "plant", "ambition", "curiosity", "goal", "knownRisk"]) ||
      !Number.isSafeInteger(i.homeResidents) || i.homeResidents < 2 || i.herbTarget !== Math.max(45, i.homeResidents * 8) || !range(i.homeHerb, 0, Number.MAX_SAFE_INTEGER) ||
      ![i.kindness, i.plant, i.ambition, i.curiosity].every(v => range(v, 0, 100)) || typeof i.goal !== "string" || ![null, "high", "avoidable"].includes(i.knownRisk) ||
      !exact(d.scores, ["supply", "explore"])) fail("历练目的与决策快照");
  const scores = purposeScores(i), expected = scores.supply >= scores.explore ? "supply" : "explore";
  if (d.scores.supply !== scores.supply || d.scores.explore !== scores.explore || j.purpose !== expected || d.reason !== purposeReason(j.purpose, i)) fail("历练目的评分");
  const prior = knownRiskJourney(s, j.personId, j.startedTick);
  if (d.riskSourceJourneyId !== (prior?.id || null) || i.knownRisk !== (prior?.encounter.risk || null)) fail("本人风险观察来源");
  if(j.scoutGoal!==undefined&&(!j.party||j.scoutGoal?.version!==1||!Number.isFinite(j.scoutGoal.x)||!Number.isFinite(j.scoutGoal.y)||Math.hypot(j.scoutGoal.x-SCOUT_POINT.x,j.scoutGoal.y-SCOUT_POINT.y)>3))fail("结伴实际观察脚点");
  const gather = s.factsById[`fact:disciple:${j.id}:gather`], exploration = s.factsById[`fact:disciple:${j.id}:exploration`];
  if (j.purpose === "supply" && exploration || j.purpose === "explore" && (gather || j.cargo.herb !== 0)) fail("历练目的与实际所得");
  if (gather && (gather.personId !== j.personId || gather.objectId !== PATCH || !range(gather.amount, 0, T.herbs) || !Number.isSafeInteger(gather.atTick) || gather.atTick < j.startedTick || gather.atTick > s.worldTick)) fail("采药事实来源");
  if (exploration && (exploration.kind !== "disciple-exploration" || exploration.personId !== j.personId || exploration.journeyId !== j.id || exploration.sceneId !== VALLEY ||
      exploration.position?.x !== (j.scoutGoal?.x??SCOUT_POINT.x) || exploration.position?.y !== (j.scoutGoal?.y??SCOUT_POINT.y) || exploration.observationTicks !== T.gather || exploration.observationStartedTick !== exploration.atTick - T.gather + 1 || exploration.observationStartedTick < j.startedTick || !Number.isSafeInteger(exploration.atTick) || exploration.atTick < j.startedTick || exploration.atTick > s.worldTick ||
      j.progress !== T.gather || j.retreated || !["valley-return", "returning", "delivery", "returned", "dead"].includes(j.phase))) fail("实际探索完成事实");
  if (j.purpose === "explore" && j.phase === "exploring" || j.purpose === "supply" && j.phase === "scouting") fail("历练目的与现场阶段");
  if (j.growth && !(j.purpose === "supply" ? gather?.amount > 0 : !!exploration) && j.growth.experience !== 0) fail("未完成历练不能结算成长");
}
export function validateDiscipleExpeditions(s) {
  const r = s.discipleExpeditions;
  if (!r) return true;
  const fail = (reason) => {
      throw Error("门人历练记录异常：" + reason);
    },
    integer = (n) => Number.isSafeInteger(n) && n >= 0;
  if (
    r.version !== 1 ||
    typeof r.enabled !== "boolean" ||
    r.allowCompanions!==undefined&&typeof r.allowCompanions!=="boolean" ||
    !integer(r.lastTick) ||
    r.lastTick > s.worldTick ||
    !integer(r.nextId) ||
    !integer(r.nextOpportunityTick) ||
    !Array.isArray(r.journeys)
  )
    fail("政策与时钟");
  const phases = [
      "preparing",
      "approach",
      "outbound",
      "exploring",
      "scouting",
      "valley-return",
      "returning",
      "delivery",
      "returned",
      "cancelled",
      "dead",
    ],
    terminal = ["returned", "cancelled", "dead"];
  const simultaneous=r.journeys.filter(j=>!terminal.includes(j.phase));
  if(simultaneous.length>2||simultaneous.length===2&&(!simultaneous[0].party||simultaneous[0].party.peerJourneyId!==simultaneous[1].id))fail("同时出行人数");
  validateExpeditionCooperation(s,fail);
  const ids = new Set();
  for (const j of r.journeys) {
    const p = s.personsById[j.personId];
    if (
      !p ||
      ids.has(j.id) ||
      !phases.includes(j.phase) ||
      !integer(j.startedTick) ||
      j.startedTick > s.worldTick ||
      !integer(j.progress) ||
      !Number.isFinite(j.cargo?.herb) ||
      j.cargo.herb < 0 ||
      j.cargo.herb > T.herbs
    )
      fail("身份、阶段与携带");
    if(["exitArrived","returnExitArrived"].some(k=>j[k]!==undefined&&typeof j[k]!=="boolean"))fail("本人实际到口记录");
    validatePurpose(s, j, fail);
    validateExpeditionMedicine(s, j, fail);
    const sequence = /^outing:([1-9]\d*)$/.exec(j.id);
    if (
      !sequence ||
      !Number.isSafeInteger(Number(sequence[1])) ||
      Number(sequence[1]) >= r.nextId
    )
      fail("行程编号");
    const point = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y),
      path = (p) => Array.isArray(p) && p.every(point),
      tick = (t) => integer(t) && t <= s.worldTick;
    if (!point(j.home) || !point(j.exit) || !path(j.path)) fail("院内行程路径");
    for (const key of ["valleyPath", "valleyTrail", "scoutPath"])
      if (j[key] !== undefined && !path(j[key])) fail("现场路径");
    if (
      ["exploring", "scouting", "valley-return"].includes(j.phase) &&
      (!path(j.valleyPath) || !path(j.valleyTrail))
    )
      fail("现场行程字段");
    if (
      (j.phase === "scouting" && !path(j.scoutPath)) ||
      (j.phase === "delivery" && !point(j.deliveryGoal))
    )
      fail("阶段目标");
    if (j.supplyGoal !== undefined && !point(j.supplyGoal)) fail("取粮目标");
    if (
      j.completedTick !== undefined &&
      (!tick(j.completedTick) || j.completedTick < j.startedTick)
    )
      fail("结束时钟");
    if (j.encounter) {
      const e = j.encounter;
      if (
        !s.personsById[e.personId] ||
        !tick(e.observedTick) ||
        !tick(e.lastObservedTick) ||
        e.lastObservedTick < e.observedTick ||
        (e.lastContactTick !== undefined &&
          (!tick(e.lastContactTick) || e.lastContactTick < e.observedTick)) ||
        !Number.isFinite(e.injury) ||
        e.injury < 0 ||
        !["high", "avoidable"].includes(e.risk) ||
        e.lastPosition?.sceneId !== VALLEY ||
        !point(e.lastPosition) ||
        typeof e.reason !== "string"
      )
        fail("实际遭遇");
    }
    if (
      j.growth &&
      (!Number.isFinite(j.growth.experience) ||
        j.growth.experience < 0 ||
        j.growth.experience > T.xp ||
        !Number.isFinite(j.growth.wound) ||
        j.growth.wound < 0 ||
        j.growth.wound > 100)
    )
      fail("归院成长");
    if (j.phase === "returned") {
      const gathered = s.factsById[`fact:disciple:${j.id}:gather`]?.amount || 0,
        delivery = s.factsById[`fact:disciple:${j.id}:delivery`];
      if (
        !Number.isFinite(gathered) ||
        gathered < 0 ||
        gathered > T.herbs ||
        j.delivered?.herb !== gathered ||
        delivery?.cargo?.herb !== gathered ||
        delivery?.personId !== j.personId ||
        delivery?.targetStockpileId !== "stockpile:yunxiu"
      )
        fail("采寻交付守恒");
    }
    ids.add(j.id);
    if (!terminal.includes(j.phase)) {
      const body = s.activitiesById[p.activityId];
      if (
        !body ||
        body.personId !== j.personId ||
        !["sr-disciple-expedition", "sr-travel"].includes(body.kind)
      )
        fail("身体占用");
      if (["outbound", "returning"].includes(j.phase)) {
        const t = s.travelsById[j.travelId];
        if (
          !t ||
          !t.participantIds.includes(j.personId) ||
          !integer(t.progressTicks) ||
          !integer(t.durationTicks) ||
          t.durationTicks < 1 ||
          t.progressTicks > t.durationTicks ||
          p.position?.kind !== "worldTravel" ||
          p.position.travelId !== t.id ||
          (p.location && p.location.travelId !== t.id) ||
          body.kind !== "sr-travel"
        )
          fail("实际在途");
      }
    }
    if (
      !["preparing", "cancelled", "dead"].includes(j.phase) &&
      (!j.cost ||
        j.cost.food !== T.food ||
        j.cost.energy !== T.energy ||
        !s.factsById[`fact:disciple:${j.id}:supply`])
    )
      fail("供给实付");
    if (
      j.phase === "returned" &&
      (!integer(j.completedTick) ||
        j.cargo.herb !== 0 ||
        !j.delivered ||
        !s.factsById[`fact:disciple:${j.id}:delivery`])
    )
      fail("唯一归院交付");
  }
  for (const f of Object.values(s.factsById)) if (f.kind === "disciple-expedition-medicine-use" || ["expedition-medicine-pickup", "expedition-medicine-return"].includes(f.operation)) {
    const j = r.journeys.find(x => x.id === f.journeyId);
    if (!j?.medicine || ![j.medicine.pickupFactId, j.medicine.returnFactId, j.medicine.use?.factId].includes(f.id)) fail("携药事实缺少对应行程");
  }
  for (const f of Object.values(s.factsById)) if (f.kind === "disciple-exploration") {
    const j = r.journeys.find(x => x.id === f.journeyId);
    if (!j || j.purpose !== "explore" || f.id !== `fact:disciple:${j.id}:exploration`) fail("探索事实缺少对应目的行程");
  }
  return true;
}
function publicDuty(s, p) {
  const building = s.buildings.find(
    (b) =>
      b.id === p.job ||
      (!p.schedule?.workTiming?.finishedAtTick &&
        p.schedule?.commitUntilTick > s.worldTick &&
        b.instanceId === p.schedule?.workTiming?.targetId),
  );
  if (building) return (BUILDINGS[building.type]?.name || "宗门设施") + "差事";
  return (
    { steward: "总管", teacher: "传功", healer: "医者", host: "峰主" }[
      p.mind?.office
    ] || "日常起居"
  );
}
export function discipleExpeditionsView(s) {
  const r = s.discipleExpeditions,
    j = r && active(r);
  return {
    enabled: !!r?.enabled,
    allowCompanions: !!r?.allowCompanions,
    availability: {
      available: !!s.srWorld,
      reason: s.srWorld ? "门人按意愿与准备自行权衡" : "山外道路尚未开放",
    },
    summary: j
      ? "已有门人自愿安排山谷历练"
      : r?.enabled
        ? "门人正在权衡责任与外出准备"
        : "尚未开放门人自主历练",
    nextOpportunityLabel: "下次机会按归期与留守供给安排",
    members: s.disciples.map((p) => ({
      personId: p.personId,
      name: p.name,
      goal: p.mind?.goal || p.goal || "修行与生活",
      duty: publicDuty(s, p),
      activity: p.mind?.away
        ? "已留外出安排"
        : {
            study: "研读功法",
            cultivate: "静心修炼",
            work: "照料宗门差事",
            rest: "休息调养",
            travel: "准备外出",
            heal: "养伤",
            social: "同门交谈",
            teach: "传授功法",
          }[p.mind?.activity] || "日常起居",
      reason: p.mind?.away ? "等待本人归来讲述" : refusal(s, p),
    })),
    journeys: (r?.journeys || []).slice(-8).map((x) => ({
      id: x.id,
      personId: x.personId,
      companionName: x.party?s.personsById[expeditionPeer(s,x)?.personId]?.name:null,
      partyLabel: x.party?"双方自愿结伴，遇险在近处相互提醒":"独自历练",
      name: s.personsById[x.personId]?.name,
      routeLabel: "云岫山谷往返",
      purposeLabel: PURPOSE_LABELS[x.purpose] || "山谷采寻与见闻",
      decisionReason: x.purposeDecision?.reason || "按原有山谷采寻安排出行。",
      phaseLabel: ["returned", "cancelled", "dead"].includes(x.phase)
        ? { returned: "归院", cancelled: "取消", dead: "失去音讯" }[x.phase]
        : x.phase === "preparing"
          ? "准备出行"
          : "按约外出",
      knownStatus: x.phase === "returned" ? "本人已归院" : "已留归期，等待消息",
      preparation: ["保留留守门人", "携带往返口粮", ...(x.medicine ? [x.medicine.reason] : [])],
      report: x.phase === "returned" ? x.report : null,
    })),
  };
}
