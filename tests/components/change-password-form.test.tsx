import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChangePasswordForm } from "@/components/auth/change-password-form";

vi.mock("@refinedev/core", () => ({ useLogout: () => ({ mutate: () => undefined }) }));

afterEach(cleanup);

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChangePasswordForm />
    </QueryClientProvider>,
  );
  const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const submit = () => screen.getByRole("button", { name: "修改密码" }) as HTMLButtonElement;
  return { type, submit };
}

// 本人改密码：新密码不合规、两遍不一样、和原密码一样时都不让提交，原因写在输入框下面。
describe("修改密码表单", () => {
  it("新密码要 8 位以上并同时有字母和数字", () => {
    const { type, submit } = setup();
    type("原密码", "Init1234");
    type("新密码", "abcdefgh");
    type("再输一遍新密码", "abcdefgh");
    expect(screen.getByText("密码要同时包含字母和数字")).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it("两遍不一样、或和原密码一样时不能提交", () => {
    const { type, submit } = setup();
    type("原密码", "Init1234");
    type("新密码", "Mine5678");
    type("再输一遍新密码", "Mine5679");
    expect(screen.getByText("两次输入的新密码不一样")).toBeTruthy();
    expect(submit().disabled).toBe(true);
    type("新密码", "Init1234");
    type("再输一遍新密码", "Init1234");
    expect(screen.getByText("新密码不能和原密码一样")).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it("都填对了才能提交", () => {
    const { type, submit } = setup();
    type("原密码", "Init1234");
    type("新密码", "Mine5678");
    type("再输一遍新密码", "Mine5678");
    expect(submit().disabled).toBe(false);
  });
});
