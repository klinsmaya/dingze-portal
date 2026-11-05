import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GUIDE_STEPS } from "@/lib/dingze/guide";
import { samplePath } from "@/lib/dingze/sample";

export function FirstRunGuide({ open, onClose, startHref }: { open: boolean; onClose: () => void; startHref: string }) {
  // 注册那一步已经做完了，从第 2 步“上传资料”开始讲。
  const steps = GUIDE_STEPS.filter((s) => s.no !== 1);
  const [page, setPage] = useState(0);
  const step = steps[page];
  const last = page === steps.length - 1;
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>欢迎，先看一眼怎么走</DialogTitle>
          <DialogDescription>一共 {steps.length} 步，做完就有年度经营计划书。每一步右边都有数字咨询师，不会填就问它。</DialogDescription>
        </DialogHeader>
        <ol className="flex gap-1" aria-label="进度">
          {steps.map((s, i) => (
            <li key={s.title} className="flex-1">
              <button
                type="button"
                onClick={() => setPage(i)}
                aria-current={i === page ? "step" : undefined}
                className={`flex w-full flex-col items-center gap-1 rounded-md px-1 py-1.5 text-xs ${i === page ? "bg-accent font-semibold" : "text-muted-foreground hover:bg-muted"}`}
              >
                <span className={`flex size-6 items-center justify-center rounded-full font-bold ${i === page ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{s.no! - 1}</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
        <div className="min-h-32 rounded-xl border bg-card p-4">
          <h3 className="font-heading text-lg font-bold">
            第 {step.no! - 1} 步 · {step.title}
          </h3>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm">
            {step.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <span className="flex gap-2">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link to={samplePath()} target="_blank" rel="noopener" />}>
              先看一套填好的示例
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/help" />} onClick={onClose}>
              完整指南
            </Button>
          </span>
          <span className="flex gap-2">
            {page > 0 ? (
              <Button variant="outline" onClick={() => setPage(page - 1)}>
                上一步
              </Button>
            ) : null}
            {last ? (
              <Button nativeButton={false} render={<Link to={startHref} />} onClick={onClose}>
                开始：上传资料 <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => setPage(page + 1)}>
                下一步 <ArrowRight />
              </Button>
            )}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
