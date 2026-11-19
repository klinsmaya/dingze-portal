import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import type { ProjectMembers } from "@/lib/dingze/ops-api";
import { opsKeys } from "@/lib/dingze/ops-queries";
import { AddProjectMembers } from "@/pages/projects/components/add-members";

// HUPO-37：「我的项目 › 添加成员」是把已有员工加进项目，不是去开通账号。

afterEach(cleanup);

const membersOf = (projectId: number, projectName: string): ProjectMembers => ({
  projectId,
  enterpriseId: 1,
  projectName,
  service: "guided",
  tier: "entAdmin",
  assignable: ["ent_lead", "member"],
  members: [{ userId: 1, projectRole: "ent_lead", orgUnitId: null, nickname: "张总", username: "u1" }],
  candidates: [{ id: 4, nickname: "刘工", username: "u4", kind: "enterprise", orgUnitId: null }],
  orgUnits: [],
});

function renderEntry(projects: { id: number; name: string; year: number }[] | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  for (const p of projects ?? []) client.setQueryData(opsKeys.projectMembers(p.id), membersOf(p.id, p.name));
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AddProjectMembers projects={projects} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "添加成员" }));
}

describe("我的项目 › 添加成员", () => {
  it("只有一个进行中的项目时直接打开它的项目成员", () => {
    renderEntry([{ id: 10, name: "2026 年度战略落地", year: 2026 }]);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("heading", { name: "项目成员 · 2026 年度战略落地" })).toBeTruthy();
    expect(dialog.getByRole("combobox", { name: "添加项目成员" })).toBeTruthy();
  });

  it("多个项目时先选项目，打开的是选中的那个", () => {
    renderEntry([
      { id: 10, name: "2026 年度战略落地", year: 2026 },
      { id: 11, name: "2027 年度战略落地", year: 2027 },
    ]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /2027 年度战略落地/ }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("heading", { name: "项目成员 · 2027 年度战略落地" })).toBeTruthy();
  });

  it("没有进行中的项目时说明先新建或恢复，不去开通账号", () => {
    renderEntry([]);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/先新建项目，或恢复已归档的项目/)).toBeTruthy();
    expect(dialog.queryByRole("link")).toBeNull();
  });

  it("项目列表还没拿到时不能点", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AddProjectMembers projects={undefined} />
      </QueryClientProvider>,
    );
    expect((screen.getByRole("button", { name: "添加成员" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
