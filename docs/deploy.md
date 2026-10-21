# 发布与部署

平台由两部分组成，发布顺序固定：先插件，后门户，最后给角色开门户入口。

## 0. 分支、版本与发布流程

### 分支与 tag

| 分支 / tag | 用途 |
|---|---|
| `main` | 主线。准生产和生产只从 `main` 发布 |
| `claude/*` 等工作分支 | 一批修改一个分支，从 `main` 拉出；在 dev 验证通过后提 PR 合入 `main` |
| `v<插件版本>-rc.<n>` | 打在 `main` 上，对应一次准生产发布，如 `v0.32.2-rc.1`。只改门户不升插件版本时，`n` 加 1 |
| `v<插件版本>` | 正式生产发布 |
| `v<版本>-beta.<n>` | 阶段性快照（可选），如 `v0.31.0-beta.1` |

- 插件版本只在 `server-plugins/plugin-dingze/package.json` 里维护；改了插件就加 1，只改门户不升。
- 根目录 `package.json` 的版本是门户模板的版本，不随业务发布改动。
- `.github/workflows/publish.yml` 是门户模板发 npm 包用的（只能手动触发），本项目不用，不要运行。

### 一次升级

1. **开发**：从 `main` 拉工作分支修改。改插件的同时把插件版本号加 1。
2. **自检**（全部通过才往下）：

   ```bash
   npx tsc --noEmit && npx eslint src --quiet && npx vitest run tests/logic tests/components
   ```

   改了插件还要做插件类型检查（`HANDOFF.md` 第 4 节）；改了关键流程，更新并运行 `e2e/` 下对应用例。
3. **发 dev**：先插件（第 1 节，`NOCOBASE_API_URL=https://ziqu-dev.aihupo.cn/api`），后门户（`nb portal deploy dingze`，默认环境就是 `ziqu-dev`）。在 dev 上自测；需要时请甲方在 dev 验证。
4. **记录**：在[更新记录](changelog.md)写清改了什么、试用者要注意什么；试用期间同步更新《试用意见登记表》的“状态 / 修复版本”。
5. **合入主线**：提 PR 合入 `main`。PR 描述写插件版本、门户改动、要不要数据迁移。
6. **打 tag**：在合并后的 `main` 提交上打 `v<插件版本>-rc.<n>`。
7. **发准生产**（按[准生产发布](preprod.md)）：
   1. 备份准生产的数据库和上传文件；
   2. 插件：`NOCOBASE_API_URL=https://ziqu.aihupo.cn/api`，令牌用准生产管理员令牌；
   3. 门户：`NODE_USE_ENV_PROXY=1 nb portal deploy dingze -e ziqu-preprod -y`；
   4. 发完把 `.env.local` 改回 dev 地址（`NOCOBASE_API_URL=https://ziqu-dev.aihupo.cn/api`）。
8. **发布后验证**：按 `preprod.md` 第 3 节逐项检查，并在 `preprod.md` 记一笔发布记录（日期、版本、tag、验证结果）。
9. **回滚**：见 `preprod.md` 第 4 节。门户回到上一个 tag 重新部署；插件装回上一版。做过数据合并的版本，回滚前先恢复备份。

### 数据与平台升级

- 准生产的数据按真实数据对待。演示数据的快照导入（`importSnapshot`）只能用在空库上，不能重复导入。
- 插件改了数据结构或要改已有数据，写成插件的升级迁移（`server/upgrade/`），在 dev 上先跑通，再随插件发准生产。
- 升级 NocoBase 本身：dev 先升、跑一遍第 4 节和 `preprod.md` 第 3 节的检查，通过后再升准生产。构建插件用的 NocoBase 源码（`NOCOBASE_SRC`）也换成同一版本。
- 门户模板上游有更新时，单开一个分支合并，按 `AGENTS.md` 的要求对比后选择性合入，不要直接覆盖本项目改过的文件。

## 1. 定责业务插件 `@ziqu/plugin-dingze`

源码在 `server-plugins/plugin-dingze`。改动后先在 `package.json` 里提升版本号，再执行：

```bash
NOCOBASE_SRC=<与服务器同版本的 NocoBase 源码目录> \
NOCOBASE_API_URL=https://<host>/api \
NOCOBASE_TOKEN=<管理员 API 令牌> \
server-plugins/scripts/deploy-dingze.sh
```

脚本会构建插件包、安装或更新插件，并轮询到新版本启用为止。首次启用时插件会创建 5 个系统角色：`dz_consult_admin`、`dz_consultant`、`dz_ent_admin`、`dz_ent_member`、`dz_ops`。

## 2. AI 门户 `dingze`

门户的开发目录就是本仓库。首次在一个环境上发布：

```bash
nb portal create dingze --template <本仓库路径> --title "自驱战略 · 定三责" --path <任意空目录>
nb portal config dingze --path <本仓库路径>
nb portal deploy dingze
nb portal info dingze -j   # 读回：developmentPath 应为本仓库
```

之后每次发布只需 `nb portal deploy dingze`（构建当前代码并上传 `dist`，不会推送源码）。

- 部署会把本次环境的 API 地址写进 `.env` / `.env.local`（均已忽略，不提交）。
- 经代理访问服务器的环境里，Node 自带的 `fetch` 默认不走代理，上传 `dist` 会被中断；这时用 `NODE_USE_ENV_PROXY=1 nb portal deploy dingze`。

## 3. 角色的门户入口

新门户默认没有任何角色可以进入（登录后显示“无权访问此门户”）。给 5 个定责角色开入口，只影响 `dingze`，不改动其他门户：

```bash
for r in dz_consult_admin dz_consultant dz_ent_admin dz_ent_member dz_ops; do
  nb api acl roles multi-portals add --role-name "$r" --body '["dingze"]' -j
  nb api acl roles multi-portals list --role-name "$r" -j   # 读回应包含 "dingze"
done
```

注意：在 2.4.0-alpha.9 上，`--values '["dingze"]'` 返回成功但不会写入，必须用 `--body` 传原始数组。

## 4. 发布后检查

1. 用咨询师账号登录 `https://<host>/x/dingze/`，应进入“咨询师工作台”。
2. 用企业项目负责人账号登录，应进入“我的项目”，并能打开工作区与数字咨询师。
3. 用运营管理员账号登录，侧栏应有“运营管理”。

## 5. 邮件通知（可选）

站内通知随插件开箱可用。要同时发邮件，在 NocoBase 的“通知管理”里新建一个**邮件**类型的通道，名称必须是 `dingze-email`，填好 SMTP。插件发现这个通道后，每条站内通知会同时发到收件人账号上登记的邮箱，正文末尾附门户直达链接；没有这个通道时只发站内信，不报错。

## 6. 跨企业隔离 E2E

`e2e/dingze-isolation.spec.ts` 用一个项目成员和一个其他企业的账号，验证成果、历史、版本对比、交付数据、导出记录、通知和底层数据表都不能跨企业访问。变量见 `.env.e2e.example` 里的 `DINGZE_E2E_*`，复制到 `.env.e2e` 后执行：

```bash
pnpm exec playwright test e2e/dingze-isolation.spec.ts
```
