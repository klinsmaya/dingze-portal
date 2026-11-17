import { Navigate, useSearchParams } from "react-router";

/** 「成员管理」的入口：默认去企业成员；旧链接（/enterprise?tab=invites 等）跳到对应的子页。 */
export default function EnterpriseIndex() {
  const [params] = useSearchParams();
  return <Navigate to={params.get("tab") === "invites" ? "/enterprise/invites" : "/enterprise/members"} replace />;
}
