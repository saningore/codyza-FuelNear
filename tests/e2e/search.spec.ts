import { expect, test } from "@playwright/test";

test.describe("FuelNear in the browser", () => {
  test("explains the price rule, rejects a bad ZIP, and keeps the footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Find gas stations near a real U.S. location." })).toBeVisible();
    await expect(page.getByText("Search a place to see gas stations. The map stays empty until you do.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toHaveAttribute("href", "https://codyza.com");

    await page.getByLabel("ZIP code, city, or street address").fill("1234");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter a 5-digit U.S. ZIP code." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /gas stations within/ })).toHaveCount(0);

    await page.getByRole("link", { name: "Sources" }).click();
    await expect(page.getByRole("heading", { name: "Where the information comes from" })).toBeVisible();
    await expect(page.getByRole("link", { name: "OpenStreetMap", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();

    await page.getByRole("link", { name: "About" }).click();
    await expect(page.getByRole("heading", { name: "About FuelNear" })).toBeVisible();
    await expect(page.getByText("Current fuel price unavailable.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();
  });

  test("explains a denied location without searching a fallback city", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Location permission was not granted" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /gas stations within/ })).toHaveCount(0);
  });

  test("searches ZIP 10001 and opens a real station", async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/");
    await page.getByLabel("Search radius").selectOption("5");
    await page.getByLabel("ZIP code, city, or street address").fill("10001");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("Searching for gas stations…")).toBeVisible();
    await expect(page.getByRole("heading", { name: /within 5 miles of ZIP code 10001/ })).toBeVisible({ timeout: 200_000 });
    await expect(page.getByText("Distances are measured from the center of this ZIP code.")).toBeVisible();
    await expect(page.getByText(/ZIP centers, not ZIP boundaries/)).toBeVisible();
    await expect(page.locator("[data-price='unavailable'], [data-price='listed'], [data-price='stale']").first()).toBeVisible();
    await expect(page.getByText("Map tiles © OpenStreetMap contributors")).toBeVisible();
    await expect(page.locator("[data-map-ready='true']")).toBeVisible({ timeout: 30_000 });
    const cards = page.getByRole("article");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
    const priceOrUnavailable = page.getByText(/Current fuel price unavailable\.|Source: Google Places/).first();
    await expect(priceOrUnavailable).toBeVisible();

    await cards.first().getByRole("link", { name: "Station details" }).click();
    await expect(page).toHaveURL(/\/station\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Google Maps directions" })).toHaveAttribute("href", /google\.com\/maps/);
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();
    await expect(page.getByText(/Current fuel price unavailable\.|Source: Google Places/).first()).toBeVisible();
  });

  test("shows the not-found page for an unknown station", async ({ page }) => {
    await page.goto("/station/not-a-station");
    await expect(page.getByRole("heading", { name: "That page is not available" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();
    await expect(page.locator("#main").getByRole("link", { name: "Find fuel" })).toBeVisible();
  });

  test("keeps the search form usable on a phone-width screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();
    await page.getByLabel("ZIP code, city, or street address").fill("60601");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("heading", { name: /within 5 miles of ZIP code 60601/ })).toBeVisible({ timeout: 150_000 });
    await expect(page.getByRole("button", { name: "List", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Map", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Map", exact: true }).click();
    await expect(page.locator("[data-map-ready='true']")).toBeVisible({ timeout: 30_000 });
  });
});
