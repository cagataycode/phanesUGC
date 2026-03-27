import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("should load the home page", async ({ page }) => {
    await page.goto("/");
    // Verify the page loaded (adjust selector based on your actual content)
    await expect(page).toHaveURL(/\/(en|de)?/);
  });

  test("should have a visible body", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
