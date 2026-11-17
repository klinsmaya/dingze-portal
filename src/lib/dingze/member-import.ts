import { USERNAME, tableLines } from "./camp-import";
import type { ImportTemplate } from "./import-templates";

// 批量开通成员账号：一份名单模板，企业里的“批量开通”和训练营的“批量发账号”共用（2026-11-17 合一）。
// 和别的导入一样，从 Excel 复制或上传模板，先预览再开通。开通的都是企业成员，加进选中的项目时一律是项目成员。

export const MEMBER_TEMPLATE: ImportTemplate = {
  fileName: "成员账号模板.xlsx",
  headers: ["姓名", "登录名", "手机", "邮箱", "部门"],
  examples: [
    ["赵部长", "hc_zhao", "13800000002", "", "市场营销部"],
    ["李专员", "hc_li", "", "li@example.com", ""],
  ],
  notes: [
    "每行一个人，开通为企业成员账号，直接加入本企业；开通时选了项目的，同时加进项目（项目成员）。",
    "登录名已经是本企业的账号时不新开，只把这个账号加进选中的项目。",
    "登录名只能用字母、数字和 _ . @ -，至少 3 位；手机和邮箱可以空，填了就不能和别的账号重复。",
    "部门要和组织里的名称一致，可以空；对不上的那一行会失败，其他行照常开通。",
    "一次最多 100 行。初始密码只显示一次，请下载账号清单后发给本人；本人第一次登录要先改密码。",
  ],
};

export const MEMBER_IMPORT_LIMIT = 100;

export type MemberRow = { nickname: string; username: string; phone?: string; email?: string; dept?: string };

/**
 * 名单的列：姓名 / 登录名 / 手机 / 邮箱 / 部门。旧的训练营模板在邮箱后面多一列“项目角色”
 * （带着表头粘贴时认得出来）：这一列不再使用，部门取它后面那一列。
 */
export function parseMemberTable(text: string): { rows: MemberRow[]; problems: string[] } {
  const rows: MemberRow[] = [];
  const problems: string[] = [];
  const legacy = text.split(/\r?\n/).some((line) => line.split("\t").map((c) => c.trim())[4] === "项目角色");
  if (legacy) problems.push("这是旧模板：“项目角色”一列不再使用，进项目一律是项目成员，负责人在项目成员里换");
  const seen = { username: new Set<string>(), phone: new Set<string>(), email: new Set<string>() };
  tableLines(text, "姓名").forEach((cells, i) => {
    const [nickname = "", username = "", phone = "", email = ""] = cells;
    const dept = (legacy ? cells[5] : cells[4]) ?? "";
    const at = `第 ${i + 1} 行`;
    if (i >= MEMBER_IMPORT_LIMIT) {
      if (i === MEMBER_IMPORT_LIMIT) problems.push(`一次最多 ${MEMBER_IMPORT_LIMIT} 行，后面的请分批开通`);
      return;
    }
    if (!nickname || !username) return void problems.push(`${at}缺姓名或登录名`);
    if (!USERNAME.test(username)) return void problems.push(`${at}登录名 ${username} 只能用字母、数字和 _ . @ -，至少 3 位`);
    const key = username.toLowerCase();
    if (seen.username.has(key)) return void problems.push(`${at}登录名 ${username} 重复`);
    if (phone && seen.phone.has(phone)) return void problems.push(`${at}手机 ${phone} 重复`);
    if (email && seen.email.has(email.toLowerCase())) return void problems.push(`${at}邮箱 ${email} 重复`);
    seen.username.add(key);
    if (phone) seen.phone.add(phone);
    if (email) seen.email.add(email.toLowerCase());
    rows.push({ nickname, username, phone: phone || undefined, email: email || undefined, dept: dept || undefined });
  });
  return { rows, problems };
}
