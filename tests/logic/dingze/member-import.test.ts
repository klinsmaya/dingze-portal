import { describe, expect, it } from "vitest";

import { MEMBER_IMPORT_LIMIT, MEMBER_TEMPLATE, parseMemberTable } from "@/lib/dingze/member-import";

describe("批量开通成员账号：名单解析", () => {
  it("reads 姓名 / 登录名 / 手机 / 邮箱, skipping the template header and blank lines", () => {
    const text = [MEMBER_TEMPLATE.headers.join("\t"), "赵部长\thc_zhao\t13800000002\t", "", " 李专员 \t hc_li \t\tli@example.com"].join("\n");
    expect(parseMemberTable(text)).toEqual({
      rows: [
        { nickname: "赵部长", username: "hc_zhao", phone: "13800000002", email: undefined },
        { nickname: "李专员", username: "hc_li", phone: undefined, email: "li@example.com" },
      ],
      problems: [],
    });
  });

  it("holds back rows that would fail, and says which", () => {
    const text = ["张三\t", "李四\t李四", "王五\thc_wang\t138", "赵六\tHC_WANG", "钱七\thc_qian\t138", "孙八\thc_old"].join("\n");
    const { rows, problems } = parseMemberTable(text, ["HC_OLD"]);
    expect(rows.map((r) => r.username)).toEqual(["hc_wang"]);
    expect(problems).toEqual([
      "第 1 行缺姓名或登录名",
      "第 2 行登录名 李四 只能用字母、数字和 _ . @ -，至少 3 位",
      "第 4 行登录名 HC_WANG 重复",
      "第 5 行手机 138 重复",
      "第 6 行登录名 hc_old 本企业已有",
    ]);
  });

  it("caps one batch", () => {
    const text = Array.from({ length: MEMBER_IMPORT_LIMIT + 3 }, (_, i) => `成员${i}\tuser_${i}`).join("\n");
    const { rows, problems } = parseMemberTable(text);
    expect(rows).toHaveLength(MEMBER_IMPORT_LIMIT);
    expect(problems).toEqual([`一次最多 ${MEMBER_IMPORT_LIMIT} 行，后面的请分批开通`]);
  });
});
