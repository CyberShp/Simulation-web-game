/** U-166 / R-54: approved plan identities; diagram coordinates are not metres. */
const freeze = value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
export const GOLDEN_CORE_PLAN_VERSION='golden-core-sites-1';
export const plannedSites=freeze([
  {
    "id": "site:domain:original-hall",
    "planId": "GC-01",
    "number": 1,
    "name": "主殿",
    "region": "主峰",
    "zoneId": "Z-01",
    "type": "hall",
    "suggestedPhase": "起步",
    "diagramPosition": [
      950,
      430
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "existing",
    "status": "existing",
    "description": "原院已有的宗门主殿，提供休息、研习与修行场所，并沿用现有床位和工位。"
  },
  {
    "id": "site:domain:gc-02",
    "planId": "GC-02",
    "number": 2,
    "name": "藏经阁·讲习院",
    "region": "主峰",
    "zoneId": "Z-01",
    "type": "library",
    "suggestedPhase": "发展",
    "diagramPosition": [
      1120,
      285
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "北台固定藏经阁，提供真实阅卷席、讲法席与整理典籍工位；分期接续藏书和专业分室用途。"
  },
  {
    "id": "site:domain:gc-03",
    "planId": "GC-03",
    "number": 3,
    "name": "聚灵台",
    "region": "主峰",
    "zoneId": "Z-01",
    "type": "meditation",
    "suggestedPhase": "发展",
    "diagramPosition": [
      885,
      205
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "规划用途：依灵脉供能设置有限修行位，供门人到场吐纳修炼，并随供能条件逐步升级。"
  },
  {
    "id": "site:domain:gc-04",
    "planId": "GC-04",
    "number": 4,
    "name": "闭关静修院",
    "region": "主峰",
    "zoneId": "Z-01",
    "type": null,
    "suggestedPhase": "凝丹准备",
    "diagramPosition": [
      1080,
      110
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：分房建设静室、筑基与凝丹练位、护持位和恢复间，并以救护通路连接医庐。"
  },
  {
    "id": "site:domain:gc-05",
    "planId": "GC-05",
    "number": 5,
    "name": "演武场",
    "region": "主峰",
    "zoneId": "Z-01",
    "type": null,
    "suggestedPhase": "发展",
    "diagramPosition": [
      1170,
      430
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：练习兵器、徒手、施法、御物与多人阵位，按时段使用靶场和御物起落位。"
  },
  {
    "id": "site:domain:gc-06",
    "planId": "GC-06",
    "number": 6,
    "name": "护山阵枢",
    "region": "主峰",
    "zoneId": "Z-01",
    "type": null,
    "suggestedPhase": "专项",
    "diagramPosition": [
      735,
      300
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：校验护山阵图、管理阵法供能与停阵检修，并连接分布在各区的阵基。"
  },
  {
    "id": "site:domain:gc-07",
    "planId": "GC-07",
    "number": 7,
    "name": "山门",
    "region": "主峰",
    "zoneId": "Z-01",
    "type": null,
    "suggestedPhase": "起步",
    "diagramPosition": [
      950,
      875
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：办理入山、求见与检查接待，门外设等候位置，随建设修缮阶路和门体。"
  },
  {
    "id": "site:domain:gc-08",
    "planId": "GC-08",
    "number": 8,
    "name": "护山亭",
    "region": "主峰",
    "zoneId": "Z-01",
    "type": "watchtower",
    "suggestedPhase": "发展",
    "diagramPosition": [
      1120,
      790
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：供巡护人员瞭望来路、传递预警和风雨值守，依侧台视野照看山门周边。"
  },
  {
    "id": "site:domain:east-residence-1",
    "planId": "GC-09",
    "number": 9,
    "name": "门人居一",
    "region": "东台",
    "zoneId": "Z-02",
    "type": "house",
    "suggestedPhase": "起步",
    "diagramPosition": [
      1370,
      545
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "在东台营造门人居，完工后提供四张真实床位；门人须沿通路到场休息。"
  },
  {
    "id": "site:domain:gc-10",
    "planId": "GC-10",
    "number": 10,
    "name": "门人居二",
    "region": "东台",
    "zoneId": "Z-02",
    "type": "house",
    "suggestedPhase": "发展",
    "diagramPosition": [
      1580,
      545
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "按新增门人的安置需要建设第二处居所，一级提供四张床位，与东台通路相连。"
  },
  {
    "id": "site:domain:gc-11",
    "planId": "GC-11",
    "number": 11,
    "name": "门人居三",
    "region": "东台",
    "zoneId": "Z-02",
    "type": "house",
    "suggestedPhase": "发展",
    "diagramPosition": [
      1370,
      410
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "按新增门人的安置需要建设第三处居所，一级提供四张床位，与东台通路相连。"
  },
  {
    "id": "site:domain:gc-12",
    "planId": "GC-12",
    "number": 12,
    "name": "门人居四",
    "region": "东台",
    "zoneId": "Z-02",
    "type": "house",
    "suggestedPhase": "发展",
    "diagramPosition": [
      1580,
      410
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "按新增门人的安置需要建设第四处居所，一级提供四张床位，与东台通路相连。"
  },
  {
    "id": "site:domain:gc-13",
    "planId": "GC-13",
    "number": 13,
    "name": "膳房",
    "region": "东台",
    "zoneId": "Z-02",
    "type": "kitchen",
    "suggestedPhase": "发展",
    "diagramPosition": [
      1450,
      710
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "规划用途：存放食材、炊煮饭食与供应灵膳，分设专灶和用膳处，并消耗燃料与净水。"
  },
  {
    "id": "site:domain:gc-14",
    "planId": "GC-14",
    "number": 14,
    "name": "医庐",
    "region": "东台",
    "zoneId": "Z-02",
    "type": "clinic",
    "suggestedPhase": "发展",
    "diagramPosition": [
      1440,
      255
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "规划用途：开展诊疗、药浴和疗伤调养，设置恢复床位并分存药物，供伤病门人到场接受照护。"
  },
  {
    "id": "site:domain:gc-15",
    "planId": "GC-15",
    "number": 15,
    "name": "客院",
    "region": "东台",
    "zoneId": "Z-02",
    "type": null,
    "suggestedPhase": "专项",
    "diagramPosition": [
      1620,
      805
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：安置短住来客和外来教习，初期设置两张客床，按实际接待需要建设。"
  },
  {
    "id": "site:domain:west-lumber-1",
    "planId": "GC-16",
    "number": 16,
    "name": "采伐场",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": "lumber",
    "suggestedPhase": "起步",
    "diagramPosition": [
      550,
      470
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "在西林设两处露天采伐工位，木材先存于场内，再经西桥搬回公库，供营造取用。"
  },
  {
    "id": "site:domain:gc-17",
    "planId": "GC-17",
    "number": 17,
    "name": "采石场",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": "quarry",
    "suggestedPhase": "起步",
    "diagramPosition": [
      230,
      280
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "规划用途：开采裸岩、检验石料并进行粗加工，设置堆料和装运位置，供营造使用。"
  },
  {
    "id": "site:domain:gc-18",
    "planId": "GC-18",
    "number": 18,
    "name": "灵稻田一",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": "granary",
    "suggestedPhase": "起步",
    "diagramPosition": [
      420,
      775
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "规划用途：在谷地梯田种植灵稻，完成留种、照料、收割与送库，为宗门持续供应口粮。"
  },
  {
    "id": "site:domain:gc-19",
    "planId": "GC-19",
    "number": 19,
    "name": "灵稻田二",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": "granary",
    "suggestedPhase": "发展",
    "diagramPosition": [
      215,
      845
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "规划用途：在口粮需求增加时扩建第二片灵稻田，沿灌溉与运输通路完成种植、收割和送库。"
  },
  {
    "id": "site:domain:original-farm",
    "planId": "GC-20",
    "number": 20,
    "name": "原院药圃",
    "region": "主峰",
    "zoneId": "Z-01",
    "type": "farm",
    "suggestedPhase": "起步",
    "diagramPosition": [
      785,
      600
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "existing",
    "status": "existing",
    "description": "原院现有药材种植地，门人按种植、照料与收获流程劳作，产物再搬运入库。"
  },
  {
    "id": "site:domain:gc-21",
    "planId": "GC-21",
    "number": 21,
    "name": "西谷药圃",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": "farm",
    "suggestedPhase": "发展",
    "diagramPosition": [
      390,
      560
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：种植和照料药材，设置清洁水渠与晒药场，收获后持续向宗门药物生产供料。"
  },
  {
    "id": "site:domain:gc-22",
    "planId": "GC-22",
    "number": 22,
    "name": "育苗药圃",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": "farm",
    "suggestedPhase": "专项",
    "diagramPosition": [
      240,
      455
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：培育药苗、保留母株与种子，分设苗棚、留种和病株隔离区域，供应后续种植。"
  },
  {
    "id": "site:domain:gc-23",
    "planId": "GC-23",
    "number": 23,
    "name": "灵泉",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": "well",
    "suggestedPhase": "发展",
    "diagramPosition": [
      520,
      160
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：利用天然泉水供生活取水，分期设置净水槽、滤材维护和人工灵脉接引设施。"
  },
  {
    "id": "site:domain:gc-24",
    "planId": "GC-24",
    "number": 24,
    "name": "公库与储运院",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": "warehouse",
    "suggestedPhase": "起步",
    "diagramPosition": [
      650,
      695
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "规划用途：分区收存木石、口粮、干药、种子和冷湿物，设置装卸与转运位置，组织货物搬运。"
  },
  {
    "id": "site:domain:gc-25",
    "planId": "GC-25",
    "number": 25,
    "name": "百工坊",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": "workshop",
    "suggestedPhase": "发展",
    "diagramPosition": [
      410,
      660
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "规划用途：制作和维修木器、工具、衣物与绳索，并安排纸胎压制晾晒及琴鼓修理工位。"
  },
  {
    "id": "site:domain:gc-26",
    "planId": "GC-26",
    "number": 26,
    "name": "丹房",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": "alchemy",
    "suggestedPhase": "发展",
    "diagramPosition": [
      430,
      330
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "open",
    "status": "open",
    "description": "规划用途：分设药案、浸取过滤、丹炉和封藏位置，依所学丹方处理药材、掌握火候并炼丹。"
  },
  {
    "id": "site:domain:gc-27",
    "planId": "GC-27",
    "number": 27,
    "name": "炼器窑院",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": null,
    "suggestedPhase": "专项",
    "diagramPosition": [
      140,
      650
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：锻造淬炼器物、制作器模和检验材料，另设陶窑烧制药罐、阵瓷与陶符。"
  },
  {
    "id": "site:domain:gc-28",
    "planId": "GC-28",
    "number": 28,
    "name": "符阵工坊",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": null,
    "suggestedPhase": "专项",
    "diagramPosition": [
      655,
      370
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：制墨、画符与晾符，并刻制阵器、检查阵线，符房和阵器室分别安排工位。"
  },
  {
    "id": "site:domain:gc-29",
    "planId": "GC-29",
    "number": 29,
    "name": "傀儡工坊",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": null,
    "suggestedPhase": "专项",
    "diagramPosition": [
      180,
      560
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：制作和维修傀儡，校验操控讯号、低速试控并检验负载，分设装配与测试位置。"
  },
  {
    "id": "site:domain:gc-30",
    "planId": "GC-30",
    "number": 30,
    "name": "灵兽苑",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": null,
    "suggestedPhase": "专项",
    "diagramPosition": [
      700,
      825
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：按种类设置兽栏和禽栖，供给饲草饮水、进行照护，并留出训练灵兽的空场。"
  },
  {
    "id": "site:domain:gc-31",
    "planId": "GC-31",
    "number": 31,
    "name": "蛊苑",
    "region": "西谷",
    "zoneId": "Z-03",
    "type": null,
    "suggestedPhase": "专项",
    "diagramPosition": [
      150,
      150
    ],
    "diagramOffsetY": 115,
    "runtimeStatus": "planning",
    "status": "planning",
    "description": "规划用途：设置育蛊匣、孵温床与分池，安排隔声、病群隔离和污水处理，分室封存毒物。"
  }
]);
