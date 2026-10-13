import { expect, it } from "vitest";

import { sumText } from "@/pages/projects/editors/path-system-editor";

it("keeps the gap visible when the paths do not add up to the goal", () => {
  expect(sumText([1.6, 0.6, 0.4], 2.8)).toEqual({ ok: false, text: "1.6 + 0.6 + 0.4 = 2.6 ≠ 2.8（还差 0.2）" });
  expect(sumText([700, 400], 1000).text).toBe("700 + 400 = 1100 ≠ 1000（多 100）");
  expect(sumText([700, 300], 1000)).toEqual({ ok: true, text: "700 + 300 = 1000" });
});
