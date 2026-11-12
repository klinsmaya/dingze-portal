import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { FilterGroup, FilterItem } from "@/components/dingze/filter-group";

// 测试反馈 8：选了“目标分解”再点一次“目标分解”，不能悄悄跳回“全部阶段”。
function Stages({ onChange }: { onChange: (value: string) => void }) {
  const [stage, setStage] = useState("all");
  return (
    <FilterGroup
      value={stage}
      onChange={(next) => {
        setStage(next);
        onChange(next);
      }}
      aria-label="按阶段筛选"
    >
      <FilterItem value="all">全部阶段</FilterItem>
      <FilterItem value="goal">目标分解</FilterItem>
    </FilterGroup>
  );
}

describe("FilterGroup", () => {
  it("keeps the selected item selected when it is clicked again", () => {
    const onChange = vi.fn();
    render(<Stages onChange={onChange} />);
    const goal = screen.getByRole("button", { name: "目标分解" });
    const all = screen.getByRole("button", { name: "全部阶段" });
    expect(all.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(goal);
    expect(onChange).toHaveBeenLastCalledWith("goal");
    expect(goal.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(goal);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(goal.getAttribute("aria-pressed")).toBe("true");
    expect(all.getAttribute("aria-pressed")).toBe("false");
  });
});
