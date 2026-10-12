// 导入模板 (闭环)：every paste-import offers an Excel template to download, and takes the filled
// xlsx back directly; the parsers only ever see tab-separated text, as if pasted from Excel.

export type ImportTemplate = {
  fileName: string;
  /** Header row; the parsers skip it. */
  headers: string[];
  examples: string[][];
  /** Shown on a second sheet “填写说明”. */
  notes: string[];
};

export const ORG_TEMPLATE: ImportTemplate = {
  fileName: "组织表模板.xlsx",
  headers: ["名称", "上级", "类型", "负责人", "职责"],
  examples: [
    ["市场营销部", "", "部门", "赵部长", "工商业与居民用户开发、客户服务、价格管理"],
    ["大客户组", "市场营销部", "团队", "", "重点工业用户维护"],
  ],
  notes: [
    "每行一个部门或团队；“上级”写上级部门的名称，顶层留空。",
    "类型填 公司 / 部门 / 团队，不填按部门。",
    "负责人和系统账号同名时自动关联，否则只记姓名（无账号）。",
    "同名部门会更新上级、负责人和职责；表里没有的部门不会被删除。",
  ],
};

export const PATH_TEMPLATE: ImportTemplate = {
  fileName: "路径系统表模板.xlsx",
  headers: ["一级路径", "衡量指标", "指标值", "二级路径", "衡量指标", "指标值", "三级路径", "衡量指标", "指标值"],
  examples: [
    ["开发车用天然气新客户", "新增售气量", "700万方", "吸引车用天然气加气客户", "新增售气量", "500万方", "拓展车用天然气加气客户", "新增客户数量", "2000个"],
    ["", "", "", "争取公交车辆天然气用户", "新增售气量", "120万方", "", "", ""],
    ["开拓点供新业务", "新增售气量", "300万方", "发展个体工业用户", "新增售气量", "200万方", "", "", ""],
  ],
  notes: [
    "按表 3-10 的横排填写：每一级三列（路径、衡量指标、指标值），最多四级。",
    "合并单元格的地方留空：留空的格子表示沿用上一行的上级。",
    "导入时选择挂到哪个年度目标、哪个层面。",
  ],
};

export async function downloadTemplate(t: ImportTemplate) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([t.headers, ...t.examples]);
  sheet["!cols"] = t.headers.map((h) => ({ wch: Math.max(10, h.length * 3) }));
  XLSX.utils.book_append_sheet(book, sheet, "填写这里");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["填写说明"], ...t.notes.map((n) => [n])]), "填写说明");
  XLSX.writeFile(book, t.fileName);
}

/** The first sheet of an uploaded xlsx / xls / csv as tab-separated rows (header included). */
export async function readTableFile(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
  const first = book.Sheets[book.SheetNames[0]];
  if (!first) return "";
  const rows = XLSX.utils.sheet_to_json<unknown[]>(first, { header: 1, raw: false, defval: "", blankrows: false });
  return rows.map((row) => row.map((v) => String(v ?? "").replace(/\s*\n\s*/g, " ").trim()).join("\t")).join("\n");
}
