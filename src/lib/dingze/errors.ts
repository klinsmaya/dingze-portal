type Payload = { errors?: { message?: unknown }[]; data?: { errors?: { message?: unknown }[] } } | null | undefined;

/** The server's own message: the plugin's errors arrive wrapped as `{ data: { errors: [...] } }`, which the SDK does not read. */
function payloadMessage(payload: unknown): string | null {
  const p = payload as Payload;
  const message = p?.errors?.[0]?.message ?? p?.data?.errors?.[0]?.message;
  return typeof message === "string" && message ? message : null;
}

export function errorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const fromPayload = "payload" in error ? payloadMessage((error as { payload: unknown }).payload) : null;
    if (fromPayload) return fromPayload;
    if ("message" in error) return String((error as Error).message);
  }
  return "操作失败，请稍后重试";
}
