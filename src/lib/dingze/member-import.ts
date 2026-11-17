import { USERNAME, tableLines } from "./camp-import";
import type { ImportTemplate } from "./import-templates";

// 批量开通成员账号（2026-11 测试反馈）：和别的导入一样，从 Excel 复制或上传模板，先预览再开通。
// 开通的都是企业成员；进哪个项目、什么角色、哪个部门，开通后在项目成员里设。

export const MEMBER_TEMPLATE: ImportTemplate = {
  fileName: "成员账号模板.xlsx",
  headers: ["姓名", "登录名", "手机", "邮箱"],
  examples: [
    ["赵部长", "hc_zhao", "13800000002", ""],
    ["李专员", "hc_li", "", "li@example.com"],
  ],
  notes: [
    "每行一个人，开通为企业成员账号，直接加入本企业。",
    "登录名只能用字母、数字和 _ . @ -，至少 3 位；手机和邮箱可以空，填了就不能和别的账号重复。",
    "一次最多 100 行。初始密码只显示一次，请下载账号清单后发给本人。",
  ],
};

export const MEMBER_IMPORT_LIMIT = 100;

export type MemberRow = { nickname: string; username: string; phone?: string; email?: string };

/** `taken`：本企业已有的登录名，提前拦下（别的企业占用的登录名由服务端在开通时报出）。 */
export function parseMemberTable(text: string, taken: Iterable<string> = []): { rows: MemberRow[]; problems: string[] } {
  const rows: MemberRow[] = [];
  const problems: string[] = [];
  const existing = new Set([...taken].map((u) => u.toLowerCase()));
  const seen = { username: new Set<string>(), phone: new Set<string>(), email: new Set<string>() };
  tableLines(text, "姓名").forEach(([nickname = "", username = "", phone = "", email = ""], i) => {
    const at = `第 ${i + 1} 行`;
    if (i >= MEMBER_IMPORT_LIMIT) {
      if (i === MEMBER_IMPORT_LIMIT) problems.push(`一次最多 ${MEMBER_IMPORT_LIMIT} 行，后面的请分批开通`);
      return;
    }
    if (!nickname || !username) return void problems.push(`${at}缺姓名或登录名`);
    if (!USERNAME.test(username)) return void problems.push(`${at}登录名 ${username} 只能用字母、数字和 _ . @ -，至少 3 位`);
    const key = username.toLowerCase();
    if (existing.has(key)) return void problems.push(`${at}登录名 ${username} 本企业已有`);
    if (seen.username.has(key)) return void problems.push(`${at}登录名 ${username} 重复`);
    if (phone && seen.phone.has(phone)) return void problems.push(`${at}手机 ${phone} 重复`);
    if (email && seen.email.has(email.toLowerCase())) return void problems.push(`${at}邮箱 ${email} 重复`);
    seen.username.add(key);
    if (phone) seen.phone.add(phone);
    if (email) seen.email.add(email.toLowerCase());
    rows.push({ nickname, username, phone: phone || undefined, email: email || undefined });
  });
  return { rows, problems };
}
