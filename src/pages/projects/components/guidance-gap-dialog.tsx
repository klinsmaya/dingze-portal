import { Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GAP_CATEGORIES, type GapCategory } from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectSummary } from "@/lib/dingze/api";
import { errorMessage } from "@/lib/dingze/errors";
import { useAddGuidanceGap } from "@/lib/dingze/guidance-api";

/** 记录引导缺口: a consultant notes where the digital consultant's guidance fell short. */
export function GuidanceGapButton({ project, code, artifactName }: { project: ProjectSummary; code: string; artifactName: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<GapCategory>("missing");
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const add = useAddGuidanceGap(project, code);

  const reset = () => {
    setCategory("missing");
    setDescription("");
    setExpected("");
    setExcerpt("");
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setOpen(true)}>
        <Flag /> 记录引导缺口
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>记录引导缺口</DialogTitle>
            <DialogDescription>
              {code} {artifactName}：数字咨询师哪里没引导到、引导错了，或校验口径与方法不符。评审通过后会进入下一版规则包；只有咨询团队能看到。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gap-category">类别</Label>
              <NativeSelect id="gap-category" value={category} onChange={(e) => setCategory(e.target.value as GapCategory)}>
                {Object.entries(GAP_CATEGORIES).map(([key, label]) => (
                  <NativeSelectOption key={key} value={key}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gap-description">缺口描述（必填）</Label>
              <Textarea id="gap-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例如：企业把“提升管理水平”当战略方向时，咨询师没有追问可衡量的结果。" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gap-expected">期望的引导</Label>
              <Textarea id="gap-expected" value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="应该怎么问、怎么提示，或按书中哪一节的口径。" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gap-excerpt">对话摘录</Label>
              <Textarea id="gap-excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="可粘贴相关的几句对话（请去掉企业敏感信息）。" className="min-h-16" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              disabled={!description.trim() || add.isPending}
              onClick={() =>
                add.mutate(
                  { category, description: description.trim(), expected: expected.trim(), excerpt: excerpt.trim() },
                  {
                    onSuccess: () => {
                      toast.success("已记录，运营会在“方法与规则包”里评审");
                      reset();
                      setOpen(false);
                    },
                    onError: (error) => toast.error(errorMessage(error)),
                  }
                )
              }
            >
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
