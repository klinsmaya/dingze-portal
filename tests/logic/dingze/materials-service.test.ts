import { describe, expect, it } from "vitest";

import { profileItem } from "@dingze/shared";
import { type ProjectContext } from "../../../server-plugins/plugin-dingze/src/server/services/access";
import { addMaterial, deleteMaterial, getProfile, listMaterials, saveProfile, setMaterialLibrary, setMaterialShared } from "../../../server-plugins/plugin-dingze/src/server/services/materials";

type Row = { get: (key: string) => unknown; update: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>; destroy: () => Promise<void> };
type Query = { filter?: Record<string, unknown> };
// In-memory repository at the service boundary: assert observable permissions and stored state.
function setup(projectRole: ProjectContext["projectRole"], flags: { isEntAdmin?: boolean; isConsultAdmin?: boolean; isOps?: boolean } = {}) {
  const rows: Record<string, Row[]> = { dz_materials: [], dz_profiles: [], dz_projects: [] };
  let id = 0;
  const record = (table: string, values: Record<string, unknown>): Row => {
    const data: Record<string, unknown> = { id: ++id, ...values };
    const row = {
      get: (key: string) => data[key],
      update: async (patch: Record<string, unknown>) => Object.assign(data, patch),
      destroy: async () => { rows[table] = rows[table].filter((r) => r !== row); },
    };
    rows[table].push(row);
    return row;
  };
  const matches = (row: Row, filter: Record<string, unknown> = {}) => Object.entries(filter).every(([key, value]) => row.get(key) === value);
  const context = {
    auth: { user: { id: 7 } },
    db: {
      sequelize: { transaction: async (run: (transaction: object) => Promise<unknown>) => run({}) },
      getRepository: (table: string) => ({
        find: async ({ filter }: Query) => rows[table].filter((row) => matches(row, filter)),
        findOne: async ({ filter }: Query) => rows[table].find((row) => matches(row, filter)),
        create: async ({ values }: { values: Record<string, unknown> }) => record(table, { ...values, createdById: 7 }),
      }),
    },
  };
  // Only the service's database/auth subset is exercised by this in-process fixture.
  const ctx = context as unknown as Parameters<typeof addMaterial>[0];
  // Validated project context; space and visibility checks belong to loadProjectContext.
  const pc = {
    project: { get: (key: string) => key === "id" ? 1 : null },
    spaceName: "enterprise-a",
    projectRole,
    joined: projectRole !== "readonly" && projectRole !== null,
    access: { isConsultAdmin: false, isEntAdmin: false, isOps: false, ...flags },
  } as ProjectContext;
  return { ctx, pc, seed: (values: Record<string, unknown>) => record("dz_materials", { projectId: 1, createdById: 7, inLibrary: true, ...values }) };
}

describe("materials service permissions", () => {
  it("lets an unjoined enterprise admin delete library materials and confirm a profile", async () => {
    const { ctx, pc, seed } = setup("readonly", { isEntAdmin: true });
    const material = seed({ title: "复盘", kind: "note" });
    await deleteMaterial(ctx, pc, material.get("id"));
    expect(await listMaterials(ctx, pc)).toEqual([]);
    const items = [profileItem({ id: "fact", content: "900 万方", status: "confirmed" })];
    expect(await saveProfile(ctx, pc, { baseRev: 0, items })).toEqual({ rev: 1, items });
    expect(await getProfile(ctx, pc)).toMatchObject({ rev: 1, items });
    await expect(saveProfile(ctx, pc, { baseRev: 0, items })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it.each(["member", "readonly", null] as const)("does not let %s or pure ops write the library, even their own note", async (role) => {
    for (const flags of [{}, { isOps: true }]) {
      const { ctx, pc, seed } = setup(role, flags);
      const note = seed({ title: "复盘", kind: "note" });
      const attachment = seed({ kind: "attachment", inLibrary: false });
      await expect(addMaterial(ctx, pc, { kind: "note", text: "新资料" })).rejects.toMatchObject({ status: 403 });
      await expect(deleteMaterial(ctx, pc, note.get("id"))).rejects.toMatchObject({ status: 403 });
      await expect(setMaterialShared(ctx, pc, note.get("id"), true)).rejects.toMatchObject({ status: 403 });
      await expect(setMaterialLibrary(ctx, pc, attachment.get("id"), true)).rejects.toMatchObject({ status: 403 });
      await expect(saveProfile(ctx, pc, { baseRev: 0, items: [] })).rejects.toMatchObject({ status: 403 });
      expect(await listMaterials(ctx, pc)).toMatchObject([{ id: note.get("id"), title: "复盘" }]);
      expect(await getProfile(ctx, pc)).toMatchObject({ rev: 0, items: [] });
    }
  });

  it("keeps member attachment upload and owner deletion, without granting library management", async () => {
    const { ctx, pc } = setup("member");
    const attachment = await addMaterial(ctx, pc, { kind: "attachment", artifactCode: "S1-01", text: "填表参考" });
    expect(await listMaterials(ctx, pc)).toEqual([]);
    await expect(setMaterialLibrary(ctx, pc, attachment.id, true)).rejects.toMatchObject({ status: 403 });
    expect(await deleteMaterial(ctx, pc, attachment.id)).toEqual({ ok: true });
  });

  it("refuses readonly attachment upload/owner deletion and member deletion of another person's attachment", async () => {
    const readonly = setup("readonly");
    const own = readonly.seed({ kind: "attachment", inLibrary: false });
    await expect(addMaterial(readonly.ctx, readonly.pc, { kind: "attachment", artifactCode: "S1-01", text: "参考" })).rejects.toMatchObject({ status: 403 });
    await expect(deleteMaterial(readonly.ctx, readonly.pc, own.get("id"))).rejects.toMatchObject({ status: 403 });
    const member = setup("member");
    const other = member.seed({ kind: "attachment", createdById: 8 });
    await expect(deleteMaterial(member.ctx, member.pc, other.get("id"))).rejects.toMatchObject({ status: 403 });
  });

  it("does not mutate shared source materials from the consuming project", async () => {
    const { ctx, pc, seed } = setup("readonly", { isEntAdmin: true });
    const source = seed({ projectId: 2, kind: "note", shared: true });
    await expect(deleteMaterial(ctx, pc, source.get("id"))).rejects.toMatchObject({ status: 404 });
    await expect(setMaterialShared(ctx, pc, source.get("id"), false)).rejects.toMatchObject({ status: 404 });
    expect(source.get("shared")).toBe(true);
  });

  it("preserves saved profile and revision when an admin requests the other side's status", async () => {
    for (const [flags, status] of [[{ isEntAdmin: true }, "reviewed"], [{ isConsultAdmin: true }, "confirmed"]] as const) {
      const { ctx, pc } = setup("readonly", flags);
      const draft = profileItem({ id: "fact", content: "900 万方" });
      await saveProfile(ctx, pc, { baseRev: 0, items: [draft] });
      await expect(saveProfile(ctx, pc, { baseRev: 1, items: [{ ...draft, status }] })).rejects.toMatchObject({ status: 403 });
      expect(await getProfile(ctx, pc)).toMatchObject({ rev: 1, items: [draft] });
    }
  });
});
