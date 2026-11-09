import { describe, expect, it } from "vitest";

import { idsInPath, referencesOf } from "@/lib/dingze/references";

describe("referencesOf", () => {
  const payload = {
    kpis: [
      { id: "k1", name: "营收", goalId: "g1" },
      { id: "k2", name: "毛利", goalId: "g2", tags: ["g1", "x"] },
      { id: "g3", name: "同名行" },
    ],
    note: { source: "g1" },
  };

  it("finds rows whose field equals the id", () => {
    expect(referencesOf(payload, "g1").sort()).toEqual(["kpis.k1", "kpis.k2", "note.source"]);
  });

  it("finds a row keyed by the same id", () => {
    expect(referencesOf(payload, "g3")).toEqual(["kpis.g3"]);
  });

  it("returns nothing for an unknown or empty id", () => {
    expect(referencesOf(payload, "zzz")).toEqual([]);
    expect(referencesOf(payload, "")).toEqual([]);
  });
});

describe("idsInPath", () => {
  it("keeps the segments after the collection name", () => {
    expect(idsInPath("goals.g1.name")).toEqual(["g1", "name"]);
    expect(idsInPath("title")).toEqual([]);
  });
});
