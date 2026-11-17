import { describe, expect, it } from "vitest";

import { NocoBaseChatTransport } from "../providers/chat-transport";
import {
  AIStreamInterruptedError,
  ConversationRunGuard,
  isStreamRequestFailure,
} from "../providers/conversation-run";
import { getAIConversationToolScope } from "../providers/page-context";
import { createNocoBaseUIMessageStream } from "../providers/ui-message-stream";

const encodeSSE = (events: unknown[]) => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")
        )
      );
      controller.close();
    },
  });
};

const readAll = async (stream: ReadableStream) => {
  const chunks: Array<Record<string, any>> = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
};

/** A server whose run goes on whatever happens to the stream, as the real one does. */
const createServer = (state: "idle" | "streaming" = "streaming") => {
  const server = {
    state: state as "idle" | "streaming",
    calls: [] as string[],
    chat: { status: "ready" },
    abortTakes: 0,
    reattachFails: false,
  };
  const guard = new ConversationRunGuard<{ status: string }>({
    getActiveState: async () => {
      server.calls.push(`state:${server.state}`);
      if (server.abortTakes > 0 && --server.abortTakes === 0) {
        server.state = "idle";
      }
      return server.state;
    },
    abort: async () => {
      server.calls.push("abort");
      if (server.abortTakes === 0) server.state = "idle";
    },
    refresh: async () => {
      server.calls.push("refresh");
    },
    reattach: async (_, chat) => {
      server.calls.push("reattach");
      if (server.reattachFails) chat.status = "error";
      else server.state = "idle";
    },
    sleep: async () => undefined,
  });
  return { server, guard };
};

describe("one run per conversation", () => {
  it("starts a run without asking the server when nothing was interrupted", async () => {
    const { server, guard } = createServer("streaming");
    await expect(guard.ensureIdle("s1", server.chat)).resolves.toBe(true);
    expect(server.calls).toEqual([]);
  });

  it("stops the server run on stop and waits until it has saved", async () => {
    const { server, guard } = createServer("streaming");
    server.abortTakes = 2;
    guard.markInterrupted("s1");

    await expect(guard.settle("s1", server.chat, { abort: true })).resolves.toBe(
      "idle"
    );
    expect(server.calls).toEqual([
      "abort",
      "state:streaming",
      "state:streaming",
      "refresh",
    ]);
    expect(guard.isUnsettled("s1")).toBe(false);
    await expect(guard.ensureIdle("s1", server.chat)).resolves.toBe(true);
  });

  it("follows a run the server is still doing instead of starting a second one", async () => {
    const { server, guard } = createServer("streaming");
    guard.markInterrupted("s1");

    // `false`: the caller must not send on top of the run that was just followed.
    await expect(guard.ensureIdle("s1", server.chat)).resolves.toBe(false);
    // The saved messages come first: the server replays the run from its last saved message.
    expect(server.calls).toEqual(["state:streaming", "refresh", "reattach"]);
    expect(guard.isUnsettled("s1")).toBe(false);
  });

  it("stays unsettled while the run cannot be followed", async () => {
    const { server, guard } = createServer("streaming");
    server.reattachFails = true;
    guard.markInterrupted("s1");

    await expect(guard.settle("s1", server.chat)).resolves.toBe("running");
    expect(guard.isUnsettled("s1")).toBe(true);
  });

  it("shows what the server saved once the run is over", async () => {
    const { server, guard } = createServer("idle");
    guard.markInterrupted("s1");
    await expect(guard.ensureIdle("s1", server.chat)).resolves.toBe(true);
    expect(server.calls).toEqual(["state:idle", "refresh"]);
  });

  it("keeps the typed message when the request never reached a stream", async () => {
    const { server, guard } = createServer("idle");
    guard.markInterrupted("s1");
    await expect(
      guard.settle("s1", server.chat, { keepLocalWhenIdle: true })
    ).resolves.toBe("idle");
    expect(server.calls).toEqual(["state:idle"]);
  });

  it("never folds a stop into a pass that only looks", async () => {
    const { server, guard } = createServer("streaming");
    server.reattachFails = true;
    guard.markInterrupted("s1");

    const looking = guard.settle("s1", server.chat);
    const stopping = guard.settle("s1", server.chat, { abort: true });
    await expect(looking).resolves.toBe("running");
    await expect(stopping).resolves.toBe("idle");
    expect(server.calls).toContain("abort");
    expect(server.state).toBe("idle");
  });

  it("gives up recovering a connection that keeps dropping", () => {
    const { guard } = createServer();
    expect(guard.nextRecoveryDelay("s1")).toBe(0);
    expect(guard.nextRecoveryDelay("s1")).toBeGreaterThan(0);
    expect(guard.nextRecoveryDelay("s1")).toBeGreaterThan(0);
    expect(guard.nextRecoveryDelay("s1")).toBeUndefined();
    guard.markFinished("s1");
    expect(guard.nextRecoveryDelay("s1")).toBe(0);
  });
});

describe("streams that end before the run does", () => {
  it("finishes a stream the server closed itself", async () => {
    const chunks = await readAll(
      createNocoBaseUIMessageStream(
        encodeSSE([
          { type: "stream_start", from: "main-agent" },
          { type: "content", body: "done", from: "main-agent" },
          { type: "stream_end", from: "main-agent" },
        ])
      )
    );
    expect(chunks.at(-1)).toEqual({ type: "finish" });
  });

  it("reports a stream that closed in the middle of a run", async () => {
    await expect(
      readAll(
        createNocoBaseUIMessageStream(
          encodeSSE([
            { type: "stream_start", from: "main-agent" },
            { type: "content", body: "half an ans", from: "main-agent" },
          ])
        )
      )
    ).rejects.toBeInstanceOf(AIStreamInterruptedError);
  });

  it("does not expect a replay of a run in progress to close itself", async () => {
    const chunks = await readAll(
      createNocoBaseUIMessageStream(
        encodeSSE([
          { type: "stream_start", from: "main-agent" },
          { type: "content", body: "tail", from: "main-agent" },
        ]),
        null,
        { expectStreamEnd: false }
      )
    );
    expect(chunks.at(-1)).toEqual({ type: "finish" });
  });

  it("keeps a server error an error, not an interruption", async () => {
    const chunks = await readAll(
      createNocoBaseUIMessageStream(
        encodeSSE([
          { type: "stream_start", from: "main-agent" },
          { type: "error", body: "model unavailable" },
        ])
      )
    );
    expect(chunks).toContainEqual({
      type: "error",
      errorText: "model unavailable",
    });
    expect(chunks.at(-1)).toEqual({ type: "finish" });
  });

  it("lets a resumed stream be stopped", async () => {
    let signal: AbortSignal | undefined;
    const transport = new NocoBaseChatTransport({
      service: {
        resumeConversationStream: async (_: string, abort?: AbortSignal) => {
          signal = abort;
          return encodeSSE([]);
        },
      } as any,
      getContext: () => ({
        sessionId: "s1",
        employee: { username: "mira", nickname: "Mira" },
        model: { value: "test", label: "Test" },
      }),
    });
    await transport.reconnectToStream();
    expect(signal?.aborted).toBe(false);
    transport.abortReconnect();
    expect(signal?.aborted).toBe(true);
  });

  it("tells a request that never opened a stream from a dropped one", async () => {
    const failure = new TypeError("Failed to fetch");
    const transport = new NocoBaseChatTransport({
      service: {
        sendMessagesStream: async () => {
          throw failure;
        },
      } as any,
      getContext: () => ({
        sessionId: "s1",
        employee: { username: "mira", nickname: "Mira" },
        model: { value: "test", label: "Test" },
      }),
    });
    await expect(
      transport.sendMessages({
        messages: [
          { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
        ],
      } as any)
    ).rejects.toBe(failure);
    expect(isStreamRequestFailure(failure)).toBe(true);
    expect(isStreamRequestFailure(new AIStreamInterruptedError())).toBe(false);
  });
});

describe("frontend tools of a conversation", () => {
  const pageContext = (toolId: string) => ({
    type: "page-element",
    id: "artifact",
    frontendTools: [{ id: toolId }],
  });
  const formContext = (form: string) => ({
    type: "page-element",
    id: form,
    kind: "form",
    content: { form, fields: [] },
  });

  it("stay available when a later message was sent without the page context", () => {
    const scope = getAIConversationToolScope([
      {
        role: "user",
        metadata: { workContext: [pageContext("artifact:proposeChanges")] },
      },
      { role: "assistant", metadata: {} },
      { role: "user", metadata: {} },
      { role: "assistant", metadata: {} },
    ]);
    expect(scope.allowedFrontendToolIds).toEqual(["artifact:proposeChanges"]);
  });

  it("do not reach tools no message of the conversation offered", () => {
    const scope = getAIConversationToolScope([
      { role: "user", metadata: {} },
      { role: "assistant", metadata: {} },
    ]);
    expect(scope.allowedFrontendToolIds).toEqual([]);
  });

  it("keep forms scoped to the latest user message", () => {
    const scope = getAIConversationToolScope([
      { role: "user", metadata: { workContext: [formContext("lead-form")] } },
      { role: "assistant", metadata: {} },
      { role: "user", metadata: { workContext: [formContext("deal-form")] } },
    ]);
    expect(scope.allowedFormIds).toEqual(["deal-form"]);
  });
});
