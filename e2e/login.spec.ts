import { expect, test } from "@playwright/test";

import {
  loadPortalE2EEnvironment,
  requirePortalE2ECredentials,
  resolvePortalTestURL,
} from "./support";

const environment = loadPortalE2EEnvironment();

test("signs in and preserves the session after reload", async ({ page }) => {
  const credentials = requirePortalE2ECredentials(environment);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(resolvePortalTestURL(environment, "/login"));

  // The Portal signs in in Chinese; English labels are kept for other locales.
  const accountField = page.getByLabel(/^(用户名|账号|用户名或邮箱|Username or email)$/).first();
  await accountField.fill(credentials.account);
  await page.getByLabel(/^(密码|Password)$/).first().fill(credentials.password);
  await page.getByRole("button", { name: /^(登录|Sign in)$/ }).first().click();

  await expect
    .poll(() => new URL(page.url()).pathname)
    .not.toMatch(/\/(?:login|signin)\/?$/);

  await page.reload();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .not.toMatch(/\/(?:login|signin)\/?$/);
  await expect(page.getByLabel(/^(用户名|账号|用户名或邮箱|Username or email)$/)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
