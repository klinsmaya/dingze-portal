import { expect, it } from "vitest";

import { UNKNOWN_ERROR, errorMessage } from "@/lib/dingze/errors";

const http = (status: number, payload: unknown = null) => Object.assign(new Error(`NocoBase request failed (${status})`), { status, payload });

it("errorMessage prefers the server message, wrapped or not", () => {
  expect(errorMessage(http(404, { data: { errors: [{ message: "邀请码无效" }] } }))).toBe("邀请码无效");
  expect(errorMessage(http(403, { errors: [{ message: "没有权限" }] }))).toBe("没有权限");
});

it("maps HTTP status codes to plain Chinese", () => {
  expect(errorMessage(http(401))).toBe("登录已过期，请重新登录");
  expect(errorMessage(http(403))).toBe("你没有这个操作的权限");
  expect(errorMessage(http(404))).toBe("没找到要操作的内容，可能已被删除");
  expect(errorMessage(http(409))).toBe("有人先改了这里，刷新后再试");
  expect(errorMessage(http(503))).toBe("服务器出了点问题，稍后再试");
  // 只有消息里带状态码时也认
  expect(errorMessage(new Error("NocoBase request failed (429)"))).toBe("操作太频繁，稍等一下再试");
});

it("keeps our own Chinese reasons and hides English internals", () => {
  expect(errorMessage(new Error("上一张表还没定版"))).toBe("上一张表还没定版");
  expect(errorMessage(new Error("Network Error"))).toBe("网络不通，检查网络后重试");
  expect(errorMessage(new Error("Failed to fetch"))).toBe("网络不通，检查网络后重试");
  expect(errorMessage(new TypeError("Cannot read properties of undefined"))).toBe(UNKNOWN_ERROR);
  expect(errorMessage("x")).toBe(UNKNOWN_ERROR);
  expect(errorMessage(undefined)).toBe(UNKNOWN_ERROR);
});
