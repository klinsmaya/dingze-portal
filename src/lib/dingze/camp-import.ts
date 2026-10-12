import { PROJECT_ROLE_LABELS, type ProjectRole } from "@dingze/shared";

import type { ImportTemplate } from "./import-templates";

// 训练营批次的两张导入表：批量加企业、批量发账号。和组织表一样，解析器只看制表符分隔的文本
// （从 Excel 复制或上传模板），先预览再提交。

export const ENTERPRISE_TEMPLATE: ImportTemplate = {
  fileName: "训练营企业名单模板.xlsx",
  headers: ["企业全称", "简称", "规模", "管理员姓名", "管理员登录名", "管理员手机"],
  examples: [
    ["瀚川能源集团有限公司", "瀚川能源", "大型企业", "钱总", "hc_qian", "13800000001"],
    ["启衡精密制造有限公司", "启衡精密", "中小企业", "孙总", "qh_sun", ""],
  ],
  notes: [
    "每行一家企业：会建立企业的独立空间、开通企业管理员账号，并建好本期训练营项目。",
    "规模填 中小企业 / 大型企业，不填按中小企业。",
    "登录名只能用字母、数字和 _ . @ -，至少 3 位；手机可以空。",
    "管理员同时是项目里的企业项目负责人；初始密码只显示一次，请下载账号清单后发给本人。",
  ],
};

export const ACCOUNT_TEMPLATE: ImportTemplate = {
  fileName: "项目成员账号模板.xlsx",
  headers: ["姓名", "登录名", "手机", "邮箱", "项目角色", "部门"],
  examples: [
    ["赵部长", "hc_zhao", "13800000002", "", "部门负责人", "市场营销部"],
    ["李专员", "hc_li", "", "", "项目成员", "市场营销部"],
  ],
  notes: [
    "每行一个人：登录名已存在时只把这个账号加进项目，不新开账号。",
    "项目角色填 企业项目负责人 / 部门负责人 / 项目成员 / 只读成员，不填按项目成员。",
    "部门要和这家企业组织表里的名称一致，可以空；可以先在企业页导入组织表。",
    "初始密码只显示一次，请下载账号清单后发给本人。",
  ],
};

export type EnterpriseRow = { name: string; shortName: string; size: "large" | "sme"; adminNickname: string; adminUsername: string; adminPhone?: string };
export type AccountRow = { nickname: string; username: string; phone?: string; email?: string; role: ProjectRole; dept?: string };

const USERNAME = /^[A-Za-z0-9_.@-]{3,50}$/;
const ENTERPRISE_ROLES: ProjectRole[] = ["ent_lead", "dept_head", "member", "readonly"];

function lines(text: string, header: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((cells) => cells.some(Boolean))
    .filter((cells) => cells[0] !== header);
}

export function parseEnterpriseTable(text: string): { rows: EnterpriseRow[]; problems: string[] } {
  const rows: EnterpriseRow[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  lines(text, "企业全称").forEach(([name = "", shortName = "", size = "", adminNickname = "", adminUsername = "", adminPhone = ""], i) => {
    const at = `第 ${i + 1} 行`;
    if (!name || !shortName) return void problems.push(`${at}缺企业全称或简称`);
    if (shortName.length > 20) return void problems.push(`${at}简称超过 20 个字`);
    if (!adminNickname || !adminUsername) return void problems.push(`${at}缺管理员姓名或登录名`);
    if (!USERNAME.test(adminUsername)) return void problems.push(`${at}登录名 ${adminUsername} 只能用字母、数字和 _ . @ -，至少 3 位`);
    if (seen.has(adminUsername)) return void problems.push(`${at}登录名 ${adminUsername} 重复`);
    seen.add(adminUsername);
    rows.push({ name, shortName, size: size.includes("大") || size === "large" ? "large" : "sme", adminNickname, adminUsername, adminPhone: adminPhone || undefined });
  });
  return { rows, problems };
}

function roleOf(value: string): ProjectRole | null {
  if (!value) return "member";
  if ((ENTERPRISE_ROLES as string[]).includes(value)) return value as ProjectRole;
  const found = ENTERPRISE_ROLES.find((r) => PROJECT_ROLE_LABELS[r] === value || PROJECT_ROLE_LABELS[r].startsWith(value));
  return found ?? null;
}

export function parseAccountTable(text: string): { rows: AccountRow[]; problems: string[] } {
  const rows: AccountRow[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  lines(text, "姓名").forEach(([nickname = "", username = "", phone = "", email = "", role = "", dept = ""], i) => {
    const at = `第 ${i + 1} 行`;
    if (!nickname || !username) return void problems.push(`${at}缺姓名或登录名`);
    if (!USERNAME.test(username)) return void problems.push(`${at}登录名 ${username} 只能用字母、数字和 _ . @ -，至少 3 位`);
    if (seen.has(username)) return void problems.push(`${at}登录名 ${username} 重复`);
    const projectRole = roleOf(role);
    if (!projectRole) return void problems.push(`${at}项目角色“${role}”不认识`);
    seen.add(username);
    rows.push({ nickname, username, phone: phone || undefined, email: email || undefined, role: projectRole, dept: dept || undefined });
  });
  return { rows, problems };
}

/** CSV with a BOM so Excel opens Chinese correctly. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(fileName: string, rows: (string | number | null | undefined)[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
