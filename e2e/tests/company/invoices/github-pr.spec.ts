import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, invoices } from "@/db/schema";

test.describe("GitHub PR integration in invoices", () => {
  let company: typeof companies.$inferSelect;
  let contractorUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async () => {
    company = (
      await companiesFactory.createCompletedOnboarding({
        equityEnabled: false,
      })
    ).company;

    contractorUser = (
      await usersFactory.createWithBusinessEntity({
        zipCode: "22222",
        streetAddress: "1st St.",
      })
    ).user;

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
      payRateInSubunits: 6000,
    });
  });

  test("recognizes and prettifies GitHub PR URL in description field", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description or GitHub PR link").fill("https://github.com/antiwork/flexile/pull/123");
    await page.getByPlaceholder("Description or GitHub PR link").blur();

    await expect(page.getByText("antiwork/flexile")).toBeVisible();
    await expect(page.getByText("#123")).toBeVisible();
  });

  test("stores github_pr_url when submitting invoice with PR link", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description or GitHub PR link").fill("https://github.com/antiwork/flexile/pull/456");
    await page.getByLabel("Hours").fill("02:00");

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.companyId, company.id),
      with: { lineItems: true },
    });

    expect(invoice?.lineItems[0]?.githubPrUrl).toBe("https://github.com/antiwork/flexile/pull/456");
  });

  test("allows editing invoice with PR link and preserving the URL", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description or GitHub PR link").fill("https://github.com/antiwork/flexile/pull/789");
    await page.getByLabel("Hours").fill("01:00");

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await page.getByRole("row").filter({ hasText: "Awaiting approval" }).click();
    await page.getByRole("link", { name: "Edit" }).click();

    await expect(page.getByText("antiwork/flexile")).toBeVisible();
    await expect(page.getByText("#789")).toBeVisible();

    await page.getByLabel("Hours").fill("03:00");
    await page.getByRole("button", { name: "Resubmit" }).click();

    await expect(page.getByRole("heading", { name: "Invoice" })).toBeVisible();

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.companyId, company.id),
      with: { lineItems: true },
    });

    expect(invoice?.lineItems[0]?.githubPrUrl).toBe("https://github.com/antiwork/flexile/pull/789");
  });

  test("shows hover card with PR details when hovering over prettified PR link", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description or GitHub PR link").fill("https://github.com/antiwork/flexile/pull/242");
    await page.getByPlaceholder("Description or GitHub PR link").blur();

    await page.getByText("antiwork/flexile").hover();

    await expect(page.locator("[data-radix-hover-card-content]")).toBeVisible({ timeout: 5000 });
  });

  test("allows inputting regular description without PR link", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description or GitHub PR link").fill("Regular development work");
    await page.getByLabel("Hours").fill("04:00");

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.companyId, company.id),
      with: { lineItems: true },
    });

    expect(invoice?.lineItems[0]?.description).toBe("Regular development work");
    expect(invoice?.lineItems[0]?.githubPrUrl).toBeNull();
  });
});
