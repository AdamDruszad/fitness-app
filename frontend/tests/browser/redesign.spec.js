import { test as base, expect } from "@playwright/test";
import { mockApi, NOW, PLAN_ID, PROPOSAL_ID, SESSION_ID } from "./fixtures";

const test = base.extend({
  api: [async ({ context, page }, use) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.clock.setFixedTime(new Date(NOW));
    await context.addInitScript(() => {
      if (!sessionStorage.getItem("initialized")) {
        localStorage.setItem("token", "test-token");
        sessionStorage.setItem("initialized", "true");
      }
    });
    const api = await mockApi(context);
    await use(api);
    expect(errors, "uncaught browser errors").toEqual([]);
    expect(api.unexpected, "unexpected API requests").toEqual([]);
  }, { auto: true }],
});

async function layoutIsHealthy(page, testInfo) {
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    background: getComputedStyle(document.body).backgroundColor,
    font: getComputedStyle(document.body).fontFamily,
    fontLoaded: [...document.fonts].some(font => font.family.includes("Archivo") && font.status === "loaded"),
    heading: parseFloat(getComputedStyle(document.querySelector("h1")).fontSize),
  }));
  expect(metrics.overflow, "page overflows horizontally").toBeLessThanOrEqual(1);
  expect(metrics.font).toContain("Archivo");
  expect(metrics.fontLoaded, "the actual web font must load").toBe(true);
  expect(metrics.heading, "page title lost its typography").toBeGreaterThanOrEqual(28);
  expect(metrics.background).toBe(testInfo.project.use.colorScheme === "light" ? "rgb(246, 242, 235)" : "rgb(18, 17, 16)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("page.png"), fullPage: true });
}

// These assert computed layout, not just class names: a successful Vite build can
// still ship a completely unstyled page if its CSS entry point was mis-merged.
const routes = [
  ["dashboard", "/", "Your plan", ".dashboard-grid", "grid"],
  ["workout chooser", "/log", "Workout", ".day-picker", "grid"],
  ["coach", "/coach", "AI Coach", ".coach-grid", "grid"],
  ["progress", "/progress", "Your progress", ".progress-summary", "grid"],
  ["onboarding", "/onboarding", "Training preferences", ".onboarding-grid", "grid"],
  ["plan review", `/plans/proposals/${PROPOSAL_ID}`, "Review your plan", ".review-grid", "grid"],
  ["plan history", "/plans/history", "Plan history", ".version-list", "grid"],
  ["saved session", `/sessions/${SESSION_ID}`, "Monday", ".session-logs", "grid"],
  ["not found", "/missing-page", "Page not found", ".not-found", "grid"],
];
for (const [name, path, heading, selector, display] of routes) {
  test(`${name} keeps its redesigned layout`, async ({ page }, testInfo) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
    await expect(page.locator(selector)).toBeVisible();
    await expect(page.locator(selector)).toHaveCSS("display", display);
    const mobile = testInfo.project.use.viewport.width < 768;
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible({ visible: mobile });
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible({ visible: !mobile });
    await layoutIsHealthy(page, testInfo);
  });
}

for (const [path, heading] of [["/login", "Welcome back"], ["/register", "Create an account"]]) {
  test(`${path} keeps its styled form`, async ({ context, page }, testInfo) => {
    await context.addInitScript(() => localStorage.removeItem("token"));
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.locator(".auth")).toHaveCSS("display", "grid");
    await expect(page.getByLabel("Email")).toHaveCSS("font-size", "16px");
    const button = page.getByRole("button", { name: path === "/login" ? "Log in" : "Create account", exact: true });
    await expect(button).toHaveCSS("background-color", "rgb(184, 70, 31)");
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await layoutIsHealthy(page, testInfo);
  });
}

test("workout survives reload and saves confirmed sets", async ({ page, api }, testInfo) => {
  await page.goto("/log");
  await page.getByRole("button", { name: /Monday/ }).click();
  await page.getByLabel("Bench press, set 1, kg", { exact: true }).fill("52.5");
  await page.getByLabel("Bench press, set 1, repetitions").fill("8");
  await page.getByRole("button", { name: "Complete Bench press set 1", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByRole("button", { name: "Complete Bench press set 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  const row = page.locator("[data-set-row]").first();
  await expect(row).toHaveCSS("display", "grid");
  expect((await row.boundingBox()).height).toBeLessThanOrEqual(60);
  for (const control of await row.locator("button").all()) {
    const box = await control.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await layoutIsHealthy(page, testInfo);
  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByRole("heading", { name: "Workout saved" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Monday");
  expect(api.requests.find(r => r.path === "/sessions/complete").body).toMatchObject({
    plan_id: PLAN_ID, day_id: "monday", exercises: [{ slot_id: "bench", sets_data: [{ weight: 52.5, reps: 8 }] }],
  });
});

test("coach sends multiline messages and restores composer focus", async ({ page, api }) => {
  await page.goto("/coach");
  const composer = page.getByRole("textbox", { name: "Message your coach" });
  await expect(composer).toBeEnabled();
  await composer.fill("Monday: bench press\nWednesday: squat");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Keep the load steady and add a rep when ready.")).toBeVisible();
  await expect(composer).toBeFocused();
  expect(api.requests.find(r => r.path === "/chat" && r.method === "POST").body.content).toContain("\n");
});

test("plan edits must be saved before activation", async ({ page, api }) => {
  await page.goto(`/plans/proposals/${PROPOSAL_ID}`);
  await page.getByLabel("Plan title", { exact: true }).fill("My revised training plan");
  const apply = page.getByRole("button", { name: "Save as my active plan" });
  await expect(apply).toBeDisabled();
  await page.getByRole("button", { name: "Save draft edits" }).click();
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.getByRole("link", { name: "Open my plan" })).toBeVisible();
  expect(api.requests.find(r => r.path.endsWith("/apply")).body).toEqual({ revision: 2, expected_active_id: PLAN_ID });
});

test("long plan and exercise names stay inside the viewport", async ({ page, context }, testInfo) => {
  await mockApi(context, { longNames: true });
  await page.goto("/");
  await expect(page.locator(".next-up")).toBeVisible();
  await layoutIsHealthy(page, testInfo);
  await page.goto("/log");
  await page.getByRole("button", { name: /Monday/ }).click();
  await expect(page.locator("[data-set-row]").first()).toBeVisible();
  await layoutIsHealthy(page, testInfo);
});

test("empty and failed API states remain readable", async ({ context, page }, testInfo) => {
  await mockApi(context, { empty: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your next chapter starts here." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create your plan" })).toHaveCSS("background-color", "rgb(184, 70, 31)");
  await mockApi(context, { fail: true });
  await page.reload();
  await expect(page.getByRole("alert")).toHaveText("Could not load your plan. Please try again.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await layoutIsHealthy(page, testInfo);
});
