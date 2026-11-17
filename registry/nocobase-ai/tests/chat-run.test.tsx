import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AIChatProvider, AIProvider, useAIChat } from "../providers";
import type { AIChatMessage } from "../providers/types";
import type { AIService } from "../services";

type ChatApi = ReturnType<typeof useAIChat>;

const encoder = new TextEncoder();
const sse = (event: unknown) =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

/**
 * The part of the server this is about: a run belongs to the conversation, not to the response
 * stream. It goes on when the stream is closed, it ends when it is finished or aborted, and
 * nothing stops a second run from starting next to it.
 */
function createFakeServer() {
  let streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  let saved: AIChatMessage[] = [];
  let nextId = 0;
  const save = (role: "user" | "assistant", text: string) => {
    const id = `server-${++nextId}`;
    saved = [
      ...saved,
      {
        id,
        role,
        metadata: { serverMessageId: id },
        parts: [{ type: "text", text }],
      },
    ];
  };
  const closeStreams = (events: unknown[]) => {
    for (const controller of streams) {
      try {
        for (const event of events) controller.enqueue(sse(event));
        controller.close();
      } catch {
        // The client already closed this one.
      }
    }
    streams = [];
  };
  const openStream = (events: unknown[], signal?: AbortSignal) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) controller.enqueue(sse(event));
        streams.push(controller);
        signal?.addEventListener("abort", () => {
          streams = streams.filter((item) => item !== controller);
          try {
            controller.error(new DOMException("Aborted", "AbortError"));
          } catch {
            // Already closed.
          }
        });
      },
    });

  const server = {
    running: false,
    sends: 0,
    resumes: 0,
    aborts: [] as string[],
    overlappingRuns: 0,
    failStateChecks: 0,
    get saved() {
      return saved;
    },
    /** The connection is cut; the run goes on. */
    dropConnection() {
      for (const controller of streams) {
        controller.error(new TypeError("network error"));
      }
      streams = [];
    },
    finishRun() {
      save("assistant", "完整回答");
      server.running = false;
      closeStreams([
        { type: "content", body: "回答", from: "main-agent" },
        { type: "stream_end", from: "main-agent" },
      ]);
    },
  };

  const service: AIService = {
    listEmployees: async () => [],
    listModels: async () => [],
    updateEmployeeUserPrompt: async () => undefined,
    listConversations: async () => [],
    getConversationMessages: async () => saved,
    getConversationActiveState: async () => {
      if (server.failStateChecks > 0) {
        server.failStateChecks -= 1;
        throw new TypeError("Failed to fetch");
      }
      return server.running ? "streaming" : "idle";
    },
    abortConversation: async (sessionId) => {
      server.aborts.push(sessionId);
      if (!server.running) return;
      save("assistant", "完整");
      server.running = false;
      closeStreams([{ type: "error", body: "Aborted" }]);
    },
    updateConversationTitle: async () => undefined,
    destroyConversation: async () => undefined,
    uploadFile: async () => ({}),
    createConversation: async () => "session-1",
    sendMessagesStream: async (body, signal) => {
      server.sends += 1;
      if (server.running) server.overlappingRuns += 1;
      server.running = true;
      const text = (body as { messages: Array<{ content: { content: string } }> })
        .messages[0].content.content;
      save("user", text);
      return openStream(
        [
          { type: "stream_start", from: "main-agent" },
          { type: "content", body: "完整", from: "main-agent" },
        ],
        signal
      );
    },
    resendMessagesStream: async () => openStream([]),
    updateToolCallDecision: async () => ({ updated: 0, toolCalls: [] }),
    resumeToolCallStream: async () => openStream([]),
    resumeConversationStream: async (_, signal) => {
      server.resumes += 1;
      return openStream([{ type: "stream_start", from: "main-agent" }], signal);
    },
  };
  return { server, service };
}

function renderChat(service: AIService) {
  const api: { current?: ChatApi } = {};
  function Probe() {
    api.current = useAIChat();
    return null;
  }
  render(
    <AIProvider
      service={service}
      employees={[{ username: "coach", nickname: "Coach" }]}
      models={[{ value: "test", label: "Test" }]}
    >
      <AIChatProvider id="test">
        <Probe />
      </AIChatProvider>
    </AIProvider>
  );
  const chat = () => api.current as ChatApi;
  const ask = async (text: string) => {
    await act(async () => chat().setDraft(text));
    await act(async () => {
      void chat().send();
    });
  };
  const texts = () =>
    chat().messages.map((message) =>
      message.parts
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("")
    );
  return { chat, ask, texts };
}

describe("a conversation has one run at a time", () => {
  it("stops the server when the user stops, so the next question gets one answer", async () => {
    const { server, service } = createFakeServer();
    const { chat, ask, texts } = renderChat(service);

    await ask("问题一");
    await waitFor(() => expect(chat().status).toBe("streaming"));

    await act(async () => {
      await chat().stop();
    });
    expect(server.aborts).toEqual(["session-1"]);
    expect(server.running).toBe(false);
    // The chat shows what the server kept of the stopped answer.
    expect(texts()).toEqual(["问题一", "完整"]);

    await ask("问题二");
    await waitFor(() => expect(server.sends).toBe(2));
    await act(async () => server.finishRun());
    await waitFor(() => expect(chat().status).toBe("ready"));

    expect(server.overlappingRuns).toBe(0);
    expect(texts()).toEqual(["问题一", "完整", "问题二", "完整回答"]);
  });

  it("follows the run again after the connection drops", async () => {
    const { server, service } = createFakeServer();
    const { chat, ask, texts } = renderChat(service);

    await ask("问题一");
    await waitFor(() => expect(chat().status).toBe("streaming"));

    await act(async () => server.dropConnection());
    await waitFor(() => expect(server.resumes).toBe(1));
    expect(server.running).toBe(true);

    await act(async () => server.finishRun());
    await waitFor(() => expect(chat().status).toBe("ready"));

    expect(server.sends).toBe(1);
    expect(texts()).toEqual(["问题一", "完整回答"]);
    expect(chat().error).toBeUndefined();
  });

  it("does not send the question again on top of a run that is still going", async () => {
    const { server, service } = createFakeServer();
    const { chat, ask, texts } = renderChat(service);

    await ask("问题一");
    await waitFor(() => expect(chat().status).toBe("streaming"));

    // Still offline when the client first looks: it cannot tell whether the run is over.
    server.failStateChecks = 1;
    await act(async () => server.dropConnection());
    await waitFor(() => expect(chat().status).toBe("error"));
    await waitFor(() => expect(server.failStateChecks).toBe(0));
    expect(server.resumes).toBe(0);

    // Back online, the user asks again: the client finds the first run and follows it.
    await ask("问题一");
    await waitFor(() => expect(server.resumes).toBe(1));
    expect(server.sends).toBe(1);

    await act(async () => server.finishRun());
    await waitFor(() => expect(chat().status).toBe("ready"));

    expect(server.overlappingRuns).toBe(0);
    expect(texts()).toEqual(["问题一", "完整回答"]);
    // The question the user typed again is still in the composer.
    expect(chat().draft).toBe("问题一");
  });
});
