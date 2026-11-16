import type { AIConversationActiveState } from "../services/types";

/**
 * The server runs a conversation independently of the response stream: closing the stream — the
 * user pressing Stop, a dropped connection, a proxy timeout — does not stop it, and it accepts a
 * second run for the same conversation while the first is still going. Two runs on one conversation
 * save two answers to the same question. This guard keeps the client to one run per conversation:
 * after a stream ends without the server confirming it finished, the conversation is "unsettled"
 * until the client has either stopped the server run or attached to it again, and shows the
 * server's messages.
 */

const ABORT_POLL_INTERVAL = 300;
const ABORT_POLL_ATTEMPTS = 10;
const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_BACKOFF = 1500;

type RunnableChat = { status: string };

export type ConversationRunPort<TChat extends RunnableChat> = {
  getActiveState: (
    conversationId: string
  ) => Promise<AIConversationActiveState | undefined>;
  abort: (conversationId: string) => Promise<void>;
  /** Replaces the chat's messages with the server's. */
  refresh: (conversationId: string, chat: TChat) => Promise<unknown>;
  /** Attaches to the run the server is still doing; resolves when that stream ends. */
  reattach: (conversationId: string, chat: TChat) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * - `idle`: no run is left on the server and the chat shows the server's messages.
 * - `reattached`: the server was still running; the chat followed that run to its end.
 * - `running`: a run is still going (attaching failed, or another stream is already following it).
 */
export type ConversationSettleOutcome = "idle" | "reattached" | "running";

const isServerRunning = (state: AIConversationActiveState | undefined) =>
  state === "streaming" || state === "invoking";

const isChatRunning = (chat: RunnableChat) =>
  chat.status === "streaming" || chat.status === "submitted";

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A response stream that was cut off while the server was still sending. */
export class AIStreamInterruptedError extends Error {
  constructor(cause?: unknown) {
    super("The connection was interrupted before the reply finished.", {
      cause,
    });
    this.name = "AIStreamInterruptedError";
  }
}

const requestFailures = new WeakSet<object>();

/** Marks an error raised before any response stream was opened. */
export const markStreamRequestFailure = <T>(error: T): T => {
  if (error && typeof error === "object") requestFailures.add(error);
  return error;
};

export const isStreamRequestFailure = (error: unknown) =>
  Boolean(error && typeof error === "object" && requestFailures.has(error));

export class ConversationRunGuard<TChat extends RunnableChat> {
  private readonly unsettled = new Set<string>();
  private readonly recoveries = new Map<string, number>();
  private readonly pending = new Map<
    string,
    { request: Promise<ConversationSettleOutcome>; abort: boolean }
  >();

  constructor(private readonly port: ConversationRunPort<TChat>) {}

  /** The local stream ended without the server confirming the run finished. */
  markInterrupted(conversationId: string) {
    this.unsettled.add(conversationId);
  }

  /** The server closed the stream itself: the run is over. */
  markFinished(conversationId: string) {
    this.unsettled.delete(conversationId);
    this.recoveries.delete(conversationId);
  }

  isUnsettled(conversationId: string) {
    return this.unsettled.has(conversationId);
  }

  forget(conversationId: string) {
    this.unsettled.delete(conversationId);
    this.recoveries.delete(conversationId);
  }

  /**
   * Counts automatic recoveries of one interruption and returns how long to wait before the next,
   * or `undefined` once they are used up: a connection that keeps dropping is left for the next
   * action the user takes.
   */
  nextRecoveryDelay(conversationId: string) {
    const attempt = (this.recoveries.get(conversationId) ?? 0) + 1;
    if (attempt > MAX_RECOVERY_ATTEMPTS) return undefined;
    this.recoveries.set(conversationId, attempt);
    return (attempt - 1) * RECOVERY_BACKOFF;
  }

  /**
   * Call before starting a run. `true` means nothing is running on the server for this
   * conversation. `false` means a run is still going or was just followed to its end: the caller
   * must not start another one on top of it.
   */
  async ensureIdle(conversationId: string, chat: TChat) {
    if (!this.unsettled.has(conversationId)) return true;
    this.recoveries.delete(conversationId);
    return (await this.settle(conversationId, chat)) === "idle";
  }

  /**
   * Brings the chat back in line with the server. With `abort`, the server run is stopped first.
   * With `keepLocalWhenIdle`, an idle server leaves the chat untouched: used when the request never
   * opened a stream, so the message the user just typed is not replaced by a history without it.
   */
  settle(
    conversationId: string,
    chat: TChat,
    options: { abort?: boolean; keepLocalWhenIdle?: boolean } = {}
  ) {
    const pending = this.pending.get(conversationId);
    // Callers share one pass, except that a stop is never folded into a pass that only looks: it
    // runs after it, so the server run is stopped either way.
    if (pending && (pending.abort || !options.abort)) return pending.request;
    const start = () => this.run(conversationId, chat, options);
    const request = (
      pending ? pending.request.then(start, start) : start()
    ).finally(() => {
      if (this.pending.get(conversationId)?.request === request) {
        this.pending.delete(conversationId);
      }
    });
    this.pending.set(conversationId, {
      request,
      abort: options.abort === true,
    });
    return request;
  }

  private async run(
    conversationId: string,
    chat: TChat,
    options: { abort?: boolean; keepLocalWhenIdle?: boolean }
  ): Promise<ConversationSettleOutcome> {
    const sleep = this.port.sleep ?? defaultSleep;
    this.unsettled.add(conversationId);

    if (options.abort) {
      await this.port.abort(conversationId);
      // The server saves what an aborted run had produced after the abort call has returned.
      for (let attempt = 0; attempt < ABORT_POLL_ATTEMPTS; attempt++) {
        await sleep(ABORT_POLL_INTERVAL);
        if (!isServerRunning(await this.port.getActiveState(conversationId))) {
          break;
        }
      }
      await this.port.refresh(conversationId, chat);
      this.unsettled.delete(conversationId);
      return "idle";
    }

    if (!isServerRunning(await this.port.getActiveState(conversationId))) {
      if (!options.keepLocalWhenIdle) {
        await this.port.refresh(conversationId, chat);
      }
      this.unsettled.delete(conversationId);
      return "idle";
    }

    if (isChatRunning(chat)) return "running";
    // The server replays the run from its last saved message, so the chat has to start from the
    // saved messages too, or the part already shown would be shown twice.
    await this.port.refresh(conversationId, chat);
    if (isChatRunning(chat)) return "running";
    await this.port.reattach(conversationId, chat);
    // A stream that ends normally is refreshed by the chat's own finish handler.
    if (chat.status === "error") return "running";
    this.unsettled.delete(conversationId);
    return "reattached";
  }
}
