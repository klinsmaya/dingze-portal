# 演示数据种子

在测试环境生成两家虚构企业、三个项目的演示数据（内容与状态见 `docs/demo-accounts.md`）。全部经正式的 `dingze` 接口按角色流转完成（保存、本步完成、提交复核、复核、退回、重开、定版），不直接写库。可重复执行：已经是目标状态和内容的表会跳过。

| 文件 | 作用 |
|---|---|
| `api.mjs` | 登录与调用接口；密码从 `$DINGZE_SECRETS_DIR/<账号>.pw` 读，管理员令牌从 `$NOCOBASE_TOKEN` 读 |
| `setup.mjs` | 企业改名、部门、补建账号（关主任 / 周总监 / 孙经理 / 何总监）、项目 3、项目成员；生成的 id 写到 `$DINGZE_SECRETS_DIR/demo-ids.json` |
| `hanchuan.ts` / `qiheng.ts` | 瀚川燃气 2026、启衡能源 2027 各表的内容 |
| `check.ts` | 本地用共享校验规则预检内容（不联网） |
| `seed.ts` | 按角色把三个项目推到目标状态，并写入批注 |
| `status.mjs` | 读回某个项目各表状态 |
| `startup.mjs` | 项目启动所需：部门负责人、成员归部门、每个项目三份资料和已复核 / 确认的画像 |

```bash
export DINGZE_SECRETS_DIR=~/.dingze-secrets   # 私有目录，chmod 700；放 dz_*.pw，不要放进仓库
export NOCOBASE_TOKEN=...                      # 管理员令牌（建咨询管理员账号要用）
ESB=node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild
cd server-plugins/scripts/demo-seed
node setup.mjs
$ESB check.ts --bundle --platform=node --format=esm --outfile=/tmp/dz-check.mjs && node /tmp/dz-check.mjs
$ESB seed.ts  --bundle --platform=node --format=esm --outfile=/tmp/dz-seed.mjs  && node /tmp/dz-seed.mjs     # 或 node /tmp/dz-seed.mjs 1|2|3 只跑一个项目
node startup.mjs
node status.mjs 1 dz-017728e2ab dz_zhang
```

`check.ts` 里启衡能源的 S2-03、S2-04 报错是有意的：它们演示“推不回来”和“缺 A”的进行中状态。
