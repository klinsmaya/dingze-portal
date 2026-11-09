type Payload = { errors?: { message?: unknown }[]; data?: { errors?: { message?: unknown }[] } } | null | undefined;

/** The server's own message: the plugin's errors arrive wrapped as `{ data: { errors: [...] } }`, which the SDK does not read. */
function payloadMessage(payload: unknown): string | null {
  const p = payload as Payload;
  const message = p?.errors?.[0]?.message ?? p?.data?.errors?.[0]?.message;
  return typeof message === "string" && message ? message : null;
}

// 走查第三批：后端错误码映射成中文；插件自己写的中文原因照用；其余一律“没成功，请重试”。
const STATUS_MESSAGES: Record<number, string> = {
  400: "填写的内容不对，检查后再试",
  401: "登录已过期，请重新登录",
  403: "你没有这个操作的权限",
  404: "没找到要操作的内容，可能已被删除",
  409: "有人先改了这里，刷新后再试",
  413: "文件太大，单个不超过 20 MB",
  422: "填写的内容不对，检查后再试",
  429: "操作太频繁，稍等一下再试",
};

export const UNKNOWN_ERROR = "没成功，请重试";

const NETWORK_ERROR = "网络不通，检查网络后重试";

function statusOf(error: object): number | null {
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return status;
  const m = /\((\d{3})\)/.exec(String((error as Error).message ?? ""));
  return m ? Number(m[1]) : null;
}

function statusMessage(status: number): string {
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return "服务器出了点问题，稍后再试";
  return UNKNOWN_ERROR;
}

/** Plain-language message for a failed request: server reason first, then HTTP status, then network. */
export function errorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const fromPayload = "payload" in error ? payloadMessage((error as { payload: unknown }).payload) : null;
    if (fromPayload) return fromPayload;
    const message = "message" in error ? String((error as Error).message ?? "") : "";
    const status = statusOf(error);
    if (status) return statusMessage(status);
    if (/network|fetch|timeout|timed out|load failed|ECONN/i.test(message)) return NETWORK_ERROR;
    // 中文的是我们自己抛的（校验、门禁），照用；英文的技术信息不给用户看。
    if (/[一-鿿]/.test(message)) return message;
  }
  return UNKNOWN_ERROR;
}
