import type { ProjectOrgUnit } from "./api";

// 示例项目（2026-11 甲方反馈：两家演示企业只是案例，放进流程里当示例对照着看）。
// 内容直接取演示数据种子里的瀚川燃气 2026（虚构企业），只读展示，不连后端、不进任何企业空间。
// 这里只放轻量的元信息，表的内容在示例页里按需加载（sample-data.ts）。

// 部门和负责人（虚构，与演示数据一致：市场营销部赵部长、燃气运营部王经理、工程建设部孙工）。
const DEPARTMENTS: [string, string][] = [
  ["战略发展部", "钟部长"], ["市场营销部", "赵部长"], ["燃气运营部", "王经理"], ["工程建设部", "孙工"], ["安全质量部", "冯部长"],
  ["综合能源事业部", "韩总"], ["财务部", "周总监"], ["人力资源部", "唐部长"], ["信息中心", "许主任"],
];
const COMPANY_ID = 100;

export const SAMPLE = {
  enterprise: "瀚川燃气有限公司",
  shortName: "瀚川燃气",
  project: "2026 年度战略落地",
  year: 2026,
  keyProjectLevel: 2 as const,
  scheduleScale: "month" as const,
};

export const SAMPLE_ORG_UNITS: ProjectOrgUnit[] = [
  { id: COMPANY_ID, name: SAMPLE.enterprise, kind: "company", parentId: null, headId: null, headName: "张总", sort: 0 },
  ...DEPARTMENTS.map(([name, headName], i): ProjectOrgUnit => ({ id: i + 1, name, kind: "department", parentId: COMPANY_ID, headId: null, headName, sort: i + 1 })),
  { id: 20, name: "调度中心", kind: "team", parentId: 3, headId: null, headName: null, sort: 20 },
];

/** Tables the sample has, in book order (S1-04 IPOOC and S1-05 are not in the sample). */
export const SAMPLE_CODES = [
  "S1-01", "S1-02", "S1-03", "S1-06", "S1-07",
  "S2-03", "S2-01", "S2-08", "S2-04", "S2-05", "S2-06", "S2-07",
  "S3-02", "S3-05", "S3-06", "S3-07", "S3-08",
];

export function hasSample(code: string): boolean {
  return SAMPLE_CODES.includes(code);
}

export function samplePath(): "/sample";
export function samplePath(code: string): string;
export function samplePath(code?: string) {
  return code ? `/sample/${encodeURIComponent(code)}` : "/sample";
}
