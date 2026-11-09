import { type ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type PromptOptions = ConfirmOptions & {
  defaultValue?: string;
  placeholder?: string;
};

type Pending = { kind: "confirm" | "prompt"; opts: PromptOptions; settle: (value: boolean | string | null) => void };

type ConfirmApi = {
  /** 一个问题、两个按钮；返回是否确认。 */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** 带一个文本框的确认；取消返回 null。 */
  prompt: (opts: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmApi | null>(null);

/** 全站统一的确认弹层，代替浏览器原生的 confirm / prompt（样式、文案和焦点都受控）。 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [text, setText] = useState("");
  const pendingRef = useRef<Pending | null>(null);

  const open = useCallback((kind: Pending["kind"], opts: PromptOptions) => {
    return new Promise<boolean | string | null>((resolve) => {
      // 上一个还没答的问题按取消处理，不让两个问题叠在一起。
      pendingRef.current?.settle(kind === "prompt" ? null : false);
      const next: Pending = {
        kind,
        opts,
        settle: (value) => {
          if (pendingRef.current !== next) return;
          pendingRef.current = null;
          setPending(null);
          resolve(value);
        },
      };
      pendingRef.current = next;
      setText(opts.defaultValue ?? "");
      setPending(next);
    });
  }, []);

  const api = useMemo<ConfirmApi>(
    () => ({
      confirm: (opts) => open("confirm", opts).then((v) => v === true),
      prompt: (opts) => open("prompt", opts).then((v) => (typeof v === "string" ? v : null)),
    }),
    [open],
  );

  const cancelValue = pending?.kind === "prompt" ? null : false;
  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <AlertDialog open={!!pending} onOpenChange={(o) => (o ? null : pendingRef.current?.settle(cancelValue))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.opts.title}</AlertDialogTitle>
            {pending?.opts.description ? <AlertDialogDescription>{pending.opts.description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          {pending?.kind === "prompt" ? (
            <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={pending.opts.placeholder} className="min-h-20" aria-label={pending.opts.title} />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => pendingRef.current?.settle(cancelValue)}>{pending?.opts.cancelLabel ?? "取消"}</AlertDialogCancel>
            <AlertDialogAction
              variant={pending?.opts.destructive ? "destructive" : "default"}
              onClick={() => pendingRef.current?.settle(pending?.kind === "prompt" ? text : true)}
            >
              {pending?.opts.confirmLabel ?? "确定"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

const fallback: ConfirmApi = {
  confirm: async (opts) => window.confirm([opts.title, opts.description].filter(Boolean).join("\n")),
  prompt: async (opts) => window.prompt([opts.title, opts.description].filter(Boolean).join("\n"), opts.defaultValue ?? ""),
};

/** 取确认弹层；没有 Provider（如组件测试）时退回浏览器原生对话框。 */
export function useConfirm(): ConfirmApi {
  return useContext(ConfirmContext) ?? fallback;
}
