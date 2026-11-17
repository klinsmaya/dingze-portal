import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import type { EnterpriseDetail, EnterpriseMember, ProjectMembers } from "@/lib/dingze/ops-api";
import { opsKeys } from "@/lib/dingze/ops-queries";
import { ConsultantsTab, StaffTab } from "@/pages/ops/components/members-tab";
import { ProjectMembersDialog } from "@/pages/projects/components/project-members-dialog";

// 2026-11-17 统一加人和项目成员：成员管理分“企业成员”“咨询师”两组；项目成员三级管理，
// 同一个窗口里各级看到的能动的东西不一样（能不能做由服务端定，这里只核对界面照着显示）。

afterEach(cleanup);

function shell(children: ReactNode, seed?: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  seed?.(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const person = (id: number, nickname: string, role: EnterpriseMember["roles"][number], kind: EnterpriseMember["kind"], extra: Partial<EnterpriseMember> = {}): EnterpriseMember => ({
  id,
  username: `u${id}`,
  nickname,
  email: null,
  phone: null,
  roles: [role],
  kind,
  orgUnitId: null,
  disabled: false,
  mustChangePassword: false,
  createdAt: null,
  ...extra,
});

const detail: EnterpriseDetail = {
  enterprise: { id: 1, name: "瀚川燃气有限公司", shortName: "瀚川燃气", size: "large", status: "active", spaceName: "s1", createdAt: "2026-01-01" },
  projects: [
    {
      id: 10,
      name: "2026 年度战略落地",
      year: 2026,
      scene: "inhouse",
      service: "guided",
      primaryExpression: "sixfold",
      keyProjectLevel: 1,
      scheduleScale: "month",
      status: "active",
      members: [
        { userId: 1, projectRole: "ent_lead", orgUnitId: null, user: null },
        { userId: 2, projectRole: "member", orgUnitId: 5, user: null },
        { userId: 3, projectRole: "consultant", orgUnitId: null, user: null },
      ],
    },
  ],
  orgUnits: [{ id: 5, name: "燃气运营部", kind: "department", sort: 1, parentId: null, headId: null }],
  members: [
    person(1, "张总", "dz_ent_admin", "enterprise"),
    person(2, "王经理", "dz_ent_member", "enterprise", { orgUnitId: 5 }),
    person(3, "陈顾问", "dz_consultant", "consulting"),
  ],
  consultAdmins: [],
};

describe("成员管理：企业成员和咨询师分两组", () => {
  it("企业成员里只列本企业的账号，咨询师在另一组", () => {
    shell(<StaffTab detail={detail} asOps={false} />);
    expect(screen.getByText("张总")).toBeTruthy();
    expect(screen.getByText("王经理")).toBeTruthy();
    expect(screen.queryByText("陈顾问")).toBeNull();
    cleanup();
    shell(<ConsultantsTab detail={detail} asOps={false} />);
    expect(screen.getByText("陈顾问")).toBeTruthy();
    expect(screen.queryByText("王经理")).toBeNull();
  });

  it("企业管理员只能动企业成员的账号，设管理员、分派咨询师只有运营有", () => {
    shell(<StaffTab detail={detail} asOps={false} />);
    expect(screen.queryByRole("button", { name: /设为企业管理员|取消管理员/ })).toBeNull();
    // 只有企业成员（王经理）那一行能停用；企业管理员自己那一行没有。
    expect(screen.getAllByRole("button", { name: /停用/ })).toHaveLength(1);
    cleanup();
    shell(<StaffTab detail={detail} asOps />);
    expect(screen.getAllByRole("button", { name: /设为企业管理员|取消管理员/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /停用/ })).toHaveLength(2);
    cleanup();
    shell(<ConsultantsTab detail={detail} asOps={false} />);
    expect(screen.queryByRole("button", { name: /分派咨询师/ })).toBeNull();
    cleanup();
    shell(<ConsultantsTab detail={detail} asOps />);
    expect(screen.getByRole("button", { name: /分派咨询师/ })).toBeTruthy();
  });

  it("没有能用的企业管理员时给出提醒", () => {
    const none = { ...detail, members: detail.members.map((m) => (m.id === 1 ? { ...m, disabled: true } : m)) };
    shell(<StaffTab detail={none} asOps />);
    expect(screen.getByText(/没有能用的企业管理员/)).toBeTruthy();
  });
});

const members = (tier: ProjectMembers["tier"], assignable: ProjectMembers["assignable"]): ProjectMembers => ({
  projectId: 10,
  enterpriseId: 1,
  projectName: "2026 年度战略落地",
  service: "guided",
  tier,
  assignable,
  members: [
    { userId: 1, projectRole: "ent_lead", orgUnitId: null, nickname: "张总", username: "u1" },
    { userId: 2, projectRole: "member", orgUnitId: 5, nickname: "王经理", username: "u2" },
    { userId: 3, projectRole: "consultant", orgUnitId: null, nickname: "陈顾问", username: "u3" },
  ],
  candidates: [
    { id: 4, nickname: "刘工", username: "u4", kind: "enterprise", orgUnitId: null },
    { id: 5, nickname: "李顾问", username: "u5", kind: "consulting", orgUnitId: null },
  ],
  orgUnits: [{ id: 5, name: "燃气运营部", parentId: null }],
});

const openDialog = (data: ProjectMembers) => {
  shell(<ProjectMembersDialog projectId={10} onClose={() => undefined} />, (client) => client.setQueryData(opsKeys.projectMembers(10), data));
  return within(screen.getByRole("dialog"));
};

describe("项目成员：三级管理", () => {
  it("企业项目负责人只能加减项目成员", () => {
    const dialog = openDialog(members("lead", ["member"]));
    expect(dialog.queryByRole("combobox", { name: /的项目角色/ })).toBeNull();
    expect(dialog.getByRole("button", { name: "把 王经理 移出项目" })).toBeTruthy();
    expect(dialog.queryByRole("button", { name: "把 张总 移出项目" })).toBeNull();
    expect(dialog.queryByRole("button", { name: "把 陈顾问 移出项目" })).toBeNull();
    expect(dialog.getByRole("combobox", { name: "添加项目成员" })).toBeTruthy();
    expect(dialog.queryByRole("combobox", { name: "分派咨询师" })).toBeNull();
  });

  it("企业管理员还能换负责人，但不能动咨询师", () => {
    const dialog = openDialog(members("entAdmin", ["ent_lead", "member"]));
    expect(dialog.getAllByRole("combobox", { name: /的项目角色/ })).toHaveLength(2);
    expect(dialog.queryByRole("button", { name: "把 陈顾问 移出项目" })).toBeNull();
    expect(dialog.queryByRole("combobox", { name: "分派咨询师" })).toBeNull();
    expect(dialog.getByRole("link", { name: "发邀请码" }).getAttribute("href")).toBe("/enterprise/invites");
  });

  it("运营三样都能动", () => {
    const dialog = openDialog(members("ops", ["ent_lead", "member", "consultant"]));
    expect(dialog.getAllByRole("combobox", { name: /的项目角色/ })).toHaveLength(2);
    expect(dialog.getByRole("button", { name: "把 陈顾问 移出项目" })).toBeTruthy();
    expect(dialog.getByRole("combobox", { name: "分派咨询师" })).toBeTruthy();
    expect(dialog.getByRole("link", { name: "添加成员" }).getAttribute("href")).toBe("/ops/enterprises/1?tab=staff");
  });

  it("看得到项目但管不了成员的人只能看", () => {
    const dialog = openDialog(members(null, []));
    expect(dialog.getByText("王经理")).toBeTruthy();
    expect(dialog.queryByRole("button", { name: /移出项目/ })).toBeNull();
    expect(dialog.queryByRole("combobox")).toBeNull();
  });
});
