# SR-XF-NNN · 需求名称

模板为新需求录入提示，正式数据以registry.json为准。不得复用已分配编号。

## 基本信息

- 稳定ID、版本、scope（early/conditional/deferred）、group、priority、iteration。
- design_status、development_status、acceptance_status、release_status分别记录。
- owner/reviewer；未知为null，不虚构人员或工期。
- related_decisions：用户确认U、作者默认R、可调T的来源；source_specs和existing_acceptance_refs。
- dependencies：必须存在且无环；early不得依赖conditional/deferred。

## 现状和缺口

写明适用版本、已存在的实际能力及证据边界。说明缺哪些设计表、参数、场景、作者卡或分支；不要把“还没写代码”全部改写为“没有设计”。

## 设计交付物与需求行为

交付物包含可直接用于开发的字段/参数/引用、实际行为、素材/视觉、UI/反馈、拒绝/失败/取消/恢复、存档与迁移。重要内容还包含既定真相、人物动机与资源、线索/时间图、可达预算、分支、持续结果和知情投影。

每项行为以`SR-XF-NNN-REQ-NN`编号，描述具体触发及必须结果，保留不变量和范围排除。

## 验收

每条AC包含：`SR-XF-NNN-AC-NN`、情景/操作、预期结果、状态和真实证据。至少覆盖正常、关键拒绝/失败、保存恢复；涉及因果的额外覆盖迟到、自救或反制。性能/触控/真人体验使用相应设备与测量，不能以Node时间或旧模板通过数替代。

## 任务和门槛

- D01设计补齐；D02契约与内容审阅；I01开发集成；V01验收兼容；R01发布交接。
- 每个任务含stable task ID、前置、状态、责任人和证据。
- 定义ready_gate与done_gate；先按真实成果完成任务，再明确推进SR各状态。
- 每次范围/参数/条件改变写change_log并同步来源规格，保留U/R/T来源区别。

远期/条件项注明激活条件和不阻塞前期；文档管理项的运行时发布为not_applicable，仍需登记文档提交与验证。
