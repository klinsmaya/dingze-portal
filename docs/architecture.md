# 系统架构

## 1. 组成

```
浏览器 ──► AI 门户 dingze（本仓库，React / Refine / shadcn Base UI / Tailwind）
                │  /api  带 x-spaces 空间头
                ▼
          NocoBase 2.4（多空间、AI 员工、通知、文件、ACL）
                │
          @ziqu/plugin-dingze（server-plugins/plugin-dingze）
            ├─ shared/   成果目录、状态机、校验、数据模型、差异、书中方法（前后端共用，别名 @dingze/shared）
            ├─ server/   collections、服务与 dingze 资源动作、通知
            └─ ai/       三位数字咨询师与 Skill 文件
```

- 门户生产部署只服务构建后的 `dist`，不安装 Node 依赖，因此所有依赖都在 `devDependencies`。
- 规则（Skill）随插件发版、随插件回滚（设计 D8）。

## 2. 目录

| 路径 | 内容 |
|---|---|
| `src/routes.tsx` | 应用路由与菜单：我的项目、项目（工作台 / 咨询工作区 / 成果与定版 / 交付）、咨询师工作台、本企业、运营管理 |
| `src/pages/projects/` | 项目页面：list、overview、workspace、artifacts、delivery、project-layout；`editors/` 每张表的编辑器；`components/` 步骤条、动作、校验条、导出、数字咨询师面板、书中方法、历史 |
| `src/pages/board/` | 咨询师工作台 |
| `src/pages/ops/`、`src/pages/enterprise/` | 运营管理、本企业 |
| `src/lib/dingze/` | 接口封装（api、ops-api、records-api）、查询钩子、导出（sheets / xlsx / docx）、计划书合成、AI 建议应用、进度与下一步 |
| `src/components/dingze/` | 状态徽标、通知铃铛 |
| `server-plugins/plugin-dingze/src/shared/` | `catalog`（成果目录与依赖）、`lifecycle`（状态机与解锁）、`validators` / `measures` / `goals` / `actions`（各阶段模型与校验）、`diff`、`board`、`book-notes`、`materials`（画像与资料检索）、`usage`（用量汇总）、`guidance`（引导缺口）、`expert`（专家咨询流转） |
| `server-plugins/plugin-dingze/src/server/` | `collections/`、`services/`（access、artifacts、registry、notify、board、enterprises、ops、comments、materials、usage、guidance、expert）、`plugin.ts` |
| `server-plugins/plugin-dingze/src/ai/` | `ai-employees/`（dingze-strategy-coach、dingze-goal-coach、dingze-action-coach）、`skills/`（内容 / 逻辑 / 衡量共识、找路径、RACI 级联、行动计划、工作台读写） |
| `server-plugins/scripts/` | 插件构建与部署脚本 |
| `tests/`、`e2e/` | 单测与 E2E |

## 3. 数据模型（插件 collections；除注明外均带空间字段）

| 表 | 用途 |
|---|---|
| `dz_enterprises` | 企业档案（空间名、简称、规模、状态） |
| `dz_org_units` | 组织部门 |
| `dz_projects` | 项目（年度、场景、立项层级、时间刻度；S1-01 一律以六分法为必做表达） |
| `dz_project_members` | 项目成员与项目角色 |
| `dz_artifacts` | 成果：状态、当前 / 本步完成 / 定版版本、上游已变更、例外 |
| `dz_artifact_versions` | 版本快照：rev、kind（ai_draft / enterprise_edit / consultant_revision）、payload、upstreamRefs、changes（本次保存包含的修改命令：来源、标签、关联批注、逐路径原值 / 新值） |
| `dz_proposals` | 数字咨询师建议 |
| `dz_dissents` | 团队异议 |
| `dz_step_exceptions` | 跳步例外 |
| `dz_audit_events` | 审计：动作、原因、前后状态、版本 |
| `dz_exports` | 导出记录 |
| `dz_notifications` | 站内通知 |
| `dz_comments` | 批注：锚点（行 id / 字段路径）、anchors（圈选的一组锚点）、内容、@ 提及、回复（parentId）、解决状态、所在版本 |
| `dz_materials` | 企业资料：标题、类型、文件名、原件（fileId，存于 `dz_material_files`，本地存储）、提取后的文字（≤ 15 万字） |
| `dz_material_files` | 资料原件（NocoBase 文件表，只允许登录用户上传，下载经 `downloadMaterial` 校验项目权限） |
| `dz_profiles` | 企业画像：条目（类别、主题、内容、来源、草稿 / 已复核 / 已确认）、rev（并发保护） |
| `dz_expert_requests` | 专家咨询：议题、问题、引用的定版版本（code / versionId / rev）、状态、专家、预约、纪要、意见 |
| `dz_guidance_gaps` | 引导缺口（**平台共享，无空间字段**）：项目、成果、类别、描述、期望、摘录、规则包版本、评审状态与意见、发布版本 |
| `dz_ai_sessions` | 数字咨询师对话归属项目的缓存（**无空间字段**，只在服务端汇总用量时读写） |

成果内容是整张表的结构化快照，内部条目带稳定 `id`，供版本对比、数字咨询师按路径写入和跨表追溯。

## 4. 接口（资源 `dingze`，均为登录后可调，处理函数自行校验空间、项目角色与状态）

| 分组 | 动作 |
|---|---|
| 项目 | `myProjects`（含阶段进度与按角色算出的下一步 `next`）、`projectOverview`（含每张表最近一次流转事件）、`consultantBoard` |
| 成果 | `artifactDetail`、`saveArtifact`、`transition`（stepDone / submitReview / approve / returnToEdit / confirm / reopen / forceLock / forceReturn）、`recordDissent`、`grantException` |
| 成果管理与交付 | `artifactRegistry`、`artifactHistory`（含每版修改记录）、`versionPayload`（修订对比取任意一版）、`versionDiff`、`deliveryBundle`、`recordExport` |
| 通知 | `myNotifications`、`markNotificationsRead` |
| 批注 | `listComments`、`addComment`、`resolveComment` |
| 资料与画像 | `listMaterials`、`getMaterial`、`addMaterial`（可认领已上传的原件）、`downloadMaterial`、`deleteMaterial`、`searchMaterials`、`getProfile`、`saveProfile` |
| 专家咨询 | `listExpertRequests`、`expertRequestDetail`、`createExpertRequest`、`actOnExpertRequest`（assign / schedule / answer / close / cancel） |
| 运营看板与引导缺口 | `opsBoard`、`addGuidanceGap`、`listGuidanceGaps`、`reviewGuidanceGap` |
| 运营 | `provisionEnterprise`、`listEnterprises`、`enterpriseDetail`、`updateEnterprise`、`addEnterpriseMembers`、`removeEnterpriseMember`、`saveOrgUnit`、`deleteOrgUnit`、`createProject`、`updateProject`、`setProjectMembers`、`removeProjectMember`、`listUsers`、`createUser`、`resetPassword` |

写操作带 `x-spaces: <企业空间>`；跨企业读取（我的项目、工作台、通知）由插件按调用者所在空间汇总。

## 5. 状态机与门禁

- 状态：未开始 → 进行中 → 本步完成 → 待复核 → 待确认 → 已定版（可解锁重开回到进行中）。
- 本步完成由企业项目负责人 / 部门负责人执行；提交复核由企业或咨询师；复核通过只能主咨询师；确认定版只能企业项目负责人；退回需写原因；解锁重开、强制定版 / 退回、开例外属主咨询师或咨询管理员，均需原因并进审计。
- 本步完成、复核通过、确认定版前做硬校验（错误级问题阻断，提示级不阻断）。
- 解锁顺序按成果目录 `unlockAfter`；上一阶段 P0 全部定版才开启下一阶段。
- 同阶段下游读上游的“本步完成”版，跨阶段只读定版；上游新版本或重开后下游标“上游已变更”，核对后保存一次清除；上游原样重新定版时自动清除。
- 计划书确认时，任务书、推进表、资源匹配表须已复核通过，并一起定版。

## 6. 数字咨询师

- 三位 AI 员工按阶段挂在咨询工作区右侧，页面上下文自动附带当前成果（代码、状态、草稿、校验结果）。
- 前端工具 `dingzeProposeChanges`（需用户确认）：按点号路径写入成果，数组条目按 `id` 定位，`数组名.+` 追加。界面上渲染为修改卡（原值 → 新值 → 影响），确认后作为一条“对话”来源的修改写入草稿，用户保存时生成版本（含对话修改时记为 `ai_draft`）。
- Skill `dingze-workspace/SKILLS.md` 记录每张表的 payload 路径；阶段 Skill 来自书稿方法论包。
- 书中方法（要点 / 坑 / 定版门禁）在 `shared/book-notes.ts`，前端面板与运营“方法与规则包”页共用。
- 只读的服务端工具（`defineTools`，自动允许）：`dingzeGetArtifact`（读成果）、`dingzeSearchMaterials`（列资料 / 关键词检索片段 / 分页读全文）。只读工具放在服务端，是因为前端自动允许的工具并行调用时会卡住对话。
- 用量：NocoBase 的 `aiUsageEvents` 记录每轮的 Token；对话所属项目取自该对话用户消息的页面上下文（`workContext[].content.projectId`），首次识别后缓存到 `dz_ai_sessions`。运营看板按项目汇总三位数字咨询师的轮次、Token、使用人数，只记录不计费。
- 引导缺口记录时带当时的插件（规则包）版本，评审“已发布”时填写包含改进的新版本号。

## 7. 角色与隔离

- 系统角色：`dz_consult_admin`、`dz_consultant`、`dz_ent_admin`、`dz_ent_member`、`dz_ops`（插件首次启用时创建）；门户入口按角色授权。
- 项目角色：企业项目负责人、部门负责人、项目成员、只读成员、主咨询师、协作咨询师。
- 一企业一空间：插件业务表带空间字段，请求必须带空间头；用户只属于被开通企业的空间；不属于空间的请求被多空间层拒绝（403），属于空间但非项目成员被插件拒绝（404）。
- 专家咨询的专家须是该企业空间里的咨询师；非项目成员的专家只能通过咨询申请读取申请时引用的定版版本。
- 引导缺口是平台共享表，只有运营 / 咨询管理员能列出；项目名只对其所在空间可见。

## 8. 编辑框架（设计稿 10）

- **修改 = 命令**：`src/lib/dingze/edit-log.ts`。编辑器照旧通过 `onChange` 交出新草稿，工作区把前后差异（`shared/diff.ts`，数组按 `id` 匹配；行顺序变化单独记为 `#order`）记成一条命令：时间、来源（直接改 / 调结构 / 对话 / 撤销）、人话标签、关联批注、逐路径原值与新值，以及本机用于精确撤销的前后快照。连续敲同一格合并为一条。撤销 / 重做按命令走；保存时命令（去掉快照）随版本存进 `changes`。
- **编辑会话**：`EditSessionContext`（`pages/projects/components/edit-session.tsx`）把草稿、修改记录、当前批注、修订状态、圈选、修改卡预览共享给右栏三页签、修改卡和画布标记，编辑器本身不需要知道。
- **画布标记**：`edit-markers.tsx` 按 `data-anchor` 找到格子 / 行 / 节点，用 `data-dz-mark` 叠加青色（改过 / 修订）、绿色（新增）、紫色（批注）、琥珀虚线（修改卡预览）、紫框（圈选）；批注编号钉是主区上的绝对定位层。没有锚点的普通字段在第一次被编辑时由工作区补上锚点。
- **调结构**：`src/lib/dingze/tree-ops.ts` 对“扁平树”（`id / parentId / level`，一级挂在目标上）做新增、升降级、上下移、移动到、拆分、合并、删除，纯函数、可单测；`editors/tree-editor.tsx` 提供节点工具条、行菜单、“移动到…”预览对话框和可编辑思维导图（`role=tree`，拖动有放置提示），路径（S2-03 / S2-06）、解码地图（S2-01，四个层面作为根）和 WBS（S3-02）共用。
- **修订**：取任意历史版本（`versionPayload`）和当前草稿做差异，标在画布上，删除项列在开关下方。会话的 `revisionCell(key)` 给出某一格的原值和修改人（取对比版本之后各版本保存的命令和本次未保存的命令），`GridCell` 据此显示“原值删除线 → 新值 · 修改人”；路径表把对比版本里有、当前没有的行画成可恢复的留痕行。
- **工作台外壳**（`project-layout.tsx` + `workspace.tsx`）：整屏固定，顶栏通过插槽（`topbar.main / actions`）放当前步骤与子步骤；`src/lib/dingze/route.ts` 把阶段 → 工作任务 → 实施步骤 → 子步骤建成一张路线，左栏（`route-rail.tsx`）和顶栏共用；子步骤和区块写在网址里（`?sub=`、`?zone=`、`?field=`）。
- **表头由编辑器发布**：编辑器调用 `useEditorChrome({ title, chip, views, variants, tools, zoom, summary, checks, extra })`，工作区把它画成表头三行和状态条（`workspace-chrome.tsx`、`status-bar.tsx`）；同一套工具条作用于导图选中的节点或表格聚焦的行。`checks(payload)` 让修改卡在确认前算出合计核对。
- **导图**：`TreeMindMap` 支持根 → 层面（`layers`，带放置目标与字段补丁）→ 节点，合计胶囊（`rollUp`）、虚线占位、同级之间的插入位（`MoveTarget.before`）、“松开后会这样”预览和联动调整（`dropAdjust`）、小地图。
- **修改卡**：`dingzeProposeChanges` 的每条修改可带 `op`（`set` / `remove` / `split` / `move`，见 `src/lib/dingze/changes.ts`；拆分出的条目 id 由原 id 派生，预览和确认后一致；路径的 `value` 与 `amount` 自动同步）。卡片在用户发消息后 5 分钟内出现即视为新到，工作区切到预览：编辑器渲染预览草稿（只读），`EditMarkers` 和琥珀色序号钉标出对应条目。
- **批注**：就地输入框（`comment-composer.tsx`，右键菜单、Ctrl + Alt + M、圈选条）和 @ 输入（`mention-input.tsx`）；@数字咨询师 不作为提醒发出，而是把批注带到对话请它出修改建议。

## 9. 导出

- Excel：`src/lib/dingze/export/sheets.ts` 把成果转成表模型（表头、行、合并区），`xlsx.ts` 用 exceljs 生成；未定版文件带“草稿”标记。
- Word：`plan-book.ts` 合成八章模型，`docx.ts` 用 docx 生成；公司级与部门级计划书共用。公司级第一章附战略屋（或六分法）与战略地图：SVG 原图内嵌，另附 PNG 兜底。
- 图片：`diagram-svg.ts` 用纯函数生成独立 SVG（只用文字与图形、固定浅色，不用 foreignObject，按宽度折行），`diagram-image.ts` 在浏览器画布上转 PNG（2 倍）；地图连线端点由 `map-layout.ts` 的 `linkLines` 计算，编辑器内的地图同用。
- 所有导出记入 `dz_exports`，在交付页展示。
