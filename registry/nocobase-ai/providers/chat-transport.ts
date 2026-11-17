import type { ChatTransport } from "ai";
import type { AIService } from "../services";
import { markStreamRequestFailure } from "./conversation-run";
import type { AIChatMessage, AIChatRequestContext } from "./types";
import { createNocoBaseUIMessageStream } from "./ui-message-stream";

const messageText = (message?: AIChatMessage) =>
  message?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n") ?? "";

export class NocoBaseChatTransport implements ChatTransport<AIChatMessage> {
  private pendingResend?: { messageId: string };
  private pendingConversationResume?: { message?: AIChatMessage };
  private pendingToolResume?: {
    messageId: string;
    responseMessageId: string;
    toolCallIds: string[];
    toolCallResults: Array<{ id: string; result: unknown }>;
  };
  private reconnectAbort?: AbortController;

  constructor(
    private readonly options: {
      service: AIService;
      getContext: () => AIChatRequestContext;
      onSessionCreated?: (sessionId: string) => void;
    }
  ) {}

  prepareResend(messageId: string) {
    this.pendingResend = { messageId };
  }

  cancelResend(messageId: string) {
    if (this.pendingResend?.messageId === messageId) {
      this.pendingResend = undefined;
    }
  }

  prepareConversationResume(messages: AIChatMessage[]) {
    this.pendingConversationResume = {
      message: [...messages]
        .reverse()
        .find((message) => message.role === "assistant"),
    };
  }

  prepareToolResume(
    messageId: string,
    responseMessageId: string,
    toolCallIds: string[],
    toolCallResults: Array<{ id: string; result: unknown }>
  ) {
    this.pendingToolResume = {
      messageId,
      responseMessageId,
      toolCallIds,
      toolCallResults,
    };
  }

  cancelToolResume(messageId: string) {
    if (this.pendingToolResume?.messageId === messageId) {
      this.pendingToolResume = undefined;
    }
  }

  /**
   * Closes a stream opened by `reconnectToStream`. The chat only hands its abort signal to
   * `sendMessages`, so stopping a resumed stream has to go through here.
   */
  abortReconnect() {
    this.reconnectAbort?.abort();
    this.reconnectAbort = undefined;
  }

  async sendMessages(
    options: Parameters<ChatTransport<AIChatMessage>["sendMessages"]>[0]
  ) {
    try {
      return await this.openMessageStream(options);
    } catch (error) {
      throw markStreamRequestFailure(error);
    }
  }

  async reconnectToStream() {
    const abort = new AbortController();
    this.reconnectAbort = abort;
    try {
      return await this.openReconnectStream(abort.signal);
    } catch (error) {
      throw markStreamRequestFailure(error);
    }
  }

  private async openMessageStream({
    messages,
    abortSignal,
  }: Parameters<ChatTransport<AIChatMessage>["sendMessages"]>[0]) {
    const context = this.options.getContext();
    if (context.model.configured === false) {
      throw new Error(
        "No enabled LLM model is configured in NocoBase. Configure and enable an LLM service before starting a conversation."
      );
    }
    let sessionId = context.sessionId;

    const pendingResend = this.pendingResend;
    this.pendingResend = undefined;
    if (pendingResend) {
      if (!sessionId) {
        throw new Error("A conversation is required to retry a message.");
      }
      const stream = await this.options.service.resendMessagesStream(
        {
          sessionId,
          messageId: pendingResend.messageId,
          model: {
            llmService: context.model.llmService,
            model: context.model.value,
          },
          webSearch: context.task?.webSearch,
        },
        abortSignal
      );
      return createNocoBaseUIMessageStream(stream);
    }

    if (!sessionId) {
      sessionId = await this.options.service.createConversation({
        employee: context.employee,
        model: context.model,
        systemMessage: context.task?.systemMessage,
        skillSettings: context.task?.skillSettings,
      });
      this.options.onSessionCreated?.(sessionId);
    }

    const lastMessage = messages.at(-1);
    const attachments = lastMessage?.metadata?.attachments?.filter(
      (attachment) => attachment.status === "done"
    );
    const workContext = [
      ...(context.task?.workContext ?? []),
      ...(lastMessage?.metadata?.workContext ?? []),
    ];
    const stream = await this.options.service.sendMessagesStream(
      {
        sessionId,
        aiEmployee: context.employee.username,
        model: {
          llmService: context.model.llmService,
          model: context.model.value,
        },
        systemMessage: context.task?.systemMessage,
        skillSettings: context.task?.skillSettings,
        webSearch: context.task?.webSearch,
        editingMessageId: lastMessage?.metadata?.editingMessageId,
        messages: [
          {
            key: lastMessage?.id ?? crypto.randomUUID(),
            role: "user",
            content: { type: "text", content: messageText(lastMessage) },
            attachments: attachments?.length ? attachments : undefined,
            workContext: workContext.length ? workContext : undefined,
          },
        ],
      },
      abortSignal
    );

    return createNocoBaseUIMessageStream(stream);
  }

  private async openReconnectStream(signal: AbortSignal) {
    const pendingToolResume = this.pendingToolResume;
    this.pendingToolResume = undefined;
    const pendingConversationResume = this.pendingConversationResume;
    this.pendingConversationResume = undefined;
    const context = this.options.getContext();
    if (!context.sessionId) {
      throw new Error("A conversation is required to resume a stream.");
    }

    if (!pendingToolResume) {
      const stream = await this.options.service.resumeConversationStream(
        context.sessionId,
        signal
      );
      return createNocoBaseUIMessageStream(stream, null, {
        seedMessage: pendingConversationResume?.message,
        expectStreamEnd: false,
      });
    }
    const stream = await this.options.service.resumeToolCallStream(
      {
        sessionId: context.sessionId,
        messageId: pendingToolResume.messageId,
        toolCallIds: pendingToolResume.toolCallIds,
        toolCallResults: pendingToolResume.toolCallResults,
        model: {
          llmService: context.model.llmService,
          model: context.model.value,
        },
        webSearch: context.task?.webSearch,
      },
      signal
    );
    return createNocoBaseUIMessageStream(
      stream,
      pendingToolResume.responseMessageId,
      {
        waitForNewMessage: true,
      }
    );
  }
}
