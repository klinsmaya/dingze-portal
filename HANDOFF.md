# 交接给 Codex：自驱战略 · 定三责

> 写给接手开发的编码代理。先读本文件，再读 `AGENTS.md`（模板约定）和 `docs/`（产品文档）。本仓库**公开**：任何密码、令牌、内部凭据都不能写进仓库、提交信息或日志输出。

## 1. 这是什么

企业战略咨询平台「自驱战略 · 定三责」：把《自驱战略落地》第 2—4 章的三张管理检查表（定战略责 → 定目标责 → 定行动责）做成逐表填写、复核、定版的在线工作流，每个阶段配一位“数字咨询师”（NocoBase AI 员工）。

由两部分组成：

| 部分 | 位置 | 说明 |
|---|---|---|
| AI 门户 `dingze` | 本仓库根目录（React 19 + Refine + shadcn / Base UI + Tailwind v4 + Vite） | 部署在 `https://ziqu.aihupo.cn/x/dingze/` |
| 服务端插件 `@ziqu/plugin-dingze` | `server-plugins/plugin-dingze` | 数据表、业务动作（资源 `dingze`）、AI 员工与 Skill；前后端共用的模型与校验在 `src/shared`（门户里用别名 `@dingze/shared` 引入） |

需求基线：《企业战略咨询平台需求规格说明书》V1.2、附录 B 成果编号；交互基线：设计稿《10 思维导图 / 表格：修改调整与批注》（OPS-72 v1.3）。

## 2. 当前状态（2026-10-11）

- 分支 `claude/serene-hawking-jgi7rn`，已推送；**没有开 PR**（用户没要求就不要开）。
- 测试环境：NocoBase 2.4.0-alpha.9，插件 **0.18.2** 已部署启用，门户已用最新代码发布。
- 检查：`npx tsc --noEmit`、`npx eslint src --quiet`、`npx vitest run tests`（221 项）全部通过。
- 用户提出的需求已全部完成，并在线上用演示账号实测：
  - 规格硬伤 5 条：六分法 P0 阻断、关闭公开注册、编号对齐附录 B、资料原件、S2-08 空字段与例外不绕过校验。
  - 小白易用性 10 条。
  - 设计稿 10 的统一编辑交互（覆盖所有可编辑表）。
  - 贴近企业实际的演示数据。
  - 验证明细见 `docs/acceptance.md` 末尾两节。

## 3. 仓库地图

| 路径 | 内容 |
|---|---|
| `src/routes.tsx` | 应用路由（`defineAppRoutes`；`registryRoutesEnabled = false`） |
| `src/pages/projects/` | 项目相关页面：`list`（我的项目）、`overview`（今天要做的 / 工作台）、`workspace`（填写，核心页面）、`artifacts`（成果与定版）、`delivery`（导出 / 交付）、`materials`、`expert`、`project-layout`（企业端 4 个入口 / 顾问端完整导航） |
| `src/pages/projects/editors/` | 每张表的编辑器，`artifact-editor.tsx` 按编码分发；`kit.tsx`（TextCell / RowActions 等）；`tree-editor.tsx`（调结构 UI、思维导图、移动到…）；`find-path.tsx`（找路径五子步导航、图 3-7 参考卡） |
| `src/pages/projects/components/` | 工作区部件：`edit-session`（编辑会话上下文）、`edit-markers`（画布标记与批注钉）、`changes-panel`（修改记录与修订）、`comments-panel`、`coach-panel`（数字咨询师、修改卡、三句开头）、`status-bar`（状态条与快捷键）、`artifact-actions`（流转按钮、首次“本步完成”说明） |
| `src/lib/dingze/` | 前端逻辑：`edit-log`（修改 = 命令）、`tree-ops`（树操作，纯函数）、`api` / `queries` / `records-*`（接口）、`export/`（Excel / Word）、`diagram-*`（SVG / PNG）、`locate`（定位）、`progress`（下一步链接） |
| `server-plugins/plugin-dingze/src/shared/` | `catalog`（成果目录：解锁、依赖、`plain` 人话标题、附录 B `SPEC_ITEMS`）、`lifecycle`（状态机）、`validators` / `measures` / `goals` / `actions`（各表模型与校验）、`diff`、`next-action`（下一步与协作状态）、`book-notes` |
| `server-plugins/plugin-dingze/src/server/` | `collections/`、`services/`（artifacts、comments、materials、enterprises、ops、registry、expert…）、`plugin.ts`（动作注册）、`upgrade/`（启动时幂等的数据合并） |
| `server-plugins/plugin-dingze/src/ai/` | 三位 AI 员工与 Skill（`dingze-workspace/SKILLS.md` 记录每张表的 payload 路径） |
| `server-plugins/scripts/` | 插件构建 / 部署脚本；`demo-seed/` 演示数据种子（见其 README） |
| `tests/logic/dingze/`、`tests/components/` | 单测；`e2e/dingze-isolation.spec.ts` 跨企业隔离 E2E |
| `docs/` | 使用说明、架构、发布、成果目录、验收、交付总览、演示账号 |
| `registry/` | 模板自带的 NocoBase Registry 源码（`nocobase-ai` 等），一般不改 |

## 4. 开发、检查、发布

```bash
pnpm install
npx tsc --noEmit && npx eslint src --quiet && npx vitest run tests
```

- `vitest run`（不带 `tests`）会多出 2 个失败文件：`registry/nocobase-ai-knowledge-base/tests/*` 用的是 `node:test`，模板原有问题，与本项目无关。
- **本地开发：** `NOCOBASE_PORTAL_BASE=/ NOCOBASE_API_URL=<测试环境>/api pnpm dev --port 5173`，开发服务器会把 `/api` 代理到该地址。
  - 开发模式下页面底部那颗黑色小胶囊是开发工具条，线上没有。
  - 侧栏控制台里 Base UI 报的 `nativeButton` 警告是模板原有的。
- **改插件：**
  1. 改 `server-plugins/plugin-dingze`，并把 `package.json` 的版本号加 1。
  2. 执行 `NOCOBASE_SRC=<NocoBase 2.4.0-alpha.9 源码，已 yarn install> NOCOBASE_API_URL=<host>/api NOCOBASE_TOKEN=<管理员令牌> server-plugins/scripts/deploy-dingze.sh`。脚本会构建 tgz、上传更新，并轮询直到新版本启用。
  3. 插件端可以在 NocoBase 源码里做类型检查：把插件复制到 `packages/plugins/@ziqu/plugin-dingze`，再对 `src/server`、`src/shared` 跑 `tsc --noEmit`。
- **发布门户：** `NODE_USE_ENV_PROXY=1 nb portal deploy dingze`。
  - 本机经代理出网时，必须带 `NODE_USE_ENV_PROXY=1`。
  - 报 `TOKEN_RENEW_FAILED` 是 nb 的登录过期了：执行 `nb env auth ziqu -a token -t <管理员令牌>` 后重试。
  - 只有用户要求发布时才部署。
- **门户入口授权**（新环境才需要）：见 `docs/deploy.md` 第 3 节。2.4.0-alpha.9 上必须用 `--body '["dingze"]'`。

## 5. 凭据（都不在仓库里）

- 测试环境管理员账号和演示账号密码由用户单独掌握；`docs/demo-accounts.md` 只列账号，不含密码。需要时**向用户要**，放进私有目录，例如 `DINGZE_SECRETS_DIR` 下的 `<账号>.pw`，权限 600。
- 接口里新建账号时，初始密码只在创建响应里返回一次：直接写进私有文件，不要打印。
- 输出日志前把令牌打码。

## 6. 用户给过的硬约束

1. 用中文和用户交流；文档、界面文案用中文，说人话，书里的编号用小字。
2. 只在 `claude/serene-hawking-jgi7rn` 上提交、推送；不开 PR，除非用户要求。提交信息里不写模型名。
3. 不动测试实例上的其他应用和其他门户（main / ziqu / admin / mobile），不碰别的数据；只改 `dingze` 门户、本插件和本插件的数据。
4. **不要给 AI 员工 nathan、dara、lina、orin 绑定任何东西**（它们是开发用 AI 员工）。本项目只用三位数字咨询师：`dingze-strategy-coach`、`dingze-goal-coach`、`dingze-action-coach`。
5. **不削弱逐表解锁、定版门禁、角色隔离**；规格问题不能用放宽校验来混过去。
6. 新的 npm 包一律装成 devDependencies（见 `AGENTS.md`）。
7. 难以撤回或对外的操作先问用户，例如改实例级设置、删除数据、对外发布。
8. 不绕过代理策略，不关 TLS 校验。

## 7. 必须知道的设计约定

### 流程

- 状态：未开始 → 进行中 → 本步完成 → 待复核 → 待确认 → 已定版。可以解锁重开、退回、强制定版（仍要过校验）、强制退回。规则在 `shared/lifecycle.ts`。
- 解锁是**动态的**：
  - 上一阶段 P0 全部定版，下一阶段才开。上游被重开时，下游阶段会重新关上（这是规格要求）。
  - `unlockAfter` 用 `hasReachedStepDone`：表曾经做到“本步完成”（`everCompleted`），被退回后下游也保持解锁。
- “开例外”只跳过解锁顺序；本步完成、复核、确认、强制定版始终做校验（`validationApplies`）。
- 上游改动后下游标“上游已变更”，下游核对后保存一次即清除。上游被退回、正在修改时，下游保存后仍是已变更。
- 成果内容是整张表的 JSON；表里的条目都带稳定的 `id`，版本对比、AI 路径写入、批注锚点、修改命令都靠它。

### 编辑框架

- 编辑器只需要 `value` / `onChange(next)`。工作区对比前后两版，把差异记成一条**命令**（`src/lib/dingze/edit-log.ts`）：
  - 来源分为直接改、调结构、对话、撤销；会自动识别“增删行”和“调顺序”。
  - 命令带人话标签、关联的批注、逐路径的原值和新值。
  - 撤销 / 重做按命令走；保存时命令随版本存进 `changes`。
- 需要自定义标签或来源时，在调用 `onChange` 前执行 `useEditSession()?.nextMeta({ via, label })`。树操作已经这样做了，见 `tree-editor.tsx` 的 `useTreeActions`。
- 画布标记、批注钉、定位都靠 DOM 上的 `data-anchor`：
  - 行用行 `id`，格子用字段路径，例如 `battlefields.b1.mustWin`。
  - 新写的编辑器请给行和关键格子加上 `data-anchor`。
  - 普通字段第一次被编辑时，工作区会自动补上锚点。
- 数字咨询师通过前端工具 `dingzeProposeChanges` 提议修改，`coach-panel.tsx` 把它渲染成修改卡。用户确认后，以“对话”来源写入**草稿**，不自动保存。AI 不能直接改人写的内容。
- 树形数据（路径 / WBS / 解码地图主题）统一用 `tree-ops.ts`（`id` / `parentId` / `level`，一级节点挂在 `goalId` 上）。新的树表复用 `TreeMindMap`、`TreeNodeMenu`、`MoveToDialog`。
- 双视图统一叫「思维导图 / 表格」，每人上次选的视图存在 localStorage `dingze:view:<表编码>`。
- 表名用 `catalog.ts` 的 `plain`；书里的名称、编号、出处做成小字。

### 加一张表或改一张表的检查单

1. 改 `shared` 里的模型与校验，单测写在 `tests/logic/dingze`。
2. 改编辑器，加 `data-anchor`；行表要给 `RowActions` 传 `onMove`。
3. 改 Excel 导出 `src/lib/dingze/export/sheets.ts`；如果进计划书，再改 `plan-book.ts`。
4. 同步 AI Skill 里的 payload 路径说明。
5. 改目录或依赖时，同步 `docs/artifact-catalog.md`。
6. 已有数据要迁移的，在 `server/upgrade/` 加启动时幂等执行的合并逻辑，参照 `merge-goal-targets.ts`。

## 8. 演示数据与浏览器自测

- 演示数据有两家虚构企业、三个项目，每张表处在什么状态见 `docs/demo-accounts.md`。数据可以用 `server-plugins/scripts/demo-seed/` 重新生成，用法见其 README，脚本按角色走正式接口。
- 浏览器自测：
  - 用 Playwright 的 Chromium，路径 `/opt/pw-browsers/chromium`，经代理访问测试环境。
  - 本机打 localhost 时设 `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1`。
  - 文件名有中文时设 `LANG=C.UTF-8`。
- 中文输入法：在输入框里处理 Enter 时要先判断 `e.nativeEvent.isComposing`，`NodeEditor` 已经这样做。
- 数字咨询师走真实模型，响应可能要几十秒，自测时等待要放长。

## 9. 待办（按优先级）

1. **待用户决定：** 实例上钉钉认证器开着“自动注册”，没有改。改了会影响同实例的其他应用，要先问用户。
2. **多人同时编辑：** 设计稿要求节点级锁和实时同步，同一字段冲突时给对比卡。现在只在保存时做版本冲突检查（409）。
3. **从 Excel 粘贴多行多列：** 要求先预览再写入；导图里粘贴多行文字时按缩进生成下级。还有导出 Excel 时可选“带批注”。
4. **S2-01 和 S2-03 合成“一棵路径树”：** 设计稿第 7 节提出，并标了“请架构确认”。现在是两份数据，靠子步骤 5“导入”衔接。动之前先和用户确认语义。
5. 批注锚点迁移：拆分时批注跟着第一条，合并时跟着合并后的节点，删除时保留批注并标“原位置已删除”。
6. 思维导图导出图片 / PDF（按当前折叠状态）；S2-01“解码地图版式”点节点跳回导图。
7. 低于 1100px 时右栏改为抽屉；导图加小地图。还有无障碍细节：修改结果的 aria-live 播报、触屏长按菜单。
8. 设计稿第 3 节里的快捷键：Ctrl+Enter / Ctrl+Shift+Enter 已在导图里支持，表格里还没有；复制粘贴节点也还没有。
9. 企业知识库、Word 精排版、专家咨询的排期与费用：这些不在 V1 范围内，列为后续。

## 10. 验证一次改动的最小流程

1. `npx tsc --noEmit && npx eslint src --quiet && npx vitest run tests`。
2. 改了插件：在 NocoBase 源码里跑类型检查 → 提升版本号 → 部署 → 用接口读回验证。
3. 改了界面：启动本地开发服务器，用演示账号把相关流程走一遍并截图核对。至少覆盖企业负责人一条路径、顾问一条路径；涉及权限时再用只读成员或外企业账号试一次。
4. 只有用户要求时才发布门户和插件。发布后在线上复查一遍。
5. 提交前看一遍 diff，确认没有密码或令牌，再推送到指定分支。
