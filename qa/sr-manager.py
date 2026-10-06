"""Validate and render the SR registry; never infer completion from test counts."""
from pathlib import Path
import argparse
import json
import re
import sys
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/requirements'
REGISTRY = BASE / 'registry.json'


def load():
    return json.loads(REGISTRY.read_text())


def validate(data):
    errors = []
    records = data['requirements']
    ids = [r['id'] for r in records]
    if len(ids) != len(set(ids)):
        errors.append('Duplicate SR ID')
    by_id = {r['id']: r for r in records}
    known_decisions = set(re.findall(r'(?<![A-Za-z0-9])(?:U|R|T|L)-\d{2,3}(?![A-Za-z0-9])', (ROOT/'docs/design/DECISIONS.md').read_text()))
    all_acs = set()
    all_tasks = set()
    for r in records:
        sid = r['id']
        if not re.fullmatch(r'SR-XF-\d{3}', sid):
            errors.append(f'{sid}: invalid ID')
        for field, values in data['enums'].items():
            if field in ['task_status', 'ac_status']:
                continue
            if r[field] not in values:
                errors.append(f'{sid}: invalid {field}')
        for field in ['design_gap', 'baseline', 'scope_decision', 'design_deliverables', 'requirements', 'acceptance', 'tasks', 'ready_gate', 'done_gate']:
            if not r.get(field):
                errors.append(f'{sid}: missing {field}')
        for path in r['source_specs']:
            if not (ROOT/path).is_file():
                errors.append(f'{sid}: missing source {path}')
        for decision in r['related_decisions']:
            if decision not in known_decisions:
                errors.append(f'{sid}: unknown decision {decision}')
        known_acceptance = set(re.findall(r'(?<![A-Za-z0-9])(?:[A-Z]+-){1,2}\d{2,3}(?![A-Za-z0-9])', '\n'.join((ROOT/p).read_text() for p in r['source_specs'])))
        for ref in r['existing_acceptance_refs']:
            if ref not in known_acceptance:
                errors.append(f'{sid}: unknown source acceptance {ref}')
        for dep in r['dependencies']:
            if dep not in by_id:
                errors.append(f'{sid}: unknown dependency {dep}')
            elif r['scope'] == 'early' and by_id[dep]['scope'] != 'early':
                errors.append(f'{sid}: early requirement depends on {by_id[dep]["scope"]} {dep}')
        task_ids = {t['id'] for t in r['tasks']}
        phases = [t['phase'] for t in r['tasks']]
        if sorted(phases) != ['D01', 'D02', 'I01', 'R01', 'V01']:
            errors.append(f'{sid}: missing/duplicate task phase')
        for t in r['tasks']:
            if t['id'] in all_tasks or not t['id'].startswith(sid+'-'):
                errors.append(f'{sid}: duplicate/foreign task {t["id"]}')
            all_tasks.add(t['id'])
            if t['status'] not in data['enums']['task_status']:
                errors.append(f'{sid}: invalid task status')
            for dep in t['depends_on']:
                if dep not in task_ids:
                    errors.append(f'{sid}: unknown task dependency {dep}')
                elif t['status'] in ['in_progress', 'done'] and next(x for x in r['tasks'] if x['id']==dep)['status'] != 'done':
                    errors.append(f'{sid}: task started before prerequisite {dep}')
            if t['status'] == 'done' and not t['evidence']:
                errors.append(f'{sid}: completed task {t["id"]} has no evidence')
            if t['status'] == 'blocked' and not t.get('blocked_reason'):
                errors.append(f'{sid}: blocked task has no specific reason')
        task_visiting, task_visited = set(), set()
        def walk_task(tid):
            if tid in task_visiting:
                errors.append(f'{sid}: cyclic task dependency {tid}')
                return
            if tid in task_visited:
                return
            task_visiting.add(tid)
            for dep in next(t for t in r['tasks'] if t['id'] == tid)['depends_on']:
                if dep in task_ids:
                    walk_task(dep)
            task_visiting.remove(tid)
            task_visited.add(tid)
        for tid in task_ids:
            walk_task(tid)
        for ac in r['acceptance']:
            if ac['id'] in all_acs or not ac['id'].startswith(sid+'-AC-'):
                errors.append(f'{sid}: duplicate/foreign AC {ac["id"]}')
            all_acs.add(ac['id'])
            if not ac['scenario'] or not ac['expected']:
                errors.append(f'{sid}: empty acceptance scenario/result')
            if ac['status'] not in data['enums']['ac_status']:
                errors.append(f'{sid}: invalid AC status')
            if ac['status'] == 'passed' and not ac['evidence']:
                errors.append(f'{sid}: passed AC without evidence')
        if r['design_status'] == 'ready' and not all(t['status'] == 'done' for t in r['tasks'] if t['phase'] in ['D01', 'D02']):
            errors.append(f'{sid}: ready without completed design/review tasks')
        if r['development_status'] == 'implemented' and not all(t['status'] == 'done' for t in r['tasks'] if t['phase'] == 'I01'):
            errors.append(f'{sid}: implemented without completed integration task')
        if r['acceptance_status'] == 'passed' and (r['development_status'] != 'implemented' or not r['evidence']):
            errors.append(f'{sid}: acceptance passed without implementation/evidence')
        if r['acceptance_status'] == 'passed' and not all(ac['status']=='passed' for ac in r['acceptance']):
            errors.append(f'{sid}: acceptance passed with incomplete AC')
        if r['acceptance_status'] == 'passed' and not all(t['status'] == 'done' for t in r['tasks'] if t['phase'] == 'V01'):
            errors.append(f'{sid}: acceptance passed without completed validation task')
        if r['release_status'] == 'released' and r['acceptance_status'] != 'passed':
            errors.append(f'{sid}: released before acceptance passed')
        if r['scope'] != 'early' and r['iteration'] not in ['conditional', 'deferred']:
            errors.append(f'{sid}: non-early item assigned active iteration')
    visiting, visited = set(), set()
    def walk(sid):
        if sid in visiting:
            errors.append(f'{sid}: cyclic SR dependency')
            return
        if sid in visited:
            return
        visiting.add(sid)
        for dep in by_id[sid]['dependencies']:
            if dep in by_id:
                walk(dep)
        visiting.remove(sid)
        visited.add(sid)
    for sid in by_id:
        walk(sid)
    if errors:
        raise ValueError('\n'.join(errors))
    return dict(requirements=len(records), scopes=dict(Counter(r['scope'] for r in records)),
                tasks=len(all_tasks), acceptance_criteria=len(all_acs), dependencies='acyclic',
                decision_sources='valid', source_paths='valid')


def render(data):
    BASE.mkdir(exist_ok=True)
    items = BASE/'items'
    items.mkdir(exist_ok=True)
    labels = {'early':'前期必需', 'conditional':'条件范围', 'deferred':'远期暂存'}
    for r in data['requirements']:
        s = [f'# {r["id"]} · {r["title"]}', '', '来源：DB-2026-10-05 v1.2；需求版本：'+r['version']+'；建档日期：2026-10-06。', '',
             '| 字段 | 值 |', '| --- | --- |', f'| 范围 / 模块 | {labels[r["scope"]]} / {r["group"]} |',
             f'| 优先级 / 计划 | {r["priority"]} / {r["iteration"]} |',
             f'| 设计 / 开发 | {r["design_status"]} / {r["development_status"]} |',
             f'| 验收 / 发布 | {r["acceptance_status"]} / {r["release_status"]} |',
             f'| 责任人 / 复核人 | {r["owner"] or "待分配"} / {r["reviewer"] or "待分配"} |', '',
             '## 来源、依赖与范围', '', r['scope_decision'], '',
             '决策来源：'+', '.join(r['related_decisions'])+'。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。', '',
             '规格：'+ '、'.join(f'[{Path(p).name}](../../../{p})' for p in r['source_specs'])+'。', '',
             '依赖：'+('、'.join(f'[{d}]({d}.md)' for d in r['dependencies']) or '无')+'。', '',
             '关联既有验收：'+', '.join(r['existing_acceptance_refs'])+'；本SR的AC细化这些目标，不代表旧版本已经通过。', '',
             '## 现状与设计缺口', '', r['baseline'], '', r['design_gap'], '',
             '现状是适用旧能力的基线，不表示该SR完整目标已通过。', '',
             '## 必须补齐的设计交付物', '']
        s += [f'{i+1}. {text}' for i,text in enumerate(r['design_deliverables'])]
        s += ['', '## 需求行为', '']
        for i, text in enumerate(r['requirements']):
            s += [f'{r["id"]}-REQ-{i+1:02d}：{text}', '']
        s += ['', '## 验收标准', '', '| ID | 情景 / 操作 | 必须看到的结果 | 状态 |', '| --- | --- | --- | --- |']
        s += [f'| {ac["id"]} | {ac["scenario"]} | {ac["expected"]} | {ac["status"]} |' for ac in r['acceptance']]
        for ac in r['acceptance']:
            if ac['evidence']:
                s += ['', ac['id']+'证据：'+'；'.join(ac['evidence'])]
        s += ['', r.get('acceptance_notes', '每条AC至少覆盖相关数据、真实行为、UI解释和保存恢复；需要设备或真人证据时单独列出，不以旧测试数量替代。'), '',
              '## 开发任务', '', '| 任务 | 工作 | 状态 | 前置 | 责任人 |', '| --- | --- | --- | --- | --- |']
        s += [f'| {t["id"]} | {t["title"]}：{t["description"]} | {t["status"]} | {", ".join(t["depends_on"]) or "无"} | {t["owner"] or "待分配"} |' for t in r['tasks']]
        for t in r['tasks']:
            if t['evidence']:
                s += ['', t['id']+'证据：'+'；'.join(t['evidence'])]
            if t.get('blocked_reason'):
                s += ['', t['id']+'阻塞原因：'+t['blocked_reason']]
        s += ['', '## 可进入开发的条件', '']+['- '+x for x in r['ready_gate']]
        s += ['', '## 关闭条件', '']+['- '+x for x in r['done_gate']]
        s += ['', '## 不在本SR范围', '']+['- '+x for x in r['excluded']]
        s += ['', '## 证据与变更', '', '\n'.join('- '+x for x in r['evidence']) or '尚无本SR完整交付证据；既有局部证据参见现状与来源规格。', '',
              '\n'.join(f'- {x["date"]}：{x["reason"]}' for x in r['change_log']), '',
              '本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。', '']
        (items/(r['id']+'.md')).write_text('\n'.join(s))
    groups=[('I0','基线整理'),('I1','完整小院'),('I2','装备成长与地方合作'),('I3','活世界与救援'),('I4','篇章与组织收束'),('I5','平衡、设备与发布'),('backlog','待排期'),('conditional','条件范围'),('deferred','远期暂存')]
    s=['# SR需求总表与开发顺序', '', '设计基线：DB-2026-10-05 v1.2；需求台账：SR-XF-2026-10-06。', '',
       '计划编号表示依赖顺序，不表示用户只要求交付某一小块，也不是承诺发布日期。具体任务能否启动还须检查其依赖的可用契约与设计完成情况。', '',
       '前期32项、条件范围2项、远期暂存6项。每SR含设计、契约审阅、开发集成、验收兼容、发布交接五类任务；本次建档不把这些功能标完成。', '']
    for iteration,title in groups:
        rows=[r for r in data['requirements'] if r['iteration']==iteration]
        if not rows:
            continue
        s += [f'## {iteration} · {title}', '', '| SR | 名称 | 优先级 | 设计 | 开发 | 验收 | 依赖 |', '| --- | --- | --- | --- | --- | --- | --- |']
        s += [f'| [{r["id"]}](items/{r["id"]}.md) | {r["title"]} | {r["priority"]} | {r["design_status"]} | {r["development_status"]} | {r["acceptance_status"]} | {", ".join(r["dependencies"]) or "无"} |' for r in rows]
        s += ['']
    first = next(r for r in data['requirements'] if r['id']=='SR-XF-001')
    checkpoint = 'SR-XF-001已完成需求管理及文档一致性验收。' if first['acceptance_status']=='passed' else '先完成SR-XF-001。'
    s += ['## 当前接续', '', checkpoint+'下一迭代按I1集中补齐共同契约、空间、预制件、自由营造、人物活动、生产物流、触控和迁移。设计输出与实现同SR跟踪，跨模块依赖不按文件独立完成判断。', '',
          '远期或条件项不进入前期关键依赖；范围改变时登记决策与影响，再重新排期。', '']
    (BASE/'BACKLOG.md').write_text('\n'.join(s))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    sub.add_parser('validate')
    sub.add_parser('refresh')
    ls=sub.add_parser('list'); ls.add_argument('--scope',choices=['early','conditional','deferred']); ls.add_argument('--iteration')
    task=sub.add_parser('task'); task.add_argument('task_id'); task.add_argument('--status',required=True,choices=['todo','in_progress','blocked','done']); task.add_argument('--owner'); task.add_argument('--reason'); task.add_argument('--evidence',action='append',default=[])
    args=parser.parse_args()
    data=load()
    if args.command == 'task':
        found=[t for r in data['requirements'] for t in r['tasks'] if t['id']==args.task_id]
        if len(found)!=1:
            raise ValueError('Unknown task ID: '+args.task_id)
        t=found[0]
        t['status']=args.status
        t['blocked_reason']=args.reason if args.status=='blocked' else None
        if args.owner:
            t['owner']=args.owner
        t['evidence']+=args.evidence
        record=next(r for r in data['requirements'] if t in r['tasks'])
        from datetime import date
        record['change_log'].append({'date': date.today().isoformat(), 'reason': args.reason or f'{t["id"]}更新为{args.status}；任务状态不自动改变SR整体状态。'})
        validate(data)
        REGISTRY.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        render(data)
        print(json.dumps({'task':t['id'],'status':t['status']},ensure_ascii=False))
    elif args.command == 'list':
        validate(data)
        for r in data['requirements']:
            if (args.scope and r['scope']!=args.scope) or (args.iteration and r['iteration']!=args.iteration):
                continue
            print(r['id'],r['priority'],r['design_status'],r['development_status'],r['acceptance_status'],r['title'])
    else:
        result=validate(data)
        if args.command=='refresh':
            render(data)
        print(json.dumps(result,ensure_ascii=False))


if __name__=='__main__':
    try:
        main()
    except (ValueError, KeyError) as exc:
        print(str(exc),file=sys.stderr)
        sys.exit(1)
