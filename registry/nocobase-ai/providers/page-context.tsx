import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import type {
  AIChatMessage,
  AIEmployeeTask,
  AIWorkContextItem,
} from "./types";

export type AIPageContextResolver = (
  items: AIWorkContextItem[]
) => Promise<AIWorkContextItem[]>;

const AIPageContextResolverContext = createContext<
  AIPageContextResolver | undefined
>(undefined);

export function AIPageContextResolverProvider({
  resolve,
  children,
}: PropsWithChildren<{ resolve: AIPageContextResolver }>) {
  return (
    <AIPageContextResolverContext.Provider value={resolve}>
      {children}
    </AIPageContextResolverContext.Provider>
  );
}

export const useAIPageContextResolver = () =>
  useContext(AIPageContextResolverContext);

const EMPTY_PAGE_CONTEXT: AIWorkContextItem[] = [];
const AIPageContextScopeContext = createContext(EMPTY_PAGE_CONTEXT);

export function AIPageContextScope({
  context,
  mode = "replace",
  children,
}: PropsWithChildren<{
  context: AIWorkContextItem | AIWorkContextItem[];
  mode?: "replace" | "append";
}>) {
  const inheritedContext = useContext(AIPageContextScopeContext);
  const value = useMemo(
    () => {
      const ownContext = Array.isArray(context) ? context : [context];
      if (mode !== "append") return ownContext;
      const combined = [...inheritedContext, ...ownContext];
      return combined.filter((item, index) => {
        if (!item.id) return true;
        return (
          combined.findLastIndex(
            (candidate) =>
              candidate.type === item.type && candidate.id === item.id
          ) === index
        );
      });
    },
    [context, inheritedContext, mode]
  );
  return (
    <AIPageContextScopeContext.Provider value={value}>
      {children}
    </AIPageContextScopeContext.Provider>
  );
}

export const useAIPageContextScope = () =>
  useContext(AIPageContextScopeContext);

export function createAIPageContextReference({
  id,
  title,
  kind,
}: {
  id: string;
  title: string;
  kind?: string;
}): AIWorkContextItem {
  return {
    type: "page-element",
    id,
    title,
    ...(kind ? { kind } : {}),
  };
}

const isFormContext = (item: AIWorkContextItem) => {
  if (item.kind === "form") return true;
  if (!item.content || typeof item.content !== "object") return false;
  const content = item.content as Record<string, unknown>;
  return typeof content.form === "string" && Array.isArray(content.fields);
};

export function getAIWorkContextRequiredTools(items: AIWorkContextItem[]) {
  return items.some(isFormContext) ? ["formFiller"] : [];
}

export function getAIWorkContextToolScope(items: AIWorkContextItem[]) {
  const frontendToolIds = new Set<string>();
  const formIds = new Set<string>();
  for (const item of items) {
    if (Array.isArray(item.frontendTools)) {
      for (const tool of item.frontendTools) {
        if (
          tool &&
          typeof tool === "object" &&
          typeof (tool as { id?: unknown }).id === "string"
        ) {
          frontendToolIds.add((tool as { id: string }).id);
        }
      }
    }
    if (isFormContext(item)) {
      const form = (item.content as { form?: unknown } | undefined)?.form;
      if (typeof form === "string" && form) formIds.add(form);
    }
  }
  return {
    allowedFrontendToolIds: [...frontendToolIds],
    allowedFormIds: [...formIds],
  };
}

/**
 * What a tool call of this conversation may reach. `messages` are the conversation up to and
 * including the message that carries the call.
 *
 * Frontend tools are scoped to the conversation, not to the latest message: the server binds a
 * conversation's frontend tools from the first message that offers them and keeps offering them to
 * the model afterwards. Scoping them to the latest message would turn a call the server allowed
 * into "not available in this conversation context" whenever that message was sent without the
 * page context — an error the model answers by doing the same step again. A tool still has to be
 * registered by the page to run. Forms stay scoped to the latest user message.
 */
export function getAIConversationToolScope(
  messages: Array<Pick<AIChatMessage, "role" | "metadata">>,
  taskContext: AIWorkContextItem[] = []
) {
  const userContexts = messages
    .filter((message) => message.role === "user")
    .map((message) => message.metadata?.workContext ?? []);
  const latest = getAIWorkContextToolScope([
    ...taskContext,
    ...(userContexts.at(-1) ?? []),
  ]);
  const conversation = getAIWorkContextToolScope([
    ...taskContext,
    ...userContexts.flat(),
  ]);
  return {
    allowedFrontendToolIds: conversation.allowedFrontendToolIds,
    allowedFormIds: latest.allowedFormIds,
  };
}

export function mergeAIRequiredTools(
  skillSettings: AIEmployeeTask["skillSettings"],
  requiredTools: string[]
): AIEmployeeTask["skillSettings"] {
  if (!requiredTools.length) return skillSettings;
  return {
    ...skillSettings,
    tools: [...new Set([...(skillSettings?.tools ?? []), ...requiredTools])],
  };
}
