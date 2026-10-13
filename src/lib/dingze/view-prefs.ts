import { useState } from "react";

// 工作区的布局偏好（收起左栏 / 右栏）换表后保持 (验收意见 E D06)。只是本机的便利设置：读写失败就当没有。

function read(key: string): boolean | null {
  try {
    const v = window.localStorage.getItem(key);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function usePersistentFlag(key: string): [boolean | null, (value: boolean | null) => void] {
  const [value, setValue] = useState<boolean | null>(() => read(key));
  const set = (next: boolean | null) => {
    setValue(next);
    try {
      if (next === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // Private mode: the preference lasts until the page is left.
    }
  };
  return [value, set];
}
