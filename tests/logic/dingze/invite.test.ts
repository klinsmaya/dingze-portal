import { expect, it } from "vitest";

import { passwordProblem } from "@/lib/dingze/invite-api";

it("passwordProblem follows the server rule: 8–64 chars with letters and digits", () => {
  expect(passwordProblem("abc12")).toBe("至少 8 位");
  expect(passwordProblem("abcdefgh")).toBe("要同时包含字母和数字");
  expect(passwordProblem("12345678")).toBe("要同时包含字母和数字");
  expect(passwordProblem("abcd1234")).toBeNull();
  expect(passwordProblem("a1".repeat(33))).toBe("不能超过 64 位");
});
