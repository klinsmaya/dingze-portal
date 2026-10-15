import { useSyncExternalStore } from "react";

// 字号三档（开营前 UX 改版 T1）：整站按 rem 缩放。偏好存在本机，跨项目、跨会话保留；读写失败就用“中”。

export type FontSize = "sm" | "md" | "lg";

export const FONT_SIZES: { value: FontSize; label: string; scale: string }[] = [
  { value: "sm", label: "小", scale: "87.5%" },
  { value: "md", label: "中", scale: "100%" },
  { value: "lg", label: "大", scale: "112.5%" },
];

const KEY = "dingze:font-size";
const EVENT = "dz-font-size";

export function storedFontSize(): FontSize {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "sm" || v === "lg" ? v : "md";
  } catch {
    return "md";
  }
}

export function applyFontSize(size: FontSize) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.fontSize = FONT_SIZES.find((s) => s.value === size)?.scale ?? "100%";
  root.dataset.fontSize = size;
}

export function setFontSize(size: FontSize) {
  try {
    if (size === "md") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, size);
  } catch {
    // Private mode: the size lasts until the page is left.
  }
  applyFontSize(size);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      applyFontSize(storedFontSize());
      onChange();
    }
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const current = () => (typeof document === "undefined" ? "md" : ((document.documentElement.dataset.fontSize as FontSize | undefined) ?? storedFontSize()));

export function useFontSize(): [FontSize, (size: FontSize) => void] {
  const size = useSyncExternalStore(subscribe, current, () => "md" as FontSize);
  return [size, setFontSize];
}
