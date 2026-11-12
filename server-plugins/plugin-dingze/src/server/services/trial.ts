import { randomBytes } from 'node:crypto';

import type { Context } from '@nocobase/actions';

import { HttpError, SYSTEM_ROLES } from './access';
import { ip, limit } from './invites';
import { notify } from './notify';

// 公开试用注册（2026-11 甲方反馈：试用版要打通客户全流程，客户自己注册就能用）。
// 一次提交开好：企业空间 + 试用企业（trial）+ 企业管理员账号（手机号作登录名，密码由本人设）
// + 一个自助项目（企业内训 · 自助，本人为企业项目负责人）。运营和咨询管理员自动加入该空间，
// 在“企业与开通”里能看到、停用，或改成陪跑并分派咨询师。逐表解锁、定版门禁、空间隔离都不变。

const PHONE = /^1\d{10}$/;

export interface TrialInput {
  enterpriseName?: unknown;
  nickname?: unknown;
  phone?: unknown;
  password?: unknown;
  /** 勾选“试用期用脱敏资料，资料和对话会发往大模型服务”。 */
  agree?: unknown;
  /** 蜜罐字段：页面上隐藏，人不会填。 */
  website?: unknown;
}

export function checkTrialInput(input: TrialInput) {
  if (input.website) throw new HttpError(400, '提交内容不正确');
  const enterpriseName = String(input.enterpriseName ?? '').trim();
  const nickname = String(input.nickname ?? '').trim();
  const phone = String(input.phone ?? '').trim();
  const password = String(input.password ?? '');
  if (enterpriseName.length < 2 || enterpriseName.length > 60) throw new HttpError(400, '请填写企业名称（2～60 个字）');
  if (!nickname || nickname.length > 50) throw new HttpError(400, '请填写你的姓名');
  if (!PHONE.test(phone)) throw new HttpError(400, '请填写 11 位手机号');
  if (password.length < 8 || password.length > 64 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, '密码至少 8 位，并同时包含字母和数字');
  }
  if (input.agree !== true) throw new HttpError(400, '请先勾选同意试用说明');
  return { enterpriseName, nickname, phone, password };
}

export async function trialSignUp(ctx: Context, input: TrialInput) {
  // 同一出口 IP 每小时 5 个、全站每天 200 个，挡住脚本刷号。
  limit(`trial:${ip(ctx)}`, 5, 60 * 60_000);
  const { enterpriseName, nickname, phone, password } = checkTrialInput(input);
  limit('trial:all', 200, 24 * 60 * 60_000);

  const users = ctx.db.getRepository('users');
  if (await users.findOne({ filter: { $or: [{ username: phone }, { phone }] } })) {
    throw new HttpError(409, '这个手机号已经注册过，请直接登录', 'PHONE_TAKEN');
  }
  const staff = await users.find({
    filter: { 'roles.name': { $in: [SYSTEM_ROLES.ops, SYSTEM_ROLES.consultAdmin] } },
    fields: ['id'],
  });
  const staffIds = staff.map((u: any) => u.get('id') as number);
  const spaceName = `dz-${randomBytes(5).toString('hex')}`;
  const shortName = enterpriseName.slice(0, 20);
  const year = new Date().getFullYear();

  const created = await ctx.db.sequelize.transaction(async (transaction: any) => {
    await ctx.db.getRepository('spaces').create({ values: { name: spaceName, title: shortName }, transaction });
    const user = await users.create({
      values: { username: phone, nickname, phone, password, roles: [SYSTEM_ROLES.entAdmin] },
      // Password-policy and multi-space hooks on users read the request context.
      context: ctx,
      transaction,
    });
    const userId = user.get('id') as number;
    const by = { createdById: userId, updatedById: userId };
    await ctx.db.getRepository('spaces.users', spaceName).add({ tk: [...new Set([userId, ...staffIds])], transaction });
    const enterprise = await ctx.db.getRepository('dz_enterprises').create({
      values: { name: enterpriseName, shortName, size: 'sme', status: 'active', trial: true, spaceName, ...by },
      transaction,
    });
    const project = await ctx.db.getRepository('dz_projects').create({
      values: {
        enterpriseId: enterprise.get('id'),
        name: `${year} 年度战略落地`,
        year,
        scene: 'inhouse',
        service: 'self',
        primaryExpression: 'sixfold',
        keyProjectLevel: 2,
        scheduleScale: 'month',
        spaceName,
        ...by,
      },
      transaction,
    });
    await ctx.db.getRepository('dz_project_members').create({
      values: { projectId: project.get('id'), userId, projectRole: 'ent_lead', spaceName, ...by },
      transaction,
    });
    await ctx.db.getRepository('dz_audit_events').create({
      values: {
        action: 'trial.signup',
        meta: { enterpriseId: enterprise.get('id'), projectId: project.get('id'), userId, actorId: userId },
        spaceName,
        ...by,
      },
      transaction,
    });
    return { enterpriseId: enterprise.get('id') as number, projectId: project.get('id') as number };
  });

  await notify(ctx, {
    projectId: created.projectId,
    spaceName,
    userIds: staffIds,
    kind: 'registration',
    title: `新试用企业：${enterpriseName}`,
    content: `${nickname} · ${phone.slice(0, 3)}****${phone.slice(-4)} 自助注册试用，已开好自助项目`,
    link: `/ops/enterprises/${created.enterpriseId}`,
  }).catch((error: any) => ctx.app.logger.warn(`dingze trial notify failed: ${error?.message ?? error}`));

  return { username: phone, projectId: created.projectId };
}
