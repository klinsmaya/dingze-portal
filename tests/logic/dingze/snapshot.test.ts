import { expect, it } from "vitest";

import { dropProjects, remapFiles, remapUsers } from "../../../server-plugins/plugin-dingze/src/server/services/snapshot";

// 演示数据迁移（dev → 准生产）的纯数据处理。
const rows = {
  dz_projects: [{ id: 1 }, { id: 8 }],
  dz_artifacts: [
    { id: 10, projectId: 1 },
    { id: 11, projectId: 8 },
  ],
  dz_artifact_versions: [
    { id: 100, artifactId: 10, projectId: 1, createdById: 316 },
    { id: 101, artifactId: 11, projectId: 8, createdById: 316 },
  ],
  dz_camps: [{ id: 1, createdById: 1 }],
  dz_materials: [
    { id: 5, projectId: 1, fileId: 9 },
    { id: 6, projectId: 1, fileId: null },
  ],
};

it("drops excluded projects and everything under them", () => {
  const out = dropProjects(rows, [8]);
  expect(out.dz_projects.map((r) => r.id)).toEqual([1]);
  expect(out.dz_artifacts.map((r) => r.id)).toEqual([10]);
  expect(out.dz_artifact_versions.map((r) => r.id)).toEqual([100]);
  expect(out.dz_camps).toHaveLength(1);
});

it("points references to accounts outside the snapshot at the target admin", () => {
  const out = remapUsers(rows, new Set([316]), 1);
  expect(out.dz_artifact_versions[0].createdById).toBe(316);
  const camps = remapUsers({ dz_camps: [{ id: 1, createdById: 2 }] }, new Set([316]), 1);
  expect(camps.dz_camps[0].createdById).toBe(1);
});

it("swaps material originals to the ids uploaded on the target", () => {
  const out = remapFiles(rows, { "9": 3 });
  expect(out.dz_materials.map((m) => m.fileId)).toEqual([3, null]);
});

it("initial passwords always mix upper, lower, digits and a symbol", async () => {
  const { initialPassword } = await import("../../../server-plugins/plugin-dingze/src/server/services/snapshot");
  for (let i = 0; i < 200; i++) {
    const p = initialPassword();
    expect(p).toMatch(/[A-Z]/);
    expect(p).toMatch(/[a-z]/);
    expect(p).toMatch(/[0-9]/);
    expect(p).toMatch(/[^A-Za-z0-9]/);
    expect(p.length).toBeGreaterThanOrEqual(16);
  }
});
