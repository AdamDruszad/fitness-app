import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";

test.use({ serviceWorkers: "allow" });
test("production PWA loads its font and serves the redesigned offline page", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-dark", "One production service-worker lifecycle is sufficient.");
  // Registration belongs to InstallHelp on the signed-in dashboard/onboarding.
  await mockApi(context);
  await context.addInitScript(() => localStorage.setItem("token", "test-token"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your plan", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].some(font => font.family.includes("Archivo") && font.status === "loaded"))).toBe(true);
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ display: "standalone", theme_color: "#121110", background_color: "#121110" });
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
  await page.evaluate(() => navigator.serviceWorker.ready);
  expect(await page.evaluate(async () => !!(await caches.match("/offline.html")))).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Let's reconnect." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try opening FitAI again" })).toHaveAttribute("href", "/");
});
