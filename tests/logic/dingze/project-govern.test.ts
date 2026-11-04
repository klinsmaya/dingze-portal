import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PROJECT_DELETE_ORDER,
  PROJECT_DETACH_COLLECTIONS,
  canGovernProject,
  governFacts,
} from "@dingze/shared";

const openSelf = {
  isOps: false,
  isEntAdmin: true,
  isMember: true,
  allowSelfProject: true,
  enterpriseStatus: "active",
  scene: "inhouse",
  service: "self",
};

describe("canGovernProject", () => {
  it("lets ops govern a project they can load", () => {
    const facts = governFacts({
      isOps: true,
      isEntAdmin: false,
      isMember: false,
      allowSelfProject: false,
      enterpriseStatus: "suspended",
      scene: "camp",
      service: "guided",
    });
    expect(canGovernProject(facts)).toBe(true);
  });

  it("lets an enterprise admin govern only their own active inhouse self project", () => {
    expect(canGovernProject(governFacts(openSelf))).toBe(true);
  });

  it("refuses a member who is not an enterprise admin", () => {
    expect(canGovernProject(governFacts({ ...openSelf, isEntAdmin: false }))).toBe(false);
  });

  it("refuses an enterprise admin on a camp project, a guided project, a closed switch, a suspended enterprise, or a project they do not belong to", () => {
    expect(canGovernProject(governFacts({ ...openSelf, scene: "camp" }))).toBe(false);
    expect(canGovernProject(governFacts({ ...openSelf, service: "guided" }))).toBe(false);
    expect(canGovernProject(governFacts({ ...openSelf, allowSelfProject: false }))).toBe(false);
    expect(canGovernProject(governFacts({ ...openSelf, enterpriseStatus: "suspended" }))).toBe(false);
    expect(canGovernProject(governFacts({ ...openSelf, isMember: false }))).toBe(false);
  });

  it("treats unknown scene and service as camp and guided, and only suspended enterprises as inactive", () => {
    expect(governFacts({ ...openSelf, scene: "other", service: null, enterpriseStatus: null })).toMatchObject({
      scene: "camp",
      service: "guided",
      enterpriseActive: true,
    });
    expect(governFacts({ ...openSelf, enterpriseStatus: "suspended" }).enterpriseActive).toBe(false);
    expect(canGovernProject(governFacts({ ...openSelf, scene: "other" }))).toBe(false);
    expect(canGovernProject(governFacts({ ...openSelf, service: null }))).toBe(false);
  });
});

describe("project delete collections", () => {
  const dir = path.resolve("server-plugins/plugin-dingze/src/server/collections");

  it("covers every collection file that mentions projectId and leaves invites and audit events attached by pointer", () => {
    const mentioned = readdirSync(dir)
      .filter((file) => file.endsWith(".ts"))
      .flatMap((file) => {
        const source = readFileSync(path.join(dir, file), "utf8");
        if (!source.includes("projectId")) return [];
        const name = source.match(/name:\s*["'](dz_[a-z0-9_]+)["']/)?.[1];
        return name ? [name] : ["missing-name:" + file];
      });
    const allowed = ["dz_projects", ...PROJECT_DELETE_ORDER, ...PROJECT_DETACH_COLLECTIONS];
    expect(new Set(mentioned)).toEqual(new Set(allowed));
    expect(PROJECT_DETACH_COLLECTIONS).toEqual(["dz_invites", "dz_audit_events"]);
    expect(PROJECT_DELETE_ORDER).not.toContain("dz_projects");
    expect(PROJECT_DELETE_ORDER).not.toContain("dz_invites");
    expect(PROJECT_DELETE_ORDER).not.toContain("dz_audit_events");
    expect(PROJECT_DELETE_ORDER.indexOf("dz_artifact_versions")).toBeLessThan(PROJECT_DELETE_ORDER.indexOf("dz_artifacts"));
  });
});
