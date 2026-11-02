import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { SAMPLE_CODES } from "@/lib/dingze/sample";
import { SampleTable } from "@/pages/sample";

// 示例页不经过填写页的编辑会话，每张示例表都要能单独只读显示。
describe("sample tables", () => {
  it.each(SAMPLE_CODES)("renders %s read-only without the workspace", (code) => {
    const { container } = render(
      <MemoryRouter>
        <SampleTable code={code} />
      </MemoryRouter>,
    );
    expect(container.textContent?.length ?? 0).toBeGreaterThan(20);
  });
});
