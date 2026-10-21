import { ARTIFACTS, type ArtifactDef } from "@dingze/shared";

import type { ArtifactOverview } from "./api";

/**
 * The table to go to after finishing `code`: the next unlocked, not-yet-locked table in book
 * order (method worksheets are optional and skipped), in this stage or the next.
 */
export function nextArtifact(code: string, artifacts: ArtifactOverview[]): ArtifactDef | null {
  const byCode = new Map(artifacts.map((a) => [a.code, a]));
  const index = ARTIFACTS.findIndex((a) => a.code === code);
  if (index < 0) return null;
  for (const def of ARTIFACTS.slice(index + 1)) {
    if (def.priority === "method") continue;
    const a = byCode.get(def.code);
    if (a?.unlock.unlocked && a.status !== "locked") return def;
  }
  return null;
}
