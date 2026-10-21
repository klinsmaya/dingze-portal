import { expect, test } from "@playwright/test";

import { PortalE2EApiError, type PortalE2ESession, loadPortalE2EEnvironment, portalAction, signInPortal } from "./support";

// Cross-enterprise isolation (spec 5.6 §4): an account of another enterprise must not read
// or write a project's artifacts, history, delivery data, exports or notifications.
// Requires DINGZE_E2E_* variables (see .env.e2e.example); skipped when they are absent.

const environment = loadPortalE2EEnvironment();
const env = (name: string) => process.env[name]?.trim() || undefined;
const projectId = Number(env("DINGZE_E2E_PROJECT_ID"));
const space = env("DINGZE_E2E_SPACE");
const member = { account: env("DINGZE_E2E_MEMBER_ACCOUNT"), password: env("DINGZE_E2E_MEMBER_PASSWORD") };
const outsider = { account: env("DINGZE_E2E_OUTSIDER_ACCOUNT"), password: env("DINGZE_E2E_OUTSIDER_PASSWORD") };
const configured = !!projectId && !!space && !!member.account && !!member.password && !!outsider.account && !!outsider.password;

test.describe("dingze cross-enterprise isolation", () => {
  test.skip(!configured, "DINGZE_E2E_* variables are not set");

  const signIn = (request: Parameters<typeof signInPortal>[0], who: { account?: string; password?: string }) =>
    signInPortal(request, environment, { account: who.account!, password: who.password!, authenticator: environment.authenticator });

  const status = async (run: () => Promise<unknown>) => {
    try {
      await run();
      return 200;
    } catch (error) {
      if (error instanceof PortalE2EApiError) return error.status;
      throw error;
    }
  };

  test("a project member reads the registry and delivery data", async ({ request }) => {
    const session = await signIn(request, member);
    const call = (action: string, query: Record<string, string | number> = {}) =>
      portalAction<unknown[]>(request, environment, "dingze", action, { method: "GET", session, query: { projectId, ...query }, headers: { "x-spaces": space! } });
    const registry = await call("artifactRegistry");
    expect(Array.isArray(registry) && registry.length).toBeGreaterThan(0);
    expect(await status(() => call("deliveryBundle"))).toBe(200);
  });

  test("another enterprise's account is refused everywhere", async ({ request }) => {
    const session: PortalE2ESession = await signIn(request, outsider);
    const own = await portalAction<{ spaces: { name: string }[] }>(request, environment, "spaces", "my", { method: "GET", session });
    const ownSpace = own.spaces[0]?.name;
    // With the target project's space header the multi-space layer refuses; with the
    // outsider's own space the plugin's project check does.
    for (const headers of [{ "x-spaces": space! }, ...(ownSpace ? [{ "x-spaces": ownSpace }] : [])]) {
      for (const [action, query] of [
        ["artifactRegistry", {}],
        ["artifactHistory", { code: "S1-01" }],
        ["versionDiff", { code: "S1-01", from: 1, to: 2 }],
        ["deliveryBundle", {}],
        ["artifactDetail", { code: "S1-01" }],
        ["projectOverview", {}],
      ] as const) {
        const code = await status(() => portalAction(request, environment, "dingze", action, { method: "GET", session, headers, query: { projectId, ...query } }));
        expect([403, 404], `${action} with ${headers["x-spaces"]}`).toContain(code);
      }
      const write = await status(() =>
        portalAction(request, environment, "dingze", "recordExport", { session, headers, body: { projectId, code: "S1-01", rev: 1, format: "xlsx", fileName: "x" } })
      );
      expect([403, 404]).toContain(write);
    }
    const inbox = await portalAction<{ items: { projectId: number }[] }>(request, environment, "dingze", "myNotifications", { method: "GET", session });
    expect(inbox.items.filter((n) => n.projectId === projectId)).toEqual([]);
    for (const collection of ["dz_artifacts", "dz_artifact_versions", "dz_notifications", "dz_exports"]) {
      const code = await status(() => portalAction(request, environment, collection, "list", { method: "GET", session, headers: { "x-spaces": space! } }));
      expect([403, 404], collection).toContain(code);
    }
  });
});
