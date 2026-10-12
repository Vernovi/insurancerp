import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Demo-Harbourline-2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

test("rejects a wrong password and then signs in", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-email").fill("efe.adeyemi@harbourline.example");
  await page.getByTestId("login-password").fill("wrong-password");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-error")).toBeVisible();
  await login(page, "efe.adeyemi@harbourline.example");
  await expect(page.getByTestId("dashboard")).toContainText("Harbourline");
  await expect(page.getByTestId("dashboard")).toContainText("Motor, property, marine, energy, health, life");
});

test("risk register, heat map and a new motor risk", async ({ page }) => {
  await login(page, "efe.adeyemi@harbourline.example");
  await page.goto("/risks");
  await expect(page.getByRole("link", { name: "RSK-001" })).toBeVisible();
  await expect(page.getByText("Motor").first()).toBeVisible();
  await page.getByRole("link", { name: "RSK-004" }).click();
  await expect(page.getByTestId("appetite-flag")).toContainText("Above appetite");
  await page.goto("/risks/heatmap");
  await expect(page.getByTestId("heat-cell")).toHaveCount(25);
  const title = `Trial motor accumulation ${Date.now()}`;
  await page.goto("/risks/new");
  await page.getByTestId("risk-title").fill(title);
  await page.getByLabel("Description").fill("A fictional motor accumulation noted on the Lagos corridor during the trial.");
  await page.getByLabel("Strategic objective").fill("Keep this trial risk inside appetite.");
  await page.getByRole("button", { name: "Save risk" }).click();
  await expect(page.getByText(title)).toBeVisible();
});

test("policy version and approval state", async ({ page }) => {
  await login(page, "chioma.nwosu@harbourline.example");
  await page.goto("/policies/POL-ERM");
  await expect(page.getByTestId("policy-version").first()).toContainText("Version 3.0");
  await expect(page.getByText("Approved").first()).toBeVisible();
  await expect(page.getByText("not part of the annual conduct declaration")).toBeVisible();
});

test("NAICOM framework shows a cited clause and a score", async ({ page }) => {
  await login(page, "chioma.nwosu@harbourline.example");
  await page.goto("/compliance/naicom");
  await expect(page.getByTestId("framework-score")).toContainText("%");
  await page.getByRole("link", { name: "6.2.1", exact: true }).click();
  await expect(page.getByTestId("requirement-citation")).toContainText("naicom.gov.ng");
  await expect(page.getByTestId("requirement-text")).toContainText("Risk Management Framework");
});

test("overdue actions are flagged", async ({ page }) => {
  await login(page, "efe.adeyemi@harbourline.example");
  await page.goto("/actions?overdue=1");
  await expect(page.getByTestId("action-overdue").first()).toBeVisible();
  await page.getByRole("link", { name: "ACT-02", exact: true }).click();
  await expect(page).toHaveURL(/\/actions\/ACT-02$/);
  await expect(page.getByTestId("action-overdue")).toBeVisible();
});

test("code of conduct declaration links policy attestation", async ({ page }) => {
  await login(page, "tunde.bakare@harbourline.example");
  await page.goto("/declarations");
  await page.getByRole("link", { name: "Code of conduct" }).click();
  const panel = page.getByTestId("declaration-policies");
  await expect(panel).toContainText("Code of Conduct");
  await expect(panel).toContainText("Information Security Policy");
  await expect(panel).toContainText("Data Protection and Privacy Policy");
});

test("an objective shows a KPI and the linked risk", async ({ page }) => {
  await login(page, "efe.adeyemi@harbourline.example");
  await page.goto("/performance/OBJ-01");
  await expect(page.getByTestId("kpi-score").first()).toContainText("Motor loss ratio");
  await expect(page.getByRole("link", { name: "RSK-001" })).toBeVisible();
});

test("board viewer can open the pack and download it", async ({ page }) => {
  await login(page, "ireti.balogun@harbourline.example");
  await page.goto("/board");
  await expect(page.getByTestId("board-top")).toContainText("Top 10");
  await expect(page.getByTestId("board-above")).toContainText("above appetite");
  await expect(page.getByTestId("board-compliance")).toContainText("%");
  await expect(page.getByTestId("board-findings")).toContainText("FND-01");
  const pdf = await page.request.get("/api/export/board.pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("pdf");
  expect((await pdf.body()).byteLength).toBeGreaterThan(1000);
  const xlsx = await page.request.get("/api/export/board.xlsx");
  expect(xlsx.status()).toBe(200);
  expect(xlsx.headers()["content-type"]).toContain("spreadsheet");
  expect((await xlsx.body()).byteLength).toBeGreaterThan(1000);
});

test("staff cannot create a risk", async ({ page }) => {
  await login(page, "tunde.bakare@harbourline.example");
  const response = await page.request.post("/api/risks", { data: { title: "not allowed" } });
  expect(response.status()).toBe(403);
});
