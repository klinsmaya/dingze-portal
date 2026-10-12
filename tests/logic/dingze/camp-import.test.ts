import { describe, expect, it } from "vitest";

import { parseAccountTable, parseEnterpriseTable, toCsv } from "@/lib/dingze/camp-import";

describe("parseEnterpriseTable", () => {
  it("skips the template header and reads size", () => {
    const { rows, problems } = parseEnterpriseTable(
      "企业全称\t简称\t规模\t管理员姓名\t管理员登录名\t管理员手机\n瀚川能源集团\t瀚川\t大型企业\t钱总\thc_qian\t138\n启衡精密\t启衡\t\t孙总\tqh_sun\t",
    );
    expect(problems).toEqual([]);
    expect(rows.map((r) => [r.shortName, r.size, r.adminUsername, r.adminPhone])).toEqual([
      ["瀚川", "large", "hc_qian", "138"],
      ["启衡", "sme", "qh_sun", undefined],
    ]);
  });

  it("reports missing admins, bad and duplicate login names", () => {
    const { rows, problems } = parseEnterpriseTable("甲公司\t甲\t\t\t\nA\tA\t\t张\tx y\nB\tB\t\t王\tdup_1\nC\tC\t\t李\tdup_1");
    expect(rows).toHaveLength(1);
    expect(problems).toHaveLength(3);
    expect(problems[2]).toContain("重复");
  });
});

describe("parseAccountTable", () => {
  it("maps role labels and defaults to 项目成员", () => {
    const { rows, problems } = parseAccountTable("姓名\t登录名\t手机\t邮箱\t项目角色\t部门\n赵部长\thc_zhao\t\t\t部门负责人\t市场营销部\n李专员\thc_li\t\t\t\t\n钱\thc_q\t\t\t只读\t");
    expect(problems).toEqual([]);
    expect(rows.map((r) => [r.username, r.role, r.dept])).toEqual([
      ["hc_zhao", "dept_head", "市场营销部"],
      ["hc_li", "member", undefined],
      ["hc_q", "readonly", undefined],
    ]);
  });

  it("rejects consultant roles and unknown labels", () => {
    const { rows, problems } = parseAccountTable("甲\tjia_1\t\t\t主咨询师\t\n乙\tyi_1\t\t\t老板\t");
    expect(rows).toEqual([]);
    expect(problems).toHaveLength(2);
  });
});

it("toCsv quotes commas and quotes", () => {
  expect(toCsv([["a,b", 'c"d', 1]])).toBe('﻿"a,b","c""d",1');
});
