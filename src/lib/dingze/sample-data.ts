import { hanchuan2026 } from "../../../server-plugins/scripts/demo-seed/hanchuan";

import { SAMPLE_ORG_UNITS } from "./sample";

let cache: Record<string, unknown> | null = null;

/** Every sample table by code (S1-01 …), from the demo seed of 瀚川燃气 2026. */
export function samplePayloads(): Record<string, unknown> {
  if (!cache) {
    const org = Object.fromEntries(SAMPLE_ORG_UNITS.map((u) => [u.name, u.id]));
    cache = hanchuan2026(org);
  }
  return cache;
}
