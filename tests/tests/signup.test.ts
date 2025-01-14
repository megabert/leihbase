import { test, expect } from "@playwright/test";
import { waitForHydration } from "../lib/utils";

test.describe("signup", () => {
  test("can reach signup from homepage", async ({ page }) => {
    await page.goto("/");
    await waitForHydration(page);
    await page.getByTestId("signup-link").click();
    await expect(page.getByTestId("signup-h1")).toBeDefined();
  });
  test("can sign up", async ({ page }) => {
    await page.goto("/signup");
    await waitForHydration(page);
    await page.getByTestId("name-input").fill("John");
    await page.getByTestId("email-input").fill("john@example.com");
    await page.getByTestId("password-input").fill("123456789");
    await page.getByTestId("tac-checkbox").check();
    await page.getByTestId("submit-button").click();
    await expect(page.getByTestId("signup-error")).toHaveCount(0);
    await expect(page).toHaveURL("/profile");
  });
  test("requires accepting terms and conditions", async ({ page }) => {
    await page.goto("/signup");
    await waitForHydration(page);
    await page.getByTestId("name-input").fill("John");
    await page.getByTestId("email-input").fill("test@example.com");
    await page.getByTestId("password-input").fill("123456789");
    await page.getByTestId("submit-button").click();
    await expect(
      page.locator("[data-testid=tac-checkbox][required]:invalid")
    ).toHaveCount(1);
  });
});
