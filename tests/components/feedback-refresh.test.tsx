import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { GoalPathSystem, StrategyMap } from "@dingze/shared";

import { PathSystemEditor } from "@/pages/projects/editors/path-system-editor";
import { StrategyMapEditor } from "@/pages/projects/editors/strategy-map-editor";

function PathHost({ initial, view }: { initial: GoalPathSystem; view: "t310" | "mind" }) {
  const [value, setValue] = useState(initial);
  return (
    <>
    <button type="button" onClick={() => setValue({ ...value, nodes: value.nodes.map((n) => (n.id === "a" ? { ...n, value: "800", amount: 800 } : n)) })}>external fix</button>
    <PathSystemEditor
      value={value}
      onChange={setValue}
      readOnly={false}
      issues={[]}
      goalWord="年度目标"
      goals={[{ id: "g1", label: "营收", metric: "营收", value: "1000", unit: "万元" }]}
      decodeLayout
      graphSpecId="S2-02"
      defaultView={view}
    />
    </>
  );
}

const paths = (): GoalPathSystem => ({
  nodes: [
    { id: "a", parentId: null, goalId: "g1", level: 1, path: "开发新客户", metric: "营收", value: "1000", amount: 1000, unit: "万元", perspective: "financial" },
    { id: "a1", parentId: "a", goalId: null, level: 2, path: "华东", metric: "营收", value: "300", amount: 300, unit: "万元" },
    { id: "a2", parentId: "a", goalId: null, level: 2, path: "华南", metric: "营收", value: "500", amount: 500, unit: "万元" },
  ],
} as GoalPathSystem);

describe("one-click fix in 表 3-10 refreshes the sums", () => {
  it("updates the check row and the mind map right after the fix", () => {
    render(<PathHost initial={paths()} view="t310" />);
    const fix = screen.getByRole("button", { name: /把上级改为 800/ });
    fireEvent.click(fix);
    expect(screen.queryByRole("button", { name: /把上级改为 800/ })).toBeNull();
    expect(screen.getByText(/800 = 300 \+ 500/)).toBeInTheDocument();
  });

  it("mind map sums follow an external change", () => {
    render(<PathHost initial={paths()} view="mind" />);
    expect(screen.getAllByText(/1000 ≠ 300 \+ 500|≠/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("external fix"));
    expect(screen.getAllByText(/800 = 300 \+ 500|300 \+ 500 = 800/).length).toBeGreaterThan(0);
  });
});

function MapHost({ initial }: { initial: StrategyMap }) {
  const [value, setValue] = useState(initial);
  return <StrategyMapEditor value={value} onChange={setValue} readOnly={false} issues={[]} upstream={{}} />;
}

describe("strategy map relation removal", () => {
  it("removes the relation row at once", () => {
    render(
      <MapHost
        initial={{
          objectives: [
            { id: "o1", perspective: "financial", title: "营收", note: "" },
            { id: "o2", perspective: "customer", title: "客户", note: "" },
          ],
          links: [{ id: "r1", from: "o2", to: "o1", kind: "cause" }],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除 这条关系" }));
    expect(screen.getByText("还没有关系")).toBeInTheDocument();
  });
});
