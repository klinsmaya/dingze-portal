import { Building2 } from "lucide-react";
import { useSearchParams } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/dingze/errors";
import { useEnterpriseDetail, useEnterprises } from "@/lib/dingze/ops-queries";

import { InvitesTab } from "../ops/components/invites-tab";
import { ConsultantsTab, StaffTab } from "../ops/components/members-tab";
import { OpsPageHeader } from "../ops/components/page-header";

const TITLES = { members: "企业成员", consultants: "咨询师", invites: "邀请注册" } as const;
export type EnterpriseSectionKey = keyof typeof TITLES;

/**
 * 成员管理（企业管理员）：左侧菜单展开成三个子菜单，各是一页。一个企业账号只属于一家企业，所以不用选企业。
 * 组织部门不在这里：在项目“资料 › 组织与职责”里维护。
 */
export function EnterpriseSection({ section }: { section: EnterpriseSectionKey }) {
  const enterprises = useEnterprises();
  const enterpriseId = enterprises.data?.[0]?.id;
  const detail = useEnterpriseDetail(enterpriseId);
  const [params] = useSearchParams();

  const error = enterprises.error ?? detail.error;
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>企业信息加载失败</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    );
  }
  if (enterprises.isLoading || (enterpriseId && !detail.data)) return <Skeleton className="h-96 rounded-xl" />;
  if (!detail.data) {
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
  const open = params.get("open");
  return (
    <div className="flex flex-col gap-6">
      <OpsPageHeader title={TITLES[section]} />
      {section === "members" ? <StaffTab detail={detail.data} asOps={false} open={open === "create" || open === "bulk" ? open : null} /> : null}
      {section === "consultants" ? <ConsultantsTab detail={detail.data} asOps={false} /> : null}
      {section === "invites" ? <InvitesTab detail={detail.data} /> : null}
    </div>
  );
}
