import { Building2 } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/dingze/errors";
import { useEnterprises } from "@/lib/dingze/ops-queries";

import { EnterpriseManager } from "../ops/components/enterprise-manager";

/** 本企业: an enterprise admin maintains their own enterprise's members and departments. */
export default function MyEnterprisePage() {
  const enterprises = useEnterprises();
  const [selected, setSelected] = useState<number | null>(null);

  if (enterprises.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (enterprises.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>企业信息加载失败</AlertTitle>
        <AlertDescription>{errorMessage(enterprises.error)}</AlertDescription>
      </Alert>
    );
  }
  const list = enterprises.data ?? [];
  if (list.length === 0) {
    return (
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2 />
          </EmptyMedia>
          <EmptyTitle>没有可管理的企业</EmptyTitle>
          <EmptyDescription>请联系咨询机构的运营管理员确认你的企业管理员身份。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const enterpriseId = selected ?? list[0].id;
  return (
    <div className="flex flex-col gap-4">
      {list.length > 1 ? (
        <NativeSelect aria-label="选择企业" value={enterpriseId} onChange={(e) => setSelected(Number(e.target.value))}>
          {list.map((e) => (
            <NativeSelectOption key={e.id} value={e.id}>
              {e.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : null}
      <EnterpriseManager key={enterpriseId} enterpriseId={enterpriseId} asOps={false} />
    </div>
  );
}
