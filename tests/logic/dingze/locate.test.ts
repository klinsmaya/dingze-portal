import { describe, expect, it } from "vitest";

import { anchorCandidates, locateAnchor } from "@/lib/dingze/locate";

describe("issue anchors", () => {
  it("falls back from a field path to its row and to single ids", () => {
    expect(anchorCandidates("battlefields.b1.mustWin")).toEqual(["battlefields.b1.mustWin", "battlefields.b1", "battlefields", "mustWin", "b1"]);
    expect(anchorCandidates("r1")).toEqual(["r1"]);
  });

  it("scrolls to the closest marked element and reports when there is none", () => {
    document.body.innerHTML = `<table><tr data-anchor="b1"><td><input /></td></tr></table>`;
    const row = document.querySelector("tr")!;
    row.scrollIntoView = () => undefined;
    expect(locateAnchor("battlefields.b1.mustWin")).toBe(true);
    expect(row.classList.contains("dz-locate-flash")).toBe(true);
    expect(document.activeElement).toBe(document.querySelector("input"));
    expect(locateAnchor("nothing")).toBe(false);
    document.body.innerHTML = `<div data-anchor="battlefields.b2.name"><textarea></textarea></div>`;
    (document.querySelector("div") as HTMLElement).scrollIntoView = () => undefined;
    expect(locateAnchor("b2")).toBe(true);
  });
});
