import { useEffect, useState } from "react";

import { anchorCandidates } from "@/lib/dingze/locate";

// Canvas layer for the edit session: marks rows and cells by `data-anchor` — 本版改过 / 修订
// (teal bar), comments (purple bar + numbered drop), AI card preview (amber dashed), 圈选
// (purple outline) — without the editors knowing about it.

type Marks = {
  changed: string[];
  added: string[];
  comments: string[];
  preview: string[];
  selection: string[];
  /** Old values shown on hover while 修订 is on. */
  before?: Record<string, string>;
};

const esc = (a: string) => a.replace(/["\\\\]/g, "");
const sel = (anchors: string[]) => anchors.map((a) => `[data-dingze-main] [data-anchor="${esc(a)}"]`).join(",\n");

export function EditMarkers({ changed, added, comments, preview, selection, before }: Marks) {
  // Hover text with the original value (修订).
  useEffect(() => {
    if (!before) return;
    const touched: HTMLElement[] = [];
    for (const [anchor, text] of Object.entries(before)) {
      const el = document.querySelector<HTMLElement>(`[data-dingze-main] [data-anchor="${esc(anchor)}"]`);
      if (!el) continue;
      el.dataset.dzTitle = el.title;
      el.title = `原值：${text}`;
      touched.push(el);
    }
    return () => {
      for (const el of touched) {
        el.title = el.dataset.dzTitle ?? "";
        delete el.dataset.dzTitle;
      }
    };
  }, [before]);

  const all = [...new Set([...changed, ...added, ...comments, ...preview, ...selection])];
  if (!all.length) return null;
  const rules = [
    `${sel(all)} { }`,
    changed.length && `${sel(changed)} { --dz-mk-changed: inset 3px 0 0 var(--dz-changed); }`,
    added.length && `${sel(added)} { --dz-mk-changed: inset 3px 0 0 var(--dz-added); background-color: color-mix(in oklab, var(--dz-added) 8%, transparent); }`,
    comments.length && `${sel(comments)} { --dz-mk-comment: inset -3px 0 0 var(--dz-comment); }`,
    preview.length && `${sel(preview)} { --dz-mk-outline: 2px dashed var(--dz-ai); }`,
    selection.length && `${sel(selection)} { --dz-mk-outline: 2px solid var(--dz-comment); }`,
  ].filter(Boolean);
  return (
    <>
      <style>{rules.join("\n")}</style>
      <MarkClasses anchors={all} />
    </>
  );
}

/** Adds the class that composes the marker variables to the marked elements. */
function MarkClasses({ anchors }: { anchors: string[] }) {
  useEffect(() => {
    const els = anchors.flatMap((a) => [...document.querySelectorAll<HTMLElement>(`[data-dingze-main] [data-anchor="${esc(a)}"]`)]);
    els.forEach((el) => el.classList.add("dz-marked"));
    return () => els.forEach((el) => el.classList.remove("dz-marked"));
  });
  return null;
}

export type Pin = { id: number; no: number; anchors: string[]; resolved: boolean; label: string };

/** Numbered purple drops pinned to the rows / cells comments are attached to (design 10 §4). */
export function CommentPins({ pins, activeId, onOpen }: { pins: Pin[]; activeId: number | null; onOpen: (id: number) => void }) {
  const [boxes, setBoxes] = useState<{ pin: Pin; top: number; left: number }[]>([]);
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("[data-dingze-main]");
    if (!main) return;
    const measure = () => {
      const host = main.getBoundingClientRect();
      const out: { pin: Pin; top: number; left: number }[] = [];
      for (const pin of pins) {
        if (pin.resolved) continue;
        let el: HTMLElement | null = null;
        for (const c of pin.anchors.flatMap(anchorCandidates)) {
          el = main.querySelector<HTMLElement>(`[data-anchor="${esc(c)}"]`);
          if (el && el.offsetParent) break;
          el = null;
        }
        if (!el) continue;
        const r = el.getBoundingClientRect();
        out.push({ pin, top: r.top - host.top + main.scrollTop - 6, left: Math.min(r.right - host.left + main.scrollLeft - 14, host.width - 28) });
      }
      setBoxes(out);
    };
    measure();
    const timer = window.setInterval(measure, 800);
    window.addEventListener("resize", measure);
    main.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
      main.removeEventListener("scroll", measure, true);
    };
  }, [pins]);
  return (
    <>
      {boxes.map(({ pin, top, left }) => (
        <button
          key={pin.id}
          type="button"
          onClick={() => onOpen(pin.id)}
          aria-label={`批注 ${pin.no}，${pin.label}，未解决`}
          title={pin.label}
          className="absolute z-10 flex size-6 items-center justify-center rounded-full rounded-br-none text-[11px] font-bold text-white shadow"
          style={{ top, left, background: "var(--dz-comment)", outline: activeId === pin.id ? "2px solid var(--gold)" : undefined }}
        >
          {pin.no}
        </button>
      ))}
    </>
  );
}
