import { describe, expect, it } from "vitest";

import { BOOK_NOTES, bookNote, taskGuide } from "@dingze/shared";

describe("书中方法 guides", () => {
  it("gives every step table the six parts and makes its completion checks the gate", () => {
    for (const [code, note] of Object.entries(BOOK_NOTES)) {
      if (code.startsWith("M-")) continue;
      const g = note.guide;
      expect(g, code).toBeTruthy();
      for (const key of ["purpose", "prepare", "how", "example", "counter", "source"] as const) expect(g![key].trim(), `${code} ${key}`).not.toBe("");
      expect(g!.check.length, code).toBeGreaterThan(0);
      expect(note.gate).toBe(g!.check.join("；"));
    }
  });

  it("follows the decode map's sub-step and the target / path zone", () => {
    expect(taskGuide("S2-01")?.title).toBe(bookNote("S2-01")!.parts!["1"].title);
    expect(taskGuide("S2-01", { sub: 3 })?.guide).toBe(bookNote("S2-01")!.parts!["3"].guide);
    expect(taskGuide("S2-01", { sub: "9" })?.guide).toBe(bookNote("S2-01")!.guide);
    expect(taskGuide("S2-03", { zone: "paths" })?.guide).toBe(bookNote("S2-03")!.parts!.paths.guide);
    expect(taskGuide("S2-03")?.guide).toBe(bookNote("S2-03")!.parts!.targets.guide);
    expect(taskGuide("S1-04")).toEqual({ title: null, guide: bookNote("S1-04")!.guide });
    expect(taskGuide("M-MISSION")).toBeNull();
  });

  it("keeps the corrected readings: 执行摘要 same-source, 质询 offline, unsigned terms marked", () => {
    const plan = bookNote("S3-07")!;
    expect(plan.guide!.how).toContain("执行摘要和四至六章、附件同源");
    expect(plan.gate).not.toContain("质询");
    expect(bookNote("S3-08")!.points.join("")).toContain("不投入、不介入、不承担");
    expect(bookNote("S2-01")!.parts!["1"].guide.source).toContain("【待确认】");
  });
});
