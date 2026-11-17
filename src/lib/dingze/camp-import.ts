import type { ImportTemplate } from "./import-templates";

// 训练营批次的导入表：批量加企业（批量发账号用成员名单模板，见 member-import.ts）。和组织表一样，
// 解析器只看制表符分隔的文本（从 Excel 复制或上传模板），先预览再提交。

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

export type EnterpriseRow = { name: string; shortName: string; size: "large" | "sme"; adminNickname: string; adminUsername: string; adminPhone?: string };

export const USERNAME = /^[A-Za-z0-9_.@-]{3,50}$/;

/** Pasted rows as trimmed cells; blank lines and the template's header row are dropped. */
export function tableLines(text: string, header: string): string[][] {
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
  tableLines(text, "企业全称").forEach(([name = "", shortName = "", size = "", adminNickname = "", adminUsername = "", adminPhone = ""], i) => {
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
