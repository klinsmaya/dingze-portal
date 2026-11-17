import { describe, expect, it } from "vitest";

import { MEMBER_IMPORT_LIMIT, MEMBER_TEMPLATE, parseMemberTable } from "@/lib/dingze/member-import";

describe("批量开通成员账号：名单解析（企业批量开通和训练营批量发账号共用）", () => {
  it("reads 姓名 / 登录名 / 手机 / 邮箱 / 部门, skipping the template header and blank lines", () => {
    const text = [MEMBER_TEMPLATE.headers.join("\t"), "赵部长\thc_zhao\t13800000002\t\t市场营销部", "", " 李专员 \t hc_li \t\tli@example.com"].join("\n");
    expect(parseMemberTable(text)).toEqual({
      rows: [
        { nickname: "赵部长", username: "hc_zhao", phone: "13800000002", email: undefined, dept: "市场营销部" },
        { nickname: "李专员", username: "hc_li", phone: undefined, email: "li@example.com", dept: undefined },
      ],
      problems: [],
    });
  });

  it("holds back rows that would fail, and says which", () => {
    const text = ["张三\t", "李四\t李四", "王五\thc_wang\t138", "赵六\tHC_WANG", "钱七\thc_qian\t138"].join("\n");
    const { rows, problems } = parseMemberTable(text);
    expect(rows.map((r) => r.username)).toEqual(["hc_wang"]);
    expect(problems).toEqual(["第 1 行缺姓名或登录名", "第 2 行登录名 李四 只能用字母、数字和 _ . @ -，至少 3 位", "第 4 行登录名 HC_WANG 重复", "第 5 行手机 138 重复"]);
  });

  it("reads the old camp template: the 项目角色 column is ignored and the department comes after it", () => {
    const text = "姓名\t登录名\t手机\t邮箱\t项目角色\t部门\n赵部长\thc_zhao\t\t\t部门负责人\t市场营销部\n李专员\thc_li\t\t\t\t";
    const { rows, problems } = parseMemberTable(text);
    expect(rows.map((r) => [r.username, r.dept])).toEqual([
      ["hc_zhao", "市场营销部"],
      ["hc_li", undefined],
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("项目角色");
  });

  it("caps one batch", () => {
    const text = Array.from({ length: MEMBER_IMPORT_LIMIT + 3 }, (_, i) => `成员${i}\tuser_${i}`).join("\n");
    const { rows, problems } = parseMemberTable(text);
    expect(rows).toHaveLength(MEMBER_IMPORT_LIMIT);
    expect(problems).toEqual([`一次最多 ${MEMBER_IMPORT_LIMIT} 行，后面的请分批开通`]);
  });
});
