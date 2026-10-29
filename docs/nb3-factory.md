# nb3-factory 工作流接入

本仓库默认分支 `main` 保留现有 NocoBase 2 门户和插件代码，同时承载工厂控制工作流；`apps/dingze` 是独立的 NocoBase 3 应用分支。当前任务为 [Issue #2](https://github.com/klinsmaya/dingze-portal/issues/2)，用户明确不迁移旧数据。

## 来源与边界

控制代码和应用基线均固定到 `gchust/nb3-factory` 提交 `0d8873eb2a0cee1173ef02aa8ac8ab5ac2e7696c`，对应应用模板 `1.0.0-beta.70`。来源和工作流列表见 `.github/factory-integration.json`。应用基线从该提交的已跟踪文件生成，不包含聊天中的本地试验、依赖目录、数据库或生成的配置密钥。

接入包含任务队列、开发、全量质量检查、新 SQLite 安装、登录后的浏览器业务验收、有限修复、独立终验、PR 发布、进度/用量/验收报告，以及手动独立评审和评测重放。保持执行 Agent 只读仓库凭据、Publisher 不执行生成代码、不接收模型密钥的原有边界。

未接入上游的模板刷新、批量定时搭建、飞书日报、跨仓库框架修复和私有预览部署。尤其不使用上游默认的预览主机、VPN和部署密钥。浏览器截图和报告仍由任务 Artifact 保留。

应用业务 PR 指向 `apps/dingze`，不自动合并，也不部署旧环境。模板刷新不能覆盖 v2 的 `main`。新增的 repository-app-base 适配使空目标落到 `apps/dingze`，拒绝显式 `main` 目标，新应用分支从配置的 v3 基线而非 v2 默认分支创建。

## 必须完成的 GitHub 配置

1. 将控制工作流接入改动审阅合入 `main`，并确认 `apps/dingze` 已发布且包含 v3 `@nocobase/app-cli` 和 `nocobase build`。不要在 v2 上直接启动任务。
2. 在 Settings → Actions → General 启用 Actions，允许本接入所用的固定 SHA Actions；允许工作流创建 PR（Allow GitHub Actions to create and approve pull requests）。各 Job 已声明最小权限，模型调用 Job 不持有仓库写权限。
3. 在 Settings → Secrets and variables → Actions 安全配置执行器。不能从当前 API 读出配置清单：读取权限、Secret 名称及 Variable 名称均曾返回403，因此现有配置状态是“未能核实”，不代表没有配置。不要在 Issue、聊天或源码中填写密钥。

默认 `pi` 配置：

| 类型     | 名称                      | 用途                                                            |
| -------- | ------------------------- | --------------------------------------------------------------- |
| Secret   | `CODE_AGENT_API_ENDPOINT` | 模型服务 Base URL                                               |
| Secret   | `CODE_AGENT_API_KEY`      | 模型 API 密钥                                                   |
| Variable | `CODE_AGENT_MODEL`        | 实际可调用的模型 ID                                             |
| Variable | `CODE_AGENT_ENGINE`       | 可省略，默认 `pi`                                               |
| Variable | `CODE_AGENT_API_TYPE`     | 可省略，默认 `openai-completions`；也支持 `openai-responses` 等 |

如改用 `codex`，配置 `CODE_AGENT_ENGINE=codex`、`CODEX_MODEL` 和 Secret `CODEX_API_KEY`，有自定义服务时再配 `CODEX_BASE_URL`。其他执行器及固定版本以 `.github/AGENT_ADAPTERS.md` 和注册表为准，不能把本云环境的 ChatGPT 登录状态假定为 GitHub Runner 的模型凭据。

## 启动 Issue #2

Issue 在工作流接入之前就已创建，不会因文件合入而自动重放。完成上述准备后，在 Actions → **Code Agent NocoBase Task → Run workflow** 选择 `main`，输入 `issue_number=2`。任务正文中的目标是 `apps/dingze`。

也可以使用已有授权的 GitHub CLI：

```bash
gh workflow run code-agent-task.yml --repo klinsmaya/dingze-portal --ref main -f issue_number=2
```

检查实际 Run 状态、质量检查、业务 QA、独立终验和 PR；成功创建 Run 不代表交付成功。工作分支为 `agent/issue-2`，业务 PR 目标为 `apps/dingze`。PR 由人审阅合并。失败应先读诊断，不能通过放宽校验、跳过 QA 或清零修复计数来继续。

## 本地验证与后续维护

```bash
# Node.js 24，无需安装 v2 应用依赖即可检查控制平面。
bash .github/scripts/test-integration.sh
```

该命令明确运行本接入涉及的队列、权限边界、补丁发布、交接恢复、预算、Agent配置、浏览器报告和分支保护测试。上游针对未接入的模板刷新/私有预览/框架修复等测试仍随源代码留存，但不冒充本仓库已配置这些外部能力。

控制 Job 不执行业务分支的脚本；业务代码在 `apps/dingze` 上安装、启动、验证。应用基线的 `pnpm check` 按上游 verify.sh 的约定仅把 `.github` 控制平面排除在应用 Lint/格式检查之外；应用类型、测试和构建全部保留，控制平面独立运行上述159项测试。任务流水线还会单独执行新 SQLite 迁移和浏览器 QA。后续更新工厂时固定新提交，重新检查依赖闭包和权限，不覆盖 v2 源码、现有 npm 手动发布工作流或用户配置。

## 本次接入验证结果

- 控制平面：159项回归通过。
- 独立v3基线：55个测试文件、299项应用测试通过；应用Lint、格式、类型及生产构建通过。
- 新SQLite迁移/初始化通过，再次执行没有待执行迁移或种子。构建产物的真实浏览器登录冒烟通过，截图在本云环境 `/workspace/setup/factory-validation/browser-smoke.png`。这不是定责业务验收。
- 远端应用基线：`apps/dingze`，提交 `f4e6f328e9ff03aac03cca3aabc99bdccfa5e7da`。
- 接入PR：https://github.com/klinsmaya/dingze-portal/pull/3 。原main仍保留提交 `9cce303cb38b98114edb3700166ca6e005617b61`，尚未启用主分支工厂流程。
- 远端Actions尚无本次Run记录，不能声称远端CI或模型调用已通过；Actions设置和模型凭据存在性仍待核实（相关配置API返回403）。
- actionlint 1.7.12尚不识别GitHub官方已支持的`concurrency.queue`；该字段保留，16处队列值/互斥约束已单独验证，其他工作流字段检查通过。依据：https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax 。
