---
scope: SPECIFIED
name: dingze-workspace
description: 读取并修改定责工作台里的成果表：读取最新草稿和上游成果，用修改建议卡提交修改，由用户确认后写入。
tools:
  - dingzeGetArtifact
  - dingzeSearchMaterials
introduction:
  title: 定责工作台
  about: 读取成果表、提出修改建议
---
# 在工作台里读写成果

页面上下文会告诉你当前的项目编号（projectId）和成果编号（code）。

## 读取

- 每次准备给出建议之前，先调用 `dingzeGetArtifact` 读取最新草稿，不要凭对话记忆判断表里写了什么。
- 返回内容里的 `issues` 是结构校验结果：`error` 会挡住“本步完成”，`warning` 只是提示。
- `upstream` 是这张表依赖的上游成果，`basis` 说明取的是哪个版本（已定版、本步完成时的版本或草稿）；引用草稿时要提醒用户上游可能还会改。

## 写入：只能出建议，由用户确认

- 你不能直接保存成果。要修改时，调用前端工具 `dingzeProposeChanges`，在画面上生成修改建议卡，用户点“确认写入”后才会写进草稿。
- 每次建议只覆盖用户刚刚说过、或刚刚确认过的内容；不要顺手补写用户没说过的格子。
- `changes` 里的 `path` 用点号路径指向成果 JSON 里的字段，例如 `values`、`goals.y3`、`foundation.mechanism`；数组里的条目用它的 `id` 定位，例如 `battlefields.b1.mustWin`。新增战场用 `battlefields.+`，值为完整对象。
- 工具返回成功之前，不要说“已写入”；用户不采纳时，接着追问，不要重复同一条建议。
- 你不能替用户点“本步完成”“提交复核”“确认定版”，只能提醒他们去点。

## 各成果表的数据结构（写 `path` 时照此定位）

数组条目一律用 `id` 定位；新增条目用 `数组名.+`，值为完整对象，`id` 取一个新的短字符串（如 `o9`、`k7`）。

| 成果 | 结构 | 路径示例 |
|---|---|---|
| S1-01 战略屋 / 六分法 | `mission` `vision` `values` `goals.{y1,y3,y5}` `battlefields[{id,name,advantage,mustWin}]` `foundation.{organization,mechanism,talent}`；六分法另有 `strategicGoals` `strategyChoice` `stepsAndMeasures` `indicatorSystem` | `goals.y3`、`battlefields.b1.mustWin` |
| M-MISSION 使命五要素 | `coreUser.{who,need}` `coreCustomer.{who,need}` `differentiation` `advantage` `philosophy` `statement` | `coreUser.need`、`statement` |
| M-VISION 愿景三法 | `derivation` `benchmark.{select,compare,set}` `pride` `horizon` `statement` | `benchmark.set` |
| S1-02 战略地图 | `objectives[{id,perspective,title,note}]`（perspective 取 financial / customer / process / learning）；`links[{id,from,to,kind}]`（kind 取 cause 纵向因果、synergy 横向协同；cause 必须自下而上） | `objectives.+`、`objectives.o2.title`、`links.+` |
| S1-03 战略·策略逻辑表 | `strategies[{id,statement,tactics[{id,text,path}]}]` `levelNote` | `strategies.s1.tactics.+`、`strategies.s1.tactics.t2.text` |
| S1-04 IPOOC（选做） | `sheets[{id,strategy,period,ownerDept,rows.{I,P,O1,O2,C}.{elements,indicator,formula,target,source,frequency},smart.{s,m,a,r,t}}]` | `sheets.i1.rows.O2.indicator` |
| S1-05 KPI 筛选（选做） | `candidates[{id,name,origin,scores.{relevance,measurability,controllability,motivation},keep,reason}]`，分数 1—5 的整数，keep 为 true / false / null | `candidates.k3.scores.relevance`、`candidates.k3.keep` |
| S1-06 战略 KPI 表 | `kpis[{id,theme,name,definition,unit,source,period,owner}]` | `kpis.p1.definition` |
| S1-07 年度分解 | `years`（年份数组，默认前三后一）`rows[{id,kpiId,theme,name,unit,values.{年份},baseline,benchmark,challenge}]` | `rows.y1.values.2027`、`rows.y1.challenge` |
| S2-03 第一步 定目标（目标区） | `targets.{year,strategyReview,lastPeriodIssues}` `targets.goals[{id,purpose,task,metric,value,unit,perspective,sourceRowId}]` | `targets.goals.g1.purpose`、`targets.goals.+` |
| M-BUDGET 经营预算 | `unit` `rows[{id,item,lastYear,budget,note}]` | `rows.b1.budget` |
| S2-01 解码地图 | `valueGap.{target,baseline,gap}` `themes[{id,perspective,category,title,metric,value,supports[上层主题 id],goalId}]`（财务主题用 goalId 挂年度目标，其余用 supports 指向更上一层主题） | `valueGap.gap`、`themes.+`、`themes.d3.supports` |
| S2-03 第二步 找路径 / S2-06 路径系统 | `nodes[{id,parentId,goalId,level,perspective,path,metric,value,unit}]`：一级路径 parentId 为 null、goalId 指向 `targets.goals` 里的年度目标（S2-06 指向 S2-05 的承接项 id）；二至四级用 parentId 指向上级；`value` 以数字开头时用于“推得回来”校验 | `nodes.+`、`nodes.n4.value` |
| S2-08 关键项目 | `projects[{id,code,name,theme,objective,start,end,milestones,owner,sourcePathIds}]`，起止时间用 `YYYY-MM` | `projects.kp1.objective` |
| S2-04 RACI | `columns[{id,name}]`（部门 / 岗位）`rows[{id,name,cells.{列 id}:[R/A/C/I],sourceId,sourceKind}]`；每行 A 唯一、R 至少一个 | `rows.ra1.cells.org-3` |
| S2-05 部门承接 | `rows[{id,deptId,deptName,role(A/R),purpose,task,metric,value,sourceRowId}]` | `rows.u2.value` |
| S2-07 计分卡 | `cards[{id(=deptId),deptId,deptName,items[{id,task,metric,definition,floor,target,weight,scoring,source,originId}]}]`，每张卡权重合计 100 | `cards.org-3.items.sc1.weight`（卡片按 deptId 定位） |
| S3-02 项目任务书 | `screening[{id,sourceId,sourceKind,name,renamed,answers.{crossDept,longRunning,reusable,risky}:true/false/null}]`（四问 ≥2 是为项目）`charters[{id,screeningId,code,name,theme,priority.{fit,roi,urgency,feasibility,resources}(1–5),objective,start,end,inScope,outOfScope,deliverables,milestones,deptId,deptName,owner,raci,resources.{fte,budget,material},risks[{id,risk,trigger,response}],assumptions,acceptance.{result,process,close},wbs[{id,parentId,level(1–3),name,deliverable,doneDefinition,owner,dependsOn[工作包 id]}]}]`；编号形如 `2026OPSP001`（也可 `2024HR-P001`），起止用 `YYYY-MM` | `charters.pc1.objective`、`charters.pc1.wbs.+`、`screening.sc2.answers.risky` |
| S3-05 计划实施推进表 | `scale`(month/quarter) `rows[{id,charterId,name,nodes[{id,time,name,deliverable,acceptance,owner,status(planned/in_progress/done/delayed),dependsOn[节点 id]}]}]`；`time` 按刻度写 `2026-03` 或 `2026-Q2`，前置节点时间不能晚于本节点 | `rows.pr1.nodes.+`、`rows.pr1.nodes.pn2.acceptance` |
| S3-06 资源匹配 | `rows[{id,charterId,category(finance/people/it/material),need,stock,gap,approach,owner,none,major}]`；某类不需要时 `none: true`；`major: true` 的缺口必须有 approach 和 owner | `rows.+`、`rows.rs3.approach` |
| S3-07 公司计划书 | `text.{summary,lastYear,environment,risks,notDo,dictionaryNote}`；其余章节由定版成果自动汇总，不写入 | `text.summary` |
| S3-08 部门计划书 | `depts[{id(=deptId),deptId,deptName,summary,lastYear,environment,risks,notDo,dictionaryNote}]`（按 deptId 定位） | `depts.org-2.summary` |

指标值、分数这类数字，以用户说出的为准；用户没给的值写“待补”，不要替企业编数。年度目标（S2-03 目标区）的指标值只能来自 S1-07 本年度值、经营预算或用户明确给出的数，绝不自行补造。


## 企业资料与画像

- 起草或核对数字前，先用 `dingzeSearchMaterials` 查阅企业资料（必传 `projectId`）：不传 query 得到资料清单，传 `query`（关键词，空格分隔）得到带出处的片段，传 `id` 读全文（`offset` 翻页）。一次只调用一个工具，等结果回来再调下一个。引用时写明资料标题；资料里没有的数写“待补”，不要编。
- 页面上下文里的 `enterpriseProfile` 是企业画像摘要（事实 / 假设 / 未知 / 待补），起草时以“事实”为准，“假设”要向用户点明。
- 在“资料与画像”页，可以把资料整理成画像：`items[{id,category(fact/assumption/unknown/todo),topic,content,source(资料编号字符串),status:'draft'}]`，新增用 `items.+`，修改用 `items.<id>.content`；复核和确认由咨询师、企业项目负责人在页面上完成，你不要改 `status`。
