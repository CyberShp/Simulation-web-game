/** Read-only catalogue of actual runtime definitions, never a parallel rules table. */
import {BUILDINGS,TECHNIQUES,RECIPES,GOODS,DAY_LENGTH,xpNeed} from './ea-data.mjs?v=ea-160-courtyard-20261008-r25';
import {COMBAT_ACTIONS,ENEMY_COMBAT_CONFIG} from './ea-sr-combat.mjs?v=ea-160-courtyard-20261008-r25';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_THEME} from './ea-sr-equipment.mjs?v=ea-160-courtyard-20261008-r25';
import {BREAKTHROUGH_PHASES,REALM_EXTENSIONS} from './ea-sr-cultivation.mjs?v=ea-160-courtyard-20261008-r25';
import {ECONOMY_DEFINITION,ORDER_DEFINITIONS,WHOLESALE_DEFINITION} from './ea-sr-economy.mjs?v=ea-160-courtyard-20261008-r25';
import {CLIMATE} from './ea-sr-weather.mjs?v=ea-160-courtyard-20261008-r25';
import {AUTONOMY} from './ea-sr-persons.mjs?v=ea-160-courtyard-20261008-r25';
import {ORGANIZATION_DEFINITION} from './ea-sr-organization.mjs?v=ea-160-courtyard-20261008-r25';
import {MOTHER_CHAIN_DEFINITION} from './ea-sr-mother-chain.mjs?v=ea-160-courtyard-20261008-r25';
import {WORLD_ROUTES} from './ea-sr-world.mjs?v=ea-160-courtyard-20261008-r25';
import {COVENANT_MODES,COVENANT_TEMPLATES} from './ea-sr-covenants.mjs?v=ea-160-courtyard-20261008-r25';
const entries=[
 ['clock','dist/ea-data.mjs?v=ea-160-courtyard-20261008-r25','second; tick=0.1 second','保持旧档120秒日长与原事件相位',{daySeconds:DAY_LENGTH}],
 ['buildings','dist/ea-data.mjs?v=ea-160-courtyard-20261008-r25','resource units; legacy work duration seconds','每种设施真实槽位与批次由同一建筑定义结算',BUILDINGS],
 ['arts','dist/ea-data.mjs?v=ea-160-courtyard-20261008-r25','understanding/mastery 0–100; resource units','研习理解与有效实践熟练分别记录',TECHNIQUES],
 ['pills','dist/ea-data.mjs?v=ea-160-courtyard-20261008-r25','resource units; seconds','用药与炼丹投入保持消耗事实',RECIPES],
 ['market','dist/ea-data.mjs?v=ea-160-courtyard-20261008-r25','10 goods per batch; jade','有限本金与低卖高买阻止无成本套利',GOODS],
 ['combat','dist/ea-sr-combat.mjs?v=ea-160-courtyard-20261008-r25','metres; ticks; qi','起手执行收势与可躲避窗口',COMBAT_ACTIONS],
 ['enemies','dist/ea-sr-combat.mjs?v=ea-160-courtyard-20261008-r25','metres; ticks; damage','责任人各有实际动作与危险预算',ENEMY_COMBAT_CONFIG],
 ['equipment','dist/ea-sr-equipment.mjs?v=ea-160-courtyard-20261008-r25','item condition 0–1; resources; ticks','实物归属、装备和实际修复投入',EQUIPMENT_DEFINITIONS],
 ['theme','dist/ea-sr-equipment.mjs?v=ea-160-courtyard-20261008-r25','metres; reduction fraction; ticks','总减伤封顶35%，不能独立乘区突破上限',EQUIPMENT_THEME],
 ['breakthrough','dist/ea-sr-cultivation.mjs?v=ea-160-courtyard-20261008-r25','ticks','预留可退，炼化后保留已发生消耗',BREAKTHROUGH_PHASES],
 ['realms','dist/ea-sr-cultivation.mjs?v=ea-160-courtyard-20261008-r25','unique person realm index','高阶按已交付能力开放',REALM_EXTENSIONS],
 ['production','dist/ea-sr-economy.mjs?v=ea-160-courtyard-20261008-r25','resource units; ticks','有限来源、容量预检和真实运输',ECONOMY_DEFINITION],
 ['wholesale','dist/ea-sr-economy.mjs?v=ea-160-courtyard-20261008-r25','ticks; resource units; jade','有限外部客户对实际交付货物付款，不无货补本金',WHOLESALE_DEFINITION],
 ['orders','dist/ea-sr-economy.mjs?v=ea-160-courtyard-20261008-r25','resource units','实际到场交付、唯一兑付事实',ORDER_DEFINITIONS],
 ['climate','dist/ea-sr-weather.mjs?v=ea-160-courtyard-20261008-r25','ticks; wetness 0–1; condition percent','确定天气与生态影响共用同一时钟',CLIMATE],
 ['autonomy','dist/ea-sr-persons.mjs?v=ea-160-courtyard-20261008-r25','ticks; day phase fraction','承诺期、拒绝理由与日程保持自主',AUTONOMY],
 ['organization','dist/ea-sr-organization.mjs?v=ea-160-courtyard-20261008-r25','ticks; resource units','任职报酬与悬赏托管保持公私守恒',ORGANIZATION_DEFINITION],
 ['mother','dist/ea-sr-mother-chain.mjs?v=ea-160-courtyard-20261008-r25','ticks; xp; wound percent; metres','抽取总量、吸收耗散与救援窗口显式封顶',MOTHER_CHAIN_DEFINITION],
 ['routes','dist/ea-sr-world.mjs?v=ea-160-courtyard-20261008-r25','ticks; jade','出行付费、有实际时间与断路恢复',WORLD_ROUTES],
 ['covenants','dist/ea-sr-covenants.mjs?v=ea-160-courtyard-20261008-r25','ticks; wound percent; resource units','口头、合约、誓言的明确后果预算',{modes:COVENANT_MODES,templates:COVENANT_TEMPLATES}]
];
export function viewBalance(s){return {version:'balance:sr:v1',tunable:true,source:'U-63/U-93/R-25; author implementation defaults',measurementStatus:'automated scenarios; physical-device and first-use measurements pending',parameters:entries.map(([id,definitionFile,units,reason,value])=>({id,definitionFile,units,reason,value:structuredClone(value)})),scenario:{people:s.homeMemberIds?.length+1,realm:s.master.realm,requiredXp:xpNeed(s.master.realm),worldTick:s.worldTick,dayPhase:(s.worldTick%s.ticksPerDay)/s.ticksPerDay,food:s.resources.food},targets:{firstUseMinutes:[15,30],peopleScenarios:[[3,5],[24,32]],maximumIdleWait:'measure actual public-command runs; not yet certified'},rule:'日長與既有事件不在這輪自動重標；調參必須保留已發生事實與在途進度。'};}
