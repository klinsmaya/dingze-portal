import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";

import { Button } from "@/components/ui/button";

import { EnterpriseManager } from "./components/enterprise-manager";

export default function EnterpriseDetailPage() {
  const enterpriseId = Number(useParams().enterpriseId);
  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" nativeButton={false} render={<Link to="/ops/enterprises" />}>
        <ArrowLeft /> 企业列表
      </Button>
      <EnterpriseManager key={enterpriseId} enterpriseId={enterpriseId} asOps />
    </div>
  );
}
