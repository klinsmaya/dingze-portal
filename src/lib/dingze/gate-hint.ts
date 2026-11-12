import { useSyncExternalStore } from "react";

import { STAGES, type StageKey } from "@dingze/shared";

// 测试反馈 3：点一个还没开启的阶段，不再只给一张“还没解锁”，而是带到上一阶段，把还没定版的必做表
// 用红色标出来。“正在提示哪个阶段”按项目记在本次会话里，在上一阶段的各张表之间切换时不丢。

const key = (projectId: number) => `dingze:gate-hint:${projectId}`;
const listeners = new Set<() => void>();
const memory = new Map<number, StageKey | null>();

const isStage = (value: unknown): value is StageKey => STAGES.some((s) => s.key === value);

function read(projectId: number): StageKey | null {
  if (memory.has(projectId)) return memory.get(projectId) ?? null;
  let value: StageKey | null = null;
  try {
    const stored = window.sessionStorage.getItem(key(projectId));
    if (isStage(stored)) value = stored;
  } catch {
    // 读不到按没有提示
  }
  memory.set(projectId, value);
  return value;
}

/** Start (or, with null, stop) pointing at what still keeps `stage` closed. */
export function setGateHint(projectId: number, stage: StageKey | null) {
  memory.set(projectId, stage);
  try {
    if (stage) window.sessionStorage.setItem(key(projectId), stage);
    else window.sessionStorage.removeItem(key(projectId));
  } catch {
    // 存不了时只在本页记住
  }
  listeners.forEach((notify) => notify());
}

/** The stage the user tried to open while it was still closed, if any. */
export function useGateHint(projectId: number): StageKey | null {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => read(projectId),
    () => null,
  );
}
