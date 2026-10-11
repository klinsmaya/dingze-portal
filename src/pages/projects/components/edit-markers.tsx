import { useEffect, useState } from "react";

import { anchorCandidates } from "@/lib/dingze/locate";

// Canvas layer for the edit session: marks rows and cells by `data-anchor` — 本版改过 / 修订
// (teal bar), comments (purple bar + numbered drop), AI card preview (amber dashed), 圈选
// (purple outline) — without the editors knowing about it. A change path such as
// `battlefields.b1.mustWin` marks the closest element on the page (field, then row).

export type Marks = {
  changed: string[];
  added: string[];
  comments: string[];
  preview: string[];
  selection: string[];
  /** Old values shown on hover while 修订 is on, keyed by change path. */
  before?: Record<string, string>;
};

const esc = (a: string) => a.replace(/["\\\\]/g, "");

/** The element a path points at: the most specific `data-anchor` present on the page. */
export function anchorElement(main: ParentNode, path: string): HTMLElement | null {
  for (const c of anchorCandidates(path)) {
    const el = main.querySelector<HTMLElement>(`[data-anchor="${esc(c)}"]`);
    if (el) return el;
  }
  return null;
}

export function EditMarkers(marks: Marks) {
  const key = JSON.stringify(marks);
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("[data-dingze-main]");
    if (!main) return;
    const { before = {} } = marks;
    let touched: HTMLElement[] = [];
    const clear = () => {
      for (const el of touched) {
        el.removeAttribute("data-dz-mark");
        if (el.dataset.dzTitle !== undefined) {
          el.title = el.dataset.dzTitle;
          delete el.dataset.dzTitle;
        }
      }
      touched = [];
    };
    const apply = () => {
      clear();
      const tags = new Map<HTMLElement, Set<string>>();
      const tag = (paths: string[], name: string) => {
        for (const p of paths) {
          const el = anchorElement(main, p);
          if (!el) continue;
          if (!tags.has(el)) tags.set(el, new Set());
          tags.get(el)!.add(name);
          if (name !== "comment" && before[p] !== undefined && el.dataset.dzTitle === undefined) {
            el.dataset.dzTitle = el.title;
            el.title = `原值：${before[p]}`;
          }
        }
      };
      tag(marks.changed, "changed");
      tag(marks.added, "added");
      tag(marks.comments, "comment");
      tag(marks.preview, "preview");
      tag(marks.selection, "selected");
      for (const [el, names] of tags) {
        el.setAttribute("data-dz-mark", [...names].join(" "));
        touched.push(el);
      }
    };
    apply();
    // Editors switch tabs and expand rows on their own; re-mark when the canvas changes.
    let frame = 0;
    const observer = new MutationObserver((records) => {
      if (records.every((r) => r.type === "attributes")) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    });
    observer.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
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
