import { beforeEach, describe, expect, it } from "vitest";

import { clearLoginAttempt, clearLoginMismatch, loginSideMismatch, markLoginAttempt, readLoginAttempt, readLoginMismatch, rememberLoginMismatch } from "@/lib/dingze/login-side";

// 测试反馈 6：登录页选的身份（企业 / 咨询师）和账号实际身份不一致时要拦下来。
describe("loginSideMismatch", () => {
  it("lets an account in through its own tab", () => {
    expect(loginSideMismatch("enterprise", ["dz_ent_admin"])).toBeNull();
    expect(loginSideMismatch("enterprise", ["dz_ent_member"])).toBeNull();
    expect(loginSideMismatch("consultant", ["dz_consultant"])).toBeNull();
    expect(loginSideMismatch("consultant", ["dz_consult_admin"])).toBeNull();
    expect(loginSideMismatch("consultant", ["dz_ops"])).toBeNull();
  });

  it("blocks an account that used the other tab, and says which tab is right", () => {
    expect(loginSideMismatch("enterprise", ["dz_consultant"])).toBe("consultant");
    expect(loginSideMismatch("enterprise", ["dz_ops"])).toBe("consultant");
    expect(loginSideMismatch("consultant", ["dz_ent_admin"])).toBe("enterprise");
    expect(loginSideMismatch("consultant", ["dz_ent_member"])).toBe("enterprise");
  });

  it("never blocks an account on both sides, or one without a 定责 role", () => {
    expect(loginSideMismatch("enterprise", ["dz_ent_admin", "dz_consultant"])).toBeNull();
    expect(loginSideMismatch("consultant", ["dz_ent_admin", "dz_consultant"])).toBeNull();
    expect(loginSideMismatch("enterprise", [])).toBeNull();
    expect(loginSideMismatch("consultant", ["member"])).toBeNull();
    expect(loginSideMismatch("enterprise", ["root"])).toBeNull();
  });
});

describe("login attempt", () => {
  beforeEach(() => sessionStorage.clear());

  it("is read back until it is cleared", () => {
    expect(readLoginAttempt()).toBeNull();
    markLoginAttempt("consultant");
    expect(readLoginAttempt()).toBe("consultant");
    expect(readLoginAttempt()).toBe("consultant");
    clearLoginAttempt();
    expect(readLoginAttempt()).toBeNull();
  });

  it("expires, so a later sign-in by another route is not checked against it", () => {
    markLoginAttempt("enterprise");
    expect(readLoginAttempt(Date.now() + 3 * 60_000)).toBeNull();
  });

  it("carries the right tab across the sign-out once", () => {
    rememberLoginMismatch("consultant");
    expect(readLoginMismatch()).toBe("consultant");
    clearLoginMismatch();
    expect(readLoginMismatch()).toBeNull();
  });
});
