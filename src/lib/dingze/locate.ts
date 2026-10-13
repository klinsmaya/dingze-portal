// Scroll to the row or field an issue / comment points at. Editors mark rows and fields with
// `data-anchor`; an anchor such as `battlefields.b1.mustWin` or `sheet1.O2` falls back to its
// shorter prefixes and then to its single segments (row ids), so the closest row is found.

export function anchorCandidates(anchor: string | null | undefined): string[] {
  // 整表批注、整表问题没有锚点。
  if (!anchor) return [];
  const parts = anchor.split(".").filter(Boolean);
  const out = [anchor];
  for (let i = parts.length - 1; i > 0; i--) out.push(parts.slice(0, i).join("."));
  for (const part of [...parts].reverse()) if (!out.includes(part)) out.push(part);
  return out;
}

const FLASH = "dz-locate-flash";

/** Returns false when nothing on the page carries the anchor (e.g. a whole-table issue). */
export function locateAnchor(anchor: string, root: ParentNode = document): boolean {
  const candidates = anchorCandidates(anchor);
  const selectors = [
    ...candidates.map((c) => `[data-anchor="${CSS.escape(c)}"]`),
    // A row id inside a field path, e.g. “b1” → data-anchor="battlefields.b1.name".
    ...candidates.map((c) => `[data-anchor*=".${CSS.escape(c)}."], [data-anchor^="${CSS.escape(c)}."]`),
  ];
  for (const selector of selectors) {
    const el = root.querySelector<HTMLElement>(selector);
    if (!el) continue;
    if (el.getAttribute("role") === "tab") el.click();
    let revealed = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (p instanceof HTMLDetailsElement) p.open = true;
      // Editors with step zones (e.g. S2-03 定目标 / 找路径) mark the panel and its switch.
      const zone = p.getAttribute("data-zone");
      if (zone) {
        root.querySelector<HTMLElement>(`[data-zone-tab="${CSS.escape(zone)}"]`)?.click();
        revealed = true;
      }
    }
    const show = () => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove(FLASH);
      void el.offsetWidth;
      el.classList.add(FLASH);
      window.setTimeout(() => el.classList.remove(FLASH), 1800);
      const field = el.matches("input, textarea, select") ? el : el.querySelector<HTMLElement>("input:not([readonly]), textarea:not([readonly]), select:not([disabled])");
      field?.focus({ preventScroll: true });
    };
    if (revealed) window.setTimeout(show, 0);
    else show();
    return true;
  }
  return false;
}
