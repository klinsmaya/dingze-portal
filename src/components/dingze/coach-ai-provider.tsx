import type { PropsWithChildren } from "react";

import { NocoBaseAIExtensionProvider } from "@/extensions/nocobase-ai/global-ai-chat";
import { NocoBaseAIService } from "@/extensions/nocobase-ai/services";
import { portalEmployees } from "@/lib/dingze/coach";

class CoachAIService extends NocoBaseAIService {
  async listEmployees() {
    return portalEmployees(await super.listEmployees());
  }
}

const service = new CoachAIService();

/** The AI extension, offering the digital consultants only: one assistant identity in and outside a project. */
export function CoachAIProvider({ children }: PropsWithChildren) {
  return <NocoBaseAIExtensionProvider service={service}>{children}</NocoBaseAIExtensionProvider>;
}
