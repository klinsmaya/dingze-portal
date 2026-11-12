// 登录页的两个身份页签（企业 / 咨询师）与账号实际身份的校验（测试反馈 6）：选了「企业」却用咨询团队账号
// 登录（或反过来）时拦下来，让用户回到对的页签，而不是悄悄放进去。

export type LoginSide = "enterprise" | "consultant";

const SIDE_ROLES: Record<LoginSide, readonly string[]> = {
  enterprise: ["dz_ent_admin", "dz_ent_member"],
  // 系统管理员（root / admin）不属于任何一边，从哪个页签登录都不拦。
  consultant: ["dz_consultant", "dz_consult_admin", "dz_ops"],
};

export const LOGIN_SIDE_LABELS: Record<LoginSide, string> = { enterprise: "企业", consultant: "咨询师" };

/**
 * The side the account belongs to when it is not the chosen one; null when the choice is fine.
 * An account on both sides, or with no 定责 role at all, is never blocked.
 */
export function loginSideMismatch(chosen: LoginSide, roles: readonly string[]): LoginSide | null {
  const on = (side: LoginSide) => roles.some((r) => SIDE_ROLES[side].includes(r));
  if (on(chosen)) return null;
  const other: LoginSide = chosen === "enterprise" ? "consultant" : "enterprise";
  return on(other) ? other : null;
}

const SIDE_KEY = "dingze:login-side";
const PENDING_KEY = "dingze:login-side-check";
const MISMATCH_KEY = "dingze:login-side-mismatch";
/** 提交登录后多久内的那次登录算“这次选的身份”；超时的不再校验（比如中途改用了别的登录方式）。 */
const PENDING_MS = 2 * 60_000;

const isSide = (value: unknown): value is LoginSide => value === "enterprise" || value === "consultant";

export function storedLoginSide(): LoginSide {
  try {
    return localStorage.getItem(SIDE_KEY) === "consultant" ? "consultant" : "enterprise";
  } catch {
    return "enterprise";
  }
}

export function storeLoginSide(side: LoginSide) {
  try {
    localStorage.setItem(SIDE_KEY, side);
  } catch {
    // 记不住也不影响登录
  }
}

/** Called when the sign-in form is submitted: the side to check once the account is known. */
export function markLoginAttempt(side: LoginSide) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ side, at: Date.now() }));
  } catch {
    // 存不了就不校验
  }
}

/** The side chosen for the sign-in that just happened, if any (cleared with clearLoginAttempt once checked). */
export function readLoginAttempt(now = Date.now()): LoginSide | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    const value = raw ? (JSON.parse(raw) as { side?: unknown; at?: unknown }) : null;
    if (!value || !isSide(value.side) || typeof value.at !== "number" || now - value.at > PENDING_MS) return null;
    return value.side;
  } catch {
    return null;
  }
}

export function clearLoginAttempt() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // 无妨
  }
}

/** Remember, across the sign-out, which tab the blocked account belongs to. */
export function rememberLoginMismatch(actual: LoginSide) {
  try {
    sessionStorage.setItem(MISMATCH_KEY, actual);
  } catch {
    // 提示显示不了时，用户仍会回到登录页
  }
}

export function readLoginMismatch(): LoginSide | null {
  try {
    const value = sessionStorage.getItem(MISMATCH_KEY);
    return isSide(value) ? value : null;
  } catch {
    return null;
  }
}

/** The login page has shown the notice: do not show it again on the next visit. */
export function clearLoginMismatch() {
  try {
    sessionStorage.removeItem(MISMATCH_KEY);
  } catch {
    // 无妨
  }
}
