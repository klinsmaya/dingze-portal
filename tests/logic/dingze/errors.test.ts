import { expect, it } from "vitest";

import { errorMessage } from "@/lib/dingze/errors";

it("errorMessage prefers the server message, wrapped or not", () => {
  const http = (payload: unknown) => Object.assign(new Error("NocoBase request failed (404)"), { payload });
  expect(errorMessage(http({ data: { errors: [{ message: "邀请码无效" }] } }))).toBe("邀请码无效");
  expect(errorMessage(http({ errors: [{ message: "没有权限" }] }))).toBe("没有权限");
  expect(errorMessage(http(null))).toBe("NocoBase request failed (404)");
  expect(errorMessage("x")).toBe("操作失败，请稍后重试");
});
